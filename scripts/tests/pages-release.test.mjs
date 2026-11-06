import { test } from 'node:test';
import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { target, dispatchGuard, verifySite, validateWorker, projectGuard, promotionGuard, previewGuard, api, guardedWrite } from '../pages-release.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const env={GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:target.repository,GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:'refs/heads/main',GITHUB_SHA:'a'.repeat(40),GITHUB_RUN_ID:'42',CONFIRM_SOURCE_SHA:target.sourceSha,EXPECTED_PRODUCTION_ID:target.initialProductionId,PREVIEW_RUN_ID:'11',CONFIRM_MANIFEST_DIGEST:'b'.repeat(64)};
const proof={phase:'preview',runId:'11',controlSha:env.GITHUB_SHA,sourceSha:target.sourceSha,manifestDigest:env.CONFIRM_MANIFEST_DIGEST,baseline:target.initialProductionId,branch:'review-11',deploymentId:'00000000-0000-4000-8000-000000000001'};
const run={id:11,event:'workflow_dispatch',head_branch:'main',head_sha:env.GITHUB_SHA,path:target.workflowPath,status:'completed',conclusion:'success'};
test('only explicit trusted-main manual source confirmation passes',()=>{
 dispatchGuard(env);
 for(const key of ['GITHUB_ACTIONS','GITHUB_REPOSITORY','GITHUB_EVENT_NAME','GITHUB_REF','GITHUB_SHA','GITHUB_RUN_ID','CONFIRM_SOURCE_SHA','EXPECTED_PRODUCTION_ID']) assert.throws(()=>dispatchGuard({...env,[key]:'wrong'}));
});
test('wrong project, domain, production branch, unhealthy or drifted baseline stop before writes',()=>{
 const p={name:target.project,production_branch:'main',domains:['repformed.com','repformed.pages.dev'],canonical_deployment:{id:target.initialProductionId,latest_stage:{status:'success'}}};projectGuard(p,target.initialProductionId);
 for(const altered of [{...p,name:'other'},{...p,production_branch:'other'},{...p,domains:[]},{...p,canonical_deployment:{id:'other',latest_stage:{status:'success'}}},{...p,canonical_deployment:{id:target.initialProductionId,latest_stage:{status:'active'}}}])assert.throws(()=>projectGuard(altered,target.initialProductionId));
});
test('promotion binds complete successful same-controller preview, bytes and explicit confirmation',()=>{
 const build={manifestDigest:env.CONFIRM_MANIFEST_DIGEST};promotionGuard(proof,build,run,env);
 for(const [key,value] of [['phase','promote'],['runId','12'],['controlSha','c'.repeat(40)],['sourceSha','c'.repeat(40)],['manifestDigest','c'.repeat(64)],['baseline','other'],['branch','main'],['deploymentId','../other']])assert.throws(()=>promotionGuard({...proof,[key]:value},build,run,env));
 for(const [key,value] of [['id',12],['event','pull_request'],['head_branch','other'],['head_sha','other'],['path','other'],['status','in_progress'],['conclusion','failure']])assert.throws(()=>promotionGuard(proof,build,{...run,[key]:value},env));
 assert.throws(()=>promotionGuard(proof,build,run,{...env,CONFIRM_MANIFEST_DIGEST:'other'}));
});
test('provider preview must remain successful preview with exact source and run branch',()=>{
 const d={id:proof.deploymentId,environment:'preview',latest_stage:{status:'success'},deployment_trigger:{metadata:{branch:proof.branch,commit_hash:target.sourceSha}}};previewGuard(d,proof);
 for(const x of [{...d,environment:'production'},{...d,id:'other'},{...d,latest_stage:{status:'failure'}},{...d,deployment_trigger:{metadata:{branch:'main',commit_hash:target.sourceSha}}}])assert.throws(()=>previewGuard(x,proof));
});
test('API reads cannot follow redirects, expose provider bodies or retry a forbidden response',async()=>{
 let calls=0;const token='fictional-only-not-a-real-credential';const fake=async (_url,init)=>{calls++;assert.equal(init.redirect,'error');assert.equal(init.headers.Authorization,'Bearer '+token);return new globalThis.Response('sensitive fictional error',{status:403});};
 await assert.rejects(api('/fictional',token,undefined,fake),/HTTP 403/);assert.equal(calls,1);
 await assert.rejects(api('/fictional','',undefined,fake),/binding missing/);assert.equal(calls,1);
});
test('worker variation is limited to legitimate cache-version/asset ordering with identical code',()=>{
 const template='const CACHE = `${PREFIX}__VERSION__`;\nconst ASSETS = __ASSETS__.map((name) => name);\n';const files=new Map([['a',Buffer.from('A')],['b',Buffer.from('B')]]);
 const make=assets=>{const h=createHash('sha256').update(template);for(const name of assets)h.update(name).update(files.get(name));return template.replace('__VERSION__',h.digest('hex').slice(0,16)).replace('__ASSETS__',JSON.stringify(assets));};
 validateWorker(make(['a','b']),template,['a','b'],files);validateWorker(make(['b','a']),template,['a','b'],files);
 assert.throws(()=>validateWorker(make(['a','b'])+'malicious',template,['a','b'],files));
 assert.throws(()=>validateWorker(make(['a','b']).replace('"b"','"other"'),template,['a','b'],files));
});
test('site verification rejects changed, additional, missing and symlinked artifacts',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pages-site-'));
 const template='const CACHE = `${PREFIX}__VERSION__`;\nconst ASSETS = __ASSETS__.map((name) => name);\n';const content=Buffer.from('public');const version=createHash('sha256').update(template).update('index.html').update(content).digest('hex').slice(0,16);const sw=template.replace('__VERSION__',version).replace('__ASSETS__','["index.html"]');
 const expected={'index.html':{bytes:content.length,sha256:sha(content)},'sw.js':{bytes:Buffer.byteLength(sw),sha256:sha(sw)}};
 try{
  await writeFile(join(dir,'index.html'),content);await writeFile(join(dir,'sw.js'),sw);const options={template,assets:['index.html']};const first=await verifySite(dir,expected,options);assert.equal(first.workerOrderingDiffers,false);
  await writeFile(join(dir,'index.html'),'other');await assert.rejects(verifySite(dir,expected,options));await writeFile(join(dir,'index.html'),content);
  await writeFile(join(dir,'extra'),'no');await assert.rejects(verifySite(dir,expected,options));await rm(join(dir,'extra'));
  await rm(join(dir,'index.html'));await assert.rejects(verifySite(dir,expected,options));await symlink(join(dir,'sw.js'),join(dir,'index.html'));await assert.rejects(verifySite(dir,expected,options));
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('late baseline drift prevents the final write callback',async()=>{
 let writes=0;await assert.rejects(guardedWrite(async()=>({name:'other'}),target.initialProductionId,()=>{writes++;}));assert.equal(writes,0);
 const project={name:target.project,production_branch:'main',domains:['repformed.com','repformed.pages.dev'],canonical_deployment:{id:target.initialProductionId,latest_stage:{status:'success'}}};
 await guardedWrite(async()=>project,target.initialProductionId,()=>{writes++;});assert.equal(writes,1);
});
