import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { LoginPortal } from './components/auth/LoginPortal';
import { StudentDashboard } from './components/student/StudentDashboard';
import { FacultyDashboard } from './components/faculty/FacultyDashboard';
import { WardenDashboard } from './components/warden/WardenDashboard';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { User, UserRole, AcademicSession, EmailAlertRecord } from './types';
import { api, getStoredToken, clearStoredToken } from './services/api';
import { Shield, ArrowLeft } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [adminView, setAdminView] = useState<UserRole>('admin');
  const [activeSessions, setActiveSessions] = useState<AcademicSession[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailAlertRecord[]>([]);
  const [demoAccounts, setDemoAccounts] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Initial Authentication Check
  const initAuth = async () => {
    setLoading(true);
    try {
      const token = getStoredToken();
      if (token) {
        try {
          const meRes = await api.getMe();
          setCurrentUser(meRes.user);
          if (meRes.user.role === 'admin') {
            setAdminView('admin');
          }
        } catch {
          // Token expired or invalid -> stay logged out
          clearStoredToken();
          setCurrentUser(null);
        }
      } else {
        // No stored token -> show login portal
        setCurrentUser(null);
      }

      await refreshSystemState();
    } catch (err) {
      console.error('Failed to check auth state:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshSystemState = async () => {
    try {
      const [sessRes, logsRes, accountsRes] = await Promise.all([
        api.getActiveSessions().catch(() => ({ sessions: [] })),
        api.getNotificationLogs().catch(() => ({ logs: [] })),
        api.getDemoAccounts().catch(() => ({ demoUsers: [] })),
      ]);
      setActiveSessions(sessRes.sessions);
      setEmailLogs(logsRes.logs);
      setDemoAccounts(accountsRes.demoUsers);
    } catch (err) {
      console.warn('System refresh warning:', err);
    }
  };

  useEffect(() => {
    initAuth();
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    if (user.role === 'admin') {
      setAdminView('admin');
    }
    refreshSystemState();
  };

  const handleLogout = () => {
    clearStoredToken();
    setCurrentUser(null);
    setAdminView('admin');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto animate-pulse">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <p className="font-semibold text-slate-200 text-sm">Verifying Campus Security Credentials...</p>
          <p className="text-xs text-slate-400">Loading system parameters and role access rules</p>
        </div>
      </div>
    );
  }

  // If not logged in, show the role-based login portal
  if (!currentUser) {
    return <LoginPortal onLoginSuccess={handleLoginSuccess} />;
  }

  // Helpers for Admin supervisory view: find the representative user for each role
  const sampleStudent = demoAccounts.find((u) => u.role === 'student') || currentUser;
  const sampleFaculty = demoAccounts.find((u) => u.role === 'faculty') || currentUser;
  const sampleWarden = demoAccounts.find((u) => u.role === 'warden') || currentUser;

  return (
    <div className="min-h-screen bg-slate-100/70 flex flex-col text-slate-900 font-sans antialiased">
      {/* Dynamic Top Navbar with Role scoping */}
      <Navbar
        currentUser={currentUser}
        adminView={adminView}
        onSwitchAdminView={currentUser.role === 'admin' ? setAdminView : undefined}
        onLogout={handleLogout}
        emailLogs={emailLogs}
        activeSessionCount={activeSessions.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* STUDENT ROLE: Strictly restricted to Student Dashboard */}
        {currentUser.role === 'student' && (
          <StudentDashboard
            user={currentUser}
            activeSessions={activeSessions}
            onRefreshAll={refreshSystemState}
          />
        )}

        {/* FACULTY ROLE: Strictly restricted to Faculty Dashboard */}
        {currentUser.role === 'faculty' && (
          <FacultyDashboard user={currentUser} onRefreshAll={refreshSystemState} />
        )}

        {/* HOSTEL WARDEN ROLE: Strictly restricted to Warden Dashboard */}
        {currentUser.role === 'warden' && (
          <WardenDashboard user={currentUser} onRefreshAll={refreshSystemState} />
        )}

        {/* ADMIN ROLE: Full Omni-Access across all details & departments */}
        {currentUser.role === 'admin' && (
          <div>
            {/* When Admin is inspecting other modules, show supervisory banner */}
            {adminView !== 'admin' && (
              <div className="mb-6 bg-purple-50 border border-purple-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-purple-600 text-white shadow-xs">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-purple-900 uppercase tracking-wider">
                        Administrator Omni-Access Mode
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-purple-200 text-purple-900 text-[10px] font-semibold uppercase">
                        Supervising {adminView}
                      </span>
                    </div>
                    <p className="text-xs text-purple-700 mt-0.5">
                      Only Admin role has permission to review and supervise other department operations and live records.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setAdminView('admin')}
                  className="px-3.5 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Return to Admin Console</span>
                </button>
              </div>
            )}

            {/* Admin Views */}
            {adminView === 'admin' && (
              <AdminDashboard user={currentUser} onRefreshAll={refreshSystemState} />
            )}

            {adminView === 'faculty' && (
              <FacultyDashboard user={sampleFaculty} onRefreshAll={refreshSystemState} />
            )}

            {adminView === 'warden' && (
              <WardenDashboard user={sampleWarden} onRefreshAll={refreshSystemState} />
            )}

            {adminView === 'student' && (
              <StudentDashboard
                user={sampleStudent}
                activeSessions={activeSessions}
                onRefreshAll={refreshSystemState}
              />
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-500">
        <p>
          Institutional Attendance System • Dynamic 10-Second Rolling QR • 50m Browser Geofencing • Night Roll Call & Curfew Engine
        </p>
      </footer>
    </div>
  );
}
