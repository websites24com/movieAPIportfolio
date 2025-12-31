(function () {
  const form = document.getElementById('reset-form');
  const errorBox = document.getElementById('error');
  const okBox = document.getElementById('ok');
  const token = String(document.getElementById('resetToken')?.value || '').trim();

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

    if (!token) {
      setError('Reset token is missing. Please use the email link again.');
      return;
    }

    const newPassword = String(form.elements.newPassword?.value || '').trim();
    const newPasswordConfirm = String(form.elements.newPasswordConfirm?.value || '').trim();

    if (!newPassword) {
      setError('Please provide a new password.');
      return;
    }

    if (!newPasswordConfirm) {
      setError('Please confirm your password.');
      return;
    }

    if (newPassword !== newPasswordConfirm) {
      setError('Passwords do not match.');
      return;
    }

    try {
      const res = await csrfFetch(
        `/api/v1/auth/reset-password/${encodeURIComponent(token)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newPassword, newPasswordConfirm })
        }
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = data?.message || data?.error?.message || `Reset failed (${res.status})`;
        throw new Error(msg);
      }

      setOk('Password reset successful. Redirecting…');

      setTimeout(() => {
        window.location.assign('/login');
      }, 800);
    } catch (err) {
      setError(err && err.message ? err.message : 'Reset failed.');
    }
  });
})();
