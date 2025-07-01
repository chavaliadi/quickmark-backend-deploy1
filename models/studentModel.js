const { pool } = require('../config/db');
const { hashPassword } = require('../utils/passwordHasher');

// Find a student by email (for login)
const findStudentByEmail = async (email) => {
    const query = 'SELECT * FROM students WHERE email = $1;';
    try {
        const result = await pool.query(query, [email]);
        return result.rows[0];
    } catch (error) {
        console.error('Error finding student by email:', error);
        throw new Error('Database query failed.');
    }
};

// Find a student by roll number (for login)
const findStudentByRollNumber = async (rollNumber) => {
    const query = 'SELECT * FROM students WHERE roll_number = $1;';
    try {
        const result = await pool.query(query, [rollNumber]);
        return result.rows[0];
    } catch (error) {
        console.error('Error finding student by roll number:', error);
        throw new Error('Database query failed.');
    }
};

// Find a student by ID (for profile operations)
const findStudentById = async (studentId) => {
    const query = `
        SELECT 
            s.student_id, 
            s.roll_number, 
            s.name, 
            s.email, 
            s.department_id,
            s.current_year,
            s.section,
            d.name AS department_name
        FROM students s
        JOIN departments d ON s.department_id = d.department_id
        WHERE s.student_id = $1;
    `;
    try {
        const result = await pool.query(query, [studentId]);
        return result.rows[0];
    } catch (error) {
        console.error('Error finding student by ID:', error);
        throw new Error('Database query failed.');
    }
};

// Create a new student
const createStudent = async (rollNumber, name, email, passwordHash, departmentId, currentYear, section) => {
    const query = `
        INSERT INTO students (roll_number, name, email, password_hash, department_id, current_year, section)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING student_id, roll_number, name, email, department_id, current_year, section;
    `;
    try {
        const result = await pool.query(query, [rollNumber, name, email, passwordHash, departmentId, currentYear, section]);
        return result.rows[0];
    } catch (error) {
        console.error('Error creating student:', error);
        throw new Error('Database insertion failed.');
    }
};

// Update student profile information
const updateStudentProfile = async (studentId, updates) => {
    const updateFields = [];
    const queryParams = [studentId];
    let paramIndex = 2;

    for (const key in updates) {
        if (updates.hasOwnProperty(key) && ['name', 'email', 'current_year', 'section'].includes(key)) {
            updateFields.push(`${key} = $${paramIndex++}`);
            queryParams.push(updates[key]);
        }
    }
    if (updateFields.length === 0) return null;

    const query = `
        UPDATE students
        SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE student_id = $1
        RETURNING student_id, roll_number, name, email, department_id, current_year, section;
    `;
    try {
        const result = await pool.query(query, queryParams);
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error updating student profile:', error);
        throw new Error('Database update failed.');
    }
};

// Update student password
const updateStudentPassword = async (studentId, newHashedPassword) => {
    const query = `
        UPDATE students
        SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
        WHERE student_id = $2
        RETURNING student_id, roll_number, name, email;
    `;
    try {
        const result = await pool.query(query, [newHashedPassword, studentId]);
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error updating student password:', error);
        throw new Error('Database password update failed.');
    }
};

// Get a student's enrolled subjects
const getStudentSubjects = async (studentId) => {
    const query = `
        SELECT
            e.subject_id,
            s.subject_name,
            s.year,
            s.section,
            s.semester,
            d.name AS department_name
        FROM enrollments e
        JOIN subjects s ON e.subject_id = s.subject_id
        JOIN departments d ON s.department_id = d.department_id
        WHERE e.student_id = $1
        ORDER BY s.subject_name;
    `;
    try {
        const result = await pool.query(query, [studentId]);
        return result.rows;
    } catch (error) {
        console.error('Error getting student subjects:', error);
        throw new Error('Database query failed.');
    }
};

// Enroll a student in a subject
const enrollStudentInSubject = async (studentId, subjectId) => {
    const query = `
        INSERT INTO enrollments (student_id, subject_id)
        VALUES ($1, $2)
        ON CONFLICT (student_id, subject_id) DO NOTHING
        RETURNING *;
    `;
    try {
        const result = await pool.query(query, [studentId, subjectId]);
        return result.rows[0];
    } catch (error) {
        console.error('Error enrolling student in subject:', error);
        throw new Error('Database insertion failed.');
    }
};

// Remove a student from a subject
const removeStudentFromSubject = async (studentId, subjectId) => {
    const query = `
        DELETE FROM enrollments
        WHERE student_id = $1 AND subject_id = $2
        RETURNING *;
    `;
    try {
        const result = await pool.query(query, [studentId, subjectId]);
        return result.rows[0];
    } catch (error) {
        console.error('Error removing student from subject:', error);
        throw new Error('Database deletion failed.');
    }
};

// Get student attendance calendar (for mobile app)
const getStudentAttendanceCalendar = async (studentId, subjectId = null, startDate, endDate) => {
    let query = `
        SELECT
            ar.session_id,
            ar.status,
            ar.attended_at,
            ar.created_at,
            s.subject_name,
            s.year,
            s.section,
            s.semester,
            d.name AS department_name,
            f.name AS faculty_name,
            ass.session_date,
            ass.start_time,
            ass.end_time
        FROM attendance_records ar
        JOIN attendance_sessions ass ON ar.session_id = ass.session_id
        JOIN subjects s ON ass.subject_id = s.subject_id
        JOIN departments d ON s.department_id = d.department_id
        JOIN faculties f ON ass.faculty_id = f.faculty_id
        WHERE ar.student_id = $1
        AND ass.session_date >= $2::date
        AND ass.session_date <= $3::date
    `;
    
    const queryParams = [studentId, startDate, endDate];
    let paramIndex = 4;
    
    if (subjectId) {
        query += ` AND ass.subject_id = $${paramIndex++}`;
        queryParams.push(subjectId);
    }
    
    query += ` ORDER BY ass.session_date ASC, s.subject_name ASC;`;
    
    try {
        const result = await pool.query(query, queryParams);
        return result.rows;
    } catch (error) {
        console.error('Error getting student attendance calendar:', error);
        throw new Error('Database query failed.');
    }
};

// Get student attendance summary
const getStudentAttendanceSummary = async (studentId) => {
    const query = `
        SELECT
            s.subject_name,
            s.year,
            s.section,
            COUNT(ar.record_id) AS total_sessions,
            COUNT(CASE WHEN ar.status = 'present' THEN 1 END) AS present_count,
            COUNT(CASE WHEN ar.status = 'late' THEN 1 END) AS late_count,
            COUNT(CASE WHEN ar.status = 'absent' THEN 1 END) AS absent_count,
            ROUND(
                (COUNT(CASE WHEN ar.status IN ('present', 'late') THEN 1 END)::DECIMAL / 
                COUNT(ar.record_id)::DECIMAL) * 100, 2
            ) AS attendance_percentage
        FROM enrollments e
        JOIN subjects s ON e.subject_id = s.subject_id
        LEFT JOIN attendance_sessions ass ON s.subject_id = ass.subject_id
        LEFT JOIN attendance_records ar ON ass.session_id = ar.session_id AND ar.student_id = e.student_id
        WHERE e.student_id = $1
        GROUP BY s.subject_id, s.subject_name, s.year, s.section
        ORDER BY s.subject_name;
    `;
    try {
        const result = await pool.query(query, [studentId]);
        return result.rows;
    } catch (error) {
        console.error('Error getting student attendance summary:', error);
        throw new Error('Database query failed.');
    }
};

// Check if student is enrolled in subject (for QR validation)
const isStudentEnrolledInSubject = async (studentId, subjectId) => {
    const query = `
        SELECT EXISTS (
            SELECT 1 FROM enrollments
            WHERE student_id = $1 AND subject_id = $2
        );
    `;
    try {
        const result = await pool.query(query, [studentId, subjectId]);
        return result.rows[0].exists;
    } catch (error) {
        console.error('Error checking student enrollment:', error);
        throw new Error('Database query failed.');
    }
};

// Get students enrolled in a subject (for attendance marking)
const getStudentsBySubjectId = async (subjectId) => {
    const query = `
        SELECT
            s.student_id, s.roll_number, s.name, s.email,
            d.name AS department_name
        FROM students s
        JOIN enrollments e ON s.student_id = e.student_id
        JOIN departments d ON s.department_id = d.department_id
        WHERE e.subject_id = $1
        ORDER BY s.roll_number;
    `;
    try {
        const result = await pool.query(query, [subjectId]);
        return result.rows;
    } catch (error) {
        console.error('Error fetching students by subject ID:', error);
        throw new Error('Database query failed.');
    }
};

module.exports = {
    findStudentByEmail,
    findStudentByRollNumber,
    findStudentById,
    createStudent,
    updateStudentProfile,
    updateStudentPassword,
    getStudentSubjects,
    enrollStudentInSubject,
    removeStudentFromSubject,
    getStudentAttendanceCalendar,
    getStudentAttendanceSummary,
    isStudentEnrolledInSubject,
    getStudentsBySubjectId,
};
