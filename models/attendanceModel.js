const { pool } = require('../config/db');

// Create a new attendance session
const createAttendanceSession = async (subjectId, facultyId, sessionDate, startTime, qrCodeData) => {
    const query = `
        INSERT INTO attendance_sessions (subject_id, faculty_id, session_date, start_time, qr_code_data, qr_sequence_number, qr_expires_at)
        VALUES ($1, $2, $3, $4, $5, 0, CURRENT_TIMESTAMP + INTERVAL '5 seconds')
        RETURNING session_id, subject_id, faculty_id, session_date, start_time, qr_code_data, qr_sequence_number, qr_expires_at, status;
    `;
    try {
        const result = await pool.query(query, [subjectId, facultyId, sessionDate, startTime, qrCodeData]);
        return result.rows[0];
    } catch (error) {
        console.error('Error creating attendance session:', error);
        throw new Error('Database insertion failed.');
    }
};

// Generate next QR code for a session
const generateNextQRCode = async (sessionId, subjectCode, sessionDate) => {
    const query = `
        UPDATE attendance_sessions 
        SET 
            qr_sequence_number = qr_sequence_number + 1,
            qr_expires_at = CURRENT_TIMESTAMP + INTERVAL '5 seconds',
            updated_at = CURRENT_TIMESTAMP
        WHERE session_id = $1 AND status = 'open'
        RETURNING qr_sequence_number, qr_expires_at;
    `;
    try {
        console.log(`Generating next QR for session: ${sessionId}, subject: ${subjectCode}, date: ${sessionDate}`);
        
        const result = await pool.query(query, [sessionId]);
        if (result.rows.length === 0) {
            throw new Error('Session not found or not open');
        }
        
        const { qr_sequence_number } = result.rows[0];
        
        // Ensure sessionDate is a string and format it properly
        const dateString = sessionDate instanceof Date ? sessionDate.toISOString().split('T')[0] : String(sessionDate);
        const formattedDate = dateString.replace(/-/g, '').substring(4, 8); // Extract MM-DD from YYYY-MM-DD
        const timestamp = Date.now(); // Current timestamp for uniqueness
        const qrCode = `${subjectCode}-${formattedDate}-${qr_sequence_number.toString().padStart(2, '0')}-${timestamp}`;
        
        console.log(`Generated QR code: ${qrCode} (sequence: ${qr_sequence_number})`);
        
        // Update the QR code data
        const updateResult = await pool.query(
            'UPDATE attendance_sessions SET qr_code_data = $1 WHERE session_id = $2 RETURNING qr_code_data',
            [qrCode, sessionId]
        );
        
        console.log(`Updated QR data in DB: ${updateResult.rows[0]?.qr_code_data}`);
        
        return {
            qr_code: qrCode,
            sequence_number: qr_sequence_number,
            expires_at: result.rows[0].qr_expires_at
        };
    } catch (error) {
        console.error('Error generating next QR code:', error);
        throw new Error('Failed to generate QR code');
    }
};

// Get active QR session by QR code data with expiration check
const getActiveSessionByQRCode = async (qrCodeData) => {
    const query = `
        SELECT 
            session_id, subject_id, faculty_id, session_date, start_time, end_time, status, qr_code_data, qr_sequence_number, qr_expires_at
        FROM attendance_sessions 
        WHERE qr_code_data = $1 AND status = 'open' AND qr_expires_at > CURRENT_TIMESTAMP
        ORDER BY created_at DESC 
        LIMIT 1;
    `;
    try {
        const result = await pool.query(query, [qrCodeData]);
        return result.rows[0];
    } catch (error) {
        console.error('Error getting active session by QR code:', error);
        throw new Error('Database query failed.');
    }
};

// Check if QR code is expired
const isQRCodeExpired = async (qrCodeData) => {
    const query = `
        SELECT qr_expires_at 
        FROM attendance_sessions 
        WHERE qr_code_data = $1 AND status = 'open'
        LIMIT 1;
    `;
    try {
        const result = await pool.query(query, [qrCodeData]);
        if (result.rows.length === 0) {
            return true; // Consider non-existent as expired
        }
        return new Date() > new Date(result.rows[0].qr_expires_at);
    } catch (error) {
        console.error('Error checking QR expiration:', error);
        return true; // Consider error as expired for safety
    }
};

// Mark attendance for a student
const markAttendance = async (sessionId, studentId, status, attendedAt = null) => {
    const query = `
        INSERT INTO attendance_records (session_id, student_id, status, attended_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (session_id, student_id) 
        DO UPDATE SET 
            status = EXCLUDED.status,
            attended_at = EXCLUDED.attended_at,
            updated_at = CURRENT_TIMESTAMP
        RETURNING record_id, session_id, student_id, status, attended_at;
    `;
    try {
        const result = await pool.query(query, [sessionId, studentId, status, attendedAt]);
        return result.rows[0];
    } catch (error) {
        console.error('Error marking attendance:', error);
        throw new Error('Database insertion/update failed.');
    }
};

// Get attendance records for a session
const getSessionAttendanceRecords = async (sessionId) => {
    const query = `
        SELECT 
            ar.record_id,
            ar.student_id,
            ar.status,
            ar.attended_at,
            ar.created_at,
            s.roll_number,
            s.name,
            s.email,
            d.name AS department_name
        FROM attendance_records ar
        JOIN students s ON ar.student_id = s.student_id
        JOIN departments d ON s.department_id = d.department_id
        WHERE ar.session_id = $1
        ORDER BY s.roll_number;
    `;
    try {
        const result = await pool.query(query, [sessionId]);
        return result.rows;
    } catch (error) {
        console.error('Error getting session attendance records:', error);
        throw new Error('Database query failed.');
    }
};

// Close an attendance session
const closeAttendanceSession = async (sessionId, endTime) => {
    const query = `
        UPDATE attendance_sessions 
        SET status = 'closed', end_time = $2, updated_at = CURRENT_TIMESTAMP
        WHERE session_id = $1
        RETURNING session_id, status, end_time;
    `;
    try {
        const result = await pool.query(query, [sessionId, endTime]);
        return result.rows[0];
    } catch (error) {
        console.error('Error closing attendance session:', error);
        throw new Error('Database update failed.');
    }
};

// Complete an attendance session
const completeAttendanceSession = async (sessionId) => {
    const query = `
        UPDATE attendance_sessions 
        SET status = 'completed', updated_at = CURRENT_TIMESTAMP
        WHERE session_id = $1
        RETURNING session_id, status;
    `;
    try {
        const result = await pool.query(query, [sessionId]);
        return result.rows[0];
    } catch (error) {
        console.error('Error completing attendance session:', error);
        throw new Error('Database update failed.');
    }
};

// Get faculty's attendance sessions
const getFacultyAttendanceSessions = async (facultyId, startDate = null, endDate = null) => {
    let query = `
        SELECT 
            ass.session_id,
            ass.subject_id,
            ass.session_date,
            ass.start_time,
            ass.end_time,
            ass.status,
            ass.qr_code_data,
            ass.qr_sequence_number,
            ass.created_at,
            s.subject_name,
            s.subject_code,
            s.year,
            s.section,
            d.name AS department_name,
            COUNT(ar.record_id) AS total_students,
            COUNT(CASE WHEN ar.status = 'present' THEN 1 END) AS present_count,
            COUNT(CASE WHEN ar.status = 'late' THEN 1 END) AS late_count,
            COUNT(CASE WHEN ar.status = 'absent' THEN 1 END) AS absent_count
        FROM attendance_sessions ass
        JOIN subjects s ON ass.subject_id = s.subject_id
        JOIN departments d ON s.department_id = d.department_id
        LEFT JOIN attendance_records ar ON ass.session_id = ar.session_id
        WHERE ass.faculty_id = $1
    `;
    
    const queryParams = [facultyId];
    let paramIndex = 2;
    
    if (startDate) {
        query += ` AND ass.session_date >= $${paramIndex++}`;
        queryParams.push(startDate);
    }
    
    if (endDate) {
        query += ` AND ass.session_date <= $${paramIndex++}`;
        queryParams.push(endDate);
    }
    
    query += `
        GROUP BY ass.session_id, ass.subject_id, ass.session_date, ass.start_time, 
                 ass.end_time, ass.status, ass.qr_code_data, ass.qr_sequence_number, ass.created_at,
                 s.subject_name, s.subject_code, s.year, s.section, d.name
        ORDER BY ass.session_date DESC, ass.start_time DESC;
    `;
    
    try {
        const result = await pool.query(query, queryParams);
        return result.rows;
    } catch (error) {
        console.error('Error getting faculty attendance sessions:', error);
        throw new Error('Database query failed.');
    }
};

// Get attendance statistics for a subject
const getSubjectAttendanceStats = async (subjectId, startDate = null, endDate = null) => {
    let query = `
        SELECT 
            ass.session_date,
            ass.start_time,
            ass.end_time,
            ass.status AS session_status,
            ass.qr_sequence_number,
            COUNT(ar.record_id) AS total_students,
            COUNT(CASE WHEN ar.status = 'present' THEN 1 END) AS present_count,
            COUNT(CASE WHEN ar.status = 'late' THEN 1 END) AS late_count,
            COUNT(CASE WHEN ar.status = 'absent' THEN 1 END) AS absent_count,
            ROUND(
                (COUNT(CASE WHEN ar.status IN ('present', 'late') THEN 1 END)::DECIMAL / 
                NULLIF(COUNT(ar.record_id), 0)::DECIMAL) * 100, 2
            ) AS attendance_percentage
        FROM attendance_sessions ass
        LEFT JOIN attendance_records ar ON ass.session_id = ar.session_id
        WHERE ass.subject_id = $1
    `;
    
    const queryParams = [subjectId];
    let paramIndex = 2;
    
    if (startDate) {
        query += ` AND ass.session_date >= $${paramIndex++}`;
        queryParams.push(startDate);
    }
    
    if (endDate) {
        query += ` AND ass.session_date <= $${paramIndex++}`;
        queryParams.push(endDate);
    }
    
    query += `
        GROUP BY ass.session_id, ass.session_date, ass.start_time, ass.end_time, 
                 ass.status, ass.qr_sequence_number
        ORDER BY ass.session_date DESC, ass.start_time DESC;
    `;
    
    try {
        const result = await pool.query(query, queryParams);
        return result.rows;
    } catch (error) {
        console.error('Error getting subject attendance stats:', error);
        throw new Error('Database query failed.');
    }
};

// Find session by ID
const findSessionById = async (sessionId) => {
    const query = `
        SELECT 
            session_id, subject_id, faculty_id, session_date, start_time, end_time, status, 
            qr_code_data, qr_sequence_number, qr_expires_at
        FROM attendance_sessions 
        WHERE session_id = $1;
    `;
    try {
        const result = await pool.query(query, [sessionId]);
        return result.rows[0];
    } catch (error) {
        console.error('Error finding session by ID:', error);
        throw new Error('Database query failed.');
    }
};

// Find session by date and subject
const findSessionByDate = async (subjectId, sessionDate) => {
    const query = `
        SELECT 
            session_id, subject_id, faculty_id, session_date, start_time, end_time, status
        FROM attendance_sessions 
        WHERE subject_id = $1 AND session_date = $2
        ORDER BY start_time DESC 
        LIMIT 1;
    `;
    try {
        const result = await pool.query(query, [subjectId, sessionDate]);
        return result.rows[0];
    } catch (error) {
        console.error('Error finding session by date:', error);
        throw new Error('Database query failed.');
    }
};

// Create or update attendance record
const createOrUpdateAttendanceRecord = async (sessionId, studentId, status, attendedAt) => {
    const query = `
        INSERT INTO attendance_records (session_id, student_id, status, attended_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (session_id, student_id) 
        DO UPDATE SET 
            status = EXCLUDED.status,
            attended_at = EXCLUDED.attended_at,
            updated_at = CURRENT_TIMESTAMP
        RETURNING record_id, session_id, student_id, status, attended_at;
    `;
    try {
        const result = await pool.query(query, [sessionId, studentId, status, attendedAt]);
        return result.rows[0];
    } catch (error) {
        console.error('Error creating/updating attendance record:', error);
        throw new Error('Database operation failed.');
    }
};

// Override attendance status
const overrideAttendanceStatus = async (sessionId, studentId, newStatus) => {
    const query = `
        UPDATE attendance_records 
        SET status = $3, updated_at = CURRENT_TIMESTAMP
        WHERE session_id = $1 AND student_id = $2
        RETURNING record_id, session_id, student_id, status;
    `;
    try {
        const result = await pool.query(query, [sessionId, studentId, newStatus]);
        return result.rows[0];
    } catch (error) {
        console.error('Error overriding attendance status:', error);
        throw new Error('Database update failed.');
    }
};

// Get student attendance by subject and date range
const getStudentAttendanceBySubjectAndDateRange = async (studentId, subjectId, startDate, endDate) => {
    const query = `
        SELECT 
            ar.status,
            ar.attended_at,
            ass.session_date,
            ass.start_time,
            ass.qr_sequence_number
        FROM attendance_records ar
        JOIN attendance_sessions ass ON ar.session_id = ass.session_id
        WHERE ar.student_id = $1 
        AND ass.subject_id = $2 
        AND ass.session_date BETWEEN $3 AND $4
        ORDER BY ass.session_date, ass.start_time;
    `;
    try {
        const result = await pool.query(query, [studentId, subjectId, startDate, endDate]);
        return result.rows;
    } catch (error) {
        console.error('Error getting student attendance by date range:', error);
        throw new Error('Database query failed.');
    }
};

// Check if student is enrolled in subject (for QR validation)
const isStudentEnrolledInSubject = async (studentId, subjectId) => {
    const query = `
        SELECT EXISTS(
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

// Get students by subject ID
const getStudentsBySubjectId = async (subjectId) => {
    const query = `
        SELECT 
            s.student_id,
            s.roll_number,
            s.name,
            s.email,
            s.current_year,
            s.section,
            d.name AS department_name
        FROM enrollments e
        JOIN students s ON e.student_id = s.student_id
        JOIN departments d ON s.department_id = d.department_id
        WHERE e.subject_id = $1
        ORDER BY s.roll_number;
    `;
    try {
        const result = await pool.query(query, [subjectId]);
        return result.rows;
    } catch (error) {
        console.error('Error getting students by subject ID:', error);
        throw new Error('Database query failed.');
    }
};

// Submit attendance session with weight
const submitAttendanceSession = async (sessionId, attendanceWeight) => {
    const query = `
        UPDATE attendance_sessions 
        SET 
            status = 'submitted',
            attendance_weight = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE session_id = $1
        RETURNING session_id, subject_id, faculty_id, session_date, start_time, end_time, 
                  status, attendance_weight, qr_sequence_number;
    `;
    try {
        const result = await pool.query(query, [sessionId, attendanceWeight]);
        return result.rows[0];
    } catch (error) {
        console.error('Error submitting attendance session:', error);
        throw new Error('Database update failed.');
    }
};

module.exports = {
    createAttendanceSession,
    generateNextQRCode,
    getActiveSessionByQRCode,
    isQRCodeExpired,
    markAttendance,
    getSessionAttendanceRecords,
    closeAttendanceSession,
    completeAttendanceSession,
    getFacultyAttendanceSessions,
    getSubjectAttendanceStats,
    findSessionById,
    findSessionByDate,
    createOrUpdateAttendanceRecord,
    overrideAttendanceStatus,
    getStudentAttendanceBySubjectAndDateRange,
    isStudentEnrolledInSubject,
    getStudentsBySubjectId,
    submitAttendanceSession
};