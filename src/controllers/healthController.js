const db = require('../config/db');

exports.healthCheck = (req, res) => {
    res.json({
        status: 'ok',
        name: 'Movie API',
        version: '1.0.0'
    })
}

exports.dbCheck = async (req, res, next) => {
    try {
        const [rows] = await db.query('SELECT 1 + 1 AS result');

        res.json({
            status: 'success',
            db: 'connected',
            result: rows[0].result
        })
    } catch (err) {
        next(err);
    }
}

