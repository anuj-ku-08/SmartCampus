import React, { useState } from 'react';
import {
  Shield,
  UserCheck,
  GraduationCap,
  Building,
  Bell,
  LogOut,
  Sparkles,
  Lock,
} from 'lucide-react';
import { User, UserRole, EmailAlertRecord } from '../types';

interface NavbarProps {
  currentUser: User | null;
  adminView?: UserRole;
  onSwitchAdminView?: (role: UserRole) => void;
  onLogout: () => void;
  emailLogs: EmailAlertRecord[];
  activeSessionCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  adminView = 'admin',
  onSwitchAdminView,
  onLogout,
  emailLogs,
  activeSessionCount,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);

  const isAdmin = currentUser?.role === 'admin';

  const getPortalDetails = () => {
    if (isAdmin) {
      return {
        portalName: 'Administrator Omni-Console',
        badge: <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-300">System Admin</span>,
      };
    }
    switch (currentUser?.role) {
      case 'student':
        return {
          portalName: 'Student Attendance & Hostel Portal',
          badge: <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">Student</span>,
        };
      case 'faculty':
        return {
          portalName: 'Faculty Dynamic Attendance Portal',
          badge: <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">Faculty</span>,
        };
      case 'warden':
        return {
          portalName: 'Hostel Residential Oversight Portal',
          badge: <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">Chief Warden</span>,
        };
      default:
        return {
          portalName: 'Smart Campus Portal',
          badge: null,
        };
    }
  };

  const portalInfo = getPortalDetails();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Portal Title */}
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm ${
              currentUser?.role === 'student'
                ? 'bg-gradient-to-tr from-emerald-600 to-teal-600'
                : currentUser?.role === 'faculty'
                ? 'bg-gradient-to-tr from-blue-600 to-indigo-600'
                : currentUser?.role === 'warden'
                ? 'bg-gradient-to-tr from-amber-600 to-orange-600'
                : 'bg-gradient-to-tr from-purple-700 to-indigo-700'
            }`}>
              {currentUser?.role === 'student' && <GraduationCap className="w-5 h-5" />}
              {currentUser?.role === 'faculty' && <UserCheck className="w-5 h-5" />}
              {currentUser?.role === 'warden' && <Building className="w-5 h-5" />}
              {currentUser?.role === 'admin' && <Shield className="w-5 h-5" />}
              {!currentUser && <Shield className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-900 tracking-tight text-base sm:text-lg">SmartCampus</span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono font-medium">v2.4</span>
              </div>
              <p className="text-xs font-medium text-slate-500 hidden sm:block">
                {portalInfo.portalName}
              </p>
            </div>
          </div>

          {/* Center Info / Active Sessions Badge */}
          {activeSessionCount > 0 && (
            <div className="hidden lg:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span>{activeSessionCount} Active Lecture Session Live with Rolling QR</span>
            </div>
          )}

          {/* Right Action Controls */}
          <div className="flex items-center space-x-3">
            {/* Notification / Alert Dispatch Preview */}
            <div className="relative">
              <button
                id="notifications-btn"
                type="button"
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
                title="System Notifications & Email Dispatch Log"
              >
                <Bell className="w-5 h-5" />
                {emailLogs.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white"></span>
                )}
              </button>

              {showNotifications && (
                <div
                  id="notifications-modal"
                  className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-white border border-slate-200 shadow-xl py-2 z-50 text-xs"
                >
                  <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-800">Dispatch & Alert Registry</p>
                      <p className="text-[11px] text-slate-500">Automated Notification System Logs</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono text-[10px]">
                      {emailLogs.length} dispatched
                    </span>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {emailLogs.length === 0 ? (
                      <p className="p-4 text-center text-slate-500">No alert logs recorded yet.</p>
                    ) : (
                      emailLogs.map((log) => (
                        <div key={log.id} className="p-3 hover:bg-slate-50 transition-colors">
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                log.alertType === 'CURFEW_BREACH'
                                  ? 'bg-rose-100 text-rose-800'
                                  : log.alertType === 'LOW_ATTENDANCE'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {log.alertType.replace('_', ' ')}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="font-medium text-slate-800 line-clamp-1">{log.subject}</p>
                          <p className="text-slate-500 text-[11px] line-clamp-2 mt-0.5">{log.content}</p>
                          <div className="mt-1 text-[10px] text-slate-400">To: {log.recipientEmail}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Current User Info Badge */}
            {currentUser && (
              <div className="hidden sm:flex items-center space-x-2 pl-2 border-l border-slate-200">
                <div className="text-right">
                  <p className="text-xs font-semibold text-slate-900 leading-tight">{currentUser.name}</p>
                  <p className="text-[10px] text-slate-500">{currentUser.rollNumber || currentUser.department || currentUser.email}</p>
                </div>
                {portalInfo.badge}
              </div>
            )}

            {/* Role restriction indicator for non-admin */}
            {!isAdmin && currentUser && (
              <div className="hidden md:flex items-center space-x-1 text-[11px] text-slate-400 px-2 py-1 bg-slate-50 rounded-md border border-slate-200">
                <Lock className="w-3 h-3 text-slate-400" />
                <span className="capitalize">{currentUser.role} Scope Protected</span>
              </div>
            )}

            {/* Logout / Sign Out Button */}
            <button
              id="logout-btn"
              type="button"
              onClick={onLogout}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:border-rose-300 bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 text-xs font-semibold transition-colors"
              title="Sign out of current role"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* ADMIN-ONLY OMNI-ACCESS NAVIGATION SUB-BAR */}
      {isAdmin && onSwitchAdminView && (
        <div className="bg-slate-900 border-t border-slate-800 px-4 sm:px-6 lg:px-8 py-2">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div className="flex items-center space-x-2 text-xs text-slate-300">
              <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold uppercase tracking-wider text-[10px]">
                Admin Omni-Access
              </span>
              <span className="text-slate-400 text-[11px]">
                Full Institutional Authority: Only Admin has access to every dashboard & module
              </span>
            </div>

            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0">
              <button
                id="admin-nav-overview"
                type="button"
                onClick={() => onSwitchAdminView('admin')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1.5 whitespace-nowrap transition-colors ${
                  adminView === 'admin'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin Master Console</span>
              </button>

              <button
                id="admin-nav-faculty"
                type="button"
                onClick={() => onSwitchAdminView('faculty')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1.5 whitespace-nowrap transition-colors ${
                  adminView === 'faculty'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Faculty Dynamic QR</span>
              </button>

              <button
                id="admin-nav-warden"
                type="button"
                onClick={() => onSwitchAdminView('warden')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1.5 whitespace-nowrap transition-colors ${
                  adminView === 'warden'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <Building className="w-3.5 h-3.5" />
                <span>Hostel Roll Call & Curfew</span>
              </button>

              <button
                id="admin-nav-student"
                type="button"
                onClick={() => onSwitchAdminView('student')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1.5 whitespace-nowrap transition-colors ${
                  adminView === 'student'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Student Academic Records</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
