import React, { useState, useEffect } from 'react';
import {
  diaryApi,
  petsApi,
  dietApi,
  medicalApi,
  weatherApi,
  getStoredActivePet,
  setStoredActivePet,
  getAuthToken,
  authApi,
  getStoredUser,
  calendarApi
} from '../services/api';
import { resolvePetAvatar, hasCustomPetPhoto } from '../utils/petAvatar';
import { formatPetAge } from '../utils/petAge';

const CACHE_PREFIX = 'hawpulse_dailycare_v9_';

function getCachedDailyCare(petId) {
  try {
    const key = CACHE_PREFIX + (petId || 'default');
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCachedDailyCare(petId, data) {
  try {
    const key = CACHE_PREFIX + (petId || 'default');
    const existing = getCachedDailyCare(petId) || {};
    const merged = { ...existing, ...data };
    localStorage.setItem(key, JSON.stringify(merged));
  } catch {}
}

export default function DailyCare({ onOpenSitterPass, setActiveTab }) {
  const initialPet = getStoredActivePet();
  const [currentPet, setCurrentPet] = useState(initialPet);
  const cached = getCachedDailyCare(initialPet?.id);

  const updateCache = (patch) => {
    const pId = currentPet?.id || initialPet?.id;
    setCachedDailyCare(pId, patch);
  };

  const [toastMessage, setToastMessage] = useState(null);
  const [showWalkExtension, setShowWalkExtension] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(!cached);
  const [currentUser, setCurrentUser] = useState(getStoredUser());
  const [liveStreak, setLiveStreak] = useState(typeof cached?.liveStreak === 'number' ? cached.liveStreak : 0);

  const initWeight = Number(initialPet?.weight_kg) || 28.0;
  const initNeutered = Boolean(initialPet?.is_neutered);
  const calculatedBaseline = Math.round(70 * Math.pow(Math.max(1, initWeight), 0.75) * (initNeutered ? 1.6 : 1.8));
  const initRer = Math.round(70 * Math.pow(Math.max(1, initWeight), 0.75));

  const [activeCalories, setActiveCalories] = useState(() => {
    if (cached?.activeCalories && cached.activeCalories >= initRer) {
      return cached.activeCalories;
    }
    return calculatedBaseline;
  });
  const [isUpNextBusy, setIsUpNextBusy] = useState(false);

  // Sub-view router: null (main feed) | 'diet-landing' | 'diet-form' | 'grooming'
  const [activeSubView, setActiveSubView] = useState(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSavingPlan, setIsSavingPlan] = useState(false);

  // Diet & Routine plan form state (matching Screenshots 3 & 4)
  const [planDetail, setPlanDetail] = useState(cached?.planDetail || null);
  const [isPlanLoading, setIsPlanLoading] = useState(!cached?.planDetail);
  const [dietFormData, setDietFormData] = useState(() => {
    if (cached?.planDetail?.is_configured) {
      return {
        overview: cached.planDetail.overview || '',
        current_food: cached.planDetail.current_food || '',
        amount_per_day: cached.planDetail.amount_per_day || '',
        meals: cached.planDetail.meals || '',
        morning_meal: '',
        evening_meal: '',
        snacks: '',
        notes: cached.planDetail.notes || '',
        custom_walks: cached.planDetail.custom_walks || ''
      };
    }
    return {
      overview: '',
      current_food: '',
      amount_per_day: '',
      meals: '',
      morning_meal: '',
      evening_meal: '',
      snacks: '',
      notes: '',
      custom_walks: ''
    };
  });

  // Walk & Play Note Form State (Dedicated Walk/Play Subview)
  const [walkFormData, setWalkFormData] = useState({
    overview: '',
    daily_target: '2 walks daily · ~60–75 mins total',
    morning_walk: '7:30 AM (30 mins) · Neighborhood sniff walk & potty break',
    evening_walk: '6:00 PM (45 mins) · Park cardio loop & social sniffing',
    playtime_games: '15–20 mins fetch with tennis ball or snuffle mat',
    gear_behavior: 'Front-clip harness; friendly with dogs, stays on sidewalk',
    weather_safety: 'Check pavement temp before walking\nCarry portable water bottle on sunny days\nWipe paws dry after rain'
  });
  const [isSavingWalk, setIsSavingWalk] = useState(false);
  const [isGeneratingWalkAi, setIsGeneratingWalkAi] = useState(false);

  // Up Next state
  const [upNext, setUpNext] = useState(cached?.upNext || null);

  // Active Vaccine Reminder state
  const [vaxReminder, setVaxReminder] = useState(cached?.vaxReminder || null);
  const [vaxCalendarLink, setVaxCalendarLink] = useState(null);
  const [isSchedulingVax, setIsSchedulingVax] = useState(false);

  // Real-time WeatherAPI & Paw Walking Advisory state
  const [weatherAlert, setWeatherAlert] = useState(cached?.weatherAlert || null);
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);
  const [userLocationQuery, setUserLocationQuery] = useState(null);
  const [isEditingCity, setIsEditingCity] = useState(false);
  const [editCityText, setEditCityText] = useState('');

  const fetchWeatherForecast = async (targetPetName, specificLocation = null) => {
    setIsWeatherLoading(true);
    try {
      let loc = specificLocation || userLocationQuery;

      if (!loc && typeof navigator !== 'undefined' && navigator.geolocation) {
        try {
          const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3500 });
          });
          if (pos?.coords) {
            loc = `${pos.coords.latitude},${pos.coords.longitude}`;
            setUserLocationQuery(loc);
          }
        } catch {
          // Geolocation permission skipped or timed out, will fallback to profile city or auto:ip
        }
      }

      if (!loc) {
        const u = getStoredUser();
        if (u?.city) {
          loc = u.city;
        }
      }

      const pName = targetPetName || currentPet?.name || 'Your Pet';
      const res = await weatherApi.getPawForecast(loc || 'auto:ip', pName);
      if (res) {
        setWeatherAlert(res);
        updateCache({ weatherAlert: res });
      }
    } catch (err) {
      console.warn('Realtime weather fetch error:', err.message);
    } finally {
      setIsWeatherLoading(false);
    }
  };

  const handleScheduleVaxCalendar = async () => {
    if (vaxCalendarLink) {
      window.open(vaxCalendarLink, '_blank');
      return;
    }
    setIsSchedulingVax(true);
    try {
      const res = await calendarApi.scheduleVaccine({
        pet_id: activePet?.id || null,
        vaccine_name: vaxReminder?.vaccineName || vaxReminder?.title || "Rabies Annual Booster",
        due_date: vaxReminder?.dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
        clinic_name: activePet?.preferred_clinic || "Veterinary Clinic"
      });
      if (res?.html_link) {
        setVaxCalendarLink(res.html_link);
        showToast("✓ Scheduled booster reminder in Google Calendar!");
        window.open(res.html_link, '_blank');
      }
    } catch (err) {
      console.warn("Vaccine calendar error:", err);
      showToast("Could not schedule vaccine in calendar: " + err.message);
    } finally {
      setIsSchedulingVax(false);
    }
  };


  // Routine items list
  const [routineItems, setRoutineItems] = useState(cached?.routineItems || []);

  // Today's Diary logs
  const [diaryLogs, setDiaryLogs] = useState(cached?.diaryLogs || []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Helper to refresh timeline, routines, and up-next
  const refreshTimelineAndRoutines = async (petId) => {
    if (!petId) return;
    try {
      let finalTimelineLogs = [];
      let finalStreak = liveStreak;
      let finalRoutines = [];
      let finalUpNext = null;

      // 1. Fetch Today's Timeline
      const timeline = await diaryApi.getTodayTimeline(petId);
      const eventsList = timeline?.timeline || timeline?.events || [];
      if (eventsList.length > 0) {
        const tagMap = {
          feed: { tag: 'Meal', color: 'bg-primary-container text-on-surface' },
          walk: { tag: 'Walk', color: 'bg-tertiary-container text-on-tertiary-container' },
          water: { tag: 'Hydration', color: 'bg-surface-container-high text-on-surface' },
          poop: { tag: 'Potty', color: 'bg-tertiary-container text-on-tertiary-container' },
          potty: { tag: 'Potty', color: 'bg-tertiary-container text-on-tertiary-container' },
          medication: { tag: 'Medication', color: 'bg-secondary-fixed text-secondary font-semibold' },
          meds: { tag: 'Medication', color: 'bg-secondary-fixed text-secondary font-semibold' },
          grooming: { tag: 'Grooming', color: 'bg-surface-container-high text-on-surface' },
          groom: { tag: 'Grooming', color: 'bg-surface-container-high text-on-surface' },
          note: { tag: 'Note', color: 'bg-primary-container text-on-surface' }
        };

        finalTimelineLogs = eventsList.map(ev => {
          const rawDate = ev.logged_at || ev.timestamp || new Date();
          const evTime = new Date(rawDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const mapped = tagMap[ev.event_type] || { tag: ev.event_type, color: 'bg-surface-container-high text-on-surface' };
          return {
            id: ev.id,
            time: evTime,
            title: ev.notes || `${ev.event_type.toUpperCase()} recorded`,
            author: ev.logged_by_sitter ? 'Sitter' : 'You (Synced)',
            tag: mapped.tag,
            tagColor: mapped.color
          };
        });
        setDiaryLogs(finalTimelineLogs);
      } else {
        setDiaryLogs([]);
      }
      if (typeof timeline?.streak_days === 'number') {
        finalStreak = timeline.streak_days;
        setLiveStreak(finalStreak);
      }

      // 2. Fetch routines
      const rawRoutines = await diaryApi.getRoutines(petId);
      const routines = (rawRoutines && Array.isArray(rawRoutines))
        ? rawRoutines.filter(r => r.category !== 'water' && !r.title.toLowerCase().includes('water refresh'))
        : [];
      if (routines) {
        finalRoutines = routines;
        setRoutineItems(routines);
      }

      // 3. Fetch Up Next
      const upNextData = await diaryApi.getUpNext(petId);
      if (upNextData) {
        finalUpNext = upNextData;
        setUpNext(upNextData);
      }

      // Update cache snapshot
      updateCache({
        routineItems: finalRoutines.length > 0 ? finalRoutines : routineItems,
        upNext: finalUpNext || upNext,
        vaxReminder,
        weatherAlert,
        diaryLogs: finalTimelineLogs,
        liveStreak: finalStreak,
        activeCalories,
        planDetail: planDetail || cached?.planDetail
      });
    } catch (err) {
      console.warn('Refresh note in DailyCare:', err.message);
    }
  };

  // Initial load
  useEffect(() => {
    async function loadBackendData() {
      try {
        // Load logged in user profile (only if authenticated)
        if (getAuthToken()) {
          const user = getStoredUser();
          if (user) {
            setCurrentUser(user);
          } else {
            try {
              const me = await authApi.getMe();
              if (me) setCurrentUser(me);
            } catch {
              // Keep default
            }
          }
        }

        // Load active pet (only if authenticated)
        let pets = [];
        if (getAuthToken()) {
          try {
            pets = await petsApi.getPets();
          } catch (e) {
            console.warn('Pets load error:', e);
          }
        }
        const storedPet = getStoredActivePet();
        let targetPet = (pets && pets.length > 0)
          ? (pets.find(p => p.id === storedPet?.id) || pets[0])
          : storedPet;

        setCurrentPet(targetPet);
        if (targetPet) {
          setStoredActivePet(targetPet);
        }

        if (targetPet?.id) {
          try {
            const savedWalk = localStorage.getItem(`pawcircle_walk_note_${targetPet.id}`);
            if (savedWalk) {
              setWalkFormData(JSON.parse(savedWalk));
            }
          } catch {}

          await refreshTimelineAndRoutines(targetPet.id);

          // Fetch Active Diet Plan details
          try {
            const planDet = await dietApi.getPlanDetail(targetPet.id);
            if (planDet) {
              setPlanDetail(planDet);
              updateCache({ planDetail: planDet });
              if (planDet.is_configured) {
                setDietFormData({
                  overview: planDet.overview || '',
                  current_food: planDet.current_food || '',
                  amount_per_day: planDet.amount_per_day || '',
                  meals: planDet.meals || '',
                  notes: planDet.notes || '',
                  custom_walks: planDet.custom_walks || ''
                });
              }
            }
          } catch (err) {
            console.warn('Plan detail fetch note:', err.message);
          } finally {
            setIsPlanLoading(false);
          }

          // Fetch Active Diet Plan for calories
          const currentWeight = Number(targetPet.weight_kg) || 28.0;
          const isNeutered = Boolean(targetPet.is_neutered);
          const baselineKcal = Math.round(70 * Math.pow(Math.max(1, currentWeight), 0.75) * (isNeutered ? 1.6 : 1.8));
          const rerMin = Math.round(70 * Math.pow(Math.max(1, currentWeight), 0.75));
          let calVal = baselineKcal;
          try {
            const plan = await dietApi.getActivePlan(targetPet.id);
            if (plan?.target_calories_kcal && plan.target_calories_kcal >= rerMin) {
              calVal = plan.target_calories_kcal;
            } else {
              calVal = baselineKcal;
            }
          } catch {
            calVal = baselineKcal;
          }
          setActiveCalories(calVal);
          updateCache({ activeCalories: calVal });

          // Fetch Vaccine Roadmap for real reminder
          let vaxData = {
            title: "All core vaccines up to date ✓",
            subtitle: `${targetPet.name} is fully protected for dog parks and daycare.`
          };
          try {
            const roadmap = await medicalApi.getRoadmap(targetPet.id);
            if (roadmap?.milestones && Array.isArray(roadmap.milestones)) {
              const nextUpcoming = roadmap.milestones.find(m => m.status === 'upcoming');
              if (nextUpcoming) {
                const due = new Date(nextUpcoming.due_date);
                const diffDays = Math.ceil((due - new Date()) / (1000 * 60 * 60 * 24));
                const daysText = diffDays > 0 ? `due in ${diffDays} days` : 'due now';
                vaxData = {
                  title: `${nextUpcoming.vaccine_name} ${daysText}`,
                  subtitle: nextUpcoming.is_core ? "Core canine vaccination protocol." : "Recommended lifestyle protection.",
                  vaccineName: nextUpcoming.vaccine_name,
                  dueDate: nextUpcoming.due_date
                };
              } else if (roadmap.is_fully_vaccinated) {
                vaxData = {
                  title: "All core vaccines up to date ✓",
                  subtitle: `${targetPet.name} is fully protected for dog parks and daycare.`
                };
              }
            }
          } catch (err) {
            console.warn('Roadmap fetch note:', err.message);
          }
          setVaxReminder(vaxData);
          updateCache({ vaxReminder: vaxData });
        }

        // Fetch real-time weather & paw walking safety advisory
        await fetchWeatherForecast(targetPet?.name || 'Your Pet');
      } catch (err) {
        console.warn('Backend sync note in DailyCare:', err.message);
      } finally {
        setIsInitialLoading(false);
      }
    }
    loadBackendData();

    const handlePetUpdated = async () => {
      const active = getStoredActivePet();
      if (active) {
        setCurrentPet(active);
        fetchWeatherForecast(active.name);

        const currentWeight = Number(active.weight_kg) || 28.0;
        const isNeutered = Boolean(active.is_neutered);
        const baselineKcal = Math.round(70 * Math.pow(Math.max(1, currentWeight), 0.75) * (isNeutered ? 1.6 : 1.8));
        const rerMin = Math.round(70 * Math.pow(Math.max(1, currentWeight), 0.75));

        let calVal = baselineKcal;
        try {
          const plan = await dietApi.getActivePlan(active.id);
          if (plan?.target_calories_kcal && plan.target_calories_kcal >= rerMin) {
            calVal = plan.target_calories_kcal;
          } else {
            calVal = baselineKcal;
          }
        } catch {
          calVal = baselineKcal;
        }
        setActiveCalories(calVal);
        setCachedDailyCare(active.id, { activeCalories: calVal });
      }
    };
    window.addEventListener('pawcircle_pet_updated', handlePetUpdated);
    return () => window.removeEventListener('pawcircle_pet_updated', handlePetUpdated);
  }, []);

  // Toggle routine item in backend
  const toggleRoutine = async (id) => {
    setLiveStreak(prev => (prev === 0 ? 1 : prev));
    setRoutineItems(prev =>
      prev.map(item => {
        if (item.id === id) {
          return { ...item, done: !item.done };
        }
        return item;
      })
    );

    try {
      const res = await diaryApi.toggleRoutine(id);
      showToast(res?.message || 'Routine updated');
      if (currentPet?.id) {
        await refreshTimelineAndRoutines(currentPet.id);
      }
    } catch (err) {
      console.warn('Routine toggle error:', err.message);
      setRoutineItems(prev =>
        prev.map(item => {
          if (item.id === id) {
            return { ...item, done: !item.done };
          }
          return item;
        })
      );
      showToast('Could not sync routine to backend');
    }
  };

  // Up Next action button handler
  const handleHeroAction = async () => {
    if (!currentPet?.id || isUpNextBusy || !upNext) return;
    setIsUpNextBusy(true);
    setLiveStreak(prev => (prev === 0 ? 1 : prev));

    try {
      if (upNext.id) {
        await diaryApi.toggleRoutine(upNext.id);
      } else {
        await diaryApi.logEvent({
          petId: currentPet.id,
          eventType: upNext.category || 'feed',
          details: { portion_size: upNext.portion_size || '450 g' },
          notes: `${upNext.title} completed`
        });
      }

      showToast(`✓ ${upNext.title} completed & logged!`);
      await refreshTimelineAndRoutines(currentPet.id);
    } catch (err) {
      console.warn('Hero action error:', err.message);
      showToast('Could not record action: ' + err.message);
    } finally {
      setIsUpNextBusy(false);
    }
  };

  const doneCount = routineItems.filter(i => i.done).length;

  // 1-Tap Quick-Log Handler
  const handleQuickLog = async (type) => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let newEntry = null;
    let eventType = 'feed';
    let details = {};
    let notes = '';

    if (type === 'fed') {
      eventType = 'feed';
      details = { portion_grams: 450, food: dietFormData.current_food || 'Kibble + pumpkin topper' };
      notes = `Meal fed and bowl cleaned (${dietFormData.current_food || 'Kibble'})`;
      newEntry = { id: Date.now(), time: now, title: notes, author: "You", tag: "Meal", tagColor: "bg-primary-container text-on-surface" };
      showToast(`Fed logged at ${now}. Routine updated.`);
    } else if (type === 'water') {
      eventType = 'water';
      details = { bowl_refilled: true };
      notes = 'Fresh water bowl scrubbed and refilled';
      newEntry = { id: Date.now(), time: now, title: notes, author: "You", tag: "Hydration", tagColor: "bg-surface-container-high text-on-surface" };
      showToast(`Water refresh logged at ${now}. Synced.`);
    } else if (type === 'poop') {
      eventType = 'poop';
      details = { consistency: 'Bristol 2 Normal' };
      notes = 'Potty break recorded: Healthy Bristol 2';
      newEntry = { id: Date.now(), time: now, title: notes, author: "You", tag: "Potty", tagColor: "bg-tertiary-container text-on-tertiary-container" };
      showToast(`Bathroom break logged at ${now}. Synced.`);
    } else if (type === 'groom') {
      eventType = 'grooming';
      notes = 'Coat brushed and paws checked after walk';
      newEntry = { id: Date.now(), time: now, title: notes, author: "You", tag: "Grooming", tagColor: "bg-surface-container-high text-on-surface" };
      showToast(`Grooming logged at ${now}. Synced.`);
    } else if (type === 'note') {
      const noteText = prompt(`Enter a quick note about ${currentPet?.name || 'your pet'} today:`, "Energetic and playful all afternoon!");
      if (noteText) {
        eventType = 'note';
        notes = noteText;
        newEntry = { id: Date.now(), time: now, title: noteText, author: "You", tag: "Note", tagColor: "bg-primary-container text-on-surface" };
        showToast(`Note saved.`);
      }
    }

    if (newEntry) {
      setLiveStreak(prev => (prev === 0 ? 1 : prev));
      setDiaryLogs(prev => [newEntry, ...prev]);
      if (currentPet?.id) {
        try {
          await diaryApi.logEvent({
            petId: currentPet.id,
            eventType,
            details,
            notes
          });
          await refreshTimelineAndRoutines(currentPet.id);
        } catch (err) {
          console.warn('Backend log note:', err.message);
        }
      }
    }
  };

  const handleLogWalk = async (duration) => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const notes = `${duration} walk logged around neighbourhood`;
    const newEntry = {
      id: Date.now(),
      time: now,
      title: notes,
      author: "You",
      tag: "Walk",
      tagColor: "bg-tertiary-container text-on-tertiary-container"
    };
    setLiveStreak(prev => (prev === 0 ? 1 : prev));
    setDiaryLogs(prev => [newEntry, ...prev]);
    setShowWalkExtension(false);
    showToast(`${duration} walk logged at ${now}. Synced.`);

    if (currentPet?.id) {
      try {
        await diaryApi.logEvent({
          petId: currentPet.id,
          eventType: 'walk',
          details: { duration },
          notes
        });
        await refreshTimelineAndRoutines(currentPet.id);
      } catch (err) {
        console.warn('Backend walk log note:', err.message);
      }
    }
  };

  // AI Generation Handler (Screenshot 3 -> Screenshot 4)
  const handleGenerateAi = async () => {
    if (!currentPet?.id || isGeneratingAi) return;
    setIsGeneratingAi(true);
    showToast(`Drafting custom diet & routine plan for ${currentPet.name} with AI...`);

    try {
      const res = await dietApi.generateRoutineAi(currentPet.id);
      if (res) {
        setDietFormData({
          overview: res.overview || '',
          current_food: res.current_food || '',
          amount_per_day: res.amount_per_day || '',
          meals: res.meals || '',
          morning_meal: res.morning_meal || '',
          evening_meal: res.evening_meal || '',
          snacks: res.snacks || '',
          notes: res.notes || '',
          custom_walks: res.custom_walks || ''
        });
        setActiveSubView('diet-form');
        showToast(`AI routine drafted! Review and tap Save Plan.`);
      }
    } catch (err) {
      console.warn('AI routine generation note:', err.message);
      // Fallback draft based on pet
      const defCal = Math.round(70 * Math.pow(currentPet.weight_kg || 28.0, 0.75) * 1.6);
      const defGrams = Math.round(defCal / 3.5);
      const halfGrams = Math.round(defGrams / 2);
      setDietFormData({
        overview: `A balanced daily feeding plan for ${currentPet.name}, measured by weight.`,
        current_food: `Adult ${currentPet.breed || 'Golden Retriever'} Balanced Kibble`,
        amount_per_day: `About ${defGrams} g of dry food a day (${defCal} kcal)`,
        meals: "2 meals, 8:30 AM morning and 7:30 PM evening",
        morning_meal: `About ${halfGrams} g dry kibble with bone broth topper`,
        evening_meal: `About ${halfGrams} g dry kibble with pumpkin puree`,
        snacks: "Fresh baby carrot sticks (under 10% daily calories)",
        notes: "Weigh portions with a kitchen scale\nKeep treats under 10% of the day's food\nEnsure clean drinking water is accessible at all times",
        custom_walks: "Morning 30 min park loop (9:15 AM), Evening 45 min sniff walk (5:30 PM)"
      });
      setActiveSubView('diet-form');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Photo Upload Handler (Vision OCR: food packaging, vet chart, care notes)
  const handlePhotoUploadChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !currentPet?.id) return;

    setIsUploadingPhoto(true);
    showToast(`Uploading photo & scanning with Gemini Vision OCR...`);

    try {
      const res = await dietApi.uploadRoutinePhoto(currentPet.id, file);
      if (res) {
        setDietFormData({
          overview: res.overview || '',
          current_food: res.current_food || '',
          amount_per_day: res.amount_per_day || '',
          meals: res.meals || '',
          morning_meal: res.morning_meal || '',
          evening_meal: res.evening_meal || '',
          snacks: res.snacks || '',
          notes: res.notes || '',
          custom_walks: res.custom_walks || ''
        });
        setActiveSubView('diet-form');
        showToast(`Extracted routine details from photo! Review and tap Save Plan.`);
      }
    } catch (err) {
      console.warn('Photo extraction note:', err.message);
      showToast('Could not extract from photo: ' + err.message);
    } finally {
      setIsUploadingPhoto(false);
      e.target.value = '';
    }
  };

  // Save Plan Handler (Screenshot 4)
  const handleSavePlan = async (e) => {
    if (e) e.preventDefault();
    if (!currentPet?.id || isSavingPlan) return;

    setIsSavingPlan(true);
    try {
      await dietApi.saveManualPlan({
        pet_id: currentPet.id,
        ...dietFormData
      });

      const updatedPlan = {
        pet_id: currentPet.id,
        is_configured: true,
        ...dietFormData
      };
      setPlanDetail(updatedPlan);
      updateCache({ planDetail: updatedPlan });
      setIsPlanLoading(false);

      showToast(`✓ Diet plan & routines saved successfully!`);
      await refreshTimelineAndRoutines(currentPet.id);
      setActiveSubView(null);
    } catch (err) {
      console.warn('Save plan error:', err.message);
      showToast('Could not save plan: ' + err.message);
    } finally {
      setIsSavingPlan(false);
    }
  };

  // Walk/Play AI Auto-fill generator (Powered by Google Gemini & Dog Profile)
  const handleAutoFillWalkAi = async () => {
    setIsGeneratingWalkAi(true);
    const name = currentPet?.name || 'your pet';
    try {
      showToast(`✨ Asking Google Gemini for ${name}'s walk & play note...`);
      const aiData = await dietApi.generateWalkPlayAi(currentPet?.id, {
        name: currentPet?.name,
        species: currentPet?.species || 'dog',
        breed: currentPet?.breed,
        weight_kg: currentPet?.weight_kg,
        energy_level: currentPet?.energy_level,
        play_style: currentPet?.play_style,
      });

      if (aiData) {
        setWalkFormData({
          overview: aiData.overview || walkFormData.overview,
          daily_target: aiData.daily_target || walkFormData.daily_target,
          morning_walk: aiData.morning_walk || walkFormData.morning_walk,
          evening_walk: aiData.evening_walk || walkFormData.evening_walk,
          playtime_games: aiData.playtime_games || walkFormData.playtime_games,
          gear_behavior: aiData.gear_behavior || walkFormData.gear_behavior,
          weather_safety: aiData.weather_safety || walkFormData.weather_safety,
        });
        showToast(`✓ Google Gemini created custom walk & play note for ${name}!`);
      }
    } catch (err) {
      console.warn('Walk AI auto-fill error:', err);
      // Smart fallback tailored to breed & energy
      const breed = currentPet?.breed || 'Dog';
      const isHighEnergy = /retriever|shepherd|husky|terrier|collie|malinois|poodle|pointer|labrador|boxer/i.test(breed);
      if (isHighEnergy) {
        setWalkFormData({
          overview: `High-stamina energetic daily walking and retrieving routine formulated for ${name}'s athletic build.`,
          daily_target: '2 walks daily · ~60–80 mins total cardio & mental exercise',
          morning_walk: '7:00 AM (35 mins) · Brisk neighborhood sniff walk & bathroom break',
          evening_walk: '6:30 PM (45 mins) · Open field ball fetching & loose-leash walking',
          playtime_games: '20 mins high-drive ball retrieval, flirt pole, or snuffle mat before dinner',
          gear_behavior: 'Front-clip Y-harness with 6ft biothane leash; responds well to treat lures on walks',
          weather_safety: 'Check asphalt heat with 7-sec hand test (avoid >28°C)\nCarry collapsible bowl & fresh water in hot sun\nWipe muddy paws with damp towel after wet grass'
        });
      } else {
        setWalkFormData({
          overview: `Balanced, moderate daily walking and sniffing rhythm suited for ${name}'s size and comfort.`,
          daily_target: '2 walks daily · ~40–50 mins total relaxed exercise',
          morning_walk: '7:30 AM (25 mins) · Gentle sidewalk sniff walk & potty break',
          evening_walk: '6:00 PM (25 mins) · Calm neighborhood stroll & social sniffing',
          playtime_games: '15 mins gentle indoor fetch, squeaky toy play, or food puzzle bowl',
          gear_behavior: 'Padded chest harness; gentle walker, stays close on sidewalk',
          weather_safety: 'Avoid hot afternoon sun; walk in shaded grass areas\nCarry water during warm days\nWipe paws gently after rainy walks'
        });
      }
      showToast(`✓ Auto-filled walk & play schedule for ${name}!`);
    } finally {
      setIsGeneratingWalkAi(false);
    }
  };

  // Quick Walk Presets
  const applyWalkPreset = (presetType) => {
    const name = currentPet?.name || 'Your pet';
    if (presetType === 'active') {
      setWalkFormData({
        overview: `High-energy cardio & mental play routine for active ${name}.`,
        daily_target: '2 walks daily · ~75 mins total cardio & retrieval play',
        morning_walk: '7:00 AM (35 mins) · Brisk cardio walk & scent exploration',
        evening_walk: '6:30 PM (40 mins) · Park ball fetch & loose-leash pacing',
        playtime_games: '20 mins frisbee/ball fetch and tug-of-war in backyard',
        gear_behavior: 'No-pull harness; enthusiastic walker, loves open fields',
        weather_safety: 'Never walk on hot asphalt above 28°C\nBring portable hydration flask\nWipe paws after mud or dirt trails'
      });
      showToast('Applied Active Dog preset');
    } else {
      setWalkFormData({
        overview: `Gentle, low-impact strolls and enrichment games tailored for ${name}.`,
        daily_target: '2 gentle strolls daily · ~30–40 mins total',
        morning_walk: '8:00 AM (20 mins) · Calm grassy sniff walk & potty break',
        evening_walk: '5:30 PM (20 mins) · Relaxed sunset walk on soft grass',
        playtime_games: '15 mins lick mat, soft squeaker toy, or scent hide-and-seek',
        gear_behavior: 'Soft step-in harness; slow relaxed walker',
        weather_safety: 'Avoid steep stairs or rough terrain\nProtect joints in cold or damp weather\nWipe paws dry after walks'
      });
      showToast('Applied Gentle / Senior preset');
    }
  };

  // Save Walk Note Handler
  const handleSaveWalkNote = async (e) => {
    e.preventDefault();
    setIsSavingWalk(true);
    try {
      if (currentPet?.id) {
        localStorage.setItem(`pawcircle_walk_note_${currentPet.id}`, JSON.stringify(walkFormData));
      }

      const conciseWalk = `${walkFormData.daily_target || '2 walks daily'} | Morning: ${walkFormData.morning_walk || '7:30 AM'} | Evening: ${walkFormData.evening_walk || '6:00 PM'}`;

      const updatedDietData = {
        ...dietFormData,
        custom_walks: conciseWalk
      };
      setDietFormData(updatedDietData);

      setPlanDetail(prev => ({
        ...(prev || {}),
        pet_id: currentPet?.id,
        is_configured: true,
        custom_walks: conciseWalk
      }));

      if (currentPet?.id) {
        try {
          await dietApi.saveManualPlan({
            pet_id: currentPet.id,
            ...updatedDietData
          });
          await refreshTimelineAndRoutines(currentPet.id);
        } catch (apiErr) {
          console.warn('API sync note:', apiErr.message);
        }
      }

      showToast(`✓ Walk/play note saved for ${displayPetName}!`);
      setActiveSubView(null);
    } catch (err) {
      showToast('Could not save note: ' + err.message);
    } finally {
      setIsSavingWalk(false);
    }
  };

  // Dynamic user and pet greeting variables
  const currentHour = new Date().getHours();
  const timeGreeting = currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';
  const displayUserName = currentUser?.full_name?.split(' ')[0] || currentUser?.email?.split('@')[0] || 'Friend';
  const displayPetName = currentPet?.name || 'Your Pet';
  const displayLocation = currentUser?.area_neighborhood || currentUser?.city || 'Model Town';

  // Pet Age calculation: accurately handles puppies & kittens under 1 year (e.g. 5 mos)
  const calculatePetAgeDisplay = (birthDate) => {
    return formatPetAge(birthDate);
  };

  const petAgeYears = calculatePetAgeDisplay(currentPet?.birth_date);

  // Hydration calculation: 58 ml / kg / day
  const petWeightKg = currentPet?.weight_kg ? Number(currentPet.weight_kg) : 9.0;
  const hydrationGoalLiters = ((petWeightKg * 58) / 1000).toFixed(1);

  // Caloric requirement calculation:
  // RER = 70 * (weight_kg ^ 0.75)
  // DER = RER * (1.6 if neutered else 1.8)
  const isNeuteredPet = Boolean(currentPet?.is_neutered);
  const baselineCaloriesForPet = Math.round(70 * Math.pow(Math.max(1, petWeightKg), 0.75) * (isNeuteredPet ? 1.6 : 1.8));
  const minRerForPet = Math.round(70 * Math.pow(Math.max(1, petWeightKg), 0.75));

  // Safeguard: Ensure displayed daily calories never display an obsolete or starved caloric value
  // (e.g. 720 kcal for a 32 kg dog whose basal RER alone is 942 kcal)
  const displayedDailyCalories = (activeCalories && activeCalories >= minRerForPet)
    ? activeCalories
    : baselineCaloriesForPet;

  return (
    <div className="w-full max-w-[1140px] mx-auto px-4 sm:px-6 py-8">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-on-surface text-surface px-5 py-3 rounded-full shadow-lg flex items-center gap-2 text-label-md font-medium animate-bounce">
          <span className="material-symbols-outlined text-[18px] text-primary-container">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* SUBVIEW 1: DIET PLAN LANDING (Matching Screenshot 3)      */}
      {/* ========================================================= */}
      {activeSubView === 'diet-landing' && (
        <div className="w-full max-w-[760px] mx-auto py-4 flex flex-col gap-6 animate-fadeIn">
          {/* Back link */}
          <button 
            onClick={() => setActiveSubView(null)}
            className="inline-flex items-center gap-1 text-sm font-medium text-on-surface-variant hover:text-on-surface self-start transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            Daily Care
          </button>

          {/* Heading */}
          <div className="flex flex-col gap-2">
            <h1 className="font-headline-lg text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tight">
              Diet plan
            </h1>
            <p className="font-body-md text-base text-on-surface-variant leading-relaxed">
              A simple daily feeding guide for {displayPetName}: what to feed and how much. Write it in yourself, or let HawPulse draft one from breed, age and weight.
            </p>
          </div>

          {/* Action Buttons Row */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {/* Primary Action Button: Enter plan manually */}
            <button
              onClick={() => setActiveSubView('diet-form')}
              className="px-7 py-3.5 rounded-full bg-[#FF6B4A] hover:bg-[#F25532] text-on-surface font-extrabold text-sm transition-all shadow-xs cursor-pointer"
            >
              Enter {displayPetName}'s plan
            </button>

            {/* Secondary Action Button: Generate with AI -> Opens Diet Lab page */}
            <button
              onClick={() => {
                if (setActiveTab) setActiveTab('diet-lab');
              }}
              className="px-7 py-3.5 rounded-full bg-white text-on-surface font-extrabold text-sm border-2 border-black hover:bg-surface-container transition-all shadow-xs cursor-pointer flex items-center gap-2"
            >
              <span>Or generate with AI</span>
            </button>

            {/* Photo Upload Action Button (Requested by user) */}
            <label className="px-6 py-3.5 rounded-full bg-surface-container text-on-surface font-bold text-sm border border-outline-variant/70 hover:bg-surface-container-high transition-all shadow-xs cursor-pointer flex items-center gap-2">
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUploadChange}
                className="hidden"
              />
              {isUploadingPhoto ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin"></span>
                  <span>Scanning photo...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                  <span>Upload food photo</span>
                </>
              )}
            </label>
          </div>

          {/* Disclaimer Callout Box */}
          <div className="p-4 sm:p-5 rounded-2xl border-2 border-black/80 bg-white flex items-start gap-3 mt-2">
            <span className="material-symbols-outlined text-[20px] text-on-surface shrink-0 mt-0.5">info</span>
            <p className="text-xs sm:text-sm text-on-surface leading-relaxed">
              General guidance from public sources, <span className="text-[#C62828] font-bold">not veterinary advice</span>. For anything about {displayPetName}’s health, check with your vet.
            </p>
          </div>

          {/* Active plan preview if configured */}
          {planDetail?.is_configured && (
            <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/40 flex flex-col gap-3 mt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-outline uppercase tracking-wider">Current Active Plan</span>
                <span className="text-xs font-bold text-primary bg-primary-container/40 px-3 py-1 rounded-full">Active Plan</span>
              </div>
              <div className="text-sm font-bold text-on-surface">{planDetail.current_food}</div>
              <div className="text-xs text-on-surface-variant">{planDetail.amount_per_day} · {planDetail.meals}</div>
              {planDetail.overview && <div className="text-xs text-outline italic">"{planDetail.overview}"</div>}
              <button
                onClick={() => setActiveSubView('diet-form')}
                className="self-start text-xs font-bold text-primary hover:underline mt-1"
              >
                Edit this plan →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* SUBVIEW 2: FULL FORM VIEW (Matching Screenshot 4)         */}
      {/* ========================================================= */}
      {activeSubView === 'diet-form' && (
        <div className="w-full max-w-[760px] mx-auto py-4 flex flex-col gap-6 animate-fadeIn">
          {/* Back link */}
          <button 
            onClick={() => setActiveSubView(null)}
            className="inline-flex items-center gap-1 text-sm font-medium text-on-surface-variant hover:text-on-surface self-start transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            Daily Care
          </button>

          {/* Heading */}
          <div className="flex flex-col gap-1">
            <h1 className="font-headline-lg text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tight">
              Diet plan
            </h1>
            <p className="text-xs text-outline">
              Fill in {displayPetName}'s daily feeding &amp; walk rhythm. Saving automatically sets up your daily checklist.
            </p>
          </div>

          {/* Quick AI & Photo Re-Scan Helper Pill Bar */}
          <div className="p-3 bg-surface-container-low rounded-2xl border border-outline-variant/30 flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-medium text-on-surface-variant">Want to auto-fill?</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (setActiveTab) setActiveTab('diet-lab');
                }}
                className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-white border border-black/40 hover:bg-surface-container transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px] text-primary">auto_fix_high</span>
                <span>Open Diet Lab (AI)</span>
              </button>

              <label className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-white border border-black/40 hover:bg-surface-container transition-all flex items-center gap-1.5 cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUploadChange}
                  className="hidden"
                />
                <span className="material-symbols-outlined text-[16px] text-primary">photo_camera</span>
                <span>Scan food photo</span>
              </label>
            </div>
          </div>

          {/* Form Fields matching Screenshot 4 */}
          <form onSubmit={handleSavePlan} className="flex flex-col gap-5">
            {/* Overview (optional) */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-on-surface">Overview (optional)</label>
              <textarea
                rows="3"
                value={dietFormData.overview}
                onChange={(e) => setDietFormData({ ...dietFormData, overview: e.target.value })}
                placeholder={`A line about ${displayPetName}'s feeding, e.g. Measured by weight, twice a day.`}
                className="w-full p-4 rounded-2xl bg-white border-2 border-black/80 text-sm text-on-surface placeholder:text-outline/70 focus:outline-none focus:ring-1 focus:ring-black transition-all resize-none shadow-xs"
              />
            </div>

            {/* Current food */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-on-surface">Current food</label>
              <input
                type="text"
                required
                value={dietFormData.current_food}
                onChange={(e) => setDietFormData({ ...dietFormData, current_food: e.target.value })}
                placeholder="e.g. Acme Adult Chicken (dry)"
                className="w-full h-12 px-4 rounded-2xl bg-white border-2 border-black/80 text-sm text-on-surface placeholder:text-outline/70 focus:outline-none focus:ring-1 focus:ring-black transition-all shadow-xs"
              />
            </div>

            {/* Amount per day */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-on-surface">Amount per day</label>
              <input
                type="text"
                required
                value={dietFormData.amount_per_day}
                onChange={(e) => setDietFormData({ ...dietFormData, amount_per_day: e.target.value })}
                placeholder="e.g. About 240 g of dry food a day"
                className="w-full h-12 px-4 rounded-2xl bg-white border-2 border-black/80 text-sm text-on-surface placeholder:text-outline/70 focus:outline-none focus:ring-1 focus:ring-black transition-all shadow-xs"
              />
            </div>

            {/* Meals */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-on-surface">Meals</label>
              <input
                type="text"
                required
                value={dietFormData.meals}
                onChange={(e) => setDietFormData({ ...dietFormData, meals: e.target.value })}
                placeholder="e.g. 2 meals, morning and evening"
                className="w-full h-12 px-4 rounded-2xl bg-white border-2 border-black/80 text-sm text-on-surface placeholder:text-outline/70 focus:outline-none focus:ring-1 focus:ring-black transition-all shadow-xs"
              />
            </div>

            {/* Morning meal */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-on-surface flex items-center gap-1.5">
                  <span>🌅</span>
                  <span>Morning meal</span>
                </label>
                <span className="text-xs text-on-surface-variant font-medium">e.g. 8:30 AM breakfast</span>
              </div>
              <input
                type="text"
                value={dietFormData.morning_meal}
                onChange={(e) => setDietFormData({ ...dietFormData, morning_meal: e.target.value })}
                placeholder="e.g. ~111 g: Chicken, kibble base, steamed carrots"
                className="w-full h-12 px-4 rounded-2xl bg-white border-2 border-black/80 text-sm text-on-surface placeholder:text-outline/70 focus:outline-none focus:ring-1 focus:ring-black transition-all shadow-xs"
              />
            </div>

            {/* Evening meal */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-on-surface flex items-center gap-1.5">
                  <span>🌇</span>
                  <span>Evening meal</span>
                </label>
                <span className="text-xs text-on-surface-variant font-medium">e.g. 7:30 PM dinner</span>
              </div>
              <input
                type="text"
                value={dietFormData.evening_meal}
                onChange={(e) => setDietFormData({ ...dietFormData, evening_meal: e.target.value })}
                placeholder="e.g. ~111 g: Chicken, kibble base, pumpkin purée"
                className="w-full h-12 px-4 rounded-2xl bg-white border-2 border-black/80 text-sm text-on-surface placeholder:text-outline/70 focus:outline-none focus:ring-1 focus:ring-black transition-all shadow-xs"
              />
            </div>

            {/* Snacks (optional) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-on-surface flex items-center gap-1.5">
                  <span>🦴</span>
                  <span>Snacks (optional)</span>
                </label>
                <span className="text-xs text-outline font-medium">Optional · &lt; 10% daily calories</span>
              </div>
              <input
                type="text"
                value={dietFormData.snacks}
                onChange={(e) => setDietFormData({ ...dietFormData, snacks: e.target.value })}
                placeholder="e.g. Crunchy baby carrots or banana bites (< 20 kcal)"
                className="w-full h-12 px-4 rounded-2xl bg-white border-2 border-black/80 text-sm text-on-surface placeholder:text-outline/70 focus:outline-none focus:ring-1 focus:ring-black transition-all shadow-xs"
              />
            </div>

            {/* Notes (optional, one per line) */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-on-surface">Notes (optional, one per line)</label>
              <textarea
                rows="4"
                value={dietFormData.notes}
                onChange={(e) => setDietFormData({ ...dietFormData, notes: e.target.value })}
                placeholder="Weigh portions with a scale&#10;Keep treats under 10% of the day's food"
                className="w-full p-4 rounded-2xl bg-white border-2 border-black/80 text-sm text-on-surface placeholder:text-outline/70 focus:outline-none focus:ring-1 focus:ring-black transition-all resize-none shadow-xs font-mono text-xs sm:text-sm"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={isSavingPlan}
                className="px-8 py-3.5 rounded-full bg-[#FF6B4A] hover:bg-[#F25532] text-on-surface font-extrabold text-sm transition-all shadow-xs cursor-pointer flex items-center gap-2"
              >
                {isSavingPlan ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin"></span>
                    <span>Saving plan...</span>
                  </>
                ) : (
                  <span>Save plan</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveSubView('diet-landing')}
                className="px-8 py-3.5 rounded-full bg-white text-on-surface font-extrabold text-sm border-2 border-black hover:bg-surface-container transition-all shadow-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* SUBVIEW 3: WALK / PLAY NOTE FORM (Matching Screenshot)     */}
      {/* ========================================================= */}
      {activeSubView === 'walk-form' && (
        <div className="w-full max-w-[760px] mx-auto py-4 flex flex-col gap-6 animate-fadeIn">
          {/* Back link */}
          <button 
            type="button"
            onClick={() => setActiveSubView(null)}
            className="inline-flex items-center gap-1 text-sm font-medium text-on-surface-variant hover:text-on-surface self-start transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            Daily Care
          </button>

          {/* Heading */}
          <div className="flex flex-col gap-1">
            <h1 className="font-headline-lg text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tight">
              Walk/play note
            </h1>
            <p className="text-xs text-outline">
              Fill in {displayPetName}&apos;s daily walk &amp; play rhythm. Saving automatically sets up your daily schedule.
            </p>
          </div>

          {/* Quick AI & Preset Helper Pill Bar */}
          <div className="p-3 bg-surface-container-low rounded-2xl border border-outline-variant/30 flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-medium text-on-surface-variant">Want to auto-fill?</span>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleAutoFillWalkAi}
                disabled={isGeneratingWalkAi}
                className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-white border border-black/40 hover:bg-surface-container transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px] text-primary">
                  {isGeneratingWalkAi ? "sync" : "auto_fix_high"}
                </span>
                <span>{isGeneratingWalkAi ? "Generating..." : "Auto-fill with AI"}</span>
              </button>

              <button
                type="button"
                onClick={() => applyWalkPreset('active')}
                className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-white border border-black/40 hover:bg-surface-container transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>⚡ Active Dog</span>
              </button>

              <button
                type="button"
                onClick={() => applyWalkPreset('calm')}
                className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-white border border-black/40 hover:bg-surface-container transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>🌿 Gentle / Senior</span>
              </button>
            </div>
          </div>

          {/* Form Fields */}
          <form onSubmit={handleSaveWalkNote} className="flex flex-col gap-5">
            {/* Overview (optional) */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-on-surface">Overview (optional)</label>
              <textarea
                rows="3"
                value={walkFormData.overview}
                onChange={(e) => setWalkFormData({ ...walkFormData, overview: e.target.value })}
                placeholder={`A line about ${displayPetName}'s daily walking style, e.g. High-energy explorer who loves ball retrieval and sniff walks.`}
                className="w-full p-4 rounded-2xl bg-white border-2 border-black/80 text-sm text-on-surface placeholder:text-outline/70 focus:outline-none focus:ring-1 focus:ring-black transition-all resize-none shadow-xs"
              />
            </div>

            {/* Daily walk target */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-on-surface">Daily walk target</label>
              <input
                type="text"
                required
                value={walkFormData.daily_target}
                onChange={(e) => setWalkFormData({ ...walkFormData, daily_target: e.target.value })}
                placeholder="e.g. 2 walks daily · ~60–75 mins total"
                className="w-full h-12 px-4 rounded-2xl bg-white border-2 border-black/80 text-sm text-on-surface placeholder:text-outline/70 focus:outline-none focus:ring-1 focus:ring-black transition-all shadow-xs"
              />
            </div>

            {/* Morning walk */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-on-surface flex items-center gap-1.5">
                  <span>🌅</span>
                  <span>Morning walk</span>
                </label>
                <span className="text-xs text-on-surface-variant font-medium">e.g. 7:30 AM · 30 mins</span>
              </div>
              <input
                type="text"
                required
                value={walkFormData.morning_walk}
                onChange={(e) => setWalkFormData({ ...walkFormData, morning_walk: e.target.value })}
                placeholder="e.g. 7:30 AM (30 mins) · Neighborhood sniff walk & potty break"
                className="w-full h-12 px-4 rounded-2xl bg-white border-2 border-black/80 text-sm text-on-surface placeholder:text-outline/70 focus:outline-none focus:ring-1 focus:ring-black transition-all shadow-xs"
              />
            </div>

            {/* Evening walk */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-on-surface flex items-center gap-1.5">
                  <span>🌇</span>
                  <span>Evening walk</span>
                </label>
                <span className="text-xs text-on-surface-variant font-medium">e.g. 6:00 PM · 45 mins</span>
              </div>
              <input
                type="text"
                required
                value={walkFormData.evening_walk}
                onChange={(e) => setWalkFormData({ ...walkFormData, evening_walk: e.target.value })}
                placeholder="e.g. 6:00 PM (45 mins) · Brisk park cardio loop & social play"
                className="w-full h-12 px-4 rounded-2xl bg-white border-2 border-black/80 text-sm text-on-surface placeholder:text-outline/70 focus:outline-none focus:ring-1 focus:ring-black transition-all shadow-xs"
              />
            </div>

            {/* Playtime & favorite games */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-on-surface flex items-center gap-1.5">
                  <span>🎾</span>
                  <span>Playtime &amp; favorite games</span>
                </label>
                <span className="text-xs text-outline font-medium">Daily mental &amp; physical play</span>
              </div>
              <input
                type="text"
                value={walkFormData.playtime_games}
                onChange={(e) => setWalkFormData({ ...walkFormData, playtime_games: e.target.value })}
                placeholder="e.g. 15–20 mins fetch with squeaky tennis ball, tug rope, or puzzle mat"
                className="w-full h-12 px-4 rounded-2xl bg-white border-2 border-black/80 text-sm text-on-surface placeholder:text-outline/70 focus:outline-none focus:ring-1 focus:ring-black transition-all shadow-xs"
              />
            </div>

            {/* Leash gear & outdoor behavior (optional) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-on-surface flex items-center gap-1.5">
                  <span>🦮</span>
                  <span>Leash gear &amp; outdoor behavior (optional)</span>
                </label>
                <span className="text-xs text-outline font-medium">Harness, reactivity, habits</span>
              </div>
              <input
                type="text"
                value={walkFormData.gear_behavior}
                onChange={(e) => setWalkFormData({ ...walkFormData, gear_behavior: e.target.value })}
                placeholder="e.g. Front-clip Y-harness; friendly with dogs, high prey drive for squirrels"
                className="w-full h-12 px-4 rounded-2xl bg-white border-2 border-black/80 text-sm text-on-surface placeholder:text-outline/70 focus:outline-none focus:ring-1 focus:ring-black transition-all shadow-xs"
              />
            </div>

            {/* Weather & safety notes (optional, one per line) */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-on-surface">Weather &amp; safety rules (optional, one per line)</label>
              <textarea
                rows="3"
                value={walkFormData.weather_safety}
                onChange={(e) => setWalkFormData({ ...walkFormData, weather_safety: e.target.value })}
                placeholder="Check asphalt heat with 7-second hand test&#10;Carry portable water bottle on sunny days&#10;Wipe muddy paws with damp wipe after rain"
                className="w-full p-4 rounded-2xl bg-white border-2 border-black/80 text-sm text-on-surface placeholder:text-outline/70 focus:outline-none focus:ring-1 focus:ring-black transition-all resize-none shadow-xs font-mono text-xs sm:text-sm"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={isSavingWalk}
                className="px-8 py-3.5 rounded-full bg-[#FF6B4A] hover:bg-[#F25532] text-on-surface font-extrabold text-sm transition-all shadow-xs cursor-pointer flex items-center gap-2"
              >
                {isSavingWalk ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin"></span>
                    <span>Saving note...</span>
                  </>
                ) : (
                  <span>Save walk/play note</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveSubView(null)}
                className="px-8 py-3.5 rounded-full bg-white text-on-surface font-extrabold text-sm border-2 border-black hover:bg-surface-container transition-all shadow-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* MAIN VIEW: DAILY CARE DASHBOARD FEED                      */}
      {/* ========================================================= */}
      {!activeSubView && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8 items-start animate-fadeIn">
          {/* ========================================== */}
          {/* LEFT COLUMN: Main Daily Care Feed          */}
          {/* ========================================== */}
          <div className="flex flex-col gap-6">
            {/* Banner when no pet is added yet */}
            {!currentPet && (
              <section className="p-4 sm:p-5 rounded-2xl bg-primary-container/20 border border-primary-container/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-surface">
                    <span className="material-symbols-outlined text-[20px]">pets</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-on-surface">No pet profile linked yet</h3>
                    <p className="text-xs text-on-surface-variant">Add your pet to record daily meals, custom walk schedules, and vaccinations.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab && setActiveTab('profile')}
                  className="px-4 py-2 rounded-full bg-primary-container text-on-surface font-bold text-xs hover:bg-primary-fixed-dim transition-colors cursor-pointer self-start sm:self-auto shrink-0 shadow-xs"
                >
                  Add Your Pet
                </button>
              </section>
            )}

            {/* 1. Greeting & Streak Card */}
            <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/40 shadow-xs">
              <div>
                <h2 className="font-headline-lg text-2xl sm:text-3xl font-bold text-on-surface">
                  {timeGreeting}, {displayUserName}.
                </h2>
                <p className="font-body-lg text-base text-outline mt-0.5">
                  Here’s {displayPetName}’s day in {displayLocation}.
                </p>
              </div>
              <div 
                className={`inline-flex items-center gap-3 px-4 py-2 rounded-full self-start sm:self-center border transition-all duration-300 shadow-2xs ${
                  liveStreak > 0
                    ? 'bg-primary-container/30 border-primary-container/40'
                    : 'bg-amber-500/10 border-amber-500/25'
                }`}
                title={liveStreak === 0 ? "Tap any quick action below to start your streak!" : `${liveStreak} day continuous streak`}
              >
                <span 
                  aria-hidden="true" 
                  className={`text-2xl select-none transition-transform duration-300 ${
                    liveStreak > 0 ? 'scale-110 drop-shadow-xs' : 'opacity-70 filter saturate-50'
                  }`}
                >
                  🔥
                </span>
                <div className="flex flex-col">
                  <span className="font-label-md text-sm text-on-surface font-bold">
                    {liveStreak === 0 ? '0-day streak' : `${liveStreak}-day streak`}
                  </span>
                  <span className="font-label-sm text-xs text-on-surface-variant font-medium">
                    {liveStreak === 0 ? 'Start your streak today' : 'One tap a day keeps it going'}
                  </span>
                </div>
              </div>
            </section>

            {/* 2. Quick Log Bar & Walk Duration Drawer */}
            <section className="flex flex-col gap-4 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/40 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="font-label-md text-xs text-outline uppercase tracking-wider font-bold">Quick One-Tap Log</span>
                <span className="font-label-sm text-xs text-primary flex items-center gap-1 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span> Tap icon to record
                </span>
              </div>

              {/* Minimal Squircle Quick-Log Grid */}
              <div className="grid grid-cols-5 gap-2 sm:gap-3 w-full max-w-md sm:max-w-xl">
                {/* Meal */}
                <button 
                  type="button"
                  onClick={() => handleQuickLog('fed')}
                  className="flex flex-col items-center justify-center gap-1.5 py-3 px-1.5 rounded-2xl bg-surface-container-low/80 hover:bg-surface-container border border-outline-variant/30 hover:border-amber-400/60 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 active:scale-95 cursor-pointer group"
                  title="Log meal"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center group-hover:scale-110 group-hover:bg-amber-500/20 transition-all">
                    <span className="material-symbols-outlined text-[22px]">restaurant</span>
                  </div>
                  <span className="font-label-md text-xs font-bold text-on-surface">Meal</span>
                </button>

                {/* Walk */}
                <button 
                  type="button"
                  onClick={() => setShowWalkExtension(!showWalkExtension)}
                  className={`flex flex-col items-center justify-center gap-1.5 py-3 px-1.5 rounded-2xl transition-all duration-200 hover:-translate-y-0.5 active:scale-95 cursor-pointer group shadow-2xs ${
                    showWalkExtension 
                      ? 'bg-emerald-50/90 border-2 border-emerald-500 ring-2 ring-emerald-500/20' 
                      : 'bg-surface-container-low/80 hover:bg-surface-container border border-outline-variant/30 hover:border-emerald-400/60'
                  }`}
                  title="Log walk"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-all ${
                    showWalkExtension ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-500/10 text-emerald-700 group-hover:bg-emerald-500/20'
                  }`}>
                    <span className="material-symbols-outlined text-[22px]">directions_walk</span>
                  </div>
                  <span className="font-label-md text-xs font-bold text-on-surface">Walk</span>
                </button>

                {/* Water */}
                <button 
                  type="button"
                  onClick={() => handleQuickLog('water')}
                  className="flex flex-col items-center justify-center gap-1.5 py-3 px-1.5 rounded-2xl bg-surface-container-low/80 hover:bg-surface-container border border-outline-variant/30 hover:border-sky-400/60 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 active:scale-95 cursor-pointer group"
                  title="Log hydration refresh"
                >
                  <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-700 flex items-center justify-center group-hover:scale-110 group-hover:bg-sky-500/20 transition-all">
                    <span className="material-symbols-outlined text-[22px]">water_drop</span>
                  </div>
                  <span className="font-label-md text-xs font-bold text-on-surface">Water</span>
                </button>

                {/* Potty */}
                <button 
                  type="button"
                  onClick={() => handleQuickLog('poop')}
                  className="flex flex-col items-center justify-center gap-1.5 py-3 px-1.5 rounded-2xl bg-surface-container-low/80 hover:bg-surface-container border border-outline-variant/30 hover:border-amber-600/50 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 active:scale-95 cursor-pointer group"
                  title="Log potty break"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-700/10 text-amber-800 flex items-center justify-center group-hover:scale-110 group-hover:bg-amber-700/20 transition-all">
                    <span className="material-symbols-outlined text-[22px]">pets</span>
                  </div>
                  <span className="font-label-md text-xs font-bold text-on-surface">Potty</span>
                </button>

                {/* Note */}
                <button 
                  type="button"
                  onClick={() => handleQuickLog('note')}
                  className="flex flex-col items-center justify-center gap-1.5 py-3 px-1.5 rounded-2xl bg-surface-container-low/80 hover:bg-surface-container border border-outline-variant/30 hover:border-purple-400/60 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 active:scale-95 cursor-pointer group"
                  title="Add quick note"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-700 flex items-center justify-center group-hover:scale-110 group-hover:bg-purple-500/20 transition-all">
                    <span className="material-symbols-outlined text-[22px]">edit_note</span>
                  </div>
                  <span className="font-label-md text-xs font-bold text-on-surface">Note</span>
                </button>
              </div>

              {/* Walk Duration Extension Chips Bar */}
              {showWalkExtension && (
                <div className="pt-2 bg-surface-container-low p-3 rounded-xl border border-outline-variant/30 flex items-center justify-between flex-wrap gap-2">
                  <span className="font-label-sm text-xs text-on-surface-variant font-medium">Select walk duration:</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {['15 min', '30 min', '45 min', '1 hr'].map(dur => (
                      <button
                        key={dur}
                        onClick={() => handleLogWalk(dur)}
                        className="px-3 py-1 rounded-full text-xs font-semibold bg-surface-container-lowest border border-outline-variant/40 text-on-surface hover:bg-primary-container transition-colors cursor-pointer"
                      >
                        {dur}
                      </button>
                    ))}
                    <button
                      onClick={() => setShowWalkExtension(false)}
                      className="px-2 py-1 text-xs text-outline hover:text-on-surface cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* 3. Up Next Card (Real Backend Sync) */}
            {upNext ? (
              <section className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/40 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-primary-container flex items-center justify-center shrink-0 text-on-surface">
                    <span className="material-symbols-outlined text-[28px]">
                      {upNext?.category === 'feed'
                        ? 'dinner_dining'
                        : upNext?.category === 'walk'
                        ? 'directions_walk'
                        : upNext?.category === 'water'
                        ? 'water_drop'
                        : 'task_alt'}
                    </span>
                  </div>
                  <div>
                    <span className="font-label-sm text-xs text-secondary font-bold uppercase tracking-wider">Up next</span>
                    <h3 className="font-headline-sm text-xl font-bold text-on-surface">
                      {upNext?.title} {upNext?.time_str ? `· ${upNext.time_str}` : ''}
                    </h3>
                    <p className="font-body-sm text-sm text-outline">
                      {upNext?.subtitle || upNext?.portion_size || `Scheduled routine for ${displayPetName}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleHeroAction}
                  disabled={isUpNextBusy}
                  className={`w-full sm:w-auto h-12 px-6 rounded-full font-label-md text-sm font-semibold transition-all shadow-xs cursor-pointer ${
                    upNext?.is_completed
                      ? 'bg-tertiary-container text-on-tertiary-container'
                      : 'bg-primary-container hover:bg-primary-fixed-dim text-on-surface'
                  }`}
                >
                  {isUpNextBusy
                    ? "Saving..."
                    : upNext?.is_completed
                    ? "✓ Completed & Logged"
                    : `Mark ${upNext?.category === 'feed' ? 'fed' : 'done'}`}
                </button>
              </section>
            ) : (
              <section className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/40 shadow-xs flex items-center justify-between gap-4 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-surface-container shrink-0"></div>
                  <div className="flex flex-col gap-2">
                    <div className="w-16 h-3 bg-surface-container rounded-full"></div>
                    <div className="w-44 h-5 bg-surface-container rounded-full"></div>
                    <div className="w-64 h-3 bg-surface-container rounded-full"></div>
                  </div>
                </div>
                <div className="w-28 h-12 bg-surface-container rounded-full shrink-0"></div>
              </section>
            )}

            {/* 4. Guides & Setup Row (Matching Screenshot 2) */}
            <div className="flex flex-col gap-3">
              {/* Diet Plan Guide Card */}
              <div 
                onClick={() => setActiveSubView('diet-landing')}
                className="p-4 sm:p-5 rounded-2xl bg-surface-container-lowest border-2 border-black/80 hover:bg-surface-container-low transition-all cursor-pointer flex items-center justify-between shadow-xs group"
              >
                <div className="flex flex-col">
                  <h4 className="font-headline-sm text-base sm:text-lg font-extrabold text-on-surface">Diet plan</h4>
                  <p className="text-xs sm:text-sm text-on-surface-variant">Diet &amp; portion guidance</p>
                </div>
                <div className="flex items-center gap-2">
                  {isPlanLoading ? (
                    <div className="w-24 h-6 bg-surface-container rounded-full animate-pulse border border-black/10"></div>
                  ) : (
                    <span className="font-mono text-[11px] sm:text-xs font-bold uppercase tracking-wider text-outline px-3 py-1 rounded-full border border-black/30 bg-white">
                      {planDetail?.is_configured ? "ACTIVE PLAN" : "NOT GENERATED YET"}
                    </span>
                  )}
                  <span className="material-symbols-outlined text-[20px] text-on-surface group-hover:translate-x-1 transition-transform">
                    chevron_right
                  </span>
                </div>
              </div>

              {/* Walk/Play Note Card */}
              <div 
                onClick={() => setActiveSubView('walk-form')}
                className="p-4 sm:p-5 rounded-2xl bg-surface-container-lowest border-2 border-black/80 hover:bg-surface-container-low transition-all cursor-pointer flex items-center justify-between shadow-xs group"
              >
                <div className="flex flex-col">
                  <h4 className="font-headline-sm text-base sm:text-lg font-extrabold text-on-surface">Walk/play note</h4>
                  <p className="text-xs sm:text-sm text-on-surface-variant truncate max-w-[280px] sm:max-w-[420px]">
                    {walkFormData?.daily_target || walkFormData?.overview || planDetail?.custom_walks || "Outdoor walks, exercise & play rhythm"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-[11px] sm:text-xs font-bold uppercase tracking-wider text-outline px-3 py-1 rounded-full border border-black/30 bg-white">
                    {walkFormData?.daily_target ? "VIEW / EDIT" : "EDIT NOTE"}
                  </span>
                  <span className="material-symbols-outlined text-[20px] text-on-surface group-hover:translate-x-1 transition-transform">
                    chevron_right
                  </span>
                </div>
              </div>
            </div>

            {/* 5. Today's Routine Checklist (Synced to Backend Database) */}
            <section className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/40 shadow-xs flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
                <div>
                  <h3 className="font-headline-sm text-lg font-bold text-on-surface">Today’s Routine</h3>
                  <span className="text-xs text-outline">Synced to daily care log</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveSubView('diet-landing')}
                    className="text-xs font-semibold text-primary px-3 py-1 rounded-full bg-primary-container/30 border border-primary-container/60 hover:bg-primary-container transition-colors cursor-pointer"
                    title="Customize routine & feeding plan"
                  >
                    Customize Plan
                  </button>
                  {isInitialLoading ? (
                    <div className="w-24 h-6 bg-surface-container rounded-full animate-pulse"></div>
                  ) : (
                    <span className="font-label-md text-xs text-tertiary font-bold bg-tertiary-container/30 border border-tertiary-container/50 px-3 py-1 rounded-full">
                      {doneCount} of {routineItems.length} completed
                    </span>
                  )}
                </div>
              </div>

              {isInitialLoading ? (
                <div className="flex flex-col gap-3 py-2 animate-pulse">
                  {[1, 2, 3, 4, 5].map(n => (
                    <div key={n} className="flex items-center gap-3 py-2 px-3">
                      <div className="w-5 h-5 rounded-md bg-surface-container shrink-0"></div>
                      <div className="flex flex-col gap-1.5 flex-1">
                        <div className="w-48 h-4 bg-surface-container rounded-full"></div>
                        <div className="w-32 h-3 bg-surface-container rounded-full"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : routineItems.length === 0 ? (
                <div className="py-6 text-center text-xs text-outline">
                  No routines yet. Click "Customize Plan" above or "Diet plan" to set one up!
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {routineItems.map(item => (
                    <div
                      key={item.id}
                      onClick={() => toggleRoutine(item.id)}
                      className="flex items-start justify-between py-2.5 px-3 rounded-xl hover:bg-surface-container transition-colors cursor-pointer group"
                    >
                      <label className="flex items-start gap-3 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={() => {}}
                          className="mt-1 w-5 h-5 rounded-md text-primary accent-primary cursor-pointer"
                        />
                        <div className="flex flex-col">
                          <span className={`font-body-md text-sm sm:text-base ${item.done ? 'line-through text-outline' : 'text-on-surface font-medium'}`}>
                            {item.title}
                          </span>
                          <span className="font-label-sm text-xs text-outline">
                            {item.subtitle}
                          </span>
                        </div>
                      </label>
                      <span className="material-symbols-outlined text-[18px] text-outline opacity-0 group-hover:opacity-100 transition-opacity">
                        check_circle
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 6. Today's Diary Timeline (Synced Chronological Feed) */}
            <section className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/40 shadow-xs flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
                <h3 className="font-headline-sm text-lg font-bold text-on-surface">Today's Diary</h3>
                <span className="text-xs text-on-surface-variant">Live chronological feed</span>
              </div>

              {isInitialLoading ? (
                <div className="flex flex-col gap-3 animate-pulse">
                  {[1, 2].map(n => (
                    <div key={n} className="h-14 rounded-xl bg-surface-container-low border border-outline-variant/20"></div>
                  ))}
                </div>
              ) : diaryLogs.length === 0 ? (
                <div className="py-6 text-center text-xs text-outline">
                  No activity logged yet today. Tap a quick-log icon above to record {displayPetName}'s first event!
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {diaryLogs.map(log => (
                    <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl bg-surface-container-low border border-outline-variant/20">
                      <span className="text-xs font-mono font-bold text-outline shrink-0 mt-0.5">{log.time}</span>
                      <div className="flex-1 flex flex-col">
                        <span className="font-body-md text-sm text-on-surface font-medium">{log.title}</span>
                        <span className="text-xs text-outline">Logged by {log.author}</span>
                      </div>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${log.tagColor}`}>
                        {log.tag}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* ========================================== */}
          {/* RIGHT COLUMN: Sidebar & Quick Dossier      */}
          {/* ========================================== */}
          <div className="flex flex-col gap-6 lg:sticky lg:top-24">
            {/* Pet Dossier Card (Connected to Active Pet & Diet Metrics) */}
            <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/40 shadow-xs flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <img
                  src={resolvePetAvatar(currentPet)}
                  alt={displayPetName}
                  className={`w-16 h-16 rounded-2xl border border-outline-variant/40 ${
                    hasCustomPetPhoto(currentPet)
                      ? 'object-cover shadow-xs'
                      : 'object-contain p-2 bg-surface-container-lowest shadow-2xs'
                  }`}
                />
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-headline-sm text-lg font-bold text-on-surface">{displayPetName}</h4>
                    <span className="w-2 h-2 rounded-full bg-tertiary" title="Active"></span>
                  </div>
                  <span className="text-xs text-on-surface-variant">
                    {currentPet?.breed || 'Golden Retriever'} • {petAgeYears}
                  </span>
                  <span className="text-xs font-semibold text-tertiary">
                    {petWeightKg} kg · Optimal Weight
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-surface-container">
                  <span className="text-outline block text-[11px]">Daily Calories</span>
                  <span className="font-bold text-on-surface text-sm">{displayedDailyCalories.toLocaleString()} kcal</span>
                </div>
                <div className="p-2.5 rounded-xl bg-surface-container">
                  <span className="text-outline block text-[11px]">Hydration Goal</span>
                  <span className="font-bold text-on-surface text-sm">{hydrationGoalLiters} L / day</span>
                </div>
              </div>

              <button
                onClick={() => setActiveTab('profile')}
                className="w-full py-2 rounded-full border border-outline-variant text-on-surface text-xs font-semibold hover:bg-surface-container transition-colors"
              >
                View Full Pet Dossier
              </button>
            </div>

            {/* Health & Weather Alerts (Connected to Medical Roadmap) */}
            <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/40 shadow-xs flex flex-col gap-3">
              <span className="text-xs font-bold text-outline uppercase tracking-wider">Active Reminders</span>

              {/* Vaccine Alert from Medical Vault Roadmap */}
              {vaxReminder ? (
                <div className="p-3.5 rounded-xl bg-secondary-fixed/50 border border-secondary-container/30 flex items-start gap-3 min-h-[104px]">
                  <span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5">event_upcoming</span>
                  <div className="flex flex-col">
                    <h4 className="font-label-md text-xs font-bold text-on-surface">{vaxReminder?.title}</h4>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">{vaxReminder?.subtitle}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <button 
                        onClick={() => setActiveTab('medical-vault')}
                        className="text-secondary text-xs font-bold hover:underline"
                      >
                        View Vaccine Roadmap →
                      </button>
                      <button
                        onClick={handleScheduleVaxCalendar}
                        disabled={isSchedulingVax}
                        className="px-2.5 py-1 rounded-full bg-white text-on-surface hover:bg-surface-container text-[11px] font-bold border border-secondary/40 flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[13px] text-[#1A73E8]">alarm_on</span>
                        <span>{isSchedulingVax ? "Scheduling..." : vaxCalendarLink ? "Open in Calendar ↗" : "Remind me in Google Calendar"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 flex items-start gap-3 min-h-[104px] animate-pulse">
                  <div className="w-5 h-5 rounded-full bg-surface-container shrink-0 mt-0.5"></div>
                  <div className="flex flex-col gap-2 flex-1">
                    <div className="w-40 h-3.5 bg-surface-container rounded-full"></div>
                    <div className="w-56 h-2.5 bg-surface-container rounded-full"></div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="w-32 h-6 bg-surface-container rounded-full"></div>
                      <div className="w-40 h-6 bg-surface-container rounded-full"></div>
                    </div>
                  </div>
                </div>
              )}

              {/* Real-time Weather Alert (Powered by WeatherAPI.com) */}
              <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 flex items-start gap-3 relative group transition-all">
                {weatherAlert?.condition_icon ? (
                  <img 
                    src={weatherAlert.condition_icon} 
                    alt={weatherAlert.condition || "Weather"} 
                    className="w-7 h-7 object-contain shrink-0 -mt-0.5" 
                  />
                ) : (
                  <span className={`material-symbols-outlined text-[20px] shrink-0 mt-0.5 ${
                    weatherAlert?.level === 'danger' ? 'text-error' :
                    weatherAlert?.level === 'good' ? 'text-emerald-600' :
                    weatherAlert?.level === 'info' ? 'text-secondary' :
                    'text-primary'
                  }`}>
                    {weatherAlert?.icon_name || 'sunny'}
                  </span>
                )}
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="font-label-md text-xs font-bold text-on-surface flex items-center gap-1.5 flex-wrap">
                      <span>{weatherAlert?.title || `Warm day ahead (${weatherAlert?.temp_c || 29}°C)`}</span>
                      {weatherAlert?.is_realtime && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Live · {weatherAlert.city || displayLocation}
                        </span>
                      )}
                    </h4>
                    <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setIsEditingCity(!isEditingCity)}
                        title="Change location"
                        className="text-[11px] text-on-surface-variant hover:text-primary transition-colors p-0.5 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[15px]">edit_location</span>
                      </button>
                      <button
                        onClick={() => fetchWeatherForecast(displayPetName)}
                        disabled={isWeatherLoading}
                        title="Refresh live weather"
                        className="text-[11px] text-on-surface-variant hover:text-primary transition-colors p-0.5 cursor-pointer"
                      >
                        <span className={`material-symbols-outlined text-[15px] ${isWeatherLoading ? 'animate-spin' : ''}`}>
                          sync
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Inline city edit input if opened */}
                  {isEditingCity && (
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (editCityText.trim()) {
                          setUserLocationQuery(editCityText.trim());
                          fetchWeatherForecast(displayPetName, editCityText.trim());
                          setIsEditingCity(false);
                        }
                      }}
                      className="flex items-center gap-1.5 mt-2"
                    >
                      <input 
                        type="text" 
                        placeholder="Enter city (e.g. Mumbai, New York)..." 
                        value={editCityText}
                        onChange={(e) => setEditCityText(e.target.value)}
                        className="text-[11px] px-2 py-0.5 rounded border border-outline-variant bg-surface text-on-surface w-full max-w-[200px] focus:outline-none focus:border-primary"
                        autoFocus
                      />
                      <button 
                        type="submit" 
                        className="px-2 py-0.5 text-[10px] font-bold bg-primary text-on-primary rounded hover:opacity-90 cursor-pointer"
                      >
                        Save
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setIsEditingCity(false)} 
                        className="text-[10px] text-on-surface-variant hover:text-on-surface cursor-pointer"
                      >
                        ✕
                      </button>
                    </form>
                  )}

                  <p className="text-[11px] text-on-surface-variant mt-0.5 leading-relaxed">
                    {weatherAlert?.advisory || `Walk ${displayPetName} before 10 AM or after 5 PM to prevent hot pavement burns.`}
                  </p>

                  {/* Realtime micro-metrics */}
                  {weatherAlert && weatherAlert.humidity !== undefined && (
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-on-surface-variant/80 font-medium">
                      {weatherAlert.feelslike_c !== undefined && (
                        <span>Feels {weatherAlert.feelslike_c}°C</span>
                      )}
                      <span>•</span>
                      <span>Humidity {weatherAlert.humidity}%</span>
                      {weatherAlert.uv !== undefined && weatherAlert.uv > 0 && (
                        <>
                          <span>•</span>
                          <span>UV {weatherAlert.uv}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sitter Pass CTA Card */}
            <div className="bg-surface-container p-6 rounded-2xl border border-outline-variant/50 shadow-xs flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">badge</span>
                <h3 className="font-headline-sm text-base font-bold text-on-surface">Heading out?</h3>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Share {displayPetName}'s care pass with your walker or sitter. They get the routine and meal instructions without creating an account.
              </p>
              <button
                onClick={onOpenSitterPass}
                className="w-full h-11 rounded-full bg-primary-container text-on-surface font-label-md text-xs font-bold hover:bg-primary-fixed-dim transition-colors shadow-xs"
              >
                Generate Sitter Care Pass
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
