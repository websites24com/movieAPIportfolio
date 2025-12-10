// src/utils/pagination.js
const AppError = require('./appError');

function getPagination(query) {
  const page = query.page ? parseInt(query.page, 10) : 1;
  const limit = query.limit ? parseInt(query.limit, 10) : 20;

  if (Number.isNaN(page) || Number.isNaN(limit) || page < 1 || limit < 1) {
    throw new AppError('Invalid page or limit parameter', 400);
  }

  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

module.exports = { getPagination };
