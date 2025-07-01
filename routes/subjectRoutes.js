// Defines API routes related to subjects (e.g., getting students for a subject).
const express = require('express');
const { getSubjectStudents } = require('../controllers/subjectController');
const { authMiddleware } = require('../middleware/authMiddleware'); // Fixed: use destructuring

const router = express.Router();

router.get('/:subject_id/students', authMiddleware, getSubjectStudents); // Get students enrolled in a specific subject

module.exports = router;