(function () {
  const form = document.getElementById('reset-form');
  const errorBox = document.getElementById('error');
  const okBox = document.getElementById('ok');

  if (!form) return;

  const token = document.getElementById('resetToken')?.value?.trim();

  function setError(msg) {
    errorBox.textContent = msg || '';
    okBox.textContent = '';
  }

  function setOk(msg) {
    okBox.textContent = msg || '';
    errorBox.textContent = '';
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    if (!token) {
      setError('Reset token is missing. Please use the email link again.');
      return;
    }

    const newPassword = form.newPassword.value.trim();
    const newPasswordConfirm = form.newPasswordConfirm.value.trim();

    if (!newPassword) return setError('Please provide a new password.');
    if (!newPasswordConfirm) return setError('Please confirm your password.');
    if (newPassword !== newPasswordConfirm)
      return setError('Passwords do not match.');

    try {
      const res = await fetch(`/api/v1/auth/reset-password/${encodeURIComponent(token)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword, newPasswordConfirm })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || 'Reset failed');
      }

      setOk('Password reset successful. Redirecting…');

      setTimeout(() => {
        window.location.href = '/';
      }, 800);

    } catch (err) {
      setError(err.message);
    }
  });
})();
