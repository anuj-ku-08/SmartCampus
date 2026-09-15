import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Play,
  Square,
  Users,
  Clock,
  MapPin,
  Download,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
  Edit3,
  Mail,
  FileSpreadsheet,
  Printer,
  Sparkles,
  Info,
} from 'lucide-react';
import { User, AcademicSession, AcademicAttendance, ClassroomConfig } from '../../types';
import { api } from '../../services/api';

interface FacultyDashboardProps {
  user: User;
  onRefreshAll: () => void;
}

export const FacultyDashboard: React.FC<FacultyDashboardProps> = ({ user, onRefreshAll }) => {
  const [activeSession, setActiveSession] = useState<AcademicSession | null>(null);
  const [attendees, setAttendees] = useState<AcademicAttendance[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomConfig[]>([]);

  // Session launcher form state
  const [selectedSubject, setSelectedSubject] = useState('CS301 - Data Structures & Algorithms');
  const [selectedClassroom, setSelectedClassroom] = useState('cr-101');
  const [customGpsActive, setCustomGpsActive] = useState(false);
  const [facultyGps, setFacultyGps] = useState<{ latitude: number; longitude: number } | null>(null);
  const [startingSession, setStartingSession] = useState(false);

  // 10-Second Rolling Token Engine
  const [rollingToken, setRollingToken] = useState<string>('');
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number>(0);
  const [tokenSeq, setTokenSeq] = useState<number>(1);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(10);

  // Manual Override Modal
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideRoll, setOverrideRoll] = useState('');
  const [overrideReason, setOverrideReason] = useState('Device camera failure during class');
  const [overrideMessage, setOverrideMessage] = useState<string | null>(null);

  // Low attendance warning sender
  const [warningSentMessage, setWarningSentMessage] = useState<string | null>(null);

  const subjectsList = [
    { code: 'CS301', name: 'Data Structures & Algorithms' },
    { code: 'CS302', name: 'Database Management Systems' },
    { code: 'CS303', name: 'Computer Networks' },
    { code: 'CS304', name: 'Theory of Computation' },
    { code: 'EC201', name: 'Digital Electronics & Logic' },
  ];

  // Load classrooms & active session
  const loadInitial = async () => {
    try {
      const [crRes, activeRes] = await Promise.all([
        api.getClassrooms(),
        api.getActiveSessions(),
      ]);
      setClassrooms(crRes.classrooms);
      const myActive = activeRes.sessions.find((s) => s.facultyId === user._id) || activeRes.sessions[0];
      if (myActive) {
        setActiveSession(myActive);
        setRollingToken(myActive.currentSecretToken);
        setTokenExpiresAt(myActive.tokenExpiresAt);
        setTokenSeq(myActive.tokenSequence);
        loadSessionAttendees(myActive._id);
      }
    } catch (err) {
      console.error('Failed to load initial faculty data:', err);
    }
  };

  useEffect(() => {
    loadInitial();
  }, [user._id]);

  // Load session attendees
  const loadSessionAttendees = async (sessionId: string) => {
    try {
      const res = await api.getSessionDetails(sessionId);
      setAttendees(res.attendees);
    } catch (err) {
      console.error('Failed to load attendees:', err);
    }
  };

  // Poll for token refresh and live attendees every 1-2 seconds
  useEffect(() => {
    if (!activeSession) return;

    const interval = setInterval(async () => {
      // 1. Calculate seconds remaining in current token
      const now = Date.now();
      const diff = Math.max(0, Math.ceil((tokenExpiresAt - now) / 1000));
      setSecondsRemaining(diff);

      // If token has reached expiration or within 1s, fetch new rolling token
      if (diff <= 1) {
        try {
          const res = await api.getSessionToken(activeSession._id);
          setRollingToken(res.token);
          setTokenExpiresAt(res.expiresAt);
          setTokenSeq(res.seq);
        } catch (err) {
          console.warn('Failed to refresh rolling token:', err);
        }
      }

      // Also refresh attendees roster
      loadSessionAttendees(activeSession._id);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession, tokenExpiresAt]);

  // Geolocation sync for faculty (anchors geofence to current room)
  const syncFacultyGPS = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFacultyGps({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setCustomGpsActive(true);
      },
      (err) => console.warn('Could not read faculty GPS:', err.message)
    );
  };

  // Start new lecture attendance session
  const handleStartSession = async () => {
    setStartingSession(true);
    const [subCode, subName] = selectedSubject.split(' - ');
    try {
      const res = await api.startSession({
        subjectCode: subCode.trim(),
        subjectName: subName ? subName.trim() : subCode.trim(),
        classroomId: selectedClassroom,
        customCoordinates: customGpsActive && facultyGps ? facultyGps : undefined,
      });

      setActiveSession(res.session);
      setRollingToken(res.token);
      setTokenExpiresAt(res.expiresAt);
      setTokenSeq(res.seq);
      setAttendees([]);
      onRefreshAll();
    } catch (err: any) {
      alert(err.message || 'Failed to start session');
    } finally {
      setStartingSession(false);
    }
  };

  // Conclude lecture session
  const handleStopSession = async () => {
    if (!activeSession) return;
    try {
      await api.stopSession(activeSession._id);
      setActiveSession(null);
      setRollingToken('');
      onRefreshAll();
    } catch (err: any) {
      alert(err.message || 'Failed to stop session');
    }
  };

  // Manual Override submission
  const handleManualOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession || !overrideRoll) return;

    setOverrideMessage(null);
    try {
      const res = await api.manualOverride({
        sessionId: activeSession._id,
        studentRoll: overrideRoll.trim(),
        reason: overrideReason,
      });
      setOverrideMessage(res.message);
      setOverrideRoll('');
      loadSessionAttendees(activeSession._id);
      onRefreshAll();
    } catch (err: any) {
      setOverrideMessage(err.message || 'Override failed');
    }
  };

  // Trigger low attendance alert email via simulated Nodemailer
  const handleSendWarning = async (studentRoll: string, subjectCode: string, pct: number) => {
    try {
      await api.sendWarningAlert({
        studentRoll,
        subjectCode,
        currentPercentage: pct,
      });
      setWarningSentMessage(`Official attendance shortage alert dispatched for ${studentRoll}`);
      setTimeout(() => setWarningSentMessage(null), 4000);
      onRefreshAll();
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch warning');
    }
  };

  // Export CSV Report
  const exportCSV = () => {
    if (!activeSession && attendees.length === 0) return;
    const headers = ['Session ID', 'Subject Code', 'Subject Name', 'Student Roll', 'Student Name', 'Status', 'Distance (Meters)', 'Scanned At', 'Override Reason'];
    const rows = attendees.map((a) => [
      a.sessionId,
      a.subjectCode,
      activeSession?.subjectName || 'N/A',
      a.studentRoll,
      a.studentName,
      a.status.toUpperCase(),
      a.distanceMeters ?? 'N/A',
      new Date(a.scannedAt).toLocaleString(),
      a.overrideReason || 'N/A',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Attendance_${activeSession?.subjectCode || 'Session'}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print audit report
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Session Controller */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                Faculty Lecture Portal
              </span>
              <span className="text-xs text-slate-400 font-mono">Prof. Dr. Rajesh Kulkarni</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              Dynamic Rolling QR Attendance Controller
            </h2>
            <p className="text-xs text-slate-500">
              Generates self-invalidating 10-second tokens coupled with 50-meter classroom GPS geofencing.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {activeSession ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Manual Override</span>
                </button>
                <button
                  id="stop-session-btn"
                  type="button"
                  onClick={handleStopSession}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-xs transition-colors"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>End Lecture Session</span>
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Main Grid: Active Dynamic QR Code or New Session Launcher */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: QR Code Stage & Anti-Proxy Visualizer */}
        <div className="lg:col-span-1 space-y-6">
          {activeSession ? (
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4 text-center">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-700 flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  <span>Session Live</span>
                </span>
                <span className="font-mono text-slate-500">Seq #{tokenSeq}</span>
              </div>

              {/* Dynamic Rolling QR Canvas */}
              <div className="p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-blue-200 flex flex-col items-center justify-center relative">
                {rollingToken ? (
                  <QRCodeSVG
                    value={rollingToken}
                    size={220}
                    level="M"
                    includeMargin={true}
                    className="rounded-lg shadow-xs"
                  />
                ) : (
                  <div className="w-[220px] h-[220px] flex items-center justify-center text-slate-400 text-xs">
                    Generating Token...
                  </div>
                )}

                {/* 10-Second Countdown Meter */}
                <div className="w-full mt-4 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono font-semibold">
                    <span className="text-slate-600 flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-blue-600" />
                      <span>Token Refresh:</span>
                    </span>
                    <span className={secondsRemaining <= 3 ? 'text-rose-600 animate-pulse' : 'text-blue-600'}>
                      {secondsRemaining}s remaining
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-1000 ${
                        secondsRemaining <= 3 ? 'bg-rose-500' : 'bg-blue-600'
                      }`}
                      style={{ width: `${(secondsRemaining / 10) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Security Guarantee Pill */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-left space-y-1">
                <p className="text-xs font-bold text-blue-900 flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Anti-Proxy Security Enforced</span>
                </p>
                <p className="text-[11px] text-blue-800 leading-tight">
                  Token expires every 10 seconds. Screenshots sent via WhatsApp or forwarded photos are rendered unusable by the server.
                </p>
              </div>

              {/* Geofence specs */}
              <div className="text-xs text-left bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-600 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Classroom GPS:</span>
                  <span className="font-mono text-[11px]">
                    {activeSession.classroomCoordinates.latitude.toFixed(4)},{' '}
                    {activeSession.classroomCoordinates.longitude.toFixed(4)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Perimeter Radius:</span>
                  <span className="font-mono font-bold text-emerald-600">
                    ≤ {activeSession.classroomCoordinates.maxRadiusMeters} meters
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Launcher Form when no active session */
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                <Play className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-base">Launch Attendance Session</h3>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Subject & Syllabus</label>
                  <select
                    id="subject-select"
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    {subjectsList.map((s) => (
                      <option key={s.code} value={`${s.code} - ${s.name}`}>
                        {s.code} - {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Lecture Hall / Classroom</label>
                  <select
                    id="classroom-select"
                    value={selectedClassroom}
                    onChange={(e) => setSelectedClassroom(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    {classrooms.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.block})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Geofence GPS Anchor Option */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700 flex items-center space-x-1">
                      <MapPin className="w-3.5 h-3.5 text-rose-500" />
                      <span>Classroom GPS Perimeter</span>
                    </span>
                    <button
                      type="button"
                      onClick={syncFacultyGPS}
                      className="text-blue-600 hover:text-blue-700 text-[11px] font-semibold"
                    >
                      Use My Current Location
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {customGpsActive && facultyGps
                      ? `Anchored to: ${facultyGps.latitude.toFixed(4)}, ${facultyGps.longitude.toFixed(4)}`
                      : 'Default campus hall coordinates (50m maximum student radius)'}
                  </p>
                </div>

                <button
                  id="start-session-btn"
                  type="button"
                  disabled={startingSession}
                  onClick={handleStartSession}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors flex items-center justify-center space-x-2"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>{startingSession ? 'Launching Dynamic QR Session...' : 'Start Attendance Session'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right 2 Columns: Live Attending Students Roster & Export */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-slate-900 text-base">Live Attendance Roster</h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">
                    {attendees.length} Verified
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {activeSession ? `${activeSession.subjectName} (${activeSession.subjectCode})` : 'Awaiting live session'}
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={exportCSV}
                  disabled={attendees.length === 0}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                  title="Export Excel/CSV"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Export CSV</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                  title="Print formatted PDF audit"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" />
                  <span>Print Audit</span>
                </button>
              </div>
            </div>

            {/* Attendance Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-y border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Roll Number</th>
                    <th className="py-2.5 px-3">Student Name</th>
                    <th className="py-2.5 px-3">Verification Time</th>
                    <th className="py-2.5 px-3">GPS Distance</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendees.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No students have verified attendance for this session yet.
                      </td>
                    </tr>
                  ) : (
                    attendees.map((att) => (
                      <tr key={att._id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-3 font-mono font-semibold text-slate-800">{att.studentRoll}</td>
                        <td className="py-3 px-3 font-medium text-slate-900">{att.studentName}</td>
                        <td className="py-3 px-3 text-slate-500 font-mono">
                          {new Date(att.scannedAt).toLocaleTimeString()}
                        </td>
                        <td className="py-3 px-3 font-mono">
                          {typeof att.distanceMeters === 'number' ? (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px]">
                              {att.distanceMeters}m away
                            </span>
                          ) : (
                            <span className="text-slate-400">Manual Override</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-[10px]">
                            {att.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Critical Shortage & Warning Watchlist */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Attendance Shortage Watchlist</h3>
                <p className="text-xs text-slate-500">Students in Amber (65-74%) and Red (&lt;65%) eligibility brackets</p>
              </div>
              {warningSentMessage && (
                <span className="text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg font-medium">
                  {warningSentMessage}
                </span>
              )}
            </div>

            <div className="space-y-3">
              {/* Sneha Reddy - Red */}
              <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/50 flex items-center justify-between text-xs">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900">Sneha Reddy</span>
                    <span className="font-mono text-slate-500">(CS21B031)</span>
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px]">
                      58.3% - Debarred Risk
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Subject: CS302 (DBMS) • Guardian: parent.reddy@example.com
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSendWarning('CS21B031', 'CS302', 58.3)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center space-x-1 transition-colors shadow-xs"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Send Guardian Alert</span>
                </button>
              </div>

              {/* Priya Patel - Amber */}
              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 flex items-center justify-between text-xs">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900">Priya Patel</span>
                    <span className="font-mono text-slate-500">(CS21B088)</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                      70.8% - Attendance Warning
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Subject: CS301 (DSA) • Guardian: parent.patel@example.com
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSendWarning('CS21B088', 'CS301', 70.8)}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs flex items-center space-x-1 transition-colors shadow-xs"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Send Warning</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Manual Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Faculty Manual Attendance Override</h3>
              <button
                type="button"
                onClick={() => setShowOverrideModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManualOverride} className="space-y-3 text-xs">
              <p className="text-slate-500">
                Log attendance manually for students experiencing legitimate hardware failure or mobile browser GPS issues.
              </p>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Student Roll Number</label>
                <input
                  type="text"
                  placeholder="e.g. CS21B045"
                  value={overrideRoll}
                  onChange={(e) => setOverrideRoll(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono uppercase"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Reason for Manual Verification</label>
                <select
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Device camera failure during class">Device camera failure during class</option>
                  <option value="Mobile battery exhausted in lecture hall">Mobile battery exhausted in lecture hall</option>
                  <option value="Browser GPS timeout inside building basement">Browser GPS timeout inside building basement</option>
                  <option value="Late joining with valid academic permission">Late joining with valid academic permission</option>
                </select>
              </div>

              {overrideMessage && (
                <p className="text-xs bg-slate-100 p-2 rounded-lg font-medium text-slate-700">{overrideMessage}</p>
              )}

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs"
                >
                  Grant Manual Attendance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
