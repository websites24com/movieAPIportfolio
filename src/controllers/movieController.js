// src/controllers/movieController.js
// ======================================================
// Controller functions for handling movie-related API requests.
// These functions are connected to routes, and each one returns
// JSON data to the client. All async controllers are wrapped
// with catchAsync so any error is forwarded to the global error
// handler without crashing the app.
// ======================================================

const db = require('../config/db');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

// ------------------------------------------------------
// GET /api/v1/movies
// Returns ALL movies from the dataset.
// ------------------------------------------------------
exports.getAllMovies = catchAsync(async (req, res, next) => {
  
    // 1) Read query params and make sure they’re numbers, because Express makes them strings! parseInt(string, radix)  
  const page = req.query.page ? parseInt(req.query.page, 10) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;

  if (Number.isNaN(page) || Number.isNaN(limit) || page < 1 || limit < 1) {
    return next(new AppError('Invalid page or limit parameter', 400));
  }

  const offset = (page - 1) * limit;

  // 2) Get page of movies
  const [movies] = await db.query(
    'SELECT * FROM movies LIMIT ? OFFSET ?',
    [limit, offset]
  );

  // 3) Get total count
  const [countRows] = await db.query(
    'SELECT COUNT(*) AS total FROM movies'
  );
  const total = countRows[0].total;
  const totalPages = Math.ceil(total / limit);

  // 4) Send response
  res.status(200).json({
    status: 'success',
    results: movies.length,
    meta: {
      page,
      limit,
      total,
      totalPages,
    },
    data: {
      movies,
    },
  });
});



// ------------------------------------------------------
// GET /api/v1/movies/popular
// Returns only movies where movie.most_popular === true
// ------------------------------------------------------
exports.getMostPopularMovies = catchAsync(async (req, res, next) => {
  // 1) Read query params and make sure they’re numbers
  const page = req.query.page ? parseInt(req.query.page, 10) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;

  if (Number.isNaN(page) || Number.isNaN(limit) || page < 1 || limit < 1) {
    return next(new AppError('Invalid page or limit parameter', 400));
  }

  const offset = (page - 1) * limit;

  // 2) Get paginated most_popular movies, ordered by popularity DESC
  const [movies] = await db.query(
    'SELECT * FROM movies WHERE most_popular = 1 ORDER BY popularity DESC LIMIT ? OFFSET ?',
    [limit, offset]
  );

  // 3) Get total count of most_popular movies
  const [countRows] = await db.query(
    'SELECT COUNT(*) AS total FROM movies WHERE most_popular = 1'
  );
  const total = countRows[0].total;
  const totalPages = Math.ceil(total / limit);

  // 4) Send response
  res.status(200).json({
    status: 'success',
    results: movies.length,
    meta: {
      page,
      limit,
      total,
      totalPages,
    },
    data: {
      movies,
    },
  });
});

// ------------------------------------------------------
// GET /api/v1/movies/:id
// Returns a single movie based on its numeric ID.
// We search both movies.js (basic info) and movieDetails.js.
// ------------------------------------------------------
exports.getMovieById = catchAsync(async (req, res, next) => {
    const id = Number(req.params.id);

    // Validate ID

    if (Number.isNaN(id) || id <= 0) {
        return next(new AppError('Invalid movie ID', 400))
    }

    // Query db for movie

    const[rows] = await db.query('SELECT * FROM movies WHERE id = ?', [id])

    if (rows.length === 0) {
        // No movie found
        return next(new AppError(`Movie with ID ${id} not found`, 404))
    }

    const movie = rows[0];

    res.status(200).json({
        status: 'success',
        data: {
            movie,
            
        },
    });
});

// ------------------------------------------------------
// POST /api/v1/movies
// Creates a new movie in the MySQL database
// ------------------------------------------------------

exports.createMovie = catchAsync(async(req, res, next) => {
    const {
    title,
    original_title,
    overview,
    release_date,
    vote_average,
    vote_count,
    popularity,
    poster_path,
    backdrop_path,
    original_language,
    adult,
    video,
    most_popular,
    genre_ids
  } = req.body;


if (!title) {
    return next(new AppError('A movie must have at least a title', 400))
}

const sql = `
    INSERT INTO movies (
      title,
      original_title,
      overview,
      release_date,
      vote_average,
      vote_count,
      popularity,
      poster_path,
      backdrop_path,
      original_language,
      adult,
      video,
      most_popular,
      genre_ids
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

   const params = [
    title,
    original_title || null,
    overview || null,
    release_date || null,
    vote_average ?? 0.0,
    vote_count ?? 0,
    popularity ?? 0.0,
    poster_path || null,
    backdrop_path || null,
    original_language || null,
    adult ? 1 : 0,
    video ? 1 : 0,
    most_popular ? 1 : 0,
    JSON.stringify(genre_ids || [])
  ];

  // Insert into DB

  const [result] = await db.query(sql, params);

  // Fetch the newly-created movie

  const [rows] = await db.query('SELECT * FROM movies WHERE id = ?', [result.insertId])

  res.status(201).json({
    status: 'success',
    data: {
        movie: rows[0]
    }
  })
  })


  // UPDATE

  exports.updateMovie = catchAsync(async(req, res, next) => {
    const movieId = req.params.id;
    
    // 1. Check if movie exists, we must have sth to update 😃

    const[existing] = await db.query('SELECT * FROM movies WHERE id = ?', [movieId]);
    if (existing.length === 0) {
        return next(new AppError(`Movie with ID ${movieId} not found`, 404))
    }
    // 2. Build UPDATE query dynamically
    const fields = Object.keys(req.body);
    if (fields.length === 0) {
        return next(new AppError('No fields provided to update', 400))
    }

    const values = Object.values(req.body);

    // Convert genre_ids array _to JSON string if present

    if(req.body.genre_ids) {
        const idx = fields.indexOf('genre_ids')
        fields[idx] = 'genre_ids';
        values[idx] = JSON.stringify(req.body.genre_ids)
    }

    const sql = `
    UPDATE movies
    SET ${fields.map(f => `${f} = ?`).join(', ')}
    WHERE id = ?`;

    await db.query(sql, [...values, movieId]);

    // 3. Return update movie

    const [updated] = await db.query('SELECT * FROM movies WHERE id = ?', [movieId]);

    res.status(200).json({
        status: 'success',
        data: {
            movie: updated[0]
        }
    })
  })

  // DELETE

  exports.deleteMovie = catchAsync(async(req, res, next) => {
    const movieId = req.params.id;
    
    // 1. Check if movie exists, we must have sth to update 😃
    
    const[existing] = await db.query('SELECT * FROM movies WHERE id = ?', [movieId]);
    if (existing.length === 0) {
        return next(new AppError(`Movie with ID ${movieId} not found`, 404))
    }

    // we store movie data before deleting

    const movieToDelete = existing[0]

    const[deleted] = await db.query('DELETE FROM movies WHERE id = ?', [movieId])

    res.status(200).json({
        status: 'success',
        data: {
            message: `The ${movieToDelete.title} with id:${movieToDelete.id} has been deleted!`,
            
        }
    })
})