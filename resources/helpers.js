import fs from 'fs';
import crypto from 'crypto';
import settingsStore from './stores/settings-store.js';
import globalSettingsStore from './stores/global-settings-store.js';

let verticals;
let verticalsEndpointMaps = {};

/**
 * Returns the global settings object (config/bxi.json), used in handlebars templates as
 * {{global.<key>}} or nested e.g. {{global.widget.apiKey}}. Read fresh every call so edits (via
 * the admin UI or directly on disk) take effect without a server restart.
 *
 * @returns {Object} parsed config/bxi.json contents
 */
function getGlobalSettings() {
  return globalSettingsStore.get();
}

/**
 * Returns a list of all verticals build based on directories in src/pages, this is cached
 * if adding a new vertical server.js needs to be restarted, this should be uncommon
 *
 * @returns List of all verticals
 */
function getVerticals() {
  if (verticals) {
    return verticals;
  }

  verticals = fs
    .readdirSync('src/pages', { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  return verticals;
}

function isValidVertical(vertical) {
  return getVerticals().includes(vertical);
}

/**
 * Introspects the vertical's view directory to set up endpoints for all available hbs files (except branding.hbs)
 *
 * @param {string} vertical Vertical name
 * @returns {Object} A map like {<file-location-in-project>: <server-endpoint>}
 */
function getVerticalEndpoints(vertical) {
  // Traversing filesystem is expensive, cache results
  // also this prevents map from getting out of sync if a user adds a file but doesn't restart server
  const cachedEndpointMap = verticalsEndpointMaps[vertical];
  if (cachedEndpointMap) {
    return cachedEndpointMap;
  }

  const verticalViewRoot = `src/pages/${vertical}`;
  const allFiles = fs.readdirSync(verticalViewRoot);

  // Filter out non-handlebars files (e.g. settings.json) and branding files
  const endpointFiles = allFiles.filter(
    (file) => file.match(/.*\.(hbs?)/gi) && file !== 'branding.hbs'
  );

  const endpointMap = {};
  endpointFiles.forEach((file) => {
    endpointMap[`${verticalViewRoot}/${file}`] = stripTrailingSlash(
      // remove trailing slash from 'index' endpoint
      `/${vertical}/${
        file
          .replace('.hbs', '') // remove extension
          .replace('index', '') // replace index with empty string since that's the root url
      }`
    );
  });

  verticalsEndpointMaps[vertical] = endpointMap;

  return endpointMap;
}

function getVerticalLinks(vertical) {
  const endpoints = Object.values(getVerticalEndpoints(vertical));
  const linkMap = {};

  endpoints.forEach((endpoint) => {
    const name = endpoint.replace(`/${vertical}`, '');
    const determinedName = name === '' ? 'home' : stripLeadingSlash(name);
    linkMap[determinedName.charAt(0).toUpperCase() + determinedName.slice(1)] =
      endpoint;
  });

  // Property order matters for shortcuts page, home then dashboard, then whatever custom pages
  // Any null endpoints will be removed from the link map before it's returned
  const orderedLinkMap = {
    Home: null,
    Dashboard: null,
  };

  Object.assign(orderedLinkMap, linkMap);

  // Dialog examples should always be last link, will be removed from the map in case of generic vertical
  orderedLinkMap['Dialog Examples'] =
    vertical !== 'generic' ? `/${vertical}/dialog-examples` : null;

  // Remove any keys which are null, e.g. dialog examples and dashboard from generic or any deleted Home/Dashboard pages
  return Object.fromEntries(
    Object.entries(orderedLinkMap).filter(([_, v]) => v != null)
  );
}

function stripTrailingSlash(str) {
  return str.endsWith('/') ? str.slice(0, -1) : str;
}

function stripLeadingSlash(str) {
  return str.startsWith('/') ? str.slice(1) : str;
}

/**
 * Returns a file at the provided location, but calculates the file's sha1 and adds it as url
 * parameter to bust caching, used so if user makes changes to the file the new file will picked up
 * without restarting server
 *
 * @param {string} fileLocation
 * @returns {Promise} - file that has been imported
 */
function importWithCacheBusting(fileLocation) {
  const fileBuffer = fs.readFileSync(fileLocation);
  const fileHash = crypto.createHash('sha1');
  fileHash.update(fileBuffer);

  return import(`${fileLocation}?sha1=${fileHash.digest('base64')}`);
}

/**
 * Get a vertical's settings.json file, if we can ever use import for this, make sure to use
 * cache busting above or user's changes won't be picked up without restarting the server
 *
 * Delegates to resources/stores/settings-store.js so the underlying storage mechanism can be
 * swapped out later without changing any callers of this helper.
 *
 * @param {string} vertical
 * @returns
 */
function getSettingsFile(vertical) {
  return settingsStore.get(vertical);
}

/**
 * Get a vertical's editor-mapping.json file, if we can ever use import for this, make sure to use
 * cache busting above or user's changes won't be picked up without restarting the server
 *
 * Delegates to resources/stores/settings-store.js so the underlying storage mechanism can be
 * swapped out later without changing any callers of this helper.
 *
 * @param {string} vertical
 * @returns
 */
function getEditorMappingFile(vertical) {
  return settingsStore.getEditorMapping(vertical);
}

/**
 * Combine settings.json with global settings (config/bxi.json) to be passed to handlebars
 * templates/front-end. Global settings are read fresh on every call (see global-settings-store.js)
 * so edits take effect without a server restart.
 *
 * @param {string} vertical
 * @returns {Object} view params for the given vertical
 */
function getViewParams(vertical) {
  let params = getSettingsFile(vertical);
  params.vertical = vertical;
  params.global = getGlobalSettings();
  return params;
}

/**
 * Returns true if settings editing (admin page + edit drawer) is currently enabled. Read fresh
 * from config/bxi.json on every call so toggling this no longer requires a server restart.
 *
 * @returns {boolean}
 */
function isEditingEnabled() {
  return getGlobalSettings().enableEditing === true;
}

export default {
  getGlobalSettings,
  getVerticals,
  isValidVertical,
  importWithCacheBusting,
  getSettingsFile,
  getVerticalEndpoints,
  stripTrailingSlash,
  getVerticalLinks,
  getEditorMappingFile,
  getViewParams,
  isEditingEnabled,
};
