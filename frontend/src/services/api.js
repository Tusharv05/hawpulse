/**
 * PawCircle API Service Client
 * Full bridge connecting the React frontend to the FastAPI backend.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// Token and Session Storage Helpers
export const getAuthToken = () => localStorage.getItem('pawcircle_token') || '';
export const setAuthToken = (token) => {
  if (token) localStorage.setItem('pawcircle_token', token);
  else localStorage.removeItem('pawcircle_token');
};

export const getStoredUser = () => {
  const u = localStorage.getItem('pawcircle_user');
  try {
    return u ? JSON.parse(u) : null;
  } catch {
    return null;
  }
};
export const setStoredUser = (user) => {
  if (user) localStorage.setItem('pawcircle_user', JSON.stringify(user));
  else localStorage.removeItem('pawcircle_user');
};

export const getStoredActivePet = () => {
  const p = localStorage.getItem('pawcircle_active_pet');
  try {
    return p ? JSON.parse(p) : null;
  } catch {
    return null;
  }
};
export const setStoredActivePet = (pet) => {
  if (pet) localStorage.setItem('pawcircle_active_pet', JSON.stringify(pet));
  else localStorage.removeItem('pawcircle_active_pet');
};

export const clearSession = () => {
  localStorage.removeItem('pawcircle_token');
  localStorage.removeItem('pawcircle_user');
  localStorage.removeItem('pawcircle_active_pet');
  localStorage.removeItem('pawcircle_parent_name');
  localStorage.removeItem('pawcircle_parent_gender');
  localStorage.removeItem('pawcircle_parent_avatar');
  localStorage.removeItem('pawcircle_parent_vibe');
  localStorage.removeItem('pawcircle_parent_bio');
  localStorage.removeItem('pawcircle_parent_hobbies');
  localStorage.removeItem('pawcircle_partner_name');
  localStorage.removeItem('pawcircle_partner_gender');
  localStorage.removeItem('pawcircle_partner_avatar');
  localStorage.removeItem('pawcircle_partner_vibe');
  localStorage.removeItem('pawcircle_partner_hobbies');
  localStorage.removeItem('pawcircle_household_mode');
  localStorage.removeItem('pawcircle_onboarding_draft');
  localStorage.removeItem('pawcircle_resume_onboarding');
  window.dispatchEvent(new Event('pawcircle_profile_updated'));
  window.dispatchEvent(new Event('pawcircle_pet_updated'));
};

/**
 * Universal fetch wrapper with automatic JWT Bearer injection & error formatting
 */
async function request(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = { ...options.headers };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Handle JSON vs FormData
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle 204 No Content
    if (response.status === 204) {
      return { success: true };
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg = data?.detail || data?.message || `HTTP ${response.status}: Request failed`;
      throw new Error(errorMsg);
    }

    return data;
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    throw err;
  }
}

/* =====================================================================
   1. AUTHENTICATION & PROFILES
   ===================================================================== */
export const authApi = {
  // Step 1: Request OTP code
  requestOtp: async (email) => {
    return request('/auth/request-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  // Step 2: Verify OTP code
  verifyOtp: async (email, otp) => {
    const res = await request('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
    if (res?.access_token) {
      setAuthToken(res.access_token);
      setStoredUser({
        id: res.user_id,
        email: res.email,
        full_name: res.full_name,
        city: res.city,
        area_neighborhood: res.area_neighborhood,
      });
    }
    return res;
  },

  // Google OAuth
  googleAuth: async (idToken, redirectUri) => {
    const res = await request('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ id_token: idToken, redirect_uri: redirectUri }),
    });
    if (res?.access_token) {
      setAuthToken(res.access_token);
      setStoredUser(res);
    }
    return res;
  },

  // Get current user profile
  getMe: async () => {
    return request('/auth/me');
  },

  // Update profile details
  updateMe: async (profileData) => {
    const res = await request('/auth/me', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
    if (res) {
      setStoredUser(res);
    }
    return res;
  },

  // Alias for updateMe
  updateProfile: async (profileData) => {
    return authApi.updateMe(profileData);
  },

  // Upload parent or co-parent profile photo
  uploadPhoto: async (file, isPartner = false) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('is_partner', isPartner);
    const res = await request('/auth/me/photo', {
      method: 'POST',
      body: formData,
    });
    if (res) {
      setStoredUser(res);
    }
    return res;
  },

  // Update device geolocation with PostGIS privacy fuzzing (authenticated)
  updateLocation: async (latitude, longitude) => {
    return request('/auth/location', {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude }),
    });
  },

  // Public reverse geocoding for onboarding & guest location detection without authentication
  reverseGeocode: async (latitude, longitude) => {
    return request('/auth/reverse-geocode', {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude }),
    });
  },
};

/* =====================================================================
   2. PET MANAGEMENT
   ===================================================================== */
export const petsApi = {
  // List user's registered pets
  getPets: async () => {
    return request('/pets');
  },

  // Register a new pet (called on Onboarding completion)
  createPet: async (petData) => {
    const res = await request('/pets', {
      method: 'POST',
      body: JSON.stringify(petData),
    });
    if (res?.id) {
      setStoredActivePet(res);
    }
    return res;
  },

  // Get specific pet details
  getPet: async (petId) => {
    return request(`/pets/${petId}`);
  },

  // Update pet info
  updatePet: async (petId, updates) => {
    const res = await request(`/pets/${petId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    const current = getStoredActivePet();
    if (current && current.id === petId) {
      setStoredActivePet({ ...current, ...res });
    }
    return res;
  },

  // Upload pet photo
  uploadPhoto: async (petId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return request(`/pets/${petId}/photos`, {
      method: 'POST',
      body: formData,
    });
  },

  // Delete pet
  deletePet: async (petId) => {
    return request(`/pets/${petId}`, {
      method: 'DELETE',
    });
  },
};

/* =====================================================================
   3. 1-TAP DAILY CARE DIARY
   ===================================================================== */
export const diaryApi = {
  // 1-Tap event logging (feed, walk, water, potty, meds)
  logEvent: async ({ petId, eventType, details = {}, notes = '' }) => {
    return request('/diary/log', {
      method: 'POST',
      body: JSON.stringify({
        pet_id: petId,
        event_type: eventType,
        details,
        notes,
      }),
    });
  },

  // Get today's timeline and activity streak
  getTodayTimeline: async (petId) => {
    return request(`/diary/${petId}/today`);
  },

  // Get pet's daily routine checklist
  getRoutines: async (petId) => {
    return request(`/diary/${petId}/routines`);
  },

  // Toggle routine item completion
  toggleRoutine: async (routineId) => {
    return request(`/diary/routines/${routineId}/toggle`, {
      method: 'POST',
    });
  },

  // Get next upcoming care event
  getUpNext: async (petId) => {
    return request(`/diary/${petId}/up-next`);
  },

  // Generate shareable guest sitter pass token
  getShareToken: async (petId) => {
    return request(`/diary/${petId}/share-token`, {
      method: 'POST',
    });
  },

  // Public sitter pass view (No auth required)
  getSharedTimeline: async (shareToken) => {
    return request(`/diary/shared/${shareToken}`);
  },
};

/* =====================================================================
   4. AI NUTRITION LAB & MEAL SCHEDULES
   ===================================================================== */
export const dietApi = {
  // Generate on-demand AI diet plan
  generatePlan: async ({ petId, customPrompt = '', dietPreset = '', weightKg = null, activityLevel = null }) => {
    return request('/diet/generate', {
      method: 'POST',
      body: JSON.stringify({
        pet_id: petId,
        custom_prompt: customPrompt,
        diet_preset: dietPreset,
        weight_kg: weightKg,
        activity_level: activityLevel,
      }),
    });
  },

  // Adopt diet plan and configure daily meal schedule alarms
  adoptPlan: async (dietPlanId) => {
    return request('/diet/adopt', {
      method: 'POST',
      body: JSON.stringify({ diet_plan_id: dietPlanId }),
    });
  },

  // Get active diet plan
  getActivePlan: async (petId) => {
    return request(`/diet/${petId}/current`);
  },

  // Get active meal schedules
  getMealSchedules: async (petId) => {
    return request(`/diet/${petId}/schedules`);
  },

  // Save full manual / configured diet & routine plan
  saveManualPlan: async (planData) => {
    return request('/diet/manual-plan', {
      method: 'POST',
      body: JSON.stringify(planData),
    });
  },

  // Upload photo of pet food bag / care sheet for vision OCR extraction
  uploadRoutinePhoto: async (petId, file) => {
    const formData = new FormData();
    formData.append('pet_id', petId);
    formData.append('file', file);
    return request('/diet/upload-routine-photo', {
      method: 'POST',
      body: formData,
    });
  },

  // Generate diet and routine plan from breed, age, and weight using AI
  generateRoutineAi: async (petId) => {
    return request('/diet/generate-routine-ai', {
      method: 'POST',
      body: JSON.stringify({ pet_id: petId }),
    });
  },

  // Generate customized Walk & Play routine note using Google Gemini AI based on dog profile
  generateWalkPlayAi: async (petId, petProfile = {}) => {
    return request('/diet/generate-walk-play-ai', {
      method: 'POST',
      body: JSON.stringify({
        pet_id: petId,
        name: petProfile?.name,
        species: petProfile?.species || 'dog',
        breed: petProfile?.breed,
        age_years: petProfile?.age_years,
        weight_kg: petProfile?.weight_kg,
        energy_level: petProfile?.energy_level,
        play_style: petProfile?.play_style,
      }),
    });
  },

  // Get active diet & routine plan details
  getPlanDetail: async (petId) => {
    return request(`/diet/${petId}/detail`);
  },

  // AI Ingredient Safety & Toxicity Radar
  checkIngredientSafety: async (ingredient, species = 'dog') => {
    return request('/diet/ingredient-safety', {
      method: 'POST',
      body: JSON.stringify({ ingredient, species }),
    });
  },
};

/* =====================================================================
   5. MEDICAL VAULT & IMMUNIZATION
   ===================================================================== */
export const medicalApi = {
  // Get active prescriptions and clinical course
  getPrescriptions: async (petId) => {
    return request(`/medical/${petId}/prescriptions`);
  },

  // Upload prescription image for OCR and plain-language translation
  uploadPrescription: async (petId, file) => {
    const formData = new FormData();
    formData.append('pet_id', petId);
    formData.append('file', file);
    return request('/medical/prescriptions/upload', {
      method: 'POST',
      body: formData,
    });
  },

  // 1-Tap convert Rx into daily medication alarms
  convertRxToAlarms: async (prescriptionId) => {
    return request(`/medical/prescriptions/${prescriptionId}/create-alarms`, {
      method: 'POST',
    });
  },

  // Upload vaccine booklet photo
  uploadVaccine: async (petId, file) => {
    const formData = new FormData();
    formData.append('pet_id', petId);
    formData.append('file', file);
    return request('/medical/vaccines/upload', {
      method: 'POST',
      body: formData,
    });
  },

  // Get immunization roadmap and safe walk progress score
  getRoadmap: async (petId) => {
    return request(`/medical/${petId}/roadmap`);
  },

  // Toggle pet vaccine status (simulation / bulk override)
  toggleVaxStatus: async (petId) => {
    return request(`/medical/${petId}/toggle-vax-status`, {
      method: 'POST',
    });
  },

  // Toggle individual vaccine booster milestone
  toggleMilestone: async (petId, milestoneName, targetStatus = null) => {
    return request(`/medical/${petId}/toggle-milestone`, {
      method: 'POST',
      body: JSON.stringify({
        milestone_name: milestoneName,
        target_status: targetStatus,
      }),
    });
  },
};

/* =====================================================================
   6. AI HEALTH CHAT & EMERGENCY TRIAGE
   ===================================================================== */
export const healthApi = {
  // Ask health question with clinical guardrails and toxin emergency detection
  askHealthChat: async (petId, message, chatHistory = []) => {
    return request('/health-chat', {
      method: 'POST',
      body: JSON.stringify({
        pet_id: petId,
        message,
        chat_history: chatHistory,
      }),
    });
  },
};

/* =====================================================================
   7. COMMUNITY RADAR, PACK WALKS & MATCHMAKING
   ===================================================================== */
export const communityApi = {
  // Spatial PostGIS proximity radar for nearby pets
  getNearbyRadar: async ({ latitude, longitude, radiusKm = 5.0 }) => {
    return request(`/community/radar?latitude=${latitude}&longitude=${longitude}&radius_km=${radiusKm}`);
  },

  // Discover real community pets for swipe deck and browsing
  discoverPets: async ({ species, energyLevel, radiusKm = 25 } = {}) => {
    const params = new URLSearchParams();
    if (species && species !== 'all') params.append('species', species);
    if (energyLevel && energyLevel !== 'all') params.append('energy_level', energyLevel);
    if (radiusKm) params.append('radius_km', radiusKm);
    const qs = params.toString();
    return request(`/community/discover${qs ? `?${qs}` : ''}`);
  },

  // Get pet profiles that liked the logged-in user's pet
  getLikedYou: async () => {
    return request('/community/liked-you');
  },

  // Pack Walk Meetup Events
  getEvents: async () => {
    return request('/community/events');
  },

  createEvent: async (eventData) => {
    return request('/community/events', {
      method: 'POST',
      body: JSON.stringify(eventData),
    });
  },

  rsvpEvent: async (eventId, petId, status = 'going') => {
    return request(`/community/events/${eventId}/rsvp`, {
      method: 'POST',
      body: JSON.stringify({ pet_id: petId, status }),
    });
  },

  // Pet Discovery swipe (like or pass)
  swipePet: async (targetPetId, action = 'like', senderPetId = null, simulateReciprocal = false) => {
    return request('/community/swipe', {
      method: 'POST',
      body: JSON.stringify({
        target_pet_id: targetPetId,
        action: action,
        sender_pet_id: senderPetId || undefined,
        simulate_reciprocal: Boolean(simulateReciprocal),
      }),
    });
  },

  // Get mutual pet playdate matches
  getMatches: async () => {
    return request('/community/matches');
  },

  // Direct chat messaging
  sendMessage: async (recipientId, content, matchId = null) => {
    return request('/community/messages', {
      method: 'POST',
      body: JSON.stringify({
        recipient_id: recipientId,
        content: content,
        match_id: matchId || undefined,
      }),
    });
  },

  getMessages: async (otherUserId) => {
    return request(`/community/messages/${otherUserId}`);
  },
};

/* =====================================================================
   8. GOOGLE CALENDAR INTEGRATION
   ===================================================================== */
export const calendarApi = {
  getStatus: async () => {
    return request('/calendar/status');
  },
  getAuthUrl: async () => {
    return request('/calendar/auth-url');
  },
  scheduleFeeding: async (data) => {
    return request('/calendar/schedule-feeding', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  scheduleVaccine: async (data) => {
    return request('/calendar/schedule-vaccine', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

/* =====================================================================
   9. WEATHER & PAW WALKING SAFETY (WeatherAPI.com Realtime)
   ===================================================================== */
export const weatherApi = {
  getPawForecast: async (location = null, petName = 'your pet') => {
    const params = new URLSearchParams();
    if (location) params.append('location', location);
    if (petName) params.append('pet_name', petName);
    const qs = params.toString();
    try {
      return await request(`/weather/paw-forecast${qs ? `?${qs}` : ''}`);
    } catch (err) {
      console.warn('Backend weather endpoint error, using direct WeatherAPI fallback:', err);
      // Direct client-side WeatherAPI fallback with the user's key
      const q = location && String(location).trim() ? encodeURIComponent(String(location).trim()) : 'auto:ip';
      let pet = petName && String(petName).trim() ? String(petName).trim() : 'your pet';
      if (pet.length > 0 && pet[0] === pet[0].toLowerCase()) {
        pet = pet.charAt(0).toUpperCase() + pet.slice(1);
      }
      const apiKey = 'd47d0bdda08c4acf9a3100404261309';
      const directUrl = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${q}&days=1`;
      const res = await fetch(directUrl);
      if (!res.ok) throw new Error(`WeatherAPI returned ${res.status}`);
      const data = await res.json();
      
      const current = data.current || {};
      const loc = data.location || {};
      const forecastDay = data.forecast?.forecastday?.[0]?.day || {};
      const tempC = Math.round(current.temp_c ?? 25);
      const maxTempC = Math.round(forecastDay.maxtemp_c ?? tempC);
      const isDay = current.is_day ?? 1;
      const condText = current.condition?.text || 'Clear';
      const condLower = condText.toLowerCase();
      let icon = current.condition?.icon || '';
      if (icon.startsWith('//')) icon = `https:${icon}`;

      let title = `Warm day ahead (${tempC}°C)`;
      let advisory = `Walk ${pet} before 10 AM or after 5 PM to prevent hot pavement burns.`;
      let level = 'warning';
      let iconName = 'sunny';

      if (tempC >= 33 || (isDay && maxTempC >= 35)) {
        title = `Extreme heat advisory (${tempC}°C)`;
        advisory = `High pavement burn risk! Walk ${pet} on grass only before 9 AM or after 7 PM. Keep water accessible.`;
        iconName = 'wb_sunny';
        level = 'danger';
      } else if (condLower.includes('thunder') || condLower.includes('heavy rain') || condLower.includes('storm')) {
        title = `Storm alert (${tempC}°C)`;
        advisory = `Severe conditions outside! Keep walks brief for ${pet} and dry paws immediately after returning.`;
        iconName = 'thunderstorm';
        level = 'danger';
      } else if (condLower.includes('rain') || condLower.includes('drizzle') || condLower.includes('shower')) {
        title = `${condText} (${tempC}°C)`;
        advisory = `Wet paws alert! Dry ${pet}'s paws thoroughly after outdoor walks to prevent moisture irritation.`;
        iconName = 'rainy';
        level = 'info';
      } else if (condLower.includes('smoke') || condLower.includes('haze') || condLower.includes('smog')) {
        title = `${condText} (${tempC}°C)`;
        advisory = `Air quality notice: Keep outdoor cardio gentle for ${pet}. Opt for indoor sniff enrichment.`;
        iconName = 'foggy';
        level = 'warning';
      } else if (tempC < 7 || condLower.includes('snow') || condLower.includes('ice')) {
        title = `Cold weather advisory (${tempC}°C)`;
        advisory = `Brisk cold! Keep walks short for ${pet} and check paw pads for ice or road salt.`;
        iconName = 'ac_unit';
        level = 'warning';
      } else if (tempC >= 28 || (isDay && maxTempC >= 30)) {
        title = `Warm day ahead (${tempC}°C)`;
        advisory = `Walk ${pet} before 10 AM or after 5 PM to prevent hot pavement burns.`;
        iconName = 'sunny';
        level = 'warning';
      } else if (tempC >= 16 && tempC < 28) {
        if (isDay === 0) {
          title = `Pleasant evening (${tempC}°C)`;
          advisory = `Cool pavements and calm breeze. Great time for a relaxing walk with ${pet}.`;
          iconName = 'nights_stay';
          level = 'good';
        } else {
          title = `Pleasant day ahead (${tempC}°C)`;
          advisory = `Ideal walking weather for ${pet}! Great time for a longer park walk, frisbee, or pack playdate.`;
          iconName = 'park';
          level = 'good';
        }
      }

      return {
        city: loc.name || 'Local Area',
        region: loc.region || '',
        country: loc.country || '',
        temp_c: tempC,
        temp_f: Math.round(current.temp_f ?? 77),
        feelslike_c: Math.round(current.feelslike_c ?? tempC),
        max_temp_c: maxTempC,
        min_temp_c: Math.round(forecastDay.mintemp_c ?? tempC),
        condition: condText,
        condition_icon: icon,
        icon_name: iconName,
        title,
        advisory,
        level,
        humidity: current.humidity,
        uv: current.uv,
        wind_kph: current.wind_kph,
        is_realtime: true
      };
    }
  }
};

export default {
  auth: authApi,
  pets: petsApi,
  diary: diaryApi,
  diet: dietApi,
  medical: medicalApi,
  community: communityApi,
  calendar: calendarApi,
  weather: weatherApi,
};

