export type UserRole = 'student' | 'faculty' | 'warden' | 'admin';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  rollNumber?: string;
  department?: string;
  guardianEmail?: string;
  phone?: string;
  hostelDetails?: {
    isHosteler: boolean;
    block?: string;
    floor?: number;
    roomNumber?: string;
  };
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

export interface SubjectSummary {
  code: string;
  name: string;
  totalSessions: number;
  attendedSessions: number;
  percentage: number;
  statusTag: 'ELIGIBLE_GREEN' | 'WARNING_AMBER' | 'DEBARRED_RED';
}

export interface StudentAttendanceSummary {
  student: {
    _id: string;
    name: string;
    rollNumber?: string;
    department?: string;
  };
  overallPercentage: number;
  subjects: SubjectSummary[];
  recentScans: AcademicAttendance[];
}

export interface HostelResidentRoster {
  studentId: string;
  name: string;
  rollNumber?: string;
  department?: string;
  phone?: string;
  guardianEmail?: string;
  block: string;
  floor: number;
  roomNumber: string;
  status: 'inside' | 'absent' | 'on_leave' | 'late_entry';
  checkInTime?: string;
  remarks?: string;
  hasApprovedOutpass: boolean;
  outpassDetails?: {
    id: string;
    type: string;
    destination: string;
    toDateTime: string;
  };
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

export interface CurfewStatusResponse {
  curfewTime: string;
  isPastCurfew: boolean;
  currentServerTime: string;
  unaccountedCount: number;
  unaccounted: HostelResidentRoster[];
  verifiedInsideCount: number;
  onApprovedLeaveCount: number;
  lateEntriesCount: number;
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
  curfewTime: string;
  blocks: string[];
  floorsPerBlock: number;
  roomsPerFloor: number;
  curfewAlertActive: boolean;
}

export interface EmailAlertRecord {
  id: string;
  recipientEmail: string;
  recipientName: string;
  studentRoll: string;
  alertType: 'LOW_ATTENDANCE' | 'CURFEW_BREACH' | 'OUTPASS_DECISION';
  subject: string;
  content: string;
  timestamp: string;
  status: 'SENT' | 'QUEUED';
}
