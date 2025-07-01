// // // backend/routes/adminRoutes.js

// backend/routes/adminRoutes.js

const express = require('express');
const {
    registerAdmin, loginAdmin,
    getDepartments, createDepartment, updateDepartment, deleteDepartment,
    getFaculties, createFaculty, updateFaculty, deleteFaculty,
    getStudents, createStudent, updateStudent, deleteStudent,
    getSubjects, createSubject, updateSubject, deleteSubject,
    getAttendanceThreshold, updateAttendanceThreshold, backupData, printAttendanceSheet,
    getDashboardStats, getAttendanceStats,
    getDefaultersList,
    assignSubjectToFaculty, removeSubjectFromFaculty, getFacultyAssignments,
    enrollStudentInSubject, removeStudentFromSubject, getStudentEnrollments, getSubjectEnrollments
} = require('../controllers/adminController');
const adminAuthMiddleware = require('../middleware/adminAuthMiddleware');

const router = express.Router();

// Admin Authentication (Public)
router.post('/register', registerAdmin);
router.post('/login', loginAdmin);

// Dashboard Stats
router.get('/dashboard/stats', adminAuthMiddleware, getDashboardStats);
router.get('/dashboard/attendance-stats', adminAuthMiddleware, getAttendanceStats);

// Department Management (Admin-only)
router.get('/departments', adminAuthMiddleware, getDepartments);
router.post('/departments', adminAuthMiddleware, createDepartment);
router.put('/departments/:department_id', adminAuthMiddleware, updateDepartment);
router.delete('/departments/:department_id', adminAuthMiddleware, deleteDepartment);

// Faculty Management (Admin-only)
router.get('/faculty', adminAuthMiddleware, getFaculties);
router.post('/faculty', adminAuthMiddleware, createFaculty);

// Faculty Assignments (Admin-only) - Must come before parameterized routes
router.post('/faculty/assign-subject', adminAuthMiddleware, assignSubjectToFaculty);
router.delete('/faculty/remove-subject', adminAuthMiddleware, removeSubjectFromFaculty);
router.get('/faculty/:faculty_id/assignments', adminAuthMiddleware, getFacultyAssignments);

// Faculty parameterized routes (must come after specific routes)
router.put('/faculty/:faculty_id', adminAuthMiddleware, updateFaculty);
router.delete('/faculty/:faculty_id', adminAuthMiddleware, deleteFaculty);

// Student Management (Admin-only)
router.get('/students', adminAuthMiddleware, getStudents);
router.post('/students', adminAuthMiddleware, createStudent);
router.put('/students/:student_id', adminAuthMiddleware, updateStudent);
router.delete('/students/:student_id', adminAuthMiddleware, deleteStudent);

// Subject Management (Admin-only)
router.get('/subjects', adminAuthMiddleware, getSubjects);
router.post('/subjects', adminAuthMiddleware, createSubject);
router.put('/subjects/:subject_id', adminAuthMiddleware, updateSubject);
router.delete('/subjects/:subject_id', adminAuthMiddleware, deleteSubject);

// Settings Management (Admin-only)
router.get('/settings/attendance-threshold', adminAuthMiddleware, getAttendanceThreshold);
router.put('/settings/attendance-threshold', adminAuthMiddleware, updateAttendanceThreshold);

// Reports (Admin-only)
router.get('/reports/defaulters', adminAuthMiddleware, getDefaultersList);
router.get('/reports/backup', adminAuthMiddleware, backupData);
router.get('/reports/print-attendance', adminAuthMiddleware, printAttendanceSheet);

// Student Enrollments (Admin-only)
router.post('/students/enroll-subject', adminAuthMiddleware, enrollStudentInSubject);
router.delete('/students/remove-subject', adminAuthMiddleware, removeStudentFromSubject);
router.get('/students/:student_id/enrollments', adminAuthMiddleware, getStudentEnrollments);
router.get('/subjects/:subject_id/enrollments', adminAuthMiddleware, getSubjectEnrollments);

module.exports = router;