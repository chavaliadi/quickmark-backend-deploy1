// Script to populate the database with initial test data.
require('dotenv').config({ path: './.env' });
const { Pool } = require('pg');
const { hashPassword } = require('../utils/passwordHasher');

// Database connection configuration.
const pool = new Pool({
    user: process.env.PGUSER || 'postgres',
    host: process.env.PGHOST || 'localhost',
    database: process.env.PGDATABASE || 'quickmark_db',
    password: process.env.PGPASSWORD || 'admin',
    port: process.env.PGPORT || 5432,
    ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }
});

// Main function to seed the database.
async function seedDatabase() {
    const client = await pool.connect();
    
    try {
        console.log('🌱 Starting database seeding...');

        // Clear existing data first
        console.log('🧹 Clearing existing data...');
        await client.query('TRUNCATE TABLE attendance_records CASCADE');
        await client.query('TRUNCATE TABLE attendance_sessions CASCADE');
        await client.query('TRUNCATE TABLE enrollments CASCADE');
        await client.query('TRUNCATE TABLE students CASCADE');
        await client.query('TRUNCATE TABLE subjects CASCADE');
        await client.query('TRUNCATE TABLE faculties CASCADE');
        await client.query('TRUNCATE TABLE departments CASCADE');
        // Note: Not clearing admins table to preserve existing admin

        // Create default departments
        console.log('🏢 Creating default departments...');
        const departments = [
            { name: 'ECE' },
            { name: 'IT' },
            { name: 'IT-BI' }
        ];

        const departmentIds = {};
        for (const dept of departments) {
            const result = await client.query(
                'INSERT INTO departments (name) VALUES ($1) RETURNING department_id',
                [dept.name]
            );
            departmentIds[dept.name] = result.rows[0].department_id;
            console.log(`✅ Created department: ${dept.name}`);
        }

        // Create default subjects
        console.log('📚 Creating default subjects...');
        const subjects = [
            {
                name: 'Digital Electronics',
                code: 'DE101',
                department_id: departmentIds['ECE'],
                year: 2,
                semester: 1,
                section: 'A'
            },
            {
                name: 'Database Management',
                code: 'DBM101',
                department_id: departmentIds['IT'],
                year: 2,
                semester: 1,
                section: 'A'
            },
            {
                name: 'Business Analytics',
                code: 'BA101',
                department_id: departmentIds['IT-BI'],
                year: 2,
                semester: 1,
                section: 'A'
            }
        ];

        for (const subject of subjects) {
            await client.query(
                'INSERT INTO subjects (subject_name, department_id, year, section, semester, subject_code) VALUES ($1, $2, $3, $4, $5, $6)',
                [subject.name, subject.department_id, subject.year, subject.section, subject.semester, subject.code]
            );
            console.log(`✅ Created subject: ${subject.name} (${subject.year} Year, Sem ${subject.semester}, Code: ${subject.code})`);
        }

        // Create default admin user
        console.log('👨‍💼 Creating default admin...');
        const adminPassword = await hashPassword('adminpass');
        await client.query(
            'INSERT INTO admins (name, email, password_hash) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING',
            ['Admin', 'admin@example.com', adminPassword]
        );
        console.log('✅ Created default admin: admin@example.com / adminpass');

        // Create a test faculty member
        console.log('👨‍🏫 Creating test faculty...');
        const facultyPassword = await hashPassword('123456');
        const facultyResult = await client.query(
            'INSERT INTO faculties (name, email, password_hash, department_id) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING faculty_id',
            ['Dr. Adithya', 'adithya@example.com', facultyPassword, departmentIds['ECE']]
        );
        const facultyId = facultyResult.rows[0].faculty_id;
        console.log('✅ Created test faculty: adithya@example.com / 123456');

        // Create test students
        console.log('👨‍🎓 Creating test students...');
        const studentPassword = await hashPassword('student123');
        const students = [
            {
                name: 'Alice Johnson',
                roll_number: '2023-ECE-001',
                email: 'alice@example.com',
                department_id: departmentIds['ECE'],
                current_year: 2,
                section: 'A'
            },
            {
                name: 'Bob Williams',
                roll_number: '2023-ECE-002',
                email: 'bob@example.com',
                department_id: departmentIds['ECE'],
                current_year: 2,
                section: 'A'
            }
        ];

        const studentIds = {};
        for (const student of students) {
            const result = await client.query(
                'INSERT INTO students (name, roll_number, email, password_hash, department_id, current_year, section) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (roll_number) DO UPDATE SET name = EXCLUDED.name RETURNING student_id',
                [student.name, student.roll_number, student.email, studentPassword, student.department_id, student.current_year, student.section]
            );
            studentIds[student.roll_number] = result.rows[0].student_id;
            console.log(`✅ Created student: ${student.name} (${student.roll_number})`);
        }

        // Assign faculty to subjects
        console.log('📚 Assigning faculty to subjects...');
        const digitalElectronicsSubject = await client.query(
            'SELECT subject_id FROM subjects WHERE subject_name = $1',
            ['Digital Electronics']
        );
        
        if (digitalElectronicsSubject.rows.length > 0) {
            await client.query(
                'INSERT INTO faculty_subjects (faculty_id, subject_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [facultyId, digitalElectronicsSubject.rows[0].subject_id]
            );
            console.log('✅ Assigned Dr. Adithya to Digital Electronics');
        }

        // Enroll students in subjects
        console.log('📝 Enrolling students in subjects...');
        if (digitalElectronicsSubject.rows.length > 0) {
            for (const rollNumber in studentIds) {
                await client.query(
                    'INSERT INTO enrollments (student_id, subject_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [studentIds[rollNumber], digitalElectronicsSubject.rows[0].subject_id]
                );
                console.log(`✅ Enrolled ${rollNumber} in Digital Electronics`);
            }
        }

        // Set default attendance threshold
        console.log('📊 Setting attendance threshold...');
        await client.query(
            'INSERT INTO app_settings (setting_key, setting_value, description) VALUES ($1, $2, $3) ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value',
            ['attendance_threshold', '75', 'Minimum attendance percentage for defaulters']
        );
        console.log('✅ Set attendance threshold to 75%');

        console.log('\n🎉 Database seeding completed successfully!');
        console.log('\n📋 Default Data Summary:');
        console.log('   • 3 Departments: ECE, IT, IT-BI');
        console.log('   • 3 Subjects: Digital Electronics, Database Management, Business Analytics');
        console.log('   • 1 Admin: admin@example.com / adminpass');
        console.log('   • Attendance Threshold: 75%');
        console.log('\n🚀 Ready to start adding faculty and students!');

    } catch (error) {
        console.error('❌ Error seeding database:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run the seeding
seedDatabase().catch(console.error);