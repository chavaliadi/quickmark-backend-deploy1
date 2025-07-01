const { pool } = require('../config/db');
const { hashPassword } = require('../utils/passwordHasher');

// Find a faculty by email (for login)
const findFacultyByEmail = async (email) => {
    const query = 'SELECT * FROM faculties WHERE email = $1;';
    try {
        const result = await pool.query(query, [email]);
        return result.rows[0];
    } catch (error) {
        console.error('Error finding faculty by email:', error);
        throw new Error('Database query failed.');
    }
};

// Find a faculty by ID (for profile operations)
const findFacultyById = async (facultyId) => {
    const query = 'SELECT faculty_id, name, email, department_id, designation FROM faculties WHERE faculty_id = $1;';
    try {
        const result = await pool.query(query, [facultyId]);
        return result.rows[0];
    } catch (error) {
        console.error('Error finding faculty by ID:', error);
        throw new Error('Database query failed.');
    }
};

// Register a new faculty (used by admin in older context, can be adapted for faculty self-registration)
const createFaculty = async (name, email, passwordHash, departmentId) => {
    const query = `
        INSERT INTO faculties (name, email, password_hash, department_id)
        VALUES ($1, $2, $3, $4)
        RETURNING faculty_id, name, email;
    `;
    try {
        const result = await pool.query(query, [name, email, passwordHash, departmentId]);
        return result.rows[0];
    } catch (error) {
        console.error('Error creating faculty:', error);
        throw new Error('Database insertion failed.');
    }
};

// Update faculty profile information
const updateFacultyProfile = async (facultyId, updates) => {
    const updateFields = [];
    const queryParams = [facultyId];
    let paramIndex = 2;

    for (const key in updates) {
        if (updates.hasOwnProperty(key) && ['name', 'email', 'department_id', 'designation'].includes(key)) {
            updateFields.push(`${key} = $${paramIndex++}`);
            queryParams.push(updates[key]);
        }
    }
    if (updateFields.length === 0) return null;

    const query = `
        UPDATE faculties
        SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE faculty_id = $1
        RETURNING faculty_id, name, email, department_id, designation;
    `;
    try {
        const result = await pool.query(query, queryParams);
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error updating faculty profile:', error);
        throw new Error('Database update failed.');
    }
};

// Update faculty password
const updateFacultyPassword = async (facultyId, newHashedPassword) => {
    const query = `
        UPDATE faculties
        SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
        WHERE faculty_id = $2
        RETURNING faculty_id, name, email;
    `;
    try {
        const result = await pool.query(query, [newHashedPassword, facultyId]);
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error updating faculty password:', error);
        throw new Error('Database password update failed.');
    }
};

// Get a faculty's assigned subjects
const getFacultySubjects = async (facultyId) => {
    const query = `
        SELECT
            fs.subject_id,
            s.subject_name,
            s.year,
            s.section,
            s.semester,
            d.name AS department_name
        FROM faculty_subjects fs
        JOIN subjects s ON fs.subject_id = s.subject_id
        JOIN departments d ON s.department_id = d.department_id
        WHERE fs.faculty_id = $1
        ORDER BY s.subject_name;
    `;
    try {
        const result = await pool.query(query, [facultyId]);
        return result.rows;
    } catch (error) {
        console.error('Error getting faculty subjects:', error);
        throw new Error('Database query failed.');
    }
};

// Assign a subject to a faculty
const assignSubjectToFaculty = async (facultyId, subjectId) => {
    const query = `
        INSERT INTO faculty_subjects (faculty_id, subject_id)
        VALUES ($1, $2)
        ON CONFLICT (faculty_id, subject_id) DO NOTHING
        RETURNING *;
    `;
    try {
        const result = await pool.query(query, [facultyId, subjectId]);
        return result.rows[0];
    } catch (error) {
        console.error('Error assigning subject to faculty:', error);
        throw new Error('Database insertion failed.');
    }
};

// Remove a subject from a faculty
const removeSubjectFromFaculty = async (facultyId, subjectId) => {
    const query = `
        DELETE FROM faculty_subjects
        WHERE faculty_id = $1 AND subject_id = $2
        RETURNING *;
    `;
    try {
        const result = await pool.query(query, [facultyId, subjectId]);
        return result.rows[0];
    } catch (error) {
        console.error('Error removing subject from faculty:', error);
        throw new Error('Database deletion failed.');
    }
};

module.exports = {
    findFacultyByEmail,
    findFacultyById,
    createFaculty,
    updateFacultyProfile,
    updateFacultyPassword,
    getFacultySubjects,
    assignSubjectToFaculty,
    removeSubjectFromFaculty
};