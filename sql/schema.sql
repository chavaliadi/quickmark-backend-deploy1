-- PostgreSQL schema for Attendance Management System

CREATE TABLE IF NOT EXISTS departments (
    department_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS faculties (
    faculty_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    department_id UUID,
    designation VARCHAR(100) DEFAULT 'Faculty',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_department
        FOREIGN KEY(department_id)
        REFERENCES departments(department_id)
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS admins (
    admin_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS subjects (
    subject_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_name VARCHAR(255) NOT NULL,
    subject_code VARCHAR(10) NOT NULL, -- Added for QR naming (e.g., DEL, CS, MATH)
    department_id UUID NOT NULL,
    year INT NOT NULL,
    section VARCHAR(10) NOT NULL,
    semester INT NOT NULL CHECK (semester IN (1, 2)),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_subject_department
        FOREIGN KEY(department_id)
        REFERENCES departments(department_id)
        ON DELETE RESTRICT,
    UNIQUE (subject_name, department_id, year, section, semester),
    UNIQUE (subject_code, department_id, year, section, semester)
);

CREATE TABLE IF NOT EXISTS faculty_subjects (
    faculty_id UUID NOT NULL,
    subject_id UUID NOT NULL,
    PRIMARY KEY (faculty_id, subject_id),
    FOREIGN KEY (faculty_id) REFERENCES faculties(faculty_id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(subject_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS students (
    student_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    roll_number VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    department_id UUID NOT NULL,
    current_year INT,
    section VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_student_department
        FOREIGN KEY(department_id)
        REFERENCES departments(department_id)
        ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS enrollments (
    enrollment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    subject_id UUID NOT NULL,
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (student_id, subject_id),
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(subject_id) ON DELETE CASCADE
);

CREATE TYPE ATTENDANCE_STATUS AS ENUM ('open', 'closed', 'completed', 'cancelled');

CREATE TABLE IF NOT EXISTS attendance_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID NOT NULL,
    faculty_id UUID NOT NULL,
    session_date DATE NOT NULL,
    start_time TIME WITH TIME ZONE NOT NULL,
    end_time TIME WITH TIME ZONE,
    status ATTENDANCE_STATUS DEFAULT 'open',
    qr_code_data TEXT,
    qr_sequence_number INT DEFAULT 0, -- Added: Track QR sequence within session
    qr_expires_at TIMESTAMP WITH TIME ZONE, -- Added: QR expiration timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subject_id) REFERENCES subjects(subject_id) ON DELETE CASCADE,
    FOREIGN KEY (faculty_id) REFERENCES faculties(faculty_id) ON DELETE CASCADE
);

CREATE TYPE ATTENDANCE_RECORD_STATUS AS ENUM ('present', 'absent', 'late');

CREATE TABLE IF NOT EXISTS attendance_records (
    record_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    student_id UUID NOT NULL,
    status ATTENDANCE_RECORD_STATUS NOT NULL DEFAULT 'absent',
    attended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (session_id, student_id),
    FOREIGN KEY (session_id) REFERENCES attendance_sessions(session_id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
);

-- New table for application settings (THIS IS THE ONE YOU NEED TO ENSURE IS THERE)
CREATE TABLE IF NOT EXISTS app_settings (
    setting_key VARCHAR(100) PRIMARY KEY NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ===== PERFORMANCE OPTIMIZATION INDEXES =====
-- Basic indexes (existing)
CREATE INDEX idx_faculties_email ON faculties(email);
CREATE INDEX idx_subjects_department ON subjects(department_id);
CREATE INDEX idx_students_roll_number ON students(roll_number);
CREATE INDEX idx_attendance_sessions_subject ON attendance_sessions(subject_id);
CREATE INDEX idx_attendance_records_session_student ON attendance_records(session_id, student_id);
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_qrcode_status ON attendance_sessions(qr_code_data, status);

-- ===== HIGH-CONCURRENCY OPTIMIZATION INDEXES =====
-- Critical for QR performance: Active QR sessions only
CREATE INDEX idx_attendance_sessions_qrcode_active ON attendance_sessions(qr_code_data) WHERE status = 'open';

-- New indexes for QR sequence and expiration
CREATE INDEX idx_attendance_sessions_qr_expires ON attendance_sessions(qr_expires_at) WHERE status = 'open';
CREATE INDEX idx_attendance_sessions_sequence ON attendance_sessions(session_id, qr_sequence_number);

-- Optimize attendance record lookups
CREATE INDEX idx_attendance_records_session_status ON attendance_records(session_id, status);
CREATE INDEX idx_attendance_records_student_session ON attendance_records(student_id, session_id);

-- Optimize enrollment checks (frequently used in QR validation)
CREATE INDEX idx_enrollments_student_subject ON enrollments(student_id, subject_id);
CREATE INDEX idx_enrollments_subject_student ON enrollments(subject_id, student_id);

-- Optimize session queries by date and status
CREATE INDEX idx_attendance_sessions_date_status ON attendance_sessions(session_date, status);
CREATE INDEX idx_attendance_sessions_faculty_date ON attendance_sessions(faculty_id, session_date);

-- Composite indexes for common query patterns
CREATE INDEX idx_attendance_records_session_student_status ON attendance_records(session_id, student_id, status);
CREATE INDEX idx_attendance_sessions_subject_date_status ON attendance_sessions(subject_id, session_date, status);

-- ===== PARTITIONING RECOMMENDATION =====
-- For very large universities (10,000+ students), consider partitioning attendance_records by date
-- This would require PostgreSQL 10+ and careful planning

-- ===== CONNECTION POOLING CONFIGURATION =====
-- Add to postgresql.conf for high concurrency:
-- max_connections = 200
-- shared_buffers = 256MB
-- effective_cache_size = 1GB
-- work_mem = 4MB
-- maintenance_work_mem = 64MB
-- checkpoint_completion_target = 0.9
-- wal_buffers = 16MB
-- default_statistics_target = 100