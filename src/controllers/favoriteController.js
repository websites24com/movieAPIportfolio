// src/controllers/favoriteController.js
//
// Favorites = relationship between the logged-in user and movies.
// Table: favorite_movies(user_id, movie_id, created_at)
//
// This controller is API-only (JSON responses).

const db = require('../config/db');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { paginateQuery } = require('../utils/paginateQuery');


/**
 * GET /api/v1/favorites
 * Return the current user's favorite movies (joined with movies table).
 * Protected by router.use(auth.protect).
 */
exports.getMyFavorites = catchAsync(async (req, res, next) => {
  const userId = req.user && req.user.id;
  if (!userId) return next(new AppError('Not authenticated', 401));

  // Newest first; returns movie fields + favorited timestamp
  const [rows] = await db.query(
    `SELECT
       m.id,
       m.title,
       m.original_title,
       m.overview,
       m.release_date,
       m.vote_average,
       m.vote_count,
       m.popularity,
       m.poster_path,
       m.backdrop_path,
       m.original_language,
       m.adult,
       m.video,
       m.most_popular,
       m.genre_ids,
       f.created_at AS favorited_at
     FROM favorite_movies f
     INNER JOIN movies m ON m.id = f.movie_id
     WHERE f.user_id = ?
     ORDER BY f.created_at DESC`,
    [userId]
  );

  return res.status(200).json({
    status: 'success',
    results: rows.length,
    data: {
      favorites: rows,
    },
  });
});

/**
 * POST /api/v1/favorites
 * Body: { movieId }
 * Adds a movie to current user's favorites.
 * Protected by auth.protect + requireCsrf in the route file.
 */
exports.addFavorite = catchAsync(async (req, res, next) => {
  const userId = req.user && req.user.id;
  if (!userId) return next(new AppError('Not authenticated', 401));

  const movieId = Number(req.body.movieId);

  if (!Number.isInteger(movieId) || movieId <= 0) {
    return next(new AppError('Please provide a valid movieId', 400));
  }

  // Ensure movie exists (clean 404 instead of DB FK error)
  const [movieRows] = await db.query(
    'SELECT id FROM movies WHERE id = ? LIMIT 1',
    [movieId]
  );

  if (movieRows.length === 0) {
    return next(new AppError('Movie not found', 404));
  }

  // Insert favorite (PRIMARY KEY (user_id, movie_id) prevents duplicates)
  // If already exists -> return 200 with a friendly message (idempotent behavior)
  try {
    await db.query(
      `INSERT INTO favorite_movies (user_id, movie_id)
       VALUES (?, ?)`,
      [userId, movieId]
    );
  } catch (err) {
    // Duplicate favorite -> ER_DUP_ENTRY
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(200).json({
        status: 'success',
        data: { message: 'Already in favorites.' },
      });
    }
    throw err;
  }

  return res.status(201).json({
    status: 'success',
    data: { message: 'Added to favorites.' },
  });
});

/**
 * DELETE /api/v1/favorites/:movieId
 * Removes a movie from current user's favorites.
 * Protected by auth.protect + requireCsrf in the route file.
 */
exports.removeFavorite = catchAsync(async (req, res, next) => {
  const userId = req.user && req.user.id;
  if (!userId) return next(new AppError('Not authenticated', 401));

  const movieId = Number(req.params.movieId);

  if (!Number.isInteger(movieId) || movieId <= 0) {
    return next(new AppError('Please provide a valid movieId', 400));
  }

  const [result] = await db.query(
    `DELETE FROM favorite_movies
     WHERE user_id = ? AND movie_id = ?
     LIMIT 1`,
    [userId, movieId]
  );

  // Idempotent: if it wasn't in favorites, still return success
  if (!result || result.affectedRows === 0) {
    return res.status(200).json({
      status: 'success',
      data: { message: 'Not in favorites.' },
    });
  }

  return res.status(200).json({
    status: 'success',
    data: { message: 'Removed from favorites.' },
  });
});


// --------------------
// VIEWS
// --------------------

/**
 * GET /favorites
 * Render an EJS page with the logged-in user's favorite movies.
 *
 * IMPORTANT:
 * - Uses res.locals.user (set by viewAuth.attachUserIfLoggedIn)
 */
exports.loadFavorites = catchAsync(async (req, res, next) => {
  const user = res.locals.user;

  if (!user) {
    return res.redirect('/login');
  }

  const baseSql = `
    SELECT
      m.id,
      m.title,
      m.poster_path,
      m.release_date,
      f.created_at AS favorited_at
    FROM favorite_movies f
    INNER JOIN movies m ON m.id = f.movie_id
    WHERE f.user_id = ?
    ORDER BY f.created_at DESC
  `;

  const countSql = `
    SELECT COUNT(*) AS total
    FROM favorite_movies f
    WHERE f.user_id = ?
  `;

  const { rows, meta } = await paginateQuery({
    reqQuery: req.query,
    db,
    baseSql,
    countSql,
    params: [user.id],
  });

  res.locals.favorites = rows;
  res.locals.pagination = meta; // expose meta to EJS
  next();
});

