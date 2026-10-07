/**
 * Field classification for the admin .env editor UI (routes/admin.js, src/pages/admin.hbs).
 * Kept separate from resources/stores/env-store.js, which stays a dumb key/value read-write layer
 * agnostic of any UI concerns.
 */

// Rendered as Bootstrap switches. Order here controls display order within the shared section.
const BOOLEAN_KEYS = [
  'BXI_ENABLE_EDITING',
  'BXI_DEBUG_LOGGING',
  'BXI_USE_REDIRECT',
  'BXI_HIDE_SHORTCUTS',
];

// Rendered as a <select> of valid verticals.
const VERTICAL_KEYS = ['BXI_ACTIVE_VERTICAL'];

// Never rendered in the admin UI at all (left untouched in the file).
const EXCLUDED_KEYS = ['BXI_SHOW_CLONE_BUTTON'];

// Keys only relevant when BXI_USE_REDIRECT=true (OIDC redirect mode, see .env-oidc)
const OIDC_GROUP_KEYS = ['BXI_REDIRECT_ISSUER', 'BXI_REDIRECT_CLIENT_ID'];

// Keys only relevant when BXI_USE_REDIRECT is false/absent (DaVinci widget mode, see .env-widget)
const WIDGET_GROUP_KEYS = [
  'BXI_API_URL',
  'BXI_DV_JS_URL',
  'BXI_SDK_TOKEN_URL',
  'BXI_API_KEY',
  'BXI_COMPANY_ID',
  'BXI_LOGIN_POLICY_ID',
  'BXI_REGISTRATION_POLICY_ID',
  'BXI_PROFILE_MANAGEMENT_POLICY_ID',
  'BXI_PASSWORD_RESET_POLICY_ID',
  'BXI_DEVICE_MANAGEMENT_POLICY_ID',
  'BXI_DASHBOARD_POLICY_ID',
  'BXI_GENERIC_POLICY_ID',
];

// Rendered as a masked password input with a reveal toggle. Explicit opt-in list rather than a
// pattern match, so it's obvious at a glance which keys are treated as sensitive.
const SECRET_KEYS = ['BXI_API_KEY'];

// All keys the admin page knows how to render/edit, regardless of whether they're currently
// present in .env (e.g. a widget-mode .env typically doesn't have BXI_REDIRECT_ISSUER/CLIENT_ID
// yet, but we still want to show those fields - blank - so a user can switch into OIDC mode).
const KNOWN_KEYS = [
  ...BOOLEAN_KEYS,
  ...VERTICAL_KEYS,
  ...WIDGET_GROUP_KEYS,
  ...OIDC_GROUP_KEYS,
].filter((key) => !EXCLUDED_KEYS.includes(key));

// Friendlier display labels for the admin UI. Falls back to the raw key name if not listed here.
const FRIENDLY_NAMES = {
  BXI_ENABLE_EDITING: 'Enable Settings Editing',
  BXI_DEBUG_LOGGING: 'Debug Logging',
  BXI_USE_REDIRECT: 'Use OIDC Redirect (instead of DaVinci Widget)',
  BXI_HIDE_SHORTCUTS: 'Hide Shortcuts Link',
  BXI_ACTIVE_VERTICAL: 'Active Vertical',
  BXI_API_URL: 'API URL',
  BXI_DV_JS_URL: 'DaVinci JS URL',
  BXI_SDK_TOKEN_URL: 'SDK Token URL',
  BXI_API_KEY: 'API Key',
  BXI_COMPANY_ID: 'Company (Environment) ID',
  BXI_CLONE_ENVIRONMENT: 'Clone Environment ID',
  BXI_LOGIN_POLICY_ID: 'Login Policy ID',
  BXI_REGISTRATION_POLICY_ID: 'Registration Policy ID',
  BXI_PROFILE_MANAGEMENT_POLICY_ID: 'Profile Management Policy ID',
  BXI_PASSWORD_RESET_POLICY_ID: 'Password Reset Policy ID',
  BXI_DEVICE_MANAGEMENT_POLICY_ID: 'Device Management Policy ID',
  BXI_DASHBOARD_POLICY_ID: 'Dashboard Policy ID',
  BXI_GENERIC_POLICY_ID: 'Generic Policy ID',
  BXI_CLONE_POLICY_ID: 'Clone Policy ID',
  BXI_REDIRECT_ISSUER: 'OIDC Issuer URL',
  BXI_REDIRECT_CLIENT_ID: 'OIDC Client ID',
};

/**
 * Builds the view-model list of fields for the admin page, given the current .env contents and
 * the list of valid verticals. Every known key (see KNOWN_KEYS) is included, even if it's not
 * currently present in the .env file (rendered with a blank value in that case). BXI_SHOW_CLONE_BUTTON
 * is always excluded.
 *
 * @param {Object} envValues result of envStore.getAll()
 * @param {string[]} verticals result of helpers.getVerticals()
 * @returns {{shared: Array, widget: Array, oidc: Array}}
 */
function buildFieldGroups(envValues, verticals) {
  const fields = KNOWN_KEYS.map((key) =>
    buildField(key, envValues[key] ?? '', verticals)
  );

  return {
    shared: fields.filter(
      (field) =>
        !WIDGET_GROUP_KEYS.includes(field.key) &&
        !OIDC_GROUP_KEYS.includes(field.key)
    ),
    widget: fields.filter((field) => WIDGET_GROUP_KEYS.includes(field.key)),
    oidc: fields.filter((field) => OIDC_GROUP_KEYS.includes(field.key)),
  };
}

function buildField(key, value, verticals) {
  const label = FRIENDLY_NAMES[key] || key;

  if (VERTICAL_KEYS.includes(key)) {
    return {
      key,
      label,
      type: 'vertical',
      value,
      options: verticals.map((vertical) => ({
        value: vertical,
        selected: vertical === value,
      })),
    };
  }

  if (BOOLEAN_KEYS.includes(key)) {
    return { key, label, type: 'boolean', value, checked: value === 'true' };
  }

  if (SECRET_KEYS.includes(key)) {
    return { key, label, type: 'secret', value };
  }

  return { key, label, type: 'string', value };
}

/**
 * Validates a proposed update to a single key, returning an error message string if invalid,
 * or null if the value is acceptable.
 *
 * @param {string} key
 * @param {string} value
 * @param {string[]} verticals result of helpers.getVerticals()
 * @returns {string|null}
 */
function validateFieldValue(key, value, verticals) {
  if (EXCLUDED_KEYS.includes(key)) {
    return `${key} cannot be edited from this page`;
  }

  if (!KNOWN_KEYS.includes(key)) {
    return `Unknown environment variable: ${key}`;
  }

  if (BOOLEAN_KEYS.includes(key) && value !== 'true' && value !== 'false') {
    return `${key} must be "true" or "false"`;
  }

  if (VERTICAL_KEYS.includes(key) && !verticals.includes(value)) {
    return `${key} must be one of: ${verticals.join(', ')}`;
  }

  return null;
}

export default {
  BOOLEAN_KEYS,
  VERTICAL_KEYS,
  EXCLUDED_KEYS,
  SECRET_KEYS,
  OIDC_GROUP_KEYS,
  WIDGET_GROUP_KEYS,
  KNOWN_KEYS,
  FRIENDLY_NAMES,
  buildFieldGroups,
  validateFieldValue,
};
