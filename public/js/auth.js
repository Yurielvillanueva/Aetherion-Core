async function handleAuthForm(event) {
  event.preventDefault();
  const form = event.target;
  const data = new FormData(form);
  const payload = Object.fromEntries(data.entries());
  const action = form.id === 'login-form' ? 'login' : 'signup';
  const errorElement = form.querySelector('.form-error');
  const configuredBase = typeof window.AETHERION_CONFIG?.apiBaseUrl === 'string'
    ? window.AETHERION_CONFIG.apiBaseUrl.trim().replace(/\/+$/, '')
    : '';
  const endpoint = configuredBase
    ? `${configuredBase}/api/auth/${action}`
    : `/api/auth/${action}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (parseErr) {
      json = null;
    }

    if (!response.ok || !json?.success) {
      errorElement.textContent = json?.error || `Unable to authenticate (HTTP ${response.status})`;
      return;
    }
    if (json.user && json.user.role === 'admin') {
      window.location.href = '/admin';
    } else {
      window.location.href = '/';
    }
  } catch (err) {
    errorElement.textContent = 'Cannot reach auth server. Check API URL/CORS and try again.';
  }
}

const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
if (loginForm) loginForm.addEventListener('submit', handleAuthForm);
if (signupForm) signupForm.addEventListener('submit', handleAuthForm);
