import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
const paths=["online-football-training","football-iq","offensive-line-fundamentals","parent-guide"];
const imagePath="/assets/repformed-social-profile.png";
const imageURL="https://repformed.com"+imagePath;
for(const path of paths) test(`static social metadata for ${path}`,async({browser,baseURL})=>{
  const context=await browser.newContext({javaScriptEnabled:false,serviceWorkers:"block"});
  try {
    await context.route("**/*",r=>new URL(r.request().url()).origin===new URL(baseURL!).origin&&r.request().method()==="GET"?r.continue():r.abort());
    const page=await context.newPage();await page.goto(`${baseURL}/${path}/`);
    const meta=(key:string)=>page.locator(`meta[property="${key}"],meta[name="${key}"]`);
    await expect(meta("og:image")).toHaveAttribute("content",imageURL);
    await expect(meta("og:image:type")).toHaveAttribute("content","image/png");
    await expect(meta("og:image:width")).toHaveAttribute("content","1024");
    await expect(meta("og:image:height")).toHaveAttribute("content","1024");
    await expect(meta("og:image:alt")).toHaveAttribute("content","Repformed logo");
    await expect(meta("twitter:card")).toHaveAttribute("content","summary");
    await expect(meta("twitter:image")).toHaveAttribute("content",imageURL);
    await expect(meta("twitter:image:alt")).toHaveAttribute("content","Repformed logo");
    await expect(meta("twitter:title")).toHaveAttribute("content",(await meta("og:title").getAttribute("content"))!);
    await expect(meta("twitter:description")).toHaveAttribute("content",(await meta("description").getAttribute("content"))!);
    await expect(meta("twitter:site")).toHaveCount(0);await expect(meta("twitter:creator")).toHaveCount(0);
    await expect(meta("robots")).toHaveAttribute("content","index,follow");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href",`https://repformed.com/${path}/`);
  } finally {await context.close();}
});
test("social image serves approved PNG bytes inline with actual square dimensions",async({request,baseURL})=>{
  const response=await request.get(baseURL!+imagePath);expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/png");
  expect(response.headers()["content-disposition"]??"").not.toMatch(/attachment/i);
  const bytes=await response.body();expect(bytes.byteLength).toBe(1607865);
  expect(bytes.subarray(0,8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(bytes.readUInt32BE(16)).toBe(1024);expect(bytes.readUInt32BE(20)).toBe(1024);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe("4caaa1e81952e8999a147d3856921598abc89189d9181e050dc5fc7cc3514e8b");
});
test("privacy remains explicitly excluded and sitemap destinations remain unchanged",async({request,baseURL})=>{
  const privacy=await(await request.get(baseURL!+"/interest-privacy.html")).text();
  expect(privacy).toMatch(/name="robots" content="noindex"/);
  const sitemap=await(await request.get(baseURL!+"/sitemap.xml")).text();
  expect([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(x=>x[1])).toEqual(["https://repformed.com/",...paths.map(p=>`https://repformed.com/${p}/`),"https://repformed.com/service-policies/"]);
});
