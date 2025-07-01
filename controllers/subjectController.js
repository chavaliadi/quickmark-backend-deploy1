// Handles subject-related logic for faculty.
const subjectModel = require('../models/subjectModel');
const studentModel = require('../models/studentModel');

// Gets all subjects assigned to the authenticated faculty.
const getFacultySubjects = async (req, res) => {
    const facultyId = req.user.id;
    try {
        const subjects = await subjectModel.getSubjectsByFacultyId(facultyId);
        if (subjects.length === 0) {
            return res.status(404).json({ message: 'No subjects found for this faculty.' });
        }
        const formattedSubjects = subjects.map(subject => ({
            subject_id: subject.subject_id,
            batch_name: subject.batch_name || `${subject.year} - ${subject.section}`,
            year: subject.year,
            section: subject.section,
            department: subject.department_name,
            subject_name: subject.subject_name
        }));
        res.status(200).json(formattedSubjects);
    } catch (error) {
        console.error('Error fetching faculty subjects:', error);
        res.status(500).json({ message: 'Internal server error while fetching subjects.' });
    }
};

// Gets all students enrolled in a specific subject (for faculty viewing).
const getSubjectStudents = async (req, res) => {
    const { subject_id } = req.params;
    const facultyId = req.user.id;
    try {
        const isFacultyAssignedToSubject = await subjectModel.isFacultyAssignedToSubject(facultyId, subject_id);
        if (!isFacultyAssignedToSubject) {
            return res.status(403).json({ message: 'You are not authorized to view students for this subject.' });
        }
        const students = await studentModel.getStudentsBySubjectId(subject_id);
        res.status(200).json(students);
    } catch (error) {
        console.error('Error fetching students for subject:', error);
        res.status(500).json({ message: 'Internal server error fetching students.' });
    }
};

module.exports = {
    getFacultySubjects,
    getSubjectStudents
};