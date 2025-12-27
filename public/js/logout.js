(function () {
  const btn = document.getElementById('logout-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    try {
      const res = await csrfFetch('/api/v1/auth/logout', {
        method: 'POST'
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        console.error('Logout failed:', res.status, data);
        return;
      }

      console.log('Logout successful');
      window.location.assign('/');
    } catch (err) {
      console.error('Logout error:', err);
    }
  });
})();
