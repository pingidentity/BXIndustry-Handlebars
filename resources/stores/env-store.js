import fs from 'fs';

/**
 * Storage abstraction for the app's "environment variable" configuration (currently backed by
 * the local .env file). The goal is to keep this module's public interface (getAll/update) stable
 * so a future deployment (e.g. running in a Kubernetes pod) can swap this file-based implementation
 * out for one backed by a PVC-mounted file, a ConfigMap/Secret, or a lightweight database, without
 * having to change any route code that consumes it.
 *
 * NOTE: Writing to .env here does NOT update the running process's `process.env` values - this app
 * loads .env once at startup via `node --env-file=.env` (no dotenv/live-reload). Callers must surface
 * a "restart required" message to the user after calling update().
 */

const ENV_FILE_PATH = './.env';

/**
 * Parses the .env file into an ordered list of key/value pairs. Comments and blank lines are
 * ignored for the purposes of returned data (but preserved on disk - see update()).
 *
 * @returns {Object} map of { [key]: value } for every KEY=value line in the file
 */
function getAll() {
  if (!fs.existsSync(ENV_FILE_PATH)) {
    return {};
  }

  const lines = fs.readFileSync(ENV_FILE_PATH, 'utf8').split('\n');
  const values = {};

  lines.forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (match) {
      values[match[1]] = match[2];
    }
  });

  return values;
}

/**
 * Updates one or more keys in the .env file, preserving comments, blank lines, and the order of
 * all other lines. If a key already exists, its line is updated in place. If a key doesn't exist
 * yet, a new line is appended at the end of the file (this happens, for example, the first time
 * someone fills in BXI_REDIRECT_ISSUER/BXI_REDIRECT_CLIENT_ID after switching BXI_USE_REDIRECT to
 * true - those keys are commonly absent from a widget-mode .env to begin with). Callers are
 * expected to validate that keys are part of a known/allowed set before calling this (see
 * resources/env-field-types.js) - this store itself will happily write any key it's given.
 *
 * @param {Object} updates map of { [key]: value } to write
 * @returns {Object} the full set of env values after the update (same shape as getAll())
 */
function update(updates) {
  if (!fs.existsSync(ENV_FILE_PATH)) {
    throw new Error(`.env file not found at ${ENV_FILE_PATH}`);
  }

  const lines = fs.readFileSync(ENV_FILE_PATH, 'utf8').split('\n');
  const remainingUpdates = { ...updates };

  const newLines = lines.map((line) => {
    const match = line.match(/^(\s*)([\w.-]+)(\s*=\s*).*$/);
    if (!match) {
      return line;
    }

    const [, leadingWhitespace, key, equalsSeparator] = match;

    if (Object.prototype.hasOwnProperty.call(remainingUpdates, key)) {
      const value = remainingUpdates[key];
      delete remainingUpdates[key];
      return `${leadingWhitespace}${key}${equalsSeparator}${value}`;
    }

    return line;
  });

  // Any keys left over didn't already have a line in the file - append them at the end.
  Object.entries(remainingUpdates).forEach(([key, value]) => {
    newLines.push(`${key}=${value}`);
  });

  fs.writeFileSync(ENV_FILE_PATH, newLines.join('\n'));

  return getAll();
}

export default {
  getAll,
  update,
};
