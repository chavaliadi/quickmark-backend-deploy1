const { pool } = require('../config/db');

// Get all subjects
const getAllSubjects = async () => {
    const query = `
        SELECT 
            s.subject_id,
            s.subject_name,
            s.subject_code,
            s.year,
            s.section,
            s.semester,
            s.created_at,
            d.name AS department_name,
            d.department_id
        FROM subjects s
        JOIN departments d ON s.department_id = d.department_id
        ORDER BY d.name, s.subject_name;
    `;
    try {
        const result = await pool.query(query);
        return result.rows;
    } catch (error) {
        console.error('Error getting all subjects:', error);
        throw new Error('Database query failed.');
    }
};

// Get subjects by department
const getSubjectsByDepartment = async (departmentId) => {
    const query = `
        SELECT 
            subject_id,
            subject_name,
            subject_code,
            year,
            section,
            semester,
            created_at
        FROM subjects
        WHERE department_id = $1
        ORDER BY subject_name;
    `;
    try {
        const result = await pool.query(query, [departmentId]);
        return result.rows;
    } catch (error) {
        console.error('Error getting subjects by department:', error);
        throw new Error('Database query failed.');
    }
};

// Get subject by ID
const getSubjectById = async (subjectId) => {
    const query = `
        SELECT 
            s.subject_id,
            s.subject_name,
            s.subject_code,
            s.year,
            s.section,
            s.semester,
            s.created_at,
            d.name AS department_name,
            d.department_id
        FROM subjects s
        JOIN departments d ON s.department_id = d.department_id
        WHERE s.subject_id = $1;
    `;
    try {
        const result = await pool.query(query, [subjectId]);
        return result.rows[0];
    } catch (error) {
        console.error('Error getting subject by ID:', error);
        throw new Error('Database query failed.');
    }
};

// Create a new subject
const createSubject = async (subjectName, subjectCode, departmentId, year, section, semester) => {
    const query = `
        INSERT INTO subjects (subject_name, subject_code, department_id, year, section, semester)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING subject_id, subject_name, subject_code, department_id, year, section, semester;
    `;
    try {
        const result = await pool.query(query, [subjectName, subjectCode, departmentId, year, section, semester]);
        return result.rows[0];
    } catch (error) {
        console.error('Error creating subject:', error);
        throw new Error('Database insertion failed.');
    }
};

// Update a subject
const updateSubject = async (subjectId, updates) => {
    const updateFields = [];
    const queryParams = [subjectId];
    let paramIndex = 2;

    for (const key in updates) {
        if (updates.hasOwnProperty(key) && ['subject_name', 'subject_code', 'year', 'section', 'semester'].includes(key)) {
            updateFields.push(`${key} = $${paramIndex++}`);
            queryParams.push(updates[key]);
        }
    }
    if (updateFields.length === 0) return null;

    const query = `
        UPDATE subjects
        SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE subject_id = $1
        RETURNING subject_id, subject_name, subject_code, department_id, year, section, semester;
    `;
    try {
        const result = await pool.query(query, queryParams);
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error updating subject:', error);
        throw new Error('Database update failed.');
    }
};

// Delete a subject
const deleteSubject = async (subjectId) => {
    const query = `
        DELETE FROM subjects
        WHERE subject_id = $1
        RETURNING subject_id, subject_name;
    `;
    try {
        const result = await pool.query(query, [subjectId]);
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error deleting subject:', error);
        throw new Error('Database deletion failed.');
    }
};

// Get subjects assigned to a faculty
const getFacultySubjects = async (facultyId) => {
    const query = `
        SELECT 
            s.subject_id,
            s.subject_name,
            s.subject_code,
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

// Get students enrolled in a subject
const getEnrolledStudents = async (subjectId) => {
    const query = `
        SELECT 
            s.student_id,
            s.roll_number,
            s.name,
            s.email,
            s.current_year,
            s.section,
            d.name AS department_name,
            e.enrolled_at
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
        console.error('Error getting enrolled students:', error);
        throw new Error('Database query failed.');
    }
};

// Check if subject exists
const subjectExists = async (subjectId) => {
    const query = 'SELECT EXISTS(SELECT 1 FROM subjects WHERE subject_id = $1);';
    try {
        const result = await pool.query(query, [subjectId]);
        return result.rows[0].exists;
    } catch (error) {
        console.error('Error checking if subject exists:', error);
        throw new Error('Database query failed.');
    }
};

// Check if faculty is assigned to subject
const isFacultyAssignedToSubject = async (facultyId, subjectId) => {
    const query = `
        SELECT EXISTS(
            SELECT 1 FROM faculty_subjects 
            WHERE faculty_id = $1 AND subject_id = $2
        );
    `;
    try {
        const result = await pool.query(query, [facultyId, subjectId]);
        return result.rows[0].exists;
    } catch (error) {
        console.error('Error checking faculty assignment:', error);
        throw new Error('Database query failed.');
    }
};

// Get subject code for QR generation
const getSubjectCode = async (subjectId) => {
    const query = 'SELECT subject_code FROM subjects WHERE subject_id = $1;';
    try {
        const result = await pool.query(query, [subjectId]);
        return result.rows[0]?.subject_code;
    } catch (error) {
        console.error('Error getting subject code:', error);
        throw new Error('Database query failed.');
    }
};

module.exports = {
    getAllSubjects,
    getSubjectsByDepartment,
    getSubjectById,
    createSubject,
    updateSubject,
    deleteSubject,
    getFacultySubjects,
    getEnrolledStudents,
    subjectExists,
    isFacultyAssignedToSubject,
    getSubjectCode
};