const { Pool } = require('pg');
require('dotenv').config();

// Optimized pool configuration for high concurrency (2000-4000 QR requests)
const pool = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
    
    // ===== HIGH-CONCURRENCY OPTIMIZATION =====
    max: 50, // Maximum number of clients in the pool (increased for high concurrency)
    min: 10, // Minimum number of clients in the pool
    idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed (30 seconds)
    connectionTimeoutMillis: 5000, // How long to wait for a new client connection to be established (5 seconds)
    
    // ===== PERFORMANCE TUNING =====
    statement_timeout: 30000, // 30 seconds query timeout
    query_timeout: 30000, // 30 seconds query timeout
    
    // ===== CONNECTION OPTIMIZATION =====
    allowExitOnIdle: false, // Keep connections alive
    maxUses: 7500, // Maximum number of times a connection can be used before being destroyed
    
    // ===== SSL CONFIGURATION (for production) =====
    // ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// ===== CONNECTION EVENT HANDLERS =====
pool.on('connect', (client) => {
    console.log('New client connected to PostgreSQL');
    // Set session-level optimizations for each connection
    client.query('SET statement_timeout = 30000');
    client.query('SET idle_in_transaction_session_timeout = 30000');
});

pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

pool.on('acquire', (client) => {
    console.log('Client acquired from pool');
});

pool.on('release', (client) => {
    console.log('Client released back to pool');
});

// ===== HEALTH CHECK FUNCTION =====
const healthCheck = async () => {
    try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        return true;
    } catch (error) {
        console.error('Database health check failed:', error);
        return false;
    }
};

// ===== INITIAL CONNECTION TEST =====
pool.connect((err, client, done) => {
    if (err) {
        console.error('Error connecting to the database:', err.stack);
        return;
    }
    console.log('Successfully connected to PostgreSQL database!');
    console.log(`Pool configuration: max=${pool.options.max}, min=${pool.options.min}`);
    client.release();
});

module.exports = { pool, healthCheck };