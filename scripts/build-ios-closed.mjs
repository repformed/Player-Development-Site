/** Explicit unsigned-validation build only. Normal website/iOS commands are unchanged. */
import { execFileSync } from "node:child_process";
import { readFileSync,writeFileSync,mkdirSync,readdirSync } from "node:fs";
import { join,relative } from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import process from "node:process";
export const closedConfig=Object.freeze({ enabled:false,url:"",publishableKey:"" });
export function assertClosedConfig(value) {
  if(!value||typeof value!=="object"||Array.isArray(value)||
    Object.keys(value).sort().join(",")!=="enabled,publishableKey,url"||
    value.enabled!==false||value.url!==""||value.publishableKey!=="")
    throw Error("closed_ios_config_unconfirmed");
}
const hash=b=>createHash("sha256").update(b).digest("hex");
function files(root) {
  return readdirSync(root,{ withFileTypes:true }).flatMap(e=>e.isDirectory()?files(join(root,e.name)):[join(root,e.name)]);
}
export function buildClosedIos() {
  const sourceConfig=readFileSync("public/content-config.json");
  const tracked=execFileSync("git",["ls-files","-z","ios","capacitor.config.ts"],{ encoding:"utf8" }).split("\0").filter(Boolean);
  const protectedHashes=new Map(tracked.map(p=>[p,hash(readFileSync(p))]));
  execFileSync("npm",["run","build"],{ stdio:"inherit" });
  writeFileSync("dist/content-config.json",JSON.stringify(closedConfig));
  assertClosedConfig(JSON.parse(readFileSync("dist/content-config.json","utf8")));
  // Existing native dependencies are unchanged. Copy reviewed web inputs only;
  // do not regenerate Swift package paths or modify native project settings.
  execFileSync("./node_modules/.bin/cap",["copy","ios"],{ stdio:"inherit" });
  assertClosedConfig(JSON.parse(readFileSync("ios/App/App/public/content-config.json","utf8")));
  const native=JSON.parse(readFileSync("ios/App/App/capacitor.config.json","utf8"));
  if(native.appId!=="com.coachbilliott.playerdevelopment"||native.server?.url||native.server?.cleartext)
    throw Error("closed_ios_identity_or_remote_server_unconfirmed");
  if(!sourceConfig.equals(readFileSync("public/content-config.json"))) throw Error("public_config_changed");
  for(const [p,digest] of protectedHashes) if(hash(readFileSync(p))!==digest) throw Error("protected_ios_source_changed");
  mkdirSync("mobile-builds",{ recursive:true });
  const receipt={ source:execFileSync("git",["rev-parse","HEAD"],{ encoding:"utf8" }).trim(),
    sourceInputs:Object.fromEntries(execFileSync("git",["ls-files","-c","-o","--exclude-standard","-z"],{ encoding:"utf8" }).split("\0").filter(p=>p&&p!=="node_modules").map(p=>[p,hash(readFileSync(p))])),
    workingDiff:execFileSync("git",["diff","--stat"],{ encoding:"utf8" }).trim(),
    mode:"closed-gate-validation-only",backendEnabled:false,signupEnabled:false,paymentsEnabled:false,minorsEnabled:false,
    configurationSha256:hash(readFileSync("ios/App/App/public/content-config.json")),
    webAssets:Object.fromEntries(files("ios/App/App/public").map(p=>[relative("ios/App/App/public",p),hash(readFileSync(p))])),
    bundleId:native.appId,protectedSourceFiles:protectedHashes.size,publicConfigUnchanged:true,
    iosCompiled:false,simulatorTested:false,signed:false,uploaded:false };
  writeFileSync("mobile-builds/closed-ios-input.json",JSON.stringify(receipt,null,2)+"\n");
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) buildClosedIos();
