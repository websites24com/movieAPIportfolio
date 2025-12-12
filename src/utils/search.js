// src/utils/search.js
// Build search conditions for movies.
// Currently: search by title + original_title (starts with search string).

function getSearch(query) {
  const search = query.search ? query.search.trim() : '';

  const conditions = [];
  const params = [];

  if (search) {
    // You can simplify to "title LIKE ?" if you want only title.
    conditions.push('(title LIKE ?)');
    params.push(`${search}%`); // "starts with"
  }

  return { conditions, params, search };
}

module.exports = { getSearch };
