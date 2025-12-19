// src/utils/sort.js
// ======================================
// Builds ORDER BY clause based on query params
// Sorting is optional and global for all list points
// ======================================

// /movies?sort=popularity&order=desc


function getSort(query, options = {}) {
    // Allowed columns to sort by (WHITELIST -> prevents SQL injection)
    const allowedFields = options.allowedFields || [
        'title',
        'release_date',
        'popularity',
        'vote_average',
        'vote_count'
    ];


// Default sorting

const defaultSort = options.defaultSort || 'title';
const defaultOrder = options.defaultOrder || 'ASC'

let sort = query.sort;
let order = query.order;

// Validate sort field

if (!allowedFields.includes(sort)) {
    sort = defaultSort;
}

order = order && order.toUpperCase() === 'DESC' ? 'DESC' : defaultOrder;

const orderByClause = `ORDER BY ${sort} ${order}`;

return orderByClause

}

module.exports = { getSort}