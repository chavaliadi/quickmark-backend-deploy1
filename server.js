const express = require('express');
const dotenv = require('dotenv');
const { pool, healthCheck } = require('./config/db');
const cors = require('cors');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3700;

// CORS Configuration
const corsOptions = {
  origin: [
    'http://localhost:3000',    // React default
    'http://localhost:5173',    // Vite default (admin)
    'http://localhost:5174',    // Vite default (faculty)
    'http://localhost:5175',    // Vite default (faculty)
    'http://localhost:4173',    // Vite preview
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:5175',
    'http://127.0.0.1:4173',
    // Add production URLs when deployed
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};

// Middleware
app.use(express.json());
app.use(cors(corsOptions));

// Import Routes
const authRoutes = require('./routes/authRoutes');         // For faculty auth
const facultyRoutes = require('./routes/facultyRoutes');
const subjectRoutes = require('./routes/subjectRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const adminRoutes = require('./routes/adminRoutes');       // For ALL admin operations, including admin auth
const studentRoutes = require('./routes/studentRoutes');

// Use Routes - Ensure each main path maps to its correct router
app.use('/api/auth', authRoutes);           // Handles faculty login/register
app.use('/api/faculty', facultyRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/admin', adminRoutes);         // Crucial: This mounts adminRoutes for /api/admin/*
app.use('/api/student', studentRoutes);

// Basic root route
app.get('/', (req, res) => {
    res.send('Welcome to the QuickMark API!');
});

// Health check endpoint for monitoring
app.get('/health', async (req, res) => {
    const dbHealthy = await healthCheck();
    res.status(dbHealthy ? 200 : 503).json({
        status: dbHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        database: dbHealthy ? 'connected' : 'disconnected'
    });
});

// Database Connection Test
pool.query('SELECT NOW()')
    .then(() => console.log('Successfully connected to PostgreSQL database!'))
    .catch(err => console.error('Error connecting to the database:', err));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ message: 'Internal server error' });
});

// 404 handler for undefined routes
app.use('*', (req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check available at: http://localhost:${PORT}/health`);
    console.log(`CORS enabled for origins: ${corsOptions.origin.join(', ')}`);
});