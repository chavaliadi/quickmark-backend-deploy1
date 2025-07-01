const { verifyToken } = require('../config/jwt');

const studentAuthMiddleware = (req, res, next) => {
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
        // Assuming student token payload contains student_id and isStudent: true (or similar)
        // For now, we'll just check if student_id exists in payload
        if (!decoded || !decoded.id || !decoded.isStudent) { // Check for student specific flags
            return res.status(403).json({ message: 'Forbidden: Not a student user' });
        }
        req.student = decoded; // Attach decoded student info (student_id, isStudent) to request
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token is not valid', error: error.message });
    }
};

module.exports = studentAuthMiddleware;