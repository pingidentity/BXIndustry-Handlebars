import fs from 'fs';

/**
 * Storage abstraction for the app's global configuration (currently backed by config/bxi.json).
 * Unlike the old .env-based env-store, this file is read fresh on every call (no process.env
 * caching), so edits - whether made via the admin UI or directly on disk - take effect immediately
 * without requiring a server restart.
 *
 * The public interface (get/update) is kept stable so a future deployment (e.g. running in a
 * Kubernetes pod) can swap this file-based implementation out for one backed by a PVC-mounted
 * file, a ConfigMap/Secret, or a lightweight database, without changing any route code that
 * consumes it.
 *
 * Band-aid secret handling: config/bxi.json is meant to be safe to commit to source control (no
 * secrets), so widget.apiKey is intentionally left blank there. If widget.apiKey isn't set in
 * config/bxi.json, get() falls back to BXI_API_KEY in .env (process.env), and update() routes any
 * write to "widget.apiKey" into .env instead of config/bxi.json. This keeps the secret out of the
 * tracked file while the admin UI still reads/writes it in one place. Unlike config/bxi.json,
 * .env is only read at server startup (see server.js/package.json's --env-file usage), so API key
 * changes via the admin UI require a server restart to take effect.
 */

const GLOBAL_SETTINGS_FILE_PATH = './config/bxi.json';
const ENV_FILE_PATH = './.env';
const ENV_API_KEY_NAME = 'BXI_API_KEY';

/**
 * Get the current global settings, parsed from config/bxi.json, with widget.apiKey falling back
 * to BXI_API_KEY in .env (via process.env) if it's not set in config/bxi.json.
 *
 * @returns {Object} parsed config/bxi.json contents, or {} if the file doesn't exist yet
 */
function get() {
  const settings = fs.existsSync(GLOBAL_SETTINGS_FILE_PATH)
    ? JSON.parse(fs.readFileSync(GLOBAL_SETTINGS_FILE_PATH, 'utf8'))
    : {};

  if (!settings.widget) {
    settings.widget = {};
  }

  if (!settings.widget.apiKey) {
    settings.widget.apiKey = process.env[ENV_API_KEY_NAME] || '';
  }

  return settings;
}

/**
 * Updates one or more values, each addressed by a dot-separated path (e.g. "widget.apiKey" or
 * "widget.authnButtons"). Values can be any JSON-serializable type (string, boolean, array, etc.)
 * - unlike the old .env-backed store, there's no string-only constraint here.
 *
 * "widget.apiKey" is special-cased: it's written to BXI_API_KEY in .env instead of
 * config/bxi.json, so the secret never ends up in the tracked file. All other keys are written to
 * config/bxi.json as usual.
 *
 * @param {Object} updates map of { [dotPath]: value } to write
 * @returns {Object & {restartRequired: boolean}} the full settings object after the update (same shape as get()),
 *   plus a restartRequired flag that's true if widget.apiKey was part of this update
 */
function update(updates) {
  const remainingUpdates = { ...updates };
  let restartRequired = false;

  if (Object.prototype.hasOwnProperty.call(remainingUpdates, 'widget.apiKey')) {
    updateEnvApiKey(remainingUpdates['widget.apiKey']);
    delete remainingUpdates['widget.apiKey'];
    restartRequired = true;
  }

  if (Object.keys(remainingUpdates).length > 0) {
    if (!fs.existsSync(GLOBAL_SETTINGS_FILE_PATH)) {
      throw new Error(
        `config/bxi.json not found - copy config/bxi.widget.json or config/bxi.oidc.json to config/bxi.json to get started`
      );
    }

    const settings = JSON.parse(fs.readFileSync(GLOBAL_SETTINGS_FILE_PATH, 'utf8'));

    Object.entries(remainingUpdates).forEach(([jsonPath, value]) => {
      const stack = jsonPath.split('.');
      let settingsRef = settings;

      while (stack.length > 1) {
        const key = stack.shift();
        if (typeof settingsRef[key] !== 'object' || settingsRef[key] === null) {
          settingsRef[key] = {};
        }
        settingsRef = settingsRef[key];
      }

      settingsRef[stack.shift()] = value;
    });

    fs.writeFileSync(
      GLOBAL_SETTINGS_FILE_PATH,
      JSON.stringify(settings, null, 2)
    );
  }

  return { ...get(), restartRequired };
}

/**
 * Writes BXI_API_KEY into .env, preserving the rest of the file's contents/comments. Creates .env
 * if it doesn't exist yet. Does NOT update process.env - see module doc comment re: restart.
 *
 * @param {string} value
 */
function updateEnvApiKey(value) {
  const lines = fs.existsSync(ENV_FILE_PATH)
    ? fs.readFileSync(ENV_FILE_PATH, 'utf8').split('\n')
    : [];

  let found = false;
  const newLines = lines.map((line) => {
    const match = line.match(/^(\s*)([\w.-]+)(\s*=\s*).*$/);
    if (!match || match[2] !== ENV_API_KEY_NAME) {
      return line;
    }
    found = true;
    const [, leadingWhitespace, key, equalsSeparator] = match;
    return `${leadingWhitespace}${key}${equalsSeparator}${value}`;
  });

  if (!found) {
    newLines.push(`${ENV_API_KEY_NAME}=${value}`);
  }

  fs.writeFileSync(ENV_FILE_PATH, newLines.join('\n'));
}

export default {
  get,
  update,
};
