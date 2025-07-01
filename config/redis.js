const { createClient } = require('redis');

// Use REDIS_URL from environment or fallback to localhost
const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => {
    console.error('Redis Client Error', err);
});

redisClient.connect()
    .then(() => console.log('Connected to Redis server!'))
    .catch((err) => console.error('Failed to connect to Redis:', err));

module.exports = redisClient;