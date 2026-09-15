import React, { useState, useEffect } from 'react';
import {
  Shield,
  Users,
  MapPin,
  Clock,
  Building,
  Plus,
  Save,
  CheckCircle2,
  Mail,
  AlertTriangle,
  Compass,
  KeyRound,
  Lock,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { User, ClassroomConfig, HostelConfig, EmailAlertRecord } from '../../types';
import { api } from '../../services/api';

interface AdminDashboardProps {
  user: User;
  onRefreshAll: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onRefreshAll }) => {
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomConfig[]>([]);
  const [hostelConfig, setHostelConfig] = useState<HostelConfig | null>(null);
  const [emailLogs, setEmailLogs] = useState<EmailAlertRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Curfew timing form
  const [curfewTimeInput, setCurfewTimeInput] = useState('21:30');
  const [curfewSaved, setCurfewSaved] = useState(false);

  // Password Management State
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'student' | 'faculty' | 'warden'>('all');
  const [passwordModalUser, setPasswordModalUser] = useState<User | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('pass123');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordSuccessAlert, setPasswordSuccessAlert] = useState<string | null>(null);

  // Batch password modal state
  const [showBatchPasswordModal, setShowBatchPasswordModal] = useState(false);
  const [batchTargetRole, setBatchTargetRole] = useState<'student' | 'faculty' | 'warden' | 'all'>('student');
  const [batchDefaultPassword, setBatchDefaultPassword] = useState('pass123');

  // New classroom modal
  const [showAddClassroom, setShowAddClassroom] = useState(false);
  const [newClassroom, setNewClassroom] = useState({
    name: '',
    block: 'Main Academic Complex',
    latitude: 28.5458,
    longitude: 77.1926,
    maxRadiusMeters: 50,
  });

  // New user modal
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: 'pass123',
    role: 'student' as 'student' | 'faculty' | 'warden' | 'admin',
    rollNumber: '',
    department: 'Computer Science & Eng',
    guardianEmail: '',
    hostelBlock: 'Block A (Boys)',
    hostelRoom: 'A-105',
    isHosteler: true,
  });

  const loadData = async () => {
    try {
      const [st, u, cr, hc, logs] = await Promise.all([
        api.getAdminStats(),
        api.getUsers(),
        api.getClassrooms(),
        api.getHostelConfig(),
        api.getNotificationLogs(),
      ]);
      setStats(st);
      setUsers(u.users);
      setClassrooms(cr.classrooms);
      setHostelConfig(hc.config);
      setCurfewTimeInput(hc.config.curfewTime || '21:30');
      setEmailLogs(logs.logs);
    } catch (err) {
      console.error('Failed to load admin stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update Curfew
  const handleSaveCurfew = async () => {
    try {
      await api.updateHostelConfig({ curfewTime: curfewTimeInput });
      setCurfewSaved(true);
      setTimeout(() => setCurfewSaved(false), 3000);
      loadData();
      onRefreshAll();
    } catch (err: any) {
      alert(err.message || 'Failed to update curfew');
    }
  };

  // Add Classroom
  const handleCreateClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createClassroom(newClassroom);
      setShowAddClassroom(false);
      setNewClassroom({
        name: '',
        block: 'Main Academic Complex',
        latitude: 28.5458,
        longitude: 77.1926,
        maxRadiusMeters: 50,
      });
      loadData();
      onRefreshAll();
    } catch (err: any) {
      alert(err.message || 'Failed to create classroom');
    }
  };

  // Add User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createUser({
        name: newUser.name,
        email: newUser.email,
        password: newUser.password,
        role: newUser.role,
        rollNumber: newUser.rollNumber || undefined,
        department: newUser.department,
        guardianEmail: newUser.guardianEmail || undefined,
        hostelDetails: {
          isHosteler: newUser.isHosteler,
          block: newUser.isHosteler ? newUser.hostelBlock : undefined,
          roomNumber: newUser.isHosteler ? newUser.hostelRoom : undefined,
          floor: 1,
        },
      });
      setShowAddUser(false);
      loadData();
      onRefreshAll();
    } catch (err: any) {
      alert(err.message || 'Failed to register user');
    }
  };

  // Set Password for individual user (student, warden, faculty)
  const handleSaveUserPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalUser) return;
    setIsSavingPassword(true);
    try {
      const res = await api.adminSetUserPassword(passwordModalUser._id, newPasswordInput);
      setPasswordSuccessAlert(res.message);
      setPasswordModalUser(null);
      setNewPasswordInput('pass123');
      setTimeout(() => setPasswordSuccessAlert(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to update user password');
    } finally {
      setIsSavingPassword(false);
    }
  };

  // Batch Reset Default Password for Role
  const handleBatchResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPassword(true);
    try {
      const res = await api.adminBatchResetPassword(batchTargetRole, batchDefaultPassword);
      setPasswordSuccessAlert(res.message);
      setShowBatchPasswordModal(false);
      setBatchDefaultPassword('pass123');
      setTimeout(() => setPasswordSuccessAlert(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to batch reset passwords');
    } finally {
      setIsSavingPassword(false);
    }
  };

  // Filtered user list
  const filteredUsers = users.filter((u) => {
    if (userRoleFilter === 'all') return true;
    return u.role === userRoleFilter;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Institutional Administration & Configuration</h2>
            <p className="text-xs text-slate-500">
              Manage classroom GPS geofencing bounds, curfew policies, users, and audit trail.
            </p>
          </div>
        </div>

        {/* High-level stats */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-slate-500 block text-[11px]">Total Registered Accounts</span>
            <span className="font-bold text-slate-900 text-base">{stats?.totalUsers || 0}</span>
          </div>
          <div className="bg-blue-50 p-3 rounded-xl border border-blue-200">
            <span className="text-blue-700 block text-[11px]">Students Enrolled</span>
            <span className="font-bold text-blue-900 text-base">{stats?.studentsCount || 0}</span>
          </div>
          <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
            <span className="text-emerald-700 block text-[11px]">Classrooms Geofenced</span>
            <span className="font-bold text-emerald-900 text-base">{stats?.classroomsCount || 0}</span>
          </div>
          <div className="bg-purple-50 p-3 rounded-xl border border-purple-200">
            <span className="text-purple-700 block text-[11px]">Total Verified Scans</span>
            <span className="font-bold text-purple-900 text-base">{stats?.totalAttendanceScans || 0}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Classroom GPS Bounds & Users Directory */}
        <div className="lg:col-span-2 space-y-6">
          {/* Classroom Geofencing Bounds Manager */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Classroom GPS Geofencing Boundaries</h3>
                <p className="text-xs text-slate-500">Coordinates and maximum student scan radius (Haversine formula)</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddClassroom(true)}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center space-x-1.5 transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Classroom</span>
              </button>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              {classrooms.map((cr) => (
                <div key={cr.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{cr.name}</p>
                    <p className="text-slate-500 text-[11px]">{cr.block}</p>
                  </div>
                  <div className="flex items-center space-x-3 text-right">
                    <div className="font-mono text-slate-600 text-[11px]">
                      <span>{cr.latitude.toFixed(4)}, {cr.longitude.toFixed(4)}</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold font-mono text-[11px]">
                      ≤ {cr.maxRadiusMeters}m radius
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* User Directory */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            {passwordSuccessAlert && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between animate-fadeIn">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold">{passwordSuccessAlert}</span>
                </div>
                <button
                  onClick={() => setPasswordSuccessAlert(null)}
                  className="text-emerald-700 hover:text-emerald-900 font-bold ml-2"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
                  <span>User Directory & Credentials</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-mono">
                    {users.length} total
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Manage accounts and enforce basic/custom passwords for students, faculty, and wardens
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  id="admin-batch-password-btn"
                  onClick={() => setShowBatchPasswordModal(true)}
                  className="px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50/80 hover:bg-blue-100 text-blue-800 font-semibold text-xs flex items-center space-x-1.5 transition-colors shadow-2xs"
                  title="Batch reset basic password for any role"
                >
                  <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                  <span>Batch Set Passwords</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddUser(true)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center space-x-1.5 transition-colors shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register User</span>
                </button>
              </div>
            </div>

            {/* Role Filter Tabs */}
            <div className="flex items-center space-x-1.5 text-xs">
              {(['all', 'student', 'faculty', 'warden'] as const).map((r) => {
                const count = r === 'all' ? users.length : users.filter((u) => u.role === r).length;
                const active = userRoleFilter === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setUserRoleFilter(r)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-colors ${
                      active
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    {r === 'all' ? 'All Roles' : `${r}s`} ({count})
                  </button>
                );
              })}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-y border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Name & Email</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Roll / Dept</th>
                    <th className="py-2.5 px-3">Hostel Details</th>
                    <th className="py-2.5 px-3 text-right">Password Authority</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((u) => (
                    <tr key={u._id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3">
                        <p className="font-semibold text-slate-900">{u.name}</p>
                        <p className="text-[11px] text-slate-500">{u.email}</p>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                            u.role === 'student'
                              ? 'bg-emerald-100 text-emerald-800'
                              : u.role === 'faculty'
                              ? 'bg-blue-100 text-blue-800'
                              : u.role === 'warden'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {u.rollNumber ? (
                          <span className="font-mono font-semibold">{u.rollNumber}</span>
                        ) : (
                          u.department || 'N/A'
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {u.hostelDetails?.isHosteler ? (
                          <span className="font-mono">{u.hostelDetails.roomNumber || 'Hostel'}</span>
                        ) : (
                          <span className="text-slate-400">Day Scholar</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          id={`set-pwd-${u._id}`}
                          onClick={() => {
                            setPasswordModalUser(u);
                            setNewPasswordInput('pass123');
                          }}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 font-semibold text-[11px] inline-flex items-center space-x-1.5 transition-colors shadow-2xs"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                          <span>Set Password</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Hostel Policy Config & Nodemailer Alerts History */}
        <div className="space-y-6">
          {/* Hostel Curfew Config */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <Clock className="w-4 h-4 text-amber-600" />
              <h3 className="font-bold text-slate-900 text-base">Hostel Curfew Policy</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Institutional Night Curfew Cutoff</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="time"
                    value={curfewTimeInput}
                    onChange={(e) => setCurfewTimeInput(e.target.value)}
                    className="p-2 rounded-xl border border-slate-300 font-mono font-bold text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleSaveCurfew}
                    className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs flex items-center space-x-1 shadow-xs transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Curfew</span>
                  </button>
                </div>
              </div>

              {curfewSaved && (
                <p className="text-xs text-emerald-700 bg-emerald-50 p-2 rounded-lg font-medium">
                  ✓ Curfew updated to {curfewTimeInput}. Roll call audit register updated.
                </p>
              )}

              <p className="text-[11px] text-slate-500">
                Any student not confirmed inside and without an approved outpass by {curfewTimeInput} is flagged as
                unaccounted on warden dashboards.
              </p>
            </div>
          </div>

          {/* Nodemailer Automated Alerts History */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-base">Nodemailer Dispatch Registry</h3>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">{emailLogs.length} events</span>
            </div>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1 text-xs">
              {emailLogs.map((log) => (
                <div key={log.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1">
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
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
                  <p className="font-semibold text-slate-800 line-clamp-1">{log.subject}</p>
                  <p className="text-slate-500 text-[11px] line-clamp-2">{log.content}</p>
                  <p className="text-[10px] text-slate-400">Recipient: {log.recipientEmail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Add Classroom */}
      {showAddClassroom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Configure New Classroom GPS Bound</h3>
            <form onSubmit={handleCreateClassroom} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Classroom Name</label>
                <input
                  type="text"
                  placeholder="e.g. Hall 401 (Aryabhata Auditorium)"
                  value={newClassroom.name}
                  onChange={(e) => setNewClassroom({ ...newClassroom, name: e.target.value })}
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Academic Complex / Wing</label>
                <input
                  type="text"
                  placeholder="e.g. Mechanical Complex"
                  value={newClassroom.block}
                  onChange={(e) => setNewClassroom({ ...newClassroom, block: e.target.value })}
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Center Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={newClassroom.latitude}
                    onChange={(e) => setNewClassroom({ ...newClassroom, latitude: parseFloat(e.target.value) })}
                    required
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Center Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={newClassroom.longitude}
                    onChange={(e) => setNewClassroom({ ...newClassroom, longitude: parseFloat(e.target.value) })}
                    required
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Maximum Geofence Radius (meters)</label>
                <input
                  type="number"
                  value={newClassroom.maxRadiusMeters}
                  onChange={(e) => setNewClassroom({ ...newClassroom, maxRadiusMeters: parseInt(e.target.value) || 50 })}
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddClassroom(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs"
                >
                  Save Classroom
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add User */}
      {showAddUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-slate-900 text-base">Register New Academic / Hostel User</h3>
            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Vikramaditya Sen"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="student@campus.edu"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    required
                    className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Role</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-semibold"
                  >
                    <option value="student">Student</option>
                    <option value="faculty">Faculty</option>
                    <option value="warden">Hostel Warden</option>
                    <option value="admin">System Admin</option>
                  </select>
                </div>
              </div>

              {newUser.role === 'student' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Roll Number</label>
                      <input
                        type="text"
                        placeholder="e.g. CS21B099"
                        value={newUser.rollNumber}
                        onChange={(e) => setNewUser({ ...newUser, rollNumber: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-slate-300 font-mono uppercase focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Department</label>
                      <input
                        type="text"
                        placeholder="Computer Science"
                        value={newUser.department}
                        onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Guardian Email Address</label>
                    <input
                      type="email"
                      placeholder="parent@example.com"
                      value={newUser.guardianEmail}
                      onChange={(e) => setNewUser({ ...newUser, guardianEmail: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Hostel Block</label>
                      <input
                        type="text"
                        placeholder="Block A (Boys)"
                        value={newUser.hostelBlock}
                        onChange={(e) => setNewUser({ ...newUser, hostelBlock: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Room Number</label>
                      <input
                        type="text"
                        placeholder="A-105"
                        value={newUser.hostelRoom}
                        onChange={(e) => setNewUser({ ...newUser, hostelRoom: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-slate-300 font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddUser(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-xs"
                >
                  Register Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Set User Password (Admin Power for Student, Warden, Faculty) */}
      {passwordModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Configure User Password</h3>
                  <p className="text-xs text-slate-500">Administrative credential override</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPasswordModalUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Target User Summary Card */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-sm">{passwordModalUser.name}</span>
                <span
                  className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                    passwordModalUser.role === 'student'
                      ? 'bg-emerald-100 text-emerald-800'
                      : passwordModalUser.role === 'faculty'
                      ? 'bg-blue-100 text-blue-800'
                      : passwordModalUser.role === 'warden'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-purple-100 text-purple-800'
                  }`}
                >
                  {passwordModalUser.role}
                </span>
              </div>
              <p className="text-slate-500">{passwordModalUser.email}</p>
              {passwordModalUser.rollNumber && (
                <p className="text-slate-600 font-mono">Roll: {passwordModalUser.rollNumber}</p>
              )}
            </div>

            <form onSubmit={handleSaveUserPassword} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1.5">
                  Set Basic or Custom Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="admin-new-password-input"
                    type="text"
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    required
                    placeholder="Enter password (e.g. pass123)"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Quick Presets */}
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 block">Quick Presets:</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setNewPasswordInput('pass123')}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[11px] transition-colors"
                  >
                    Default: pass123
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewPasswordInput('Campus@2026')}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[11px] transition-colors"
                  >
                    Campus@2026
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewPasswordInput('Welcome#123')}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[11px] transition-colors"
                  >
                    Welcome#123
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPasswordModalUser(null)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="admin-save-password-submit-btn"
                  disabled={isSavingPassword}
                  className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs flex items-center space-x-1.5 disabled:opacity-50"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{isSavingPassword ? 'Saving...' : 'Set User Password'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Batch Set Basic Password for Role */}
      {showBatchPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Batch Set Basic Passwords</h3>
                  <p className="text-xs text-slate-500">Apply standard password across an entire institutional role</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBatchPasswordModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleBatchResetPassword} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1.5">Target Institutional Role</label>
                <select
                  id="batch-role-select"
                  value={batchTargetRole}
                  onChange={(e) => setBatchTargetRole(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-semibold"
                >
                  <option value="student">All Students ({users.filter((u) => u.role === 'student').length} accounts)</option>
                  <option value="faculty">All Faculty Members ({users.filter((u) => u.role === 'faculty').length} accounts)</option>
                  <option value="warden">All Hostel Wardens ({users.filter((u) => u.role === 'warden').length} accounts)</option>
                  <option value="all">All Non-Admin Users ({users.filter((u) => u.role !== 'admin').length} accounts)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1.5">Basic Default Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="batch-default-password-input"
                    type="text"
                    value={batchDefaultPassword}
                    onChange={(e) => setBatchDefaultPassword(e.target.value)}
                    required
                    placeholder="e.g. pass123"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  All accounts matching the selected role will be updated to this password immediately.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBatchPasswordModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="admin-batch-save-submit-btn"
                  disabled={isSavingPassword}
                  className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow-xs flex items-center space-x-1.5 disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{isSavingPassword ? 'Updating...' : 'Apply to Role Accounts'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
