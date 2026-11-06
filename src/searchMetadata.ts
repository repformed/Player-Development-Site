/** Search hints only. Authentication and data authorization remain server enforced. */
export function publicSearchRoute(url: URL): boolean {
  return url.pathname === "/" && !url.search &&
    ["", "#home", "#membership", "#staff", "#contact"].includes(url.hash);
}
export function installSearchMetadata() {
  const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
  // Never relax an independently configured private-preview exclusion.
  if (!robots || /noindex/i.test(robots.content)) return;
  const update = () => {
    robots.content = publicSearchRoute(new URL(location.href))
      ? "index,follow" : "noindex,nofollow";
  };
  update();
  window.addEventListener("hashchange", update);
  window.addEventListener("popstate", update);
}
