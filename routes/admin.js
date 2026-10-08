import helpers from '../resources/helpers.js';
import globalSettingsStore from '../resources/stores/global-settings-store.js';
import globalSettingsFieldTypes from '../resources/global-settings-field-types.js';

/**
 * Admin page for editing config/bxi.json values directly from the browser. Intended for
 * local/demo use only (see AGENTS.md) - gated behind the "enableEditing" setting, same flag used
 * for the settings.json edit drawer.
 */
export default async function adminRoutes(fastify) {
  fastify.get('/admin', (_, reply) => {
    if (!helpers.isEditingEnabled()) {
      return reply
        .code(403)
        .type('text/plain')
        .send(
          'Admin editing is currently disabled, set "enableEditing": true in config/bxi.json if this is a mistake'
        );
    }

    const settings = globalSettingsStore.get();
    const fieldGroups = globalSettingsFieldTypes.buildFieldGroups(
      settings,
      fastify.verticals
    );

    fastify.logger.log('/admin hit, sending view data', fieldGroups);

    return reply.view('src/pages/admin.hbs', {
      shared: fieldGroups.shared,
      widget: fieldGroups.widget,
      oidc: fieldGroups.oidc,
      useRedirect: settings.authnMethod === 'oidc',
    });
  });

  fastify.put(
    '/admin/settings',
    {
      onRequest: fastify.csrfProtection,
      schema: {
        body: {
          type: 'object',
          required: ['updates'],
          properties: {
            updates: {
              type: 'object',
            },
          },
        },
      },
    },
    (req, reply) => {
      if (!helpers.isEditingEnabled()) {
        return reply
          .code(403)
          .send(
            'Editing is currently disabled, set "enableEditing": true in config/bxi.json if this is a mistake'
          );
      }

      const { updates } = req.body;

      for (const [key, value] of Object.entries(updates)) {
        const validationError = globalSettingsFieldTypes.validateFieldValue(
          key,
          value,
          fastify.verticals
        );

        if (validationError) {
          return reply.code(400).send(validationError);
        }
      }

      const { restartRequired } = globalSettingsStore.update(updates);

      reply.code(200).send({ restartRequired });
    }
  );
}
