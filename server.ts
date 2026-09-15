import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

import authRoutes from './server/routes/auth';
import academicRoutes from './server/routes/academic';
import hostelRoutes from './server/routes/hostel';
import adminRoutes from './server/routes/admin';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/academic', academicRoutes);
  app.use('/api/attendance', academicRoutes); // also maps /api/attendance/verify
  app.use('/api/hostel', hostelRoutes);
  app.use('/api', hostelRoutes); // also maps /api/outpass
  app.use('/api/admin', adminRoutes);

  // Vite middleware for development vs static build in production
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    (typeof __filename !== 'undefined' && __filename.endsWith('.cjs')) ||
    Boolean(process.argv[1]?.endsWith('.cjs'));

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Smart Attendance System] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
