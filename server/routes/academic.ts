import express from 'express';
import { db, AcademicSession, AcademicAttendance } from '../store';
import { generateRollingToken, verifyRollingToken } from '../cryptoToken';
import { calculateHaversineDistance } from '../geoDistance';
import { authMiddleware } from './auth';
import { sendEmailAlert } from '../mailer';

const router = express.Router();

// Get active sessions
router.get('/sessions/active', (req, res) => {
  const activeSessions = db.sessions.filter((s) => s.isActive);
  return res.json({ sessions: activeSessions });
});

// Start a new Academic Lecture Attendance Session (Faculty)
router.post('/sessions', authMiddleware, (req, res) => {
  const { subjectName, subjectCode, classroomId, customCoordinates } = req.body;
  const user = (req as any).user;

  if (user.role !== 'faculty' && user.role !== 'admin') {
    return res.status(403).json({ error: 'Only faculty members can launch lecture attendance sessions' });
  }

  if (!subjectName || !subjectCode) {
    return res.status(400).json({ error: 'Subject Name and Subject Code are required' });
  }

  let classroom = db.classrooms.find((c) => c.id === classroomId) || db.classrooms[0];
  let coords = {
    latitude: classroom.latitude,
    longitude: classroom.longitude,
    maxRadiusMeters: classroom.maxRadiusMeters || 50,
  };

  if (customCoordinates && typeof customCoordinates.latitude === 'number') {
    coords = {
      latitude: customCoordinates.latitude,
      longitude: customCoordinates.longitude,
      maxRadiusMeters: customCoordinates.maxRadiusMeters || 50,
    };
  }

  const sessionId = `sess-${Date.now()}`;
  const initialToken = generateRollingToken(sessionId, 1, 10000);

  const newSession: AcademicSession = {
    _id: sessionId,
    subjectName,
    subjectCode,
    facultyId: user.userId,
    facultyName: user.name,
    classroomName: classroom.name,
    classroomCoordinates: coords,
    currentSecretToken: initialToken.token,
    tokenExpiresAt: initialToken.expiresAt,
    tokenSequence: 1,
    isActive: true,
    startedAt: new Date().toISOString(),
  };

  // Close any existing active sessions by this faculty member
  db.sessions.forEach((s) => {
    if (s.facultyId === user.userId && s.isActive) {
      s.isActive = false;
      s.endedAt = new Date().toISOString();
    }
  });

  db.sessions.unshift(newSession);
  db.save();

  return res.json({
    session: newSession,
    token: initialToken.token,
    expiresAt: initialToken.expiresAt,
    ttl: 10000,
    seq: 1,
  });
});

// Fetch latest rolling token for a session (Called every ~10s or polled)
router.get('/sessions/:id/token', (req, res) => {
  const { id } = req.params;
  const session = db.sessions.find((s) => s._id === id);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (!session.isActive) {
    return res.status(400).json({ error: 'Session is no longer active' });
  }

  const now = Date.now();
  // If current token is expired or within 1s of expiry, roll to next token
  if (now >= session.tokenExpiresAt - 1000) {
    const nextSeq = session.tokenSequence + 1;
    const nextToken = generateRollingToken(session._id, nextSeq, 10000);
    session.currentSecretToken = nextToken.token;
    session.tokenExpiresAt = nextToken.expiresAt;
    session.tokenSequence = nextSeq;
  }

  return res.json({
    sessionId: session._id,
    token: session.currentSecretToken,
    expiresAt: session.tokenExpiresAt,
    ttl: 10000,
    seq: session.tokenSequence,
    serverTime: Date.now(),
  });
});

// Get session details and live attendee list
router.get('/sessions/:id', (req, res) => {
  const { id } = req.params;
  const session = db.sessions.find((s) => s._id === id);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const attendees = db.attendance.filter((a) => a.sessionId === id);

  return res.json({
    session,
    attendees,
    totalCount: attendees.length,
  });
});

// Stop session (Faculty)
router.post('/sessions/:id/stop', authMiddleware, (req, res) => {
  const { id } = req.params;
  const session = db.sessions.find((s) => s._id === id);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  session.isActive = false;
  session.endedAt = new Date().toISOString();
  db.save();

  const attendees = db.attendance.filter((a) => a.sessionId === id);

  return res.json({
    message: 'Attendance session concluded successfully',
    session,
    totalAttendees: attendees.length,
  });
});

// Student verify attendance via dynamic rolling QR + GPS
router.post('/verify', authMiddleware, async (req, res) => {
  const { token, latitude, longitude, studentId } = req.body;
  const authUser = (req as any).user;

  const targetStudentId = studentId || authUser.userId;
  const student = db.users.find((u) => u._id === targetStudentId);

  if (!student) {
    return res.status(404).json({ error: 'Student record not found' });
  }

  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return res.status(400).json({
      error: 'Browser GPS coordinates required. Please ensure location permissions are granted.',
    });
  }

  // 1. Verify dynamic 10-second rolling token
  const tokenCheck = verifyRollingToken(token);
  if (!tokenCheck.isValid || !tokenCheck.payload) {
    return res.status(400).json({
      success: false,
      reason: tokenCheck.reason || 'Expired or invalid QR code token',
      code: 'TOKEN_EXPIRED_OR_INVALID',
    });
  }

  const { sessionId } = tokenCheck.payload;
  const session = db.sessions.find((s) => s._id === sessionId);

  if (!session) {
    return res.status(404).json({
      success: false,
      reason: 'Attendance lecture session does not exist',
      code: 'SESSION_NOT_FOUND',
    });
  }

  if (!session.isActive) {
    return res.status(400).json({
      success: false,
      reason: 'This attendance session has already been closed by faculty',
      code: 'SESSION_CLOSED',
    });
  }

  // 2. Prevent duplicate attendance in the same lecture session
  const alreadyMarked = db.attendance.find(
    (a) => a.sessionId === sessionId && a.studentId === student._id
  );

  if (alreadyMarked) {
    return res.status(409).json({
      success: false,
      reason: `Attendance already registered for ${student.name} (${student.rollNumber}) at ${new Date(
        alreadyMarked.scannedAt
      ).toLocaleTimeString()}`,
      code: 'ALREADY_RECORDED',
      attendance: alreadyMarked,
    });
  }

  // 3. Compute Haversine distance from student device to classroom coordinates
  const classroomLat = session.classroomCoordinates.latitude;
  const classroomLon = session.classroomCoordinates.longitude;
  const maxRadius = session.classroomCoordinates.maxRadiusMeters || 50;

  const distanceMeters = calculateHaversineDistance(
    latitude,
    longitude,
    classroomLat,
    classroomLon
  );

  // 4. Geofence evaluation: Distance <= 50 meters
  if (distanceMeters > maxRadius) {
    return res.status(403).json({
      success: false,
      reason: `Geofence violation: Out of range! You are ${distanceMeters} meters away from ${session.classroomName}. Allowed perimeter is ${maxRadius} meters.`,
      code: 'OUT_OF_RANGE',
      distanceMeters,
      maxRadiusMeters: maxRadius,
      classroom: session.classroomName,
    });
  }

  // 5. Success! Record verified attendance
  const newRecord: AcademicAttendance = {
    _id: `att-${Date.now()}-${student._id}`,
    sessionId: session._id,
    studentId: student._id,
    studentName: student.name,
    studentRoll: student.rollNumber || 'N/A',
    subjectCode: session.subjectCode,
    status: 'present',
    scannedAt: new Date().toISOString(),
    deviceCoordinates: {
      latitude,
      longitude,
    },
    distanceMeters,
  };

  db.attendance.push(newRecord);
  db.save();

  return res.json({
    success: true,
    message: 'Attendance successfully verified and recorded!',
    attendance: newRecord,
    distanceMeters,
    subject: session.subjectName,
    subjectCode: session.subjectCode,
  });
});

// Faculty Manual Override for genuine device/network issues
router.post('/manual-override', authMiddleware, (req, res) => {
  const { sessionId, studentRoll, reason } = req.body;
  const authUser = (req as any).user;

  if (authUser.role !== 'faculty' && authUser.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized. Only faculty can execute manual overrides.' });
  }

  const session = db.sessions.find((s) => s._id === sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const student = db.users.find(
    (u) =>
      u.role === 'student' &&
      (u.rollNumber?.toLowerCase() === studentRoll.trim().toLowerCase() ||
        u.email?.toLowerCase() === studentRoll.trim().toLowerCase())
  );

  if (!student) {
    return res.status(404).json({ error: `Student with roll number "${studentRoll}" not found` });
  }

  // Check duplicate
  const existing = db.attendance.find(
    (a) => a.sessionId === sessionId && a.studentId === student._id
  );

  if (existing) {
    return res.status(409).json({ error: 'Student is already marked present for this session' });
  }

  const manualRecord: AcademicAttendance = {
    _id: `att-override-${Date.now()}-${student._id}`,
    sessionId: session._id,
    studentId: student._id,
    studentName: student.name,
    studentRoll: student.rollNumber || 'N/A',
    subjectCode: session.subjectCode,
    status: 'present',
    scannedAt: new Date().toISOString(),
    distanceMeters: 0,
    overrideReason: reason || `Manual faculty override by ${authUser.name}`,
  };

  db.attendance.push(manualRecord);
  db.save();

  return res.json({
    message: `Manual attendance recorded for ${student.name} (${student.rollNumber})`,
    attendance: manualRecord,
  });
});

// Student attendance summary across subjects with percentage & green/amber/red status
router.get('/student/:studentId/summary', (req, res) => {
  const { studentId } = req.params;
  const student = db.users.find((u) => u._id === studentId);

  if (!student) {
    return res.status(404).json({ error: 'Student not found' });
  }

  // Group all attendance records
  const subjectsMap: Record<
    string,
    {
      code: string;
      name: string;
      totalSessions: number;
      attendedSessions: number;
      records: AcademicAttendance[];
    }
  > = {
    CS301: { code: 'CS301', name: 'Data Structures & Algorithms', totalSessions: 24, attendedSessions: 0, records: [] },
    CS302: { code: 'CS302', name: 'Database Management Systems', totalSessions: 24, attendedSessions: 0, records: [] },
    CS303: { code: 'CS303', name: 'Computer Networks', totalSessions: 20, attendedSessions: 0, records: [] },
    CS304: { code: 'CS304', name: 'Theory of Computation', totalSessions: 18, attendedSessions: 0, records: [] },
  };

  const studentRecords = db.attendance.filter((a) => a.studentId === studentId);

  studentRecords.forEach((rec) => {
    if (!subjectsMap[rec.subjectCode]) {
      subjectsMap[rec.subjectCode] = {
        code: rec.subjectCode,
        name: rec.subjectCode,
        totalSessions: 1,
        attendedSessions: 0,
        records: [],
      };
    }
    subjectsMap[rec.subjectCode].records.push(rec);
    if (rec.status === 'present' || rec.status === 'late') {
      subjectsMap[rec.subjectCode].attendedSessions += 1;
    }
  });

  const subjectsSummary = Object.values(subjectsMap).map((sub) => {
    const percentage =
      sub.totalSessions > 0
        ? Math.round((sub.attendedSessions / sub.totalSessions) * 1000) / 10
        : 100;

    let statusTag: 'ELIGIBLE_GREEN' | 'WARNING_AMBER' | 'DEBARRED_RED' = 'ELIGIBLE_GREEN';
    if (percentage < 65) {
      statusTag = 'DEBARRED_RED';
    } else if (percentage < 75) {
      statusTag = 'WARNING_AMBER';
    }

    return {
      code: sub.code,
      name: sub.name,
      totalSessions: sub.totalSessions,
      attendedSessions: sub.attendedSessions,
      percentage,
      statusTag,
    };
  });

  const totalPossible = subjectsSummary.reduce((acc, s) => acc + s.totalSessions, 0);
  const totalAttended = subjectsSummary.reduce((acc, s) => acc + s.attendedSessions, 0);
  const overallPercentage =
    totalPossible > 0 ? Math.round((totalAttended / totalPossible) * 1000) / 10 : 100;

  return res.json({
    student: {
      _id: student._id,
      name: student.name,
      rollNumber: student.rollNumber,
      department: student.department,
    },
    overallPercentage,
    subjects: subjectsSummary,
    recentScans: studentRecords.slice(-10).reverse(),
  });
});

// Trigger low-attendance warning email
router.post('/send-warning-alert', authMiddleware, async (req, res) => {
  const { studentRoll, subjectCode, currentPercentage } = req.body;
  const student = db.users.find(
    (u) => u.rollNumber?.toLowerCase() === studentRoll.trim().toLowerCase()
  );

  if (!student) {
    return res.status(404).json({ error: 'Student not found' });
  }

  const alert = await sendEmailAlert({
    recipientEmail: student.guardianEmail || student.email,
    recipientName: `${student.name} (Guardian / Student)`,
    studentRoll: student.rollNumber || 'N/A',
    alertType: 'LOW_ATTENDANCE',
    subject: `[ATTENDANCE SHORTAGE] Critical Academic Warning for ${student.name} (${student.rollNumber})`,
    content: `Student has fallen to ${currentPercentage}% in subject ${subjectCode}. Mandatory examination threshold is 75%. Immediate attendance recovery required.`,
  });

  return res.json({ success: true, alert });
});

export default router;
