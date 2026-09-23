# AGENTS.md

Guidance for AI coding agents (and humans skimming for orientation) working in this repo. This project is largely in **maintenance mode** — it's meant to be easy to clone and lightly customize, with deeper customization possible for those who want it. Prefer the smallest, most localized change that accomplishes the task.

For the full human-oriented walkthrough (cloning flow, PingOne setup, vertical list, `bxi-davinci.js` data-attribute API, etc.) see `README.md` — it's comprehensive and this file intentionally does not duplicate it. Read `README.md` first if you need deep background; this file is a faster map for making changes.

## What this project is

BXIndustry is a Node.js (Fastify + Handlebars) app used by Ping Identity demo teams to showcase **DaVinci** orchestration flows (registration, login, MFA, password reset, profile/device management, etc.) inside a realistic-looking demo storefront. The app ships with 16 "industry vertical" skins (airlines, health, finance, retail, ...) that share the same server/templating engine but have independent content, branding, and imagery.

Two integration modes are supported for authenticating a user against DaVinci flows:
- **Widget mode** (default): flows are embedded via `davinci.js` and triggered from HTML data attributes.
- **OIDC redirect mode**: the app redirects to a PingOne OIDC application instead of embedding a widget (`BXI_USE_REDIRECT=true`).

## Tech stack & commands

- Node >= 20 (see `.nvmrc` for the officially tested version)
- Fastify (server), Handlebars (templates/partials), Sass (compiled to `public/styles.css`)
- `npm install`
- `npm run dev` — sass watch + nodemon w/ HTTPS (local dev cert in `resources/dev-cert`)
- `npm start` — one-shot sass compile + `node server.js` (used in production/Docker)
- **Important**: the server only reads `.env` and static files (images, etc.) at startup. Restart `npm start`/`npm run dev` after changing `.env` or adding new files in `public/`.
- Nodemon (`nodemonConfig` in `package.json`) intentionally does *not* watch `src/*`, `scss/*`, `settings/*` — Handlebars templates are recompiled per-request already, so editing `.hbs` files usually doesn't require a restart. New **partials** and new **verticals** do require a restart (see below).

## The three configuration levers (most prompt-driven changes touch these)

### 1. PingOne / DaVinci environment (`.env`)

`.env` (created by the user, gitignored-in-practice via the clone flow, though sample files exist in this repo for local dev) holds the connection to a PingOne environment and DaVinci application:

- `BXI_API_URL`, `BXI_DV_JS_URL`, `BXI_SDK_TOKEN_URL` — PingOne/DaVinci endpoints
- `BXI_API_KEY`, `BXI_COMPANY_ID` — DaVinci application credentials
- `BXI_*_POLICY_ID` (`LOGIN`, `REGISTRATION`, `PROFILE_MANAGEMENT`, `PASSWORD_RESET`, `DEVICE_MANAGEMENT`, `DASHBOARD`, `GENERIC`, `CLONE`) — DaVinci flow policy IDs wired up to specific buttons/pages. An empty value hides the corresponding button (see `src/home-nav-buttons.hbs`).
- `BXI_ACTIVE_VERTICAL` — which vertical the root `/` route redirects to (must be a valid vertical directory name, see below)
- `BXI_ENABLE_EDITING`, `BXI_DEBUG_LOGGING`, `BXI_HIDE_SHORTCUTS`, `BXI_SHOW_CLONE_BUTTON` — feature toggles

See the full annotated variable list in `README.md` under "Environment". `.env-widget`, `.env-oidc`, `.env-prod`, `.env-qa` in the repo root are **example/reference** env files for different setups (local widget dev, OIDC dev, and this org's own prod/qa deployments) — not something every clone needs.

Only variables explicitly whitelisted in `resources/helpers.js` (`getBxiEnvironmentVariables`) are exposed to templates (`{{env.VAR}}`) and the front-end (`window._env_`). **If you add a new `.env` variable that templates or client JS need to read, you must add it to that whitelist.**

### 2. OIDC application configuration (`.env-oidc`, redirect mode)

When `BXI_USE_REDIRECT=true`, login is handled by redirecting to a PingOne OIDC application instead of a DaVinci widget:

- `BXI_REDIRECT_ISSUER` — the OIDC issuer URL for the PingOne environment/application
- `BXI_REDIRECT_CLIENT_ID` — the OIDC client ID

This is powered by `@pingidentity-developers-experience/ping-oidc-client-sdk`, wired up in `public/js/oidc.js`. User info population after login can be customized in `public/register-functions.js` (`bxi.updatedUserInfo`). `.env-oidc` is a ready-to-use starting template for this mode.

### 3. Vertical selection & settings/assets

Valid verticals are simply the directory names under `src/pages/` (introspected at server startup by `helpers.getVerticals()`): `airlines`, `company`, `eats`, `education`, `finance`, `generic`, `government`, `health`, `hotels`, `insurance`, `manufacturing`, `pharmacy`, `realty`, `retail`, `sports`, `volunteer`.

- Set `BXI_ACTIVE_VERTICAL` in `.env` to pick the default vertical for `/`.
- Each vertical's **content/text/images** live in `src/pages/<vertical>/settings.json`.
- Each vertical's **CSS variables/branding** live in `src/pages/<vertical>/branding.hbs`.
- Applying "assets for a vertical" (from a BOM, a prompt, etc.) generally means: writing image files into `public/<vertical>/`, then referencing them by path in that vertical's `settings.json`, and/or updating color/font values in `branding.hbs` (or the `theme` block in `settings.json`, which is applied to those same CSS vars — see `src/pages/AGENTS.md` for details).
- `settings/<vertical>.json` (top-level `settings/` folder, distinct from `src/pages/<vertical>/settings.json`) holds the **factory-default** copy; `POST /<vertical>/settings/reset` copies it back over the live file. Don't edit `settings/<vertical>.json` unless you intend to change what "reset to default" means.

See `src/pages/AGENTS.md` for the full per-vertical file breakdown.

## Global (cross-vertical) customization points

- `src/home-nav-buttons.hbs` — auth buttons (Log In / Sign Up) shown in the nav on every vertical's home page. Wired to `BXI_LOGIN_POLICY_ID`/`BXI_REGISTRATION_POLICY_ID` by default via `data-policy-id`.
- `src/dashboard-buttons.hbs` — buttons shown at the top of every vertical's dashboard page (commented-out examples only, no defaults).
- `public/register-functions.js` — centralized place to register JS callbacks used by flow buttons (`data-success-callback`, `data-error-callback`, `data-parameter-factory`) and lifecycle hooks (`bxi.pageLoad`, `bxi.logout`, `bxi.updatedUserInfo`). See README's "bxi-davinci.js Documentation" section for the full data-attribute contract used to wire buttons/divs to DaVinci flows.
- `src/partials/*.hbs` — shared Handlebars partials, auto-registered by `resources/handlebars.js` on startup (kebab-case filename → camelCase partial name). Adding a partial requires a server restart.
- `src/partials/icons/*.hbs` — SVG icon partials (auto-registered with an `Icon` suffix); see `/docs` page for the icon-authoring convention (fill/stroke target classes for the `color-icon` SCSS mixin).
- `src/templates/*.hbs` — reusable HTML snippets meant to be pasted into DaVinci flow HTML nodes (not rendered directly by this app's routes, other than the `/​<vertical>/dialog-examples` preview page).

## Server internals (only touch if you know what you're doing)

- `server.js` — route definitions: vertical page routing (auto-derived from files in `src/pages/<vertical>/`), `/dvtoken` (server-side DaVinci SDK token exchange, keeps the API key off the client), `/shortcuts`, `/docs`, settings edit/reset endpoints, OIDC-related cookie endpoints.
- `resources/helpers.js` — vertical discovery, settings file loading (+ `{{currentYear}}`/`{{lastYear}}` templated replacement), env var whitelisting, endpoint/link map generation.
- `resources/handlebars.js` — registers Handlebars helpers (`eq`, `gt`, `and`, `times`, `length`, `inlineSvg`, `lookupPath`) and auto-loads partials/branding files.
- `resources/init-https.js` + `resources/dev-cert/` — local HTTPS dev cert support (used with `--https` flag, invoked by `npm run dev`).

## Styling conventions

- Bootstrap 5.3 is included; prefer it over custom CSS where possible.
- Custom utility/component classes use a `bxi-` prefix (see `/docs` page for the full utility class reference) — follow this convention for new classes so DaVinci-embedded HTML/CSS doesn't collide with app styles.
- Never hardcode brand colors/fonts in `scss/common/*` or `scss/pages/<vertical>.scss` — they should come from CSS variables defined in `branding.hbs` so they stay user-customizable. Exceptions are acceptable for non-brand colors (e.g., pure white/black).
- If you must add CSS inside a DaVinci flow's HTML, scope it tightly to an ID/class — those styles are *not* isolated from the rest of the site when the flow loads.

## Things to avoid / good to know

- The `trials/` directory (if present locally) is a gitignored scratch folder and/or a separate downstream build pipeline referenced from `/docs` — it is unrelated to normal local development and should generally be ignored unless a task specifically concerns it.
- Don't remove or rename `settings/<vertical>.json` files — they back the "reset settings" feature.
- The `generic` vertical is special-cased: no `dashboard.hbs`, no `branding.hbs`, no dialog-examples page.
- Environment variables containing secrets (API keys) should not be echoed into logs, comments, or new files beyond the `.env*` files that already contain them.

## Where to look next

- `README.md` — full human-facing documentation (cloning, PingOne setup, versioning notes, CSS notes, `bxi-davinci.js` data-attribute reference, installation).
- `/docs` route (`src/docs/index.hbs`) — live in-app style guide (buttons, links, utility classes, SCSS mixins, icon list).
- `settings/README.md`, `src/partials/README.md` — short in-place notes on those specific folders.
- `src/pages/AGENTS.md` — per-vertical file structure in depth.
- `schemas/` — JSON Schemas for `settings.json` and `editor-mapping.json`, referenced via `$schema` in every vertical's data files for editor/agent validation (see `src/pages/AGENTS.md`).
