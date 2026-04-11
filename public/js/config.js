window.AETHERION_CONFIG = window.AETHERION_CONFIG || {};

function normalizeApiBase(url) {
  return typeof url === 'string' ? url.trim().replace(/\/+$/, '') : '';
}

const storedApiBase = normalizeApiBase(window.localStorage.getItem('AETHERION_API_BASE_URL') || '');
const configuredApiBase = normalizeApiBase(window.AETHERION_CONFIG.apiBaseUrl || 'https://running-principles-titled-rays.trycloudflare.com');
const apiBaseUrl = configuredApiBase || storedApiBase;

window.AETHERION_CONFIG.apiBaseUrl = apiBaseUrl;

window.setApiBaseUrl = function setApiBaseUrl(url) {
  const normalized = normalizeApiBase(url);
  if (!normalized) {
    window.localStorage.removeItem('AETHERION_API_BASE_URL');
  } else {
    window.localStorage.setItem('AETHERION_API_BASE_URL', normalized);
  }
  window.location.reload();
};

const isWorkersDeployment = /\.workers\.dev$/i.test(window.location.hostname);
if (isWorkersDeployment && !apiBaseUrl) {
  console.warn('[Aetherion] API base URL is not configured. Set one in public/js/config.js or call setApiBaseUrl("https://your-api-domain.com") in browser console.');
}

const nativeFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  let resolvedInput = input;
  const isStringInput = typeof input === 'string';
  const isApiPath = isStringInput && input.startsWith('/api/');

  if (apiBaseUrl && isApiPath) {
    resolvedInput = `${apiBaseUrl}${input}`;
  }

  if (isApiPath && !Object.prototype.hasOwnProperty.call(init, 'credentials')) {
    init = { ...init, credentials: 'include' };
  }

  return nativeFetch(resolvedInput, init);
};
