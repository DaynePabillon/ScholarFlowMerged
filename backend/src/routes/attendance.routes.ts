import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/attendance/student/:studentId - Get student attendance
// GET /api/attendance/class/:classId - Get class attendance
// POST /api/attendance/record - Record attendance
// POST /api/attendance/bulk - Bulk record attendance
// GET /api/attendance/stats/:studentId - Get attendance statistics

export default router;
