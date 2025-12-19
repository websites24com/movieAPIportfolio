// src/utils/filters.js
// Build filter conditions based on query params:
// - minRating / maxRating  → vote_average
// - year                   → YEAR(release_date)
// - language               → original_language

function getFilters(query) {
  const conditions = [];
  const params = [];

  // minRating → vote_average >= ?
  if (query.minRating) {
    const min = parseFloat(query.minRating);
    if (!Number.isNaN(min)) {
      conditions.push('vote_average >= ?');
      params.push(min);
    }
  }

  // maxRating → vote_average <= ?
  if (query.maxRating) {
    const max = parseFloat(query.maxRating);
    if (!Number.isNaN(max)) {
      conditions.push('vote_average <= ?');
      params.push(max);
    }
  }

  // year → YEAR(release_date) = ?
  if (query.year) {
    const year = parseInt(query.year, 10);
    if (!Number.isNaN(year)) {
      conditions.push('YEAR(release_date) = ?');
      params.push(year);
    }
  }

  // from year

  if (query.fromYear) {
    const fromYear = parseInt(query.fromYear, 10);
    if (!Number.isNaN(fromYear)) {
      conditions.push('YEAR(release_date) >= ?');
      params.push(fromYear);
    }
  }

  // from year

  if (query.toYear) {
    const toYear = parseInt(query.toYear, 10);
    if (!Number.isNaN(toYear)) {
      conditions.push('YEAR(release_date) <= ?');
      params.push(toYear);
    }
  }



  // language → original_language = ?
  if (query.language) {
    const lang = query.language.trim();
    if (lang) {
      conditions.push('original_language = ?');
      params.push(lang);
    }
  }

  return { conditions, params };
}

module.exports = { getFilters };
