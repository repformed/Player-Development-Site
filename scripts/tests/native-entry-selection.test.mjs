import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { URL } from 'node:url';
import { chromium } from 'playwright';

// Exercise the actual WKWebView test block against a local DOM with both
// existing help destinations. No app, Auth or provider endpoint is contacted.
const source=readFileSync(new URL('../../ios/App/AppTests/native-smoke.js',import.meta.url),'utf8');
const start=source.indexOf("location.hash = 'account';");
const end=source.indexOf("location.hash = 'app';",start);
assert.ok(start>=0&&end>start);
const block=source.slice(start,end);

for(const scenario of ['both help links','credential field','missing panel link','incorrect panel label']) {
  test(`closed account entry: ${scenario}`,async()=>{
    const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
    try {
      const page=await browser.newPage();let attempts=0;
      await page.route('**/*',route=>{attempts++;return route.abort()});
      await page.setContent(`<header class="app-header"><a href="#app-help" class="app-help-shortcut" aria-label="App help"><svg></svg></a></header><main class="page member-page"><section class="panel member-panel"><h2>Private profiles are being connected.</h2>${scenario==='credential field'?'<input type="password">':''}${scenario==='missing panel link'?'':`<a class="button" href="#app-help">${scenario==='incorrect panel label'?'Unexpected help':'Sign-in help'} <svg></svg></a>`}</section></main>`);
      const result=await page.evaluate(async block=>{
        const document=globalThis.document;
        const originalLinks=[...document.querySelectorAll('a[href="#app-help"]')].map(a=>({label:a.getAttribute('aria-label'),text:a.textContent.trim()}));
        for(const link of document.querySelectorAll('a[href="#app-help"]'))link.addEventListener('click',()=>{document.querySelector('main').innerHTML='<h1>Your app, explained.</h1>'});
        const fetchLocal=async path=>{if(path!=='/content-config.json')throw Error('Unexpected configuration request');return {ok:true,json:async()=>({enabled:false,url:'',publishableKey:''})}};
        const wait=async(find,name)=>{const found=find();if(!found)throw Error(name);return found};
        const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
        try {await new AsyncFunction('fetch','wait',block)(fetchLocal,wait);return {originalLinks,passed:true}}
        catch(error){return {originalLinks,passed:false,message:error.message}}
      },block);
      if(scenario==='both help links') {
        assert.deepEqual(result.originalLinks,[{label:'App help',text:''},{label:null,text:'Sign-in help'}]);
        assert.equal(result.passed,true, result.message);
      } else {
        const expected={'credential field':'Closed account entry exposes credential inputs','missing panel link':'closed sign-in help','incorrect panel label':'Closed account recovery label changed'}[scenario];
        assert.equal(result.passed,false);assert.equal(result.message,expected);
      }
      assert.equal(attempts,0);
    } finally {await browser.close()}
  });
}
