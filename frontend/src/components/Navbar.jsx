import React, { useState, useEffect } from 'react';
import { getAuthToken, getStoredUser, clearSession } from '../services/api';
import vectorMaleProfile from '../assets/vectormaleprofilepic.png';
import vectorFemaleProfile from '../assets/vectorfemaleprofilepic.png';

export default function Navbar({ activeTab, setActiveTab, onOpenAuth, onOpenOnboarding, onOpenSitterPass }) {
  const [token, setToken] = useState(getAuthToken());
  const [userProfile, setUserProfile] = useState(getStoredUser());

  useEffect(() => {
    setToken(getAuthToken());
    setUserProfile(getStoredUser());
  }, [activeTab]);

  useEffect(() => {
    const syncProfile = () => {
      setToken(getAuthToken());
      setUserProfile(getStoredUser());
    };
    window.addEventListener('pawcircle_profile_updated', syncProfile);
    window.addEventListener('storage', syncProfile);
    return () => {
      window.removeEventListener('pawcircle_profile_updated', syncProfile);
      window.removeEventListener('storage', syncProfile);
    };
  }, []);

  const resolveUserAvatar = () => {
    const customAvatar = userProfile?.avatar_url || localStorage.getItem('pawcircle_parent_avatar');
    if (customAvatar && typeof customAvatar === 'string' && customAvatar.trim() !== '') {
      if (customAvatar.startsWith('/uploads/')) {
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
        const host = apiBase.replace(/\/api\/v1\/?$/, '');
        return `${host}${customAvatar}`;
      }
      return customAvatar;
    }
    const gender = userProfile?.gender || localStorage.getItem('pawcircle_parent_gender') || 'female';
    return gender === 'male' ? vectorMaleProfile : vectorFemaleProfile;
  };

  const isLoggedIn = Boolean(token);

  const handleLogout = () => {
    clearSession();
    setToken('');
    setUserProfile(null);
    setActiveTab('landing');
  };
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface-container-lowest/95 backdrop-blur-md border-b border-outline-variant/40 shadow-xs transition-all">
      <div className="h-[72px] max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <button 
          onClick={() => setActiveTab('landing')}
          className="flex items-center gap-2.5 shrink-0 group text-left cursor-pointer focus:outline-none"
        >
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center p-1 shadow-xs border border-outline-variant/30 group-hover:scale-105 transition-transform shrink-0">
            <img
              src="/logo.png"
              alt="HawPulse Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <span className="font-brand text-2xl tracking-tight text-on-surface lowercase leading-none">hawpulse</span>
        </button>

        {/* Navigation Tabs */}
        {activeTab === 'landing' ? (
          <nav className="hidden md:flex items-center gap-7 text-[15px] font-medium font-sans">
            <a 
              href="#board" 
              className="text-on-surface/80 hover:text-on-surface hover:underline decoration-primary-container decoration-[3px] underline-offset-8 transition-all"
            >
              What we do
            </a>
            <a 
              href="#how" 
              className="text-on-surface/80 hover:text-on-surface hover:underline decoration-primary-container decoration-[3px] underline-offset-8 transition-all"
            >
              How it works
            </a>
            <button 
              type="button"
              onClick={() => setActiveTab('community')}
              className="text-on-surface/80 hover:text-on-surface hover:underline decoration-primary-container decoration-[3px] underline-offset-8 transition-all cursor-pointer font-medium text-[15px]"
            >
              Community
            </button>
          </nav>
        ) : (
          <nav className="hidden lg:flex items-center gap-1.5 p-1 bg-surface-container/60 rounded-full border border-outline-variant/30 text-label-md">
            <button
              onClick={() => setActiveTab('daily-care')}
              className={`transition-all rounded-full px-3.5 py-1.5 font-medium flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'daily-care'
                  ? 'bg-primary-container text-on-surface font-semibold shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">calendar_today</span>
              Daily Care
            </button>
            <button
              onClick={() => setActiveTab('diet-lab')}
              className={`transition-all rounded-full px-3.5 py-1.5 font-medium flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'diet-lab'
                  ? 'bg-primary-container text-on-surface font-semibold shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">restaurant</span>
              Diet Lab
            </button>
            <button
              onClick={() => setActiveTab('medical-vault')}
              className={`transition-all rounded-full px-3.5 py-1.5 font-medium flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'medical-vault'
                  ? 'bg-primary-container text-on-surface font-semibold shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">medical_services</span>
              Medical Vault
            </button>
            <button
              onClick={() => setActiveTab('community')}
              className={`transition-all rounded-full px-3.5 py-1.5 font-medium flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'community'
                  ? 'bg-primary-container text-on-surface font-semibold shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">diversity_1</span>
              Community
            </button>
            {/* SOS Help button (hidden for now) */}
            {/* 
            <button
              onClick={() => setActiveTab('emergency')}
              className={`transition-all rounded-full px-3 py-1.5 font-medium flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'emergency'
                  ? 'bg-secondary text-on-secondary font-semibold shadow-xs'
                  : 'text-secondary hover:bg-secondary-fixed/50 font-semibold'
              }`}
            >
              <span className="material-symbols-outlined text-[17px] animate-pulse">emergency</span>
              SOS Help
            </button>
            */}
            <button
              onClick={() => setActiveTab('profile')}
              className={`transition-all rounded-full px-3.5 py-1.5 font-medium flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-primary-container text-on-surface font-semibold shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">person</span>
              Profile
            </button>
          </nav>
        )}

        {/* Right CTA Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          {activeTab !== 'landing' && (
            <button
              onClick={onOpenSitterPass}
              className="hidden xl:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-outline-variant text-on-surface text-label-sm font-medium hover:bg-surface-container transition-colors cursor-pointer"
              title="Generate a temporary care pass for pet sitters"
            >
              <span className="material-symbols-outlined text-[16px] text-primary">badge</span>
              Sitter Pass
            </button>
          )}

          {isLoggedIn ? (
            <div className="flex items-center gap-2">
              {/* User Profile Avatar Pill */}
              <button 
                onClick={() => {
                  if (activeTab === 'landing') {
                    setActiveTab('daily-care');
                  } else {
                    setActiveTab('profile');
                  }
                }}
                className={`flex items-center gap-2 px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                  activeTab === 'profile'
                    ? 'border-primary bg-primary-container/40'
                    : 'border-outline-variant/60 hover:bg-surface-container'
                }`}
                title={activeTab === 'landing' ? "Go to Daily Care" : "View Profile & Settings"}
              >
                <div className="w-7 h-7 rounded-full overflow-hidden bg-white border border-primary-container shadow-2xs flex items-center justify-center shrink-0">
                  <img
                    alt={userProfile?.full_name || 'Parent'}
                    className={`w-full h-full ${
                      (userProfile?.avatar_url || localStorage.getItem('pawcircle_parent_avatar'))
                        ? 'object-cover'
                        : 'object-contain p-0.5 bg-white'
                    }`}
                    src={resolveUserAvatar()}
                  />
                </div>
                <span className="hidden sm:inline text-xs font-bold text-on-surface">
                  {userProfile?.full_name || (userProfile?.email ? userProfile.email.split('@')[0] : 'Parent')}
                </span>
              </button>

              {/* Sign Out Button */}
              <button
                onClick={handleLogout}
                className="w-8 h-8 rounded-full text-outline hover:text-on-surface hover:bg-surface-container flex items-center justify-center transition-colors cursor-pointer"
                title="Sign Out"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenAuth}
                className="hidden sm:inline-flex items-center justify-center font-label-md text-label-md text-on-surface hover:text-primary px-3 py-2 transition-colors cursor-pointer"
              >
                Sign in
              </button>

              <button
                onClick={onOpenOnboarding}
                className="inline-flex items-center justify-center bg-primary-container text-on-surface font-label-md text-label-md font-semibold px-5 py-2.5 rounded-full hover:bg-primary-fixed-dim hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xs cursor-pointer"
              >
                Get started
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Sub-Navigation Bar (Only shown inside app tabs) */}
      {activeTab !== 'landing' && (
        <div className="lg:hidden flex items-center overflow-x-auto gap-2 px-4 py-2 border-t border-outline-variant/20 bg-surface-container-low scrollbar-none text-label-sm">
          <button
            onClick={() => setActiveTab('daily-care')}
            className={`px-3 py-1 rounded-full whitespace-nowrap cursor-pointer ${activeTab === 'daily-care' ? 'bg-primary-container font-semibold' : 'text-on-surface-variant'}`}
          >
            Daily Care
          </button>
          <button
            onClick={() => setActiveTab('diet-lab')}
            className={`px-3 py-1 rounded-full whitespace-nowrap cursor-pointer ${activeTab === 'diet-lab' ? 'bg-primary-container font-semibold' : 'text-on-surface-variant'}`}
          >
            Diet Lab
          </button>
          <button
            onClick={() => setActiveTab('medical-vault')}
            className={`px-3 py-1 rounded-full whitespace-nowrap cursor-pointer ${activeTab === 'medical-vault' ? 'bg-primary-container font-semibold' : 'text-on-surface-variant'}`}
          >
            Medical Vault
          </button>
          <button
            onClick={() => setActiveTab('community')}
            className={`px-3 py-1 rounded-full whitespace-nowrap cursor-pointer ${activeTab === 'community' ? 'bg-primary-container font-semibold' : 'text-on-surface-variant'}`}
          >
            Community
          </button>
          {/* 
          <button
            onClick={() => setActiveTab('emergency')}
            className={`px-3 py-1 rounded-full whitespace-nowrap font-semibold cursor-pointer ${activeTab === 'emergency' ? 'bg-secondary text-white' : 'text-secondary'}`}
          >
            SOS Help
          </button>
          */}
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-3 py-1 rounded-full whitespace-nowrap cursor-pointer ${activeTab === 'profile' ? 'bg-primary-container font-semibold' : 'text-on-surface-variant'}`}
          >
            Profile
          </button>
        </div>
      )}
    </header>
  );
}
