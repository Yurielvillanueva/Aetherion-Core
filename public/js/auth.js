async function handleAuthForm(event) {
  event.preventDefault();
  const form = event.target;
  const data = new FormData(form);
  const payload = Object.fromEntries(data.entries());
  const action = form.id === 'login-form' ? 'login' : 'signup';
  const errorElement = form.querySelector('.form-error');

  try {
    const response = await fetch('/api/auth/' + action, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await response.json();
    if (!json.success) {
      errorElement.textContent = json.error || 'Unable to authenticate';
      return;
    }
    if (json.user && json.user.role === 'admin') {
      window.location.href = '/admin';
    } else {
      window.location.href = '/';
    }
  } catch (err) {
    errorElement.textContent = 'Server error. Try again later.';
  }
}

const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
if (loginForm) loginForm.addEventListener('submit', handleAuthForm);
if (signupForm) signupForm.addEventListener('submit', handleAuthForm);
