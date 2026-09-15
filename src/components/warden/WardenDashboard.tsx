import React, { useState, useEffect } from 'react';
import {
  Building,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  QrCode,
  Scan,
  Send,
  Download,
  Filter,
  Users,
  ShieldAlert,
  Phone,
  Mail,
  UserCheck,
  FileSpreadsheet,
  Printer,
  Sparkles,
  Camera,
} from 'lucide-react';
import { User, HostelResidentRoster, Outpass, CurfewStatusResponse } from '../../types';
import { api } from '../../services/api';

interface WardenDashboardProps {
  user: User;
  onRefreshAll: () => void;
}

export const WardenDashboard: React.FC<WardenDashboardProps> = ({ user, onRefreshAll }) => {
  const [selectedBlock, setSelectedBlock] = useState<string>('Block A (Boys)');
  const [selectedFloor, setSelectedFloor] = useState<number>(2);
  const [roster, setRoster] = useState<HostelResidentRoster[]>([]);
  const [summary, setSummary] = useState<{
    total: number;
    inside: number;
    absent: number;
    onLeave: number;
    lateEntry: number;
  }>({ total: 0, inside: 0, absent: 0, onLeave: 0, lateEntry: 0 });

  const [curfewData, setCurfewData] = useState<CurfewStatusResponse | null>(null);
  const [outpasses, setOutpasses] = useState<Outpass[]>([]);
  const [loading, setLoading] = useState(true);

  // Rapid Barcode / Student ID scanner
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeResult, setBarcodeResult] = useState<{ success: boolean; message: string } | null>(null);

  // Outpass review modal
  const [selectedOutpass, setSelectedOutpass] = useState<Outpass | null>(null);
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Curfew breach emergency alert
  const [curfewAlertSent, setCurfewAlertSent] = useState<string | null>(null);

  // Load all warden views
  const loadHostelData = async () => {
    try {
      const [rosterRes, curfewRes, outRes] = await Promise.all([
        api.getHostelRoster({ block: selectedBlock, floor: selectedFloor }),
        api.getCurfewStatus(),
        api.getOutpasses(),
      ]);
      setRoster(rosterRes.roster);
      setSummary(rosterRes.summary);
      setCurfewData(curfewRes);
      setOutpasses(outRes.outpasses);
    } catch (err) {
      console.error('Failed to load hostel data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHostelData();
  }, [selectedBlock, selectedFloor]);

  // Warden toggles resident status
  const handleToggleStatus = async (
    studentId: string,
    newStatus: 'inside' | 'absent' | 'late_entry' | 'on_leave'
  ) => {
    try {
      await api.verifyHostelStatus({
        studentId,
        status: newStatus,
      });
      loadHostelData();
      onRefreshAll();
    } catch (err: any) {
      alert(err.message || 'Failed to update roll call status');
    }
  };

  // Rapid barcode verification
  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput) return;

    try {
      const res = await api.scanHostelBarcode(barcodeInput.trim());
      setBarcodeResult({
        success: true,
        message: res.message,
      });
      setBarcodeInput('');
      loadHostelData();
      onRefreshAll();
    } catch (err: any) {
      setBarcodeResult({
        success: false,
        message: err.message || 'Verification failed',
      });
    }
  };

  // Review Outpass (Approve / Reject)
  const handleReviewOutpass = async (decision: 'approved' | 'rejected') => {
    if (!selectedOutpass) return;
    try {
      await api.reviewOutpass(selectedOutpass._id, {
        decision,
        remarks: reviewRemarks || (decision === 'approved' ? 'Approved by Chief Warden' : 'Rejected due to campus policy'),
      });
      setActionMessage(`Outpass #${selectedOutpass._id} marked ${decision.toUpperCase()}`);
      setSelectedOutpass(null);
      setReviewRemarks('');
      loadHostelData();
      onRefreshAll();
    } catch (err: any) {
      alert(err.message || 'Failed to process outpass review');
    }
  };

  // Dispatch emergency alert for unaccounted student
  const handleDispatchCurfewAlert = async (student: HostelResidentRoster) => {
    try {
      await api.triggerCurfewAudit({
        studentRoll: student.rollNumber || 'N/A',
        studentName: student.name,
        roomNumber: student.roomNumber,
        guardianEmail: student.guardianEmail,
      });
      setCurfewAlertSent(`Curfew breach alert dispatched to guardian of ${student.name}`);
      setTimeout(() => setCurfewAlertSent(null), 4000);
      onRefreshAll();
    } catch (err: any) {
      alert(err.message || 'Failed to trigger alert');
    }
  };

  // Export CSV
  const exportNightLogCSV = () => {
    const headers = ['Block', 'Floor', 'Room Number', 'Roll Number', 'Student Name', 'Department', 'Status', 'Check-In Time', 'Remarks', 'Approved Outpass'];
    const rows = roster.map((r) => [
      r.block,
      `Floor ${r.floor}`,
      r.roomNumber,
      r.rollNumber || 'N/A',
      r.name,
      r.department || 'N/A',
      r.status.toUpperCase(),
      r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString() : 'N/A',
      r.remarks || 'N/A',
      r.hasApprovedOutpass ? `YES (${r.outpassDetails?.destination})` : 'NO',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Hostel_RollCall_${selectedBlock.replace(/\s+/g, '_')}_Floor${selectedFloor}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const pendingOutpasses = outpasses.filter((o) => o.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Top Banner & Curfew Countdown */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                Residential Campus Security
              </span>
              <span className="text-xs text-slate-400 font-mono">Col. Vijay Singh (Retd.)</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">Hostel Night Roll Call & Curfew Oversight</h2>
            <p className="text-xs text-slate-500">
              Supervisor-controlled physical round verification, barcode scanning, and curfew breach audits.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              id="rapid-barcode-btn"
              type="button"
              onClick={() => setShowBarcodeScanner(true)}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-xs transition-colors"
            >
              <Scan className="w-4 h-4" />
              <span>Rapid ID Barcode Scanner</span>
            </button>
            <button
              type="button"
              onClick={exportNightLogCSV}
              className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export Roster CSV</span>
            </button>
          </div>
        </div>

        {/* Curfew Status Bar */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-slate-500 block text-[11px]">Curfew Cutoff</span>
            <span className="font-bold text-slate-900 text-sm">{curfewData?.curfewTime || '21:30'} PM</span>
          </div>
          <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
            <span className="text-emerald-700 block text-[11px]">Inside Verified</span>
            <span className="font-bold text-emerald-900 text-sm">{summary.inside} Residents</span>
          </div>
          <div className="bg-blue-50 p-3 rounded-xl border border-blue-200">
            <span className="text-blue-700 block text-[11px]">On Approved Leave</span>
            <span className="font-bold text-blue-900 text-sm">{summary.onLeave} Residents</span>
          </div>
          <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
            <span className="text-amber-700 block text-[11px]">Late Entries</span>
            <span className="font-bold text-amber-900 text-sm">{summary.lateEntry} Residents</span>
          </div>
          <div className="bg-rose-50 p-3 rounded-xl border border-rose-200 col-span-2 sm:col-span-1">
            <span className="text-rose-700 block text-[11px]">Unaccounted / Missing</span>
            <span className="font-bold text-rose-900 text-sm">{summary.absent} Residents</span>
          </div>
        </div>
      </div>

      {/* Curfew Breach Alert Banner */}
      {curfewData && curfewData.unaccountedCount > 0 && (
        <div className="bg-rose-50 border border-rose-300 rounded-2xl p-5 text-xs text-rose-950 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              <div>
                <h3 className="font-bold text-rose-900 text-sm">
                  Curfew Non-Compliance Register: {curfewData.unaccountedCount} Unaccounted Resident(s)
                </h3>
                <p className="text-rose-700 text-[11px]">
                  Students neither confirmed inside nor possessing an approved outpass past 09:30 PM cutoff.
                </p>
              </div>
            </div>
            {curfewAlertSent && (
              <span className="text-xs bg-white text-rose-700 font-semibold px-2.5 py-1 rounded-lg border border-rose-300 shadow-xs">
                {curfewAlertSent}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {curfewData.unaccounted.map((unacc) => (
              <div
                key={unacc.studentId}
                className="bg-white p-3.5 rounded-xl border border-rose-200 flex items-center justify-between shadow-xs"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900">{unacc.name}</span>
                    <span className="font-mono text-slate-500 font-semibold">({unacc.rollNumber})</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Room {unacc.roomNumber} • {unacc.block}
                  </p>
                  <p className="text-[10px] text-slate-400">Guardian: {unacc.guardianEmail || 'N/A'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDispatchCurfewAlert(unacc)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center space-x-1 shadow-xs transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Notify Guardian</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Hierarchy: Block -> Floor -> Room Roster */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Door-to-Door Night Roll Call Roster */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Door-to-Door Physical Roll Call</h3>
                <p className="text-xs text-slate-500">Supervisor tap controls (Academic self-scanning strictly disabled)</p>
              </div>

              {/* Block & Floor Filter Pills */}
              <div className="flex items-center space-x-2 text-xs">
                {/* Block Selector */}
                <select
                  value={selectedBlock}
                  onChange={(e) => setSelectedBlock(e.target.value)}
                  className="p-1.5 rounded-lg border border-slate-300 font-medium text-slate-700 bg-slate-50 focus:outline-hidden"
                >
                  <option value="Block A (Boys)">Block A (Boys)</option>
                  <option value="Block B (Girls)">Block B (Girls)</option>
                </select>

                {/* Floor Selector */}
                <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg">
                  {[1, 2, 3].map((floor) => (
                    <button
                      key={floor}
                      type="button"
                      onClick={() => setSelectedFloor(floor)}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                        selectedFloor === floor
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      Floor {floor}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Resident Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {roster.length === 0 ? (
                <div className="col-span-2 py-8 text-center text-slate-400 text-xs">
                  No resident records found for {selectedBlock} - Floor {selectedFloor}.
                </div>
              ) : (
                roster.map((resident) => {
                  const isInside = resident.status === 'inside';
                  const isAbsent = resident.status === 'absent';
                  const isLate = resident.status === 'late_entry';
                  const isLeave = resident.status === 'on_leave';

                  return (
                    <div
                      key={resident.studentId}
                      className={`p-4 rounded-xl border transition-all text-xs space-y-3 ${
                        isInside
                          ? 'bg-emerald-50/40 border-emerald-200'
                          : isAbsent
                          ? 'bg-rose-50/60 border-rose-300'
                          : isLate
                          ? 'bg-amber-50/50 border-amber-200'
                          : 'bg-blue-50/50 border-blue-200'
                      }`}
                    >
                      {/* Card Header: Room, Name, Roll */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-900 text-white">
                              {resident.roomNumber}
                            </span>
                            <span className="font-bold text-slate-900 text-sm">{resident.name}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {resident.rollNumber} • {resident.department}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                            isInside
                              ? 'bg-emerald-100 text-emerald-800'
                              : isAbsent
                              ? 'bg-rose-100 text-rose-800'
                              : isLate
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {resident.status.replace('_', ' ')}
                        </span>
                      </div>

                      {/* Outpass Tag if approved */}
                      {resident.hasApprovedOutpass && (
                        <div className="p-2 bg-blue-100/70 border border-blue-200 rounded-lg text-[11px] text-blue-900">
                          <p className="font-semibold">✓ On Approved Outpass</p>
                          <p className="text-[10px] text-blue-700 mt-0.2">
                            Destination: {resident.outpassDetails?.destination}
                          </p>
                        </div>
                      )}

                      {/* Tap Action Controls (Supervisor Physical Verification) */}
                      <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(resident.studentId, 'inside')}
                          className={`flex-1 py-1.5 px-2 rounded-lg font-semibold text-[11px] transition-colors ${
                            isInside
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          Inside
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(resident.studentId, 'absent')}
                          className={`flex-1 py-1.5 px-2 rounded-lg font-semibold text-[11px] transition-colors ${
                            isAbsent
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-white hover:bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          Absent
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(resident.studentId, 'late_entry')}
                          className={`flex-1 py-1.5 px-2 rounded-lg font-semibold text-[11px] transition-colors ${
                            isLate
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'bg-white hover:bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          Late Entry
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Outpass Authorization Queue */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Outpass Approval Queue</h3>
                <p className="text-xs text-slate-500">Warden gate authorization pipeline</p>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-xs">
                {pendingOutpasses.length} Pending
              </span>
            </div>

            {actionMessage && (
              <p className="text-xs bg-emerald-50 text-emerald-800 p-2.5 rounded-xl border border-emerald-200 font-medium">
                {actionMessage}
              </p>
            )}

            <div className="space-y-3">
              {pendingOutpasses.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">All outpass requests have been reviewed.</p>
              ) : (
                pendingOutpasses.map((op) => (
                  <div key={op._id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{op.studentName}</span>
                      <span className="font-mono text-slate-500 font-semibold">{op.roomNumber}</span>
                    </div>

                    <div className="text-slate-600 space-y-0.5 text-[11px]">
                      <p>
                        <strong className="text-slate-700">Type:</strong> {op.passType.replace('_', ' ').toUpperCase()}
                      </p>
                      <p>
                        <strong className="text-slate-700">Destination:</strong> {op.destination}
                      </p>
                      <p>
                        <strong className="text-slate-700">Dates:</strong> {new Date(op.fromDateTime).toLocaleDateString()} to{' '}
                        {new Date(op.toDateTime).toLocaleDateString()}
                      </p>
                      <p>
                        <strong className="text-slate-700">Reason:</strong> {op.reason}
                      </p>
                      <p>
                        <strong className="text-slate-700">Emergency Contact:</strong> {op.emergencyContact}
                      </p>
                    </div>

                    {/* Review Actions */}
                    <div className="pt-2 border-t border-slate-200 flex items-center justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOutpass(op);
                          handleReviewOutpass('rejected');
                        }}
                        className="px-3 py-1.5 rounded-lg border border-rose-300 hover:bg-rose-50 text-rose-700 font-semibold text-xs transition-colors"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOutpass(op);
                          handleReviewOutpass('approved');
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-colors"
                      >
                        Approve & Sync Leave
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Rapid ID Barcode Scanner Modal */}
      {showBarcodeScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Scan className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Physical Student ID Barcode Scanner</h3>
                  <p className="text-xs text-slate-500">Rapid night round verification</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBarcodeScanner(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleBarcodeSubmit} className="space-y-3 text-xs">
              <p className="text-slate-500">
                Scan or enter student physical ID card barcode or Roll Number to instantly confirm physical presence inside room.
              </p>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Barcode / Roll Number Input</label>
                <input
                  id="barcode-input"
                  type="text"
                  placeholder="e.g. CS21B045 or scan barcode..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  autoFocus
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono text-sm uppercase"
                />
              </div>

              {/* Sample Quick Barcode Chips for easy testing */}
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Test Student Barcode Chips:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {['CS21B045', 'CS21B088', 'EC21B012', 'CS21B031', 'CS21B019'].map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setBarcodeInput(code)}
                      className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[11px]"
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>

              {barcodeResult && (
                <div
                  className={`p-3 rounded-xl text-xs ${
                    barcodeResult.success
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border border-rose-200 text-rose-900'
                  }`}
                >
                  <p className="font-semibold">{barcodeResult.message}</p>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBarcodeScanner(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs"
                >
                  Verify Presence
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
