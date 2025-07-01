const { verifyToken } = require('../config/jwt');

const adminAuthMiddleware = (req, res, next) => {
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
        if (!decoded || !decoded.isAdmin) { // Check for isAdmin flag in token payload
            return res.status(403).json({ message: 'Forbidden: Not an admin user' });
        }
        req.admin = decoded; // Attach decoded admin info (admin_id, email, isAdmin) to request
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token is not valid', error: error.message });
    }
};

module.exports = adminAuthMiddleware;