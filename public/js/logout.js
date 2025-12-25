(function () {
  const btn = document.getElementById('logout-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const res = await fetch('/api/v1/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'x-csrf-token': csrfToken || ''
      }
    });

    // If logout fails, don't pretend it worked
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(`Logout failed (${res.status}) ${data?.message || ''}`);
      return;
    }

    // Go to a view route
    window.location.assign('/');
  });
})();
