// seed/seedMovies.js
// ------------------------------------------------------
// Seed script to load movies from source/data/movies.js
// into the MySQL "movies" table.
// Run manually with:  node seed/seedMovies.js
// ------------------------------------------------------

require('dotenv').config(); // Load .env so db.js gets DB credentials

const db = require('../src/config/db');      // Our MySQL pool
const movies = require('../src/data/movies'); // Your data file

// Helper to convert JS movie object -> DB row values
function mapMovieToRow(movie) {
  return {
    title: movie.title,
    original_title: movie.original_title || movie.title || null,
    overview: movie.overview || null,
    release_date: movie.release_date || null, // 'YYYY-MM-DD' or null

    vote_average:
      typeof movie.vote_average === 'number' ? movie.vote_average : 0.0,
    vote_count: typeof movie.vote_count === 'number' ? movie.vote_count : 0,
    popularity:
      typeof movie.popularity === 'number' ? movie.popularity : 0.0,

    poster_path: movie.poster_path || null,
    backdrop_path: movie.backdrop_path || null,
    original_language: movie.original_language || null,

    adult: movie.adult ? 1 : 0,
    video: movie.video ? 1 : 0,
    most_popular: movie.most_popular ? 1 : 0,

    genre_ids: JSON.stringify(movie.genre_ids || []), // store as JSON
  };
}

async function seedMovies() {
  console.log('🚀 Starting movies seeding...');

  try {
    // 1) Clear the table first (so seeding is repeatable)
    console.log('🧹 Truncating movies table...');
    await db.query('TRUNCATE TABLE movies');

    // 2) Prepare INSERT statement
    const insertSql = `
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

    // 3) Insert all movies in a transaction for safety
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      for (const movie of movies) {
        const row = mapMovieToRow(movie);

        await connection.query(insertSql, [
          row.title,
          row.original_title,
          row.overview,
          row.release_date,
          row.vote_average,
          row.vote_count,
          row.popularity,
          row.poster_path,
          row.backdrop_path,
          row.original_language,
          row.adult,
          row.video,
          row.most_popular,
          row.genre_ids,
        ]);
      }

      await connection.commit();
      console.log(`✅ Inserted ${movies.length} movies into the database.`);
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

    console.log('🎉 Movies seeding finished successfully.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error while seeding movies:', err);
    process.exit(1);
  }
}

// Run the seeding script
seedMovies();
