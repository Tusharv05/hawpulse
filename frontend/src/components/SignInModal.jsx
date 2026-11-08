import React, { useState, useEffect, useRef } from 'react';
import { authApi, petsApi } from '../services/api';

export default function SignInModal({ isOpen, onClose, onAuthenticated, onSwitchToOnboarding }) {
  const [authStep, setAuthStep] = useState('signin'); // 'signin' | 'verify' | 'magic'
  const [email, setEmail] = useState('');
  const [codeDigits, setCodeDigits] = useState(['', '', '', '', '', '']);
  const [timerSeconds, setTimerSeconds] = useState(120);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [authSuccessData, setAuthSuccessData] = useState(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const inputRefs = useRef([]);

  // Reset state when opening modal
  useEffect(() => {
    if (isOpen) {
      setAuthStep('signin');
      setCodeDigits(['', '', '', '', '', '']);
      setErrorMessage('');
      setIsLoading(false);
      setIsNewUser(false);
    }
  }, [isOpen]);

  // Countdown timer for OTP
  useEffect(() => {
    let interval = null;
    if (authStep === 'verify' && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [authStep, timerSeconds]);

  if (!isOpen) return null;

  const formatTimer = () => {
    const mins = Math.floor(timerSeconds / 60);
    const secs = timerSeconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Step 1: Submit email to request OTP
  const handleRequestOtp = async (e) => {
    if (e) e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setErrorMessage('');
    setIsLoading(true);
    try {
      await authApi.requestOtp(cleanEmail);
      setTimerSeconds(120);
      setCodeDigits(['', '', '', '', '', '']);
      // Automatically advance to Step 2
      setAuthStep('verify');
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 150);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to send OTP. Please check backend connection.');
    } finally {
      setIsLoading(false);
    }
  };

  // 1-Click Google Sign In
  const handleGoogleSignIn = () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
      window.location.href = `${apiBase}/auth/google/login?frontend_origin=${encodeURIComponent(window.location.origin)}`;
    } catch (err) {
      setErrorMessage(err.message || 'Google sign-in initiation failed');
      setIsLoading(false);
    }
  };

  // Step 2: Verify code
  const verifyCode = async (digitsToVerify) => {
    const enteredOtp = digitsToVerify.join('').trim();
    if (enteredOtp.length < 6) {
      setErrorMessage('Please enter the full 6-digit verification code.');
      return;
    }

    setErrorMessage('');
    setIsLoading(true);
    try {
      const res = await authApi.verifyOtp(email.trim(), enteredOtp);
      setAuthSuccessData(res);

      // Check whether user already has pets or is brand new
      let userIsNew = true;
      try {
        const pets = await petsApi.getPets();
        userIsNew = !pets || pets.length === 0;
      } catch {
        userIsNew = true;
      }
      setIsNewUser(userIsNew);

      // Automatically advance to Step 3 (Success)
      setAuthStep('magic');

      // Auto-complete and redirect after 1.3 seconds
      setTimeout(() => {
        if (onAuthenticated) onAuthenticated(userIsNew);
        onClose();
      }, 1400);
    } catch (err) {
      setErrorMessage(err.message || 'Invalid or expired OTP code. Please check your inbox.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDigitChange = (index, value) => {
    const cleanVal = value.replace(/\D/g, '');
    const char = cleanVal.slice(-1);
    const newDigits = [...codeDigits];
    newDigits[index] = char;
    setCodeDigits(newDigits);

    // Auto-advance cursor to next input box
    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when the 6th digit is filled
    if (char && index === 5) {
      const allFilled = newDigits.every(d => d.length === 1);
      if (allFilled) {
        verifyCode(newDigits);
      }
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!codeDigits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const newDigits = pasted.split('');
    while (newDigits.length < 6) newDigits.push('');
    setCodeDigits(newDigits);

    if (pasted.length === 6) {
      verifyCode(newDigits);
    } else {
      inputRefs.current[pasted.length]?.focus();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-[480px] bg-surface-container-lowest rounded-3xl border border-outline-variant/40 shadow-2xl overflow-hidden my-auto flex flex-col">
        {/* Clean Modal Header - No manual step buttons */}
        <div className="px-5 py-4 border-b border-outline-variant/30 flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center p-1 shadow-xs border border-outline-variant/30 shrink-0">
              <img
                src="/logo.png"
                alt="HawPulse"
                className="w-full h-full object-contain"
              />
            </div>
            <span className="font-brand text-base font-bold text-on-surface lowercase tracking-tight">hawpulse auth</span>
          </div>

          <div className="flex items-center gap-2">
            {authStep === 'verify' && (
              <button
                type="button"
                onClick={() => {
                  setAuthStep('signin');
                  setErrorMessage('');
                }}
                className="px-2.5 py-1 rounded-full text-xs font-semibold text-outline hover:text-on-surface hover:bg-surface-container flex items-center gap-1 transition-colors cursor-pointer"
                title="Change email"
              >
                <span className="material-symbols-outlined text-[15px]">arrow_back</span>
                <span>Change email</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full text-outline hover:text-on-surface hover:bg-surface-container flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Close"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 flex flex-col items-center text-center">
          {/* ================= STEP 1: EMAIL (Appears first) ================= */}
          {authStep === 'signin' && (
            <div className="w-full flex flex-col items-center gap-4">
              {/* Cute Cat & Dog with Wax Seal Envelope SVG */}
              <div className="w-32 h-32 relative flex items-center justify-center">
                <svg className="w-full h-full" fill="none" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">
                  <ellipse cx="80" cy="85" fill="#FDF8F6" rx="64" ry="54"></ellipse>
                  {/* Cat */}
                  <path d="M38 126C38 100 48 88 64 88C72 88 78 94 80 102C68 102 54 112 52 126H38Z" fill="#F2EDEB" stroke="#1C1B1A" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                  <path d="M42 66L35 44L53 52C58 50 64 50 69 52L87 44L80 66C82 72 82 78 80 84C72 90 50 90 42 84C39 78 39 72 42 66Z" fill="#FFFFFF" stroke="#1C1B1A" strokeLinejoin="round" strokeWidth="2"></path>
                  <polygon fill="#FFDAD4" points="42,50 46,62 38,58"></polygon>
                  <polygon fill="#FFDAD4" points="80,50 84,58 76,62"></polygon>
                  <ellipse cx="52" cy="67" fill="#1C1B1A" rx="3" ry="3.5"></ellipse>
                  <ellipse cx="70" cy="67" fill="#1C1B1A" rx="3" ry="3.5"></ellipse>
                  <path d="M60 72L58 74H64L62 72" fill="#AE3123"></path>
                  {/* Dog */}
                  <path d="M122 126C122 100 110 84 94 84C86 84 81 90 79 98C90 98 106 108 108 126H122Z" fill="#FFDF9A" stroke="#1C1B1A" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                  <ellipse cx="106" cy="70" fill="#FFDF9A" rx="22" ry="20" stroke="#1C1B1A" strokeWidth="2"></ellipse>
                  <path d="M122 64C128 72 134 90 124 96C117 100 115 90 116 82" fill="#715500" stroke="#1C1B1A" strokeLinecap="round" strokeWidth="2"></path>
                  <ellipse cx="100" cy="68" fill="#1C1B1A" rx="3" ry="3.5"></ellipse>
                  <ellipse cx="116" cy="68" fill="#1C1B1A" rx="3" ry="3.5"></ellipse>
                  <ellipse cx="108" cy="75" fill="#1C1B1A" rx="5" ry="3.5"></ellipse>
                  {/* Envelope */}
                  <g transform="translate(48, 88)">
                    <rect fill="#FDF8F6" height="42" rx="6" stroke="#1C1B1A" strokeWidth="2" width="64" x="0" y="0"></rect>
                    <path d="M2 3L32 24L62 3" stroke="#1C1B1A" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                    <circle cx="32" cy="24" fill="#FFC93C" r="8" stroke="#1C1B1A" strokeWidth="1.5"></circle>
                    <ellipse cx="32" cy="25" fill="#1C1B1A" rx="3" ry="2.4"></ellipse>
                  </g>
                </svg>
              </div>

              <div>
                <h3 className="font-headline-lg text-2xl font-bold text-on-surface">Sign in to HawPulse</h3>
                <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
                  Enter your email. We'll send a 6-digit passwordless code.
                </p>
              </div>

              {errorMessage && (
                <div className="w-full p-3 rounded-xl bg-error-container text-on-error-container text-xs font-medium text-left">
                  {errorMessage}
                </div>
              )}

              {/* 1-Click Google Sign In */}
              <button
                type="button"
                disabled={isLoading}
                onClick={handleGoogleSignIn}
                className="w-full h-12 rounded-2xl bg-surface-container-lowest border border-outline-variant/50 hover:bg-surface-container transition-all flex items-center justify-center gap-3 font-semibold text-xs sm:text-sm text-on-surface shadow-xs cursor-pointer disabled:opacity-60"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="relative flex items-center justify-center my-1 w-full">
                <div className="border-t border-outline-variant/30 w-full"></div>
                <span className="bg-surface-container-lowest px-3 text-[10px] font-bold text-outline uppercase tracking-wider absolute">
                  or email code
                </span>
              </div>

              <form
                onSubmit={handleRequestOtp}
                className="w-full flex flex-col gap-3 mt-1"
              >
                <div className="flex flex-col text-left gap-1">
                  <label className="text-xs font-bold text-on-surface">Email address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="h-12 px-4 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs sm:text-sm focus:outline-none focus:border-on-surface"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 rounded-full bg-primary-container text-on-surface font-bold text-xs sm:text-sm hover:bg-primary-fixed-dim transition-colors shadow-xs mt-1 cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isLoading && <span className="animate-spin material-symbols-outlined text-[18px]">progress_activity</span>}
                  {isLoading ? 'Sending Code to Your Email...' : 'Send 6-Digit Code'}
                </button>

                {/* Switch to Getting Started / Onboarding */}
                <div className="pt-3 border-t border-outline-variant/30 w-full mt-2 text-center">
                  <p className="text-xs text-on-surface-variant">
                    Don't have an account yet?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        if (onSwitchToOnboarding) onSwitchToOnboarding();
                      }}
                      className="font-bold text-primary hover:underline cursor-pointer"
                    >
                      Get started &rarr;
                    </button>
                  </p>
                </div>
              </form>
            </div>
          )}

          {/* ================= STEP 2: VERIFY OTP (Appears automatically after Step 1) ================= */}
          {authStep === 'verify' && (
            <div className="w-full flex flex-col items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary-container flex items-center justify-center text-on-surface text-2xl mb-1 shadow-xs">
                📬
              </div>

              <div>
                <h3 className="font-headline-lg text-2xl font-bold text-on-surface">Check your inbox</h3>
                <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed">
                  We sent a 6-digit verification code to<br />
                  <strong className="text-on-surface font-bold">{email}</strong>
                </p>
                <p className="text-[11px] text-outline font-medium mt-0.5">
                  Code is valid for 10 minutes.
                </p>
              </div>

              {errorMessage && (
                <div className="w-full p-3 rounded-xl bg-error-container text-on-error-container text-xs font-medium text-left">
                  {errorMessage}
                </div>
              )}

              {/* 6 Digit Input Boxes with Auto-Advance, Backspace & Paste */}
              <form onSubmit={(e) => { e.preventDefault(); verifyCode(codeDigits); }} className="w-full flex flex-col items-center gap-4 mt-2">
                <div className="flex gap-2 sm:gap-2.5">
                  {codeDigits.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => (inputRefs.current[i] = el)}
                      id={`otp-input-${i}`}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      placeholder="•"
                      onChange={(e) => handleDigitChange(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(i, e.target)}
                      onPaste={handlePaste}
                      className="w-11 h-14 rounded-xl bg-surface-container-low border border-outline-variant/40 text-center font-headline-sm text-lg font-bold text-on-surface focus:outline-none focus:border-on-surface focus:bg-white transition-all shadow-2xs"
                    />
                  ))}
                </div>

                <div className="flex items-center justify-end w-full text-xs text-on-surface-variant px-1">
                  <button
                    type="button"
                    disabled={isLoading || timerSeconds > 0}
                    onClick={async () => {
                      setIsLoading(true);
                      try {
                        await authApi.requestOtp(email.trim());
                        setTimerSeconds(120);
                        setCodeDigits(['', '', '', '', '', '']);
                        setErrorMessage('');
                      } catch (err) {
                        setErrorMessage(err.message);
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    className={`font-bold transition-colors ${timerSeconds > 0 ? 'text-outline cursor-not-allowed' : 'text-primary hover:underline cursor-pointer'}`}
                  >
                    {timerSeconds > 0 ? `Resend code (${formatTimer()})` : 'Resend code'}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 rounded-full bg-primary-container text-on-surface font-bold text-xs sm:text-sm hover:bg-primary-fixed-dim transition-colors shadow-xs mt-2 cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isLoading && <span className="animate-spin material-symbols-outlined text-[18px]">progress_activity</span>}
                  {isLoading ? 'Verifying Code...' : 'Verify & Continue'}
                </button>
              </form>
            </div>
          )}

          {/* ================= STEP 3: MAGIC AUTH SUCCESS (Appears automatically after Step 2) ================= */}
          {authStep === 'magic' && (
            <div className="w-full flex flex-col items-center gap-4 py-2">
              <div className="w-16 h-16 rounded-full bg-tertiary-container text-on-tertiary-container flex items-center justify-center text-3xl shadow-xs animate-bounce">
                ✓
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-tertiary">
                  {isNewUser ? 'Welcome!' : 'Authenticated'}
                </span>
                <h3 className="font-headline-lg text-2xl font-bold text-on-surface mt-1">
                  {isNewUser
                    ? 'Welcome to HawPulse!'
                    : `Welcome back${authSuccessData?.full_name ? `, ${authSuccessData.full_name}` : ''}!`}
                </h3>
                <p className="text-xs text-on-surface-variant mt-1">
                  {isNewUser
                    ? 'Heading to pet setup...'
                    : `Signed in as ${email}. Entering dashboard...`}
                </p>
              </div>

              <div className="w-full p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 text-xs text-on-surface flex items-center gap-3 text-left">
                <span className="material-symbols-outlined text-primary text-[24px]">verified_user</span>
                <div>
                  <span className="font-bold block">Session Active</span>
                  <span className="text-outline">
                    {isNewUser ? 'Ready to create your pet’s profile.' : 'Session synchronized. Valid for 30 days.'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (onAuthenticated) onAuthenticated(isNewUser);
                  onClose();
                }}
                className="w-full h-12 rounded-full bg-primary-container text-on-surface font-bold text-xs sm:text-sm hover:bg-primary-fixed-dim transition-colors shadow-xs mt-2 cursor-pointer"
              >
                {isNewUser ? 'Create Pet Profile' : 'Go to Dashboard'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
