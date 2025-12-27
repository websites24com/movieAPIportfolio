(function () {
  const form = document.getElementById('register-form');

  const errorBox = document.getElementById('error');
  const googleErrorBox = document.getElementById('google-error');

  function setError(msg) {
    if (errorBox) errorBox.textContent = msg || '';
  }

  function setGoogleError(msg) {
    if (googleErrorBox) googleErrorBox.textContent = msg || '';
  }

  function getValue(formEl, fieldName) {
    const el = formEl.elements && formEl.elements[fieldName];
    return el ? String(el.value || '') : '';
  }

  // -------------------------
  // GOOGLE CALLBACK (GLOBAL)
  // -------------------------
  // IMPORTANT:
  // Google calls this by name from data-callback="onGoogleCredential".
  // It MUST be a global function.
  window.onGoogleCredential = async function onGoogleCredential(response) {
    try {
      setError('');
      setGoogleError('');

      const credential = response && response.credential;
      if (!credential) {
        setGoogleError('Google sign-in failed: missing credential.');
        return;
      }

      const res = await csrfFetch('/api/v1/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = data?.message || data?.error?.message || 'Google login failed';
        throw new Error(msg);
      }

      window.location.assign('/');
    } catch (err) {
      setGoogleError(err && err.message ? err.message : 'Google login failed');
    }
  };

  // -------------------------
  // LOCAL REGISTER
  // -------------------------
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setError('');
    setGoogleError('');

    const name = getValue(form, 'name').trim();
    const email = getValue(form, 'email').trim().toLowerCase();
    const password = getValue(form, 'password');
    const passwordConfirm = getValue(form, 'passwordConfirm');

    if (!name || !email || !password || !passwordConfirm) {
      setError('All fields are required.');
      return;
    }

    if (password !== passwordConfirm) {
      setError('Passwords do not match.');
      return;
    }

    try {
      const res = await csrfFetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = data?.message || data?.error?.message || 'Registration failed';
        throw new Error(msg);
      }

      window.location.assign('/');
    } catch (err) {
      setError(err && err.message ? err.message : 'Something went wrong');
    }
  });
})();
