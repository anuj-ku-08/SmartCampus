import React, { useState } from 'react';
import {
  Shield,
  GraduationCap,
  UserCheck,
  Building,
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  RotateCcw,
  ArrowLeft,
} from 'lucide-react';
import { User, UserRole } from '../../types';
import { api } from '../../services/api';

interface LoginPortalProps {
  onLoginSuccess: (user: User) => void;
}

interface RoleConfig {
  role: UserRole;
  label: string;
  defaultEmail: string;
  icon: React.ReactNode;
}

export const LoginPortal: React.FC<LoginPortalProps> = ({ onLoginSuccess }) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>(() => {
    const saved = localStorage.getItem('campus_last_role') as UserRole;
    return saved || 'student';
  });
  const [email, setEmail] = useState<string>(() => {
    return localStorage.getItem('campus_last_email') || 'student@campus.edu';
  });
  const [password, setPassword] = useState('pass123');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Reset Password State
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');

  const roles: RoleConfig[] = [
    {
      role: 'student',
      label: 'Student',
      defaultEmail: 'student@campus.edu',
      icon: <GraduationCap className="w-4 h-4" />,
    },
    {
      role: 'faculty',
      label: 'Faculty',
      defaultEmail: 'faculty@campus.edu',
      icon: <UserCheck className="w-4 h-4" />,
    },
    {
      role: 'warden',
      label: 'Hostel Warden',
      defaultEmail: 'warden@campus.edu',
      icon: <Building className="w-4 h-4" />,
    },
    {
      role: 'admin',
      label: 'Admin',
      defaultEmail: 'admin@campus.edu',
      icon: <Shield className="w-4 h-4" />,
    },
  ];

  const demoEmails = ['student@campus.edu', 'faculty@campus.edu', 'warden@campus.edu', 'admin@campus.edu', 'priya@campus.edu', 'rohit@campus.edu', 'sneha@campus.edu', 'dev@campus.edu'];

  const handleRoleChange = (role: UserRole) => {
    setSelectedRole(role);
    const target = roles.find((r) => r.role === role);
    if (target) {
      // Only switch email if it's empty or currently matching another default demo email
      if (!email.trim() || demoEmails.includes(email.trim().toLowerCase())) {
        setEmail(target.defaultEmail);
        setPassword('pass123');
      }
    }
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleFillDemoCredentials = () => {
    const target = roles.find((r) => r.role === selectedRole);
    if (target) {
      setEmail(target.defaultEmail);
      setPassword('pass123');
      setSuccessMessage(`Loaded demo credentials for ${target.label}`);
      setTimeout(() => setSuccessMessage(null), 2500);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await api.login(email.trim(), password);
      localStorage.setItem('campus_last_email', email.trim());
      localStorage.setItem('campus_last_role', res.user.role);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetIdentifier.trim()) {
      setErrorMessage('Please enter your institutional email or roll number.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await api.resetPassword({
        identifier: resetIdentifier.trim(),
        newPassword: resetNewPassword.trim() || 'pass123',
      });
      setSuccessMessage(res.message);
      // Pre-fill login credentials with the reset email and new password
      setEmail(res.userEmail);
      setPassword(resetNewPassword.trim() || 'pass123');
      // Reset view after brief pause or keep confirmation visible
      setTimeout(() => {
        setIsResetMode(false);
      }, 1800);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to reset password. Please check the entered details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoLogin = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await api.demoLogin(selectedRole, email);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'Demo authentication failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-100">
      <div className="max-w-md w-full">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 text-white shadow-lg mb-3">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">SmartCampus</h1>
          <p className="text-xs text-slate-400 mt-1">Institutional Attendance & Hostel Security System</p>
        </div>

        {/* Card Container */}
        <div className="bg-slate-800 border border-slate-700/80 rounded-2xl p-6 sm:p-7 shadow-xl">
          {/* Alerts */}
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {!isResetMode ? (
            /* Normal Login Form */
            <div>
              {/* Role Selector Tabs */}
              <div className="mb-5">
                <label className="block text-xs font-semibold text-slate-300 mb-2">Select Your Role</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-900/80 rounded-xl border border-slate-700/70">
                  {roles.map((r) => {
                    const isSelected = selectedRole === r.role;
                    return (
                      <button
                        key={r.role}
                        type="button"
                        onClick={() => handleRoleChange(r.role)}
                        className={`py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        {r.icon}
                        <span className="truncate">{r.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {/* Email Field */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Institutional Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="user@campus.edu"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="login-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                    />
                  </div>

                  {/* RESET PASSWORD UNDER LOGIN PASSWORD FIELD */}
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={handleFillDemoCredentials}
                      className="text-slate-400 hover:text-slate-200 text-[11px] transition-colors underline decoration-slate-600"
                    >
                      Autofill Demo Credentials
                    </button>
                    <button
                      id="reset-password-btn"
                      type="button"
                      onClick={() => {
                        setIsResetMode(true);
                        setResetIdentifier(email);
                        setErrorMessage(null);
                        setSuccessMessage(null);
                      }}
                      className="text-blue-400 hover:text-blue-300 font-semibold transition-colors flex items-center space-x-1"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Reset password?</span>
                    </button>
                  </div>
                </div>

                {/* Submit & Demo Actions */}
                <div className="pt-2 space-y-2.5">
                  <button
                    id="submit-login-btn"
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
                  >
                    <span>{isLoading ? 'Signing In...' : `Sign In as ${roles.find((r) => r.role === selectedRole)?.label}`}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    id="quick-demo-login-btn"
                    type="button"
                    disabled={isLoading}
                    onClick={handleQuickDemoLogin}
                    className="w-full py-2 px-3 rounded-xl bg-slate-900/90 hover:bg-slate-900 border border-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors"
                  >
                    One-Click Quick Login ({roles.find((r) => r.role === selectedRole)?.label})
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* Reset Password View (under password field flow) */
            <div className="space-y-4">
              <div className="flex items-center space-x-2 pb-3 border-b border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    setIsResetMode(false);
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                  title="Back to login"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h2 className="text-sm font-bold text-white">Reset Account Password</h2>
                  <p className="text-[11px] text-slate-400">Available for Students, Faculty & Hostel Wardens</p>
                </div>
              </div>

              <form onSubmit={handleResetPasswordSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Email Address or Roll Number
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="reset-identifier-input"
                      type="text"
                      value={resetIdentifier}
                      onChange={(e) => setResetIdentifier(e.target.value)}
                      required
                      placeholder="e.g. student@campus.edu or CS21B045"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="reset-new-password-input"
                      type="password"
                      value={resetNewPassword}
                      onChange={(e) => setResetNewPassword(e.target.value)}
                      placeholder="Leave blank for default (pass123) or enter new password"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                  <button
                    id="submit-reset-password-btn"
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>{isLoading ? 'Updating Password...' : 'Confirm Password Reset'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsResetMode(false);
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className="w-full py-2 text-center text-xs text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    Cancel and return to login
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Minimal Footer */}
        <div className="mt-5 text-center space-y-1.5">
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-[11px] text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Persistent Database Active</span>
          </div>
          <p className="text-center text-[11px] text-slate-500">
            Authorized campus personnel only • Access logs are recorded
          </p>
        </div>
      </div>
    </div>
  );
};
