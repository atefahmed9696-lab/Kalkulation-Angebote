const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = 3001;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Anfragen – bitte später erneut versuchen.' }
});
const scanLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: { error: 'Scan-Limit erreicht – bitte 1 Minute warten.' }
});
app.use('/api/', apiLimiter);
app.use('/api/receipts/scan', scanLimiter);

// Serve uploaded images
app.use('/uploads', express.static(uploadsDir));

// Routes
const projectsRouter = require('./routes/projects');
const { router: receiptsRouter } = require('./routes/receipts');
const exportRouter = require('./routes/export');

app.use('/api/projects', projectsRouter);
app.use('/api/receipts', receiptsRouter);
app.use('/api/export', exportRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Interner Serverfehler', details: err.message });
});

app.listen(PORT, () => {
  console.log(`Beleg-Scanner Backend läuft auf http://localhost:${PORT}`);
});
