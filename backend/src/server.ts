import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { pool } from './config/database';
import logger from './config/logger';

// Import routes
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import organizationRoutes from './routes/organization.routes';
import projectRoutes from './routes/project.routes';
import taskRoutes from './routes/task.routes';
import calendarRoutes from './routes/calendar.routes';
import driveRoutes from './routes/drive.routes';
import sheetsRoutes from './routes/sheets.routes';
import invitationRoutes from './routes/invitation.routes';
import activityRoutes from './routes/activity.routes';
import notificationRoutes from './routes/notification.routes';
import commentRoutes from './routes/comment.routes';
import timeEntryRoutes from './routes/timeEntry.routes';
import widgetRoutes from './routes/widget.routes';
import workspaceRoutes from './routes/workspace.routes';
import reportsRoutes from './routes/reports.routes';
import teamGroupRoutes from './routes/team-group.routes';
import analyticsRoutes from './routes/analytics.routes';
import wbsRoutes from './routes/wbs.routes';
import scholarRoutes from './routes/scholar.routes';
import { runAutoMigrations } from './services/migration.service';
import passport from 'passport';
import { apiLimiter, authLimiter, aiLimiter } from './middleware/rateLimit.middleware';

dotenv.config();

const app: Application = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
});
const PORT = process.env.PORT || 5000;

// Socket.io connection handling
io.on('connection', (socket) => {
  logger.info(`🔌 Client connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    logger.info(`🔌 Client disconnected: ${socket.id}`);
  });
});

// Export io for use in other modules
export { io };

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());
app.use(morgan('combined', {
  stream: {
    write: (message: string) => logger.info(message.trim()),
  },
}));

// Health check endpoint - responds even if DB is not connected
let dbConnected = false;
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'SkyFlow Backend API',
    database: dbConnected ? 'connected' : 'connecting'
  });
});

// Apply Rate Limiters
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/scholar/ai', aiLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/projects', projectRoutes);
// Comment routes must come BEFORE task routes to handle /api/tasks/:id/comments correctly
app.use('/api', commentRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/drive', driveRoutes);
app.use('/api/sheets', sheetsRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api', activityRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api', timeEntryRoutes);
app.use('/api', widgetRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api', teamGroupRoutes);
app.use('/api', analyticsRoutes);
app.use('/api/wbs', wbsRoutes);

// ScholarSync Academic Routes (Auth, Courses, Groups, Enrollment, etc.)
// Moving under /api to avoid root conflicts and ensure consistent pathing
app.use('/api/scholar', scholarRoutes);

// 404 handler for API
app.use('/api/*', (req: Request, res: Response) => {
  logger.warn(`API 404: ${req.method} ${req.path}`);
  res.status(404).json({ error: `Route not found: ${req.path}` });
});

// Root catch-all (for SPA/Frontend support if needed, but here just a clean 404)
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: any) => {
  logger.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Start server - bind port FIRST, then connect to database
const startServer = async () => {
  // Start listening immediately so health checks pass
  httpServer.listen(PORT, () => {
    logger.info(`🚀 SkyFlow Backend API running on port ${PORT}`);
    logger.info(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
    logger.info(`🔌 Socket.io enabled for real-time updates`);
  });

  // Then try to connect to database
  try {
    await pool.query('SELECT NOW()');
    dbConnected = true;
    logger.info('✅ Database connection established');

    // Run auto-migrations to ensure schema is up to date
    await runAutoMigrations();
    logger.info('✅ Migrations completed');
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    // Don't exit - keep server running so we can debug via health endpoint
  }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');
  await pool.end();
  process.exit(0);
});

startServer();

export default app;
