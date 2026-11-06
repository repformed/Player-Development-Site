import { createHash } from 'node:crypto';
import { readFile, readdir, lstat, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import process from 'node:process';
import console from 'node:console';
import { execFileSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const target = JSON.parse(await readFile(resolve(root,'.github/pages-release/target.json')));
const hash = b => createHash('sha256').update(b).digest('hex');
const requireThat = (condition, message) => { if (!condition) throw Error(message); };
const readJSON = async path => JSON.parse(await readFile(path, 'utf8'));
export function dispatchGuard(env) {
  requireThat(env.GITHUB_ACTIONS==='true' && env.GITHUB_REPOSITORY===target.repository && env.GITHUB_EVENT_NAME==='workflow_dispatch' && env.GITHUB_REF==='refs/heads/main', 'Trusted main manual dispatch required');
  requireThat(env.CONFIRM_SOURCE_SHA===target.sourceSha, 'Exact source confirmation required');
  requireThat(/^[a-f0-9]{40}$/.test(env.GITHUB_SHA || ''), 'Control commit required');
  requireThat(/^\d+$/.test(env.GITHUB_RUN_ID || ''), 'Run identity required');
  requireThat(/^[a-f0-9-]{36}$/.test(env.EXPECTED_PRODUCTION_ID || ''), 'Verified production deployment ID required');
}
export function validateWorker(text, template, approvedAssets, siteFiles) {
  const version = /const CACHE = `\$\{PREFIX\}([a-f0-9]{16})`;/.exec(text)?.[1];
  const raw = /const ASSETS = (\[.*?\])\.map/.exec(text)?.[1];
  requireThat(version && raw, 'Unrecognized service worker');
  const assets = JSON.parse(raw);
  requireThat(Array.isArray(assets) && new Set(assets).size===assets.length && JSON.stringify([...assets].sort())===JSON.stringify(approvedAssets), 'Unexpected worker precache set');
  const digest = createHash('sha256').update(template);
  for (const name of assets) { requireThat(siteFiles.has(name),'Missing precache file'); digest.update(name).update(siteFiles.get(name)); }
  requireThat(digest.digest('hex').slice(0,16)===version,'Invalid worker cache version');
  requireThat(text===template.replace('__VERSION__',version).replace('__ASSETS__',JSON.stringify(assets)), 'Worker code changed');
}
export async function verifySite(site, expected = null, worker = null) {
  const rootStat=await lstat(site); requireThat(rootStat.isDirectory() && !rootStat.isSymbolicLink(), "Site root must be a real directory");
  const approved = expected || await readJSON(resolve(root,'.github/pages-release/approved-manifest.json'));
  const files = new Map();
  async function walk(dir, prefix='') {
    for (const name of (await readdir(dir)).sort()) {
      const path=resolve(dir,name), rel=prefix+name, stat=await lstat(path);
      requireThat(!stat.isSymbolicLink(), 'Site symlink forbidden');
      if(stat.isDirectory()) await walk(path,rel+'/');
      else { requireThat(stat.isFile(), 'Regular site files required'); requireThat(Object.hasOwn(approved,rel) && stat.size===approved[rel].bytes,'Unexpected file or size: '+rel); files.set(rel,await readFile(path)); }
    }
  }
  await walk(site);
  requireThat(JSON.stringify([...files.keys()].sort())===JSON.stringify(Object.keys(approved).sort()),'Unexpected or missing site files');
  for(const [name,bytes] of files) if(name!=='sw.js') requireThat(hash(bytes)===approved[name].sha256 && bytes.length===approved[name].bytes,'Site differs from approved artifact: '+name);
  await validateWorker(files.get('sw.js').toString(),worker?.template || await readFile(resolve(root,'build/service-worker.txt'),'utf8'),worker?.assets || await readJSON(resolve(root,'.github/pages-release/approved-sw-assets.json')),files);
  const manifest=Object.fromEntries([...files].sort(([a],[b])=>a.localeCompare(b,'en')).map(([name,bytes])=>[name,{bytes:bytes.length,sha256:hash(bytes)}]));
  return {sourceSha:target.sourceSha,manifest,manifestDigest:hash(JSON.stringify(manifest)),workerOrderingDiffers:manifest['sw.js'].sha256!==approved['sw.js'].sha256};
}
export function projectGuard(project, expectedId) {
  requireThat(project?.name===target.project && project.production_branch===target.productionBranch && project.domains?.includes('repformed.com') && project.domains?.includes('repformed.pages.dev'),'Wrong Cloudflare project');
  requireThat(project.canonical_deployment?.id===expectedId && project.canonical_deployment?.latest_stage?.status==='success','Production baseline changed or unhealthy');
}
export function promotionGuard(proof, build, run, env) {
  requireThat(/^\d+$/.test(env.PREVIEW_RUN_ID || ''),'Preview run required');
  requireThat(proof?.phase==='preview' && proof.runId===env.PREVIEW_RUN_ID && proof.controlSha===env.GITHUB_SHA && proof.sourceSha===target.sourceSha,'Preview identity mismatch');
  requireThat(proof.manifestDigest===build.manifestDigest && env.CONFIRM_MANIFEST_DIGEST===build.manifestDigest,'Exact preview bytes confirmation required');
  requireThat(run?.id?.toString()===env.PREVIEW_RUN_ID && run.event==='workflow_dispatch' && run.head_branch==='main' && run.head_sha===env.GITHUB_SHA && run.path===target.workflowPath && run.conclusion==='success' && run.status==='completed','Successful same-controller preview run required');
  requireThat(proof.baseline===env.EXPECTED_PRODUCTION_ID,'Preview production baseline mismatch');
  requireThat(proof.branch===`review-${env.PREVIEW_RUN_ID}` && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(proof.deploymentId || ''),'Invalid preview provider binding');
}
export function previewGuard(deployment, proof) {
  requireThat(deployment?.id===proof.deploymentId && deployment.environment==='preview' && deployment.latest_stage?.status==='success' && deployment.deployment_trigger?.metadata?.commit_hash===target.sourceSha && deployment.deployment_trigger?.metadata?.branch===proof.branch,'Preview deployment no longer verified');
}
// This narrows the race; Pages has no atomic baseline CAS in this workflow.
export async function guardedWrite(readProject, expectedId, write) {
  projectGuard(await readProject(), expectedId);
  return write();
}
export async function api(path, token, host='https://api.cloudflare.com/client/v4', fetcher=globalThis.fetch) {
  requireThat(token,'Required secure binding missing');
  const response=await fetcher(host+path,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},redirect:'error',signal:globalThis.AbortSignal.timeout(30000)});
  requireThat(response.ok,`Provider read failed HTTP ${response.status}; do not blindly retry`);
  const value=await response.json();
  if(host.includes('api.cloudflare.com')) { requireThat(value.success===true,'Cloudflare read unconfirmed'); return value.result; }
  return value;
}
async function main() {
  const [command, site, output]=process.argv.slice(2), env=process.env;
  if(command==='verify') {
    const receipt=await verifySite(resolve(site)); await writeFile(output,JSON.stringify(receipt,null,2)+'\n');return;
  }
  dispatchGuard(env);
  const build=await verifySite(resolve(site));
  const supplied=await readJSON(resolve(site,'../build.json'));
  requireThat(build.manifestDigest===supplied.manifestDigest && supplied.sourceSha===target.sourceSha,'Downloaded build mismatch');
  const path=`/accounts/${target.accountId}/pages/projects/${target.project}`;
  const project=await api(path,env.CLOUDFLARE_API_TOKEN); projectGuard(project,env.EXPECTED_PRODUCTION_ID);
  let branch;
  if(command==='preview') branch=`review-${env.GITHUB_RUN_ID}`;
  else if(command==='promote') {
    const proof=await readJSON(env.PREVIEW_PROOF);
    requireThat(/^\d+$/.test(env.PREVIEW_RUN_ID || ''),'Preview run required');
    const run=await api(`/repos/${target.repository}/actions/runs/${env.PREVIEW_RUN_ID}`,env.GH_TOKEN,'https://api.github.com');
    promotionGuard(proof,build,run,env);
    previewGuard(await api(path+'/deployments/'+proof.deploymentId,env.CLOUDFLARE_API_TOKEN),proof);
    branch=target.productionBranch;
  } else throw Error('Unknown deployment command');
  // No arbitrary project creation, flags, shell interpolation or token output.
  const cli=resolve(env.PAGES_CLI,'node_modules/wrangler/bin/wrangler.js');
  const childEnv={...env,CLOUDFLARE_ACCOUNT_ID:target.accountId,CI:'true',WRANGLER_SEND_METRICS:'false',WRANGLER_LOG_PATH:resolve(env.RUNNER_TEMP,'pages-cli-logs')};
  delete childEnv.GH_TOKEN; delete childEnv.GITHUB_TOKEN;
  await guardedWrite(()=>api(path,env.CLOUDFLARE_API_TOKEN),env.EXPECTED_PRODUCTION_ID,()=>{
    try {
      execFileSync(process.execPath,[cli,'pages','deploy',resolve(site),'--project-name='+target.project,'--branch='+branch,'--commit-hash='+target.sourceSha,'--commit-message=Verified public '+target.sourceSha+' run '+env.GITHUB_RUN_ID,'--commit-dirty=false'],{env:childEnv,stdio:'pipe'});
    } catch { throw Error('Deployment outcome unconfirmed. Inspect existing deployments before any retry; no automatic redeploy.'); }
  });
  // Read-only reconciliation; no second write on a missing/delayed result.
  const deployments=await api(path+'/deployments?per_page=20',env.CLOUDFLARE_API_TOKEN);
  const matches=deployments.filter(d=>d.deployment_trigger?.metadata?.branch===branch && d.deployment_trigger?.metadata?.commit_hash===target.sourceSha && d.deployment_trigger?.metadata?.commit_message===`Verified public ${target.sourceSha} run ${env.GITHUB_RUN_ID}`);
  requireThat(matches.length===1,'Deployment identity unconfirmed; inspect before retry');
  const result=matches[0];
  requireThat(result.environment===(command==='preview'?'preview':'production') && result.latest_stage?.status==='success','Deployment not confirmed successful');
  const url=new URL(result.url); requireThat(url.protocol==='https:' && /^[a-z0-9-]+\.repformed\.pages\.dev$/.test(url.hostname) && url.pathname==='/' && !url.search && !url.hash,'Unexpected deployment URL');
  const receipt={phase:command,runId:env.GITHUB_RUN_ID,controlSha:env.GITHUB_SHA,sourceSha:target.sourceSha,manifestDigest:build.manifestDigest,workerOrderingDiffers:build.workerOrderingDiffers,baseline:env.EXPECTED_PRODUCTION_ID,deploymentId:result.id,branch,url:url.origin};
  if(command==='promote') { const current=await api(path,env.CLOUDFLARE_API_TOKEN); requireThat(current.canonical_deployment?.id===result.id,'Production pointer not confirmed'); }
  await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(receipt,null,2)+'\n');
  if(env.GITHUB_OUTPUT) await (await import('node:fs/promises')).appendFile(env.GITHUB_OUTPUT,`url=${url.origin}\nmanifest_digest=${build.manifestDigest}\n`);
  console.log(JSON.stringify(receipt));
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) main().catch(e=>{console.error(e.message);process.exitCode=1;});
