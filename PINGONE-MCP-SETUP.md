# Setting up BXIndustry with an AI coding agent + PingOne MCP

This guide shows how to use an AI coding agent (opencode, Claude Code, VS Code, Cursor, Codex CLI, etc.) together with the **PingOne Remote MCP Server** to provision a PingOne environment and OIDC application, then wire the results into this repo using **OIDC redirect mode** (`authnMethod: "oidc"`).

This doc intentionally does not duplicate PingOne's own documentation for connecting a client to the MCP server — that setup applies to every project, not just this one, and is kept up to date at the links below. This doc only covers what's specific to *this repo*: the example prompt to use and where the results go.

> Widget mode (DaVinci flows, `widget.apiKey`, flow policy IDs) is not covered here yet — it depends on DaVinci-specific MCP tooling and is more involved. This guide is OIDC-only for now.

## 1. Connect your coding agent to PingOne

Follow PingOne's official docs to connect your AI client to the PingOne Remote MCP Server:

- **Overview**: <https://developer.pingidentity.com/build-with-ai/pingone-mcp-server/p1-overview.html> — what the server is, what it can do, and current limitations (it's an Early Access feature).
- **Client configuration**: <https://developer.pingidentity.com/build-with-ai/pingone-mcp-server/p1-client-configuration.html> — step-by-step setup for VS Code, Cursor, Claude Code, Codex CLI, and a general JSON config that works for other MCP-capable clients (including opencode).

Note: for opencode add the following mcp service to `~/.config/opencode/opencode.jsonc` (at time of writing this was not covered in the docs)
```
{
  // ...
  "mcp": {
    "pingone-remote": {
      "type": "remote",
      "url": "https://mcp.pingone.com/admin/88d36e38-87ff-43e5-b6dd-b533955b2c8d/mcp",
      "oauth": {
        "clientId": "pingone-mcp-server"
      }
    }
  }
}
```

Before you start, make sure:

- You have a PingOne account with an **Administrator** role.
- **IMPORTANT:** MCP access is a two-step, per-environment opt-in: 1) enable "PingOne Remote MCP Server" under **Environment Properties > Manage Opt-Ins** for the org (this reveals a new nav item and may prompt you to refresh the console), then 2) go to that environment's **Settings > MCP Server** page and enable it there (this page is also where you'll find the exact server URL referenced in the client-configuration doc above). Do this for your Administrators environment and every other environment you want the agent to use — **including any new environment the agent creates for you mid-session** (see the troubleshooting section at the bottom of this doc for what it looks like when this step is missed).

Once configured, validate the connection by asking your agent something like:

```
List my PingOne environments
```

If you get a real list back, you're ready to continue.

## 2. Example prompt: provision an environment + OIDC application

With the MCP connection working, you can describe what you want in plain language and let the agent create it for you. Here's an example prompt tailored to this repo (adjust the environment name and company an any other customizations you'd like to make for your situation):

```
Create a new PingOne environment named "BXI Demo - Acme Corp".

In that environment, create a new OIDC application suitable for a
browser-based authorization code flow with PKCE (a public client, no
client secret) that I can use as the OIDC application for a small demo
web app.

I'm demoing with a company called "Acme Corp". Suggest which BXIndustry vertical (see src/pages/ in this repo) is the
closest fit.

Before creating the OIDC application, figure out the redirect URI and
post-logout redirect URI yourself by reading this repo's code (don't
guess or ask me for these) — inspect public/js/oidc.js for how the
redirect_uri and endSession base URI are constructed, and check
server.js / package.json (the --https flag and PORT/port fallback) for
the local dev scheme and port. The redirect URI is scoped per-vertical,
so derive it after you've picked the vertical, not before. Register
both a "localhost" and a "127.0.0.1" variant of each URI (redirect URIs
and post-logout redirect URIs) so the app works regardless of which
hostname I browse to locally.

When creating the OIDC application, also grant it the platform OpenID
Connect resource's "profile" and "email" scopes (in addition to the
default "openid" scope), so ID tokens/userinfo include profile and
email claims for the demo user.

Once you have the issuer URL, client ID, and vertical, write (or update)
a config/bxi.json file at the root of this repo based on
config/bxi.oidc.json, filling in:
- oidc.redirectIssuer with the issuer URL
- oidc.redirectClientId with the application's client ID
- activeVertical with the vertical you suggested
- authnMethod set to "oidc"

Then look at that vertical's config/<vertical>.settings.json and
update the text and colors references to be more relevant to
the company where it makes sense. Don't invent fake image files - only 
suggest images I should change and point me to their locations in the 
settings file.

Ask me if I'd like you to seed a demo user in this environment (or if
I'd rather create one myself in the PingOne admin console). If I say
yes, ask me for a name and a real email address I can actually receive
mail at (this is required — you cannot set an initial password, so I'll
need to receive a real "forgot password" email to set one myself).
Create the user with that email, then tell me to go to the app's
sign-in page and use the "Forgot Password" link with that email to set
a password before I can sign in.

Also get the environment's Bill of Materials (its enabled services) and
tell me what's enabled. If SSO/MFA/DaVinci aren't already on, let me
know so I can enable what I need. Ask me if I'd like the BOM written to
a file in this repo (e.g. a BILL-OF-MATERIALS.md or similar) for my own
reference, and if I say yes, write it there.

Finally, remind me that config/bxi.json changes take effect immediately
(no restart needed), though if we changed debugLogging I'd still need to
restart the app (npm run dev / npm start) to pick that up since it's
only read once at server startup.

If any tool call against the newly created environment fails with a
permission error (e.g. "applications:read:application" or
"dir:read:population" not satisfied), don't just tell me to "contact my
administrator" — tell me specifically to go into the PingOne admin
console and, for this new environment: 1) enable "PingOne Remote MCP Server" under
Environment Properties > Manage Opt-Ins, and 2) go to the newly-appeared Settings > MCP Server tab
for this specific environment and enable it there too. New
environments don't inherit MCP access from other environments, so this
step is required every time.
```

A few notes on this prompt:

- The **issuer URL** and **client ID** map directly to `oidc.redirectIssuer` and `oidc.redirectClientId` in `config/bxi.json` (see `config/bxi.oidc.json` for the exact field names and an example). Most coding agents can write files directly, so instead of copy/pasting these values yourself, have the agent write `config/bxi.json` for you.
- The **redirect URI**/**post-logout redirect URI** should not be guessed or hardcoded to a fixed example — the agent should derive them from this repo's own code (`public/js/oidc.js`'s `redirectUri`/`endSession(baseUri)` construction, plus the dev scheme/port from `server.js` and `package.json`'s `dev`/`start` scripts). Since the redirect path includes the vertical (e.g. `/<vertical>/dashboard`), this only makes sense once the vertical has been chosen. The prompt asks for both `localhost` and `127.0.0.1` variants of each URI since browsers/OS resolve these differently and local dev sometimes needs one or the other.
- The prompt also asks the agent to grant the application the OpenID Connect resource's `profile` and `email` scopes (alongside the default `openid` scope) so ID tokens/userinfo carry those claims — useful if `public/register-functions.js`'s `bxi.updatedUserInfo` (or your own customization) wants to display the user's name/email after login.
- The **vertical** suggestion maps to `activeVertical` in `config/bxi.json`. Valid values are the directory names under `src/pages/` (see the root `AGENTS.md` or `src/pages/AGENTS.md`).
- The **settings.json customization** is optional and only touches content/branding (`config/<vertical>.settings.json`) — it's a separate step from provisioning PingOne itself, but the agent can do both in one conversation.
- The **Bill of Materials** (BOM) is the set of PingOne services enabled on an environment (SSO, MFA, DaVinci, etc.), returned by the MCP server's `getEnvironment` tool. Reviewing it up front tells you whether the environment is ready for the flows you plan to build (for example, DaVinci-specific MCP tools only work once DaVinci is enabled). Writing it into the repo is optional and purely for your own record-keeping — it isn't read by the app.
- MCP tools cannot return secret values (client secrets, API keys, etc.). This example intentionally asks for a public OIDC client, so nothing secret needs to come back. If you later set up widget mode, you'll need to copy the DaVinci API key from the PingOne console into `widget.apiKey` in `config/bxi.json` yourself.
- MCP tools also cannot **set** secret values, including a new user's password — there's no way for the agent to give a created user an initial password. That's why the prompt asks for a real email address up front: use the app's own **Forgot Password** flow (or through the admin console) to set a password for the seeded user, since that flow depends on delivering an email to a real inbox you control.
- After the agent writes `config/bxi.json`, changes take effect immediately - no restart needed (see README's Environment section for the few fields that still require one).

For the full list of environment variables and more background on OIDC mode, see the [Environment](README.md#environment) and [OIDC](README.md#oidc) sections of `README.md`.

## Notes / troubleshooting

- This is an Early Access PingOne feature — check the [overview doc](https://developer.pingidentity.com/build-with-ai/pingone-mcp-server/p1-overview.html) for current limitations.
- **Newly created environment fails every tool call with a permission error** (e.g. `applications:read:application`, `dir:read:population`, `orgmgt:read:environment` not satisfied): this is not an RBAC/role problem, it's almost always that MCP access hasn't been turned on for the *new* environment yet. In the PingOne admin console: 1) confirm "PingOne Remote MCP Server" is enabled under **Environment Properties > Manage Opt-Ins** (enabling this will prompt you to refresh the console); then 2) go to the newly visible **Settings > MCP Server** nav item (this only appears after step 1) and enable the MCP server for that specific environment. Every environment — including ones created by the agent itself during the same session — needs both steps done before any MCP tool can read/write to it. If your agent hits this, it should tell you these exact two steps rather than a generic "ask your administrator" message.
- DaVinci-specific MCP tools require the DaVinci capability to be enabled on the environment. That's not needed for the OIDC-only setup in this guide, but will matter once widget-mode/DaVinci provisioning is documented.
- If your agent doesn't show the PingOne MCP server as connected, re-check the per-client steps in the [client configuration doc](https://developer.pingidentity.com/build-with-ai/pingone-mcp-server/p1-client-configuration.html), including the exact server URL and client ID.
