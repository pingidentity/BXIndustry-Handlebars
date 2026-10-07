// Client-side logic for src/pages/admin.hbs - the .env editor admin page.
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
    return input.checked ? 'true' : 'false';
  }
  return input.value;
}

function isDirty(input) {
  return currentValue(input) !== input.dataset.originalValue;
}

function updateSaveButtonState() {
  const inputs = Array.from(form.querySelectorAll('.admin-env-input'));
  saveButton.disabled = !inputs.some(isDirty);
}

form.addEventListener('input', (event) => {
  if (!event.target.classList.contains('admin-env-input')) {
    return;
  }

  // BXI_USE_REDIRECT controls which group of fields is relevant - toggle visibility client-side
  // immediately (before saving), without ever clearing/discarding the hidden group's values.
  if (event.target.dataset.key === 'BXI_USE_REDIRECT') {
    const useRedirect = event.target.checked;
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

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const inputs = Array.from(form.querySelectorAll('.admin-env-input'));
  const updates = {};

  inputs.filter(isDirty).forEach((input) => {
    updates[input.dataset.key] = currentValue(input);
  });

  if (Object.keys(updates).length === 0) {
    return;
  }

  const csrfToken = await getCsrfToken();

  const response = await fetch('/admin/env', {
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

  inputs.forEach((input) => {
    input.dataset.originalValue = currentValue(input);
  });

  updateSaveButtonState();

  saveStatus.classList.remove('d-none');
  setTimeout(() => saveStatus.classList.add('d-none'), 6000);
});
