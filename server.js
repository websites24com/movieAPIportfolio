// server.js
// Entry point of the Movie API

// Load environment variables from .env (if present)
require('dotenv').config()

// module comes from Node.js
const http = require('http')
const app = require('./src/app');

// Use PORT from environment or default to 3000

const PORT = process.env.PORT || 3000;

// create HTTP server using the Express app

const server = http.createServer(app);

// Start listening

server.listen(PORT, () => {
    console.log(`🎬 Movie API running on http://localhost:${PORT}`);
})

// basic error logging for the server

server.on('error', (err) => {
    console.log('Server error:', err);
})