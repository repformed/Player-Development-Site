import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { disableBackend } from "./backendFixture";
test.beforeEach(async ({ context }) => { await disableBackend(context); });
test("deletion review is available without JavaScript or login and prepares only a minimal email draft", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled:false });
  try {
    const page = await context.newPage(); await page.goto(`${baseURL}/account-help.html#request-deletion`);
    const section = page.locator("#request-deletion");
    await expect(section.getByRole("heading")).toHaveText("Cannot sign in? Request deletion help.");
    const href = await section.getByRole("link", { name:"Prepare account-deletion request email" }).getAttribute("href");
    expect(href).not.toContain("+");
    expect(href).toContain("subject=Account%20deletion%20review%20request");
    const draft = new URL(href!);
    expect(draft.protocol).toBe("mailto:");expect(draft.pathname).toBe("Repformed@gmail.com");
    expect([...draft.searchParams.keys()].sort()).toEqual(["body","subject"]);
    expect(draft.searchParams.get("subject")).toBe("Account deletion review request");
    expect(draft.searchParams.get("body")).not.toMatch(/password|access_token|child|athlete.*name/i);
    await expect(section).toContainText("submits nothing automatically");
    await expect(section).toContainText("not identity verification");
    await expect(section).toContainText("does not erase records, cancel payments");
    expect(await section.locator("input,form,button").count()).toBe(0);
    await expect(page.locator("#retention")).toContainText("current private adult pilot");
    await expect(page.getByRole("link", {name:"proposed future-service retention limits"})).toHaveAttribute("href", "./service-policies/#retention");
  } finally { await context.close(); }
});
test("request help is keyboard reachable, accessible on phones, and returns to account recovery", async ({ page }, info) => {
  await page.goto("./account-help.html");
  await page.getByRole("link", { name:"Request deletion help", exact:true }).click();
  await expect(page).toHaveURL(/\/account-help(?:\.html)?#request-deletion$/);
  const deletionHelpUrl = page.url();
  await page.setViewportSize({width:info.project.name==="phone"?320:1000,height:900});
  await page.addStyleTag({content:"body{font-size:125%}"});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect((await new AxeBuilder({page}).include("#request-deletion").withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).violations).toEqual([]);
  const draft=page.getByRole("link",{name:"Prepare account-deletion request email"});await draft.focus();await expect(draft).toBeFocused();
  await page.getByRole("link",{name:"Try account recovery"}).click();await expect(page).toHaveURL(/#account$/);
  await page.goBack();
  await expect(page).toHaveURL(deletionHelpUrl);
  await expect(page.locator("#request-deletion").getByRole("heading")).toHaveText("Cannot sign in? Request deletion help.");
});
