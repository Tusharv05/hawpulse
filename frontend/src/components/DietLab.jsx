import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { dietApi, petsApi, calendarApi, getStoredActivePet, setStoredActivePet } from '../services/api';
import { formatPetAge } from '../utils/petAge';

// Textarea that automatically resizes its height to fit its content,
// so long AI-generated text is fully visible instead of being cut off on one line.
function AutoGrowTextarea({ value, minRows = 1, className = '', ...props }) {
  const ref = useRef(null);

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 4}px`;
  };

  useLayoutEffect(resize, [value]);

  useEffect(() => {
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      className={`resize-none overflow-hidden leading-relaxed ${className}`}
      {...props}
    />
  );
}

export default function DietLab({ setActiveTab }) {
  const storedPet = getStoredActivePet();
  const initialWeight = storedPet?.weight_kg != null ? Math.round(Number(storedPet.weight_kg)) : 9;
  const [currentPet, setCurrentPet] = useState(storedPet);
  const [isLoadingPet, setIsLoadingPet] = useState(!storedPet);

  const [dietType, setDietType] = useState('kibble');
  const [promptText, setPromptText] = useState('');
  const [weight, setWeight] = useState(initialWeight);
  const [activity, setActivity] = useState('active');
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [foodSearch, setFoodSearch] = useState('');
  const [activePlanId, setActivePlanId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [isPlanConfiguredInDb, setIsPlanConfiguredInDb] = useState(false);
  const [activeDbPlan, setActiveDbPlan] = useState(null);
  const [hasGeneratedPlan, setHasGeneratedPlan] = useState(false);
  const [suggestedPlanAnswer, setSuggestedPlanAnswer] = useState(null);
  const [foodFilterTab, setFoodFilterTab] = useState('all'); // 'all' | 'recent' | 'prewritten'
  const [aiCheckedFoods, setAiCheckedFoods] = useState(() => {
    try {
      const saved = localStorage.getItem('pawcircle_recent_ai_foods');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      {
        name: "Peanut Butter (Unsweetened)",
        status: "safe",
        note: "Safe protein treat only if 100% xylitol-free and unsalted.",
        icon: "🥜",
        recommendation: "Feed in small spoonfuls as pill pocket or lick mat treat.",
        isAiVerified: true
      },
      {
        name: "Cooked White Rice",
        status: "safe",
        note: "Gentle bland carbohydrate ideal for calming upset canine stomachs.",
        icon: "🍚",
        recommendation: "Boil plain with water; no oil, butter, garlic, or salt.",
        isAiVerified: true
      }
    ];
  });
  const [isCheckingAiFood, setIsCheckingAiFood] = useState(false);
  const [aiFoodFeedback, setAiFoodFeedback] = useState(null);

  const handleRemoveRecentFood = (nameToRemove) => {
    setAiCheckedFoods(prev => {
      const updated = prev.filter(f => f.name.toLowerCase() !== nameToRemove.toLowerCase());
      try {
        localStorage.setItem('pawcircle_recent_ai_foods', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleClearAllRecent = () => {
    setAiCheckedFoods([]);
    try {
      localStorage.removeItem('pawcircle_recent_ai_foods');
    } catch {}
    showToast('Cleared recently asked foods history.');
  };

  const DURATION_PRESETS = [
    { days: 7, label: '7 Days', sub: '1 Week' },
    { days: 14, label: '14 Days', sub: '2 Weeks' },
    { days: 30, label: '30 Days', sub: '1 Month', isDefault: true },
    { days: 60, label: '60 Days', sub: '2 Months' },
    { days: 90, label: '90 Days', sub: '3 Months' },
  ];

  // Google Calendar scheduling state
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calendarStatus, setCalendarStatus] = useState({ configured: true, connected: true });
  const [isSchedulingCalendar, setIsSchedulingCalendar] = useState(false);
  const [calendarResult, setCalendarResult] = useState(null);
  const [calendarMorningTime, setCalendarMorningTime] = useState('08:30');
  const [calendarEveningTime, setCalendarEveningTime] = useState('19:30');
  const [calendarDurationDays, setCalendarDurationDays] = useState(30);

  const getCalendarEndDateStr = (days) => {
    const d = new Date();
    const count = parseInt(days, 10) || 30;
    d.setDate(d.getDate() + count - 1);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getCalendarStartDateStr = () => {
    return new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const parseTimeString = (text, defaultTime) => {
    if (!text) return defaultTime;
    const match = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)/i);
    if (match) {
      const raw = match[1].trim();
      if (/am|pm/i.test(raw)) {
        const parts = raw.split(/[:\s]/);
        let h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) || 0;
        const isPm = /pm/i.test(raw);
        if (isPm && h < 12) h += 12;
        if (!isPm && h === 12) h = 0;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
      const parts = raw.split(':');
      const h = parseInt(parts[0], 10) || 8;
      const m = parseInt(parts[1], 10) || 0;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    return defaultTime;
  };

  const handleOpenCalendarModal = async () => {
    const mTime = parseTimeString(planForm.morning_meal || activeDbPlan?.morning_meal, '08:30');
    const eTime = parseTimeString(planForm.evening_meal || activeDbPlan?.evening_meal, '19:30');
    setCalendarMorningTime(mTime);
    setCalendarEveningTime(eTime);
    setCalendarDurationDays(30);
    setCalendarResult(null);
    setShowCalendarModal(true);

    try {
      const st = await calendarApi.getStatus();
      if (st) setCalendarStatus(st);
    } catch {
      setCalendarStatus({ configured: true, connected: true });
    }
  };

  const handleTriggerGoogleCalendar = async () => {
    setIsSchedulingCalendar(true);
    setCalendarResult(null);
    try {
      const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const cleanDuration = parseInt(calendarDurationDays, 10) || 30;
      const payload = {
        pet_id: currentPet?.id || null,
        pet_name: petName,
        current_food: planForm.current_food || activeDbPlan?.current_food || 'Daily Balanced Formula',
        amount_per_day: planForm.amount_per_day || activeDbPlan?.amount_per_day,
        morning_meal: planForm.morning_meal || activeDbPlan?.morning_meal || 'Breakfast portion',
        evening_meal: planForm.evening_meal || activeDbPlan?.evening_meal || 'Dinner portion',
        morning_time: calendarMorningTime,
        evening_time: calendarEveningTime,
        notes: planForm.notes || activeDbPlan?.notes,
        user_timezone: userTz,
        duration_days: cleanDuration
      };

      const res = await calendarApi.scheduleFeeding(payload);
      setCalendarResult(res);
      showToast(`✓ Google Calendar feeding reminders scheduled for ${petName} (${cleanDuration} days)!`);
    } catch (err) {
      console.error('Calendar scheduling error:', err);
      showToast(`Calendar error: ${err.message || 'Could not schedule'}`);
    } finally {
      setIsSchedulingCalendar(false);
    }
  };


  // Form format matching Screenshot 4:
  // Overview (optional), Current food, Amount per day, Meals, Morning meal, Evening meal, Snacks (optional), Notes
  // Initially EMPTY - only fills AFTER user generates meal with AI or if loaded from backend DB
  const [planForm, setPlanForm] = useState({
    overview: '',
    current_food: '',
    amount_per_day: '',
    meals: '',
    morning_meal: '',
    evening_meal: '',
    snacks: '',
    notes: ''
  });

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Helper to calculate pet age from birth date (supports puppy/kitten months)
  const calculateAge = (birthDate) => {
    return formatPetAge(birthDate);
  };

  // Initial load: Fetch real pet details and active plan from backend database
  useEffect(() => {
    async function loadBackendData() {
      setIsLoadingPet(true);
      try {
        let pet = null;
        // 1. Fetch pets from backend
        const pets = await petsApi.getPets();
        if (pets && pets.length > 0) {
          pet = pets[0];
          setCurrentPet(pet);
          setStoredActivePet(pet);
        } else {
          pet = getStoredActivePet();
          if (pet) setCurrentPet(pet);
        }

        if (pet) {
          const petWeight = pet.weight_kg != null ? Math.round(Number(pet.weight_kg)) : 9;
          setWeight(petWeight);

          // 2. Fetch active diet plan status from backend database.
          // Note: Store activeDbPlan to display synced status, but keep planForm empty
          // so initial page load is cleanly managed without jumping from blank to populated.
          if (pet.id) {
            const planDet = await dietApi.getPlanDetail(pet.id);
            if (planDet?.is_configured) {
              setIsPlanConfiguredInDb(true);
              setActiveDbPlan(planDet);
            }
          }
        }
      } catch (err) {
        console.warn('Backend load note in DietLab:', err.message);
      } finally {
        setIsLoadingPet(false);
      }
    }

    loadBackendData();
  }, []);

  // Daily calorie formula based on dynamic pet weight & activity
  const baseKcal = Math.round(70 * Math.pow(Math.max(1, weight), 0.75));
  const activityMultiplier = activity === 'low' ? 1.4 : activity === 'active' ? 1.8 : 2.2;
  const targetKcal = Math.round(baseKcal * activityMultiplier);
  const targetDailyGrams = Math.round(targetKcal / 3.6);

  const petName = currentPet?.name || 'Your Pet';
  const petBreed = currentPet?.breed || 'Canine';
  const petGender = currentPet?.gender ? (currentPet.gender.toLowerCase() === 'female' ? 'Girl 🎀' : 'Boy 🧢') : null;
  const petAge = calculateAge(currentPet?.birth_date);
  const petNeutered = currentPet?.is_neutered ? 'Neutered' : 'Intact';
  const petAllergies = currentPet?.allergies && currentPet.allergies.length > 0
    ? currentPet.allergies.join(', ')
    : null;

  // Slider bounds: FIXED range derived from the pet's saved weight (never from the live slider value).
  // Previously min/max were recomputed from `weight` on every drag, which kept the thumb pinned in the middle.
  const savedPetWeight = currentPet?.weight_kg != null ? Number(currentPet.weight_kg) : 9;
  const sliderMin = 1;
  const sliderMax = Math.max(40, Math.ceil(savedPetWeight * 2));

  const toxicFoods = [
    { name: "Chocolate & Cocoa", status: "fatal", note: "Theobromine causes rapid heart failure and seizures.", icon: "🍫" },
    { name: "Grapes, Raisins & Kishmish", status: "fatal", note: "Even small quantities trigger acute sudden kidney failure.", icon: "🍇" },
    { name: "Onions & Garlic (Pyaz / Lehsun)", status: "severe", note: "Thiosulfate destroys red blood cells causing hemolytic anemia.", icon: "🧅" },
    { name: "Samosa & Spiced Street Snacks", status: "severe", note: "Deep-fried dough with onion, garlic, and chilies; acute pancreatitis risk.", icon: "🥟" },
    { name: "Dal Makhani & Spiced Curries", status: "severe", note: "Heavy cream, butter, garlic, and onions trigger toxic hemolytic anemia.", icon: "🍛" },
    { name: "Biryani & Spiced Pulao", status: "severe", note: "Fried onions, garlic, whole spices, and raisins are strictly toxic.", icon: "🍚" },
    { name: "Gulab Jamun & Indian Sweets", status: "severe", note: "Concentrated sugar syrup, ghee, and khoya trigger acute pancreatitis.", icon: "🍬" },
    { name: "Xylitol (Sweetener)", status: "fatal", note: "Found in sugar-free peanut butter; triggers fatal insulin spike.", icon: "🍬" },
    { name: "Macadamia Nuts", status: "severe", note: "Induces rear limb paralysis, tremors, and hypothermia.", icon: "🥜" },
    { name: "Cooked Chicken Bones", status: "severe", note: "Bones splinter easily and pierce throat or intestinal tract.", icon: "🍗" },
    { name: "Avocado", status: "moderate", note: "Persin causes stomach upset; large pit poses choking hazard.", icon: "🥑" },
    { name: "Plain Roti / Chapati", status: "safe", note: "Unbuttered plain wheat roti is safe as an occasional treat in small bites.", icon: "🫓" },
    { name: "Plain Fresh Curd (Dahi)", status: "safe", note: "Natural probiotic that soothes gut flora and cools dogs in hot weather.", icon: "🥣" },
    { name: "Plain Moong Dal Khichdi", status: "safe", note: "Vet-recommended recovery diet; plain boiled yellow lentils & rice.", icon: "🍲" },
    { name: "Plain Homemade Paneer", status: "safe", note: "Unseasoned cottage cheese provides wholesome calcium and protein.", icon: "🧀" },
    { name: "Cooked Carrots & Pumpkin", status: "safe", note: "Excellent soluble fiber for gut health and anal gland support.", icon: "🥕" },
    { name: "Apples (No Seeds)", status: "safe", note: "Great source of vitamins A & C. Always core and remove seeds.", icon: "🍎" },
    { name: "Plain Salmon & White Fish", status: "safe", note: "High omega-3 fatty acids for joint and shiny coat health.", icon: "🐟" }
  ];

  const allFoods = [...aiCheckedFoods, ...toxicFoods];

  const trimmedSearch = foodSearch.trim().toLowerCase();

  // Search matches
  const matchedRecent = trimmedSearch
    ? aiCheckedFoods.filter(f => f.name.toLowerCase().includes(trimmedSearch) || f.note.toLowerCase().includes(trimmedSearch))
    : aiCheckedFoods;

  const matchedPrewritten = trimmedSearch
    ? toxicFoods.filter(f => f.name.toLowerCase().includes(trimmedSearch) || f.note.toLowerCase().includes(trimmedSearch))
    : toxicFoods;

  const hasSearchMatches = trimmedSearch ? (matchedRecent.length > 0 || matchedPrewritten.length > 0) : true;

  // If there are search matches, show matching cards.
  // CRITICAL FIX: If user searches for a novel ingredient (like 'Paneer butter Masala') that has no local matches yet,
  // DO NOT hide their previous searched or predefined preferences! Display all cards with an AI prompt banner.
  const displayedRecent = hasSearchMatches ? matchedRecent : aiCheckedFoods;
  const displayedPrewritten = hasSearchMatches ? matchedPrewritten : toxicFoods;

  // AI Ingredient Safety Radar Check:
  // Evaluates ingredients outside the reference list, classifying as safe, moderate, severe, or fatal
  const handleCheckIngredientAi = async (customQuery) => {
    const query = (customQuery || foodSearch).trim();
    if (!query) return;

    // Check if exact food is already in allFoods
    const cleanQ = query.toLowerCase();
    const existing = allFoods.find(f => f.name.toLowerCase() === cleanQ || f.name.toLowerCase().startsWith(cleanQ + " "));
    if (existing) {
      setAiFoodFeedback(`Found: ${existing.name} is marked as ${existing.status.toUpperCase()}`);
      setFoodSearch(''); // Clear search so all cards are visible immediately
      setFoodFilterTab(existing.isAiVerified ? 'recent' : 'prewritten');
      return;
    }

    setIsCheckingAiFood(true);
    setAiFoodFeedback(`Analyzing '${query}' with AI Veterinary Safety Radar...`);

    try {
      const res = await dietApi.checkIngredientSafety(query, currentPet?.species || 'dog');
      if (res && res.name) {
        const newCard = {
          name: res.name,
          status: res.status.toLowerCase(), // 'safe' | 'moderate' | 'severe' | 'fatal'
          note: res.note,
          icon: res.icon || '🍽️',
          recommendation: res.recommendation,
          isAiVerified: true
        };
        setAiCheckedFoods(prev => {
          const updated = [newCard, ...prev.filter(x => x.name.toLowerCase() !== newCard.name.toLowerCase())];
          try {
            localStorage.setItem('pawcircle_recent_ai_foods', JSON.stringify(updated));
          } catch {}
          return updated;
        });
        setAiFoodFeedback(`✓ AI verified: '${res.name}' is ${res.status.toUpperCase()}`);
        showToast(`AI Radar: ${res.name} is ${res.status.toUpperCase()}`);
        setFoodSearch(''); // Clear search input so the new item and previous preferences are immediately visible!
        setFoodFilterTab('recent'); // Switch to recent tab to show the new card front and center!
      }
    } catch (err) {
      console.warn('AI ingredient check error:', err);
      setAiFoodFeedback(`Could not verify with AI: ${err.message}`);
    } finally {
      setIsCheckingAiFood(false);
    }
  };


  // Handle Preset Selection: Sets text and immediately generates tailored plan
  const handleSelectPreset = (presetText) => {
    setPromptText(presetText);
    handleGenerate(presetText);
  };

  // AI Generator Handler (AI-ONLY — no predefined/template fallback):
  // Sends the slider weight + activity + prompt to the backend, which asks Gemini to write the plan.
  // Populates both:
  // 1) The in-place AI prompt response card divided into Morning, Evening, and Snacks (optional)
  // 2) The full Diet Plan Form in Section B accordingly
  const handleGenerate = async (customPromptOverride) => {
    const petId = currentPet?.id;
    if (!petId) {
      showToast('Add a pet profile first to generate an AI meal plan.');
      return;
    }

    setIsCalculating(true);
    const effectivePrompt = typeof customPromptOverride === 'string' ? customPromptOverride : promptText;
    const pWeight = weight || 9;

    try {
      const archName = dietType === 'home' ? 'Home-cooked' : dietType === 'raw' ? 'Raw Food' : dietType === 'wet' ? 'Wet Food' : dietType === 'mixed' ? 'Mixed / Topper' : 'Kibble';
      const res = await dietApi.generatePlan({
        petId,
        customPrompt: effectivePrompt,
        dietPreset: archName,
        weightKg: pWeight,
        activityLevel: activity
      });

      const fullPlan = res?.full_plan_json || {};
      if (!res?.id || !fullPlan.morning_meal || !fullPlan.evening_meal) {
        throw new Error('AI did not return a complete meal plan');
      }

      setActivePlanId(res.id);

      const aiPlan = {
        overview: fullPlan.overview || fullPlan.paragraph || '',
        title: fullPlan.current_food || fullPlan.recommended_diet_type || '',
        morningMeal: fullPlan.morning_meal,
        eveningMeal: fullPlan.evening_meal,
        snacks: fullPlan.snacks || '',
        notes: fullPlan.notes || '',
        amountPerDay: fullPlan.amount_per_day || '',
        meals: fullPlan.meals || ''
      };

      // Populate form fields matching reference form
      setPlanForm({
        overview: aiPlan.overview,
        current_food: aiPlan.title,
        amount_per_day: aiPlan.amountPerDay,
        meals: aiPlan.meals,
        morning_meal: aiPlan.morningMeal,
        evening_meal: aiPlan.eveningMeal,
        snacks: aiPlan.snacks,
        notes: aiPlan.notes
      });
      setHasGeneratedPlan(true);

      // Populate in-place AI prompt response in divided format
      setSuggestedPlanAnswer({
        promptUsed: effectivePrompt || `Custom ${dietType} formulation for ${petName}`,
        ...aiPlan,
        dailyKcal: res.target_calories_kcal || targetKcal,
        dailyGrams: Math.round((res.target_calories_kcal || targetKcal) / 3.6),
        dietType: dietType,
        generatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAiPowered: true
      });

      showToast(`✓ AI generated diet plan for ${petName}! Review answer below.`);
    } catch (err) {
      console.warn('AI generate plan error:', err.message);
      showToast(`AI meal plan unavailable: ${err.message}. Please try again.`);
    } finally {
      setIsCalculating(false);
    }
  };

  // Save Plan to Backend Database
  const handleSaveAndApplyToDailyCare = async () => {
    if (!currentPet?.id || isSaving) return;
    setIsSaving(true);

    try {
      // 1. Save manual plan schema to backend
      await dietApi.saveManualPlan({
        pet_id: currentPet.id,
        overview: planForm.overview,
        current_food: planForm.current_food,
        amount_per_day: planForm.amount_per_day || `About ${targetDailyGrams} g of food a day (${targetKcal} kcal)`,
        meals: planForm.meals,
        morning_meal: planForm.morning_meal,
        evening_meal: planForm.evening_meal,
        snacks: planForm.snacks,
        notes: planForm.notes,
        custom_walks: 'Morning 30 min park loop (9:15 AM), Evening 45 min sniff walk (5:30 PM)'
      });

      // 2. If plan ID exists, also adopt it
      if (activePlanId) {
        await dietApi.adoptPlan(activePlanId);
      }

      // 3. Update active plan in DB state to reflect newly saved plan
      setActiveDbPlan({
        is_configured: true,
        overview: planForm.overview,
        current_food: planForm.current_food,
        amount_per_day: planForm.amount_per_day,
        meals: planForm.meals,
        morning_meal: planForm.morning_meal,
        evening_meal: planForm.evening_meal,
        snacks: planForm.snacks,
        notes: planForm.notes
      });
      setIsPlanConfiguredInDb(true);

      // 4. Requirement: Once meal is saved in DB, the form should be empty again!
      setPlanForm({
        overview: '',
        current_food: '',
        amount_per_day: '',
        meals: '',
        morning_meal: '',
        evening_meal: '',
        snacks: '',
        notes: ''
      });
      setHasGeneratedPlan(false);
      setActivePlanId(null);

      showToast(`✓ Meal saved to database! Today's routine updated & form reset.`);
    } catch (err) {
      console.warn('Save plan error:', err);
      showToast(`Could not save plan: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full max-w-[1140px] mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-on-surface text-surface px-5 py-3 rounded-full shadow-lg flex items-center gap-2 text-label-md font-medium animate-bounce">
          <span className="material-symbols-outlined text-[18px] text-primary-container">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* PAGE HEADER - Dynamic with Pet Details from Backend */}
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-headline-lg text-3xl sm:text-4xl font-bold text-on-surface tracking-tight">Diet Lab</h1>
            <p className="font-body-md text-base text-on-surface-variant max-w-2xl mt-1">
              Meal plans built around {petName}'s breed, age, and weight. General guidance, not vet advice.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 bg-surface-container-low px-4 py-2 rounded-full border border-outline-variant/40 shadow-xs">
            <span className="text-xl">🐾</span>
            <span className="font-label-md text-xs sm:text-sm text-on-surface font-semibold">
              {[petName, petBreed, petGender, petAge, `${weight} kg`, petNeutered].filter(Boolean).join(' · ')}
            </span>
          </div>
        </div>
      </header>

      {/* SECTION A: QUICK PLAN & CUSTOM AI PROMPT BUILDER */}
      <section className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 border border-outline-variant/40 shadow-xs relative overflow-hidden">
        {/* Loading Overlay */}
        {isCalculating && (
          <div className="absolute inset-0 bg-surface-container-lowest/95 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-full border-4 border-primary-container border-t-primary animate-spin mb-4"></div>
            <p className="font-headline-sm text-lg font-bold text-on-surface">Generating AI Meal Plan...</p>
            <p className="text-sm text-on-surface-variant mt-1">
              Calibrating RER macro-ratios for {weight} kg {petBreed} ({petName})
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Sub-section: Quick Plan Slider */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-1.5 text-primary font-label-sm text-xs uppercase tracking-wider font-bold mb-1">
                <span className="material-symbols-outlined text-[16px]">bolt</span>
                Instant Bio-Calibration
              </div>
              <h2 className="font-headline-md text-2xl font-bold text-on-surface">Quick plan</h2>
              <p className="font-body-md text-sm text-on-surface-variant mt-1 leading-relaxed">
                Adjust {petName}'s weight and activity to calculate exact daily energy and portion metrics.
              </p>
            </div>

            <div className="flex flex-col gap-4 p-4 bg-surface-container-low rounded-xl border border-outline-variant/30">
              {/* Weight Slider */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-on-surface-variant">{petName}'s Weight:</span>
                  <span className="font-bold text-on-surface text-sm">{weight} kg</span>
                </div>
                <input
                  type="range"
                  min={sliderMin}
                  max={sliderMax}
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  className="w-full accent-primary cursor-pointer"
                />
              </div>

              {/* Activity selector */}
              <div className="flex flex-col gap-1.5">
                <span className="font-medium text-xs text-on-surface-variant">Activity Level:</span>
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  {['low', 'active', 'working'].map(lvl => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setActivity(lvl)}
                      className={`py-1.5 rounded-lg font-semibold capitalize border transition-all cursor-pointer ${
                        activity === lvl
                          ? 'bg-primary-container text-on-surface border-transparent shadow-xs'
                          : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/40 hover:bg-surface-container'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Calculations summary */}
              <div className="pt-2 border-t border-outline-variant/30 flex flex-col gap-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Target Energy:</span>
                  <span className="font-bold text-on-surface">{targetKcal} kcal / day</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Daily Schedule:</span>
                  <span className="font-bold text-on-surface">2 Portions (Morning / Evening)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Allergen Safety:</span>
                  <span className="text-tertiary font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">verified</span>
                    {petAllergies ? `${petAllergies} Free` : 'No known allergies'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              className="w-full h-12 rounded-full bg-primary-container text-on-surface font-label-lg text-sm font-bold hover:bg-primary-fixed-dim transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">auto_fix_high</span>
              <span>Recalibrate &amp; Generate Plan</span>
            </button>
          </div>

          {/* Divider */}
          <div className="hidden lg:flex lg:col-span-1 items-center justify-center relative">
            <div className="w-px h-full bg-outline-variant/40"></div>
            <div className="absolute bg-surface-container-lowest px-2 py-1 rounded-full text-xs font-bold text-on-surface-variant uppercase tracking-wider border border-outline-variant/30">
              or
            </div>
          </div>

          {/* Right Sub-section: Paw AI Prompt Studio */}
          <div className="lg:col-span-6 flex flex-col justify-between gap-4">
            <div>
              <label className="font-headline-sm text-xl font-bold text-on-surface block" htmlFor="ai-diet-prompt">
                Tell Paw AI what you want
              </label>
              <p className="font-body-sm text-xs text-on-surface-variant mt-0.5">
                Specify protein restrictions, energy surges, toppers, or digestive preferences for {petName}.
              </p>
            </div>

            <textarea
              id="ai-diet-prompt"
              rows="3"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder={`e.g. Grain-free formula for ${petName} with pumpkin topper for sensitive digestion...`}
              className="w-full p-4 rounded-xl bg-surface-container-low text-on-surface font-body-md text-sm placeholder:text-outline/70 focus:outline-none focus:ring-2 focus:ring-primary-container border border-outline-variant/30 transition-all resize-none"
            />

            {/* Diet Architecture Pills */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Diet Architecture</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'kibble', label: 'Kibble' },
                  { id: 'raw', label: 'Raw' },
                  { id: 'home', label: 'Home-cooked' },
                  { id: 'wet', label: 'Wet Food' },
                  { id: 'mixed', label: 'Mixed / Topper' }
                ].map(type => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setDietType(type.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                      dietType === type.id
                        ? 'bg-primary-container text-on-surface shadow-xs'
                        : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Suggested Presets */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Suggested Presets</span>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSelectPreset(`Allergic to poultry. Recommend lamb or salmon kibble with omega-3 oils for ${petName}.`)}
                  className="text-left p-2.5 rounded-xl bg-surface text-on-surface-variant hover:text-on-surface hover:bg-surface-container text-xs transition-all border border-outline-variant/30 cursor-pointer flex items-center justify-between group shadow-2xs"
                >
                  <span className="font-medium">🐟 "Allergic to poultry. Recommend lamb or salmon kibble with omega-3 oils."</span>
                  <span className="text-[11px] text-[#FF6B4A] font-extrabold flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                    <span>Generate</span>
                    <span className="material-symbols-outlined text-[13px]">auto_awesome</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPreset(`Weight management: Needs high-fiber pumpkin to stay satiated and maintain healthy weight for ${petName}.`)}
                  className="text-left p-2.5 rounded-xl bg-surface text-on-surface-variant hover:text-on-surface hover:bg-surface-container text-xs transition-all border border-outline-variant/30 cursor-pointer flex items-center justify-between group shadow-2xs"
                >
                  <span className="font-medium">⚖️ "Weight management: Needs high-fiber pumpkin to stay satiated."</span>
                  <span className="text-[11px] text-[#FF6B4A] font-extrabold flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                    <span>Generate</span>
                    <span className="material-symbols-outlined text-[13px]">auto_awesome</span>
                  </span>
                </button>
              </div>
            </div>

            <button
              onClick={() => handleGenerate()}
              className="h-12 px-6 rounded-full bg-primary-container text-on-surface font-label-lg text-sm font-bold hover:bg-primary-fixed-dim transition-all inline-flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <span>Build with Paw AI</span>
              <span className="material-symbols-outlined text-[18px]">bolt</span>
            </button>
          </div>
        </div>

        {/* AI SUGGESTED PLAN ANSWER: full-width BELOW both boxes so it doesn't stretch the left column */}
              {/* AI SUGGESTED PLAN / PROMPT ANSWER (IN PARAGRAPH FORMAT) */}
              {suggestedPlanAnswer && (
                <div className="mt-8 p-5 sm:p-6 rounded-2xl bg-[#FFF9F6] border-2 border-[#FF6B4A]/50 shadow-sm flex flex-col gap-3.5 transition-all animate-fadeIn">
                  {/* Header */}
                  <div className="flex items-center justify-between gap-2 border-b border-[#FF6B4A]/20 pb-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[20px] text-[#FF6B4A] animate-pulse">auto_awesome</span>
                      <span className="text-xs font-black uppercase tracking-wider text-[#FF6B4A]">
                        Suggested Plan Answer
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-on-surface-variant bg-white px-2.5 py-0.5 rounded-full border border-outline-variant/30 shadow-2xs">
                      {petName} · {weight} kg · {petBreed}
                    </span>
                  </div>

                  {/* Prompt query chip */}
                  {suggestedPlanAnswer.promptUsed && (
                    <div className="bg-white/95 rounded-xl p-2.5 border border-outline-variant/30 text-xs text-on-surface-variant italic flex items-start gap-2 shadow-2xs">
                      <span className="text-xs shrink-0">💬</span>
                      <span className="font-medium text-on-surface">"{suggestedPlanAnswer.promptUsed}"</span>
                    </div>
                  )}

                  {/* Formula / Diet Title */}
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF6B4A]">Recommended Formula</span>
                    <h3 className="font-headline-sm text-base sm:text-lg font-black text-on-surface mt-0.5">
                      {suggestedPlanAnswer.title}
                    </h3>
                  </div>

                  {/* Compact Overview */}
                  {suggestedPlanAnswer.overview && (
                    <div className="bg-white/95 p-3.5 rounded-xl border border-outline-variant/30 shadow-2xs">
                      <p className="font-body-md text-xs sm:text-sm text-on-surface leading-relaxed font-medium">
                        {suggestedPlanAnswer.overview}
                      </p>
                    </div>
                  )}

                  {/* Divided Meals Section: Morning, Evening, and Snacks (optional) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {/* Morning Meal */}
                    <div className="bg-white/95 p-3.5 rounded-xl border border-[#FF6B4A]/30 shadow-2xs flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-[#FF6B4A] flex items-center gap-1.5">
                          <span>🌅</span>
                          <span>Morning Meal</span>
                        </span>
                        <span className="text-[10px] font-bold text-on-surface-variant bg-[#FFF4EE] px-2.5 py-0.5 rounded-md border border-[#FF6B4A]/20">
                          Breakfast · 8:30 AM
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-on-surface font-semibold leading-relaxed">
                        {suggestedPlanAnswer.morningMeal || 'Balanced morning portion with protein and base'}
                      </p>
                    </div>

                    {/* Evening Meal */}
                    <div className="bg-white/95 p-3.5 rounded-xl border border-[#FF6B4A]/30 shadow-2xs flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-[#FF6B4A] flex items-center gap-1.5">
                          <span>🌇</span>
                          <span>Evening Meal</span>
                        </span>
                        <span className="text-[10px] font-bold text-on-surface-variant bg-[#FFF4EE] px-2.5 py-0.5 rounded-md border border-[#FF6B4A]/20">
                          Dinner · 7:30 PM
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-on-surface font-semibold leading-relaxed">
                        {suggestedPlanAnswer.eveningMeal || 'Balanced evening portion with nutrition booster'}
                      </p>
                    </div>

                    {/* Snacks (Optional) */}
                    {suggestedPlanAnswer.snacks && (
                      <div className="bg-[#FAF7F2] p-3 rounded-xl border border-dashed border-outline-variant/60 shadow-2xs flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                            <span>🦴</span>
                            <span>Snacks &amp; Treats (Optional)</span>
                          </span>
                          <span className="text-[10px] font-bold text-outline bg-white px-2 py-0.5 rounded-md border border-outline-variant/30">
                            &lt; 10% daily intake
                          </span>
                        </div>
                        <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
                          {suggestedPlanAnswer.snacks}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Quick Summary Pill Bar */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="bg-white px-3 py-1.5 rounded-lg border border-outline-variant/30 font-bold text-on-surface flex items-center gap-1.5 shadow-2xs">
                      <span>🥣</span>
                      <span>{suggestedPlanAnswer.amountPerDay}</span>
                    </span>
                    <span className="bg-white px-3 py-1.5 rounded-lg border border-outline-variant/30 font-bold text-on-surface flex items-center gap-1.5 shadow-2xs">
                      <span>⏱️</span>
                      <span>{suggestedPlanAnswer.meals}</span>
                    </span>
                    <span className="bg-white px-3 py-1.5 rounded-lg border border-outline-variant/30 font-bold text-[#FF6B4A] flex items-center gap-1.5 shadow-2xs">
                      <span>⚡</span>
                      <span>{suggestedPlanAnswer.dailyKcal} kcal/day</span>
                    </span>
                  </div>

                  {/* Clinical Feeding Notes */}
                  {suggestedPlanAnswer.notes && (
                    <div className="bg-white/95 p-3 rounded-xl border border-outline-variant/30 flex flex-col gap-1 shadow-2xs">
                      <span className="text-[10px] uppercase font-extrabold text-[#FF6B4A] flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">verified</span>
                        Clinical Feeding Notes
                      </span>
                      <p className="text-xs text-on-surface-variant font-medium whitespace-pre-line leading-relaxed">
                        {suggestedPlanAnswer.notes}
                      </p>
                    </div>
                  )}

                  {/* Quick Navigation to Full Form (NO SAVE TO DB BUTTON HERE) */}
                  <div className="pt-1 border-t border-black/5">
                    <button
                      type="button"
                      onClick={() => {
                        document.getElementById('diet-plan-form-section')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="w-full py-2.5 px-4 rounded-full bg-[#FF6B4A] text-white hover:bg-[#e05637] font-extrabold text-xs transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>View in Diet Plan Form Below</span>
                      <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
                    </button>
                  </div>
                </div>
              )}
      </section>

      {/* Active Diet Plan in Database Card */}
      {isPlanConfiguredInDb && activeDbPlan && (
        <div className="p-5 rounded-2xl bg-[#F0FDF4] border-2 border-[#16A34A]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-[#16A34A] text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
              <span className="material-symbols-outlined text-[22px]">verified</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-[#16A34A]">Diet plan logged in</span>
                <span className="text-[11px] font-bold text-on-surface-variant bg-white px-2.5 py-0.5 rounded-full border border-black/10">
                  Live in Daily Care
                </span>
              </div>
              <p className="text-sm font-extrabold text-on-surface mt-1">
                {activeDbPlan.current_food || 'Custom Nutritional Diet Plan'}
                {activeDbPlan.amount_per_day && (
                  <span className="font-medium text-on-surface-variant"> · {activeDbPlan.amount_per_day}</span>
                )}
              </p>
              {activeDbPlan.meals && (
                <p className="text-xs text-on-surface-variant mt-0.5 font-medium">
                  {activeDbPlan.meals}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setPlanForm({
                  overview: activeDbPlan.overview || `A balanced daily feeding guide for ${petName}, measured by weight.`,
                  current_food: activeDbPlan.current_food || '',
                  amount_per_day: activeDbPlan.amount_per_day || '',
                  meals: activeDbPlan.meals || '',
                  morning_meal: activeDbPlan.morning_meal || '',
                  evening_meal: activeDbPlan.evening_meal || '',
                  snacks: activeDbPlan.snacks || '',
                  notes: activeDbPlan.notes || ''
                });
                setHasGeneratedPlan(true);
                showToast('Loaded active plan into form for editing.');
              }}
              className="px-4 py-2 rounded-full bg-white text-on-surface font-extrabold text-xs border border-black/20 hover:bg-surface-container transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]">edit_note</span>
              <span>Load into Form to Edit</span>
            </button>
            {setActiveTab && (
              <button
                type="button"
                onClick={() => setActiveTab('daily-care')}
                className="px-4 py-2 rounded-full bg-[#16A34A] text-white font-extrabold text-xs hover:bg-[#15803D] transition-all flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <span>Go to Daily Care</span>
                <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION B: DIET PLAN FORM (MATCHING SCREENSHOT 4 FORMAT)                   */}
      {/* Fills ONLY AFTER generating with AI, or if explicitly loaded by user      */}
      {/* ========================================================================= */}
      <section id="diet-plan-form-section" className="bg-white rounded-2xl p-6 sm:p-8 border-2 border-black/80 shadow-xs flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/10 pb-4">
          <div>
            <h2 className="font-headline-md text-2xl sm:text-3xl font-extrabold text-on-surface">
              Diet plan
            </h2>
            <p className="font-body-md text-xs sm:text-sm text-on-surface-variant mt-0.5">
              Daily feeding guide for {petName} in standard form format.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {hasGeneratedPlan && (
              <button
                type="button"
                onClick={() => {
                  setPlanForm({
                    overview: '',
                    current_food: '',
                    amount_per_day: '',
                    meals: '',
                    morning_meal: '',
                    evening_meal: '',
                    snacks: '',
                    notes: ''
                  });
                  setHasGeneratedPlan(false);
                  setActivePlanId(null);
                  showToast('Form cleared.');
                }}
                className="px-4 py-3 rounded-full bg-white text-on-surface font-extrabold text-xs sm:text-sm border-2 border-black/30 hover:bg-surface-container transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">clear</span>
                <span>Clear</span>
              </button>
            )}
            <button
              onClick={handleSaveAndApplyToDailyCare}
              disabled={isSaving || (!hasGeneratedPlan && !planForm.current_food)}
              className={`px-6 py-3 rounded-full font-extrabold text-xs sm:text-sm transition-all shadow-xs flex items-center gap-2 ${
                !hasGeneratedPlan && !planForm.current_food
                  ? 'bg-surface-container text-outline cursor-not-allowed border border-outline-variant/40'
                  : 'bg-[#FF6B4A] hover:bg-[#F25532] text-on-surface cursor-pointer'
              }`}
            >
              {isSaving ? (
                <>
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-black border-t-transparent animate-spin"></span>
                  <span>Saving plan...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">cloud_done</span>
                  <span>Save plan</span>
                </>
              )}
            </button>
            {setActiveTab && (
              <button
                onClick={() => setActiveTab('daily-care')}
                className="px-5 py-3 rounded-full bg-white text-on-surface font-extrabold text-xs sm:text-sm border-2 border-black hover:bg-surface-container transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <span>Go to Daily Care</span>
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            )}
          </div>
        </div>

        {/* Info callout when form is not yet generated */}
        {!hasGeneratedPlan && (
          <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-primary text-[22px]">info</span>
              <span className="text-xs sm:text-sm text-on-surface font-medium">
                Diet plan at your fingertips
              </span>
            </div>
            <button
              onClick={handleGenerate}
              className="px-4 py-2 rounded-full text-xs font-bold bg-primary-container text-on-surface hover:bg-primary-fixed-dim transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">bolt</span>
              <span>Generate Now</span>
            </button>
          </div>
        )}

        {/* 5 Form Fields in exact visual match to Screenshot 4 */}
        <div className="grid grid-cols-1 gap-5">
          {/* Overview (optional) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs sm:text-sm font-bold text-on-surface">Overview (optional)</label>
            <AutoGrowTextarea
              value={planForm.overview}
              onChange={(e) => setPlanForm({ ...planForm, overview: e.target.value })}
              placeholder={`A line about ${petName}'s feeding, e.g. Measured by weight, twice a day.`}
              className="w-full min-h-12 px-4 py-3 rounded-2xl bg-[#FCFAF6] border-2 border-black/80 text-sm text-on-surface placeholder:text-outline/70 focus:outline-none focus:ring-1 focus:ring-black transition-all shadow-xs"
            />
          </div>

          {/* Current food */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs sm:text-sm font-bold text-on-surface">Current food</label>
            <AutoGrowTextarea
              value={planForm.current_food}
              onChange={(e) => setPlanForm({ ...planForm, current_food: e.target.value })}
              placeholder="e.g. Acme Adult Chicken (dry)"
              className="w-full min-h-12 px-4 py-3 rounded-2xl bg-[#FCFAF6] border-2 border-black/80 text-sm text-on-surface placeholder:text-outline/70 focus:outline-none focus:ring-1 focus:ring-black transition-all shadow-xs font-semibold"
            />
          </div>

          {/* Amount per day */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs sm:text-sm font-bold text-on-surface">Amount per day</label>
            <AutoGrowTextarea
              value={planForm.amount_per_day}
              onChange={(e) => setPlanForm({ ...planForm, amount_per_day: e.target.value })}
              placeholder="e.g. About 240 g of dry food a day"
              className="w-full min-h-12 px-4 py-3 rounded-2xl bg-[#FCFAF6] border-2 border-black/80 text-sm text-on-surface placeholder:text-outline/70 focus:outline-none focus:ring-1 focus:ring-black transition-all shadow-xs font-semibold"
            />
          </div>

          {/* Meals */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs sm:text-sm font-bold text-on-surface">Meals</label>
            <AutoGrowTextarea
              value={planForm.meals}
              onChange={(e) => setPlanForm({ ...planForm, meals: e.target.value })}
              placeholder="e.g. 2 meals, morning and evening"
              className="w-full min-h-12 px-4 py-3 rounded-2xl bg-[#FCFAF6] border-2 border-black/80 text-sm text-on-surface placeholder:text-outline/70 focus:outline-none focus:ring-1 focus:ring-black transition-all shadow-xs"
            />
          </div>

          {/* Morning meal */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm font-bold text-on-surface flex items-center gap-1.5">
                <span>🌅</span>
                <span>Morning meal</span>
              </label>
              <span className="text-[11px] font-medium text-on-surface-variant">e.g. 8:30 AM breakfast portion</span>
            </div>
            <AutoGrowTextarea
              value={planForm.morning_meal}
              onChange={(e) => setPlanForm({ ...planForm, morning_meal: e.target.value })}
              placeholder="e.g. ~111 g: Chicken, kibble base, steamed carrots, omega drops"
              className="w-full min-h-12 px-4 py-3 rounded-2xl bg-[#FCFAF6] border-2 border-black/80 text-sm text-on-surface placeholder:text-outline/70 focus:outline-none focus:ring-1 focus:ring-black transition-all shadow-xs"
            />
          </div>

          {/* Evening meal */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm font-bold text-on-surface flex items-center gap-1.5">
                <span>🌇</span>
                <span>Evening meal</span>
              </label>
              <span className="text-[11px] font-medium text-on-surface-variant">e.g. 7:30 PM dinner portion</span>
            </div>
            <AutoGrowTextarea
              value={planForm.evening_meal}
              onChange={(e) => setPlanForm({ ...planForm, evening_meal: e.target.value })}
              placeholder="e.g. ~111 g: Chicken, kibble base, pumpkin purée, multivitamin topper"
              className="w-full min-h-12 px-4 py-3 rounded-2xl bg-[#FCFAF6] border-2 border-black/80 text-sm text-on-surface placeholder:text-outline/70 focus:outline-none focus:ring-1 focus:ring-black transition-all shadow-xs"
            />
          </div>

          {/* Snacks (optional) */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm font-bold text-on-surface flex items-center gap-1.5">
                <span>🦴</span>
                <span>Snacks (optional)</span>
              </label>
              <span className="text-[11px] font-medium text-outline">Optional · &lt; 10% daily calories</span>
            </div>
            <AutoGrowTextarea
              value={planForm.snacks}
              onChange={(e) => setPlanForm({ ...planForm, snacks: e.target.value })}
              placeholder="e.g. Crunchy baby carrots or banana bites (< 20 kcal)"
              className="w-full min-h-12 px-4 py-3 rounded-2xl bg-[#FCFAF6] border-2 border-black/80 text-sm text-on-surface placeholder:text-outline/70 focus:outline-none focus:ring-1 focus:ring-black transition-all shadow-xs"
            />
          </div>

          {/* Notes (optional, one per line) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs sm:text-sm font-bold text-on-surface">Notes (optional, one per line)</label>
            <AutoGrowTextarea
              minRows={3}
              value={planForm.notes}
              onChange={(e) => setPlanForm({ ...planForm, notes: e.target.value })}
              placeholder="Weigh portions with a scale&#10;Keep treats under 10% of the day's food"
              className="w-full p-4 rounded-2xl bg-[#FCFAF6] border-2 border-black/80 text-sm text-on-surface placeholder:text-outline/70 focus:outline-none focus:ring-1 focus:ring-black transition-all shadow-xs font-mono text-xs sm:text-sm"
            />
          </div>

          {/* Remind Me in Google Calendar Trigger (beneath Notes) */}
          <div className="mt-2 p-5 rounded-2xl bg-[#FCFAF6] border-2 border-black/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 transition-all hover:border-black">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white border border-black/15 flex items-center justify-center shadow-xs shrink-0">
                <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="4" width="18" height="18" rx="4" fill="#4285F4"/>
                  <rect x="3" y="4" width="18" height="5" rx="2" fill="#1A73E8"/>
                  <rect x="7" y="2" width="2" height="4" rx="1" fill="#EA4335"/>
                  <rect x="15" y="2" width="2" height="4" rx="1" fill="#EA4335"/>
                  <text x="12" y="17" fill="white" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">31</text>
                </svg>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-black text-on-surface tracking-tight">Google Calendar Reminders</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#E8F0FE] text-[#1A73E8] border border-[#1A73E8]/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1A73E8] animate-pulse"></span>
                    30-Day Default (Customizable)
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                  Automatically schedules recurring <strong>Breakfast ({calendarMorningTime || '8:30 AM'})</strong> &amp; <strong>Dinner ({calendarEveningTime || '7:30 PM'})</strong> alarms to your Google Calendar for 30 days (or select custom duration) with 10-minute advance notifications.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenCalendarModal}
              className="px-6 py-3.5 rounded-full bg-[#1A73E8] hover:bg-[#1557b0] text-white font-black text-xs sm:text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2.5 shrink-0 cursor-pointer group active:scale-95"
            >
              <span className="material-symbols-outlined text-[20px] text-white group-hover:scale-110 transition-transform">
                alarm_on
              </span>
              <span>Remind me</span>
              <span className="material-symbols-outlined text-[16px] opacity-80 group-hover:translate-x-0.5 transition-transform">
                arrow_forward
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* SECTION C: SAFETY & HYDRATION GUIDELINES */}
      <section className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Feeding Guidelines & Safety Warning */}
        <div className="md:col-span-6 bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/40 shadow-xs flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-secondary">
              <span className="material-symbols-outlined text-[22px]">warning</span>
              <h4 className="font-headline-sm text-base font-bold text-on-surface">
                {petBreed} Digestive Safety
              </h4>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              For breeds like {petBreed}, active digestion requires consistent rest periods.
              <strong> Never exercise or play fetch within 45 minutes before or after a full meal.</strong>
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-tertiary-container/30 border border-tertiary-container/50 flex items-start gap-3">
            <span className="material-symbols-outlined text-tertiary text-[20px] shrink-0 mt-0.5">verified</span>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-on-surface">Allergen Safety Guard</span>
              <span className="text-xs text-on-surface-variant">
                {petAllergies
                  ? `Active allergen restrictions: ${petAllergies}. All recipes exclude these ingredients.`
                  : `No clinical food allergies registered for ${petName}.`}
              </span>
            </div>
          </div>
        </div>

        {/* Hydration & Schedule */}
        <div className="md:col-span-6 bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/40 shadow-xs flex flex-col justify-between gap-4">
          <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 flex items-start gap-3">
            <span className="material-symbols-outlined text-primary text-[24px] shrink-0 mt-0.5">water_drop</span>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-bold text-on-surface">Daily Hydration Target</span>
              <span className="text-xs text-on-surface-variant">
                {((weight * 58) / 1000).toFixed(1)} Liters of fresh water (~58 ml per kg of body weight for a {weight} kg dog).
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 flex items-start gap-3">
            <span className="material-symbols-outlined text-secondary text-[24px] shrink-0 mt-0.5">schedule</span>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-bold text-on-surface">Daily Care Synchronized</span>
              <span className="text-xs text-on-surface-variant">
                Saving plan automatically synchronizes your Daily Care routine checklist and Up Next card.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION D: NEVER FEED / TOXIC FOOD SEARCH RADAR (AI POWERED) */}
      <section className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 border border-outline-variant/40 shadow-xs flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-secondary"></span>
              <h3 className="font-headline-lg text-2xl font-bold text-on-surface">Toxic Food Safety Radar</h3>
            </div>
            <p className="text-sm text-on-surface-variant mt-0.5">
              Instant check before giving {petName} table scraps or pantry treats. Powered by AI toxicology analysis.
            </p>
          </div>

          {/* Search box with AI Trigger & Instant Clear */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCheckIngredientAi(foodSearch);
            }}
            className="flex items-center gap-2 w-full sm:w-auto"
          >
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                value={foodSearch}
                onChange={(e) => setFoodSearch(e.target.value)}
                placeholder="Search or ask AI (e.g. roti, paneer, dal, samosa)..."
                className="w-full h-11 pl-10 pr-9 rounded-full bg-surface-container-low border border-outline-variant/40 text-xs font-body-md focus:outline-none focus:border-on-surface"
              />
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-outline">search</span>
              {foodSearch && (
                <button
                  type="button"
                  onClick={() => setFoodSearch('')}
                  title="Clear search"
                  className="absolute right-3 top-3 w-5 h-5 rounded-full hover:bg-black/10 flex items-center justify-center text-outline hover:text-on-surface transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isCheckingAiFood || !foodSearch.trim()}
              className="h-11 px-4 rounded-full bg-primary-container text-on-surface font-bold text-xs hover:bg-primary-fixed-dim transition-all flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
              title="Evaluate ingredient with AI"
            >
              {isCheckingAiFood ? (
                <span className="w-3.5 h-3.5 rounded-full border-2 border-black border-t-transparent animate-spin"></span>
              ) : (
                <span className="material-symbols-outlined text-[16px]">smart_toy</span>
              )}
              <span>Ask AI</span>
            </button>
          </form>
        </div>

        {/* Live AI Status / Feedback alert */}
        {aiFoodFeedback && (
          <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/30 flex items-center justify-between text-xs animate-fadeIn">
            <span className="text-on-surface font-medium flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">psychology</span>
              {aiFoodFeedback}
            </span>
            <button
              type="button"
              onClick={() => setAiFoodFeedback(null)}
              className="text-outline hover:text-on-surface text-xs font-bold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Category Tabs: All | Recently Asked | Prewritten */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/30 pb-3">
          <div className="flex items-center gap-1.5 p-1 rounded-full bg-surface-container-low border border-outline-variant/30 text-xs">
            <button
              type="button"
              onClick={() => setFoodFilterTab('all')}
              className={`px-3.5 py-1.5 rounded-full font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                foodFilterTab === 'all'
                  ? 'bg-primary-container text-on-surface shadow-2xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span>All Items</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 font-mono">
                {allFoods.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFoodFilterTab('recent')}
              className={`px-3.5 py-1.5 rounded-full font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                foodFilterTab === 'recent'
                  ? 'bg-primary-container text-on-surface shadow-2xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[14px] text-secondary">auto_awesome</span>
              <span>Recently Asked</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 font-mono">
                {aiCheckedFoods.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFoodFilterTab('prewritten')}
              className={`px-3.5 py-1.5 rounded-full font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                foodFilterTab === 'prewritten'
                  ? 'bg-primary-container text-on-surface shadow-2xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">menu_book</span>
              <span>Prewritten Reference</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 font-mono">
                {toxicFoods.length}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {trimmedSearch && (
              <button
                type="button"
                onClick={() => setFoodSearch('')}
                className="text-[11px] text-secondary hover:underline flex items-center gap-1 cursor-pointer font-bold"
              >
                <span>Clear filter '{foodSearch}'</span>
                <span className="material-symbols-outlined text-[13px]">close</span>
              </button>
            )}
            {aiCheckedFoods.length > 0 && (foodFilterTab === 'recent' || foodFilterTab === 'all') && (
              <button
                type="button"
                onClick={handleClearAllRecent}
                className="text-[11px] text-outline hover:text-error transition-colors flex items-center gap-1 cursor-pointer font-medium"
              >
                <span className="material-symbols-outlined text-[14px]">delete_sweep</span>
                <span>Clear Recent History</span>
              </button>
            )}
          </div>
        </div>

        {/* If user searched for a novel ingredient that has NO matches in current cards, show prompt banner while KEEPING all cards visible! */}
        {trimmedSearch && !hasSearchMatches && (
          <div className="p-4 rounded-2xl bg-primary-container/20 border border-primary/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-2xl shrink-0">search_check</span>
              <div className="flex flex-col">
                <span className="text-xs sm:text-sm font-bold text-on-surface">
                  '{foodSearch}' is not in your current list
                </span>
                <span className="text-[11px] text-on-surface-variant">
                  Click 'Ask AI' to analyze clinical canine toxicity for {petName}. Your previous searched & predefined foods are shown below.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleCheckIngredientAi(foodSearch)}
              disabled={isCheckingAiFood}
              className="h-9 px-4 rounded-full bg-primary-container text-on-surface font-bold text-xs hover:bg-primary-fixed-dim transition-all shadow-xs flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
            >
              {isCheckingAiFood ? (
                <span className="w-3.5 h-3.5 rounded-full border-2 border-black border-t-transparent animate-spin"></span>
              ) : (
                <span className="material-symbols-outlined text-[16px]">smart_toy</span>
              )}
              <span>Ask AI about '{foodSearch}'</span>
            </button>
          </div>
        )}

        {/* If user search matched existing cards */}
        {trimmedSearch && hasSearchMatches && (
          <div className="flex items-center justify-between text-xs text-on-surface-variant px-1">
            <span>
              Showing matches for "<strong>{foodSearch}</strong>" ({matchedRecent.length + matchedPrewritten.length} found)
            </span>
            <button
              type="button"
              onClick={() => setFoodSearch('')}
              className="text-secondary font-bold hover:underline cursor-pointer"
            >
              Show all items
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* REUSABLE CARD RENDERER (ALL BOXES GUARANTEED IDENTICAL HEIGHT: h-[148px])  */}
        {/* ========================================================================= */}
        {(() => {
          const renderCard = (item, isRecent = false) => {
            const isFatal = item.status === 'fatal';
            const isSevere = item.status === 'severe';
            const isModerate = item.status === 'moderate';
            const isSafe = item.status === 'safe';

            const badgeBg = isFatal
              ? 'bg-error text-white'
              : isSevere
              ? 'bg-[#B00020] text-white'
              : isModerate
              ? 'bg-[#E65100] text-white'
              : 'bg-[#107C41] text-white';

            const cardBorder = isFatal
              ? 'bg-error-container/20 border-error/40 hover:border-error'
              : isSevere
              ? 'bg-[#B00020]/10 border-[#B00020]/40 hover:border-[#B00020]'
              : isModerate
              ? 'bg-[#E65100]/10 border-[#E65100]/40 hover:border-[#E65100]'
              : 'bg-tertiary-container/20 border-tertiary-container/40 hover:border-tertiary-container';

            return (
              <div
                key={item.name}
                className={`h-[148px] min-h-[148px] max-h-[148px] p-3.5 rounded-2xl border flex flex-col justify-between transition-all duration-200 hover:shadow-xs relative group ${cardBorder}`}
              >
                {/* Card Top: Icon, Name, Category & Status Badge */}
                <div className="flex items-start justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-2xl shrink-0 select-none">{item.icon}</span>
                    <div className="flex flex-col min-w-0">
                      <span className="font-headline-sm text-sm font-bold text-on-surface truncate" title={item.name}>
                        {item.name}
                      </span>
                      <span className="text-[10px] font-semibold flex items-center gap-0.5 text-outline truncate">
                        {isRecent ? (
                          <span className="text-secondary font-bold flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[11px]">auto_awesome</span>
                            Recently Asked
                          </span>
                        ) : (
                          <span className="text-on-surface-variant/80">Prewritten</span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full shrink-0 shadow-2xs ${badgeBg}`}>
                      {item.status}
                    </span>
                    {isRecent && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveRecentFood(item.name);
                        }}
                        title="Remove from recently asked"
                        className="w-5 h-5 rounded-full hover:bg-black/10 flex items-center justify-center text-outline hover:text-on-surface opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[13px]">close</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Card Middle: Clinical Toxicology Note (Centered without gaps) */}
                <div className="flex-1 flex items-center my-1 overflow-hidden">
                  <p className="text-xs text-on-surface-variant leading-relaxed line-clamp-2">
                    {item.note}
                  </p>
                </div>

                {/* Card Footer: Clinical Tip / Action Guideline */}
                <div className="pt-1.5 border-t border-black/5 flex items-center justify-between text-[10px] text-outline shrink-0">
                  {item.recommendation ? (
                    <span className="truncate font-medium text-on-surface-variant" title={item.recommendation}>
                      💡 {item.recommendation}
                    </span>
                  ) : (
                    <span className="truncate font-medium">
                      {isFatal ? '🚨 Immediate veterinary emergency' :
                       isSevere ? '⚠️ Urgent toxicity danger' :
                       isModerate ? '⚡ Potential digestive upset' :
                       '✓ Safe canine dietary choice'}
                    </span>
                  )}
                </div>
              </div>
            );
          };

          return (
            <div className="flex flex-col gap-6">
              {/* TAB VIEW 1: ALL (Divided neatly into Recently Asked and Prewritten) */}
              {foodFilterTab === 'all' && (
                <>
                  {/* SECTION 1: Recently Asked */}
                  {displayedRecent.length > 0 && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-secondary"></span>
                          <h4 className="font-headline-sm text-sm sm:text-base font-bold text-on-surface">
                            Recently Asked ({displayedRecent.length})
                          </h4>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/15 text-secondary font-bold">
                            AI Evaluated
                          </span>
                        </div>
                        <span className="text-xs text-on-surface-variant hidden sm:inline">
                          Custom items analyzed by veterinary AI
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {displayedRecent.map(item => renderCard(item, true))}
                      </div>
                    </div>
                  )}

                  {/* SECTION 2: Prewritten Reference Foods */}
                  {displayedPrewritten.length > 0 && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
                          <h4 className="font-headline-sm text-sm sm:text-base font-bold text-on-surface">
                            Prewritten Reference ({displayedPrewritten.length})
                          </h4>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary-container/60 text-on-surface font-bold">
                            Clinical Standard
                          </span>
                        </div>
                        <span className="text-xs text-on-surface-variant hidden sm:inline">
                          Top 10 canine toxicology guidelines
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {displayedPrewritten.map(item => renderCard(item, false))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* TAB VIEW 2: ONLY RECENTLY ASKED */}
              {foodFilterTab === 'recent' && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-secondary"></span>
                      <h4 className="font-headline-sm text-sm sm:text-base font-bold text-on-surface">
                        Recently Asked Foods ({displayedRecent.length})
                      </h4>
                    </div>
                    <span className="text-xs text-on-surface-variant">
                      Custom ingredients analyzed for {petName}
                    </span>
                  </div>

                  {displayedRecent.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {displayedRecent.map(item => renderCard(item, true))}
                    </div>
                  ) : (
                    <div className="p-8 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-center flex flex-col items-center gap-2">
                      <span className="material-symbols-outlined text-secondary text-3xl">auto_awesome</span>
                      <h5 className="font-bold text-sm text-on-surface">No recently asked foods yet</h5>
                      <p className="text-xs text-on-surface-variant max-w-sm">
                        Search any ingredient in the search bar above (e.g., mango, almonds, milk) to evaluate it with AI.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB VIEW 3: ONLY PREWRITTEN */}
              {foodFilterTab === 'prewritten' && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
                      <h4 className="font-headline-sm text-sm sm:text-base font-bold text-on-surface">
                        Prewritten Reference Foods ({displayedPrewritten.length})
                      </h4>
                    </div>
                    <span className="text-xs text-on-surface-variant">
                      Veterinary toxicology reference chart
                    </span>
                  </div>

                  {displayedPrewritten.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {displayedPrewritten.map(item => renderCard(item, false))}
                    </div>
                  ) : (
                    <div className="p-8 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-center flex flex-col items-center gap-2">
                      <span className="material-symbols-outlined text-outline text-3xl">search_off</span>
                      <h5 className="font-bold text-sm text-on-surface">No prewritten reference matching '{foodSearch}'</h5>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </section>

      {/* ========================================================================= */}
      {/* GOOGLE CALENDAR SCHEDULING FLOW MODAL                                     */}
      {/* ========================================================================= */}
      {showCalendarModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-2xl bg-white rounded-3xl p-6 sm:p-8 border-2 border-black/80 shadow-2xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-black/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#E8F0FE] border border-[#1A73E8]/30 flex items-center justify-center shadow-xs shrink-0">
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="4" width="18" height="18" rx="4" fill="#4285F4"/>
                    <rect x="3" y="4" width="18" height="5" rx="2" fill="#1A73E8"/>
                    <rect x="7" y="2" width="2" height="4" rx="1" fill="#EA4335"/>
                    <rect x="15" y="2" width="2" height="4" rx="1" fill="#EA4335"/>
                    <text x="12" y="17" fill="white" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">31</text>
                  </svg>
                </div>
                <div>
                  <h3 className="font-headline-sm text-lg sm:text-xl font-black text-on-surface">
                    Schedule in Google Calendar
                  </h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Automated daily recurring feeding alarms for <strong>{petName}</strong> (Default: 30 days)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowCalendarModal(false);
                  setCalendarResult(null);
                }}
                className="w-8 h-8 rounded-full border border-black/20 flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Google OAuth Sync Status Badge */}
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#F0F7FF] border border-[#1A73E8]/25 text-xs flex-wrap">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] animate-pulse"></span>
                <span className="font-bold text-[#1A73E8]">
                  {calendarStatus.connected
                    ? `Google Calendar: ${calendarStatus.connected_email || 'Connected'}`
                    : "Google Calendar Ready"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {calendarStatus.auth_url && (
                  <a
                    href={calendarStatus.auth_url}
                    className="text-[11px] font-bold text-[#1A73E8] hover:underline cursor-pointer"
                  >
                    {calendarStatus.connected ? "Switch / Connect Account" : "Connect Account"}
                  </a>
                )}
                <span className="text-[11px] font-mono text-outline">
                  {Intl.DateTimeFormat().resolvedOptions().timeZone || 'Auto Timezone'}
                </span>
              </div>
            </div>

            {!calendarResult ? (
              <div className="flex flex-col gap-4">
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  HawPulse will create two daily recurring calendar events on your primary Google Calendar with <strong>10-minute advance notifications</strong>. Events repeat for <strong>30 days by default</strong>, and you can customize your preferred duration below.
                </p>

                {/* Duration & Recurrence Selector */}
                <div className="p-4 rounded-2xl bg-[#F9F7F3] border-2 border-black/80 flex flex-col gap-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[20px] text-[#1A73E8]">
                        event_repeat
                      </span>
                      <span className="text-xs font-black uppercase tracking-wider text-on-surface">
                        Schedule Duration (Recurrence)
                      </span>
                    </div>
                    <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#E8F0FE] text-[#1A73E8] border border-[#1A73E8]/30 flex items-center gap-1">
                      <span className="text-[#1A73E8]">★</span>
                      Default: 30 Days
                    </span>
                  </div>

                  {/* Preset Buttons */}
                  <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                    {DURATION_PRESETS.map((preset) => {
                      const isSelected = parseInt(calendarDurationDays, 10) === preset.days;
                      return (
                        <button
                          key={preset.days}
                          type="button"
                          onClick={() => setCalendarDurationDays(preset.days)}
                          className={`py-2 px-1.5 rounded-xl text-center flex flex-col items-center justify-center transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-[#1A73E8] text-white border-[#1A73E8] shadow-sm font-bold scale-[1.02]'
                              : 'bg-white hover:bg-surface-container border-black/20 text-on-surface font-medium hover:border-black/50'
                          }`}
                        >
                          <span className="text-[11px] sm:text-xs font-black leading-tight flex items-center gap-0.5">
                            {preset.label}
                            {preset.isDefault && (
                              <span
                                title="Default (30 Days)"
                                className={`text-[9px] ${isSelected ? 'text-[#FFD700]' : 'text-[#1A73E8]'}`}
                              >
                                ★
                              </span>
                            )}
                          </span>
                          <span className={`text-[9px] sm:text-[10px] mt-0.5 leading-none ${isSelected ? 'text-white/85' : 'text-outline'}`}>
                            {preset.sub}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Duration Stepper & Timeline Date Range Preview */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pt-2 border-t border-black/10 flex-wrap">
                    <div className="flex items-center gap-2 text-xs font-bold text-on-surface shrink-0">
                      <span className="text-[11px] text-outline font-semibold">Custom duration:</span>
                      <div className="flex items-center border-2 border-black/60 rounded-xl overflow-hidden bg-white shadow-2xs">
                        <button
                          type="button"
                          onClick={() => setCalendarDurationDays((prev) => Math.max(1, (parseInt(prev, 10) || 30) - 1))}
                          className="w-7 h-8 flex items-center justify-center hover:bg-surface-container text-on-surface font-black transition-colors cursor-pointer select-none"
                          title="Decrease 1 day"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min="1"
                          max="365"
                          value={calendarDurationDays}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              setCalendarDurationDays('');
                            } else {
                              const num = parseInt(val, 10);
                              if (!isNaN(num)) {
                                setCalendarDurationDays(Math.min(365, Math.max(1, num)));
                              }
                            }
                          }}
                          onBlur={() => {
                            if (!calendarDurationDays || parseInt(calendarDurationDays, 10) < 1) {
                              setCalendarDurationDays(30);
                            }
                          }}
                          className="w-12 h-8 text-center text-xs font-black text-on-surface focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setCalendarDurationDays((prev) => Math.min(365, (parseInt(prev, 10) || 30) + 1))}
                          className="w-7 h-8 flex items-center justify-center hover:bg-surface-container text-on-surface font-black transition-colors cursor-pointer select-none"
                          title="Increase 1 day"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-xs text-outline font-medium">days</span>
                    </div>

                    {/* Timeline Date Range Preview */}
                    <div className="flex items-center gap-1.5 text-[11px] bg-white px-2.5 py-1.5 rounded-xl border border-black/15 font-medium text-on-surface whitespace-nowrap shrink-0">
                      <span className="text-primary font-bold">🗓️</span>
                      <span className="whitespace-nowrap">{getCalendarStartDateStr()}</span>
                      <span className="text-outline">→</span>
                      <strong className="text-on-surface whitespace-nowrap">{getCalendarEndDateStr(calendarDurationDays)}</strong>
                      <span className="text-[10px] text-[#1A73E8] font-bold whitespace-nowrap shrink-0">({calendarDurationDays || 30}&nbsp;days)</span>
                    </div>
                  </div>
                </div>

                {/* Event 1: Morning Meal */}
                <div className="p-4 rounded-2xl bg-[#FCFAF6] border-2 border-black/80 flex flex-col gap-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-[#FF6B4A] flex items-center gap-1.5">
                      <span>🌅</span>
                      <span>Morning Feeding (Breakfast)</span>
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E8F0FE] text-[#1A73E8]">
                      Daily for {calendarDurationDays || 30} days · ⏰ 10m popup alarm
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-3.5 items-start">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-on-surface">Time of Day</label>
                      <input
                        type="time"
                        value={calendarMorningTime}
                        onChange={(e) => setCalendarMorningTime(e.target.value)}
                        className="h-11 px-3.5 rounded-xl bg-white border border-black/40 text-xs font-bold text-on-surface focus:outline-none focus:ring-1 focus:ring-black shadow-2xs"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-on-surface">Portion / Formula</label>
                      <div className="min-h-[44px] py-2.5 px-4 rounded-xl bg-white border border-black/30 text-xs text-on-surface font-medium leading-relaxed break-words whitespace-normal flex items-center shadow-2xs">
                        {planForm.morning_meal || planForm.current_food || 'Balanced morning portion'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Event 2: Evening Meal */}
                <div className="p-4 rounded-2xl bg-[#FCFAF6] border-2 border-black/80 flex flex-col gap-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-[#FF6B4A] flex items-center gap-1.5">
                      <span>🌇</span>
                      <span>Evening Feeding (Dinner)</span>
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E8F0FE] text-[#1A73E8]">
                      Daily for {calendarDurationDays || 30} days · ⏰ 10m popup alarm
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-3.5 items-start">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-on-surface">Time of Day</label>
                      <input
                        type="time"
                        value={calendarEveningTime}
                        onChange={(e) => setCalendarEveningTime(e.target.value)}
                        className="h-11 px-3.5 rounded-xl bg-white border border-black/40 text-xs font-bold text-on-surface focus:outline-none focus:ring-1 focus:ring-black shadow-2xs"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-on-surface">Portion / Formula</label>
                      <div className="min-h-[44px] py-2.5 px-4 rounded-xl bg-white border border-black/30 text-xs text-on-surface font-medium leading-relaxed break-words whitespace-normal flex items-center shadow-2xs">
                        {planForm.evening_meal || planForm.current_food || 'Balanced evening portion'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="pt-2">
                  {!calendarStatus.connected && calendarStatus.auth_url ? (
                    <div className="flex flex-col gap-2.5 w-full">
                      <div className="flex gap-2.5">
                        <a
                          href={calendarStatus.auth_url}
                          className="flex-1 h-12 rounded-full bg-[#1A73E8] hover:bg-[#1557b0] text-white font-black text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <svg className="w-4 h-4 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                            <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                          </svg>
                          <span>Connect Google Account (Auto Sync)</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => setShowCalendarModal(false)}
                          className="px-5 h-12 rounded-full border-2 border-black/60 text-on-surface font-bold text-xs hover:bg-surface-container transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={handleTriggerGoogleCalendar}
                        disabled={isSchedulingCalendar}
                        className="w-full h-10 rounded-full border-2 border-[#1A73E8]/40 hover:border-[#1A73E8] bg-white text-[#1A73E8] font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[18px]">add_link</span>
                        <span>Or Add to My Calendar via 1-Click Link</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2.5">
                      <button
                        type="button"
                        onClick={handleTriggerGoogleCalendar}
                        disabled={isSchedulingCalendar}
                        className="flex-1 h-12 rounded-full bg-[#1A73E8] hover:bg-[#1557b0] text-white font-black text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isSchedulingCalendar ? (
                          <>
                            <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                            <span>Scheduling {calendarDurationDays || 30}-Day Events...</span>
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[20px]">calendar_add_on</span>
                            <span>Schedule {calendarDurationDays || 30}-Day Events in Google Calendar</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCalendarModal(false)}
                        className="px-5 h-12 rounded-full border-2 border-black/60 text-on-surface font-bold text-xs hover:bg-surface-container transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Success confirmation with direct links */
              <div className="flex flex-col gap-4 animate-fadeIn">
                <div className="p-4 rounded-2xl bg-[#E6F4EA] border border-[#137333]/30 flex items-start gap-3">
                  <span className="material-symbols-outlined text-[#137333] text-[28px] shrink-0 mt-0.5">
                    check_circle
                  </span>
                  <div className="flex flex-col">
                    <h4 className="font-headline-sm text-sm sm:text-base font-black text-[#137333]">
                      {calendarResult.mode === 'live_google_calendar' ? 'Events Synced to Google Calendar!' : 'Ready to Save to Your Google Calendar'}
                    </h4>
                    <p className="text-xs text-[#137333]/90 mt-0.5 leading-relaxed">
                      {calendarResult.message}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5">
                  <span className="text-[11px] font-black uppercase tracking-wider text-outline">
                    Created Google Calendar Events
                  </span>
                  {calendarResult.events?.map((ev, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">{idx === 0 ? "🌅" : "🌇"}</span>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-on-surface">{ev.summary}</span>
                          <span className="text-[11px] text-outline font-medium">
                            Daily for {calendarResult.duration_days || calendarDurationDays || 30} days at {ev.time} • 10m advance popup notification
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {ev.web_fallback_link && (
                          <a
                            href={ev.web_fallback_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3.5 py-1.5 rounded-full bg-[#1A73E8] text-white hover:bg-[#1557b0] text-[11px] font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                          >
                            <span className="material-symbols-outlined text-[14px]">event</span>
                            <span>Add to My Calendar (1-Click)</span>
                          </a>
                        )}
                        {ev.html_link && ev.mode === "live_google_calendar" && (
                          <a
                            href={ev.html_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-full bg-white border border-black/30 text-on-surface hover:bg-surface-container text-[11px] font-bold flex items-center gap-1"
                          >
                            <span>Open API Synced Event</span>
                            <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCalendarModal(false);
                      setCalendarResult(null);
                    }}
                    className="w-full h-11 rounded-full bg-on-surface text-surface font-extrabold text-xs sm:text-sm hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

