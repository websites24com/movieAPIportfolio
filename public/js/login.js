(function () {
  const form = document.getElementById('login-form');

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
  // GOOGLE CALLBACK (SAME STYLE AS REGISTER)
  // -------------------------
  // Google calls this by name from: data-callback="onGoogleCredential"
  window.onGoogleCredential = async function onGoogleCredential(response) {
    try {
      setError('');
      setGoogleError('');

      const credential = response && response.credential;
      if (!credential) {
        setGoogleError('Google login failed: missing credential.');
        return;
      }

      const res = await csrfFetch('/api/v1/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = data?.message || data?.error?.message || `Google auth failed (${res.status})`;
        throw new Error(msg);
      }

      window.location.assign('/');
    } catch (err) {
      setGoogleError(err && err.message ? err.message : 'Google login failed');
    }
  };

  // -------------------------
  // LOCAL LOGIN
  // -------------------------
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setError('');
    setGoogleError('');

    const email = getValue(form, 'email').trim().toLowerCase();
    const password = getValue(form, 'password');

    if (!email || !password) {
      setError('Please provide email and password.');
      return;
    }

    try {
      const res = await csrfFetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = data?.message || data?.error?.message || `Login failed (${res.status})`;
        throw new Error(msg);
      }

      window.location.assign('/');
    } catch (err) {
      setError(err && err.message ? err.message : 'Login failed.');
    }
  });
})();
