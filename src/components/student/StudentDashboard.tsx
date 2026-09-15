import React, { useState, useEffect, useRef } from 'react';
import {
  QrCode,
  MapPin,
  ShieldCheck,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Send,
  Camera,
  Compass,
  AlertTriangle,
  ChevronRight,
  Sparkles,
  Info,
  Calendar,
  RotateCw,
} from 'lucide-react';
import { User, StudentAttendanceSummary, Outpass, AcademicSession } from '../../types';
import { api } from '../../services/api';

interface StudentDashboardProps {
  user: User;
  activeSessions: AcademicSession[];
  onRefreshAll: () => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  user,
  activeSessions,
  onRefreshAll,
}) => {
  const [summary, setSummary] = useState<StudentAttendanceSummary | null>(null);
  const [outpasses, setOutpasses] = useState<Outpass[]>([]);
  const [loading, setLoading] = useState(true);

  // Scanner & GPS State
  const [showScanner, setShowScanner] = useState(false);
  const [qrInputToken, setQrInputToken] = useState('');
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number; accuracy?: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<{
    success?: boolean;
    message?: string;
    distanceMeters?: number;
    subject?: string;
    code?: string;
  } | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Simulation mode for testing geofence
  const [simDistanceMode, setSimDistanceMode] = useState<'real' | 'inside' | 'outside'>('inside');

  // Outpass Application Form State
  const [showOutpassModal, setShowOutpassModal] = useState(false);
  const [outpassForm, setOutpassForm] = useState({
    passType: 'day_outpass' as 'day_outpass' | 'home_leave',
    fromDateTime: '',
    toDateTime: '',
    reason: '',
    destination: '',
    emergencyContact: user.phone || '+91 98765 43210',
  });
  const [submittingOutpass, setSubmittingOutpass] = useState(false);
  const [outpassMessage, setOutpassMessage] = useState<string | null>(null);

  // Video Ref for Camera QR Scanner
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  // Load summary and outpasses
  const loadData = async () => {
    try {
      const [sumRes, outRes] = await Promise.all([
        api.getStudentSummary(user._id),
        api.getOutpasses(),
      ]);
      setSummary(sumRes);
      setOutpasses(outRes.outpasses);
    } catch (err) {
      console.error('Failed to load student data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user._id]);

  // Capture real GPS coordinates from browser
  const captureGPS = () => {
    setGpsLoading(true);
    setGpsError(null);

    if (!navigator.geolocation) {
      setGpsError('HTML5 Geolocation is not supported by this browser.');
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        });
        setGpsLoading(false);
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
        setGpsError(`${err.message} (Fallback coordinate simulator available)`);
        // Fallback to demo campus classroom coordinate
        setUserCoords({
          latitude: 28.5458,
          longitude: 77.1926,
          accuracy: 10,
        });
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Start real camera stream if requested
  const startCamera = async () => {
    setCameraActive(true);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }
    } catch (err) {
      console.warn('Camera access unavailable:', err);
    }
  };

  const stopCamera = () => {
    setCameraActive(false);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  // Handle Verify QR Attendance
  const handleVerifyAttendance = async (tokenToVerify?: string) => {
    const token = tokenToVerify || qrInputToken;
    if (!token) {
      setScanResult({ success: false, message: 'Please scan or provide an active dynamic QR token.' });
      return;
    }

    setVerifying(true);
    setScanResult(null);

    // Compute coordinates based on mode
    let targetLat = 28.5458;
    let targetLon = 77.1926;

    if (simDistanceMode === 'real' && userCoords) {
      targetLat = userCoords.latitude;
      targetLon = userCoords.longitude;
    } else if (simDistanceMode === 'inside') {
      // Very close to classroom (within 12 meters)
      targetLat = 28.54582;
      targetLon = 77.19263;
    } else if (simDistanceMode === 'outside') {
      // 320 meters away (fraudulent proxy attempt from hostel or canteen)
      targetLat = 28.5485;
      targetLon = 77.1955;
    }

    try {
      const res = await api.verifyAttendance({
        token: token.trim(),
        latitude: targetLat,
        longitude: targetLon,
        studentId: user._id,
      });

      setScanResult({
        success: true,
        message: res.message,
        distanceMeters: res.distanceMeters,
        subject: res.subject,
      });
      loadData();
      onRefreshAll();
    } catch (err: any) {
      setScanResult({
        success: false,
        message: err.message || 'Verification rejected by attendance server.',
        distanceMeters: err.data?.distanceMeters,
      });
    } finally {
      setVerifying(false);
    }
  };

  // Handle Outpass submit
  const handleSubmitOutpass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outpassForm.fromDateTime || !outpassForm.toDateTime || !outpassForm.destination || !outpassForm.reason) {
      setOutpassMessage('Please complete all required outpass fields.');
      return;
    }

    setSubmittingOutpass(true);
    setOutpassMessage(null);

    try {
      await api.applyOutpass({
        ...outpassForm,
      });
      setOutpassMessage('Outpass request submitted successfully! Awaiting warden review.');
      setShowOutpassModal(false);
      loadData();
      onRefreshAll();
    } catch (err: any) {
      setOutpassMessage(err.message || 'Failed to submit outpass');
    } finally {
      setSubmittingOutpass(false);
    }
  };

  // Pick active session's live rolling token for fast 1-click scan
  const activeSession = activeSessions[0];

  return (
    <div className="space-y-6">
      {/* Top Banner: Academic Standing & Hostel Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Overall Percentage Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center space-x-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-lg text-white shadow-xs ${
              (summary?.overallPercentage || 0) >= 75
                ? 'bg-emerald-600'
                : (summary?.overallPercentage || 0) >= 65
                ? 'bg-amber-500'
                : 'bg-rose-600'
            }`}
          >
            {summary?.overallPercentage ?? '--'}%
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Overall Academic Status</span>
              {(summary?.overallPercentage || 0) >= 75 ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              )}
            </div>
            <p className="font-bold text-slate-900 text-sm mt-0.5">
              {(summary?.overallPercentage || 0) >= 75
                ? 'Eligible for Final Examinations (≥75%)'
                : (summary?.overallPercentage || 0) >= 65
                ? 'Attendance Warning (65%–74%)'
                : 'Debarred / Critical Shortage (<65%)'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Calculated across 4 core engineering subjects</p>
          </div>
        </div>

        {/* Hostel Night Oversight */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
            <Clock className="w-7 h-7" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Hostel Curfew & Status</span>
            <div className="flex items-center space-x-2 mt-0.5">
              <span className="font-bold text-slate-900 text-sm">Room {user.hostelDetails?.roomNumber || 'A-204'}</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                Inside Verified
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Institutional Curfew: <span className="font-semibold text-slate-700">09:30 PM Nightly</span></p>
          </div>
        </div>

        {/* Active Session & Anti-Proxy Scanner CTA */}
        <div className="bg-gradient-to-br from-blue-700 to-indigo-800 rounded-2xl p-5 text-white shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-200 uppercase tracking-wider flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-300" />
              <span>Anti-Proxy QR Scanner</span>
            </span>
            {activeSessions.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-400 text-emerald-950 font-bold text-[10px] animate-pulse">
                {activeSessions.length} Lecture Live
              </span>
            )}
          </div>
          <div className="my-2">
            <p className="font-bold text-base">Dynamic Rolling QR & Geofence</p>
            <p className="text-xs text-blue-100 line-clamp-1">
              10s Rolling Token + 50m Classroom GPS Perimeter
            </p>
          </div>
          <button
            id="open-scanner-btn"
            type="button"
            onClick={() => {
              setShowScanner(true);
              captureGPS();
            }}
            className="w-full py-2 px-3 rounded-xl bg-white text-blue-900 hover:bg-blue-50 font-semibold text-xs transition-colors flex items-center justify-center space-x-2 shadow-xs"
          >
            <QrCode className="w-4 h-4" />
            <span>Open Attendance Scanner</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Subject Attendance Progress & Outpass Management */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Subject Cards & Percentage Thresholds */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Course Attendance Summary</h3>
                <p className="text-xs text-slate-500">Live eligibility breakdown per academic syllabus</p>
              </div>
              <div className="flex items-center space-x-2 text-[11px]">
                <span className="flex items-center space-x-1 text-emerald-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>≥75% Eligible</span>
                </span>
                <span className="flex items-center space-x-1 text-amber-700">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span>65-74% Warning</span>
                </span>
                <span className="flex items-center space-x-1 text-rose-700">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span>&lt;65% Debarred</span>
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {summary?.subjects.map((sub) => {
                const isGreen = sub.percentage >= 75;
                const isAmber = sub.percentage >= 65 && sub.percentage < 75;
                const isRed = sub.percentage < 65;

                return (
                  <div
                    key={sub.code}
                    className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2.5">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-200/70 text-slate-700">
                          {sub.code}
                        </span>
                        <span className="font-semibold text-slate-800 text-sm">{sub.name}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-slate-500">
                          {sub.attendedSessions} / {sub.totalSessions} sessions
                        </span>
                        <span
                          className={`font-mono font-bold text-sm px-2.5 py-0.5 rounded-full ${
                            isGreen
                              ? 'bg-emerald-100 text-emerald-800'
                              : isAmber
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {sub.percentage}%
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          isGreen ? 'bg-emerald-500' : isAmber ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, sub.percentage)}%` }}
                      ></div>
                    </div>

                    {/* Bottom Alert / Target Note */}
                    <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
                      <span>
                        {isGreen && '✓ Exam attendance eligibility requirement satisfied'}
                        {isAmber && '⚠ Warning: Needs 2 consecutive sessions to cross 75%'}
                        {isRed && '🚨 Critical: Debarred risk. Guardian notification triggered'}
                      </span>
                      <span className="font-medium text-slate-600">Min. Target: 75%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Scanned Attendance Audit */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
            <h3 className="font-bold text-slate-900 text-base mb-3">My Recent Academic Scans</h3>
            <div className="divide-y divide-slate-100">
              {summary?.recentScans.slice(0, 5).map((scan) => (
                <div key={scan._id} className="py-3 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{scan.subjectCode} Lecture</p>
                      <p className="text-[11px] text-slate-500">
                        {new Date(scan.scannedAt).toLocaleDateString()} at{' '}
                        {new Date(scan.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-[11px]">
                      Present
                    </span>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      GPS Dist: {scan.distanceMeters ? `${scan.distanceMeters}m` : 'Classroom Geofence'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Outpass & Leave Pipeline */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Digital Outpass Portal</h3>
                <p className="text-xs text-slate-500">Hostel gate leave authorization</p>
              </div>
              <button
                id="apply-outpass-btn"
                type="button"
                onClick={() => setShowOutpassModal(true)}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center space-x-1.5 transition-colors shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Apply</span>
              </button>
            </div>

            <div className="space-y-3">
              {outpasses.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">No outpass requests submitted.</p>
              ) : (
                outpasses.map((op) => (
                  <div
                    key={op._id}
                    className="p-3.5 rounded-xl border border-slate-200/70 bg-slate-50/50 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800 uppercase tracking-wider text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                        {op.passType.replace('_', ' ')}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                          op.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : op.status === 'rejected'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {op.status.toUpperCase()}
                      </span>
                    </div>

                    <div>
                      <p className="font-medium text-slate-900">{op.destination}</p>
                      <p className="text-slate-500 text-[11px] line-clamp-2 mt-0.5">Reason: {op.reason}</p>
                    </div>

                    <div className="pt-2 border-t border-slate-200/50 flex items-center justify-between text-[10px] text-slate-500">
                      <span>Until: {new Date(op.toDateTime).toLocaleDateString()}</span>
                      {op.reviewedByName && (
                        <span className="text-slate-600 font-medium">Rev: {op.reviewedByName}</span>
                      )}
                    </div>

                    {op.reviewRemarks && (
                      <p className="text-[10px] text-slate-600 italic bg-white p-1.5 rounded border border-slate-200">
                        "{op.reviewRemarks}"
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Anti-Proxy QR Scanner & Geofence Verification */}
      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Lecture Attendance Verification</h3>
                  <p className="text-xs text-slate-500">Anti-Proxy 10-Second Rolling QR & 50m Geofence</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setShowScanner(false);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Live GPS Coordinates & Geofence Calculator */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 flex items-center space-x-1.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                  <span>Student Browser Geolocation</span>
                </span>
                <button
                  type="button"
                  onClick={captureGPS}
                  disabled={gpsLoading}
                  className="text-blue-600 hover:text-blue-700 text-[11px] font-semibold flex items-center space-x-1"
                >
                  <RotateCw className={`w-3 h-3 ${gpsLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh GPS</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">Latitude</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {userCoords ? userCoords.latitude.toFixed(5) : '28.54580 (Classroom)'}
                  </span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">Longitude</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {userCoords ? userCoords.longitude.toFixed(5) : '77.19260 (Classroom)'}
                  </span>
                </div>
              </div>

              {/* Simulation Mode Toggle (to let tester experience both Inside 50m & Outside >50m proxy rejection) */}
              <div className="pt-2 border-t border-slate-200">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Geofence Testing Scenario (Haversine Formula Test):
                </span>
                <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setSimDistanceMode('inside')}
                    className={`p-1.5 rounded-lg border text-center font-medium transition-colors ${
                      simDistanceMode === 'inside'
                        ? 'bg-emerald-100 border-emerald-300 text-emerald-900 font-semibold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Inside (~8m)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimDistanceMode('outside')}
                    className={`p-1.5 rounded-lg border text-center font-medium transition-colors ${
                      simDistanceMode === 'outside'
                        ? 'bg-rose-100 border-rose-300 text-rose-900 font-semibold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Proxying (&gt;300m)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimDistanceMode('real')}
                    className={`p-1.5 rounded-lg border text-center font-medium transition-colors ${
                      simDistanceMode === 'real'
                        ? 'bg-blue-100 border-blue-300 text-blue-900 font-semibold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Raw GPS
                  </button>
                </div>
              </div>
            </div>

            {/* Quick sync with active faculty lecture token */}
            {activeSession ? (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs flex items-center justify-between">
                <div>
                  <p className="font-semibold text-blue-900">{activeSession.subjectName} ({activeSession.subjectCode})</p>
                  <p className="text-[11px] text-blue-700">Lecture Hall: {activeSession.classroomName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setQrInputToken(activeSession.currentSecretToken);
                    handleVerifyAttendance(activeSession.currentSecretToken);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors"
                >
                  Scan Active Token
                </button>
              </div>
            ) : (
              <div className="p-3 bg-slate-100 rounded-xl text-xs text-slate-600 text-center">
                No active faculty lecture session is currently broadcasting. You can launch one from the Faculty perspective.
              </div>
            )}

            {/* Camera Viewfinder (HTML5 Scanner) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">Live Camera QR Scanner</label>
                <button
                  type="button"
                  onClick={() => (cameraActive ? stopCamera() : startCamera())}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center space-x-1"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{cameraActive ? 'Turn Camera Off' : 'Enable Camera'}</span>
                </button>
              </div>

              {cameraActive ? (
                <div className="relative w-full h-48 bg-black rounded-xl overflow-hidden flex items-center justify-center">
                  <video ref={videoRef} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 border-2 border-emerald-400/80 rounded-xl pointer-events-none flex items-center justify-center">
                    <div className="w-32 h-32 border-2 border-dashed border-white/70 rounded-lg animate-pulse"></div>
                  </div>
                </div>
              ) : null}

              {/* Manual / Scanned Token Input */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Rolling QR Code Token Payload
                </label>
                <input
                  id="qr-token-input"
                  type="text"
                  value={qrInputToken}
                  onChange={(e) => setQrInputToken(e.target.value)}
                  placeholder="Paste or scanned base64 rolling token..."
                  className="w-full text-xs font-mono p-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Result Alert Box */}
            {scanResult && (
              <div
                className={`p-3.5 rounded-xl text-xs space-y-1 ${
                  scanResult.success
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border border-rose-200 text-rose-900'
                }`}
              >
                <div className="flex items-center space-x-2 font-bold text-sm">
                  {scanResult.success ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Attendance Verified: Present</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-rose-600" />
                      <span>Attendance Verification Denied</span>
                    </>
                  )}
                </div>
                <p className="text-xs">{scanResult.message}</p>
                {typeof scanResult.distanceMeters === 'number' && (
                  <p className="text-[11px] font-mono">
                    Computed Haversine Distance: <span className="font-bold">{scanResult.distanceMeters} meters</span> (Perimeter threshold: ≤50m)
                  </p>
                )}
              </div>
            )}

            {/* Submit Verification Button */}
            <button
              id="submit-verify-btn"
              type="button"
              disabled={verifying}
              onClick={() => handleVerifyAttendance()}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-xs shadow-xs transition-colors flex items-center justify-center space-x-2"
            >
              {verifying ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Computing Haversine Distance & Token Signature...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verify Geofenced Attendance</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Modal: Apply for Outpass */}
      {showOutpassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">New Hostel Outpass Application</h3>
              <button
                type="button"
                onClick={() => setShowOutpassModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitOutpass} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Pass Category</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOutpassForm({ ...outpassForm, passType: 'day_outpass' })}
                    className={`p-2 rounded-xl border text-center font-semibold transition-colors ${
                      outpassForm.passType === 'day_outpass'
                        ? 'bg-blue-50 border-blue-400 text-blue-800'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    Day Outpass (Local)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOutpassForm({ ...outpassForm, passType: 'home_leave' })}
                    className={`p-2 rounded-xl border text-center font-semibold transition-colors ${
                      outpassForm.passType === 'home_leave'
                        ? 'bg-blue-50 border-blue-400 text-blue-800'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    Home Leave (Overnight)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Exit Date & Time</label>
                  <input
                    type="datetime-local"
                    value={outpassForm.fromDateTime}
                    onChange={(e) => setOutpassForm({ ...outpassForm, fromDateTime: e.target.value })}
                    required
                    className="w-full p-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Expected Return</label>
                  <input
                    type="datetime-local"
                    value={outpassForm.toDateTime}
                    onChange={(e) => setOutpassForm({ ...outpassForm, toDateTime: e.target.value })}
                    required
                    className="w-full p-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Destination Address / City</label>
                <input
                  type="text"
                  placeholder="e.g. Pune Family Residence, Maharashtra"
                  value={outpassForm.destination}
                  onChange={(e) => setOutpassForm({ ...outpassForm, destination: e.target.value })}
                  required
                  className="w-full p-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Emergency / Guardian Contact</label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={outpassForm.emergencyContact}
                  onChange={(e) => setOutpassForm({ ...outpassForm, emergencyContact: e.target.value })}
                  required
                  className="w-full p-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Detailed Reason</label>
                <textarea
                  rows={2}
                  placeholder="State academic, medical, or familial reason for leave..."
                  value={outpassForm.reason}
                  onChange={(e) => setOutpassForm({ ...outpassForm, reason: e.target.value })}
                  required
                  className="w-full p-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                ></textarea>
              </div>

              {outpassMessage && (
                <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded-lg">{outpassMessage}</p>
              )}

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowOutpassModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOutpass}
                  className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs"
                >
                  {submittingOutpass ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
