import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { errorHandler } from './middlewares/error.middleware';
import { setupSwagger } from './lib/swagger';
import routes from './routes';

const app: Express = express();

// CORS — supports Railway deployment; configure ALLOWED_ORIGINS env var with
// comma-separated list of allowed frontend origins (e.g. https://marketos.up.railway.app)
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['*'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Swagger)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin) || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
        return callback(null, true);
      }
      return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-workspace-id'],
  })
);
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Setup Swagger UI
setupSwagger(app);

// ── Root redirect → Production Frontend ───────────────────────────────────────
// Redirects any root visit to the actual production frontend.
const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://digitalmarketingagent-production.up.railway.app').replace(/\/$/, '');

app.get('/', (_req, res) => res.redirect(302, FRONTEND_URL));


/**
 * @openapi
 * /health:
 *   get:
 *     summary: Check API Health
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Successful operation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 timestamp:
 *                   type: string
 */
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/v1', routes);

// Global Error Handling
app.use(errorHandler);

export default app;
