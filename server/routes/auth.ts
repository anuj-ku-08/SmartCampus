import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db, User } from '../store';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'academic-hostel-jwt-secret-key-2026';

export function signToken(user: User): string {
  return jwt.sign(
    {
      userId: user._id,
      email: user.email,
      role: user.role,
      name: user.name,
      rollNumber: user.rollNumber,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    (req as any).user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }
}

// Login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials. User not registered.' });
  }

  const isValidPassword = bcrypt.compareSync(password, user.passwordHash);
  if (!isValidPassword) {
    return res.status(401).json({ error: 'Invalid credentials. Incorrect password.' });
  }

  const token = signToken(user);
  const { passwordHash, ...userSafe } = user;
  return res.json({ token, user: userSafe });
});

// Demo switch role (convenient instant access for testing all 4 roles)
router.post('/demo-login', (req, res) => {
  const { role, email } = req.body;
  let user: User | undefined;

  if (email) {
    user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  } else if (role) {
    user = db.users.find((u) => u.role === role);
  }

  if (!user) {
    user = db.users[0]; // fallback
  }

  const token = signToken(user);
  const { passwordHash, ...userSafe } = user;
  return res.json({ token, user: userSafe });
});

// Get current user profile
router.get('/me', authMiddleware, (req, res) => {
  const authUser = (req as any).user;
  const user = db.users.find((u) => u._id === authUser.userId);
  if (!user) {
    return res.status(404).json({ error: 'User profile not found' });
  }
  const { passwordHash, ...userSafe } = user;
  return res.json({ user: userSafe });
});

// Get demo accounts list
router.get('/demo-accounts', (req, res) => {
  const demoUsers = db.users.map((u) => ({
    _id: u._id,
    name: u.name,
    email: u.email,
    role: u.role,
    rollNumber: u.rollNumber,
    department: u.department,
    hostelDetails: u.hostelDetails,
  }));
  return res.json({ demoUsers });
});

// Self-service reset password for students, faculty, warden
router.post('/reset-password', (req, res) => {
  const { identifier, newPassword } = req.body;
  if (!identifier) {
    return res.status(400).json({ error: 'Institutional email or roll number is required' });
  }

  const query = identifier.trim().toLowerCase();
  const user = db.users.find(
    (u) =>
      u.email.toLowerCase() === query ||
      (u.rollNumber && u.rollNumber.toLowerCase() === query)
  );

  if (!user) {
    return res.status(404).json({ error: 'No account registered with that email or roll number.' });
  }

  const targetPassword = newPassword && newPassword.trim().length > 0 ? newPassword.trim() : 'pass123';
  const salt = bcrypt.genSaltSync(10);
  user.passwordHash = bcrypt.hashSync(targetPassword, salt);

  return res.json({
    success: true,
    message: `Password has been reset successfully for ${user.name}. You may now log in with your new password.`,
    userEmail: user.email,
    userName: user.name,
  });
});

export default router;
