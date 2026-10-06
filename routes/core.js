import helpers from '../resources/helpers.js';

/**
 * Core/global routes: home redirect, security.txt, legacy redirect, logout, verticals list.
 */
export default async function coreRoutes(fastify) {
  // Our home page route
  // Redirects to the default vertical (if set in environment variables) or falls back on generic
  fastify.get('/', function (request, reply) {
    if (request.hostname.includes('bxgeneric.org')) {
      fastify.logger.log(
        'Arrived from bxgeneric domain, redirecting generic vertical'
      );
      reply.redirect('/generic');
      return;
    }

    // Handles redirect back from P1 if using OIDC Redirect
    const redirectOverrideCookie = request.cookies['redirectToVertical'];
    if (redirectOverrideCookie) {
      reply.clearCookie('redirectToVertical');
      reply.redirect(`/${redirectOverrideCookie}`);
      return;
    }

    const defaultVertical = process.env.BXI_ACTIVE_VERTICAL;
    const redirectVertical = helpers.isValidVertical(defaultVertical)
      ? defaultVertical
      : 'company';

    fastify.logger.log(
      `Root hit, defined default vertical is: '${defaultVertical}' redirecting to: '${redirectVertical}'`
    );
    reply.redirect(`/${redirectVertical}`);
  });

  fastify.get('/.well-known/security.txt', function (_, reply) {
    fastify.logger.log(
      `/.well-known/securtiy.txt was hit, redirecting ping identity's version`
    );
    reply.redirect(`http://www.pingidentity.com/.well-known/security.txt`);
  });

  fastify.get('/redirect', function (_, reply) {
    reply.redirect('https://demo-oidc.bxindustry.org/');
  });

  fastify.get('/logout', (_, reply) => {
    reply.clearCookie('DV-ST');
    reply.send();
  });

  fastify.get('/verticals', (_, reply) => {
    reply
      .code(200)
      .header('Content-Type', 'application/json; charset=utf-8')
      .send(fastify.verticals);
  });

  // Front-end code must fetch this once and send the token back as an
  // 'x-csrf-token' header on any POST/PUT request (see routes with
  // onRequest: fastify.csrfProtection)
  fastify.get('/csrf-token', (_, reply) => {
    reply.send({ token: reply.generateCsrf() });
  });
}
