import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { petsApi, authApi, getAuthToken, setStoredActivePet, getStoredUser } from '../services/api';
import { calculateBirthDateFromAge } from '../utils/petAge';
import EarthPawLocationGraphic from './EarthPawLocationGraphic';

export default function OnboardingModal({ isOpen, onClose, onFinish, onSwitchToSignIn, mode = 'full' }) {
  const isAddPetMode = mode === 'add-pet' || (!!getAuthToken() && mode !== 'force-full');

  // Dynamic step configuration: Add-Pet mode starts directly from Pet Dialog without parents things
  const STEPS = isAddPetMode
    ? [
        { id: 'pet-info', num: 1, label: 'Pet Details' },
        { id: 'personality', num: 2, label: 'Personality' },
        { id: 'health', num: 3, label: 'Health' },
        { id: 'finish', num: 4, label: 'Finish' },
      ]
    : [
        { id: 'location', num: 1, label: 'Location' },
        { id: 'account', num: 2, label: 'Account' },
        { id: 'pet-info', num: 3, label: 'Pet Details' },
        { id: 'personality', num: 4, label: 'Personality' },
        { id: 'health', num: 5, label: 'Health' },
        { id: 'finish', num: 6, label: 'Finish' },
      ];

  const [currentStep, setCurrentStep] = useState(1);
  const currentStepId = STEPS[currentStep - 1]?.id || (isAddPetMode ? 'pet-info' : 'location');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locationSubstate, setLocationSubstate] = useState('initial');
  const [selectedCity, setSelectedCity] = useState('');
  const [discoveryDistance, setDiscoveryDistance] = useState(() => {
    const saved = localStorage.getItem('pawcircle_discovery_distance');
    return saved ? Number(saved) : 10;
  });
  const [household, setHousehold] = useState('solo');
  const [parentName, setParentName] = useState('');
  const [parentAge, setParentAge] = useState('');
  const [parentGender, setParentGender] = useState('female');
  const [parentHobbies, setParentHobbies] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [partnerAge, setPartnerAge] = useState('');
  const [partnerGender, setPartnerGender] = useState('male');
  const [partnerHobbies, setPartnerHobbies] = useState('');

  // Account & Auth state
  const storedUser = getStoredUser();
  const [authEmail, setAuthEmail] = useState(storedUser?.email || '');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(!!getAuthToken());
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [resendNotice, setResendNotice] = useState('');

  // Pet state
  const [species, setSpecies] = useState('dog');
  const [petGender, setPetGender] = useState('male');
  const [petPhoto, setPetPhoto] = useState(null);
  const [petName, setPetName] = useState('');
  const [breed, setBreed] = useState('');
  const [petAge, setPetAge] = useState('');
  const [petWeight, setPetWeight] = useState('');
  const [neutered, setNeutered] = useState(true);
  const [selectedAllergies, setSelectedAllergies] = useState([]);
  const [energyLevel, setEnergyLevel] = useState('high');
  const [selectedTraits, setSelectedTraits] = useState([]);
  const [vaccines, setVaccines] = useState({ rabies: false, dhpp: true, bordetella: false });
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');

  // Reset and initialize steps when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setCurrentStep(1);

    if (isAddPetMode) {
      // Clear pet fields for a brand new pet addition
      setPetName('');
      setBreed('');
      setPetAge('');
      setPetWeight('');
      setPetPhoto(null);
      setSelectedAllergies([]);
      setSelectedTraits([]);
      setVaccines({ rabies: false, dhpp: true, bordetella: false });
      setSpecies('dog');
      setPetGender('male');
    } else {
      const resumeStep = localStorage.getItem('pawcircle_resume_onboarding');
      if (resumeStep) {
        setCurrentStep(Number(resumeStep) || 2);
        localStorage.removeItem('pawcircle_resume_onboarding');
      }
    }
  }, [isOpen, isAddPetMode]);

  if (!isOpen) return null;

  const handleAutoDetectLocation = () => {
    setIsDetectingLocation(true);
    setLocationError('');

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      setIsDetectingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          // Public reverse geocoding: does NOT auto-login or create unwanted accounts
          const res = await authApi.reverseGeocode(latitude, longitude);
          const detectedName = res.area_neighborhood
            ? `${res.area_neighborhood}, ${res.city}`
            : res.city || 'Detected Location';
          setSelectedCity(detectedName);
          setLocationSubstate('detected');

          // Only update account location if user is already signed in
          if (getAuthToken()) {
            authApi.updateLocation(latitude, longitude).catch(() => {});
          }
        } catch (err) {
          console.warn('Reverse geocode note:', err);
          setSelectedCity('Model Town, Amritsar');
          setLocationSubstate('detected');
        } finally {
          setIsDetectingLocation(false);
        }
      },
      (error) => {
        console.warn('Geolocation permission error:', error);
        setIsDetectingLocation(false);
        setLocationError('Location access was denied or timed out. Please select or search your city manually below.');
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 8 * 1024 * 1024) {
        alert("Please choose an image under 8MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setPetPhoto(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Google 1-Click Sign-In: Redirects to Google Select Account screen
  const handleGoogleSignIn = () => {
    setIsAuthLoading(true);
    setAuthError('');
    try {
      // Save current onboarding draft state so all entered pet details are retained
      const draft = {
        currentStep: 3,
        species,
        petGender,
        petPhoto,
        petName,
        breed,
        petAge,
        petWeight,
        neutered,
        selectedAllergies,
        energyLevel,
        selectedTraits,
        vaccines,
        selectedCity,
        household,
        parentName,
        parentAge,
        parentGender,
        parentHobbies,
        partnerName,
        partnerAge,
        partnerGender,
        partnerHobbies,
        locationSubstate,
        discoveryDistance
      };
      localStorage.setItem('pawcircle_onboarding_draft', JSON.stringify(draft));
      localStorage.setItem('pawcircle_resume_onboarding', '3');

      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
      window.location.href = `${apiBase}/auth/google/login?frontend_origin=${encodeURIComponent(window.location.origin)}`;
    } catch (err) {
      setAuthError(err.message || 'Google sign in initiation failed');
      setIsAuthLoading(false);
    }
  };

  // Email OTP Request
  const handleSendOtp = async (e) => {
    e?.preventDefault();
    if (!authEmail.trim() || !authEmail.includes('@')) {
      setAuthError('Please enter a valid email address.');
      return;
    }
    setIsAuthLoading(true);
    setAuthError('');
    setResendNotice('');
    try {
      await authApi.requestOtp(authEmail.trim());
      setIsOtpSent(true);
      setOtpDigits(['', '', '', '', '', '']); // Clear boxes upon resend
      setResendNotice('✓ New 6-digit code dispatched! Check inbox.');
      setTimeout(() => {
        document.getElementById('onboard-otp-0')?.focus();
      }, 100);
    } catch (err) {
      setAuthError(err.message || 'Failed to send OTP code.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Email OTP Verification
  const handleVerifyOtp = async (e) => {
    e?.preventDefault();
    const code = otpDigits.join('').trim();
    if (code.length < 6) {
      setAuthError('Please enter all 6 digits of the verification code.');
      return;
    }
    setIsAuthLoading(true);
    setAuthError('');
    try {
      await authApi.verifyOtp(authEmail.trim(), code);
      if (parentName) {
        try {
          await authApi.updateMe({ full_name: parentName, city: selectedCity || undefined });
        } catch (e) {
          console.warn('Profile sync note:', e);
        }
      }
      setIsOtpVerified(true);
      setResendNotice('');

      // Auto-detect if this account already has pet records
      try {
        const pets = await petsApi.getPets();
        if (Array.isArray(pets) && pets.length > 0) {
          setStoredActivePet(pets[0]);
          onClose();
          if (onFinish) onFinish();
          return;
        }
      } catch (petsErr) {
        console.warn('Pets check note:', petsErr);
      }
    } catch (err) {
      setAuthError(err.message || 'Invalid or expired verification code.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleNext = async () => {
    // If on pet-info step, validate pet name
    if (currentStepId === 'pet-info') {
      if (!petName || !petName.trim()) {
        alert("Please enter your pet's name to continue.");
        return;
      }
    }

    // If on account step, validate auth
    if (currentStepId === 'account') {
      if (!isOtpVerified && !getAuthToken()) {
        setAuthError('Please verify your email or sign in with Google to continue.');
        return;
      }
    }

    // If on health step, celebrate with confetti before finish
    if (currentStepId === 'health') {
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.5 },
        colors: ['#ffc93c', '#fc6955', '#75e6a4', '#1c1b1a']
      });
    }

    if (currentStep < STEPS.length) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Final step: create pet
      setIsSubmitting(true);
      try {
        if (!getAuthToken()) {
          setAuthError('Please verify your account before completing profile creation.');
          const accStep = STEPS.find(s => s.id === 'account')?.num;
          if (accStep) setCurrentStep(accStep);
          setIsSubmitting(false);
          return;
        }

        const createdPet = await petsApi.createPet({
          name: petName.trim() || 'My Pet',
          species: species || 'dog',
          gender: petGender || 'male',
          breed: breed || 'Mix',
          birth_date: calculateBirthDateFromAge(petAge, 'years'),
          weight_kg: parseFloat(petWeight) || 20.0,
          allergies: selectedAllergies,
          energy_level: energyLevel || 'high',
          play_style: selectedTraits.join(', ') || 'friendly',
          is_neutered: neutered,
          vax_status: vaccines.rabies ? 'full' : 'partial',
          avatar_url: petPhoto || undefined
        });

        if (createdPet) {
          setStoredActivePet(createdPet);
          window.dispatchEvent(new CustomEvent('pawcircle_pet_updated', { detail: createdPet }));
        }

        if (selectedCity) {
          localStorage.setItem('pawcircle_discovery_distance', String(discoveryDistance));
        }
      } catch (err) {
        console.warn('Backend pet creation note:', err.message);
      } finally {
        setIsSubmitting(false);
        localStorage.removeItem('pawcircle_onboarding_draft');
        localStorage.removeItem('pawcircle_resume_onboarding');
        if (onFinish) onFinish();
        onClose();
      }
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    } else {
      onClose();
    }
  };

  const toggleTrait = (trait) => {
    setSelectedTraits(prev =>
      prev.includes(trait) ? prev.filter(t => t !== trait) : [...prev, trait]
    );
  };

  const toggleAllergy = (allergy) => {
    setSelectedAllergies(prev =>
      prev.includes(allergy) ? prev.filter(a => a !== allergy) : [...prev, allergy]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-[560px] bg-surface-container-lowest rounded-3xl border border-outline-variant/40 shadow-2xl overflow-hidden my-auto flex flex-col">
        {/* Top Header / Step Progress */}
        <div className="p-4 sm:p-6 border-b border-outline-variant/30 flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center p-1 shadow-xs border border-outline-variant/30 shrink-0">
              <img
                src="/logo.png"
                alt="HawPulse"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <span className="font-brand text-lg font-bold text-on-surface lowercase">
                {isAddPetMode ? 'Add a Pet' : 'hawpulse'}
              </span>
              <span className="text-xs text-outline block -mt-1 font-sans">Step {currentStep} of {STEPS.length}</span>
            </div>
          </div>

          {/* Quick Step Jump buttons */}
          <div className="flex items-center gap-1">
            {STEPS.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  if (s.num < currentStep) setCurrentStep(s.num);
                }}
                className={`w-7 h-7 rounded-full text-xs font-bold transition-all ${
                  currentStep === s.num
                    ? 'bg-primary-container text-on-surface shadow-xs font-extrabold scale-105'
                    : currentStep > s.num
                    ? 'bg-tertiary-container text-on-tertiary-container'
                    : 'bg-surface-container text-outline hover:text-on-surface'
                }`}
                title={`Step ${s.num}: ${s.label}`}
              >
                {currentStep > s.num ? '✓' : s.num}
              </button>
            ))}
            <button onClick={onClose} className="w-8 h-8 rounded-full text-outline hover:text-on-surface flex items-center justify-center ml-2 cursor-pointer" title="Close">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Step Progress Line */}
        <div className="w-full h-1.5 bg-surface-container overflow-hidden">
          <div
            className="h-full bg-primary-container transition-all duration-300"
            style={{ width: `${(currentStep / STEPS.length) * 100}%` }}
          ></div>
        </div>

        {/* Prominent Top Banner: Already have an account? Sign in */}
        {!isAddPetMode && (currentStepId === 'location' || currentStepId === 'account') && (
          <div className="px-5 py-2.5 bg-primary-container/25 border-b border-outline-variant/30 flex items-center justify-between text-xs sm:text-sm shrink-0">
            <span className="text-on-surface-variant font-medium">Already have an account?</span>
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onSwitchToSignIn) onSwitchToSignIn();
              }}
              className="font-bold text-primary hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>Sign in instead</span>
              <span>&rarr;</span>
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 sm:p-8 flex flex-col gap-6 max-h-[75vh] overflow-y-auto">
          {/* ================= STEP: LOCATION ================= */}
          {currentStepId === 'location' && (
            <div className="flex flex-col gap-6">
              {/* Animated 3D Earth with Continually Hopping & Moving Paw Graphic */}
              <EarthPawLocationGraphic
                selectedCity={selectedCity}
                discoveryDistance={discoveryDistance}
              />

              <div>
                <h2 className="font-headline-md text-2xl font-bold text-on-surface">Where do you and your pet hang out?</h2>
                <p className="font-body-md text-xs sm:text-sm text-on-surface-variant mt-1 leading-relaxed">
                  We use your general area to find nearby playmates and emergency vets. We never show your exact street address.
                </p>
              </div>

              {locationError && (
                <div className="w-full p-3 rounded-xl bg-error-container text-on-error-container text-xs text-left">
                  {locationError}
                </div>
              )}

              {locationSubstate === 'initial' && (
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    disabled={isDetectingLocation}
                    onClick={handleAutoDetectLocation}
                    className="w-full h-12 rounded-full bg-primary-container text-on-surface font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 hover:bg-primary-fixed-dim transition-all shadow-xs cursor-pointer disabled:opacity-60"
                  >
                    {isDetectingLocation ? (
                      <>
                        <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                        <span>Detecting GPS &amp; Neighbourhood...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[20px]">near_me</span>
                        <span>Auto-detect my location</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocationSubstate('search')}
                    className="w-full h-12 rounded-full border border-outline-variant text-on-surface font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 hover:bg-surface-container transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[20px]">search</span>
                    <span>Search or enter city manually</span>
                  </button>
                </div>
              )}

              {locationSubstate === 'detected' && (
                <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary text-[24px]">location_on</span>
                    <div>
                      <span className="text-[11px] uppercase font-bold text-outline">Detected Location</span>
                      <h4 className="font-bold text-base text-on-surface">{selectedCity || 'Detected Location'}</h4>
                      <p className="text-xs text-on-surface-variant">Fuzzy privacy shield enabled</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleNext()}
                      className="flex-1 h-10 rounded-full bg-primary-container text-on-surface font-bold text-xs hover:bg-primary-fixed-dim cursor-pointer"
                    >
                      Yes, that's right
                    </button>
                    <button
                      type="button"
                      onClick={() => setLocationSubstate('search')}
                      className="px-4 h-10 rounded-full border border-outline-variant text-on-surface text-xs font-semibold cursor-pointer"
                    >
                      Change
                    </button>
                  </div>
                </div>
              )}

              {locationSubstate === 'search' && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-on-surface">Enter neighbourhood or city</label>
                  <input
                    type="text"
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    placeholder="Search city (e.g. Model Town, Amritsar)"
                    className="w-full h-12 px-4 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs sm:text-sm focus:outline-none"
                  />
                  <div className="flex flex-col gap-1 mt-1">
                    {['Model Town, Amritsar', 'Ranjit Avenue, Amritsar', 'Mall Road, Amritsar'].map((c, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setSelectedCity(c);
                          setLocationSubstate('detected');
                        }}
                        className="text-left p-2 rounded-lg hover:bg-surface-container text-xs text-on-surface flex justify-between"
                      >
                        <span>{c}</span>
                        <span className="text-primary font-bold">Select</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tinder / Bumble style Maximum Discovery Distance Slider */}
              <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">radar</span>
                    <div>
                      <span className="text-xs font-bold text-on-surface block">Maximum Discovery Distance</span>
                      <span className="text-[11px] text-on-surface-variant">Find playmates, packs &amp; sitters within this radius</span>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-primary-container text-on-surface font-mono font-bold text-xs shadow-xs">
                    {discoveryDistance} km
                  </span>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <span className="text-[11px] text-outline font-semibold">2 km</span>
                  <input
                    type="range"
                    min="2"
                    max="50"
                    step="1"
                    value={discoveryDistance}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setDiscoveryDistance(val);
                      localStorage.setItem('pawcircle_discovery_distance', String(val));
                    }}
                    className="flex-1 accent-primary cursor-pointer h-2 bg-surface-container rounded-lg"
                  />
                  <span className="text-[11px] text-outline font-semibold">50 km</span>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {[5, 10, 15, 25, 50].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setDiscoveryDistance(d);
                        localStorage.setItem('pawcircle_discovery_distance', String(d));
                      }}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                        discoveryDistance === d
                          ? 'bg-primary-container text-on-surface font-bold shadow-xs'
                          : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
                      }`}
                    >
                      {d} km {d === 5 ? '(Local)' : d === 25 ? '(City)' : d === 50 ? '(Max)' : ''}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP: ACCOUNT & VERIFICATION ================= */}
          {currentStepId === 'account' && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="font-headline-md text-2xl font-bold text-on-surface">Create your account.</h2>
                <p className="text-xs sm:text-sm text-on-surface-variant mt-1 leading-relaxed">
                  Link your email or sign in with Google so your pet notebook syncs smoothly across devices.
                </p>
              </div>

              {/* 1-Click Google Sign-In Button */}
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={isAuthLoading}
                  onClick={handleGoogleSignIn}
                  className="w-full h-12 rounded-2xl bg-surface-container-lowest border border-outline-variant/50 hover:bg-surface-container transition-all flex items-center justify-center gap-3 font-semibold text-xs sm:text-sm text-on-surface shadow-xs cursor-pointer disabled:opacity-60"
                >
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Sign in with Google Account</span>
                </button>

                <div className="relative flex items-center justify-center my-1">
                  <div className="border-t border-outline-variant/30 w-full"></div>
                  <span className="bg-surface-container-lowest px-3 text-[10px] font-bold text-outline uppercase tracking-wider absolute">
                    or continue with email otp
                  </span>
                </div>
              </div>

              {authError && (
                <div className="w-full p-3 rounded-xl bg-error-container text-on-error-container text-xs text-left">
                  {authError}
                </div>
              )}

              {/* Verified State Banner */}
              {isOtpVerified ? (
                <div className="p-4 rounded-2xl bg-tertiary-container/25 border border-tertiary-container flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-tertiary-container flex items-center justify-center text-on-tertiary-container text-lg font-bold">
                      ✓
                    </div>
                    <div className="text-left">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-tertiary block">Account Verified</span>
                      <span className="text-sm font-bold text-on-surface">{authEmail || 'Verified Parent Account'}</span>
                      <span className="text-[11px] text-outline block">Account synchronized</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOtpVerified(false);
                      setIsOtpSent(false);
                    }}
                    className="text-xs font-semibold text-outline hover:text-on-surface underline cursor-pointer"
                  >
                    Change
                  </button>
                </div>
              ) : (
                /* Email & OTP Input Group */
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1 text-left">
                    <label className="text-xs font-bold text-on-surface">Email address</label>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="flex-1 h-11 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs sm:text-sm focus:outline-none focus:border-on-surface"
                      />
                      <button
                        type="button"
                        disabled={isAuthLoading || !authEmail.trim()}
                        onClick={handleSendOtp}
                        className="px-4 h-11 rounded-xl bg-primary-container text-on-surface font-bold text-xs hover:bg-primary-fixed-dim transition-colors cursor-pointer disabled:opacity-60 shrink-0"
                      >
                        {isAuthLoading ? 'Sending...' : (isOtpSent ? 'Resend' : 'Send Code')}
                      </button>
                    </div>
                  </div>

                  {/* 6 Digit OTP input */}
                  {isOtpSent && (
                    <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col items-center gap-3">
                      <div className="text-center">
                        <span className="text-xs font-bold text-on-surface">Enter the 6-digit OTP code</span>
                        <p className="text-[11px] text-on-surface-variant font-medium mt-0.5">
                          Sent to {authEmail} (valid for 10 minutes)
                        </p>
                      </div>

                      {/* Resend confirmation feedback banner */}
                      {resendNotice && (
                        <div className="w-full py-1.5 px-3 rounded-lg bg-tertiary-container/40 text-tertiary text-xs font-semibold text-center flex items-center justify-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px]">mark_email_read</span>
                          <span>{resendNotice}</span>
                        </div>
                      )}

                      <div className="flex gap-2">
                        {otpDigits.map((digit, i) => (
                          <input
                            key={i}
                            id={`onboard-otp-${i}`}
                            type="text"
                            maxLength={1}
                            value={digit}
                            placeholder="•"
                            onChange={(e) => {
                              const val = e.target.value.slice(-1);
                              const updated = [...otpDigits];
                              updated[i] = val;
                              setOtpDigits(updated);
                              if (val && i < 5) {
                                document.getElementById(`onboard-otp-${i + 1}`)?.focus();
                              }
                            }}
                            className="w-10 h-12 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-center font-bold text-lg text-on-surface focus:outline-none focus:border-on-surface"
                          />
                        ))}
                      </div>

                      <div className="flex items-center justify-end w-full px-1">
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          className="text-[11px] text-primary font-bold hover:underline cursor-pointer"
                        >
                          Resend code
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled={isAuthLoading}
                        onClick={handleVerifyOtp}
                        className="w-full h-10 rounded-full bg-primary-container text-on-surface font-bold text-xs hover:bg-primary-fixed-dim cursor-pointer transition-colors mt-1"
                      >
                        {isAuthLoading ? 'Verifying...' : 'Verify & Continue'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ================= STEP: PET INFO & PHOTO ================= */}
          {currentStepId === 'pet-info' && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="font-headline-md text-2xl font-bold text-on-surface">Now, the star of the show.</h2>
                <p className="text-xs sm:text-sm text-on-surface-variant mt-1 leading-relaxed">
                  Introduce your best friend so we can customize their daily nutrition and care notebook.
                </p>
              </div>

              {/* Photo Upload Box */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-on-surface flex items-center justify-between">
                  <span>Pet photo</span>
                  <span className="text-[11px] font-normal text-outline">Optional • JPEG, PNG up to 8MB</span>
                </label>

                <div className="p-4 rounded-2xl bg-surface-container-low border-2 border-dashed border-outline-variant/50 flex flex-col sm:flex-row items-center gap-4 transition-all hover:border-primary-container">
                  {/* Photo Preview Thumbnail */}
                  <div className="relative group shrink-0">
                    {petPhoto ? (
                      <div className="relative w-20 h-20 rounded-2xl overflow-hidden shadow-sm border-2 border-primary-container">
                        <img src={petPhoto} alt="Pet Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setPetPhoto(null)}
                          className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-xs font-bold cursor-pointer"
                          title="Remove photo"
                        >
                          ✕ Remove
                        </button>
                      </div>
                    ) : (
                      <label
                        htmlFor="pet-photo-file-input"
                        className="w-20 h-20 rounded-2xl bg-surface-container flex flex-col items-center justify-center cursor-pointer hover:bg-surface-container-high transition-colors border border-outline-variant/40"
                      >
                        <span className="material-symbols-outlined text-[28px] text-outline">add_a_photo</span>
                        <span className="text-[10px] font-bold text-on-surface-variant mt-1">Upload</span>
                      </label>
                    )}
                  </div>

                  {/* Actions & Avatar Presets */}
                  <div className="flex-1 flex flex-col gap-2 text-center sm:text-left">
                    <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                      <label
                        htmlFor="pet-photo-file-input"
                        className="px-3.5 py-1.5 rounded-full bg-primary-container text-on-surface text-xs font-bold hover:bg-primary-fixed-dim transition-colors cursor-pointer shadow-xs"
                      >
                        {petPhoto ? 'Change Photo' : 'Browse from Device'}
                      </label>
                      {petPhoto && (
                        <button
                          type="button"
                          onClick={() => setPetPhoto(null)}
                          className="px-3 py-1.5 rounded-full border border-outline-variant text-xs font-semibold text-outline hover:text-on-surface cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                      <input
                        id="pet-photo-file-input"
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </div>

                    {/* Preset Avatars */}
                    <div className="flex items-center gap-1.5 justify-center sm:justify-start mt-0.5">
                      <span className="text-[11px] text-outline mr-1">Or pick avatar:</span>
                      {[
                        { label: 'Golden', url: 'https://images.unsplash.com/photo-1552053831-71594a27632d?w=200&auto=format&fit=crop&q=80' },
                        { label: 'Labrador', url: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=200&auto=format&fit=crop&q=80' },
                        { label: 'Frenchie', url: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=200&auto=format&fit=crop&q=80' },
                        { label: 'Cat', url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=200&auto=format&fit=crop&q=80' }
                      ].map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setPetPhoto(p.url)}
                          title={p.label}
                          className={`w-7 h-7 rounded-full overflow-hidden border-2 transition-transform hover:scale-110 cursor-pointer ${
                            petPhoto === p.url ? 'border-primary-container ring-2 ring-primary' : 'border-outline-variant/40'
                          }`}
                        >
                          <img src={p.url} alt={p.label} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Species Toggle */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSpecies('dog')}
                  className={`p-4 rounded-2xl flex flex-col items-center justify-center border-2 transition-all cursor-pointer ${
                    species === 'dog' ? 'bg-primary-container/20 border-primary-container shadow-xs' : 'bg-surface-container-low border-outline-variant/30'
                  }`}
                >
                  <span className="text-3xl mb-1">🐕</span>
                  <span className="font-bold text-sm text-on-surface">Dog</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSpecies('cat')}
                  className={`p-4 rounded-2xl flex flex-col items-center justify-center border-2 transition-all cursor-pointer ${
                    species === 'cat' ? 'bg-primary-container/20 border-primary-container shadow-xs' : 'bg-surface-container-low border-outline-variant/30'
                  }`}
                >
                  <span className="text-3xl mb-1">🐈</span>
                  <span className="font-bold text-sm text-on-surface">Cat</span>
                </button>
              </div>

              {/* Gender / Sex Toggle */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface">Gender / Sex</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPetGender('male')}
                    className={`h-12 px-4 rounded-2xl flex items-center justify-center gap-2 border-2 transition-all cursor-pointer font-bold text-xs sm:text-sm ${
                      petGender === 'male'
                        ? 'bg-blue-500/10 border-blue-500 text-on-surface shadow-xs ring-1 ring-blue-500/30'
                        : 'bg-surface-container-low border-outline-variant/30 text-on-surface-variant hover:border-black/30'
                    }`}
                  >
                    <span className="text-xl">🧢</span>
                    <span>Boy (Male)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPetGender('female')}
                    className={`h-12 px-4 rounded-2xl flex items-center justify-center gap-2 border-2 transition-all cursor-pointer font-bold text-xs sm:text-sm ${
                      petGender === 'female'
                        ? 'bg-pink-500/10 border-pink-500 text-on-surface shadow-xs ring-1 ring-pink-500/30'
                        : 'bg-surface-container-low border-outline-variant/30 text-on-surface-variant hover:border-black/30'
                    }`}
                  >
                    <span className="text-xl">🎀</span>
                    <span>Girl (Female)</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-on-surface">Pet's name</label>
                  <input
                    type="text"
                    value={petName}
                    onChange={(e) => setPetName(e.target.value)}
                    placeholder="e.g. Cooper"
                    className="h-11 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs sm:text-sm focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-on-surface">Breed</label>
                  <input
                    type="text"
                    value={breed}
                    onChange={(e) => setBreed(e.target.value)}
                    placeholder="e.g. Golden Retriever"
                    className="h-11 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs sm:text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1 min-w-0">
                  <label className="text-xs font-bold text-on-surface">Age (Years)</label>
                  <input
                    type="number"
                    value={petAge}
                    onChange={(e) => setPetAge(e.target.value)}
                    placeholder="e.g. 2"
                    className="h-11 w-full min-w-0 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs sm:text-sm focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <label className="text-xs font-bold text-on-surface">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={petWeight}
                    onChange={(e) => setPetWeight(e.target.value)}
                    placeholder="e.g. 31.0"
                    className="h-11 w-full min-w-0 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs sm:text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-surface-container-low rounded-xl">
                <span className="text-xs font-bold text-on-surface">Neutered or Spayed?</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNeutered(true)}
                    className={`px-3 py-1 rounded-full text-xs font-bold ${neutered ? 'bg-primary-container text-on-surface' : 'bg-surface-container text-outline'}`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setNeutered(false)}
                    className={`px-3 py-1 rounded-full text-xs font-bold ${!neutered ? 'bg-primary-container text-on-surface' : 'bg-surface-container text-outline'}`}
                  >
                    No
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP: PERSONALITY & TRAITS ================= */}
          {currentStepId === 'personality' && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="font-headline-md text-2xl font-bold text-on-surface">
                  {petName ? `${petName}'s Personality` : "Pet's Personality"}
                </h2>
                <p className="text-xs sm:text-sm text-on-surface-variant mt-1 leading-relaxed">
                  Help local pet parents understand {petName ? `${petName}'s` : "your pet's"} energy and favorite activities.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-on-surface">Energy Level</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'high', label: '⚡ High Energy' },
                    { id: 'moderate', label: '🌿 Moderate' },
                    { id: 'chill', label: '🛋️ Chill / Senior' }
                  ].map(lvl => (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => setEnergyLevel(lvl.id)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                        energyLevel === lvl.id
                          ? 'bg-primary-container text-on-surface border-transparent shadow-xs'
                          : 'bg-surface-container-low border-outline-variant/30 text-on-surface-variant'
                      }`}
                    >
                      {lvl.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-on-surface">Select traits &amp; play styles</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Ball Chaser', 'Tug-of-war', 'Loves swimming', 'Gentle with kids',
                    'Friendly with dogs', 'Off-leash trained', 'Needs slow intro', 'Couch cuddler'
                  ].map(trait => {
                    const active = selectedTraits.includes(trait);
                    return (
                      <button
                        key={trait}
                        type="button"
                        onClick={() => toggleTrait(trait)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                          active
                            ? 'bg-primary-container text-on-surface border border-on-surface shadow-xs'
                            : 'bg-surface-container-low text-on-surface-variant border border-outline-variant/30'
                        }`}
                      >
                        {active ? `✓ ${trait}` : `+ ${trait}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-on-surface">Allergies / Dietary sensitivities</label>
                <div className="flex flex-wrap gap-2">
                  {['Chicken', 'Beef', 'Dairy', 'Grains', 'Eggs'].map(item => {
                    const active = selectedAllergies.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleAllergy(item)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          active ? 'bg-secondary-fixed text-secondary' : 'bg-surface-container text-outline'
                        }`}
                      >
                        {item} {active && '✕'}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP: VACCINES ================= */}
          {currentStepId === 'health' && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="font-headline-md text-2xl font-bold text-on-surface">Health &amp; Inoculations</h2>
                <p className="text-xs sm:text-sm text-on-surface-variant mt-1 leading-relaxed">
                  HawPulse displays verified badges so local park packs stay safe for all pets.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                {[
                  { id: 'rabies', name: 'Rabies Annual Vaccine', desc: 'Core vaccine required for public parks and legal compliance.' },
                  { id: 'dhpp', name: 'DHPP / Distemper Core', desc: 'Protects against distemper, parvovirus, and hepatitis.' },
                  { id: 'bordetella', name: 'Bordetella (Kennel Cough)', desc: 'Recommended for dog playdates, boarding, and daycare.' }
                ].map(v => (
                  <label key={v.id} className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 flex items-start justify-between cursor-pointer">
                    <div className="flex flex-col pr-4">
                      <span className="font-bold text-sm text-on-surface">{v.name}</span>
                      <span className="text-xs text-on-surface-variant mt-0.5">{v.desc}</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={vaccines[v.id]}
                      onChange={(e) => setVaccines({ ...vaccines, [v.id]: e.target.checked })}
                      className="mt-1 w-5 h-5 rounded accent-primary cursor-pointer"
                    />
                  </label>
                ))}
              </div>

              <div className="p-4 rounded-xl bg-tertiary-container/20 border border-tertiary-container/50 flex items-center gap-3">
                <span className="material-symbols-outlined text-tertiary text-[22px]">verified</span>
                <p className="text-xs text-on-surface font-medium">
                  Verified Vaccine Badge will be awarded to {petName || 'your pet'} once booklet photo is submitted in Medical Vault.
                </p>
              </div>
            </div>
          )}

          {/* ================= STEP: FINISH ================= */}
          {currentStepId === 'finish' && (
            <div className="flex flex-col items-center text-center gap-5 py-4">
              <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center p-2 shadow-md border border-outline-variant/30 animate-bounce">
                <img
                  src="/logo.png"
                  alt="HawPulse"
                  className="w-full h-full object-contain"
                />
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-tertiary">All set!</span>
                <h2 className="font-headline-lg text-3xl font-bold text-on-surface mt-1">
                  Welcome to HawPulse{petName ? `, ${petName}` : ''}!
                </h2>
                <p className="text-xs sm:text-sm text-on-surface-variant max-w-sm mt-1 leading-relaxed">
                  Your customized notebook is ready. We calculated {petName ? `${petName}'s` : "your pet's"} daily calories, structured their routine, and connected you to {selectedCity || 'local'} playmates.
                </p>
              </div>

              {/* Ready Summary Card with Actual Pet Photo */}
              <div className="w-full p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex items-center gap-4 text-left">
                <img
                  src={petPhoto || (species === 'cat' ? "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=200&auto=format&fit=crop&q=80" : "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=200&auto=format&fit=crop&q=80")}
                  alt={petName || 'Pet'}
                  className="w-16 h-16 rounded-xl object-cover shadow-xs border border-outline-variant/30"
                />
                <div className="flex flex-col">
                  <span className="font-bold text-sm text-on-surface">{petName || 'Your Pet'}</span>
                  <span className="text-xs text-on-surface-variant">{breed || (species === 'cat' ? 'Cat' : 'Dog')} • {selectedCity || 'Location set'}</span>
                  <span className="text-xs font-semibold text-tertiary mt-0.5">1,420 kcal/day • Daily Diary Active</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 sm:p-6 border-t border-outline-variant/30 flex items-center justify-between bg-surface-container-low">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handlePrev}
              className="px-5 py-2.5 rounded-full border border-outline-variant text-xs sm:text-sm font-semibold hover:bg-surface-container transition-colors cursor-pointer"
            >
              Back
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full border border-outline-variant/50 text-outline hover:text-on-surface text-xs sm:text-sm font-semibold hover:bg-surface-container transition-colors cursor-pointer"
            >
              Cancel
            </button>
          )}

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleNext}
            className="px-8 py-2.5 rounded-full bg-primary-container text-on-surface font-bold text-xs sm:text-sm hover:bg-primary-fixed-dim transition-colors shadow-xs cursor-pointer disabled:opacity-60 flex items-center gap-2"
          >
            {isSubmitting && <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>}
            <span>
              {currentStep === STEPS.length
                ? (isAddPetMode ? `Done & Save ${petName || 'Pet'}` : 'Enter HawPulse Dashboard')
                : 'Continue'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
