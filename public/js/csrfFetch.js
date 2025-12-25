(function () {
  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : '';
  }

  window.csrfFetch = function csrfFetch(url, options = {}) {
    const csrfToken = getCookie('csrfToken');

    const headers = Object.assign({}, options.headers || {}, {
      'x-csrf-token': csrfToken
    });

    return fetch(url, Object.assign({}, options, {
      credentials: 'same-origin',
      headers
    }));
  };
})();
