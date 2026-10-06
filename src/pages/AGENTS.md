# src/pages/AGENTS.md

Per-vertical file structure. See the root `AGENTS.md` for overall project orientation; this file goes deeper on the files inside each `src/pages/<vertical>/` directory, which is the most common place prompt-driven customizations land.

## Directory layout

Each vertical (e.g. `airlines`, `finance`, `health`, ...) has its own folder here with up to five files:

- `index.hbs` — home page, served at `/<vertical>`
- `dashboard.hbs` — post-auth dashboard page, served at `/<vertical>/dashboard` (**not present for `generic`**)
- `branding.hbs` — a `<style>` block of CSS custom properties (`--bxi-*`) registered as the `<vertical>Branding` Handlebars partial (**not present for `generic`**)
- `settings.json` — the live/editable content and theme data for the vertical (see below)
- `editor-mapping.json` — describes which `settings.json` paths the in-app edit drawer can expose, and how (see below)

Routes are auto-derived at server startup from whatever `.hbs` files exist in a vertical's folder (see `resources/helpers.js` `getVerticalEndpoints`) — adding a new page file (other than `branding.hbs`) automatically creates a route, but requires a server restart to be picked up.

## `settings.json`

Two top-level keys:

- `"theme"` — flat key/value map of theme values (colors, fonts). These are consumed by `branding.hbs`, which maps each theme key to a CSS variable (e.g. `theme.primaryColor` → `--bxi-primary-color`). To restyle a vertical, prefer editing values here (or in `branding.hbs` directly for variables not surfaced in `theme`) rather than hardcoding colors in `.scss` files.
- `"settings"` — page content: `title`, `images` (favicon/logo/dialog logo — can be a local path like `/<vertical>/logo.png` served from `public/<vertical>/`, or a full CDN URL; set to `""` to hide an image), and structured content blocks for the home page, dashboard, and footer that are rendered by the vertical's `.hbs` files.

Two template placeholders are replaced server-side on every load (see `helpers.getSettingsFile`): `{{currentYear}}` and `{{lastYear}}`. Use these instead of hardcoding years in copyright strings or sample dates.

**Important distinction:**
- `src/pages/<vertical>/settings.json` is the **live** file — this is what's actually read/rendered, and what the edit drawer (`BXI_ENABLE_EDITING=true`) writes back to.
- `settings/<vertical>.json` (top-level `settings/` folder, note: no `src/pages` prefix) is the **factory-default** copy used to restore defaults via `POST /<vertical>/settings/reset` (or the global `POST /settings/reset`). When applying assets/content from a BOM or prompt to a *live* demo customization, edit `src/pages/<vertical>/settings.json`. Only touch `settings/<vertical>.json` if you intend to change what "reset to default" produces for that vertical (rare).

## `editor-mapping.json`

Drives the optional in-browser edit drawer (enabled via `BXI_ENABLE_EDITING=true` in `.env`, opened via the pencil icons on `/shortcuts`). It has `theme` and `content` top-level keys, each split into `global`/`home`/`dashboard` arrays. Each entry maps a `settings.json` path to something editable in the UI:

- Theme entries: `{ "type": "color" | "font", "friendlyName": "...", "jsonPath": "theme.xxx", "cssVariable": "--bxi-xxx" }`
- Content entries: `{ "type": "string" | "image", "friendlyName": "...", "jsonPath": "settings.xxx.yyy", "elementSelector": "<css selector>" }`

If you add a new field to `settings.json` that should be user-editable in the drawer, add a matching entry here. The editor is intentionally limited to simple strings/images/colors/fonts — not arrays — so array-based content (offers lists, nav links, etc.) is edited by hand in `settings.json` only.

## `branding.hbs`

A `<style>` block registered as a Handlebars partial (`<vertical>Branding`) and included in the `<head>` of every page for that vertical. Contains two sections by convention:

- Global vars — shared CSS variable names used across `scss/common/*` (e.g. `--bxi-primary-color`, `--bxi-secondary-color`, `--bxi-button-bg-color`).
- Vertical-specific vars — used only in that vertical's `scss/pages/<vertical>.scss` (e.g. `--bxi-airlines-banner-color`).

Values here should generally come from `theme.*` in `settings.json` (via Handlebars interpolation) so the edit drawer and factory-reset flow both work correctly — avoid hardcoding a color directly in `branding.hbs` unless it truly isn't meant to be user-editable.

## Adding a new vertical

1. Create `public/<vertical>/` for images, `scss/pages/<vertical>.scss` for styles, and `src/pages/<vertical>/` with `index.hbs`, `dashboard.hbs`, `branding.hbs`, `settings.json`, `editor-mapping.json` (use an existing vertical as a template).
2. Add the new `scss/pages/<vertical>.scss` import to `scss/index.scss`.
3. Add a matching `settings/<vertical>.json` factory-default file (copy of the initial `settings.json`) so the reset endpoint works.
4. Restart `npm start`/`npm run dev` — vertical discovery (`helpers.getVerticals()`) and partial/route registration only happen at server startup.

## `generic` vertical (special case)

`generic` has no `dashboard.hbs`, no `branding.hbs`, and no `dialog-examples` page — it's a minimal single-page vertical meant to demonstrate a single static DaVinci widget (`BXI_GENERIC_POLICY_ID`). Don't assume every vertical has all five files; code that iterates verticals should handle its absence gracefully (see how `server.js` and `resources/helpers.js` already do this).
