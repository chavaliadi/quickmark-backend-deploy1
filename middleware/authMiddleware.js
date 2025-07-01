const { verifyToken } = require('../config/jwt');

// Regular authentication middleware
const authMiddleware = (req, res, next) => {
    console.log('--- Executing authMiddleware (regular user) ---');
    console.log('Auth Header:', req.header('Authorization') ? 'Present' : 'Missing');

    const authHeader = req.header('Authorization');
    if (!authHeader) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Token format is incorrect' });
    }

    try {
        const decoded = verifyToken(token);
        if (!decoded) {
            return res.status(401).json({ message: 'Token is not valid' });
        }
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Token is not valid', error: error.message });
    }
};

// Middleware to allow only Admin or Faculty
const requireAdminOrFaculty = (req, res, next) => {
    const user = req.user;
    if (user && (user.isAdmin || user.isFaculty)) {
        return next();
    }
    return res.status(403).json({ message: 'Forbidden: Only admin or faculty can perform this action.' });
};

module.exports = {
    authMiddleware,
    requireAdminOrFaculty,
};
