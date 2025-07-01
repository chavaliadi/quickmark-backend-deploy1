// backend/controllers/facultyController.js

const userModel = require('../models/userModel'); // This is your 'faculty' model
const { hashPassword, comparePassword } = require('../utils/passwordHasher');
const { generateToken } = require('../config/jwt'); // Use the proper JWT import
const subjectModel = require('../models/subjectModel');
const adminModel = require('../models/adminModel');

// Gets the profile of the authenticated faculty.
const getMyProfile = async (req, res) => {
    const facultyId = req.user.id; // From authMiddleware
    try {
        const faculty = await userModel.findFacultyById(facultyId);
        if (!faculty) {
            return res.status(404).json({ message: 'Faculty profile not found.' });
        }
        // Exclude sensitive information like password_hash from the response
        const { password_hash, ...facultyWithoutHash } = faculty;
        res.status(200).json(facultyWithoutHash);
    } catch (error) {
        console.error('Error getting faculty profile:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// Updates the profile of the authenticated faculty.
const updateMyProfile = async (req, res) => {
    const facultyId = req.user.id;
    const updates = req.body;
    try {
        const updatedFaculty = await userModel.updateFacultyProfile(facultyId, updates);
        if (!updatedFaculty) {
            return res.status(400).json({ message: 'No valid fields provided for update or profile not found.' });
        }
        res.status(200).json({
            message: 'Profile updated successfully!',
            faculty: updatedFaculty
        });
    } catch (error) {
        console.error('Error updating faculty profile:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// Changes the password of the authenticated faculty.
const changeMyPassword = async (req, res) => {
    const facultyId = req.user.id;
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
        return res.status(400).json({ message: 'Current and new passwords are required.' });
    }
    try {
        const faculty = await userModel.findFacultyById(facultyId);
        if (!faculty) { // Should not happen if authMiddleware works
            return res.status(404).json({ message: 'Faculty not found.' });
        }
        const isMatch = await comparePassword(current_password, faculty.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Current password incorrect.' });
        }
        const newHashedPassword = await hashPassword(new_password);
        await userModel.updateFacultyPassword(facultyId, newHashedPassword);
        res.status(200).json({ message: 'Password updated successfully!' });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// NEW: Faculty Login Function
const loginFaculty = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {
        // Find faculty by email
        const faculty = await userModel.findFacultyByEmail(email);

        if (!faculty) {
            // User not found
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // Compare provided password with hashed password from DB
        const isMatch = await comparePassword(password, faculty.password_hash);

        if (!isMatch) {
            // Passwords do not match
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // Generate JWT using the proper function
        const token = generateToken({ 
            id: faculty.faculty_id, 
            email: faculty.email, 
            role: 'faculty' 
        });

        // Send token and faculty details (excluding password hash)
        // Ensure you return all necessary faculty details for the frontend
        res.status(200).json({
            message: 'Login successful!',
            token,
            faculty: {
                id: faculty.faculty_id,
                name: faculty.name,
                email: faculty.email,
                department_id: faculty.department_id // Include this if needed on frontend
            }
        });

    } catch (error) {
        console.error('Error during faculty login:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// Get enrolled students for a subject (only if faculty is assigned to that subject)
const getSubjectStudents = async (req, res) => {
    const { subject_id } = req.params;
    const facultyId = req.user.id;
    
    try {
        // First check if faculty is assigned to this subject
        const isAssigned = await subjectModel.isFacultyAssignedToSubject(facultyId, subject_id);
        if (!isAssigned) {
            return res.status(403).json({ message: 'You are not assigned to this subject.' });
        }
        
        // Get enrolled students for this subject
        const enrollments = await adminModel.getSubjectEnrollments(subject_id);
        res.status(200).json({ students: enrollments });
    } catch (error) {
        console.error('Error getting subject students:', error);
        res.status(500).json({ message: 'Internal server error getting subject students.' });
    }
};

// Export all functions
module.exports = {
    getMyProfile,
    updateMyProfile,
    changeMyPassword,
    loginFaculty, // Make sure this is exported!
    getSubjectStudents
};