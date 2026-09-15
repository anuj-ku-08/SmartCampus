import express from 'express';
import { db, HostelLog, Outpass, User } from '../store';
import { authMiddleware } from './auth';
import { sendEmailAlert } from '../mailer';

const router = express.Router();

// Get hierarchical roster: Block -> Floor -> Room -> Students
router.get('/roster', authMiddleware, (req, res) => {
  const { block, floor, date } = req.query;
  const targetDate = (date as string) || new Date().toISOString().split('T')[0];

  const hostelStudents = db.users.filter(
    (u) => u.role === 'student' && u.hostelDetails?.isHosteler
  );

  // Map today's hostel logs and approved outpasses
  const roster = hostelStudents.map((student) => {
    const details = student.hostelDetails!;
    const log = db.hostelLogs.find(
      (l) => l.date === targetDate && l.studentId === student._id
    );

    // Check active approved outpass for today
    const now = new Date();
    const approvedOutpass = db.outpasses.find((o) => {
      if (o.studentId !== student._id || o.status !== 'approved') return false;
      const from = new Date(o.fromDateTime);
      const to = new Date(o.toDateTime);
      return now >= from && now <= to;
    });

    let effectiveStatus = log?.status || 'inside';
    if (approvedOutpass) {
      effectiveStatus = 'on_leave';
    }

    return {
      studentId: student._id,
      name: student.name,
      rollNumber: student.rollNumber,
      department: student.department,
      phone: student.phone,
      guardianEmail: student.guardianEmail,
      block: details.block || 'Block A (Boys)',
      floor: details.floor || 1,
      roomNumber: details.roomNumber || '101',
      status: effectiveStatus,
      checkInTime: log?.checkInTime,
      remarks: log?.remarks,
      hasApprovedOutpass: !!approvedOutpass,
      outpassDetails: approvedOutpass
        ? {
            id: approvedOutpass._id,
            type: approvedOutpass.passType,
            destination: approvedOutpass.destination,
            toDateTime: approvedOutpass.toDateTime,
          }
        : undefined,
    };
  });

  // Filter if block / floor specified
  let filtered = roster;
  if (block) {
    filtered = filtered.filter((r) => r.block.toLowerCase().includes((block as string).toLowerCase()));
  }
  if (floor) {
    filtered = filtered.filter((r) => r.floor === Number(floor));
  }

  // Available blocks and floors for navigation tabs
  const availableBlocks = Array.from(new Set(hostelStudents.map((s) => s.hostelDetails?.block || 'Block A (Boys)')));
  const availableFloors = [1, 2, 3];

  return res.json({
    date: targetDate,
    roster: filtered,
    availableBlocks,
    availableFloors,
    summary: {
      total: roster.length,
      inside: roster.filter((r) => r.status === 'inside').length,
      absent: roster.filter((r) => r.status === 'absent').length,
      onLeave: roster.filter((r) => r.status === 'on_leave').length,
      lateEntry: roster.filter((r) => r.status === 'late_entry').length,
    },
  });
});

// Warden updates verification status (toggle inside, absent, late_entry, on_leave)
router.post('/verify-status', authMiddleware, (req, res) => {
  const { studentId, status, remarks, date } = req.body;
  const authUser = (req as any).user;

  if (authUser.role !== 'warden' && authUser.role !== 'admin') {
    return res.status(403).json({ error: 'Only hostel wardens can record night roll call statuses' });
  }

  const targetDate = date || new Date().toISOString().split('T')[0];
  const student = db.users.find((u) => u._id === studentId);

  if (!student) {
    return res.status(404).json({ error: 'Hostel student not found' });
  }

  let log = db.hostelLogs.find((l) => l.date === targetDate && l.studentId === studentId);

  if (log) {
    log.status = status;
    log.wardenId = authUser.userId;
    log.updatedAt = new Date().toISOString();
    if (remarks !== undefined) log.remarks = remarks;
    if (status === 'inside' || status === 'late_entry') {
      log.checkInTime = new Date().toISOString();
    }
  } else {
    log = {
      _id: `hl-${Date.now()}-${studentId}`,
      date: targetDate,
      studentId,
      wardenId: authUser.userId,
      status,
      checkInTime: status === 'inside' || status === 'late_entry' ? new Date().toISOString() : undefined,
      remarks,
      updatedAt: new Date().toISOString(),
    };
    db.hostelLogs.push(log);
  }

  return res.json({
    success: true,
    message: `Status updated to "${status}" for ${student.name}`,
    log,
  });
});

// Warden physical ID Barcode / QR Scan rapid verification
router.post('/scan-barcode', authMiddleware, (req, res) => {
  const { barcodeData } = req.body;
  const authUser = (req as any).user;

  if (authUser.role !== 'warden' && authUser.role !== 'admin') {
    return res.status(403).json({ error: 'Only hostel wardens can use supervisor barcode scanner' });
  }

  if (!barcodeData) {
    return res.status(400).json({ error: 'Barcode or Student ID payload required' });
  }

  const trimmed = barcodeData.trim().toUpperCase();
  const student = db.users.find(
    (u) =>
      u.role === 'student' &&
      u.hostelDetails?.isHosteler &&
      (u.rollNumber?.toUpperCase() === trimmed ||
        u._id.toUpperCase() === trimmed ||
        u.email.toUpperCase() === trimmed)
  );

  if (!student) {
    return res.status(404).json({
      success: false,
      error: `No registered hostel resident found matching barcode "${barcodeData}"`,
    });
  }

  const targetDate = new Date().toISOString().split('T')[0];
  let log = db.hostelLogs.find((l) => l.date === targetDate && l.studentId === student._id);

  if (log) {
    log.status = 'inside';
    log.checkInTime = new Date().toISOString();
    log.wardenId = authUser.userId;
    log.remarks = 'Verified via Physical ID Barcode/QR Camera Scan';
    log.updatedAt = new Date().toISOString();
  } else {
    log = {
      _id: `hl-${Date.now()}-${student._id}`,
      date: targetDate,
      studentId: student._id,
      wardenId: authUser.userId,
      status: 'inside',
      checkInTime: new Date().toISOString(),
      remarks: 'Verified via Physical ID Barcode/QR Camera Scan',
      updatedAt: new Date().toISOString(),
    };
    db.hostelLogs.push(log);
  }

  return res.json({
    success: true,
    message: `Physical ID confirmed: ${student.name} (${student.rollNumber}) marked INSIDE Room ${student.hostelDetails?.roomNumber}`,
    student: {
      name: student.name,
      rollNumber: student.rollNumber,
      roomNumber: student.hostelDetails?.roomNumber,
      block: student.hostelDetails?.block,
    },
    log,
  });
});

// Curfew Status & Unaccounted / Missing register
router.get('/curfew-status', authMiddleware, (req, res) => {
  const targetDate = new Date().toISOString().split('T')[0];
  const curfewTime = db.hostelConfig.curfewTime; // e.g. "21:30"
  
  // Calculate if current server time is past curfew
  const now = new Date();
  const [curfewHours, curfewMinutes] = curfewTime.split(':').map(Number);
  const curfewToday = new Date();
  curfewToday.setHours(curfewHours, curfewMinutes, 0, 0);

  const isPastCurfew = now.getTime() >= curfewToday.getTime();

  const hostelStudents = db.users.filter(
    (u) => u.role === 'student' && u.hostelDetails?.isHosteler
  );

  // Unaccounted students: not inside AND no approved outpass
  const unaccounted: any[] = [];
  const verifiedInside: any[] = [];
  const onApprovedLeave: any[] = [];
  const lateEntries: any[] = [];

  hostelStudents.forEach((student) => {
    const log = db.hostelLogs.find(
      (l) => l.date === targetDate && l.studentId === student._id
    );

    const approvedOutpass = db.outpasses.find((o) => {
      if (o.studentId !== student._id || o.status !== 'approved') return false;
      const from = new Date(o.fromDateTime);
      const to = new Date(o.toDateTime);
      return now >= from && now <= to;
    });

    const item = {
      studentId: student._id,
      name: student.name,
      rollNumber: student.rollNumber,
      department: student.department,
      phone: student.phone,
      guardianEmail: student.guardianEmail,
      block: student.hostelDetails?.block,
      floor: student.hostelDetails?.floor,
      roomNumber: student.hostelDetails?.roomNumber,
      status: log?.status || 'inside',
      remarks: log?.remarks,
      checkInTime: log?.checkInTime,
    };

    if (approvedOutpass) {
      onApprovedLeave.push({
        ...item,
        status: 'on_leave',
        outpass: approvedOutpass,
      });
    } else if (log?.status === 'inside') {
      verifiedInside.push(item);
    } else if (log?.status === 'late_entry') {
      lateEntries.push(item);
    } else {
      // Absent or not yet checked in
      unaccounted.push(item);
    }
  });

  return res.json({
    curfewTime,
    isPastCurfew,
    currentServerTime: now.toISOString(),
    unaccountedCount: unaccounted.length,
    unaccounted,
    verifiedInsideCount: verifiedInside.length,
    onApprovedLeaveCount: onApprovedLeave.length,
    lateEntriesCount: lateEntries.length,
  });
});

// Trigger automated emergency curfew breach alert for unaccounted students
router.post('/trigger-curfew-audit', authMiddleware, async (req, res) => {
  const authUser = (req as any).user;
  if (authUser.role !== 'warden' && authUser.role !== 'admin') {
    return res.status(403).json({ error: 'Only wardens can trigger automated curfew breach alerts' });
  }

  const { studentRoll, studentName, roomNumber, guardianEmail } = req.body;

  const alert = await sendEmailAlert({
    recipientEmail: guardianEmail || 'parent.guardian@example.com',
    recipientName: `Guardian of ${studentName}`,
    studentRoll,
    alertType: 'CURFEW_BREACH',
    subject: `🚨 CRITICAL HOSTEL ALERT: Curfew Non-Compliance - ${studentName} (${studentRoll})`,
    content: `Hostel Resident ${studentName} (${studentRoll}), Room ${roomNumber}, has failed to report for the ${db.hostelConfig.curfewTime} Night Roll Call and holds no approved leave outpass. Physical hostel search initiated. Please contact Chief Warden desk immediately.`,
  });

  return res.json({
    success: true,
    message: `Curfew breach alert dispatched to guardian (${alert.recipientEmail}) and logged to incident register`,
    alert,
  });
});

// Outpass: Student list or Warden list
router.get('/outpass', authMiddleware, (req, res) => {
  const authUser = (req as any).user;

  let list = db.outpasses;
  if (authUser.role === 'student') {
    list = list.filter((o) => o.studentId === authUser.userId);
  }

  return res.json({ outpasses: list });
});

// Outpass: Student applies
router.post('/outpass', authMiddleware, (req, res) => {
  const authUser = (req as any).user;
  const { passType, fromDateTime, toDateTime, reason, destination, emergencyContact } = req.body;

  if (!passType || !fromDateTime || !toDateTime || !reason || !destination) {
    return res.status(400).json({ error: 'All fields are mandatory for outpass submission' });
  }

  const student = db.users.find((u) => u._id === authUser.userId);
  if (!student) {
    return res.status(404).json({ error: 'Student record not found' });
  }

  const newOutpass: Outpass = {
    _id: `out-${Date.now()}`,
    studentId: student._id,
    studentName: student.name,
    studentRoll: student.rollNumber || 'N/A',
    roomNumber: student.hostelDetails?.roomNumber || 'Room N/A',
    block: student.hostelDetails?.block || 'Hostel Block',
    passType,
    fromDateTime,
    toDateTime,
    reason,
    destination,
    emergencyContact: emergencyContact || student.phone || 'N/A',
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  db.outpasses.unshift(newOutpass);

  return res.json({
    success: true,
    message: 'Digital Outpass submitted successfully. Awaiting warden authorization.',
    outpass: newOutpass,
  });
});

// Outpass: Warden reviews (Approve / Reject)
router.post('/outpass/:id/review', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { decision, remarks } = req.body; // 'approved' | 'rejected'
  const authUser = (req as any).user;

  if (authUser.role !== 'warden' && authUser.role !== 'admin') {
    return res.status(403).json({ error: 'Only hostel wardens can review outpass applications' });
  }

  const outpass = db.outpasses.find((o) => o._id === id);
  if (!outpass) {
    return res.status(404).json({ error: 'Outpass request not found' });
  }

  outpass.status = decision === 'approved' ? 'approved' : 'rejected';
  outpass.reviewedBy = authUser.userId;
  outpass.reviewedByName = authUser.name;
  outpass.reviewedAt = new Date().toISOString();
  outpass.reviewRemarks = remarks || (decision === 'approved' ? 'Approved by Warden' : 'Rejected');

  // If approved, sync to hostel log for today as 'on_leave'
  if (decision === 'approved') {
    const today = new Date().toISOString().split('T')[0];
    let log = db.hostelLogs.find((l) => l.date === today && l.studentId === outpass.studentId);
    if (log) {
      log.status = 'on_leave';
      log.remarks = `Approved Outpass #${outpass._id} (${outpass.destination})`;
    } else {
      db.hostelLogs.push({
        _id: `hl-${Date.now()}-${outpass.studentId}`,
        date: today,
        studentId: outpass.studentId,
        wardenId: authUser.userId,
        status: 'on_leave',
        remarks: `Approved Outpass #${outpass._id} (${outpass.destination})`,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  // Send notification
  const student = db.users.find((u) => u._id === outpass.studentId);
  if (student) {
    await sendEmailAlert({
      recipientEmail: student.email,
      recipientName: student.name,
      studentRoll: student.rollNumber || 'N/A',
      alertType: 'OUTPASS_DECISION',
      subject: `Outpass Request ${decision.toUpperCase()}: ${outpass.destination}`,
      content: `Your outpass request #${outpass._id} for ${outpass.passType} to ${outpass.destination} has been ${decision.toUpperCase()}. Remarks: ${outpass.reviewRemarks}`,
    });
  }

  return res.json({
    success: true,
    message: `Outpass #${outpass._id} ${decision} successfully`,
    outpass,
  });
});

export default router;
