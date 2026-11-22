# Can a Vite PWA on GitHub Pages have a Content Security Policy?

Research for the ticket *Can a Vite PWA on GitHub Pages have a Content Security Policy?* (map: *Make Grouper's code easier to find your way around and maintain*). Throwaway branch `research/csp`; never merged.

## Short answer

**Yes.** Grouper can ship a useful, enforced CSP as a `<meta http-equiv="Content-Security-Policy">` tag, injected into `dist/index.html` at build time only. Nothing in today's build needs a hash, a nonce or `'unsafe-inline'`:

- the inline JSON-LD is a *data block*, which CSP never checks;
- the PWA register script is already an external file (`/registerSW.js`), covered by `'self'`.

Recommended policy (tested: the full app ran in headless Chromium 157 under it with zero violations; see [Verification](#verification)):

```
default-src 'self';
script-src 'self';
style-src 'self';
img-src 'self';
connect-src 'self';
manifest-src 'self';
worker-src 'self';
object-src 'none';
base-uri 'none';
form-action 'none'
```

The main limits: a meta policy can't do `frame-ancestors` (clickjacking), `sandbox` or reporting, and it can't cover the service worker. Also, **don't add `require-trusted-types-for 'script'` as it stands**: it blocks `navigator.serviceWorker.register('/sw.js')`, so the app silently stops working offline.

## Grouper's facts (from this repo)

- **Hosting:** GitHub Pages at the custom domain `grouper.pladypus.dev`, served from `/` (`vite.config.ts`, `base: "/"`). Pages is a static host ([GitHub Docs: About GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages)). Its docs describe no way to set response headers, so a `<meta>` tag is the only way to deliver a CSP. The whole origin serves only this repo's `dist/`: no user uploads and no JSONP endpoints. That matters for `'self'` (see Trade-offs).
- **`index.html` (source):** inline `<script type="application/ld+json">` (added by the ticket that made the site readable to crawlers), and one module entry `<script type="module" src="/src/main.tsx">`. There are no inline event handlers and no inline `<style>`.
- **`dist/index.html` after `npm run build`** (vite 8.3, vite-plugin-pwa 2.0.0, `generateSW`). Before `</head>`, Vite and the plugin append:
  ```html
  <script type="module" crossorigin src="/assets/index-<hash>.js"></script>
  <link rel="stylesheet" crossorigin href="/assets/index-<hash>.css">
  <link rel="manifest" href="/manifest.webmanifest"><script id="vite-plugin-pwa:register-sw" src="/registerSW.js"></script>
  ```
  `dist/registerSW.js` is:
  ```js
  if('serviceWorker' in navigator) {window.addEventListener('load', () => {navigator.serviceWorker.register('/sw.js', { scope: '/' })})}
  ```
  `dist/sw.js` loads `/workbox-<hash>.js` with `importScripts`.
- **`injectRegister`:** not set in `vite.config.ts`, so it is `'auto'`. `'auto'` becomes `'script'` when the app imports none of the plugin's virtual modules, which Grouper doesn't (`node_modules/vite-plugin-pwa/dist/index.js`: `options.injectRegister = useImportRegister ? false : "script"`). That gives the external `/registerSW.js` above, not an inline script.
- **Runtime behaviour that touches CSP:**
  - React `style={...}` props (`GroupCard.tsx`: `--hue`, `width`, `height`, `fontSize`). React applies these through the CSSOM, not by parsing a `style` attribute, and they were not blocked under `style-src 'self'` (verified).
  - `canvas.toBlob` plus `URL.createObjectURL` for the picture download (`src/picture.ts`, `src/download.ts`). A download link to a `blob:` URL is a navigation, not an image load.
  - `<img src="/icon.svg">` in the About dialog.
  - Fonts are system fonts; Tailwind is compiled into one external CSS file.
  - No `eval` or `new Function`, no `innerHTML` or `dangerouslySetInnerHTML`, no third-party origins. The only external URLs in the bundle are links: GitHub and react.dev error links.

## What a meta CSP can and can't enforce

**Can:** every fetch directive (`default-src`, `script-src`, `style-src`, `img-src`, `connect-src`, `manifest-src`, `worker-src`, `object-src`, …), plus `base-uri`, `form-action`, `upgrade-insecure-requests` and Trusted Types directives.

- [CSP3 §3.3](https://w3c.github.io/webappsec-csp/#meta-element) defines meta delivery for any policy.
- The Trusted Types guide states plainly that a meta policy works for it ([Chrome Modern Web Guidance: Trusted Types](https://developer.chrome.com/docs/modern-web-guidance/guides/security/trusted-types)).

**Can't:**

- **`frame-ancestors`, `sandbox`, `report-uri`:** ignored in meta. CSP3 §3.3: "The Content-Security-Policy-Report-Only header is not supported inside a meta element. Neither are the report-uri, frame-ancestors, and sandbox directives." Also §6.4.2: "The frame-ancestors directive MUST be ignored when contained in a policy declared via a meta element", and §6.3.2 says the same for `sandbox`.
  - So there is no clickjacking protection. The guidance's `frame-ancestors 'none'` plus `X-Frame-Options: DENY` ([Chrome MWG: Web Security](https://developer.chrome.com/docs/modern-web-guidance/guides/security/security)) both need headers, which Pages can't send.
- **Report-only mode:** "CSP meta tags don't support report-only mode" ([web.dev: Strict CSP](https://web.dev/articles/strict-csp)). The guidance's rollout step ("Use Report-Only headers to dry-run policies… typically days to weeks", Chrome MWG: Web Security) isn't available.
  - Reporting doesn't work either. `report-uri` is ignored, and `report-to` needs a `Reporting-Endpoints` *header*.
  - The only signal left is the in-page `securitypolicyviolation` event.
- **Content before the tag:** "policies in meta elements are not applied to content which precedes them… resources fetched or prefetched using link and script elements which precede a meta-delivered policy will not be blocked" (CSP3 §3.3).
  - So the tag must be the **first thing in `<head>`**, right after `<meta charset>`. The Trusted Types guide gives the same rule: it must be the first child of `<head>`.
- **Workers:** a document's meta tag can't reach a service worker's own global scope (next section).
- MDN warns that apart from CSP, other security headers set via `http-equiv` give "a false sense of security" ([MDN: meta http-equiv](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/http-equiv)). Only CSP is meaningful there.

The guidance prefers headers: "We recommend setting your CSP using an HTTP header server-side because it's more secure than a `<meta>` tag" (web.dev: Strict CSP). On GitHub Pages that isn't an option. A meta CSP still enforces the part that matters most for XSS: where scripts may come from.

## The inline JSON-LD and the PWA register script

**JSON-LD needs nothing.** In HTML's *prepare the script element*, a `type` that is not a JavaScript MIME type (nor `module`, `importmap`, `speculationrules`) makes the element a **data block**. The algorithm returns at that step ("Otherwise, return. (No script is executed…)"), before it ever reaches the step that runs CSP's "Should element's inline behavior be blocked by Content Security Policy?" ([HTML Standard: scripting](https://html.spec.whatwg.org/multipage/scripting.html#prepare-the-script-element)).

So `<script type="application/ld+json">` is neither checked nor blocked. No hash is needed, and it can stay inline for crawlers. This was confirmed in testing: it was still present and produced no violation.

**Register script: keep it external.** The `injectRegister` options ([vite-plugin-pwa: Register Service Worker](https://vite-pwa-org.netlify.app/guide/register-service-worker.html)):

| Option | What lands in `index.html` | CSP cost |
| --- | --- | --- |
| `'auto'` (default; today `'script'`) | `<script src="/registerSW.js">` | none: `script-src 'self'` |
| `'script'` / `'script-defer'` | the same, optionally `defer` | none |
| `'inline'` | an inline `<script>` that registers `/sw.js` | needs a `sha256-` hash in `script-src`, recomputed whenever the plugin changes that snippet |
| `null` / `false` | nothing: register yourself or import `virtual:pwa-register` | none: registration goes inside the main bundle |

Recommendation: **pin `injectRegister: 'script'`** (or `'script-defer'`), so a future change in the plugin or an import of a virtual module can't silently switch to `'inline'` and break the policy. A `null` setting with `virtual:pwa-register` imported in `main.tsx` also works and saves one request, but it is a code change with no CSP benefit.

## The service worker and CSP

- **The page's policy governs registering it.** The `register('/sw.js')` fetch and the worker script are checked against `worker-src`. Its fallback chain is `worker-src` → `child-src` → `script-src` → `default-src` (CSP3 §6.8.3, "Get fetch directive fallback list"). `worker-src 'self'` covers `/sw.js`; it is set explicitly so it doesn't depend on that fallback.
- **The worker's own policy comes only from its response headers.** "If serviceWorker's script resource was delivered with a Content-Security-Policy HTTP header containing the value policy, the user agent must enforce policy for serviceWorker" ([Service Workers §6.2](https://w3c.github.io/ServiceWorker/#content-security-policy)).
  - The worker's policy container is created "from a fetch response given response" (Update algorithm). It is not inherited from the page.
  - GitHub Pages sends no CSP header, so **`sw.js` and its `importScripts('/workbox-….js')` run with no CSP**. That's acceptable: it is first-party code from the same build, with no string-to-code paths. No meta tag can change it.
- **Offline copies keep the policy.** The service worker precaches `index.html` with the meta tag inside it, so an offline launch gets the same policy as an online one. Requests the service worker answers from its cache are still checked against the page's policy before they reach it. Under the recommended policy every precached asset is same-origin.
- **Trusted Types and service workers clash.** `register()` passes its URL through "Get Trusted Type compliant string" (Service Workers, `register(scriptURL, options)`). With `require-trusted-types-for 'script'`, the plain string in `registerSW.js` is rejected.
  - Seen in testing: `TypeError: Failed to execute 'register' on 'ServiceWorkerContainer': This document requires 'TrustedScriptURL' assignment.`, and no service worker was installed.
  - Trusted Types would need a policy that mints a `TrustedScriptURL` for `/sw.js`, which means registering the service worker yourself (`injectRegister: null`).

## What the guidance recommends as a starting policy

- **Chrome Modern Web Guidance (Web Security):** `script-src 'nonce-{RANDOM}' 'strict-dynamic' 'report-sample'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; require-trusted-types-for 'script'; report-to …`.
  - "For static/cached HTML (SPAs) where a per-response nonce is not possible, use hash-based CSP."
  - Roll it out in report-only mode first.
- **web.dev Strict CSP:** a nonce- or hash-based `script-src` with `'strict-dynamic'`, plus `object-src 'none'` and `base-uri 'none'`. "Use a hash-based CSP for HTML pages served statically", with React single-page apps given as an example.
- **Vite:** don't allow `data:` in `script-src`. Vite inlines small imported assets as `data:` URIs, so either allow `data:` for `img-src`/`font-src` or set `build.assetsInlineLimit: 0` ([Vite: Features → CSP](https://vite.dev/guide/features#content-security-policy-csp)).
  - Grouper's build has no `data:` assets today. If one shows up later, the policy will block it and the fix is one of those two.

### Why Grouper's policy uses `'self'` rather than hashes plus `'strict-dynamic'`

The strict-CSP guidance targets the bypasses of URL **allowlists**, such as JSONP endpoints, open redirects and user-uploaded files on an allowed host. Grouper's allowlist is a single origin that serves only its own build output. On that origin, `script-src 'self'` gives in practice the same protection as a hash policy.

A hash policy would cost a lot for that small gain:

- With `'strict-dynamic'`, `'self'` is ignored ("If this keyword is present… `'self'`… ignored", [MDN: CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy)).
- So every external script would need a hash in the policy *and* an `integrity` attribute (CSP3: hash sources "may now match external scripts if the script element… specifies… integrity metadata"), or an inline hashed loader. These hashes change on every build, and the policy would have to be generated at build time.

Lighthouse's CSP audit may still flag a policy with only a host allowlist. That's acceptable here, and the CI Lighthouse run only asserts SEO anyway (`lighthouserc.json`).

## The recommended policy for Grouper

The policy is the one in [Short answer](#short-answer). This is what each directive does:

| Directive | Why |
| --- | --- |
| `default-src 'self'` | Catch-all, so a new kind of fetch (font, media, frame) stays first-party unless opened up on purpose. |
| `script-src 'self'` | The bundle, `registerSW.js`. No inline script, `eval` or `data:` scripts. JSON-LD is unaffected (data block). |
| `style-src 'self'` | The one Tailwind CSS file. React `style` props go through the CSSOM and are not blocked (verified). |
| `img-src 'self'` | `/icon.svg`, manifest icons. Add `blob:` only if the app ever *displays* a `blob:` image, such as a picture preview. Add `data:` only if Vite starts inlining assets. |
| `connect-src 'self'` | The app makes no network calls. This stops any injected code from sending data elsewhere. |
| `manifest-src 'self'`, `worker-src 'self'` | Explicit, though both fall back to `default-src` or `script-src` anyway. |
| `object-src 'none'`, `base-uri 'none'` | Part of the strict-CSP baseline in both guides. |
| `form-action 'none'` | Grouper's forms never submit over the network; they are React `onSubmit` handlers. |
| *(left out)* `frame-ancestors`, `sandbox`, `report-uri`/`report-to` | Ignored in meta. |
| *(left out)* `require-trusted-types-for 'script'` | Breaks service-worker registration (above). It is also Baseline **newly** available (since February 2026, [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/require-trusted-types-for)), below the map's **widely available** bar. |
| *(left out)* `upgrade-insecure-requests` | Pages already forces HTTPS and every URL is relative. It does no harm, but adds nothing. |

### How to ship it (for a later build ticket, not done here)

- **Inject at build time only.** Write a small Vite plugin with `apply: 'build'` and `transformIndexHtml`, or a `%VITE_…%`-style placeholder, that puts the meta as the first child of `<head>`.
  - Don't put it in the source `index.html`: the Vite dev server injects CSS as `<style>` elements (`vite/dist/client/client.mjs`, `document.createElement("style")`), which `style-src 'self'` would block in `npm run dev`.
- **Pin `injectRegister: 'script'`** in `vite.config.ts`.
- **Add a test** that the built `dist/index.html` has the meta tag as the first child of `<head>`, after `<meta charset>`, and has no inline executable `<script>`. Something like the [Verification](#verification) run below would catch a runtime regression.

### Trade-offs

- **Gains:** it blocks injected inline or third-party scripts, `eval`, plugins, `<base>` hijacking, form exfiltration and outbound `fetch`/beacon to other origins. For an app whose promise is "no student data sent to a server", the `connect-src 'self'` and `default-src 'self'` lines enforce that promise in the browser.
- **Costs:**
  - No reporting, so a violation in the field is silent: it only shows up as a broken feature.
  - No clickjacking defence.
  - The service worker has no policy of its own.
  - Every future feature that loads something new (web fonts, an analytics script, a `data:` asset, a `blob:` preview) must update the policy.
- **Rejected options:**
  - Hash-based `'strict-dynamic'`: build-time hashing for no real gain on a single-purpose origin.
  - Moving hosting to something that sets headers (Cloudflare Pages/Netlify `_headers`) to get `frame-ancestors` and report-only mode: out of scope for this map.

## Verification

Run against this repo at `origin/main` (8ef8c10), 2026-11-22:

1. Ran `npm run build`, copied `dist/` to a scratch directory, inserted the policy as the first `<head>` child after `<meta charset>`, and served it with `vite preview` (which sends no CSP header).
2. Opened the copy in headless Chromium 157 over the DevTools protocol. A `securitypolicyviolation` listener was installed before load, and a script then:
   - created a Roster with eight names;
   - clicked through the board twice: Present, Pairs, ±, Edit, Share, Theme, Shuffle, Reshuffle, Lock, each name, Good pair / Keep apart, Rename, Export, Export all Rosters, Import, About Grouper, Save/Done;
   - built a canvas `blob:` URL the way the picture export does.
3. **Result:** the app mounted, the service worker reached `activated`, JSON-LD was still present, and there were **0 violations and no console errors**, both with `img-src 'self' blob:` and with `img-src 'self'`.
4. **Same run with `require-trusted-types-for 'script'; trusted-types 'none'` added:** the service-worker registration was blocked (`TrustedScriptURL`), no service worker was installed, and two violations were recorded.

Not exercised: the real Web Share sheet, the print dialog and file pickers, which need a user gesture. Check them by hand once in a real browser after shipping. None of them loads anything cross-origin, so no violation is expected.

## Sources

- W3C, *Content Security Policy Level 3* (Editor's Draft): https://w3c.github.io/webappsec-csp/ (§3.3 meta element; §6.3.2 sandbox; §6.4.2 frame-ancestors; §6.8.3 fallback lists)
- WHATWG, *HTML Standard*, prepare the script element and data blocks: https://html.spec.whatwg.org/multipage/scripting.html
- W3C, *Service Workers* (Editor's Draft) §6.2 Content Security Policy and the Update / Setup ServiceWorkerGlobalScope algorithms: https://w3c.github.io/ServiceWorker/
- MDN, *Content-Security-Policy*: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy
- MDN, *require-trusted-types-for*: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/require-trusted-types-for
- MDN, *meta http-equiv*: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/http-equiv
- Chrome Modern Web Guidance, *Web Security*: https://developer.chrome.com/docs/modern-web-guidance/guides/security/security
- Chrome Modern Web Guidance, *Prevent DOM-based XSS attacks with Trusted Types*: https://developer.chrome.com/docs/modern-web-guidance/guides/security/trusted-types
- web.dev, *Mitigate cross-site scripting (XSS) with a strict Content Security Policy*: https://web.dev/articles/strict-csp
- Vite, *Features → Content Security Policy*: https://vite.dev/guide/features#content-security-policy-csp
- vite-plugin-pwa, *Register Service Worker*: https://vite-pwa-org.netlify.app/guide/register-service-worker.html; and `node_modules/vite-plugin-pwa/dist/index.js` (v2.0.0) for `'auto'` → `'script'`
- GitHub Docs, *About GitHub Pages*: https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages
