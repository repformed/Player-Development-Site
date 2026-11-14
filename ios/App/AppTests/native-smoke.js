// Runs inside the actual iPhone WKWebView, with isolated fictional data only.
const store = window.Capacitor.Plugins.SecureStoragePlugin;
if (!store || !window.Capacitor.isNativePlatform()) throw new Error('Native bridge is unavailable');
if (!window.Capacitor.isPluginAvailable('TrainingVideo')) throw new Error('Native video preparation bridge is unavailable');
await window.Capacitor.Plugins.TrainingVideo.cancelPreparation();
await window.Capacitor.Plugins.TrainingVideo.releaseVideo({ id: 'fictional-missing-file' });
const image = document.querySelector('.app-start-photo img');
await image.decode();
await document.fonts.ready;
if (image.naturalWidth !== 1440) throw new Error('Bundled welcome photo did not load');
if (!document.fonts.check('700 16px "Barlow Condensed"')) throw new Error('Bundled display font did not load');
if (typeof crypto.randomUUID !== 'function') throw new Error('Native secure UUID support is unavailable');

let stored = false;
try {
  stored = (await store.set({ key, value: 'fictional-native-fixture' })).value;
  if (!stored) throw new Error('Keychain write failed');
  if ((await store.get({ key })).value !== 'fictional-native-fixture') throw new Error('Keychain read did not match');
} finally {
  if (stored) await store.remove({ key });
}

const tick = () => new Promise(resolve => setTimeout(resolve, 50));
const wait = async (find, name) => {
  for (let i = 0; i < 100; i++) {
    const found = find();
    if (found) return found;
    await tick();
  }
  throw new Error('Native training screen did not show ' + name);
};
const button = name => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === name && !b.disabled);
const click = async name => { (await wait(() => button(name), name)).click(); await tick(); };
const acknowledge = async () => {
  (await wait(() => document.querySelector('dialog[open] input[type=checkbox]:not(:disabled)'), 'practice acknowledgement')).click();
  await tick();
};
if (document.querySelector('a[href="#demo"]')) throw new Error('Customer demo leaked into the native app');
location.hash = 'demo';
await wait(() => location.hash === '#app', 'blocked native demo route');
location.hash = 'account';
const config = await fetch('/content-config.json').then(response => {
  if (!response.ok) throw new Error('Bundled account configuration is unavailable');
  return response.json();
});
if (config.enabled === false) {
  if (config.url !== '' || config.publishableKey !== '') throw new Error('Disabled backend retains configuration');
  await wait(() => [...document.querySelectorAll('h2')].some(heading => heading.textContent === 'Private profiles are being connected.'), 'closed native account entry');
  if (document.querySelector('input[type="email"], input[type="password"]')) throw new Error('Closed account entry exposes credential inputs');
  if (document.querySelector('.family-demo')) throw new Error('Fictional demo is visible in closed native entry');
  const help = await wait(() => document.querySelector('a[href="#app-help"]'), 'closed sign-in help');
  if (help.textContent.trim() !== 'Sign-in help') throw new Error('Closed account recovery label changed');
  help.click();
  await wait(() => [...document.querySelectorAll('h1')].some(heading => heading.textContent === 'Your app, explained.'), 'closed account help navigation');
} else {
  await wait(() => document.querySelector('input[type="email"]'), 'native account login');
}
if (document.querySelector('.family-demo')) throw new Error('Fictional demo is visible in native login');
location.hash = 'app';
return true;
