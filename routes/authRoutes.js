// Defines API routes for authentication (register, login).
const express = require('express');
const { registerFaculty, loginFaculty } = require('../controllers/authController');

const router = express.Router();

router.post('/register', registerFaculty); // Public route for faculty registration
router.post('/login', loginFaculty);       // Public route for faculty login

module.exports = router;