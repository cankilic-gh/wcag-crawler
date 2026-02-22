import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { initializeDatabase } from './db/database.js';
import { createScanRoutes } from './routes/scan.routes.js';
import { createReportRoutes } from './routes/report.routes.js';
import { logger } from './utils/logger.js';

const PORT = process.env.PORT || 3001;

// Initialize Express app
const app = express();
const httpServer = createServer(app);

// CORS configuration
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map(url => url.trim())
  : ['http://localhost:5173'];

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      callback(null, true);
      return;
    }
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  credentials: true,
};

// Initialize Socket.IO
const io = new SocketServer(httpServer, {
  cors: corsOptions,
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/scans', createScanRoutes(io));
app.use('/api/reports', createReportRoutes());

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info('Client connected', { socketId: socket.id });

  // Join scan room for real-time updates
  socket.on('scan:join', (scanId: string) => {
    socket.join(scanId);
    logger.debug('Client joined scan room', { socketId: socket.id, scanId });
  });

  // Leave scan room
  socket.on('scan:leave', (scanId: string) => {
    socket.leave(scanId);
    logger.debug('Client left scan room', { socketId: socket.id, scanId });
  });

  // Handle scan cancellation request
  socket.on('scan:cancel', (scanId: string) => {
    logger.info('Scan cancel requested', { socketId: socket.id, scanId });
    // The actual cancellation is handled by the POST /api/scans/:id/cancel endpoint
  });

  socket.on('disconnect', () => {
    logger.debug('Client disconnected', { socketId: socket.id });
  });
});

// Initialize database and start server
async function start() {
  try {
    // Ensure data directory exists
    const { mkdirSync } = await import('fs');
    const { join, dirname } = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = dirname(fileURLToPath(import.meta.url));
    mkdirSync(join(__dirname, '../data'), { recursive: true });

    // Initialize database
    initializeDatabase();
    logger.info('Database initialized');

    // Start server
    httpServer.listen(PORT, () => {
      logger.info(`Server running on http://localhost:${PORT}`);
      logger.info(`Socket.IO ready for connections`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error: (error as Error).message });
    process.exit(1);
  }
}

start();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down...');
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});
