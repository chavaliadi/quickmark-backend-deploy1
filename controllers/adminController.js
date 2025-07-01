// backend/controllers/adminController.js

const adminModel = require('../models/adminModel');
const { comparePassword, hashPassword } = require('../utils/passwordHasher');
const { generateToken } = require('../config/jwt');
const archiver = require('archiver');
const PDFDocument = require('pdfkit');

// --- ADMIN AUTH ---
const registerAdmin = async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Name, email, and password are required.' });
    }
    try {
        const existingAdmin = await adminModel.findAdminByEmail(email);
        if (existingAdmin) {
            return res.status(409).json({ message: 'Admin with this email already exists.' });
        }
        const hashedPassword = await hashPassword(password);
        const newAdmin = await adminModel.createAdmin(name, email, hashedPassword);
        const token = generateToken({ id: newAdmin.admin_id, email: newAdmin.email, isAdmin: true });
        res.status(201).json({
            message: 'Admin registered successfully!',
            admin: {
                id: newAdmin.admin_id,
                name: newAdmin.name,
                email: newAdmin.email
            },
            token
        });
    } catch (error) {
        console.error('Admin registration error:', error);
        res.status(500).json({ message: 'Internal server error during registration.' });
    }
};

const loginAdmin = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }
    try {
        const admin = await adminModel.findAdminByEmail(email);
        if (!admin) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        const isMatch = await comparePassword(password, admin.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        const token = generateToken({ id: admin.admin_id, email: admin.email, isAdmin: true });
        res.status(200).json({
            message: 'Logged in successfully!',
            admin: {
                id: admin.admin_id,
                name: admin.name,
                email: admin.email
            },
            token
        });
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ message: 'Internal server error during login.' });
    }
};

// --- DEPARTMENTS ---
const getDepartments = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    try {
        const { departments, totalItems, totalPages, currentPage } = await adminModel.getAllDepartments(page, limit);
        res.status(200).json({ departments, totalItems, totalPages, currentPage });
    } catch (error) {
        console.error('Error getting departments:', error);
        res.status(500).json({ message: 'Internal server error getting departments.' });
    }
};

const createDepartment = async (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Department name is required.' });
    }
    try {
        const newDepartment = await adminModel.createDepartment(name);
        res.status(201).json({ message: 'Department created successfully.', department: newDepartment });
    } catch (error) {
        console.error('Error creating department:', error);
        res.status(500).json({ message: 'Internal server error creating department.' });
    }
};

const updateDepartment = async (req, res) => {
    const { department_id } = req.params;
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Department name is required.' });
    }
    try {
        const updatedDepartment = await adminModel.updateDepartment(department_id, name);
        if (!updatedDepartment) {
            return res.status(404).json({ message: 'Department not found.' });
        }
        res.status(200).json({ message: 'Department updated successfully.', department: updatedDepartment });
    } catch (error) {
        console.error('Error updating department:', error);
        res.status(500).json({ message: 'Internal server error updating department.' });
    }
};

const deleteDepartment = async (req, res) => {
    const { department_id } = req.params;
    try {
        const deletedDepartment = await adminModel.deleteDepartment(department_id);
        if (!deletedDepartment) {
            return res.status(404).json({ message: 'Department not found.' });
        }
        res.status(200).json({ message: 'Department deleted successfully.' });
    } catch (error) {
        console.error('Error deleting department:', error);
        res.status(500).json({ message: 'Internal server error deleting department.' });
    }
};

// --- FACULTY ---
const getFaculties = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    try {
        const { faculty, totalItems, totalPages, currentPage } = await adminModel.getAllFaculties(page, limit);
        res.status(200).json({ faculty, totalItems, totalPages, currentPage });
    } catch (error) {
        console.error('Error getting faculties:', error);
        res.status(500).json({ message: 'Internal server error getting faculties.' });
    }
};

const createFaculty = async (req, res) => {
    const { name, email, password, department_id, subject_ids } = req.body;
    if (!name || !email || !password || !department_id) {
        return res.status(400).json({ message: 'All faculty fields are required.' });
    }
    try {
        const newFaculty = await adminModel.createFacultyByAdmin(name, email, password, department_id, subject_ids || []);
        res.status(201).json({ message: 'Faculty created successfully.', faculty: newFaculty });
    } catch (error) {
        console.error('Error creating faculty:', error);
        res.status(500).json({ message: 'Internal server error creating faculty.' });
    }
};

const updateFaculty = async (req, res) => {
    const { faculty_id } = req.params;
    const { name, email, department_id, designation } = req.body;
    if (!name || !email || !department_id) {
        return res.status(400).json({ message: 'Name, email, and department are required for update.' });
    }
    try {
        const updatedFaculty = await adminModel.updateFaculty(faculty_id, name, email, department_id, designation || 'Faculty');
        if (!updatedFaculty) {
            return res.status(404).json({ message: 'Faculty not found.' });
        }
        res.status(200).json({ message: 'Faculty updated successfully.', faculty: updatedFaculty });
    } catch (error) {
        console.error('Error updating faculty:', error);
        res.status(500).json({ message: 'Internal server error updating faculty.' });
    }
};

const deleteFaculty = async (req, res) => {
    const { faculty_id } = req.params;
    try {
        const deletedFaculty = await adminModel.deleteFaculty(faculty_id);
        if (!deletedFaculty) {
            return res.status(404).json({ message: 'Faculty not found.' });
        }
        res.status(200).json({ message: 'Faculty deleted successfully.' });
    } catch (error) {
        console.error('Error deleting faculty:', error);
        res.status(500).json({ message: 'Internal server error deleting faculty.' });
    }
};

// --- STUDENTS ---
const getStudents = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    try {
        const { students, totalItems, totalPages, currentPage } = await adminModel.getAllStudents(page, limit);
        res.status(200).json({ students, totalItems, totalPages, currentPage });
    } catch (error) {
        console.error('Error getting students:', error);
        res.status(500).json({ message: 'Internal server error getting students.' });
    }
};

const createStudent = async (req, res) => {
    const { roll_number, name, email, department_id, current_year, section } = req.body;
    console.log('Creating student with data:', { roll_number, name, email, department_id, current_year, section });
    console.log('Data types:', { 
        roll_number: typeof roll_number, 
        name: typeof name, 
        email: typeof email, 
        department_id: typeof department_id, 
        current_year: typeof current_year, 
        section: typeof section 
    });
    if (!roll_number || !name || !email || !department_id || !current_year || !section) {
        console.log('Missing required fields:', { roll_number: !!roll_number, name: !!name, email: !!email, department_id: !!department_id, current_year: !!current_year, section: !!section });
        return res.status(400).json({ message: 'All required student fields are missing.' });
    }
    try {
        const newStudent = await adminModel.createStudent(roll_number, name, email, department_id, current_year, section);
        res.status(201).json({ message: 'Student created successfully.', student: newStudent });
    } catch (error) {
        console.error('Error creating student:', error);
        res.status(500).json({ message: 'Internal server error creating student.' });
    }
};

const updateStudent = async (req, res) => {
    const { student_id } = req.params;
    const { roll_number, name, email, department_id, current_year, section } = req.body;
    if (!roll_number || !name || !email || !department_id || !current_year || !section) {
        return res.status(400).json({ message: 'All required student fields are missing for update.' });
    }
    try {
        const updatedStudent = await adminModel.updateStudent(student_id, roll_number, name, email, department_id, current_year, section);
        if (!updatedStudent) {
            return res.status(404).json({ message: 'Student not found.' });
        }
        res.status(200).json({ message: 'Student updated successfully.', student: updatedStudent });
    } catch (error) {
        console.error('Error updating student:', error);
        res.status(500).json({ message: 'Internal server error updating student.' });
    }
};

const deleteStudent = async (req, res) => {
    const { student_id } = req.params;
    try {
        const deletedStudent = await adminModel.deleteStudent(student_id);
        if (!deletedStudent) {
            return res.status(404).json({ message: 'Student not found.' });
        }
        res.status(200).json({ message: 'Student deleted successfully.' });
    } catch (error) {
        console.error('Error deleting student:', error);
        res.status(500).json({ message: 'Internal server error deleting student.' });
    }
};

// --- SUBJECTS ---
const getSubjects = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const searchTerm = req.query.searchTerm || '';
    const filterYear = req.query.filterYear || '';
    const filterSection = req.query.filterSection || '';
    const filterSemester = req.query.filterSemester || '';
    const filterDepartmentId = req.query.filterDepartmentId || '';
    try {
        const { subjects, totalItems, totalPages, currentPage } = await adminModel.getAllSubjects(page, limit, searchTerm, filterYear, filterSection, filterSemester, filterDepartmentId);
        res.status(200).json({ subjects, totalItems, totalPages, currentPage });
    } catch (error) {
        console.error('Error getting subjects:', error);
        res.status(500).json({ message: 'Internal server error getting subjects.' });
    }
};

const createSubject = async (req, res) => {
    const { subject_name, department_id, year, section, semester } = req.body;
    if (!subject_name || !department_id || !year || !section || typeof semester === 'undefined') {
        return res.status(400).json({ message: 'Subject name, department, year, section, and semester are required.' });
    }
    try {
        const newSubject = await adminModel.createSubject(subject_name, department_id, year, section, semester);
        res.status(201).json({ message: 'Subject created successfully.', subject: newSubject });
    } catch (error) {
        console.error('Error creating subject:', error);
        res.status(500).json({ message: 'Internal server error creating subject.' });
    }
};

const updateSubject = async (req, res) => {
    const { subject_id } = req.params;
    const { subject_name, department_id, year, section, semester } = req.body;
    if (!subject_name || !department_id || !year || !section || typeof semester === 'undefined') {
        return res.status(400).json({ message: 'Subject name, department, year, section, and semester are required for update.' });
    }
    try {
        const updatedSubject = await adminModel.updateSubject(subject_id, subject_name, department_id, year, section, semester);
        if (!updatedSubject) {
            return res.status(404).json({ message: 'Subject not found.' });
        }
        res.status(200).json({ message: 'Subject updated successfully.', subject: updatedSubject });
    } catch (error) {
        console.error('Error updating subject:', error);
        res.status(500).json({ message: 'Internal server error updating subject.' });
    }
};

const deleteSubject = async (req, res) => {
    const { subject_id } = req.params;
    try {
        const deletedSubject = await adminModel.deleteSubject(subject_id);
        if (!deletedSubject) {
            return res.status(404).json({ message: 'Subject not found.' });
        }
        res.status(200).json({ message: 'Subject deleted successfully.' });
    } catch (error) {
        console.error('Error deleting subject:', error);
        res.status(500).json({ message: 'Internal server error deleting subject.' });
    }
};

// --- SETTINGS ---
const getAttendanceThreshold = async (req, res) => {
    try {
        const threshold = await adminModel.getAppSetting('attendance_threshold');
        res.status(200).json({ threshold: threshold ? parseInt(threshold) : 75 });
    } catch (error) {
        console.error('Error getting settings:', error);
        res.status(500).json({ message: 'Internal server error getting settings.' });
    }
};

const updateAttendanceThreshold = async (req, res) => {
    const { threshold } = req.body;
    if (typeof threshold !== 'number' || threshold < 0 || threshold > 100) {
        return res.status(400).json({ message: 'Threshold must be a number between 0 and 100.' });
    }
    try {
        await adminModel.updateAppSetting('attendance_threshold', String(threshold), 'Minimum attendance percentage for defaulters');
        res.status(200).json({ message: 'Attendance threshold updated successfully.' });
    } catch (error) {
        console.error('Error updating threshold:', error);
        res.status(500).json({ message: 'Internal server error updating threshold.' });
    }
};

// --- REPORTS ---
const backupData = async (req, res) => {
    try {
        const tables = ['departments', 'faculties', 'students', 'subjects', 'enrollments', 'attendance_sessions', 'attendance_records', 'app_settings', 'admins'];
        const archive = archiver('zip');
        res.attachment('backup.zip');
        archive.pipe(res);

        for (const table of tables) {
            const result = await adminModel.getAllTableData(table);
            archive.append(JSON.stringify(result, null, 2), { name: `${table}.json` });
        }
        archive.finalize();
    } catch (error) {
        console.error('Error creating backup:', error);
        res.status(500).json({ message: 'Failed to create backup.' });
    }
};

const printAttendanceSheet = async (req, res) => {
    try {
        const doc = new PDFDocument();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="attendance-sheet.pdf"');
        doc.pipe(res);

        doc.fontSize(20).text('Master Attendance Sheet', { align: 'center' });
        doc.moveDown();

        const students = await adminModel.getStudentsForAttendanceSheet();
        students.forEach((student, idx) => {
            doc.fontSize(12).text(`${idx + 1}. ${student.roll_number} - ${student.name}`);
        });

        doc.end();
    } catch (error) {
        console.error('Error generating attendance sheet:', error);
        res.status(500).json({ message: 'Internal server error generating attendance sheet.' });
    }
};

// --- DASHBOARD ---
const getDashboardStats = async (req, res) => {
    try {
        const subjectsCount = await adminModel.countEntities('subjects');
        const studentsCount = await adminModel.countEntities('students');
        const facultyCount = await adminModel.countEntities('faculties');
        const departmentsCount = await adminModel.countEntities('departments');
        const defaultersCount = await adminModel.countDefaulters();

        res.status(200).json({
            subjects: subjectsCount,
            students: studentsCount,
            faculties: facultyCount,
            departments: departmentsCount,
            defaulters: defaultersCount,
        });
    } catch (error) {
        console.error('Error getting dashboard stats:', error);
        res.status(500).json({ message: 'Internal server error getting dashboard stats.' });
    }
};

const getAttendanceStats = async (req, res) => {
    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
    
    try {
        const stats = await adminModel.getAttendanceStats(startDate, endDate);
        res.status(200).json(stats);
    } catch (error) {
        console.error('Error getting attendance stats:', error);
        res.status(500).json({ message: 'Internal server error getting attendance stats.' });
    }
};

const getDefaultersList = async (req, res) => {
    const threshold = parseInt(req.query.threshold) || 75;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    try {
        const { defaulters, totalItems, totalPages, currentPage } = await adminModel.getDefaultersList(threshold, page, limit);
        res.status(200).json({ defaulters, totalItems, totalPages, currentPage });
    } catch (error) {
        console.error('Error getting defaulters list:', error);
        res.status(500).json({ message: 'Internal server error getting defaulters list.' });
    }
};

// --- FACULTY ASSIGNMENT MANAGEMENT ---
const assignSubjectToFaculty = async (req, res) => {
    const { faculty_id, subject_id } = req.body;
    if (!faculty_id || !subject_id) {
        return res.status(400).json({ message: 'Faculty ID and Subject ID are required.' });
    }
    try {
        await adminModel.assignSubjectToFaculty(faculty_id, subject_id);
        res.status(200).json({ message: 'Subject assigned to faculty successfully.' });
    } catch (error) {
        console.error('Error assigning subject to faculty:', error);
        res.status(500).json({ message: 'Internal server error assigning subject to faculty.' });
    }
};

const removeSubjectFromFaculty = async (req, res) => {
    console.log('removeSubjectFromFaculty called with body:', req.body);
    console.log('Request method:', req.method);
    console.log('Request headers:', req.headers);
    
    const { faculty_id, subject_id } = req.body;
    console.log('Extracted faculty_id:', faculty_id, 'subject_id:', subject_id);
    
    if (!faculty_id || !subject_id) {
        console.log('Missing required fields - faculty_id:', faculty_id, 'subject_id:', subject_id);
        return res.status(400).json({ message: 'Faculty ID and Subject ID are required.' });
    }
    try {
        console.log('Calling adminModel.removeSubjectFromFaculty with:', faculty_id, subject_id);
        await adminModel.removeSubjectFromFaculty(faculty_id, subject_id);
        console.log('Successfully removed subject from faculty');
        res.status(200).json({ message: 'Subject removed from faculty successfully.' });
    } catch (error) {
        console.error('Error removing subject from faculty:', error);
        res.status(500).json({ message: 'Internal server error removing subject from faculty.' });
    }
};

const getFacultyAssignments = async (req, res) => {
    const { faculty_id } = req.params;
    try {
        const assignments = await adminModel.getFacultyAssignments(faculty_id);
        res.status(200).json({ assignments });
    } catch (error) {
        console.error('Error getting faculty assignments:', error);
        res.status(500).json({ message: 'Internal server error getting faculty assignments.' });
    }
};

// --- STUDENT ENROLLMENT MANAGEMENT ---
const enrollStudentInSubject = async (req, res) => {
    const { student_id, subject_id } = req.body;
    if (!student_id || !subject_id) {
        return res.status(400).json({ message: 'Student ID and Subject ID are required.' });
    }
    try {
        await adminModel.enrollStudentInSubject(student_id, subject_id);
        res.status(200).json({ message: 'Student enrolled in subject successfully.' });
    } catch (error) {
        console.error('Error enrolling student in subject:', error);
        res.status(500).json({ message: 'Internal server error enrolling student in subject.' });
    }
};

const removeStudentFromSubject = async (req, res) => {
    const { student_id, subject_id } = req.body;
    if (!student_id || !subject_id) {
        return res.status(400).json({ message: 'Student ID and Subject ID are required.' });
    }
    try {
        await adminModel.removeStudentFromSubject(student_id, subject_id);
        res.status(200).json({ message: 'Student removed from subject successfully.' });
    } catch (error) {
        console.error('Error removing student from subject:', error);
        res.status(500).json({ message: 'Internal server error removing student from subject.' });
    }
};

const getStudentEnrollments = async (req, res) => {
    const { student_id } = req.params;
    try {
        const enrollments = await adminModel.getStudentEnrollments(student_id);
        res.status(200).json({ enrollments });
    } catch (error) {
        console.error('Error getting student enrollments:', error);
        res.status(500).json({ message: 'Internal server error getting student enrollments.' });
    }
};

const getSubjectEnrollments = async (req, res) => {
    const { subject_id } = req.params;
    try {
        const enrollments = await adminModel.getSubjectEnrollments(subject_id);
        res.status(200).json({ enrollments });
    } catch (error) {
        console.error('Error getting subject enrollments:', error);
        res.status(500).json({ message: 'Internal server error getting subject enrollments.' });
    }
};

module.exports = {
    registerAdmin,
    loginAdmin,
    getDepartments,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    getFaculties,
    createFaculty,
    updateFaculty,
    deleteFaculty,
    getStudents,
    createStudent,
    updateStudent,
    deleteStudent,
    getSubjects,
    createSubject,
    updateSubject,
    deleteSubject,
    getAttendanceThreshold,
    updateAttendanceThreshold,
    backupData,
    printAttendanceSheet,
    getDashboardStats,
    getAttendanceStats,
    getDefaultersList,
    assignSubjectToFaculty,
    removeSubjectFromFaculty,
    getFacultyAssignments,
    enrollStudentInSubject,
    removeStudentFromSubject,
    getStudentEnrollments,
    getSubjectEnrollments
};