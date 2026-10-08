# AGENTS.md

Guidance for AI coding agents (and humans skimming for orientation) working in this repo. This project is largely in **maintenance mode** — it's meant to be easy to clone and lightly customize, with deeper customization possible for those who want it. Prefer the smallest, most localized change that accomplishes the task.

For the full human-oriented walkthrough (cloning flow, PingOne setup, vertical list, `bxi-davinci.js` data-attribute API, etc.) see `README.md` — it's comprehensive and this file intentionally does not duplicate it. Read `README.md` first if you need deep background; this file is a faster map for making changes.

## What this project is

BXIndustry is a Node.js (Fastify + Handlebars) app used by Ping Identity demo teams to showcase **DaVinci** orchestration flows (registration, login, MFA, password reset, profile/device management, etc.) inside a realistic-looking demo storefront. The app ships with 16 "industry vertical" skins (airlines, health, finance, retail, ...) that share the same server/templating engine but have independent content, branding, and imagery.

Two integration modes are supported for authenticating a user against DaVinci flows:
- **Widget mode** (default): flows are embedded via `davinci.js` and triggered from HTML data attributes.
- **OIDC redirect mode**: the app redirects to a PingOne OIDC application instead of embedding a widget (`authnMethod: "oidc"` in `config/bxi.json`).

## Tech stack & commands

- Node >= 20 (see `.nvmrc` for the officially tested version)
- Fastify (server), Handlebars (templates/partials), Sass (compiled to `public/styles.css`)
- `npm install`
- `npm run dev` — sass watch + nodemon w/ HTTPS (local dev cert in `resources/dev-cert`)
- `npm start` — one-shot sass compile + `node server.js` (used in production/Docker)
- **Important**: `config/bxi.json` and `config/<vertical>.settings.json` are read fresh on every request - edits take effect immediately, no restart required. The only exceptions are `debugLogging` (read once at server boot to configure the logger) and adding new static files in `public/` (only picked up at startup).
- Nodemon (`nodemonConfig` in `package.json`) intentionally does *not* watch `src/*`, `scss/*`, `settings/*`, `config/*` — Handlebars templates are recompiled per-request already, so editing `.hbs` files usually doesn't require a restart, and `config/*` is excluded specifically so editing `config/bxi.json`/`config/<vertical>.settings.json` doesn't trigger a server restart. New **partials** and new **verticals** do require a restart (see below).

## The three configuration levers (most prompt-driven changes touch these)

### 1. PingOne / DaVinci configuration (`config/bxi.json`)

`config/bxi.json` (created by the user, gitignored-in-practice via the clone flow, though sample files exist in this repo for local dev) holds the connection to a PingOne environment and DaVinci application. It's a flat-ish JSON object:

- `widget.apiUrl`, `widget.dvJsUrl`, `widget.sdkTokenUrl` — PingOne/DaVinci endpoints
- `widget.apiKey`, `widget.companyId` — DaVinci application credentials. `config/bxi.json` is tracked in source control (so clones get sensible defaults for everything else), so `widget.apiKey` is intentionally left blank there - see the `.env` fallback note below and the security note at the bottom of this file.
- `widget.dashboardPolicyId`, `widget.genericPolicyId`, `widget.clonePolicyId`, `widget.cloneEnvironment` — DaVinci flow policy IDs wired up to specific pages
- `widget.authnButtons` — array of `{ label, policyId }` rendered as Log In/Sign Up buttons in `src/home-nav-buttons.hbs` (only when `authnMethod` is `"widget"`). An empty `policyId` hides that button.
- `widget.dashboardTabs` — array of `{ label, policyId }` rendered as buttons in `src/dashboard-buttons.hbs` on every vertical's dashboard page. Same empty-`policyId`-hides-button behavior.
- `activeVertical` — which vertical the root `/` route redirects to (must be a valid vertical directory name, see below)
- `enableEditing`, `debugLogging`, `hideShortcuts`, `showCloneButton` — feature toggles
- `authnMethod` — `"widget"` or `"oidc"`, controls whether `authnButtons` or the OIDC redirect flow is used for login (see below)

See the full annotated field list in `README.md` under "Environment". `config/bxi.widget.json`, `config/bxi.oidc.json` in `config/` are **example/reference** files for different setups (local widget dev, OIDC dev) — not something every clone needs. This org's own prod/qa configs are kept locally as gitignored `config/bxi.json` copies, not committed.The whole parsed `config/bxi.json` object is exposed to templates as `{{global.*}}` (see `resources/helpers.js`'s `getGlobalSettings`/`getViewParams`) and a small explicit subset is exposed to front-end JS as `window._env_` (see `src/partials/variables.hbs`) — `apiKey`/`companyId` are intentionally NOT exposed to `window._env_` for security reasons. **If you add a new field that front-end JS needs to read, add it explicitly to `variables.hbs` rather than dumping the whole object.**

### 2. OIDC application configuration (`config/bxi.oidc.json`, redirect mode)

When `authnMethod` is `"oidc"`, login is handled by redirecting to a PingOne OIDC application instead of a DaVinci widget:

- `oidc.redirectIssuer` — the OIDC issuer URL for the PingOne environment/application
- `oidc.redirectClientId` — the OIDC client ID

Note that widget-mode fields (`widget.apiUrl`, `widget.apiKey`, etc.) are still used in OIDC mode — only the login/registration buttons switch to OIDC; clone, dashboard, profile/password/device management flows all still go through the DaVinci widget regardless of `authnMethod`.

This is powered by `@pingidentity-developers-experience/ping-oidc-client-sdk`, wired up in `public/js/oidc.js`. User info population after login can be customized in `public/register-functions.js` (`bxi.updatedUserInfo`). `config/bxi.oidc.json` is a ready-to-use starting template for this mode.

### 3. Vertical selection & settings/assets

Valid verticals are simply the directory names under `src/pages/` (introspected at server startup by `helpers.getVerticals()`): `airlines`, `company`, `eats`, `education`, `finance`, `generic`, `government`, `health`, `hotels`, `insurance`, `manufacturing`, `pharmacy`, `realty`, `retail`, `sports`, `volunteer`.

- Set `activeVertical` in `config/bxi.json` to pick the default vertical for `/`.
- Each vertical's **content/text/images** live in `config/<vertical>.settings.json` (moved out of `src/pages/<vertical>/` so all runtime-editable config lives in one place, e.g. for a persistent-volume deployment).
- Each vertical's **CSS variables/branding** live in `src/pages/<vertical>/branding.hbs`.
- Applying "assets for a vertical" (from a BOM, a prompt, etc.) generally means: writing image files into `public/<vertical>/`, then referencing them by path in that vertical's `config/<vertical>.settings.json`, and/or updating color/font values in `branding.hbs` (or the `theme` block in `config/<vertical>.settings.json`, which is applied to those same CSS vars — see `src/pages/AGENTS.md` for details).
- `settings/<vertical>.json` (top-level `settings/` folder, distinct from `config/<vertical>.settings.json`) holds the **factory-default** copy; `POST /<vertical>/settings/reset` copies it back over the live file. Don't edit `settings/<vertical>.json` unless you intend to change what "reset to default" means. `src/pages/<vertical>/editor-mapping.json` (the schema describing what the edit drawer can edit) stays in `src/pages/<vertical>/` since it ships with the template code rather than being runtime data.

See `src/pages/AGENTS.md` for the full per-vertical file breakdown.

## Global (cross-vertical) customization points

- `src/home-nav-buttons.hbs` — auth buttons (Log In / Sign Up) shown in the nav on every vertical's home page. Iterates `global.widget.authnButtons` from `config/bxi.json`.
- `src/dashboard-buttons.hbs` — buttons shown at the top of every vertical's dashboard page. Iterates `global.widget.dashboardTabs` from `config/bxi.json`.
- `public/register-functions.js` — centralized place to register JS callbacks used by flow buttons (`data-success-callback`, `data-error-callback`, `data-parameter-factory`) and lifecycle hooks (`bxi.pageLoad`, `bxi.logout`, `bxi.updatedUserInfo`). See README's "bxi-davinci.js Documentation" section for the full data-attribute contract used to wire buttons/divs to DaVinci flows.
- `src/partials/*.hbs` — shared Handlebars partials, auto-registered by `resources/handlebars.js` on startup (kebab-case filename → camelCase partial name). Adding a partial requires a server restart.
- `src/partials/icons/*.hbs` — SVG icon partials (auto-registered with an `Icon` suffix); see `/docs` page for the icon-authoring convention (fill/stroke target classes for the `color-icon` SCSS mixin).
- `src/templates/*.hbs` — reusable HTML snippets meant to be pasted into DaVinci flow HTML nodes (not rendered directly by this app's routes, other than the `/​<vertical>/dialog-examples` preview page).

## Server internals (only touch if you know what you're doing)

- `server.js` — route definitions: vertical page routing (auto-derived from files in `src/pages/<vertical>/`), `/dvtoken` (server-side DaVinci SDK token exchange, keeps the API key off the client), `/shortcuts`, `/docs`, settings edit/reset endpoints, OIDC-related cookie endpoints.
- `resources/helpers.js` — vertical discovery, settings file loading (+ `{{currentYear}}`/`{{lastYear}}` templated replacement), global settings accessor, endpoint/link map generation.
- `resources/stores/global-settings-store.js` — read/write layer for `config/bxi.json`.
- `resources/stores/settings-store.js` — read/write layer for `config/<vertical>.settings.json` (and `src/pages/<vertical>/editor-mapping.json`).
- `resources/global-settings-field-types.js` — field classification (type, label, grouping, validation) for the `/admin` editor UI.
- `resources/handlebars.js` — registers Handlebars helpers (`eq`, `gt`, `and`, `times`, `length`, `inlineSvg`, `lookupPath`, `json`) and auto-loads partials/branding files.
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
- `config/bxi.json` is tracked in source control, so `widget.apiKey` is intentionally left blank there - if it's blank, `resources/stores/global-settings-store.js` falls back to `BXI_API_KEY` in the (gitignored) `.env` file. Saving `widget.apiKey` from the `/admin` UI writes to `.env` instead of `config/bxi.json` for the same reason, and - unlike the rest of `config/bxi.json` - requires a server restart to take effect (`.env` is only read at startup). Never add `widget.apiKey`/`widget.companyId` to `variables.hbs`'s `window._env_` whitelist, write a real key into `config/bxi.json`, or echo it into logs/comments/new files.

## Where to look next

- `README.md` — full human-facing documentation (cloning, PingOne setup, versioning notes, CSS notes, `bxi-davinci.js` data-attribute reference, installation).
- `PINGONE-MCP-SETUP.md` — how a human can ask an AI agent to provision a PingOne environment/OIDC application via the PingOne Remote MCP Server and wire the result into this repo's `config/bxi.json` (OIDC mode only, for now). If a user asks you to do this, follow that doc's example prompt pattern and this file's conventions (vertical names, settings structure) together.
- `/docs` route (`src/docs/index.hbs`) — live in-app style guide (buttons, links, utility classes, SCSS mixins, icon list).
- `settings/README.md`, `src/partials/README.md` — short in-place notes on those specific folders.
- `src/pages/AGENTS.md` — per-vertical file structure in depth.
