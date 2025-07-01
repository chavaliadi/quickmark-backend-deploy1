// Manages JSON Web Token (JWT) creation and verification.
const jwt = require('jsonwebtoken'); // JWT library
require('dotenv').config(); // Load JWT_SECRET from .env

const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret_key_here'; // Secret key for signing/verifying tokens
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h'; // Token expiration time with default

// Generates a new JWT for a given payload (e.g., user ID, email).
const generateToken = (payload) => {
    if (!jwtSecret) {
        throw new Error('JWT_SECRET is not configured');
    }
    return jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiresIn });
};

// Verifies a JWT and returns its decoded payload if valid.
const verifyToken = (token) => {
    try {
        if (!jwtSecret) {
            throw new Error('JWT_SECRET is not configured');
        }
        return jwt.verify(token, jwtSecret);
    } catch (error) {
        console.error('JWT verification failed:', error.message);
        return null; // Return null if token is invalid or expired
    }
};

module.exports = {
    generateToken,
    verifyToken
};