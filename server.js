/**
 * This is the main Node.js server script for your project
 * Check out resources/helpers.js and the route plugins in routes/ for the core logic
 */

// NodeJS imports
import { fileURLToPath } from 'url';
import path from 'path';

// External libraries
import Fastify from 'fastify';

// Internal js files
import helpers from './resources/helpers.js';
import { initHandlebars } from './resources/handlebars.js';
import Logger from './public/js/logger.js';
import { initHttps } from './resources/init-https.js';

// Initialize variables that are no longer available by default in Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize internal variables
const port = process.env.PORT || 3000;
const bxiEnvVars = helpers.getBxiEnvironmentVariables();
const verticals = helpers.getVerticals();

const debug = process.env.BXI_DEBUG_LOGGING === 'true';
const enableEditing = process.env.BXI_ENABLE_EDITING === 'true';

const logger = new Logger(debug);

let https;

if (process.argv.includes('--https')) {
  https = initHttps(port);
}

// Require the fastify framework and instantiate it
const fastify = Fastify({
  // Set this to true for detailed logging
  logger: debug,
  routerOptions: {
    ignoreTrailingSlash: true,
  },
  https,
});

// Setup our static files (images and SCSS)
fastify.register(import('@fastify/static'), {
  root: path.join(__dirname, 'public'),
  prefix: '/',
});

fastify.register(import('@fastify/cookie'));

// CSRF protection for state-changing routes (POST/PUT), uses @fastify/cookie above to
// store the CSRF secret since we don't have a session plugin in this app.
fastify.register(import('@fastify/csrf-protection'));

initHandlebars(fastify);

// Make shared state available to route plugins via fastify.<name>
fastify.decorate('logger', logger);
fastify.decorate('bxiEnvVars', bxiEnvVars);
fastify.decorate('verticals', verticals);
fastify.decorate('enableEditing', enableEditing);

// Redirect http traffic to https
fastify.addHook('onRequest', (request, reply, done) => {
  // Don't do this when running locally or if already on https
  const protoHeader = request.headers['x-forwarded-proto'];
  if (
    request.hostname.includes(`:${port}`) ||
    !protoHeader ||
    protoHeader.match(/https/g)
  ) {
    done();
  } else {
    reply.redirect(302, `https://${request.hostname}${request.url}`);
  }
});

// Route plugins (see routes/ directory)
fastify.register(import('./routes/core.js'));
fastify.register(import('./routes/auth.js'));
fastify.register(import('./routes/docs.js'));
fastify.register(import('./routes/settings.js'));
fastify.register(import('./routes/vertical-pages.js'));

// Redirect 404s to base url rather than throwing errors
fastify.setNotFoundHandler((_, reply) => {
  logger.log('Invalid url, redirecting to root');
  reply.redirect('/');
});

// Run the server and report out to the logs
fastify.listen({ port, host: '0.0.0.0' }, function (err, address) {
  if (err) {
    logger.error(err);
    process.exit(1);
  }

  // Want this logged regardless of debug mode
  console.log(`Your app is listening on ${address}`);
});
