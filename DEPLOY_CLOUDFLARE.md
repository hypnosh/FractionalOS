# Deploying to Cloudflare (Workers + Pages)

This project is a **TanStack Start SSR app**. The Vite build already targets
Cloudflare via nitro's `cloudflare` preset (configured in
`@lovable.dev/vite-tanstack-config`), and `src/server.ts` is a Cloudflare
`fetch` handler. SSR stays on — nothing about the app is converted to a
static SPA.

Two supported deployment shapes are described below. **Workers with static
assets** is recommended; Pages is included for teams that already run on it.

---

## Prerequisites

```bash
# Install the Cloudflare CLI (once)
bun add -d wrangler

# Log in to your Cloudflare account
bunx wrangler login
```

You will also need your Supabase env vars (already in `.env` for local dev):

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`  (inlined at build time)
- `VITE_SUPABASE_PUBLISHABLE_KEY`  (inlined at build time)
- `VITE_SUPABASE_PROJECT_ID`  (inlined at build time)
- `SUPABASE_SERVICE_ROLE_KEY`  (only if any server function uses it)
- `LOVABLE_API_KEY`  (only if you call the Lovable AI Gateway server-side)

---

## Option A — Cloudflare Workers with Static Assets (recommended)

Uses the `wrangler.toml` at the repo root.

### 1. Build

```bash
bun run build
```

Produces:

```
.output/
├── server/index.mjs   # SSR Worker entry (src/server.ts)
└── public/            # hashed client bundle + prerendered HTML
```

### 2. Set server secrets (once per environment)

`VITE_*` values are inlined at build time and do **not** need to be set in
Cloudflare. Only server-only secrets do:

```bash
bunx wrangler secret put SUPABASE_URL
bunx wrangler secret put SUPABASE_PUBLISHABLE_KEY
# Optional — only if the app uses them
bunx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
bunx wrangler secret put LOVABLE_API_KEY
```

### 3. Deploy

```bash
bunx wrangler deploy
```

Your app is live at `https://nexus-cxo.<your-subdomain>.workers.dev`
(rename `name` in `wrangler.toml` to change it, or attach a custom domain
in the Cloudflare dashboard: **Workers & Pages → your worker → Settings →
Domains & Routes**).

### Local Preview against the Worker runtime

```bash
bun run build && bunx wrangler dev
```

This runs the built Worker in `workerd` — the same runtime as production —
so you catch Node-incompat issues before deploy.

---

## Option B — Cloudflare Pages

Pages can serve the same build via its Workers-under-the-hood runtime.

### Dashboard setup

1. Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
2. Pick this repo.
3. Framework preset: **None**.
4. Build command: `bun run build`
5. Build output directory: `.output/public`
6. Root directory: (leave blank)
7. Add environment variables under **Settings → Environment variables**:
   - `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (Production + Preview)
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
     `VITE_SUPABASE_PROJECT_ID` (Production + Preview)
   - Any others you use (`SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`)
8. Add `compatibility flag`: `nodejs_compat` under **Settings → Functions →
   Compatibility flags** (both Production and Preview).

Pages will pick up `.output/server/index.mjs` automatically because the
nitro Cloudflare preset also emits a `_worker.js` in `.output/public` when
targeting Pages. If you want to force the Pages layout, run:

```bash
NITRO_PRESET=cloudflare_pages bun run build
```

and deploy `.output/public` with:

```bash
bunx wrangler pages deploy .output/public --project-name nexus-cxo
```

---

## Supabase configuration (REQUIRED after first deploy)

Once you know your production URL (e.g. `https://nexus-cxo.example.workers.dev`
or your custom domain), add it to Supabase Auth so email links and OAuth
callbacks work.

In the Supabase dashboard for project **`ovcguqlptegivvbqjpsm`**:

**Authentication → URL Configuration**

- **Site URL:** `https://<your-production-domain>`
- **Redirect URLs (allow-list):** add every origin the app can be reached
  from — email confirmation links and OAuth callbacks are rejected unless
  they match one of these entries:
  ```
  https://<your-production-domain>
  https://<your-production-domain>/**
  https://<your-preview-domain>.pages.dev
  https://<your-preview-domain>.pages.dev/**
  http://localhost:8080
  http://localhost:8080/**
  ```
  Include preview/branch URLs if you use Pages preview deployments.

**Authentication → Providers → Google** (if Google sign-in is enabled)

- Ensure the Cloudflare production origin is present in the Google Cloud
  Console OAuth client's **Authorized JavaScript origins** and
  **Authorized redirect URIs**
  (`https://ovcguqlptegivvbqjpsm.supabase.co/auth/v1/callback` remains the
  Google-side redirect URI — that does not change).

After updating, sign out and sign back in on the deployed site to pick up
the new session cookie scope.

---

## Notes and gotchas

- **`nodejs_compat` is required.** The Worker uses Node built-ins
  (`crypto`, `Buffer`, streams). The flag is set in `wrangler.toml`; on
  Pages, set it in the dashboard.
- **No `SUPABASE_SERVICE_ROLE_KEY` on the client.** Only add it as a
  Wrangler secret / Pages environment variable if a server function
  actually imports `@/integrations/supabase/client.server`.
- **Do not add `ssr.external` in `vite.config.ts`.** The Worker has no
  runtime module resolution; all deps must be bundled.
- **Preview URL vs production URL.** Cloudflare Pages issues a unique
  preview URL per commit. Add a wildcard (`https://*.pages.dev`) to the
  Supabase redirect allow-list only if you actually want previews to
  authenticate; otherwise auth will fail there by design.
