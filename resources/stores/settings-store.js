import fs from 'fs';

/**
 * Storage abstraction for per-vertical settings.json content. This currently wraps the same
 * flat-file logic that used to live directly in resources/helpers.js and routes/vertical-pages.js,
 * with identical behavior, but gives us a single place to swap out for a different backend later
 * (e.g. a PVC-mounted volume or a lightweight database) when this app runs in Kubernetes.
 */

/**
 * Get a vertical's settings.json file with {{currentYear}}/{{lastYear}} placeholders replaced.
 * Used for rendering - NOT for the editor write path (see getRaw below).
 *
 * @param {string} vertical
 * @returns {Object} parsed settings.json contents, or {} if the vertical has no settings file
 */
function get(vertical) {
  const settingsFile = settingsFilePath(vertical);
  const date = new Date();

  // These key/value pairs are used to find and replace keys in the settings.json files,
  // e.g. '{{currentYear}}' will be replaced with 2023 (or current year)
  // can add additional replace keys here if needed
  const replaceKeys = {
    currentYear: date.getFullYear(),
    lastYear: date.getFullYear() - 1,
  };

  // Generic vertical doesn't have a settings file (or an admin page, so don't care about username)
  if (fs.existsSync(settingsFile)) {
    let fileStr = fs.readFileSync(settingsFile, 'utf8');
    Object.keys(replaceKeys).forEach((key) => {
      fileStr = fileStr.replaceAll(`{{${key}}}`, replaceKeys[key]);
    });
    return JSON.parse(fileStr);
  }

  return {};
}

/**
 * Get a vertical's settings.json file WITHOUT year-placeholder substitution - used by the editor
 * write path so we don't accidentally bake a resolved year into the file.
 *
 * @param {string} vertical
 * @returns {Object} parsed settings.json contents, or {} if the vertical has no settings file
 */
function getRaw(vertical) {
  const settingsFile = settingsFilePath(vertical);

  if (!fs.existsSync(settingsFile)) {
    return {};
  }

  return JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
}

/**
 * Updates a single value in a vertical's settings.json file, addressed by a dot-separated path
 * (e.g. "settings.title").
 *
 * @param {string} vertical
 * @param {string} jsonPath dot-separated path into the settings object
 * @param {string} value new value to set at that path
 */
function update(vertical, jsonPath, value) {
  const path = settingsFilePath(vertical);
  const verticalSettings = getRaw(vertical);

  // This chunk of code iterates through the settings obj to find the correct path to update
  const stack = jsonPath.split('.');
  let settingsRef = verticalSettings;

  while (stack.length > 1) {
    settingsRef = settingsRef[stack.shift()];
  }

  settingsRef[stack.shift()] = value;

  fs.writeFileSync(path, JSON.stringify(verticalSettings, null, 2));
}

/**
 * Resets a vertical's live settings.json back to its factory-default copy under settings/<vertical>.json.
 *
 * @param {string} vertical
 */
function reset(vertical) {
  fs.copyFileSync(
    `./settings/${vertical}.json`,
    `./config/${vertical}.settings.json`
  );
}

/**
 * Get a vertical's editor-mapping.json file.
 *
 * @param {string} vertical
 * @returns {Object} parsed editor-mapping.json contents, or {} if the vertical has no mapping file
 */
function getEditorMapping(vertical) {
  const mappingFile = `./src/pages/${vertical}/editor-mapping.json`;

  // Generic vertical doesn't have a settings file (or an admin page, so don't care about username)
  if (fs.existsSync(mappingFile)) {
    return JSON.parse(fs.readFileSync(mappingFile, 'utf8'));
  }

  return {};
}

function settingsFilePath(vertical) {
  return `./config/${vertical}.settings.json`;
}

export default {
  get,
  getRaw,
  update,
  reset,
  getEditorMapping,
};
