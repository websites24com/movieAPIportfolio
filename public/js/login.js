(function () {
  const form = document.getElementById('login-form');
  const errorBox = document.getElementById('error');

  function setError(msg) {
    if (errorBox) errorBox.textContent = msg || '';
  }

  // Read csrfToken cookie (set by ensureCsrfCookie with httpOnly: false)
  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }

  // Local login via fetch (prevents browser navigation to API -> prevents JSON page)
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      setError('');

      const email = String(form.email?.value || '').trim();
      const password = String(form.password?.value || '');

      if (!email || !password) {
        setError('Please provide email and password.');
        return;
      }

      const csrfToken = getCookie('csrfToken');

      try {
        const res = await fetch('/api/v1/auth/login', {
          method: 'POST',
          credentials: 'same-origin', // ✅ ensures cookies are included/received consistently
          headers: {
            'Content-Type': 'application/json',
            // ✅ CSRF: echo cookie token back to server
            'x-csrf-token': csrfToken || ''
          },
          body: JSON.stringify({ email, password })
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          const msg = (data && data.message) ? data.message : `Login failed (${res.status})`;
          throw new Error(msg);
        }

        // Redirect to VIEW route
        window.location.assign('/');

      } catch (err) {
        setError(err.message || 'Login failed.');
      }
    });
  }

  // Google login (kept working with your Helmet COOP fix)
  window.addEventListener('load', () => {
    const btn = document.getElementById('google-button');
    if (!btn) return;

    if (!window.google || !google.accounts || !google.accounts.id) return;

    const meta = document.querySelector('meta[name="google-client-id"]');
    const clientId = meta ? meta.getAttribute('content') : '';

    if (!clientId) {
      setError('Missing GOOGLE_CLIENT_ID on page.');
      return;
    }

    google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response) => {
        setError('');

        if (!response || !response.credential) {
          setError('Google login failed.');
          return;
        }

        const csrfToken = getCookie('csrfToken');

        try {
          const res = await fetch('/api/v1/auth/google', {
            method: 'POST',
            credentials: 'same-origin', // ✅ same here
            headers: {
              'Content-Type': 'application/json',
              // ✅ CSRF for /google too (since it sets jwt cookie)
              'x-csrf-token': csrfToken || ''
            },
            body: JSON.stringify({ credential: response.credential })
          });

          const data = await res.json().catch(() => null);

          if (!res.ok) {
            const msg = (data && data.message) ? data.message : `Google auth failed (${res.status})`;
            throw new Error(msg);
          }

          window.location.assign('/');

        } catch (err) {
          setError(err.message || 'Google login failed.');
        }
      }
    });

    google.accounts.id.renderButton(btn, { theme: 'outline', size: 'large' });
  });
})();
