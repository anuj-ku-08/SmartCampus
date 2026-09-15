import bcrypt from 'bcryptjs';

export interface User {
  _id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'student' | 'faculty' | 'warden' | 'admin';
  rollNumber?: string;
  department?: string;
  guardianEmail?: string;
  hostelDetails?: {
    isHosteler: boolean;
    block?: string;
    floor?: number;
    roomNumber?: string;
  };
  phone?: string;
  createdAt: string;
}

export interface AcademicSession {
  _id: string;
  subjectName: string;
  subjectCode: string;
  facultyId: string;
  facultyName: string;
  classroomName: string;
  classroomCoordinates: {
    latitude: number;
    longitude: number;
    maxRadiusMeters: number;
  };
  currentSecretToken: string;
  tokenExpiresAt: number;
  tokenSequence: number;
  isActive: boolean;
  startedAt: string;
  endedAt?: string;
}

export interface AcademicAttendance {
  _id: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  studentRoll: string;
  subjectCode: string;
  status: 'present' | 'absent' | 'late';
  scannedAt: string;
  deviceCoordinates?: {
    latitude: number;
    longitude: number;
  };
  distanceMeters?: number;
  overrideReason?: string;
}

export interface HostelLog {
  _id: string;
  date: string; // YYYY-MM-DD
  studentId: string;
  wardenId: string;
  status: 'inside' | 'absent' | 'on_leave' | 'late_entry';
  checkInTime?: string;
  remarks?: string;
  updatedAt: string;
}

export interface Outpass {
  _id: string;
  studentId: string;
  studentName: string;
  studentRoll: string;
  roomNumber: string;
  block: string;
  passType: 'day_outpass' | 'home_leave';
  fromDateTime: string;
  toDateTime: string;
  reason: string;
  destination: string;
  emergencyContact: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  reviewRemarks?: string;
  createdAt: string;
}

export interface ClassroomConfig {
  id: string;
  name: string;
  block: string;
  latitude: number;
  longitude: number;
  maxRadiusMeters: number;
}

export interface HostelConfig {
  curfewTime: string; // e.g. "21:30" (9:30 PM)
  blocks: string[];
  floorsPerBlock: number;
  roomsPerFloor: number;
  curfewAlertActive: boolean;
}

// Seed initial system data
class InMemoryDatabase {
  users: User[] = [];
  sessions: AcademicSession[] = [];
  attendance: AcademicAttendance[] = [];
  hostelLogs: HostelLog[] = [];
  outpasses: Outpass[] = [];
  classrooms: ClassroomConfig[] = [];
  hostelConfig: HostelConfig = {
    curfewTime: '21:30',
    blocks: ['Block A (Boys)', 'Block B (Girls)'],
    floorsPerBlock: 3,
    roomsPerFloor: 8,
    curfewAlertActive: true,
  };

  constructor() {
    this.seed();
  }

  seed() {
    const salt = bcrypt.genSaltSync(10);
    const defaultPasswordHash = bcrypt.hashSync('pass123', salt);

    // Initial Classrooms with default coordinates (Campus Engineering Block)
    this.classrooms = [
      {
        id: 'cr-101',
        name: 'Lecture Hall 101 (Turing Hall)',
        block: 'Computer Science Wing',
        latitude: 28.5458,
        longitude: 77.1926,
        maxRadiusMeters: 50,
      },
      {
        id: 'cr-204',
        name: 'Seminar Hall 204 (Hopper Lab)',
        block: 'Advanced Computing Center',
        latitude: 28.5462,
        longitude: 77.1931,
        maxRadiusMeters: 50,
      },
      {
        id: 'cr-305',
        name: 'Electronics Lab 305',
        block: 'ECE Tech Complex',
        latitude: 28.5452,
        longitude: 77.192,
        maxRadiusMeters: 50,
      },
    ];

    // Seed Users
    this.users = [
      {
        _id: 'usr-student-1',
        name: 'Aarav Sharma',
        email: 'student@campus.edu',
        passwordHash: defaultPasswordHash,
        role: 'student',
        rollNumber: 'CS21B045',
        department: 'Computer Science & Eng',
        guardianEmail: 'parent.sharma@example.com',
        phone: '+91 98765 43210',
        hostelDetails: {
          isHosteler: true,
          block: 'Block A (Boys)',
          floor: 2,
          roomNumber: 'A-204',
        },
        createdAt: new Date().toISOString(),
      },
      {
        _id: 'usr-student-2',
        name: 'Priya Patel',
        email: 'priya@campus.edu',
        passwordHash: defaultPasswordHash,
        role: 'student',
        rollNumber: 'CS21B088',
        department: 'Computer Science & Eng',
        guardianEmail: 'parent.patel@example.com',
        phone: '+91 98765 43211',
        hostelDetails: {
          isHosteler: true,
          block: 'Block B (Girls)',
          floor: 1,
          roomNumber: 'B-102',
        },
        createdAt: new Date().toISOString(),
      },
      {
        _id: 'usr-student-3',
        name: 'Rohit Verma',
        email: 'rohit@campus.edu',
        passwordHash: defaultPasswordHash,
        role: 'student',
        rollNumber: 'EC21B012',
        department: 'Electronics & Communication',
        guardianEmail: 'parent.verma@example.com',
        phone: '+91 98765 43212',
        hostelDetails: {
          isHosteler: true,
          block: 'Block A (Boys)',
          floor: 2,
          roomNumber: 'A-204',
        },
        createdAt: new Date().toISOString(),
      },
      {
        _id: 'usr-student-4',
        name: 'Sneha Reddy',
        email: 'sneha@campus.edu',
        passwordHash: defaultPasswordHash,
        role: 'student',
        rollNumber: 'CS21B031',
        department: 'Computer Science & Eng',
        guardianEmail: 'parent.reddy@example.com',
        phone: '+91 98765 43213',
        hostelDetails: {
          isHosteler: true,
          block: 'Block B (Girls)',
          floor: 2,
          roomNumber: 'B-215',
        },
        createdAt: new Date().toISOString(),
      },
      {
        _id: 'usr-student-5',
        name: 'Devendra Joshi',
        email: 'dev@campus.edu',
        passwordHash: defaultPasswordHash,
        role: 'student',
        rollNumber: 'CS21B019',
        department: 'Computer Science & Eng',
        guardianEmail: 'parent.joshi@example.com',
        phone: '+91 98765 43214',
        hostelDetails: {
          isHosteler: true,
          block: 'Block A (Boys)',
          floor: 1,
          roomNumber: 'A-108',
        },
        createdAt: new Date().toISOString(),
      },
      {
        _id: 'usr-faculty-1',
        name: 'Dr. Rajesh Kulkarni',
        email: 'faculty@campus.edu',
        passwordHash: defaultPasswordHash,
        role: 'faculty',
        department: 'Computer Science & Eng',
        phone: '+91 98111 22334',
        createdAt: new Date().toISOString(),
      },
      {
        _id: 'usr-warden-1',
        name: 'Col. Vijay Singh (Retd.)',
        email: 'warden@campus.edu',
        passwordHash: defaultPasswordHash,
        role: 'warden',
        phone: '+91 98222 33445',
        createdAt: new Date().toISOString(),
      },
      {
        _id: 'usr-admin-1',
        name: 'Campus Director Office',
        email: 'admin@campus.edu',
        passwordHash: defaultPasswordHash,
        role: 'admin',
        createdAt: new Date().toISOString(),
      },
    ];

    // Historical attendance data to demonstrate the 3 percentage brackets:
    // Green (>= 75%), Amber (65-74%), Red (< 65%)
    const pastSubjects = [
      { code: 'CS301', name: 'Data Structures & Algorithms', totalSessions: 24 },
      { code: 'CS302', name: 'Database Management Systems', totalSessions: 24 },
      { code: 'CS303', name: 'Computer Networks', totalSessions: 20 },
      { code: 'CS304', name: 'Theory of Computation', totalSessions: 18 },
    ];

    // Seed mock attendance history for student 1 (Aarav):
    // CS301: 21 / 24 = 87.5% (Green)
    // CS302: 17 / 24 = 70.8% (Amber)
    // CS303: 11 / 20 = 55.0% (Red)
    // CS304: 15 / 18 = 83.3% (Green)
    pastSubjects.forEach((sub) => {
      let attendedCount = 20;
      if (sub.code === 'CS301') attendedCount = 21;
      if (sub.code === 'CS302') attendedCount = 17;
      if (sub.code === 'CS303') attendedCount = 11;
      if (sub.code === 'CS304') attendedCount = 15;

      for (let i = 1; i <= sub.totalSessions; i++) {
        const isAttended = i <= attendedCount;
        this.attendance.push({
          _id: `att-hist-${sub.code}-${i}-s1`,
          sessionId: `sess-hist-${sub.code}-${i}`,
          studentId: 'usr-student-1',
          studentName: 'Aarav Sharma',
          studentRoll: 'CS21B045',
          subjectCode: sub.code,
          status: isAttended ? 'present' : 'absent',
          scannedAt: new Date(Date.now() - (sub.totalSessions - i) * 86400000).toISOString(),
          distanceMeters: isAttended ? Math.round(Math.random() * 30 + 5) : undefined,
        });
      }
    });

    // Seed Outpasses
    this.outpasses = [
      {
        _id: 'out-001',
        studentId: 'usr-student-2',
        studentName: 'Priya Patel',
        studentRoll: 'CS21B088',
        roomNumber: 'B-102',
        block: 'Block B (Girls)',
        passType: 'home_leave',
        fromDateTime: new Date(Date.now() - 3600000 * 10).toISOString(),
        toDateTime: new Date(Date.now() + 3600000 * 38).toISOString(),
        reason: 'Family wedding ceremony in Pune',
        destination: 'Shivajinagar, Pune',
        emergencyContact: '+91 94220 11223',
        status: 'approved',
        reviewedBy: 'usr-warden-1',
        reviewedByName: 'Col. Vijay Singh (Retd.)',
        reviewedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
        reviewRemarks: 'Guardian consent verified telephonically.',
        createdAt: new Date(Date.now() - 3600000 * 14).toISOString(),
      },
      {
        _id: 'out-002',
        studentId: 'usr-student-1',
        studentName: 'Aarav Sharma',
        studentRoll: 'CS21B045',
        roomNumber: 'A-204',
        block: 'Block A (Boys)',
        passType: 'day_outpass',
        fromDateTime: new Date(Date.now() + 3600000 * 2).toISOString(),
        toDateTime: new Date(Date.now() + 3600000 * 7).toISOString(),
        reason: 'Technical Hackathon finals at IIT Delhi Research Park',
        destination: 'Hauz Khas, New Delhi',
        emergencyContact: '+91 98765 43210',
        status: 'pending',
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      },
    ];

    // Seed Today's Hostel Log
    const today = new Date().toISOString().split('T')[0];
    this.hostelLogs = [
      {
        _id: 'hl-01',
        date: today,
        studentId: 'usr-student-1',
        wardenId: 'usr-warden-1',
        status: 'inside',
        checkInTime: new Date(Date.now() - 3600000 * 1.5).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        _id: 'hl-02',
        date: today,
        studentId: 'usr-student-2',
        wardenId: 'usr-warden-1',
        status: 'on_leave',
        remarks: 'Outpass OUT-001 approved for home leave',
        updatedAt: new Date().toISOString(),
      },
      {
        _id: 'hl-03',
        date: today,
        studentId: 'usr-student-3',
        wardenId: 'usr-warden-1',
        status: 'absent', // Currently absent/unaccounted
        remarks: 'Not in room at 21:30 roll call check',
        updatedAt: new Date().toISOString(),
      },
      {
        _id: 'hl-04',
        date: today,
        studentId: 'usr-student-4',
        wardenId: 'usr-warden-1',
        status: 'inside',
        checkInTime: new Date(Date.now() - 3600000 * 2).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        _id: 'hl-05',
        date: today,
        studentId: 'usr-student-5',
        wardenId: 'usr-warden-1',
        status: 'late_entry',
        checkInTime: new Date(Date.now() - 3600000 * 0.5).toISOString(),
        remarks: 'Reported at main gate 22:05 with library pass',
        updatedAt: new Date().toISOString(),
      },
    ];
  }
}

export const db = new InMemoryDatabase();
