import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { initializeDatabase } from './db/database.js';
import { createScanRoutes } from './routes/scan.routes.js';
import { createReportRoutes } from './routes/report.routes.js';
import { createSystemRoutes } from './routes/system.routes.js';
import { createAuthRoutes } from './routes/auth.routes.js';
import { logger } from './utils/logger.js';
import { createOptionalAuthMiddleware } from './auth/middleware.js';
import { GoogleIdentityVerifier } from './auth/google-identity-verifier.js';
import { resolveAuthRuntimeConfig } from './auth/runtime-config.js';
import { createSocketAccessAuthorizer } from './auth/socket-access.js';
import { publicNetworkProxy } from './auth/public-network-proxy.js';

const PORT = process.env.PORT || 3001;
const { googleClientId, adminEmails } = resolveAuthRuntimeConfig(process.env);
const identityVerifier = googleClientId
  ? new GoogleIdentityVerifier(googleClientId)
  : { verify: async () => { throw new Error('Google authentication is not configured'); } };
const authOptions = { verifier: identityVerifier, adminEmails };
const authorizeSocketJoin = createSocketAccessAuthorizer(authOptions);

// Initialize Express app
const app = express();
const httpServer = createServer(app);
// Render terminates TLS at one trusted reverse proxy; required for per-IP rate limits.
app.set('trust proxy', 1);

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

// Initialize Socket.IO with extended timeouts for heavy scan operations
// better-sqlite3 runs synchronous queries that block the event loop,
// so we need generous ping timeouts to prevent disconnects during scans
const io = new SocketServer(httpServer, {
  cors: corsOptions,
  pingTimeout: 120000,
  pingInterval: 30000,
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use('/api', createOptionalAuthMiddleware(authOptions));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', createAuthRoutes({ googleClientId }));
app.use('/api/scans', createScanRoutes(io));
app.use('/api/reports', createReportRoutes());
app.use('/api/system', createSystemRoutes());

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info('Client connected', { socketId: socket.id });

  // Join scan room for real-time updates
  socket.on('scan:join', async (payload: unknown, acknowledge?: (result: { ok: boolean }) => void) => {
    const allowed = await authorizeSocketJoin(payload);
    if (!allowed) {
      acknowledge?.({ ok: false });
      return;
    }
    const scanId = (payload as { scanId: string }).scanId;
    await socket.join(scanId);
    acknowledge?.({ ok: true });
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

    // Start server - bind to 0.0.0.0 for container environments
    httpServer.listen(Number(PORT), '0.0.0.0', () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Socket.IO ready for connections`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error: (error as Error).message });
    process.exit(1);
  }
}

start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down...');
  await publicNetworkProxy.close();
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});
