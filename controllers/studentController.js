const studentModel = require('../models/studentModel');
const attendanceModel = require('../models/attendanceModel');
const { comparePassword } = require('../utils/passwordHasher');
const { generateToken } = require('../config/jwt');
const redisClient = require('../config/redis');
const jwt = require('jsonwebtoken');

// Student Login
const loginStudent = async (req, res) => {
    const { roll_number, password } = req.body;
    if (!roll_number || !password) {
        return res.status(400).json({ message: 'Roll number and password are required.' });
    }
    try {
        const student = await studentModel.findStudentByRollNumber(roll_number);
        if (!student) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        const isMatch = await comparePassword(password, student.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        const token = generateToken({ id: student.student_id, roll_number: student.roll_number, isStudent: true });
        res.status(200).json({
            message: 'Logged in successfully!',
            student: {
                id: student.student_id,
                roll_number: student.roll_number,
                name: student.name,
                email: student.email
            },
            token
        });
    } catch (error) {
        console.error('Student login error:', error);
        res.status(500).json({ message: 'Internal server error during student login.' });
    }
};

// Student Profile (for logged-in student)
const getMyStudentProfile = async (req, res) => {
    const studentId = req.student.id;
    try {
        const student = await studentModel.findStudentById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student profile not found.' });
        }
        res.status(200).json({
            id: student.student_id,
            roll_number: student.roll_number,
            name: student.name,
            email: student.email,
            department_id: student.department_id,
            current_year: student.current_year,
            section: student.section,
            department_name: student.department_name
        });
    } catch (error) {
        console.error('Error getting student profile:', error);
        res.status(500).json({ message: 'Internal server error getting student profile.' });
    }
};

// Student Marking Attendance (secure version with enhanced QR validation)
const markAttendanceByLoggedInStudent = async (req, res) => {
    const studentId = req.student.id;
    const { verify_session_token, face_verify } = req.body;

    if (!verify_session_token || typeof face_verify !== 'boolean') {
        console.log(`[markAttendance] Missing token or face_verify | studentId: ${studentId} | time: ${new Date().toISOString()}`);
        return res.status(400).json({ message: 'verify_session_token and face_verify are required.' });
    }

    try {
        // 1. Verify the JWT token
        let payload;
        try {
            payload = jwt.verify(verify_session_token, process.env.JWT_SECRET);
        } catch (err) {
            console.log(`[markAttendance] Invalid/expired token | studentId: ${studentId} | time: ${new Date().toISOString()}`);
            return res.status(401).json({ message: 'Invalid or expired session token.' });
        }
        const { jti, studentId: tokenStudentId, sessionId } = payload;
        if (!jti || !tokenStudentId || !sessionId) {
            console.log(`[markAttendance] Invalid token payload | studentId: ${studentId} | time: ${new Date().toISOString()}`);
            return res.status(400).json({ message: 'Invalid session token payload.' });
        }
        // 2. Ensure the token is for this student
        if (tokenStudentId !== studentId) {
            console.log(`[markAttendance] Token does not match student | studentId: ${studentId} | tokenStudentId: ${tokenStudentId} | time: ${new Date().toISOString()}`);
            return res.status(403).json({ message: 'Session token does not match student.' });
        }
        // 3. Check Redis for single-use
        const redisKey = `attendance_session_token:${jti}`;
        const tokenStatus = await redisClient.get(redisKey);
        if (!tokenStatus) {
            console.log(`[markAttendance] Token expired or already used | studentId: ${studentId} | jti: ${jti} | time: ${new Date().toISOString()}`);
            return res.status(401).json({ message: 'Session token expired or already used.' });
        }
        if (tokenStatus !== 'unused') {
            console.log(`[markAttendance] Token already used | studentId: ${studentId} | jti: ${jti} | time: ${new Date().toISOString()}`);
            return res.status(401).json({ message: 'Session token already used.' });
        }
        // 4. Check face verification
        if (!face_verify) {
            console.log(`[markAttendance] Face verification failed | studentId: ${studentId} | sessionId: ${sessionId} | jti: ${jti} | time: ${new Date().toISOString()}`);
            return res.status(400).json({ message: 'Face verification failed.' });
        }
        // 5. Mark attendance
        // Check if student already marked attendance for this session
        const existingRecord = await attendanceModel.getSessionAttendanceRecords(sessionId);
        const alreadyMarked = existingRecord.find(record => record.student_id === studentId);
        if (alreadyMarked) {
            // Invalidate the token anyway
            await redisClient.set(redisKey, 'used');
            console.log(`[markAttendance] Already marked | studentId: ${studentId} | sessionId: ${sessionId} | jti: ${jti} | time: ${new Date().toISOString()}`);
            return res.status(400).json({ 
                message: 'Attendance already marked for this session.',
                current_status: alreadyMarked.status
            });
        }
        const attendedAt = new Date().toISOString();
        const record = await attendanceModel.markAttendance(sessionId, studentId, 'present', attendedAt);
        // 6. Invalidate the token in Redis
        await redisClient.set(redisKey, 'used');
        // 7. Log attendance marking (simple analytics)
        console.log(`[markAttendance] Attendance marked | studentId: ${studentId} | sessionId: ${sessionId} | jti: ${jti} | time: ${new Date().toISOString()}`);
        res.status(200).json({
            message: 'Attendance marked successfully!',
            record: {
                session_id: record.session_id,
                student_id: record.student_id,
                status: record.status,
                attended_at: record.attended_at
            }
        });
    } catch (error) {
        console.error(`[markAttendance] Error | studentId: ${studentId} | error: ${error.message} | time: ${new Date().toISOString()}`);
        res.status(500).json({ message: 'Internal server error marking attendance.' });
    }
};

// Student View Own Attendance History (Calendar view)
const getStudentCalendar = async (req, res) => {
    const studentId = req.student.id;
    const { subject_id, start_date, end_date } = req.query;

    if (!subject_id || !start_date || !end_date) {
        return res.status(400).json({ message: 'Subject ID, start date, and end date are required query parameters.' });
    }

    try {
        const isEnrolled = await studentModel.isStudentEnrolledInSubject(studentId, subject_id);
        if (!isEnrolled) {
            return res.status(403).json({ message: 'You are not enrolled in this subject.' });
        }

        const attendanceRecords = await studentModel.getStudentAttendanceCalendar(
            studentId,
            subject_id,
            start_date,
            end_date
        );

        res.status(200).json(attendanceRecords);
    } catch (error) {
        console.error('Error getting student calendar attendance:', error.message);
        res.status(500).json({ message: 'Internal server error getting calendar attendance.' });
    }
};

// Student Registration
const registerStudent = async (req, res) => {
    const { roll_number, name, email, password, department_id, current_year, section } = req.body;
    if (!roll_number || !name || !email || !password || !department_id || !current_year || !section) {
        return res.status(400).json({ message: 'All fields are required.' });
    }
    try {
        // Check for existing student by roll number or email
        const existingByRoll = await studentModel.findStudentByRollNumber(roll_number);
        if (existingByRoll) {
            return res.status(409).json({ message: 'Roll number already registered.' });
        }
        const existingByEmail = await studentModel.findStudentByEmail(email);
        if (existingByEmail) {
            return res.status(409).json({ message: 'Email already registered.' });
        }
        // Hash password
        const { hashPassword } = require('../utils/passwordHasher');
        const passwordHash = await hashPassword(password);
        // Create student
        const student = await studentModel.createStudent(
            roll_number,
            name,
            email,
            passwordHash,
            department_id,
            current_year,
            section
        );
        res.status(201).json({
            message: 'Student registered successfully!',
            student: {
                id: student.student_id,
                roll_number: student.roll_number,
                name: student.name,
                email: student.email,
                department_id: student.department_id,
                current_year: student.current_year,
                section: student.section
            }
        });
    } catch (error) {
        console.error('Student registration error:', error);
        res.status(500).json({ message: 'Internal server error during registration.' });
    }
};

// Public: Get all departments (for registration, etc.)
const getAllDepartmentsPublic = async (req, res) => {
    try {
        const { pool } = require('../config/db');
        const result = await pool.query('SELECT department_id, name FROM departments ORDER BY name');
        res.status(200).json({ departments: result.rows });
    } catch (error) {
        console.error('Error fetching departments (public):', error);
        res.status(500).json({ message: 'Internal server error fetching departments.' });
    }
};

module.exports = {
    loginStudent,
    getMyStudentProfile,
    markAttendanceByLoggedInStudent,
    getStudentCalendar,
    registerStudent,
    getAllDepartmentsPublic
};