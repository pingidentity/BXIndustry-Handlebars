// Client-side logic for src/pages/admin.hbs - the config/bxi.json editor admin page.
import { getCsrfToken } from '/js/csrf.js';

// Bootstrap tooltips require manual init (same pattern used in edit-drawer.js)
Array.from(document.querySelectorAll('[data-bs-toggle="tooltip"]')).forEach(
  (tooltipTriggerEl) => new bootstrap.Tooltip(tooltipTriggerEl)
);

const form = document.getElementById('admin-env-form');
const saveButton = document.getElementById('save-button');
const saveStatus = document.getElementById('save-status');
const widgetGroup = document.getElementById('widget-group');
const oidcGroup = document.getElementById('oidc-group');

function currentValue(input) {
  if (input.type === 'checkbox') {
    return input.checked;
  }
  return input.value;
}

function isDirty(input) {
  return String(currentValue(input)) !== input.dataset.originalValue;
}

function arrayFieldValue(fieldEl) {
  return Array.from(fieldEl.querySelectorAll('.admin-array-row')).map(
    (row) => ({
      label: row.querySelector('.admin-array-label').value,
      policyId: row.querySelector('.admin-array-policy-id').value,
    })
  );
}

function isArrayFieldDirty(fieldEl) {
  return (
    JSON.stringify(arrayFieldValue(fieldEl)) !== fieldEl.dataset.originalValue
  );
}

function updateSaveButtonState() {
  const inputs = Array.from(form.querySelectorAll('.admin-env-input'));
  const arrayFields = Array.from(form.querySelectorAll('.admin-array-field'));
  saveButton.disabled =
    !inputs.some(isDirty) && !arrayFields.some(isArrayFieldDirty);
}

form.addEventListener('input', (event) => {
  if (!event.target.classList.contains('admin-env-input')) {
    return;
  }

  // authnMethod controls which group of fields is relevant - toggle visibility client-side
  // immediately (before saving), without ever clearing/discarding the hidden group's values.
  if (event.target.dataset.key === 'authnMethod') {
    const useRedirect = event.target.value === 'oidc';
    widgetGroup.hidden = useRedirect;
    oidcGroup.hidden = !useRedirect;
  }

  updateSaveButtonState();
});

form.querySelectorAll('.admin-env-reveal').forEach((button) => {
  button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.target);
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    button.textContent = showing ? 'Show' : 'Hide';
  });
});

function createArrayRow(label = '', policyId = '') {
  const row = document.createElement('div');
  row.className = 'row g-2 mb-2 admin-array-row align-items-center';
  row.innerHTML = `
    <div class="col-5">
      <input type="text" class="form-control form-control-sm admin-array-label" value="${label}">
    </div>
    <div class="col-5">
      <input type="text" class="form-control form-control-sm admin-array-policy-id" value="${policyId}">
    </div>
    <div class="col-2">
      <button type="button" class="btn btn-sm btn-outline-danger admin-array-remove-row">Remove</button>
    </div>
  `;
  return row;
}

form.querySelectorAll('.admin-array-field').forEach((fieldEl) => {
  const rowsContainer = fieldEl.querySelector('.admin-array-rows');

  fieldEl
    .querySelector('.admin-array-add-row')
    .addEventListener('click', () => {
      rowsContainer.appendChild(createArrayRow());
      updateSaveButtonState();
    });

  rowsContainer.addEventListener('click', (event) => {
    if (event.target.classList.contains('admin-array-remove-row')) {
      event.target.closest('.admin-array-row').remove();
      updateSaveButtonState();
    }
  });

  rowsContainer.addEventListener('input', updateSaveButtonState);
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const inputs = Array.from(form.querySelectorAll('.admin-env-input'));
  const arrayFields = Array.from(form.querySelectorAll('.admin-array-field'));
  const updates = {};

  inputs.filter(isDirty).forEach((input) => {
    updates[input.dataset.key] = currentValue(input);
  });

  arrayFields.filter(isArrayFieldDirty).forEach((fieldEl) => {
    updates[fieldEl.dataset.key] = arrayFieldValue(fieldEl);
  });

  if (Object.keys(updates).length === 0) {
    return;
  }

  const csrfToken = await getCsrfToken();

  const response = await fetch('/admin/settings', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify({ updates }),
  });

  if (!response.ok) {
    const message = await response.text();
    alert(`Failed to save: ${message}`);
    return;
  }

  const { restartRequired } = await response.json();

  inputs.forEach((input) => {
    input.dataset.originalValue = String(currentValue(input));
  });

  arrayFields.forEach((fieldEl) => {
    fieldEl.dataset.originalValue = JSON.stringify(arrayFieldValue(fieldEl));
  });

  updateSaveButtonState();

  saveStatus.textContent = restartRequired
    ? 'Changes successfully saved! The API Key is stored in .env and requires a server restart to take effect.'
    : 'Changes successfully saved!';
  saveStatus.classList.remove('d-none');
  setTimeout(() => saveStatus.classList.add('d-none'), 6000);
});
