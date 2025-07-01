const express = require('express');
const { loginFaculty, getMyProfile, updateMyProfile, changeMyPassword, getSubjectStudents } = require('../controllers/facultyController');
const { getFacultySubjects } = require('../models/userModel'); // Fixed: import from userModel
const { authMiddleware } = require('../middleware/authMiddleware'); // Fixed: use destructuring
const { requireFaculty } = require('../middleware/accessControlMiddleware'); // Import role middleware

const router = express.Router();

// PUBLIC ROUTE: Faculty Login
router.post('/login', loginFaculty);

// PROTECTED ROUTES: Require a valid token via authMiddleware
router.get('/me', authMiddleware, getMyProfile);
router.put('/me', authMiddleware, updateMyProfile);
router.put('/me/password', authMiddleware, changeMyPassword);

// Faculty assigned subjects - requires faculty role check
router.get('/me/subjects', authMiddleware, requireFaculty, async (req, res) => {
    try {
        const subjects = await getFacultySubjects(req.user.id); // Use req.user.id from authMiddleware
        res.status(200).json(subjects);
    } catch (error) {
        console.error('Error fetching faculty subjects:', error);
        res.status(500).json({ message: 'Failed to fetch faculty subjects.' });
    }
});

// Get enrolled students for a subject (only if faculty is assigned to that subject)
router.get('/subjects/:subject_id/students', authMiddleware, requireFaculty, getSubjectStudents);

module.exports = router;