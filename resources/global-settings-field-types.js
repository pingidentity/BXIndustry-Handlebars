/**
 * Field classification for the admin config/bxi.json editor UI (routes/admin.js, src/pages/admin.hbs).
 * Kept separate from resources/stores/global-settings-store.js, which stays a dumb read-write layer
 * agnostic of any UI concerns.
 */

// Rendered as Bootstrap switches. Order here controls display order within the shared section.
const BOOLEAN_KEYS = ['enableEditing', 'debugLogging', 'hideShortcuts'];

// Never rendered in the admin UI at all (left untouched in the file).
const EXCLUDED_KEYS = ['showCloneButton'];

// Rendered as a <select> of valid verticals.
const VERTICAL_KEYS = ['activeVertical'];

// Rendered as a <select>, currently widget/oidc, built to support additional auth methods later.
const SELECT_KEYS = ['authnMethod'];
const SELECT_OPTIONS = {
  authnMethod: [
    { value: 'widget', label: 'DaVinci Widget' },
    { value: 'oidc', label: 'OIDC Redirect' },
  ],
};

// Keys only relevant when authnMethod is "oidc" (see config/bxi.oidc.json)
const OIDC_GROUP_KEYS = ['oidc.redirectIssuer', 'oidc.redirectClientId'];

// Keys relevant to DaVinci widget flows - these are used regardless of authnMethod (e.g. clone,
// dashboard, profile/password/device management flows all go through the widget even in OIDC mode)
// other than authnButtons, which only renders when authnMethod is "widget" (see config/bxi.widget.json)
const WIDGET_GROUP_KEYS = [
  'widget.apiUrl',
  'widget.dvJsUrl',
  'widget.sdkTokenUrl',
  'widget.apiKey',
  'widget.companyId',
  'widget.dashboardPolicyId',
  'widget.genericPolicyId',
  'widget.clonePolicyId',
  'widget.cloneEnvironment',
];

// Rendered as a repeatable label/policyId row editor.
const ARRAY_PAIR_KEYS = ['widget.authnButtons', 'widget.dashboardTabs'];
const ARRAY_PAIR_ITEM_LABELS = {
  'widget.authnButtons': { label: 'Button Text', policyId: 'Policy ID' },
  'widget.dashboardTabs': { label: 'Button Text', policyId: 'Policy ID' },
};

// Rendered as a masked password input with a reveal toggle. Explicit opt-in list rather than a
// pattern match, so it's obvious at a glance which keys are treated as sensitive.
const SECRET_KEYS = ['widget.apiKey'];

// All keys the admin page knows how to render/edit.
const KNOWN_KEYS = [
  ...BOOLEAN_KEYS,
  ...VERTICAL_KEYS,
  ...SELECT_KEYS,
  ...WIDGET_GROUP_KEYS,
  ...ARRAY_PAIR_KEYS,
  ...OIDC_GROUP_KEYS,
].filter((key) => !EXCLUDED_KEYS.includes(key));

// Friendlier display labels for the admin UI. Falls back to the raw key name if not listed here.
const FRIENDLY_NAMES = {
  enableEditing: 'Enable Settings Editing',
  debugLogging: 'Debug Logging',
  hideShortcuts: 'Hide Shortcuts Link',
  activeVertical: 'Active Vertical',
  authnMethod: 'Authentication Method',
  'widget.apiUrl': 'API URL',
  'widget.dvJsUrl': 'DaVinci JS URL',
  'widget.sdkTokenUrl': 'SDK Token URL',
  'widget.apiKey': 'API Key',
  'widget.companyId': 'Company (Environment) ID',
  'widget.dashboardPolicyId': 'Dashboard Policy ID',
  'widget.genericPolicyId': 'Generic Policy ID',
  'widget.clonePolicyId': 'Clone Policy ID',
  'widget.cloneEnvironment': 'Clone Environment ID',
  'widget.authnButtons': 'Login/Registration Buttons',
  'widget.dashboardTabs': 'Dashboard Buttons',
  'oidc.redirectIssuer': 'OIDC Issuer URL',
  'oidc.redirectClientId': 'OIDC Client ID',
};

/**
 * Builds the view-model list of fields for the admin page, given the current global settings and
 * the list of valid verticals.
 *
 * @param {Object} settings result of globalSettingsStore.get()
 * @param {string[]} verticals result of helpers.getVerticals()
 * @returns {{shared: Array, widget: Array, oidc: Array}}
 */
function buildFieldGroups(settings, verticals) {
  const fields = KNOWN_KEYS.map((key) =>
    buildField(key, getAtPath(settings, key), verticals)
  );

  return {
    shared: fields.filter(
      (field) =>
        !WIDGET_GROUP_KEYS.includes(field.key) &&
        !ARRAY_PAIR_KEYS.includes(field.key) &&
        !OIDC_GROUP_KEYS.includes(field.key)
    ),
    widget: fields.filter(
      (field) =>
        WIDGET_GROUP_KEYS.includes(field.key) ||
        ARRAY_PAIR_KEYS.includes(field.key)
    ),
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

  if (SELECT_KEYS.includes(key)) {
    return {
      key,
      label,
      type: 'select',
      value,
      options: (SELECT_OPTIONS[key] || []).map((option) => ({
        value: option.value,
        label: option.label,
        selected: option.value === value,
      })),
    };
  }

  if (BOOLEAN_KEYS.includes(key)) {
    return { key, label, type: 'boolean', value, checked: value === true };
  }

  if (SECRET_KEYS.includes(key)) {
    return { key, label, type: 'secret', value };
  }

  if (ARRAY_PAIR_KEYS.includes(key)) {
    const itemLabels = ARRAY_PAIR_ITEM_LABELS[key] || {
      label: 'Label',
      policyId: 'Policy ID',
    };
    return {
      key,
      label,
      type: 'array-pairs',
      labelFieldLabel: itemLabels.label,
      policyIdFieldLabel: itemLabels.policyId,
      value: Array.isArray(value) ? value : [],
    };
  }

  return { key, label, type: 'string', value };
}

/**
 * Reads a dot-separated path out of a nested object, returning undefined if any segment is missing.
 *
 * @param {Object} obj
 * @param {string} jsonPath
 * @returns {*}
 */
function getAtPath(obj, jsonPath) {
  return jsonPath
    .split('.')
    .reduce((ref, key) => (ref == null ? undefined : ref[key]), obj);
}

/**
 * Validates a proposed update to a single key, returning an error message string if invalid,
 * or null if the value is acceptable.
 *
 * @param {string} key
 * @param {*} value
 * @param {string[]} verticals result of helpers.getVerticals()
 * @returns {string|null}
 */
function validateFieldValue(key, value, verticals) {
  if (EXCLUDED_KEYS.includes(key)) {
    return `${key} cannot be edited from this page`;
  }

  if (!KNOWN_KEYS.includes(key)) {
    return `Unknown setting: ${key}`;
  }

  if (BOOLEAN_KEYS.includes(key) && typeof value !== 'boolean') {
    return `${key} must be a boolean`;
  }

  if (VERTICAL_KEYS.includes(key) && !verticals.includes(value)) {
    return `${key} must be one of: ${verticals.join(', ')}`;
  }

  if (
    SELECT_KEYS.includes(key) &&
    !(SELECT_OPTIONS[key] || []).some((option) => option.value === value)
  ) {
    return `${key} must be one of: ${(SELECT_OPTIONS[key] || [])
      .map((option) => option.value)
      .join(', ')}`;
  }

  if (ARRAY_PAIR_KEYS.includes(key)) {
    if (!Array.isArray(value)) {
      return `${key} must be an array`;
    }

    const hasInvalidItem = value.some(
      (item) =>
        typeof item !== 'object' ||
        item === null ||
        typeof item.label !== 'string' ||
        typeof item.policyId !== 'string'
    );

    if (hasInvalidItem) {
      return `${key} items must each have a "label" and "policyId" string`;
    }
  }

  return null;
}

export default {
  BOOLEAN_KEYS,
  VERTICAL_KEYS,
  SELECT_KEYS,
  SELECT_OPTIONS,
  EXCLUDED_KEYS,
  SECRET_KEYS,
  ARRAY_PAIR_KEYS,
  OIDC_GROUP_KEYS,
  WIDGET_GROUP_KEYS,
  KNOWN_KEYS,
  FRIENDLY_NAMES,
  buildFieldGroups,
  validateFieldValue,
};
