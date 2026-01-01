// src/utils/paginateQuery.js
// ======================================================
// Reusable DB pagination helper for EJS pages AND APIs.
//
// You provide the SQL; this helper only:
// - validates page/limit (via getPagination)
// - runs baseSql with LIMIT/OFFSET
// - runs countSql to get total
// - returns rows + meta (including hasNext/hasPrev)
//
// IMPORTANT RULES:
// - baseSql: your full SELECT (with JOIN/WHERE/ORDER BY if needed)
// - countSql: must return a single row with COUNT(*) AS total
// - params: placeholders for BOTH queries (same WHERE/JOIN params)
// ======================================================

const AppError = require('./appError');
const { getPagination } = require('./pagination');

async function paginateQuery({ reqQuery, db, baseSql, countSql, params = [] }) {
  if (!db) throw new AppError('paginateQuery: db is required', 500);
  if (!baseSql) throw new AppError('paginateQuery: baseSql is required', 500);
  if (!countSql) throw new AppError('paginateQuery: countSql is required', 500);

  // 1) Read + validate page/limit, compute offset
  const { page, limit, offset } = getPagination(reqQuery || {});

  // 2) Get paginated rows
  const [rows] = await db.query(
    `${baseSql} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  // 3) Get total rows
  const [countRows] = await db.query(countSql, params);
  const total = Number(countRows?.[0]?.total || 0);
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  // 4) Prev / Next helpers for the view
  const hasPrev = page > 1 && totalPages > 0;
  const hasNext = totalPages > 0 && page < totalPages;

  const prevPage = hasPrev ? page - 1 : null;
  const nextPage = hasNext ? page + 1 : null;

  // 5) Helpful range text: "showing X–Y of Z"
  // Use rows.length for "to" because last page may be shorter than limit.
  const from = total === 0 ? 0 : offset + 1;
  const to = total === 0 ? 0 : Math.min(offset + rows.length, total);

  return {
    rows,
    meta: {
      page,
      limit,
      offset,
      total,
      totalPages,
      hasPrev,
      hasNext,
      prevPage,
      nextPage,
      from,
      to,
    },
  };
}

module.exports = { paginateQuery };
