import express from 'express';
import bcrypt from 'bcryptjs';
import { db, ClassroomConfig, User } from '../store';
import { authMiddleware } from './auth';
import { getEmailLogs } from '../mailer';

const router = express.Router();

// System stats
router.get('/stats', authMiddleware, (req, res) => {
  const students = db.users.filter((u) => u.role === 'student');
  const faculty = db.users.filter((u) => u.role === 'faculty');
  const wardens = db.users.filter((u) => u.role === 'warden');
  const activeSessions = db.sessions.filter((s) => s.isActive);

  return res.json({
    totalUsers: db.users.length,
    studentsCount: students.length,
    facultyCount: faculty.length,
    wardensCount: wardens.length,
    activeSessionsCount: activeSessions.length,
    totalAttendanceScans: db.attendance.length,
    hostelCurfewTime: db.hostelConfig.curfewTime,
    classroomsCount: db.classrooms.length,
  });
});

// Users management
router.get('/users', authMiddleware, (req, res) => {
  const usersSafe = db.users.map(({ passwordHash, ...u }) => u);
  return res.json({ users: usersSafe });
});

router.post('/users', authMiddleware, (req, res) => {
  const { name, email, password, role, rollNumber, department, guardianEmail, hostelDetails } = req.body;
  if (!name || !email || !role) {
    return res.status(400).json({ error: 'Name, email, and role are required' });
  }

  const existing = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'User with this email already exists' });
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password || 'pass123', salt);

  const newUser: User = {
    _id: `usr-${Date.now()}`,
    name,
    email,
    passwordHash,
    role,
    rollNumber,
    department,
    guardianEmail,
    hostelDetails: hostelDetails || { isHosteler: false },
    createdAt: new Date().toISOString(),
  };

  db.users.push(newUser);
  db.save();
  const { passwordHash: _, ...safeUser } = newUser;
  return res.json({ success: true, user: safeUser });
});

// Admin set password for specific user (student, warden, faculty)
router.put('/users/:id/password', authMiddleware, (req, res) => {
  const authUser = (req as any).user;
  if (authUser.role !== 'admin') {
    return res.status(403).json({ error: 'Only administrators have authority to set user passwords' });
  }

  const { id } = req.params;
  const { password } = req.body;

  if (!password || password.trim().length === 0) {
    return res.status(400).json({ error: 'Password cannot be empty' });
  }

  const user = db.users.find((u) => u._id === id);
  if (!user) {
    return res.status(404).json({ error: 'User account not found' });
  }

  const salt = bcrypt.genSaltSync(10);
  user.passwordHash = bcrypt.hashSync(password.trim(), salt);
  db.save();

  return res.json({
    success: true,
    message: `Password successfully updated for ${user.name} (${user.role}).`,
    userId: user._id,
  });
});

// Admin batch reset passwords for all users of a role (e.g. all students, all faculty, all wardens)
router.post('/batch-reset-password', authMiddleware, (req, res) => {
  const authUser = (req as any).user;
  if (authUser.role !== 'admin') {
    return res.status(403).json({ error: 'Only administrators have authority to reset passwords' });
  }

  const { role, defaultPassword = 'pass123' } = req.body;
  if (!role) {
    return res.status(400).json({ error: 'Target role is required (student, faculty, warden, or all)' });
  }

  const salt = bcrypt.genSaltSync(10);
  const newHash = bcrypt.hashSync(defaultPassword, salt);
  let affectedCount = 0;

  db.users.forEach((user) => {
    if (role === 'all' || user.role === role) {
      user.passwordHash = newHash;
      affectedCount++;
    }
  });
  db.save();

  return res.json({
    success: true,
    message: `Default password "${defaultPassword}" applied to ${affectedCount} accounts (${role}).`,
    affectedCount,
  });
});

// Classrooms
router.get('/classrooms', (req, res) => {
  return res.json({ classrooms: db.classrooms });
});

router.post('/classrooms', authMiddleware, (req, res) => {
  const { name, block, latitude, longitude, maxRadiusMeters } = req.body;
  if (!name || typeof latitude !== 'number' || typeof longitude !== 'number') {
    return res.status(400).json({ error: 'Classroom name, latitude, and longitude are required' });
  }

  const newClassroom: ClassroomConfig = {
    id: `cr-${Date.now()}`,
    name,
    block: block || 'Main Academic Block',
    latitude,
    longitude,
    maxRadiusMeters: maxRadiusMeters || 50,
  };

  db.classrooms.push(newClassroom);
  db.save();
  return res.json({ success: true, classroom: newClassroom });
});

router.put('/classrooms/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { name, latitude, longitude, maxRadiusMeters, block } = req.body;
  const classroom = db.classrooms.find((c) => c.id === id);

  if (!classroom) {
    return res.status(404).json({ error: 'Classroom not found' });
  }

  if (name) classroom.name = name;
  if (block) classroom.block = block;
  if (typeof latitude === 'number') classroom.latitude = latitude;
  if (typeof longitude === 'number') classroom.longitude = longitude;
  if (typeof maxRadiusMeters === 'number') classroom.maxRadiusMeters = maxRadiusMeters;
  db.save();

  return res.json({ success: true, classroom });
});

// Hostel Configuration (Curfew timing, blocks)
router.get('/hostel-config', (req, res) => {
  return res.json({ config: db.hostelConfig });
});

router.post('/hostel-config', authMiddleware, (req, res) => {
  const { curfewTime } = req.body;
  if (curfewTime) {
    db.hostelConfig.curfewTime = curfewTime;
    db.save();
  }
  return res.json({ success: true, config: db.hostelConfig });
});

// Database Persistence & Backup/Restore Endpoints (Admin only)
router.get('/database/status', authMiddleware, (req, res) => {
  const authUser = (req as any).user;
  if (authUser.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  return res.json({ status: db.getStatus() });
});

router.get('/database/backup', authMiddleware, (req, res) => {
  const authUser = (req as any).user;
  if (authUser.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  const backup = db.exportData();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="campus_attendance_backup_${new Date().toISOString().split('T')[0]}.json"`
  );
  return res.send(JSON.stringify(backup, null, 2));
});

router.post('/database/restore', authMiddleware, (req, res) => {
  const authUser = (req as any).user;
  if (authUser.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const { backupData } = req.body;
  if (!backupData) {
    return res.status(400).json({ error: 'Backup data payload is required' });
  }

  try {
    const result = db.importData(backupData);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to restore database backup' });
  }
});

router.post('/database/reset-demo', authMiddleware, (req, res) => {
  const authUser = (req as any).user;
  if (authUser.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  db.resetToDefaultSeed();
  return res.json({
    success: true,
    message: 'System database successfully reset to default demonstration records and saved to persistent disk.',
    status: db.getStatus(),
  });
});

// Email and alert logs
router.get('/notifications/logs', authMiddleware, (req, res) => {
  return res.json({ logs: getEmailLogs() });
});

export default router;
