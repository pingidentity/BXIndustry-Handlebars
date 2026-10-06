import fs from 'fs';

import helpers from '../resources/helpers.js';

/**
 * Per-vertical routes: page routes (auto-derived from src/pages/<vertical>/*.hbs), manifest.json,
 * dialog-examples, /admin redirect, and per-vertical settings get/put/reset.
 */
export default async function verticalPageRoutes(fastify) {
  // Generic does not have dashboard or dialog-examples page
  fastify.verticals.forEach((vertical) => {
    // Do this here so it's in sync with endpoints (e.g. if a user adds a page without restarting server it won't be navigatable yet)
    const verticalLinks = helpers.getVerticalLinks(vertical);

    for (const [filename, endpoint] of Object.entries(
      helpers.getVerticalEndpoints(vertical)
    )) {
      fastify.get(endpoint, function (req, reply) {
        const pageViewParams = helpers.getViewParams(
          vertical,
          fastify.bxiEnvVars
        ); // Must get these within endpoint or settings.json changes won't be picked up until server restarts
        const {
          Home,
          ['Dialog Examples']: _,
          ...authenticatedEndpoints
        } = verticalLinks; // Use object destructuring to filter out Home and Dialog Examples links
        pageViewParams.verticalAuthenticatedEndpoints = authenticatedEndpoints;

        // Get query parameter to conditionally show the edit drawer
        pageViewParams.showEditDrawer = false;

        if (fastify.enableEditing && req.query['edit']) {
          pageViewParams.showEditDrawer = true;
          pageViewParams.editorMapping =
            helpers.getEditorMappingFile(vertical);
          const currentPage = endpoint.split('/').pop();

          // If the current page is the vertical root, we are on the home page
          pageViewParams.currentPage =
            currentPage === vertical ? 'home' : currentPage;
        }

        fastify.logger.log(
          `${endpoint} hit, send page with view data`,
          pageViewParams
        );
        return reply.view(filename, pageViewParams);
      });
    }

    fastify.post(
      `/${vertical}/settings/reset`,
      { onRequest: fastify.csrfProtection },
      function (_, reply) {
        fs.copyFileSync(
          `./settings/${vertical}.json`,
          `./src/pages/${vertical}/settings.json`
        );
        reply.code(200).send();
      }
    );

    // Save value from editor
    fastify.put(
      `/${vertical}/settings`,
      {
        onRequest: fastify.csrfProtection,
        schema: {
          body: {
            type: 'object',
            required: ['jsonPath', 'value'],
            properties: {
              jsonPath: { type: 'string' },
              value: { type: 'string' },
            },
          },
        },
      },
      async function (req, reply) {
        if (!fastify.enableEditing) {
          reply
            .code(403)
            .send(
              'Editing is currently disabled, set BXI_ENABLE_EDITING=true in your .env if this is a mistake'
            );
          return;
        }

        const path = `./src/pages/${vertical}/settings.json`;

        // We don't want to use the getSettingFile helper here because we don't want to override the currentYear and other handles
        const verticalSettings = JSON.parse(fs.readFileSync(path));

        // This chunk of code iterates through the settings obj to find the correct path to update
        const stack = req.body.jsonPath.split('.');
        let settingsRef = verticalSettings;

        while (stack.length > 1) {
          settingsRef = settingsRef[stack.shift()];
        }

        settingsRef[stack.shift()] = req.body.value;

        fs.writeFileSync(path, JSON.stringify(verticalSettings, null, 2));

        reply.code(200).send();
      }
    );

    // Generic does not have dashboard or dialog examples pages
    if (vertical === 'generic') {
      return;
    }

    // Manifest file so each vertical can be installed as a PWA
    fastify.get(`/${vertical}/manifest.json`, function (_, reply) {
      const name = `BX${vertical.charAt(0).toUpperCase()}${vertical.slice(1)}`;
      reply.code(200).send({
        name: name,
        short_name: name,
        display: 'standalone',
        start_url: `/${vertical}`,
        scope: `/${vertical}`,
        icons: [
          {
            src: 'apple-touch-icon-192.png',
            type: 'image/png',
            sizes: '192x192',
          },
          {
            src: 'apple-touch-icon-512.png',
            type: 'image/png',
            sizes: '512x512',
          },
        ],
      });
    });

    // Vertical Dialog Examples Page
    fastify.get(`/${vertical}/dialog-examples`, function (_, reply) {
      const viewParams = helpers.getSettingsFile(vertical);
      const settings = helpers.getSettingsFile(vertical).settings;

      viewParams.vertical = vertical;
      viewParams.brandingPartial = () => `${vertical}Branding`;
      viewParams.dialogLogo = settings.images.dialog_logo;
      viewParams.favicon = settings.images.favicon || '/generic/favicon.ico';
      viewParams.appleTouchIcon =
        settings.images.apple_touch_icon || '/generic/apple-touch-icon.png';

      fastify.logger.log(
        `/${vertical}/dialog-examples hit, sending view data`,
        viewParams
      );
      return reply.view(`src/pages/dialog-examples.hbs`, viewParams);
    });

    // Redirect old /admin urls to dashboard
    fastify.get(`/${vertical}/admin`, function (_, reply) {
      fastify.logger.log(
        `/${vertical}/admin hit, redirecting to dashboard instead`
      );
      reply.redirect(`/${vertical}/dashboard`);
    });
  });

  // Just in case /generic/dashboard is hit, redirect to generic
  fastify.get('/generic/dashboard', (_, reply) => {
    fastify.logger.log(
      `/generic/dashboard hit, redirecting to /generic since this doesn't exist`
    );
    reply.redirect('/generic');
  });
}
