(function () {
  const form = document.getElementById('forgot-form');
  const errorBox = document.getElementById('error');
  const okBox = document.getElementById('ok');

  function setError(msg) {
    if (errorBox) errorBox.textContent = msg || '';
    if (okBox) okBox.textContent = '';
  }

  function setOk(msg) {
    if (okBox) okBox.textContent = msg || '';
    if (errorBox) errorBox.textContent = '';
  }

  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    setError('');
    setOk('');

    const email = String(form.elements.email?.value || '').trim().toLowerCase();

    if (!email) {
      setError('Please provide your email.');
      return;
    }

    try {
      // IMPORTANT: csrfFetch adds the x-csrf-token header automatically
      const res = await csrfFetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = data?.message || data?.error?.message || `Request failed (${res.status})`;
        throw new Error(msg);
      }

      const successMessage =
        data?.data?.message ||
        data?.message ||
        'If that email exists, a reset link has been sent.';

      setOk(successMessage);
    } catch (err) {
      setError(err && err.message ? err.message : 'Request failed.');
    }
  });
})();
