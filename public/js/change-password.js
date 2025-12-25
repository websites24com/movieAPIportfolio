(function () {
  const form = document.getElementById('change-form');
  if (!form) return;

  const errorEl = document.getElementById('error');
  const okEl = document.getElementById('ok');

  function setError(msg) {
    if (okEl) okEl.textContent = '';
    if (errorEl) errorEl.textContent = msg || 'Something went wrong.';
  }

  function setOk(msg) {
    if (errorEl) errorEl.textContent = '';
    if (okEl) okEl.textContent = msg || 'OK';
  }

  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const currentPassword = document.getElementById('currentPassword')?.value || '';
    const newPassword = document.getElementById('newPassword')?.value || '';
    const newPasswordConfirm = document.getElementById('newPasswordConfirm')?.value || '';

    // basic client check
    if (!currentPassword || !newPassword || !newPasswordConfirm) {
      setError('Please fill in all fields.');
      return;
    }

    if (newPassword !== newPasswordConfirm) {
      setError('New password and confirmation do not match.');
      return;
    }

    const csrfToken = getCookie('csrfToken');

    try {
      const res = await fetch('/api/v1/auth/change-password', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          // ✅ CSRF protection
          'x-csrf-token': csrfToken || ''
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          newPasswordConfirm
        })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.message || `Change password failed (${res.status})`);
        return;
      }

      setOk(data?.message || 'Password changed successfully.');

      // optional: clear fields
      form.reset();
    } catch (err) {
      setError('Network error. Please try again.');
    }
  });
})();
