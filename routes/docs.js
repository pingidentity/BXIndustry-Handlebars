import fs from 'fs';

import helpers from '../resources/helpers.js';

/**
 * Documentation and shortcuts pages.
 */
export default async function docsRoutes(fastify) {
  fastify.get('/docs', (request, reply) => {
    const vertical = request.query.vertical || 'company';
    const icons = fs
      .readdirSync('src/partials/icons')
      .map((file) =>
        file.replace('.hbs', '').replace(/-./g, (x) => x[1].toUpperCase())
      ); // remove file extension and convert kebab-case to camelCase
    return reply.view('src/docs/index.hbs', {
      selectedVertical: vertical,
      verticals: fastify.verticals.filter((v) => v !== 'generic'),
      brandingPartial: () => `${vertical}Branding`,
      icons: icons.map((icon) => ({ icon: icon, partial: icon + 'Icon' })),
      ...helpers.getSettingsFile(vertical),
    });
  });

  // Set up shortcuts endpoints, shows all verticals with applicable links
  fastify.get('/shortcuts', (req, reply) => {
    const verticalLinkData = fastify.verticals.map((vertical) => {
      const endpointLinks = helpers.getVerticalLinks(vertical);

      const settings = helpers.getSettingsFile(vertical).settings;
      return {
        name: settings.title,
        logo: settings.images.dialog_logo || settings.images.logo,
        endpointLinks,
      };
    });

    const viewParams = {
      verticals: verticalLinkData,
      showEditLinks: fastify.enableEditing,
    };

    fastify.logger.log('/shortcuts endpoint hit, sending view data', viewParams);
    return reply.view('src/pages/shortcuts.hbs', viewParams);
  });
}
