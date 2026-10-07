import settingsStore from '../resources/stores/settings-store.js';

/**
 * Global settings reset (resets all verticals' settings.json back to factory defaults).
 */
export default async function settingsRoutes(fastify) {
  // We can allow on this even if editing is disabled just in case something gets edited and we want to revert to default settings
  fastify.post(
    '/settings/reset',
    { onRequest: fastify.csrfProtection },
    function (_, reply) {
      fastify.verticals.forEach((vertical) => {
        settingsStore.reset(vertical);
      });
      reply.code(200).send();
    }
  );
}
