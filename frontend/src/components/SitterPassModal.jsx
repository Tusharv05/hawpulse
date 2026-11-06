import React, { useState, useEffect } from 'react';
import { diaryApi, getStoredActivePet } from '../services/api';

export default function SitterPassModal({ isOpen, onClose }) {
  const [copied, setCopied] = useState(false);
  const [passUrl, setPassUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const activePet = getStoredActivePet();

  useEffect(() => {
    async function fetchShareToken() {
      if (!isOpen) return;
      const pet = getStoredActivePet();
      if (pet?.id) {
        setIsLoading(true);
        try {
          const res = await diaryApi.getShareToken(pet.id);
          if (res?.share_token) {
            setPassUrl(`${window.location.origin}/shared/${res.share_token}`);
          } else {
            setPassUrl(`${window.location.origin}/shared/pass-${pet.id.slice(0, 8)}`);
          }
        } catch (err) {
          setPassUrl(`${window.location.origin}/shared/pass-${pet.id.slice(0, 8)}`);
        } finally {
          setIsLoading(false);
        }
      }
    }
    fetchShareToken();
  }, [isOpen]);

  if (!isOpen) return null;

  const petName = activePet?.name || 'Your Pet';

  const handleCopy = () => {
    if (!passUrl) return;
    navigator.clipboard.writeText(passUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-surface-container-lowest rounded-3xl border border-outline-variant/40 shadow-2xl overflow-hidden my-auto flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-outline-variant/30 flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center p-1 shadow-xs border border-outline-variant/30 shrink-0">
              <img
                src="/logo.png"
                alt="HawPulse"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <span className="font-headline-sm text-base font-bold text-on-surface">{petName}'s Guest Care Pass</span>
              <span className="text-[11px] text-outline block -mt-0.5">Zero-account pass for sitters &amp; walkers</span>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full text-outline hover:text-on-surface flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 flex flex-col gap-6">
          <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
            Send this link to anyone watching {petName}. They get one-tap buttons to check off meals, log walks, and view emergency details without downloading an app or creating an account.
          </p>

          {/* Shareable Link Box */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-on-surface">Shareable Sitter Pass Link</label>
            <div className="flex items-center gap-2 p-2 bg-surface-container-low rounded-xl border border-outline-variant/40">
              <input
                type="text"
                readOnly
                value={passUrl || 'Generating pass link...'}
                className="flex-1 bg-transparent text-xs font-mono text-on-surface px-2 outline-none"
              />
              <button
                type="button"
                onClick={handleCopy}
                disabled={!passUrl}
                className="px-4 py-2 rounded-lg bg-primary-container text-on-surface font-bold text-xs hover:bg-primary-fixed-dim transition-colors cursor-pointer shrink-0 disabled:opacity-50"
              >
                {copied ? "Copied! ✓" : "Copy Link"}
              </button>
            </div>
          </div>

          {/* Quick Care Snapshot */}
          <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-3">
            <span className="text-xs font-bold text-outline uppercase tracking-wider">What the sitter sees</span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-white border border-outline-variant/20">
                <span className="font-bold text-on-surface block">🥣 Feeding</span>
                <span className="text-on-surface-variant text-[11px]">Daily routine meals &amp; portion guidance</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-outline-variant/20">
                <span className="font-bold text-on-surface block">🦮 Walking</span>
                <span className="text-on-surface-variant text-[11px]">Scheduled walks &amp; outdoor potty breaks</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-outline-variant/20">
                <span className="font-bold text-on-surface block">💊 Medication</span>
                <span className="text-on-surface-variant text-[11px]">Active prescriptions &amp; time reminders</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-outline-variant/20">
                <span className="font-bold text-on-surface block">🚨 Emergency Help</span>
                <span className="text-on-surface-variant text-[11px]">One-tap 24/7 hotline &amp; vet contacts</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full h-11 rounded-full bg-primary-container text-on-surface font-bold text-xs sm:text-sm hover:bg-primary-fixed-dim transition-colors shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
