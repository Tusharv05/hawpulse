import React, { useState, useEffect, useCallback } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import Navbar from './components/Navbar';
import LandingPage from './components/LandingPage';
import DailyCare from './components/DailyCare';
import DietLab from './components/DietLab';
import MedicalVault from './components/MedicalVault';
import CommunityHub from './components/CommunityHub';
import EmergencyHelp from './components/EmergencyHelp';
import ProfileSettings from './components/ProfileSettings';
import OnboardingModal from './components/OnboardingModal';
import SignInModal from './components/SignInModal';
import SitterPassModal from './components/SitterPassModal';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfUse from './components/TermsOfUse';
import { setAuthToken, setStoredUser, getStoredUser, clearSession, getAuthToken } from './services/api';

const VALID_TABS = ['landing', 'daily-care', 'diet-lab', 'medical-vault', 'community', 'emergency', 'profile', 'privacy', 'terms'];
const LANDING_SECTIONS = ['board', 'what', 'how', 'proof', 'radar', 'top'];

export default function App() {
  const [activeTab, setActiveTab] = useState('landing');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [onboardingMode, setOnboardingMode] = useState('full');
  const [isSitterPassOpen, setIsSitterPassOpen] = useState(false);

  // Tab navigation with full browser history pushState
  const handleTabChange = useCallback((newTab, pushHistory = true) => {
    setActiveTab(prevTab => {
      const isPathMatch = (newTab === 'privacy' && window.location.pathname === '/privacy') ||
                          (newTab === 'terms' && window.location.pathname === '/terms') ||
                          (!['privacy', 'terms'].includes(newTab) && window.location.pathname === '/');
      if (prevTab === newTab && !window.location.hash && isPathMatch) return prevTab;

      if (pushHistory) {
        if (newTab === 'privacy') {
          window.history.pushState({ tab: 'privacy', modal: null }, '', '/privacy');
        } else if (newTab === 'terms') {
          window.history.pushState({ tab: 'terms', modal: null }, '', '/terms');
        } else {
          const targetHash = newTab === 'landing' ? '' : `#${newTab}`;
          const currentPath = ['/privacy', '/terms'].includes(window.location.pathname) ? '/' : window.location.pathname;
          window.history.pushState(
            { tab: newTab, modal: null },
            '',
            targetHash ? `${currentPath}${targetHash}` : currentPath
          );
        }
      }
      return newTab;
    });
  }, []);

  // Modal open helpers with history tracking
  const handleOpenAuth = () => {
    window.history.pushState({ tab: activeTab, modal: 'auth' }, '', '#auth');
    setIsAuthOpen(true);
  };

  const handleCloseAuth = () => {
    setIsAuthOpen(false);
    if (window.location.hash === '#auth' || window.location.hash === '#signin') {
      window.history.back();
    }
  };

  const handleOpenOnboarding = (mode = 'full') => {
    const chosenMode = typeof mode === 'string' ? mode : mode?.mode || (getAuthToken() ? 'add-pet' : 'full');
    setOnboardingMode(chosenMode);
    window.history.pushState({ tab: activeTab, modal: 'onboarding', mode: chosenMode }, '', '#onboarding');
    setIsOnboardingOpen(true);
  };

  const handleCloseOnboarding = () => {
    setIsOnboardingOpen(false);
    if (window.location.hash === '#onboarding') {
      window.history.back();
    }
  };

  const handleOpenSitterPass = () => {
    window.history.pushState({ tab: activeTab, modal: 'sitter-pass' }, '', '#sitter-pass');
    setIsSitterPassOpen(true);
  };

  const handleCloseSitterPass = () => {
    setIsSitterPassOpen(false);
    if (window.location.hash === '#sitter-pass') {
      window.history.back();
    }
  };

  // Sync state with browser location (Back / Forward buttons & direct links)
  useEffect(() => {
    const syncFromLocation = () => {
      const rawHash = window.location.hash.replace(/^#/, '');

      // 1. Modals
      if (rawHash === 'auth' || rawHash === 'signin') {
        setIsAuthOpen(true);
        setIsOnboardingOpen(false);
        setIsSitterPassOpen(false);
        return;
      }
      if (rawHash === 'onboarding') {
        setIsOnboardingOpen(true);
        setIsAuthOpen(false);
        setIsSitterPassOpen(false);
        return;
      }
      if (rawHash === 'sitter-pass') {
        setIsSitterPassOpen(true);
        setIsAuthOpen(false);
        setIsOnboardingOpen(false);
        return;
      }

      // If hash is not a modal, ensure modals close
      setIsAuthOpen(false);
      setIsOnboardingOpen(false);
      setIsSitterPassOpen(false);

      // 2. Tabs
      const pathname = window.location.pathname.replace(/^\/|\/$/g, '');
      if (pathname === 'privacy' || rawHash === 'privacy') {
        setActiveTab('privacy');
        return;
      }
      if (pathname === 'terms' || rawHash === 'terms') {
        setActiveTab('terms');
        return;
      }

      if (VALID_TABS.includes(rawHash)) {
        setActiveTab(rawHash);
      } else if (LANDING_SECTIONS.includes(rawHash) || rawHash === '') {
        setActiveTab('landing');
        if (rawHash && rawHash !== 'top') {
          setTimeout(() => {
            const targetId = rawHash === 'board' ? 'what' : rawHash;
            const el = document.getElementById(targetId) || document.getElementById(rawHash);
            el?.scrollIntoView({ behavior: 'smooth' });
          }, 80);
        }
      }
    };

    // Initial mount sync
    syncFromLocation();

    // Browser navigation listener
    window.addEventListener('popstate', syncFromLocation);
    window.addEventListener('hashchange', syncFromLocation);

    return () => {
      window.removeEventListener('popstate', syncFromLocation);
      window.removeEventListener('hashchange', syncFromLocation);
    };
  }, []);

  // Clear dummy dev session if previously logged into parent@pawcircle.dev
  useEffect(() => {
    const user = getStoredUser();
    if (user?.email === 'parent@pawcircle.dev') {
      clearSession();
    }
  }, []);

  // Catch Google OAuth redirect return from accounts.google.com
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_auth') === 'success') {
      const token = params.get('token');
      const email = params.get('email');
      const name = params.get('name');

      if (token) {
        setAuthToken(token);
        const userObj = {
          email: decodeURIComponent(email || ''),
          full_name: decodeURIComponent(name || '')
        };
        setStoredUser(userObj);

        // Clean query params from address bar
        window.history.replaceState({}, document.title, window.location.pathname);

        const resumeStep = localStorage.getItem('pawcircle_resume_onboarding');
        if (resumeStep) {
          handleOpenOnboarding('full');
        } else {
          handleTabChange('daily-care');
        }
      }
    } else if (params.get('google_auth_error')) {
      alert("Google sign-in error: " + decodeURIComponent(params.get('google_auth_error')));
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [handleTabChange]);

  return (
    <ErrorBoundary>
      <div className="min-h-screen w-full bg-surface text-on-surface flex flex-col font-sans">
        {/* Global Responsive Navigation Bar */}
        {!['privacy', 'terms'].includes(activeTab) && (
          <Navbar
            activeTab={activeTab}
            setActiveTab={handleTabChange}
            onOpenAuth={handleOpenAuth}
            onOpenOnboarding={() => handleOpenOnboarding('full')}
            onOpenSitterPass={handleOpenSitterPass}
          />
        )}

        {/* Main Screen Content View */}
        <main className={`w-full ${['privacy', 'terms'].includes(activeTab) ? '' : 'pt-[72px] lg:pt-[72px]'} flex-1 flex flex-col`}>
          {activeTab === 'privacy' && (
            <PrivacyPolicy
              onBackToHome={() => handleTabChange('landing')}
              onOpenTerms={() => handleTabChange('terms')}
            />
          )}

          {activeTab === 'terms' && (
            <TermsOfUse
              onBackToHome={() => handleTabChange('landing')}
              onOpenPrivacy={() => handleTabChange('privacy')}
            />
          )}

          {activeTab === 'landing' && (
            <LandingPage
              setActiveTab={handleTabChange}
              onOpenOnboarding={() => handleOpenOnboarding('full')}
              onOpenAuth={handleOpenAuth}
            />
          )}

          {activeTab === 'daily-care' && (
            <DailyCare
              setActiveTab={handleTabChange}
              onOpenSitterPass={handleOpenSitterPass}
            />
          )}

          {activeTab === 'diet-lab' && (
            <DietLab setActiveTab={handleTabChange} />
          )}

          {activeTab === 'medical-vault' && (
            <MedicalVault setActiveTab={handleTabChange} />
          )}

          {activeTab === 'community' && (
            <CommunityHub />
          )}

          {activeTab === 'emergency' && (
            <EmergencyHelp setActiveTab={handleTabChange} />
          )}

          {activeTab === 'profile' && (
            <ProfileSettings 
              setActiveTab={handleTabChange}
              onOpenOnboarding={(mode) => handleOpenOnboarding(mode || 'add-pet')}
            />
          )}
        </main>

        {/* Onboarding & Add-Pet Modal */}
        <OnboardingModal
          isOpen={isOnboardingOpen}
          onClose={handleCloseOnboarding}
          onFinish={() => {
            if (onboardingMode === 'add-pet') {
              handleTabChange('profile');
            } else {
              handleTabChange('daily-care');
            }
          }}
          mode={onboardingMode}
        />

        {/* Passwordless Sign-In & OTP Verify Modal */}
        <SignInModal
          isOpen={isAuthOpen}
          onClose={handleCloseAuth}
          onAuthenticated={() => handleTabChange('daily-care')}
        />

        {/* Sitter Care Pass Modal */}
        <SitterPassModal
          isOpen={isSitterPassOpen}
          onClose={handleCloseSitterPass}
        />
      </div>
    </ErrorBoundary>
  );
}
