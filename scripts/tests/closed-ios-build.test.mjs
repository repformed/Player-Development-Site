import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { assertClosedConfig,closedConfig } from "../build-ios-closed.mjs";
test("accepts only the verified Android-equivalent disabled configuration",()=>{
  assert.doesNotThrow(()=>assertClosedConfig(JSON.parse(JSON.stringify(closedConfig))));
});
for(const [name,value] of Object.entries({ endpoint:{ ...closedConfig,url:"https://fixture.invalid" },key:{ ...closedConfig,publishableKey:"fictional" },enabled:{ ...closedConfig,enabled:true },signup:{ ...closedConfig,membersSignupEnabled:true },payment:{ ...closedConfig,paymentsEnabled:true },minor:{ ...closedConfig,under18_enabled:true },missing:{ enabled:false },null:null })) {
  test(`rejects ${name}`,()=>assert.throws(()=>assertClosedConfig(value),/closed_ios_config_unconfirmed/));
}
test("workflow keeps normal default and existing unsigned identity/permissions",()=>{
  const workflow=readFileSync(new URL("../../.github/workflows/ios-build.yml",import.meta.url),"utf8");
  assert.match(workflow,/closed_gate:[\s\S]*?default: false/);
  assert.match(workflow,/contents: read/);assert.match(workflow,/CODE_SIGNING_ALLOWED=NO/);
  assert.match(workflow,/if \[ "\$PD_IOS_CLOSED_GATE" = "true" \]/);
  assert.match(workflow,/else\s+npm run build:ios/);
});
