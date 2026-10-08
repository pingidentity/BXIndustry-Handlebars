/**
 * DaVinci session/auth related routes: dvtoken exchange, session-token cookie, vertical redirect cookie.
 */
import helpers from '../resources/helpers.js';

export default async function authRoutes(fastify) {
  // Get a dv token from the server, we do this in server.js as a security best practice so
  // API Keys don't need to be exposed on the front-end
  fastify.post(
    '/dvtoken',
    { onRequest: fastify.csrfProtection },
    async function (request, reply) {
      const widgetSettings = helpers.getGlobalSettings().widget || {};

      // Allow for apiKey and companyId overrides to come from front end, even though it's not encouraged
      const apiKey = request?.body.apiKey || widgetSettings.apiKey;
      const companyId = request?.body.companyId || widgetSettings.companyId;

      let body = {
        policyId: request.body.policyId,
      };

      if (request.cookies['DV-ST']) {
        body.global = {
          sessionToken: request.cookies['DV-ST'],
        };
      }

      if (request.body.flowParameters) {
        body.parameters = request.body.flowParameters;
      }

      const dvBaseUrl = `${widgetSettings.apiUrl}/`;
      const dvSdkTokenBaseUrl = `${widgetSettings.sdkTokenUrl}/v1`;

      let tokenRequest = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SK-API-KEY': apiKey,
        },
        body: JSON.stringify(body),
      };

      const tokenResponse = await fetch(
        `${dvSdkTokenBaseUrl}/company/${companyId}/sdktoken`,
        tokenRequest
      ); // Endpoint is case sensitive in Davinci V2
      const parsedResponse = await tokenResponse.json();

      if (!parsedResponse.success) {
        fastify.logger.error('An error Occurred');
        fastify.logger.error('Parsed Response', parsedResponse);
        fastify.logger.error('Raw', tokenResponse);
        return reply.code(500).send({
          error: `An error occurred getting DaVinci token. See server logs for more details, code: ${parsedResponse.httpResponseCode}, message: '${parsedResponse.message}'.`,
        });
      }

      fastify.logger.log(
        'Successfully retrieved sdktoken for DaVinci',
        parsedResponse
      );

      reply.send({
        token: parsedResponse.access_token,
        companyId: companyId,
        apiRoot: dvBaseUrl,
      });
    }
  );

  fastify.get('/setCookie', (request, reply) => {
    // IMPORTANT - In a production app you would want to do a sessionToken rotation here and set the cookie to the new token value
    // 1. Get the session from P1 based on the sessionToken from the request
    // 2. Compare the request IP Address with the session IP Address from P1 to ensure they match
    // 3. Set the sessionToken to a new GUID in P1
    // 4. Set the cookie to that new GUID like below

    const sessionToken = request.query.sessionToken;
    const sessionTokenMaxAge = +request.query.sessionTokenMaxAge || undefined; // This needs to be undefined if NaN or setCookie will error out

    reply.setCookie('DV-ST', sessionToken, {
      secure: true,
      httpOnly: 'httpOnly',
      sameSite: 'strict',
      path: '/',
      maxAge: sessionTokenMaxAge,
    });

    reply.send();
  });

  // Used to set a cookie that will be used to redirect to the correct vertical after logout using OIDC
  fastify.get('/setVerticalCookie', (request, reply) => {
    reply.setCookie('redirectToVertical', request.query.currentVertical, {
      secure: true,
      httpOnly: 'httpOnly',
      sameSite: 'lax', // Must be lax or the cookie wont be sent on redirect from P1, this is not sensitive data so it's fine
      path: '/',
      maxAge: 60,
    });

    reply.send();
  });
}
