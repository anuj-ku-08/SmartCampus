import {
  User,
  AcademicSession,
  AcademicAttendance,
  StudentAttendanceSummary,
  HostelResidentRoster,
  Outpass,
  CurfewStatusResponse,
  ClassroomConfig,
  HostelConfig,
  EmailAlertRecord,
} from '../types';

const TOKEN_KEY = 'campus_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.reason || data.error || `HTTP error ${response.status}`;
    const err: any = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data as T;
}

export const api = {
  // Auth
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const res = await request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setStoredToken(res.token);
    return res;
  },

  async demoLogin(role?: string, email?: string): Promise<{ token: string; user: User }> {
    const res = await request<{ token: string; user: User }>('/api/auth/demo-login', {
      method: 'POST',
      body: JSON.stringify({ role, email }),
    });
    setStoredToken(res.token);
    return res;
  },

  async getMe(): Promise<{ user: User }> {
    return request<{ user: User }>('/api/auth/me');
  },

  async getDemoAccounts(): Promise<{ demoUsers: User[] }> {
    return request<{ demoUsers: User[] }>('/api/auth/demo-accounts');
  },

  async resetPassword(params: { identifier: string; newPassword?: string }): Promise<{
    success: boolean;
    message: string;
    userEmail: string;
    userName: string;
  }> {
    return request('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  // Academic
  async getActiveSessions(): Promise<{ sessions: AcademicSession[] }> {
    return request<{ sessions: AcademicSession[] }>('/api/academic/sessions/active');
  },

  async startSession(params: {
    subjectName: string;
    subjectCode: string;
    classroomId: string;
    customCoordinates?: { latitude: number; longitude: number; maxRadiusMeters?: number };
  }): Promise<{
    session: AcademicSession;
    token: string;
    expiresAt: number;
    ttl: number;
    seq: number;
  }> {
    return request('/api/academic/sessions', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async getSessionToken(sessionId: string): Promise<{
    sessionId: string;
    token: string;
    expiresAt: number;
    ttl: number;
    seq: number;
    serverTime: number;
  }> {
    return request(`/api/academic/sessions/${sessionId}/token`);
  },

  async getSessionDetails(sessionId: string): Promise<{
    session: AcademicSession;
    attendees: AcademicAttendance[];
    totalCount: number;
  }> {
    return request(`/api/academic/sessions/${sessionId}`);
  },

  async stopSession(sessionId: string): Promise<{
    message: string;
    session: AcademicSession;
    totalAttendees: number;
  }> {
    return request(`/api/academic/sessions/${sessionId}/stop`, {
      method: 'POST',
    });
  },

  async verifyAttendance(params: {
    token: string;
    latitude: number;
    longitude: number;
    studentId?: string;
  }): Promise<{
    success: boolean;
    message: string;
    attendance: AcademicAttendance;
    distanceMeters: number;
    subject: string;
    subjectCode: string;
  }> {
    return request('/api/attendance/verify', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async manualOverride(params: {
    sessionId: string;
    studentRoll: string;
    reason?: string;
  }): Promise<{ message: string; attendance: AcademicAttendance }> {
    return request('/api/academic/manual-override', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async getStudentSummary(studentId: string): Promise<StudentAttendanceSummary> {
    return request<StudentAttendanceSummary>(`/api/academic/student/${studentId}/summary`);
  },

  async sendWarningAlert(params: {
    studentRoll: string;
    subjectCode: string;
    currentPercentage: number;
  }): Promise<{ success: boolean; alert: EmailAlertRecord }> {
    return request('/api/academic/send-warning-alert', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  // Hostel
  async getHostelRoster(params: {
    block?: string;
    floor?: number;
    date?: string;
  }): Promise<{
    date: string;
    roster: HostelResidentRoster[];
    availableBlocks: string[];
    availableFloors: number[];
    summary: {
      total: number;
      inside: number;
      absent: number;
      onLeave: number;
      lateEntry: number;
    };
  }> {
    const query = new URLSearchParams();
    if (params.block) query.set('block', params.block);
    if (params.floor) query.set('floor', String(params.floor));
    if (params.date) query.set('date', params.date);

    return request(`/api/hostel/roster?${query.toString()}`);
  },

  async verifyHostelStatus(params: {
    studentId: string;
    status: 'inside' | 'absent' | 'on_leave' | 'late_entry';
    remarks?: string;
    date?: string;
  }): Promise<{ success: boolean; message: string; log: any }> {
    return request('/api/hostel/verify-status', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async scanHostelBarcode(barcodeData: string): Promise<{
    success: boolean;
    message: string;
    student: any;
    log: any;
  }> {
    return request('/api/hostel/scan-barcode', {
      method: 'POST',
      body: JSON.stringify({ barcodeData }),
    });
  },

  async getCurfewStatus(): Promise<CurfewStatusResponse> {
    return request<CurfewStatusResponse>('/api/hostel/curfew-status');
  },

  async triggerCurfewAudit(params: {
    studentRoll: string;
    studentName: string;
    roomNumber: string;
    guardianEmail?: string;
  }): Promise<{ success: boolean; message: string; alert: EmailAlertRecord }> {
    return request('/api/hostel/trigger-curfew-audit', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async getOutpasses(): Promise<{ outpasses: Outpass[] }> {
    return request<{ outpasses: Outpass[] }>('/api/outpass');
  },

  async applyOutpass(params: {
    passType: 'day_outpass' | 'home_leave';
    fromDateTime: string;
    toDateTime: string;
    reason: string;
    destination: string;
    emergencyContact?: string;
  }): Promise<{ success: boolean; message: string; outpass: Outpass }> {
    return request('/api/outpass', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async reviewOutpass(
    id: string,
    params: { decision: 'approved' | 'rejected'; remarks?: string }
  ): Promise<{ success: boolean; message: string; outpass: Outpass }> {
    return request(`/api/outpass/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  // Admin
  async getAdminStats(): Promise<{
    totalUsers: number;
    studentsCount: number;
    facultyCount: number;
    wardensCount: number;
    activeSessionsCount: number;
    totalAttendanceScans: number;
    hostelCurfewTime: string;
    classroomsCount: number;
  }> {
    return request('/api/admin/stats');
  },

  async getUsers(): Promise<{ users: User[] }> {
    return request<{ users: User[] }>('/api/admin/users');
  },

  async createUser(user: Partial<User> & { password?: string }): Promise<{ success: boolean; user: User }> {
    return request('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(user),
    });
  },

  async getClassrooms(): Promise<{ classrooms: ClassroomConfig[] }> {
    return request<{ classrooms: ClassroomConfig[] }>('/api/admin/classrooms');
  },

  async createClassroom(classroom: Partial<ClassroomConfig>): Promise<{ success: boolean; classroom: ClassroomConfig }> {
    return request('/api/admin/classrooms', {
      method: 'POST',
      body: JSON.stringify(classroom),
    });
  },

  async getHostelConfig(): Promise<{ config: HostelConfig }> {
    return request<{ config: HostelConfig }>('/api/admin/hostel-config');
  },

  async updateHostelConfig(config: Partial<HostelConfig>): Promise<{ success: boolean; config: HostelConfig }> {
    return request('/api/admin/hostel-config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },

  async getNotificationLogs(): Promise<{ logs: EmailAlertRecord[] }> {
    return request<{ logs: EmailAlertRecord[] }>('/api/admin/notifications/logs');
  },

  async adminSetUserPassword(
    userId: string,
    password: string
  ): Promise<{ success: boolean; message: string; userId: string }> {
    return request(`/api/admin/users/${userId}/password`, {
      method: 'PUT',
      body: JSON.stringify({ password }),
    });
  },

  async adminBatchResetPassword(
    role: string,
    defaultPassword?: string
  ): Promise<{ success: boolean; message: string; affectedCount: number }> {
    return request('/api/admin/batch-reset-password', {
      method: 'POST',
      body: JSON.stringify({ role, defaultPassword }),
    });
  },
};
