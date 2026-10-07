import envStore from '../resources/stores/env-store.js';
import envFieldTypes from '../resources/env-field-types.js';

/**
 * Admin page for editing .env values directly from the browser. Intended for local/demo use only
 * (see AGENTS.md) - gated behind BXI_ENABLE_EDITING, same flag used for the settings.json edit drawer.
 */
export default async function adminRoutes(fastify) {
  fastify.get('/admin', (_, reply) => {
    if (!fastify.enableEditing) {
      return reply
        .code(403)
        .type('text/plain')
        .send(
          'Admin editing is currently disabled, set BXI_ENABLE_EDITING=true in your .env if this is a mistake'
        );
    }

    const envValues = envStore.getAll();
    const fieldGroups = envFieldTypes.buildFieldGroups(
      envValues,
      fastify.verticals
    );

    fastify.logger.log('/admin hit, sending view data', fieldGroups);

    return reply.view('src/pages/admin.hbs', {
      shared: fieldGroups.shared,
      widget: fieldGroups.widget,
      oidc: fieldGroups.oidc,
      useRedirect: envValues['BXI_USE_REDIRECT'] === 'true',
    });
  });

  fastify.put(
    '/admin/env',
    {
      onRequest: fastify.csrfProtection,
      schema: {
        body: {
          type: 'object',
          required: ['updates'],
          properties: {
            updates: {
              type: 'object',
              additionalProperties: { type: 'string' },
            },
          },
        },
      },
    },
    (req, reply) => {
      if (!fastify.enableEditing) {
        return reply
          .code(403)
          .send(
            'Editing is currently disabled, set BXI_ENABLE_EDITING=true in your .env if this is a mistake'
          );
      }

      const { updates } = req.body;

      for (const [key, value] of Object.entries(updates)) {
        const validationError = envFieldTypes.validateFieldValue(
          key,
          value,
          fastify.verticals
        );

        if (validationError) {
          return reply.code(400).send(validationError);
        }
      }

      envStore.update(updates);

      reply.code(200).send();
    }
  );
}
