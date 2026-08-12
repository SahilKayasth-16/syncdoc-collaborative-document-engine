import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import healthRouter from './routes/health.routes.js';
import documentRouter from './routes/document.routes.js';

// Load environment variables
dotenv.config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// API routing
app.use('/api', healthRouter);
app.use('/api/documents', documentRouter)

// Basic centralized error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    status: 'Error',
    message: err.message || 'Internal Server Error'
  });
});

export default app;
