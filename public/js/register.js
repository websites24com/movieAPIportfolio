(function () {
  const form = document.getElementById('register-form');
  const errorBox = document.getElementById('error');

  function setError(msg) {
    if (errorBox) errorBox.textContent = msg || '';
  }

  // Read csrfToken cookie
  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setError('');

    const name = String(form.name?.value || '').trim();
    const email = String(form.email?.value || '').trim();
    const password = String(form.password?.value || '');

    if (!name || !email || !password) {
      setError('Please provide name, email and password.');
      return;
    }

    const csrfToken = getCookie('csrfToken');

    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        credentials: 'same-origin', // ✅ consistent cookie behavior
        headers: {
          'Content-Type': 'application/json',
          // ✅ CSRF protection
          'x-csrf-token': csrfToken || ''
        },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = (data && data.message) ? data.message : `Register failed (${res.status})`;
        throw new Error(msg);
      }

      // Cookie is set by backend. Go to a real page:
      window.location.assign('/');

    } catch (err) {
      setError(err.message || 'Register failed.');
    }
  });
})();
