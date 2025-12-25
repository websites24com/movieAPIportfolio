(function () {
  const form = document.getElementById('forgot-form');
  const errorBox = document.getElementById('error');
  const okBox = document.getElementById('ok');

  if (!form) return;

  // Make sure browser validation never blocks JS
  form.setAttribute('novalidate', 'novalidate');

  function setError(msg) {
    if (!errorBox) return;
    errorBox.textContent = msg || '';
  }

  function setOk(msg) {
    if (!okBox) return;
    okBox.textContent = msg || '';
  }

  // Catch native HTML validation (required / type=email)
  form.addEventListener(
    'invalid',
    function (e) {
      e.preventDefault();
      setOk('');

      if (e.target && e.target.name === 'email') {
        const value = String(e.target.value || '').trim();
        if (!value) {
          setError('Please provide your email.');
        } else {
          setError('Please provide a valid email address.');
        }
      }
    },
    true // capture phase is important
  );

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    setError('');
    setOk('');

    const emailInput = form.elements.namedItem('email');
    const email = String(emailInput?.value || '').trim();

    // FRONTEND validation — this is YOUR message
    if (!email) {
      setError('Please provide your email.');
      return;
    }

    try {
      const res = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const contentType = res.headers.get('content-type') || '';
      let data = null;
      let text = '';

      if (contentType.includes('application/json')) {
        data = await res.json().catch(() => null);
      } else {
        text = await res.text().catch(() => '');
      }

      if (!res.ok) {
        const msg =
          (data && (data.message || data.error || data?.data?.message)) ||
          text ||
          `Request failed (${res.status})`;
        throw new Error(msg);
      }

      // SUCCESS MESSAGE (server preferred, fallback otherwise)
      const successMessage =
        (data && (data.data?.message || data.message)) ||
        'If that email exists, a reset link has been sent.';

      setOk(successMessage);

    } catch (err) {
      setError(err?.message || 'Request failed.');
    }
  });
})();
