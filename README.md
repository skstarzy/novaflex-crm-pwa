# NovaFlex CRM — installable app (PWA)

This is the CRM ported off Claude's artifact storage and onto the real
backend (`novaflex-backend-v2`), packaged as a Progressive Web App —
which is what makes "Install" show up on desktop and "Add to Home
Screen" show up on mobile, from a single codebase.

## What's here

```
crm-pwa/
  index.html          Entry point — loads React, Tailwind, and the app
  app.js              The CRM itself (login screen + dashboard/inventory/orders/customers)
  icons.js            Small dependency-free icon set (no build step, so no npm icon package)
  manifest.json       PWA metadata — name, icons, colors, display mode
  service-worker.js   Caches the app shell for instant reopening; never caches API data
  icons/              App icons at the sizes iOS/Android/desktop expect
```

No build step, on purpose: React, ReactDOM, and Babel Standalone load
from a CDN, and Babel compiles the JSX in `app.js`/`icons.js` right in
the browser. That's the right tradeoff for an internal tool a handful of
people use — if this ever needs to serve real public traffic at scale,
a proper build (Vite, Next.js) would load faster, but that's not the
bottleneck here.

## Three things that must be true for "Install" to appear

1. **Served over HTTPS** (or `localhost` for local testing). Every
   option below handles this automatically.
2. **A valid `manifest.json`** linked from the page — already done.
3. **A registered service worker** — already done, registers itself on
   page load.

Miss any of these three and the browser silently won't offer the
install prompt — there's no error message, it just won't show up.

## Deploy it

Any static host works since there's no build step. Simplest options,
roughly in order of "least setup":

- **Vercel** — `vercel deploy` from this folder, or drag-and-drop the
  folder into vercel.com. Free tier is plenty for this.
- **Netlify** — same idea; drag-and-drop deploy at app.netlify.com/drop.
- **GitHub Pages** — push this folder to a repo, enable Pages in repo
  settings, point it at the branch.
- **Render** — "Static Site" service pointed at this folder.

## Before you deploy: point it at your real backend

Open `index.html` and change this one line:

```js
window.NOVAFLEX_API_URL = "http://localhost:4000"; // <-- replace with your deployed backend URL
```

to your actual deployed backend's URL (e.g.
`https://api.novaflexpeptides.com`).

Then, in the **backend's** `.env`, set `CRM_URL` to wherever *this* app
ends up living (e.g. `https://crm.novaflexpeptides.com`) — the backend's
CORS config only allows specifically listed origins to use
cookie-based auth, so both sides need to know about each other.

## Installing it once deployed

- **iPhone/iPad (Safari):** open the site → Share button → "Add to Home
  Screen." Opens full-screen, no browser chrome, just like a real app.
- **Android (Chrome):** open the site → Chrome shows an "Install app"
  banner automatically, or use the ⋮ menu → "Install app."
- **Desktop (Chrome/Edge):** a small install icon (⊕ or a monitor icon)
  appears in the address bar. Click it → installs as its own window,
  shows up in your Start Menu / Applications folder / Dock like any
  other app.

## Logging in

Same account system as the backend — log in with whatever you created
via `npm run create-admin`, or an account created afterward through the
app itself (there's no separate signup here; accounts are managed
through the backend, see that project's README).

## What's different from the old artifact version

- Data lives in your real Postgres database, not Claude's storage — so
  it's the same data whether you're looking at this app, and eventually
  whether the storefront's checkout writes into it too.
- Requires logging in (the artifact version had no auth at all).
- Orders now show a status (`pending` / `paid` / `cancelled`) — an order
  placed through this CRM directly (phone/cash sale) is created as
  `paid` immediately; one coming through the actual storefront checkout
  starts as `pending` until the payment processor's webhook confirms it.

## Known limitations (same honesty as the backend README)

- No password reset flow yet.
- No owner-vs-staff permission distinction yet — every logged-in account
  can do everything.
- No push notifications for low-stock alerts (they show in the
  Dashboard, but nothing pings your phone yet — a real "app" feature
  worth adding later if this becomes your daily driver).
