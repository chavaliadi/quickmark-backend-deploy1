--
-- PostgreSQL database dump
--
-- Cleaned for Render deployment: removed superuser-only SET/ALTER/OWNER/ROLE statements

-- Dumped from database version 17.5
-- Dumped by pg_dump version 17.5 (Homebrew)

-- EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;
COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';

-- ENUM TYPES
CREATE TYPE public.attendance_record_status AS ENUM ('present','absent','late');
CREATE TYPE public.attendance_status AS ENUM ('open','closed','completed','cancelled');

-- TABLES
CREATE TABLE public.admins (
    admin_id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.app_settings (
    setting_key character varying(100) NOT NULL,
    setting_value text NOT NULL,
    description text,
    last_updated timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.attendance_records (
    record_id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    student_id uuid NOT NULL,
    status public.attendance_record_status DEFAULT 'absent'::public.attendance_record_status NOT NULL,
    attended_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.attendance_sessions (
    session_id uuid DEFAULT gen_random_uuid() NOT NULL,
    subject_id uuid NOT NULL,
    faculty_id uuid NOT NULL,
    session_date date NOT NULL,
    start_time time with time zone NOT NULL,
    end_time time with time zone,
    status public.attendance_status DEFAULT 'open'::public.attendance_status,
    qr_code_data text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    qr_sequence_number integer DEFAULT 0,
    qr_expires_at timestamp with time zone,
    attendance_weight integer,
    CONSTRAINT attendance_sessions_attendance_weight_check CHECK (((attendance_weight >= 1) AND (attendance_weight <= 4)))
);

COMMENT ON COLUMN public.attendance_sessions.attendance_weight IS 'Weight assigned to this attendance session (1-4) by faculty when submitting attendance';

CREATE TABLE public.departments (
    department_id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.enrollments (
    enrollment_id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    enrolled_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.faculties (
    faculty_id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    department_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    designation character varying(100) DEFAULT 'Faculty'::character varying NOT NULL
);

CREATE TABLE public.faculty_subjects (
    faculty_id uuid NOT NULL,
    subject_id uuid NOT NULL
);

CREATE TABLE public.students (
    student_id uuid DEFAULT gen_random_uuid() NOT NULL,
    roll_number character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255),
    password_hash character varying(255) NOT NULL,
    department_id uuid NOT NULL,
    current_year integer,
    section character varying(10),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.subjects (
    subject_id uuid DEFAULT gen_random_uuid() NOT NULL,
    subject_name character varying(255) NOT NULL,
    department_id uuid NOT NULL,
    year integer NOT NULL,
    section character varying(10) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    semester integer,
    subject_code character varying(10) NOT NULL,
    CONSTRAINT chk_semester CHECK ((semester = ANY (ARRAY[1, 2])))
);

CREATE TABLE public.users (
    id serial PRIMARY KEY,
    email character varying(255) NOT NULL UNIQUE,
    password_hash character varying(255) NOT NULL,
    name character varying(255),
    role character varying(50) DEFAULT 'student'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- CONSTRAINTS
ALTER TABLE ONLY public.admins ADD CONSTRAINT admins_email_key UNIQUE (email);
ALTER TABLE ONLY public.admins ADD CONSTRAINT admins_pkey PRIMARY KEY (admin_id);
ALTER TABLE ONLY public.app_settings ADD CONSTRAINT app_settings_pkey PRIMARY KEY (setting_key);
ALTER TABLE ONLY public.attendance_records ADD CONSTRAINT attendance_records_pkey PRIMARY KEY (record_id);
ALTER TABLE ONLY public.attendance_records ADD CONSTRAINT attendance_records_session_id_student_id_key UNIQUE (session_id, student_id);
ALTER TABLE ONLY public.attendance_sessions ADD CONSTRAINT attendance_sessions_pkey PRIMARY KEY (session_id);
ALTER TABLE ONLY public.departments ADD CONSTRAINT departments_name_key UNIQUE (name);
ALTER TABLE ONLY public.departments ADD CONSTRAINT departments_pkey PRIMARY KEY (department_id);
ALTER TABLE ONLY public.enrollments ADD CONSTRAINT enrollments_pkey PRIMARY KEY (enrollment_id);
ALTER TABLE ONLY public.enrollments ADD CONSTRAINT enrollments_student_id_subject_id_key UNIQUE (student_id, subject_id);
ALTER TABLE ONLY public.faculties ADD CONSTRAINT faculties_email_key UNIQUE (email);
ALTER TABLE ONLY public.faculties ADD CONSTRAINT faculties_pkey PRIMARY KEY (faculty_id);
ALTER TABLE ONLY public.faculty_subjects ADD CONSTRAINT faculty_subjects_pkey PRIMARY KEY (faculty_id, subject_id);
ALTER TABLE ONLY public.students ADD CONSTRAINT students_email_key UNIQUE (email);
ALTER TABLE ONLY public.students ADD CONSTRAINT students_pkey PRIMARY KEY (student_id);
ALTER TABLE ONLY public.students ADD CONSTRAINT students_roll_number_key UNIQUE (roll_number);
ALTER TABLE ONLY public.subjects ADD CONSTRAINT subjects_pkey PRIMARY KEY (subject_id);
ALTER TABLE ONLY public.subjects ADD CONSTRAINT subjects_subject_name_department_id_year_section_key UNIQUE (subject_name, department_id, year, section);
ALTER TABLE ONLY public.subjects ADD CONSTRAINT unique_subject_code_dept_year_section_semester UNIQUE (subject_code, department_id, year, section, semester);
ALTER TABLE ONLY public.users ADD CONSTRAINT users_email_key UNIQUE (email);
ALTER TABLE ONLY public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);

-- INDEXES
CREATE INDEX idx_admins_email ON public.admins USING btree (email);
CREATE INDEX idx_attendance_records_session_student ON public.attendance_records USING btree (session_id, student_id);
CREATE INDEX idx_attendance_sessions_qr_expires ON public.attendance_sessions USING btree (qr_expires_at) WHERE (status = 'open'::public.attendance_status);
CREATE INDEX idx_attendance_sessions_qrcode_status ON public.attendance_sessions USING btree (qr_code_data, status);
CREATE INDEX idx_attendance_sessions_sequence ON public.attendance_sessions USING btree (session_id, qr_sequence_number);
CREATE INDEX idx_attendance_sessions_subject ON public.attendance_sessions USING btree (subject_id);
CREATE INDEX idx_faculties_email ON public.faculties USING btree (email);
CREATE INDEX idx_students_roll_number ON public.students USING btree (roll_number);
CREATE INDEX idx_subjects_department ON public.subjects USING btree (department_id);

-- FOREIGN KEYS
ALTER TABLE ONLY public.attendance_records ADD CONSTRAINT attendance_records_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.attendance_sessions(session_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.attendance_sessions ADD CONSTRAINT attendance_sessions_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.faculties(faculty_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.attendance_sessions ADD CONSTRAINT attendance_sessions_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(subject_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.enrollments ADD CONSTRAINT enrollments_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(subject_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.faculty_subjects ADD CONSTRAINT faculty_subjects_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.faculties(faculty_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.faculty_subjects ADD CONSTRAINT faculty_subjects_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(subject_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.faculties ADD CONSTRAINT fk_department FOREIGN KEY (department_id) REFERENCES public.departments(department_id) ON DELETE SET NULL;
ALTER TABLE ONLY public.students ADD CONSTRAINT fk_student_department FOREIGN KEY (department_id) REFERENCES public.departments(department_id) ON DELETE RESTRICT;
ALTER TABLE ONLY public.subjects ADD CONSTRAINT fk_subject_department FOREIGN KEY (department_id) REFERENCES public.departments(department_id) ON DELETE RESTRICT;

-- PostgreSQL database dump complete