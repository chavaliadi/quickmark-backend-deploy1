const { pool } = require('../config/db');
const { hashPassword } = require('../utils/passwordHasher');

// Find admin by email (for login)
const findAdminByEmail = async (email) => {
    const query = 'SELECT * FROM admins WHERE email = $1;';
    try {
        const result = await pool.query(query, [email]);
        return result.rows[0];
    } catch (error) {
        console.error('Error finding admin by email:', error);
        throw new Error('Database query failed.');
    }
};

// Find admin by ID
const findAdminById = async (adminId) => {
    const query = 'SELECT admin_id, name, email FROM admins WHERE admin_id = $1;';
    try {
        const result = await pool.query(query, [adminId]);
        return result.rows[0];
    } catch (error) {
        console.error('Error finding admin by ID:', error);
        throw new Error('Database query failed.');
    }
};

// Create a new admin
const createAdmin = async (name, email, passwordHash) => {
    const query = `
        INSERT INTO admins (name, email, password_hash)
        VALUES ($1, $2, $3)
        RETURNING admin_id, name, email;
    `;
    try {
        const result = await pool.query(query, [name, email, passwordHash]);
        return result.rows[0];
    } catch (error) {
        console.error('Error creating admin:', error);
        throw new Error('Database insertion failed.');
    }
};

// Update admin profile
const updateAdminProfile = async (adminId, updates) => {
    const updateFields = [];
    const queryParams = [adminId];
    let paramIndex = 2;

    for (const key in updates) {
        if (updates.hasOwnProperty(key) && ['name', 'email'].includes(key)) {
            updateFields.push(`${key} = $${paramIndex++}`);
            queryParams.push(updates[key]);
        }
    }
    if (updateFields.length === 0) return null;

    const query = `
        UPDATE admins
        SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE admin_id = $1
        RETURNING admin_id, name, email;
    `;
    try {
        const result = await pool.query(query, queryParams);
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error updating admin profile:', error);
        throw new Error('Database update failed.');
    }
};

// Update admin password
const updateAdminPassword = async (adminId, newHashedPassword) => {
    const query = `
        UPDATE admins
        SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
        WHERE admin_id = $2
        RETURNING admin_id, name, email;
    `;
    try {
        const result = await pool.query(query, [newHashedPassword, adminId]);
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error updating admin password:', error);
        throw new Error('Database password update failed.');
    }
};

// Get all departments with pagination
const getAllDepartments = async (page = 1, limit = 10) => {
    const offset = (page - 1) * limit;
    const query = `
        SELECT 
            department_id,
            name,
            created_at,
            updated_at
        FROM departments
        ORDER BY name
        LIMIT $1 OFFSET $2;
    `;
    const countQuery = 'SELECT COUNT(*) FROM departments;';
    
    try {
        const [result, countResult] = await Promise.all([
            pool.query(query, [limit, offset]),
            pool.query(countQuery)
        ]);
        
        const totalItems = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalItems / limit);
        
        return {
            departments: result.rows,
            totalItems,
            totalPages,
            currentPage: page
        };
    } catch (error) {
        console.error('Error getting all departments:', error);
        throw new Error('Database query failed.');
    }
};

// Create a new department
const createDepartment = async (name) => {
    const query = `
        INSERT INTO departments (name)
        VALUES ($1)
        RETURNING department_id, name;
    `;
    try {
        const result = await pool.query(query, [name]);
        return result.rows[0];
    } catch (error) {
        console.error('Error creating department:', error);
        throw new Error('Database insertion failed.');
    }
};

// Update department
const updateDepartment = async (departmentId, name) => {
    const query = `
        UPDATE departments
        SET name = $2, updated_at = CURRENT_TIMESTAMP
        WHERE department_id = $1
        RETURNING department_id, name;
    `;
    try {
        const result = await pool.query(query, [departmentId, name]);
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error updating department:', error);
        throw new Error('Database update failed.');
    }
};

// Delete department
const deleteDepartment = async (departmentId) => {
    const query = `
        DELETE FROM departments
        WHERE department_id = $1
        RETURNING department_id, name;
    `;
    try {
        const result = await pool.query(query, [departmentId]);
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error deleting department:', error);
        throw new Error('Database deletion failed.');
    }
};

// Get all faculties with pagination
const getAllFaculties = async (page = 1, limit = 10) => {
    const offset = (page - 1) * limit;
    const query = `
        SELECT 
            f.faculty_id,
            f.name,
            f.email,
            f.designation,
            f.created_at,
            f.updated_at,
            d.name AS department_name,
            d.department_id
        FROM faculties f
        LEFT JOIN departments d ON f.department_id = d.department_id
        ORDER BY f.name
        LIMIT $1 OFFSET $2;
    `;
    const countQuery = 'SELECT COUNT(*) FROM faculties;';
    
    try {
        const [result, countResult] = await Promise.all([
            pool.query(query, [limit, offset]),
            pool.query(countQuery)
        ]);
        
        const totalItems = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalItems / limit);
        
        return {
            faculty: result.rows,
            totalItems,
            totalPages,
            currentPage: page
        };
    } catch (error) {
        console.error('Error getting all faculties:', error);
        throw new Error('Database query failed.');
    }
};

// Create faculty by admin
const createFacultyByAdmin = async (name, email, password, departmentId, subjectIds = []) => {
    const { hashPassword } = require('../utils/passwordHasher');
    const hashedPassword = await hashPassword(password);
    
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Create the faculty member
        const facultyQuery = `
            INSERT INTO faculties (name, email, password_hash, department_id, designation)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING faculty_id, name, email, department_id, designation;
        `;
        const facultyResult = await client.query(facultyQuery, [name, email, hashedPassword, departmentId, 'Faculty']);
        const faculty = facultyResult.rows[0];
        
        // Assign subjects if provided
        if (subjectIds && subjectIds.length > 0) {
            for (const subjectId of subjectIds) {
                const assignmentQuery = `
                    INSERT INTO faculty_subjects (faculty_id, subject_id)
                    VALUES ($1, $2)
                    ON CONFLICT (faculty_id, subject_id) DO NOTHING
                `;
                await client.query(assignmentQuery, [faculty.faculty_id, subjectId]);
            }
        }
        
        await client.query('COMMIT');
        return faculty;
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating faculty:', error);
        throw new Error('Database insertion failed.');
    } finally {
        client.release();
    }
};

// Update faculty
const updateFaculty = async (facultyId, name, email, departmentId, designation) => {
    const query = `
        UPDATE faculties
        SET name = $2, email = $3, department_id = $4, designation = $5, updated_at = CURRENT_TIMESTAMP
        WHERE faculty_id = $1
        RETURNING faculty_id, name, email, department_id, designation;
    `;
    try {
        const result = await pool.query(query, [facultyId, name, email, departmentId, designation]);
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error updating faculty:', error);
        throw new Error('Database update failed.');
    }
};

// Delete faculty
const deleteFaculty = async (facultyId) => {
    const query = `
        DELETE FROM faculties
        WHERE faculty_id = $1
        RETURNING faculty_id, name, email;
    `;
    try {
        const result = await pool.query(query, [facultyId]);
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error deleting faculty:', error);
        throw new Error('Database deletion failed.');
    }
};

// Get all students with pagination
const getAllStudents = async (page = 1, limit = 10) => {
    const offset = (page - 1) * limit;
    const query = `
        SELECT 
            s.student_id,
            s.roll_number,
            s.name,
            s.email,
            s.current_year,
            s.section,
            s.created_at,
            s.updated_at,
            d.name AS department_name,
            d.department_id
        FROM students s
        JOIN departments d ON s.department_id = d.department_id
        ORDER BY s.roll_number
        LIMIT $1 OFFSET $2;
    `;
    const countQuery = 'SELECT COUNT(*) FROM students;';
    
    try {
        const [result, countResult] = await Promise.all([
            pool.query(query, [limit, offset]),
            pool.query(countQuery)
        ]);
        
        const totalItems = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalItems / limit);
        
        return {
            students: result.rows,
            totalItems,
            totalPages,
            currentPage: page
        };
    } catch (error) {
        console.error('Error getting all students:', error);
        throw new Error('Database query failed.');
    }
};

// Create student
const createStudent = async (rollNumber, name, email, departmentId, currentYear, section) => {
    const { hashPassword } = require('../utils/passwordHasher');
    const hashedPassword = await hashPassword('password123'); // Default password
    
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Create the student
        const studentQuery = `
            INSERT INTO students (roll_number, name, email, password_hash, department_id, current_year, section)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING student_id, roll_number, name, email, department_id, current_year, section;
        `;
        const studentResult = await client.query(studentQuery, [rollNumber, name, email, hashedPassword, departmentId, currentYear, section]);
        const student = studentResult.rows[0];
        
        // Get subjects for the student's department, year, and semester
        // For now, we'll assume semester 1 for all students (can be made configurable later)
        const semester = 1;
        const subjectsQuery = `
            SELECT subject_id FROM subjects 
            WHERE department_id = $1 AND year = $2 AND semester = $3
        `;
        const subjectsResult = await client.query(subjectsQuery, [departmentId, currentYear, semester]);
        
        // Enroll student in all matching subjects
        for (const subject of subjectsResult.rows) {
            const enrollmentQuery = `
                INSERT INTO enrollments (student_id, subject_id)
                VALUES ($1, $2)
                ON CONFLICT (student_id, subject_id) DO NOTHING
            `;
            await client.query(enrollmentQuery, [student.student_id, subject.subject_id]);
        }
        
        await client.query('COMMIT');
        
        console.log(`✅ Created student: ${name} and enrolled in ${subjectsResult.rows.length} subjects`);
        return student;
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating student:', error);
        throw new Error('Database insertion failed.');
    } finally {
        client.release();
    }
};

// Update student
const updateStudent = async (studentId, rollNumber, name, email, departmentId, currentYear, section) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Get current student data to check for changes
        const currentStudentQuery = `
            SELECT department_id, current_year FROM students WHERE student_id = $1
        `;
        const currentStudentResult = await client.query(currentStudentQuery, [studentId]);
        const currentStudent = currentStudentResult.rows[0];
        
        if (!currentStudent) {
            throw new Error('Student not found');
        }
        
        // Update the student
        const updateQuery = `
            UPDATE students
            SET roll_number = $2, name = $3, email = $4, department_id = $5, current_year = $6, section = $7, updated_at = CURRENT_TIMESTAMP
            WHERE student_id = $1
            RETURNING student_id, roll_number, name, email, department_id, current_year, section;
        `;
        const result = await client.query(updateQuery, [studentId, rollNumber, name, email, departmentId, currentYear, section]);
        const updatedStudent = result.rows[0];
        
        // Check if department or year changed (semester is assumed to be 1)
        const semester = 1;
        const departmentChanged = currentStudent.department_id !== departmentId;
        const yearChanged = currentStudent.current_year !== currentYear;
        
        if (departmentChanged || yearChanged) {
            // Remove old enrollments
            const removeEnrollmentsQuery = `
                DELETE FROM enrollments WHERE student_id = $1
            `;
            await client.query(removeEnrollmentsQuery, [studentId]);
            
            // Add new enrollments based on new department/year
            const subjectsQuery = `
                SELECT subject_id FROM subjects 
                WHERE department_id = $1 AND year = $2 AND semester = $3
            `;
            const subjectsResult = await client.query(subjectsQuery, [departmentId, currentYear, semester]);
            
            // Enroll student in new subjects
            for (const subject of subjectsResult.rows) {
                const enrollmentQuery = `
                    INSERT INTO enrollments (student_id, subject_id)
                    VALUES ($1, $2)
                    ON CONFLICT (student_id, subject_id) DO NOTHING
                `;
                await client.query(enrollmentQuery, [studentId, subject.subject_id]);
            }
            
            console.log(`✅ Updated student: ${name} and re-enrolled in ${subjectsResult.rows.length} subjects`);
        }
        
        await client.query('COMMIT');
        return updatedStudent;
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating student:', error);
        throw new Error('Database update failed.');
    } finally {
        client.release();
    }
};

// Delete student
const deleteStudent = async (studentId) => {
    const query = `
        DELETE FROM students
        WHERE student_id = $1
        RETURNING student_id, roll_number, name;
    `;
    try {
        const result = await pool.query(query, [studentId]);
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error deleting student:', error);
        throw new Error('Database deletion failed.');
    }
};

// Get all subjects with pagination and filters
const getAllSubjects = async (page = 1, limit = 10, searchTerm = '', filterYear = '', filterSection = '', filterSemester = '', filterDepartmentId = '') => {
    const offset = (page - 1) * limit;
    let query = `
        SELECT 
            s.subject_id,
            s.subject_name,
            s.year,
            s.section,
            s.semester,
            s.created_at,
            d.name AS department_name,
            d.department_id,
            COALESCE(f.name, 'TBD') AS faculty_name,
            f.faculty_id
        FROM subjects s
        JOIN departments d ON s.department_id = d.department_id
        LEFT JOIN faculty_subjects fs ON s.subject_id = fs.subject_id
        LEFT JOIN faculties f ON fs.faculty_id = f.faculty_id
        WHERE 1=1
    `;
    
    const queryParams = [];
    let paramIndex = 1;
    
    if (searchTerm) {
        query += ` AND s.subject_name ILIKE $${paramIndex++}`;
        queryParams.push(`%${searchTerm}%`);
    }
    
    if (filterYear) {
        query += ` AND s.year = $${paramIndex++}`;
        queryParams.push(filterYear);
    }
    
    if (filterSection) {
        query += ` AND s.section = $${paramIndex++}`;
        queryParams.push(filterSection);
    }
    
    if (filterSemester) {
        query += ` AND s.semester = $${paramIndex++}`;
        queryParams.push(filterSemester);
    }
    
    if (filterDepartmentId) {
        query += ` AND s.department_id = $${paramIndex++}`;
        queryParams.push(filterDepartmentId);
    }
    
    query += ` ORDER BY s.subject_name LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    queryParams.push(limit, offset);
    
    const countQuery = `
        SELECT COUNT(*) FROM subjects s
        JOIN departments d ON s.department_id = d.department_id
        WHERE 1=1
        ${searchTerm ? 'AND s.subject_name ILIKE $1' : ''}
        ${filterYear ? 'AND s.year = $2' : ''}
        ${filterSection ? 'AND s.section = $3' : ''}
        ${filterSemester ? 'AND s.semester = $4' : ''}
        ${filterDepartmentId ? 'AND s.department_id = $5' : ''}
    `;
    
    try {
        const [result, countResult] = await Promise.all([
            pool.query(query, queryParams),
            pool.query(countQuery, queryParams.slice(0, -2))
        ]);
        
        const totalItems = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalItems / limit);
        
        return {
            subjects: result.rows,
            totalItems,
            totalPages,
            currentPage: page
        };
    } catch (error) {
        console.error('Error getting all subjects:', error);
        throw new Error('Database query failed.');
    }
};

// Create subject
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
        console.error('Detailed error creating subject:', {
            error: error.message,
            code: error.code,
            detail: error.detail,
            hint: error.hint,
            where: error.where,
            schema: error.schema,
            table: error.table,
            column: error.column,
            dataType: error.dataType,
            constraint: error.constraint
        });
        throw new Error(`Database insertion failed: ${error.message}`);
    }
};

// Update subject
const updateSubject = async (subjectId, subjectName, departmentId, year, section, semester) => {
    const query = `
        UPDATE subjects
        SET subject_name = $2, department_id = $3, year = $4, section = $5, semester = $6, updated_at = CURRENT_TIMESTAMP
        WHERE subject_id = $1
        RETURNING subject_id, subject_name, department_id, year, section, semester;
    `;
    try {
        const result = await pool.query(query, [subjectId, subjectName, departmentId, year, section, semester]);
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error updating subject:', error);
        throw new Error('Database update failed.');
    }
};

// Delete subject
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

// Get app setting
const getAppSetting = async (settingKey) => {
    const query = 'SELECT setting_value FROM app_settings WHERE setting_key = $1;';
    try {
        const result = await pool.query(query, [settingKey]);
        return result.rows[0]?.setting_value || null;
    } catch (error) {
        console.error('Error getting app setting:', error);
        throw new Error('Database query failed.');
    }
};

// Update app setting
const updateAppSetting = async (settingKey, settingValue, description = null) => {
    const query = `
        INSERT INTO app_settings (setting_key, setting_value, description)
        VALUES ($1, $2, $3)
        ON CONFLICT (setting_key) 
        DO UPDATE SET 
            setting_value = EXCLUDED.setting_value,
            description = EXCLUDED.description,
            last_updated = CURRENT_TIMESTAMP
        RETURNING setting_key, setting_value;
    `;
    try {
        const result = await pool.query(query, [settingKey, settingValue, description]);
        return result.rows[0];
    } catch (error) {
        console.error('Error updating app setting:', error);
        throw new Error('Database update failed.');
    }
};

// Count entities
const countEntities = async (tableName) => {
    const query = `SELECT COUNT(*) FROM ${tableName};`;
    try {
        const result = await pool.query(query);
        return parseInt(result.rows[0].count);
    } catch (error) {
        console.error(`Error counting ${tableName}:`, error);
        throw new Error('Database query failed.');
    }
};

// Count defaulters
const countDefaulters = async () => {
    const query = `
        SELECT COUNT(DISTINCT s.student_id) 
        FROM students s
        JOIN enrollments e ON s.student_id = e.student_id
        JOIN attendance_sessions ass ON e.subject_id = ass.subject_id
        JOIN attendance_records ar ON ass.session_id = ar.session_id AND ar.student_id = s.student_id
        WHERE ass.status IN ('closed', 'completed')
        GROUP BY s.student_id
        HAVING (
            COUNT(CASE WHEN ar.status IN ('present', 'late') THEN 1 END)::DECIMAL / 
            COUNT(ar.record_id)::DECIMAL * 100
        ) < 75;
    `;
    try {
        const result = await pool.query(query);
        return result.rows.length;
    } catch (error) {
        console.error('Error counting defaulters:', error);
        throw new Error('Database query failed.');
    }
};

// Get defaulters list with pagination
const getDefaultersList = async (threshold = 75, page = 1, limit = 10) => {
    const offset = (page - 1) * limit;
    const query = `
        WITH student_attendance AS (
            SELECT 
                s.student_id,
                s.roll_number,
                s.name,
                s.email,
                s.current_year,
                s.section,
                d.name AS department_name,
                COUNT(ar.record_id) AS total_sessions,
                COUNT(CASE WHEN ar.status IN ('present', 'late') THEN 1 END) AS present_sessions,
                ROUND(
                    (COUNT(CASE WHEN ar.status IN ('present', 'late') THEN 1 END)::DECIMAL / 
                    NULLIF(COUNT(ar.record_id), 0)::DECIMAL) * 100, 2
                ) AS attendance_percentage
            FROM students s
            JOIN departments d ON s.department_id = d.department_id
            JOIN enrollments e ON s.student_id = e.student_id
            JOIN attendance_sessions ass ON e.subject_id = ass.subject_id
            JOIN attendance_records ar ON ass.session_id = ar.session_id AND ar.student_id = s.student_id
            WHERE ass.status IN ('closed', 'completed')
            GROUP BY s.student_id, s.roll_number, s.name, s.email, s.current_year, s.section, d.name
            HAVING (
                COUNT(CASE WHEN ar.status IN ('present', 'late') THEN 1 END)::DECIMAL / 
                NULLIF(COUNT(ar.record_id), 0)::DECIMAL * 100
            ) < $1
        )
        SELECT * FROM student_attendance
        ORDER BY attendance_percentage ASC
        LIMIT $2 OFFSET $3;
    `;
    
    const countQuery = `
        WITH student_attendance AS (
            SELECT s.student_id
            FROM students s
            JOIN enrollments e ON s.student_id = e.student_id
            JOIN attendance_sessions ass ON e.subject_id = ass.subject_id
            JOIN attendance_records ar ON ass.session_id = ar.session_id AND ar.student_id = s.student_id
            WHERE ass.status IN ('closed', 'completed')
            GROUP BY s.student_id
            HAVING (
                COUNT(CASE WHEN ar.status IN ('present', 'late') THEN 1 END)::DECIMAL / 
                NULLIF(COUNT(ar.record_id), 0)::DECIMAL * 100
            ) < $1
        )
        SELECT COUNT(*) FROM student_attendance;
    `;
    
    try {
        const [result, countResult] = await Promise.all([
            pool.query(query, [threshold, limit, offset]),
            pool.query(countQuery, [threshold])
        ]);
        
        const totalItems = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalItems / limit);
        
        return {
            defaulters: result.rows,
            totalItems,
            totalPages,
            currentPage: page
        };
    } catch (error) {
        console.error('Error getting defaulters list:', error);
        throw new Error('Database query failed.');
    }
};

// Get all table data for backup
const getAllTableData = async (tableName) => {
    const query = `SELECT * FROM ${tableName};`;
    try {
        const result = await pool.query(query);
        return result.rows;
    } catch (error) {
        console.error(`Error getting ${tableName} data:`, error);
        throw new Error('Database query failed.');
    }
};

// Get students for attendance sheet
const getStudentsForAttendanceSheet = async () => {
    const query = `
        SELECT 
            s.student_id,
            s.roll_number,
            s.name,
            s.email,
            s.current_year,
            s.section,
            d.name AS department_name
        FROM students s
        JOIN departments d ON s.department_id = d.department_id
        ORDER BY s.roll_number;
    `;
    try {
        const result = await pool.query(query);
        return result.rows;
    } catch (error) {
        console.error('Error getting students for attendance sheet:', error);
        throw new Error('Database query failed.');
    }
};

// Get dashboard statistics
const getDashboardStats = async () => {
    const query = `
        SELECT 
            (SELECT COUNT(*) FROM departments) AS total_departments,
            (SELECT COUNT(*) FROM faculties) AS total_faculties,
            (SELECT COUNT(*) FROM students) AS total_students,
            (SELECT COUNT(*) FROM subjects) AS total_subjects,
            (SELECT COUNT(*) FROM attendance_sessions WHERE status = 'open') AS active_sessions,
            (SELECT COUNT(*) FROM attendance_records WHERE DATE(created_at) = CURRENT_DATE) AS today_attendance_records;
    `;
    try {
        const result = await pool.query(query);
        return result.rows[0];
    } catch (error) {
        console.error('Error getting dashboard stats:', error);
        throw new Error('Database query failed.');
    }
};

// Get attendance statistics
const getAttendanceStats = async (startDate = null, endDate = null) => {
    let query = `
        SELECT 
            COUNT(DISTINCT ass.session_id) AS total_sessions,
            COUNT(ar.record_id) AS total_attendance_records,
            COUNT(CASE WHEN ar.status = 'present' THEN 1 END) AS present_count,
            COUNT(CASE WHEN ar.status = 'late' THEN 1 END) AS late_count,
            COUNT(CASE WHEN ar.status = 'absent' THEN 1 END) AS absent_count,
            ROUND(
                (COUNT(CASE WHEN ar.status IN ('present', 'late') THEN 1 END)::DECIMAL / 
                NULLIF(COUNT(ar.record_id), 0)::DECIMAL) * 100, 2
            ) AS overall_attendance_percentage
        FROM attendance_sessions ass
        LEFT JOIN attendance_records ar ON ass.session_id = ar.session_id
        WHERE ass.status IN ('closed', 'completed')
    `;
    
    const queryParams = [];
    let paramIndex = 1;
    
    if (startDate) {
        query += ` AND ass.session_date >= $${paramIndex++}`;
        queryParams.push(startDate);
    }
    
    if (endDate) {
        query += ` AND ass.session_date <= $${paramIndex++}`;
        queryParams.push(endDate);
    }
    
    try {
        const result = await pool.query(query, queryParams);
        return result.rows[0];
    } catch (error) {
        console.error('Error getting attendance stats:', error);
        throw new Error('Database query failed.');
    }
};

// --- FACULTY ASSIGNMENT MANAGEMENT ---
const assignSubjectToFaculty = async (facultyId, subjectId) => {
    const query = `
        INSERT INTO faculty_subjects (faculty_id, subject_id)
        VALUES ($1, $2)
        ON CONFLICT (faculty_id, subject_id) DO NOTHING
        RETURNING faculty_id, subject_id;
    `;
    try {
        const result = await pool.query(query, [facultyId, subjectId]);
        return result.rows[0];
    } catch (error) {
        console.error('Error assigning subject to faculty:', error);
        throw new Error('Database assignment failed.');
    }
};

const removeSubjectFromFaculty = async (facultyId, subjectId) => {
    const query = `
        DELETE FROM faculty_subjects
        WHERE faculty_id = $1 AND subject_id = $2
        RETURNING faculty_id, subject_id;
    `;
    try {
        const result = await pool.query(query, [facultyId, subjectId]);
        return result.rows[0];
    } catch (error) {
        console.error('Error removing subject from faculty:', error);
        throw new Error('Database removal failed.');
    }
};

const getFacultyAssignments = async (facultyId) => {
    const query = `
        SELECT 
            fs.faculty_id,
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
        console.error('Error getting faculty assignments:', error);
        throw new Error('Database query failed.');
    }
};

// --- STUDENT ENROLLMENT MANAGEMENT ---
const enrollStudentInSubject = async (studentId, subjectId) => {
    const query = `
        INSERT INTO enrollments (student_id, subject_id)
        VALUES ($1, $2)
        ON CONFLICT (student_id, subject_id) DO NOTHING
        RETURNING enrollment_id, student_id, subject_id;
    `;
    try {
        const result = await pool.query(query, [studentId, subjectId]);
        return result.rows[0];
    } catch (error) {
        console.error('Error enrolling student in subject:', error);
        throw new Error('Database enrollment failed.');
    }
};

const removeStudentFromSubject = async (studentId, subjectId) => {
    const query = `
        DELETE FROM enrollments
        WHERE student_id = $1 AND subject_id = $2
        RETURNING enrollment_id, student_id, subject_id;
    `;
    try {
        const result = await pool.query(query, [studentId, subjectId]);
        return result.rows[0];
    } catch (error) {
        console.error('Error removing student from subject:', error);
        throw new Error('Database removal failed.');
    }
};

const getStudentEnrollments = async (studentId) => {
    const query = `
        SELECT 
            e.enrollment_id,
            e.student_id,
            e.subject_id,
            e.enrolled_at,
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
        console.error('Error getting student enrollments:', error);
        throw new Error('Database query failed.');
    }
};

const getSubjectEnrollments = async (subjectId) => {
    const query = `
        SELECT 
            e.enrollment_id,
            e.student_id,
            e.subject_id,
            e.enrolled_at,
            s.name AS student_name,
            s.roll_number,
            s.email,
            d.name AS department_name
        FROM enrollments e
        JOIN students s ON e.student_id = s.student_id
        JOIN departments d ON s.department_id = d.department_id
        WHERE e.subject_id = $1
        ORDER BY s.name;
    `;
    try {
        const result = await pool.query(query, [subjectId]);
        return result.rows;
    } catch (error) {
        console.error('Error getting subject enrollments:', error);
        throw new Error('Database query failed.');
    }
};

module.exports = {
    findAdminByEmail,
    findAdminById,
    createAdmin,
    updateAdminProfile,
    updateAdminPassword,
    getAllDepartments,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    getAllFaculties,
    createFacultyByAdmin,
    updateFaculty,
    deleteFaculty,
    getAllStudents,
    createStudent,
    updateStudent,
    deleteStudent,
    getAllSubjects,
    createSubject,
    updateSubject,
    deleteSubject,
    getAppSetting,
    updateAppSetting,
    countEntities,
    countDefaulters,
    getDefaultersList,
    getAllTableData,
    getStudentsForAttendanceSheet,
    getDashboardStats,
    getAttendanceStats,
    assignSubjectToFaculty,
    removeSubjectFromFaculty,
    getFacultyAssignments,
    enrollStudentInSubject,
    removeStudentFromSubject,
    getStudentEnrollments,
    getSubjectEnrollments,
};