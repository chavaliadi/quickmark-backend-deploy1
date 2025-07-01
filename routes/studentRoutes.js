const express = require('express');
const {
    loginStudent,
    getMyStudentProfile,
    markAttendanceByLoggedInStudent,
    getStudentCalendar
} = require('../controllers/studentController');
const studentAuthMiddleware = require('../middleware/studentAuthMiddleware');

const router = express.Router();

// Student Authentication (Public) - this is the dedicated student login endpoint
router.post('/auth/login', loginStudent);

// Student Protected Routes (require student token)
router.get('/me', studentAuthMiddleware, getMyStudentProfile);
router.post('/attendance/mark', studentAuthMiddleware, markAttendanceByLoggedInStudent);
router.get('/attendance/calendar', studentAuthMiddleware, getStudentCalendar); // Route for calendar

module.exports = router;