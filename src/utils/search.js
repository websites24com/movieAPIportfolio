// src/utils/movieQueryHelpers.js

// Builds WHERE clause + params for movie search
// Currently only: search by title (starts with)
function buildMovieSearchClause(query) {
  const search = query.search ? query.search.trim() : '';

  let whereClause = '';
  const params = [];

  if (search) {
    whereClause = 'WHERE title LIKE ?';
    params.push(`${search}%`);        // "starts with" behaviour
  }

  return { whereClause, params, search };
}

module.exports = { buildMovieSearchClause };
