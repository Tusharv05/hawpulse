import React, { useState, useEffect } from 'react';
import {
  authApi,
  petsApi,
  getStoredUser,
  setStoredUser,
  getStoredActivePet,
  setStoredActivePet
} from '../services/api';
import {
  resolvePetAvatar,
  hasCustomPetPhoto,
  catDefaultAvatar,
  dogDefaultAvatar
} from '../utils/petAvatar';
import {
  calculateBirthDateFromAge,
  getPetAgeDetails,
  formatPetAge as formatPetAgeUtil
} from '../utils/petAge';
import vectorMaleProfile from '../assets/vectormaleprofilepic.png';
import vectorFemaleProfile from '../assets/vectorfemaleprofilepic.png';

export default function ProfileSettings({ setActiveTab, onOpenOnboarding }) {
  const [activeProfileTab, setActiveProfileTab] = useState('me');
  const getInitialHouseholdMode = () => {
    const saved = localStorage.getItem('pawcircle_household_mode');
    if (saved === 'solo' || saved === 'couple') return saved;
    try {
      const draft = JSON.parse(localStorage.getItem('pawcircle_onboarding_draft') || '{}');
      if (draft.household) return draft.household;
    } catch {}
    return 'solo';
  };

  const [householdMode, setHouseholdModeState] = useState(() => {
    const user = getStoredUser();
    if (user?.household_mode) return user.household_mode;
    return getInitialHouseholdMode();
  });

  const setHouseholdMode = (mode) => {
    setHouseholdModeState(mode);
    localStorage.setItem('pawcircle_household_mode', mode);
  };

  const [userProfile, setUserProfile] = useState(getStoredUser() || {});
  const [bioText, setBioText] = useState(() => userProfile?.bio || localStorage.getItem('pawcircle_parent_bio') || '');
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [petList, setPetList] = useState(() => {
    const active = getStoredActivePet();
    return active ? [active] : [];
  });
  const [parentName, setParentName] = useState(userProfile?.full_name || '');
  const [parentGender, setParentGender] = useState(() => userProfile?.gender || localStorage.getItem('pawcircle_parent_gender') || 'female');
  const [parentAvatar, setParentAvatar] = useState(() => userProfile?.avatar_url || localStorage.getItem('pawcircle_parent_avatar') || '');
  const [isUploadingParentPhoto, setIsUploadingParentPhoto] = useState(false);
  const [parentVibe, setParentVibe] = useState(() => userProfile?.vibe_routine || localStorage.getItem('pawcircle_parent_vibe') || '');
  const [parentHobbies, setParentHobbies] = useState(() => userProfile?.hobbies || localStorage.getItem('pawcircle_parent_hobbies') || '');
  const [partnerName, setPartnerName] = useState(() => {
    if (userProfile?.partner_name) return userProfile.partner_name;
    const cached = localStorage.getItem('pawcircle_partner_name');
    if (cached && cached !== 'Rahul') return cached;
    return '';
  });
  const [partnerGender, setPartnerGender] = useState(() => userProfile?.partner_gender || localStorage.getItem('pawcircle_partner_gender') || 'male');
  const [partnerAvatar, setPartnerAvatar] = useState(() => userProfile?.partner_avatar_url || localStorage.getItem('pawcircle_partner_avatar') || '');
  const [isUploadingPartnerPhoto, setIsUploadingPartnerPhoto] = useState(false);
  const [partnerVibe, setPartnerVibe] = useState(() => userProfile?.partner_vibe || localStorage.getItem('pawcircle_partner_vibe') || '');
  const [partnerHobbies, setPartnerHobbies] = useState(() => userProfile?.partner_hobbies || localStorage.getItem('pawcircle_partner_hobbies') || '');
  const [userCity, setUserCity] = useState(
    userProfile?.area_neighborhood
      ? `${userProfile.area_neighborhood}, ${userProfile.city}`
      : (userProfile?.city && userProfile.city !== 'Detecting City...' ? userProfile.city : '')
  );

  const resolveParentAvatar = (url, gender) => {
    if (url && typeof url === 'string' && url.trim() !== '') {
      if (url.startsWith('/uploads/')) {
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
        const host = apiBase.replace(/\/api\/v1\/?$/, '');
        return `${host}${url}`;
      }
      return url;
    }
    return gender === 'male' ? vectorMaleProfile : vectorFemaleProfile;
  };
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const [locationFeedback, setLocationFeedback] = useState('');
  const [discoveryDistance, setDiscoveryDistance] = useState(() => {
    const saved = localStorage.getItem('pawcircle_discovery_distance');
    return saved ? Number(saved) : 10;
  });
  const [showDistanceModal, setShowDistanceModal] = useState(false);

  const handleDistanceChange = (val) => {
    const num = Math.min(100, Math.max(1, Number(val)));
    setDiscoveryDistance(num);
    localStorage.setItem('pawcircle_discovery_distance', String(num));
    showToast(`Discovery distance set to ${num} km!`);
  };

  // Pet photo, allergies & vibe state
  const [uploadingPetId, setUploadingPetId] = useState(null);
  const [toastNotice, setToastNotice] = useState(null);
  const [allergyModalPet, setAllergyModalPet] = useState(null);
  const [tempSelectedAllergies, setTempSelectedAllergies] = useState([]);
  const [customAllergyText, setCustomAllergyText] = useState('');
  const [vibeModalPet, setVibeModalPet] = useState(null);
  const [tempEnergyLevel, setTempEnergyLevel] = useState('high');
  const [tempTraits, setTempTraits] = useState([]);
  const [customTraitInput, setCustomTraitInput] = useState('');

  // Comprehensive Pet Details Edit Modal state
  const [editDetailsPet, setEditDetailsPet] = useState(null);
  const [editPetName, setEditPetName] = useState('');
  const [editPetSpecies, setEditPetSpecies] = useState('dog');
  const [editPetGender, setEditPetGender] = useState('male');
  const [editPetBreed, setEditPetBreed] = useState('');
  const [editPetWeight, setEditPetWeight] = useState('');
  const [editPetAgeValue, setEditPetAgeValue] = useState('2');
  const [editPetAgeUnit, setEditPetAgeUnit] = useState('years'); // 'years' or 'months'
  const [editPetNeutered, setEditPetNeutered] = useState(false);
  const [editPetVaxStatus, setEditPetVaxStatus] = useState('full');
  const [isSavingPetDetails, setIsSavingPetDetails] = useState(false);

  const showToast = (message, type = 'success') => {
    setToastNotice({ message, type });
    setTimeout(() => setToastNotice(null), 3500);
  };

  useEffect(() => {
    async function loadProfile() {
      try {
        const me = await authApi.getMe();
        if (me) {
          setUserProfile(me);
          if (me.full_name) setParentName(me.full_name);
          if (me.city && me.city !== 'Detecting City...') {
            setUserCity(me.area_neighborhood ? `${me.area_neighborhood}, ${me.city}` : me.city);
          }
          if (me.gender) setParentGender(me.gender);
          if (me.avatar_url) setParentAvatar(me.avatar_url);
          if (me.hobbies) setParentHobbies(me.hobbies);
          if (me.vibe_routine) setParentVibe(me.vibe_routine);
          if (me.bio) setBioText(me.bio);
          if (me.household_mode) setHouseholdModeState(me.household_mode);
          setPartnerName(me.partner_name || '');
          if (me.partner_gender) setPartnerGender(me.partner_gender);
          if (me.partner_avatar_url) setPartnerAvatar(me.partner_avatar_url);
          if (me.partner_hobbies) setPartnerHobbies(me.partner_hobbies);
          if (me.partner_vibe) setPartnerVibe(me.partner_vibe);
        }
      } catch (err) {
        console.warn('Profile load note:', err.message);
      }

      try {
        const pets = await petsApi.getPets();
        if (pets && pets.length > 0) {
          setPetList(pets);
        } else {
          setPetList([]);
        }
      } catch (err) {
        console.warn('Pets load note:', err.message);
        setPetList([]);
      }
    }
    loadProfile();

    const handlePetUpdated = async () => {
      try {
        const pets = await petsApi.getPets();
        if (pets && Array.isArray(pets)) {
          setPetList(pets);
          return;
        }
      } catch (err) {
        console.warn('Refresh pets note:', err);
      }
      const active = getStoredActivePet();
      if (active) {
        setPetList(prev => {
          if (!prev || prev.length === 0) return [active];
          const exists = prev.some(p => p.id === active.id);
          if (!exists) return [...prev, active];
          return prev.map(p => (p.id === active.id ? { ...p, ...active } : p));
        });
      }
    };
    window.addEventListener('pawcircle_pet_updated', handlePetUpdated);
    return () => window.removeEventListener('pawcircle_pet_updated', handlePetUpdated);
  }, []);

  const handleAutoDetectLocation = () => {
    setIsUpdatingLocation(true);
    setLocationFeedback('');

    if (!navigator.geolocation) {
      setLocationFeedback('Geolocation is not supported by your browser.');
      setIsUpdatingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await authApi.updateLocation(pos.coords.latitude, pos.coords.longitude);
          const detectedCity = res.area_neighborhood
            ? `${res.area_neighborhood}, ${res.city}`
            : res.city;
          setUserCity(detectedCity);
          setUserProfile(prev => ({ ...prev, city: res.city, area_neighborhood: res.area_neighborhood }));
          setLocationFeedback(`Area successfully updated to ${detectedCity}!`);
        } catch (err) {
          setLocationFeedback('Failed to update area: ' + err.message);
        } finally {
          setIsUpdatingLocation(false);
          setTimeout(() => setLocationFeedback(''), 4000);
        }
      },
      (err) => {
        console.warn('Location permission notice:', err);
        setIsUpdatingLocation(false);
        setLocationFeedback('Location permission was denied in browser.');
        setTimeout(() => setLocationFeedback(''), 4000);
      },
      { timeout: 10000 }
    );
  };

  // Settings state
  const [settings, setSettings] = useState({
    mealReminders: true,
    medicationAlarms: true,
    playdateInvites: true,
    fuzzyLocation: true,
    incognitoMode: false
  });

  const toggleSetting = (key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    try {
      const updated = await authApi.updateMe({
        full_name: parentName,
        city: userCity,
        gender: parentGender,
        avatar_url: parentAvatar || null,
        hobbies: parentHobbies,
        vibe_routine: parentVibe,
        bio: bioText,
        household_mode: householdMode,
        partner_name: householdMode === 'couple' ? partnerName : null,
        partner_gender: householdMode === 'couple' ? partnerGender : null,
        partner_avatar_url: householdMode === 'couple' ? (partnerAvatar || null) : null,
        partner_hobbies: householdMode === 'couple' ? partnerHobbies : null,
        partner_vibe: householdMode === 'couple' ? partnerVibe : null,
      });
      setUserProfile(updated);
      setStoredUser(updated);
    } catch (err) {
      console.warn('Profile update note:', err.message);
    }
    localStorage.setItem('pawcircle_parent_gender', parentGender);
    localStorage.setItem('pawcircle_parent_avatar', parentAvatar || '');
    localStorage.setItem('pawcircle_parent_vibe', parentVibe);
    localStorage.setItem('pawcircle_parent_bio', bioText);
    localStorage.setItem('pawcircle_parent_hobbies', parentHobbies);
    localStorage.setItem('pawcircle_household_mode', householdMode);
    if (householdMode === 'couple') {
      localStorage.setItem('pawcircle_partner_name', partnerName);
      localStorage.setItem('pawcircle_partner_gender', partnerGender);
      localStorage.setItem('pawcircle_partner_avatar', partnerAvatar || '');
      localStorage.setItem('pawcircle_partner_vibe', partnerVibe);
      localStorage.setItem('pawcircle_partner_hobbies', partnerHobbies);
    }
    window.dispatchEvent(new Event('pawcircle_profile_updated'));
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2500);
  };

  const handleParentPhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (JPEG, PNG, WebP).', 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast('Image size exceeds 10MB limit.', 'error');
      return;
    }

    setIsUploadingParentPhoto(true);

    try {
      const res = await authApi.uploadPhoto(file, false);
      const photoUrl = res?.avatar_url;
      if (photoUrl) {
        setParentAvatar(photoUrl);
        localStorage.setItem('pawcircle_parent_avatar', photoUrl);
        setUserProfile(prev => ({ ...prev, avatar_url: photoUrl }));
        window.dispatchEvent(new Event('pawcircle_profile_updated'));
        showToast('Profile photo updated successfully!');
      }
    } catch (err) {
      console.warn('Parent photo upload note:', err.message);
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target.result;
        setParentAvatar(dataUrl);
        localStorage.setItem('pawcircle_parent_avatar', dataUrl);
        window.dispatchEvent(new Event('pawcircle_profile_updated'));
        showToast('Profile photo updated!');
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUploadingParentPhoto(false);
    }
  };

  const handlePartnerPhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (JPEG, PNG, WebP).', 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast('Image size exceeds 10MB limit.', 'error');
      return;
    }

    setIsUploadingPartnerPhoto(true);

    try {
      const res = await authApi.uploadPhoto(file, true);
      const photoUrl = res?.partner_avatar_url;
      if (photoUrl) {
        setPartnerAvatar(photoUrl);
        localStorage.setItem('pawcircle_partner_avatar', photoUrl);
        setUserProfile(prev => ({ ...prev, partner_avatar_url: photoUrl }));
        showToast('Co-parent photo updated successfully!');
      }
    } catch (err) {
      console.warn('Partner photo upload note:', err.message);
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target.result;
        setPartnerAvatar(dataUrl);
        localStorage.setItem('pawcircle_partner_avatar', dataUrl);
        showToast('Co-parent photo updated!');
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUploadingPartnerPhoto(false);
    }
  };

  /* =========================================================
     PET PHOTO & SPECIES MANAGEMENT HANDLERS
     ========================================================= */
  const handlePhotoFileSelect = async (pet, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (JPEG, PNG, WebP).', 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast('Image size exceeds 10MB limit.', 'error');
      return;
    }

    const petId = pet.id || 'default';
    setUploadingPetId(petId);

    try {
      if (pet.id && pet.id !== 'default') {
        const res = await petsApi.uploadPhoto(pet.id, file);
        const resolvedAvatar = res.avatar_url || (Array.isArray(res.photos) && res.photos.length > 0 ? res.photos[res.photos.length - 1] : null);
        const updatedPet = { ...pet, ...res, avatar_url: resolvedAvatar };
        setPetList(prev => prev.map(p => (p.id === pet.id ? updatedPet : p)));
        setStoredActivePet(updatedPet);
        window.dispatchEvent(new Event('pawcircle_pet_updated'));
        showToast(`Photo updated successfully for ${pet.name}!`);
      } else {
        // Fallback for unpersisted / demo pet
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target.result;
          const updatedPet = { ...pet, avatar_url: dataUrl };
          setPetList(prev => prev.map(p => (p.id === pet.id ? updatedPet : p)));
          setStoredActivePet(updatedPet);
          window.dispatchEvent(new Event('pawcircle_pet_updated'));
          showToast(`Photo updated for ${pet.name}!`);
          setUploadingPetId(null);
        };
        reader.readAsDataURL(file);
        return;
      }
    } catch (err) {
      console.error('Photo upload note:', err);
      // Fallback preview
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target.result;
        const updatedPet = { ...pet, avatar_url: dataUrl };
        setPetList(prev => prev.map(p => (p.id === pet.id ? updatedPet : p)));
        setStoredActivePet(updatedPet);
        window.dispatchEvent(new Event('pawcircle_pet_updated'));
        showToast(`Photo updated for ${pet.name}!`);
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingPetId(null);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = async (pet) => {
    try {
      if (pet.id && pet.id !== 'default') {
        await petsApi.updatePet(pet.id, { avatar_url: null });
      }
      const updatedPet = { ...pet, avatar_url: null, photo_url: null, photos: [] };
      setPetList(prev => prev.map(p => (p.id === pet.id ? updatedPet : p)));
      setStoredActivePet(updatedPet);
      window.dispatchEvent(new Event('pawcircle_pet_updated'));
      showToast(`Custom photo removed. Default vector profile restored for ${pet.name}.`);
    } catch (err) {
      console.warn('Remove photo note:', err.message);
    }
  };

  const handleSpeciesToggle = async (pet, newSpecies) => {
    try {
      if (pet.id && pet.id !== 'default') {
        await petsApi.updatePet(pet.id, { species: newSpecies });
      }
      const updatedPet = { ...pet, species: newSpecies };
      setPetList(prev => prev.map(p => (p.id === pet.id ? updatedPet : p)));
      setStoredActivePet(updatedPet);
      window.dispatchEvent(new Event('pawcircle_pet_updated'));
      showToast(`Species set to ${newSpecies === 'cat' ? 'Cat 🐱' : 'Dog 🐶'}`);
    } catch (err) {
      console.warn('Species toggle note:', err.message);
    }
  };

  /* =========================================================
     ALLERGY MANAGEMENT HANDLERS
     ========================================================= */
  const openAllergyModal = (pet) => {
    setAllergyModalPet(pet);
    setTempSelectedAllergies(Array.isArray(pet.allergies) ? [...pet.allergies] : []);
    setCustomAllergyText('');
  };

  const closeAllergyModal = () => {
    setAllergyModalPet(null);
    setCustomAllergyText('');
  };

  const handleToggleTempAllergy = (allergen) => {
    const trimmed = allergen.trim();
    if (!trimmed) return;
    setTempSelectedAllergies(prev => {
      const exists = prev.some(a => a.toLowerCase() === trimmed.toLowerCase());
      if (exists) {
        return prev.filter(a => a.toLowerCase() !== trimmed.toLowerCase());
      } else {
        return [...prev, trimmed];
      }
    });
  };

  const handleAddCustomAllergy = () => {
    const trimmed = customAllergyText.trim();
    if (!trimmed) return;
    if (!tempSelectedAllergies.some(a => a.toLowerCase() === trimmed.toLowerCase())) {
      setTempSelectedAllergies(prev => [...prev, trimmed]);
    }
    setCustomAllergyText('');
  };

  const handleSaveAllergies = async () => {
    if (!allergyModalPet) return;
    const petId = allergyModalPet.id;
    try {
      if (petId && petId !== 'default') {
        await petsApi.updatePet(petId, { allergies: tempSelectedAllergies });
      }
      const updatedPet = { ...allergyModalPet, allergies: tempSelectedAllergies };
      setPetList(prev => prev.map(p => (p.id === petId ? updatedPet : p)));
      setStoredActivePet(updatedPet);
      window.dispatchEvent(new Event('pawcircle_pet_updated'));
      showToast(`Allergies updated for ${allergyModalPet.name}!`);
    } catch (err) {
      console.warn('Update allergies note:', err.message);
      const updatedPet = { ...allergyModalPet, allergies: tempSelectedAllergies };
      setPetList(prev => prev.map(p => (p.id === petId ? updatedPet : p)));
      setStoredActivePet(updatedPet);
      window.dispatchEvent(new Event('pawcircle_pet_updated'));
      showToast(`Allergies saved for ${allergyModalPet.name}!`);
    } finally {
      closeAllergyModal();
    }
  };

  const handleQuickRemoveAllergy = async (pet, allergyToRemove) => {
    const updated = (pet.allergies || []).filter(a => a.toLowerCase() !== allergyToRemove.toLowerCase());
    try {
      if (pet.id && pet.id !== 'default') {
        await petsApi.updatePet(pet.id, { allergies: updated });
      }
      const updatedPet = { ...pet, allergies: updated };
      setPetList(prev => prev.map(p => (p.id === pet.id ? updatedPet : p)));
      setStoredActivePet(updatedPet);
      window.dispatchEvent(new Event('pawcircle_pet_updated'));
      showToast(`Removed allergy "${allergyToRemove}"`);
    } catch (err) {
      console.warn('Quick remove allergy note:', err.message);
    }
  };

  /* =========================================================
     PET VIBE & PERSONALITY HANDLERS (SIGN-IN STEP 5 PARITY)
     ========================================================= */
  const openVibeModal = (pet) => {
    setVibeModalPet(pet);
    setTempEnergyLevel(pet.energy_level || 'high');
    const existingTraits = pet.play_style
      ? (Array.isArray(pet.play_style)
          ? pet.play_style
          : pet.play_style.split(',').map(s => s.trim()).filter(Boolean))
      : ['Ball Chaser', 'Gentle with kids'];
    setTempTraits(existingTraits);
    setCustomTraitInput('');
  };

  const closeVibeModal = () => {
    setVibeModalPet(null);
    setCustomTraitInput('');
  };

  const handleToggleTrait = (trait) => {
    const trimmed = trait.trim();
    if (!trimmed) return;
    setTempTraits(prev => {
      const exists = prev.some(t => t.toLowerCase() === trimmed.toLowerCase());
      if (exists) {
        return prev.filter(t => t.toLowerCase() !== trimmed.toLowerCase());
      } else {
        return [...prev, trimmed];
      }
    });
  };

  const handleAddCustomTrait = () => {
    const trimmed = customTraitInput.trim();
    if (!trimmed) return;
    if (!tempTraits.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
      setTempTraits(prev => [...prev, trimmed]);
    }
    setCustomTraitInput('');
  };

  const handleSaveVibe = async () => {
    if (!vibeModalPet) return;
    const petId = vibeModalPet.id;
    const playStyleString = tempTraits.join(', ');
    const updatedPet = {
      ...vibeModalPet,
      energy_level: tempEnergyLevel,
      play_style: playStyleString
    };

    try {
      if (petId && petId !== 'default') {
        await petsApi.updatePet(petId, {
          energy_level: tempEnergyLevel,
          play_style: playStyleString
        });
      }
      setPetList(prev => prev.map(p => (p.id === petId ? updatedPet : p)));
      setStoredActivePet(updatedPet);
      window.dispatchEvent(new Event('pawcircle_pet_updated'));
      showToast(`Pet vibe updated for ${vibeModalPet.name}!`);
    } catch (err) {
      console.warn('Update vibe note:', err.message);
      setPetList(prev => prev.map(p => (p.id === petId ? updatedPet : p)));
      setStoredActivePet(updatedPet);
      window.dispatchEvent(new Event('pawcircle_pet_updated'));
      showToast(`Pet vibe saved for ${vibeModalPet.name}!`);
    } finally {
      closeVibeModal();
    }
  };

  /* =========================================================
     COMPREHENSIVE PET DETAILS EDIT MODAL HANDLERS
     ========================================================= */
  const openEditDetailsModal = (pet) => {
    setEditDetailsPet(pet);
    setEditPetName(pet.name || '');
    setEditPetSpecies(pet.species?.toLowerCase() === 'cat' ? 'cat' : 'dog');
    setEditPetGender(pet.gender?.toLowerCase() === 'female' ? 'female' : 'male');
    setEditPetBreed(pet.breed || '');
    setEditPetWeight(pet.weight_kg != null ? String(pet.weight_kg) : '');
    setEditPetNeutered(Boolean(pet.is_neutered));
    setEditPetVaxStatus(pet.vax_status || 'full');

    if (pet.birth_date) {
      const ageInfo = getPetAgeDetails(pet.birth_date);
      setEditPetAgeUnit(ageInfo.unit === 'months' ? 'months' : 'years');
      setEditPetAgeValue(String(ageInfo.value));
    } else {
      setEditPetAgeUnit('years');
      setEditPetAgeValue('2');
    }
  };

  const formatPetAge = (birthDate) => {
    if (!birthDate) return null;
    return formatPetAgeUtil(birthDate);
  };

  const closeEditDetailsModal = () => {
    setEditDetailsPet(null);
  };

  const handleSavePetDetails = async () => {
    if (!editDetailsPet) return;
    setIsSavingPetDetails(true);
    const petId = editDetailsPet.id;

    const calculatedBirthDate = calculateBirthDateFromAge(editPetAgeValue, editPetAgeUnit);

    const updates = {
      name: editPetName.trim() || editDetailsPet.name,
      species: editPetSpecies,
      gender: editPetGender,
      breed: editPetBreed.trim() || (editPetSpecies === 'cat' ? 'Domestic Shorthair' : 'Mix'),
      weight_kg: parseFloat(editPetWeight) || Number(editDetailsPet.weight_kg) || 10.0,
      birth_date: calculatedBirthDate,
      is_neutered: editPetNeutered,
      vax_status: editPetVaxStatus
    };

    let updatedPet = {
      ...editDetailsPet,
      ...updates
    };

    try {
      if (petId && petId !== 'default') {
        const saved = await petsApi.updatePet(petId, updates);
        if (saved && saved.id) {
          updatedPet = { ...updatedPet, ...saved };
        }
      }
      sessionStorage.removeItem('pawcircle_dailycare_cache_v5');
      setPetList(prev => prev.map(p => (p.id === petId ? updatedPet : p)));
      setStoredActivePet(updatedPet);
      window.dispatchEvent(new Event('pawcircle_pet_updated'));
      showToast(`Details updated for ${updatedPet.name}!`);
      closeEditDetailsModal();
    } catch (err) {
      console.warn('Update pet details note:', err.message);
      sessionStorage.removeItem('pawcircle_dailycare_cache_v5');
      setPetList(prev => prev.map(p => (p.id === petId ? updatedPet : p)));
      setStoredActivePet(updatedPet);
      window.dispatchEvent(new Event('pawcircle_pet_updated'));
      showToast(`Details saved for ${updatedPet.name}!`);
      closeEditDetailsModal();
    } finally {
      setIsSavingPetDetails(false);
    }
  };

  return (
    <div className="w-full max-w-[1140px] mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-container text-on-surface font-label-sm text-xs font-bold mb-2">
            <span className="material-symbols-outlined text-[15px]">badge</span>
            <span>Dossier • Account ID: #PC-8842</span>
          </div>
          <h1 className="font-headline-lg text-3xl sm:text-4xl font-bold text-on-surface tracking-tight">
            Profile &amp; settings
          </h1>
          <p className="font-body-md text-sm sm:text-base text-on-surface-variant max-w-xl mt-1">
            Manage your family dossier, pet bio data, automated wellness reminders, and circle privacy thresholds.
          </p>
        </div>

        {/* Status Chips */}
        <div className="flex items-center gap-2 bg-surface-container-lowest p-2 rounded-2xl border border-outline-variant/40 shadow-xs">
          <button
            type="button"
            onClick={() => setShowDistanceModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-low hover:bg-surface-container text-xs font-medium text-on-surface transition-all cursor-pointer shadow-xs border border-outline-variant/20 group"
            title="Adjust maximum discovery distance (Bumble/Tinder style)"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-tertiary animate-pulse"></span>
            <span>Discoverable in {discoveryDistance} km</span>
            <span className="material-symbols-outlined text-[15px] text-outline group-hover:text-primary transition-colors">tune</span>
          </button>
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary-container text-on-surface font-label-sm text-xs font-bold">
            <span className="material-symbols-outlined text-[16px]">verified</span>
            <span>Full Dossier</span>
          </div>
        </div>
      </div>

      {/* Segmented Tab Nav Controller */}
      <div className="flex p-1 rounded-full bg-surface-container w-full sm:w-fit gap-1 shadow-xs border border-outline-variant/30">
        <button
          onClick={() => setActiveProfileTab('me')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-5 py-2 rounded-full font-label-md text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeProfileTab === 'me'
              ? 'bg-primary-container text-on-surface shadow-xs'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">group</span>
          <span>Me &amp; Family</span>
        </button>
        <button
          onClick={() => setActiveProfileTab('pets')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-5 py-2 rounded-full font-label-md text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeProfileTab === 'pets'
              ? 'bg-primary-container text-on-surface shadow-xs'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">pets</span>
          <span>My Pets ({petList ? petList.length : 0})</span>
        </button>
        <button
          onClick={() => setActiveProfileTab('settings')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-5 py-2 rounded-full font-label-md text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeProfileTab === 'settings'
              ? 'bg-primary-container text-on-surface shadow-xs'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">security</span>
          <span>Settings &amp; Privacy</span>
        </button>
      </div>

      {/* ================= TAB 1: ME & FAMILY ================= */}
      {activeProfileTab === 'me' && (
        <section className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 border border-outline-variant/40 shadow-xs flex flex-col gap-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-outline-variant/20 gap-4">
            <div>
              <span className="font-label-sm text-xs text-primary uppercase tracking-wider font-bold">Household Identity</span>
              <h2 className="font-headline-md text-xl font-bold text-on-surface mt-0.5">Parent dossier</h2>
              <p className="text-xs text-on-surface-variant">Visible to verified dog parents in local weekend packs &amp; playdate requests.</p>
            </div>

            {/* Add Co-Parent Button or Active Couple Mode */}
            {householdMode !== 'couple' ? (
              <button
                type="button"
                onClick={() => setHouseholdMode('couple')}
                className="px-4 py-2 rounded-full bg-primary-container text-on-surface text-xs font-bold hover:bg-primary-fixed-dim transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <span className="material-symbols-outlined text-[17px]">group_add</span>
                <span>Add a co-partner / couple</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-full bg-primary-container/80 text-on-surface text-xs font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px]">group</span>
                  <span>Couple mode</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setHouseholdMode('solo');
                    authApi.updateMe({ household_mode: 'solo' }).catch(() => {});
                  }}
                  className="px-3 py-1.5 rounded-full border border-outline-variant/40 hover:bg-surface-container text-outline hover:text-error text-xs font-semibold transition-all cursor-pointer flex items-center gap-1"
                  title="Switch back to solo parent mode"
                >
                  <span className="material-symbols-outlined text-[15px]">person_remove</span>
                  <span>Remove co-parent</span>
                </button>
              </div>
            )}
          </div>

          {/* Parents Grid - single parent spans full width cleanly */}
          <div className={`grid gap-6 ${householdMode === 'couple' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
            {/* Parent 1 */}
            <div className="bg-white rounded-2xl p-5 border border-outline-variant/30 flex flex-col sm:flex-row items-start gap-4 shadow-2xs">
              <div className="flex flex-col items-center gap-2 shrink-0 self-center sm:self-start">
                <div className="relative group shrink-0">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-white border-2 border-primary-container shadow-xs flex items-center justify-center">
                    <img
                      src={resolveParentAvatar(parentAvatar, parentGender)}
                      alt={parentName || 'Parent'}
                      className={`w-full h-full ${parentAvatar ? 'object-cover' : 'object-contain p-1 bg-white'}`}
                    />
                  </div>
                  <label
                    htmlFor="parent-avatar-file"
                    className="absolute inset-0 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer text-[9px] font-bold"
                    title={parentAvatar ? "Change profile photo" : "Add profile photo"}
                  >
                    <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                    <span>{parentAvatar ? 'Change' : 'Add'}</span>
                  </label>
                  <input
                    id="parent-avatar-file"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleParentPhotoSelect}
                  />
                  {householdMode === 'couple' && (
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary-container flex items-center justify-center text-[11px] font-bold text-on-surface shadow-2xs">1</span>
                  )}
                </div>

                {/* Button for adding profile pic as done in My Pet */}
                <div className="flex flex-col items-center gap-1">
                  <label
                    htmlFor="parent-avatar-file"
                    className="px-2.5 py-1 rounded-full bg-surface-container border border-outline-variant/40 hover:bg-surface-container-high text-on-surface text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                    title={parentAvatar ? "Change profile photo" : "Upload a photo"}
                  >
                    {isUploadingParentPhoto ? (
                      <>
                        <span className="material-symbols-outlined text-[13px] animate-spin">progress_activity</span>
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[13px]">add_a_photo</span>
                        <span>{parentAvatar ? 'Change Photo' : 'Add Photo'}</span>
                      </>
                    )}
                  </label>
                  {parentAvatar && (
                    <button
                      type="button"
                      onClick={() => {
                        setParentAvatar('');
                        localStorage.removeItem('pawcircle_parent_avatar');
                        authApi.updateMe({ avatar_url: '' }).catch(() => {});
                        window.dispatchEvent(new Event('pawcircle_profile_updated'));
                        showToast('Reset to default vector avatar');
                      }}
                      className="text-[10px] text-outline hover:text-error transition-colors font-medium cursor-pointer"
                      title="Reset to default vector avatar"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1 flex flex-col gap-2">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="flex-1">
                    <span className="text-[10px] uppercase font-bold text-outline block">
                      {householdMode === 'couple' ? 'Primary Parent Name' : 'Parent Name'}
                    </span>
                    <input
                      type="text"
                      value={parentName}
                      onChange={(e) => setParentName(e.target.value)}
                      placeholder="Enter parent's name..."
                      className="mt-0.5 w-full h-8 px-2.5 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-sm font-bold text-on-surface focus:outline-none placeholder:font-normal placeholder:text-outline/50 placeholder:italic"
                    />
                  </div>

                  {/* Gender Display Pill */}
                  <div className="flex items-center self-start">
                    <button
                      type="button"
                      onClick={() => {
                        const next = parentGender === 'male' ? 'female' : 'male';
                        setParentGender(next);
                        localStorage.setItem('pawcircle_parent_gender', next);
                        window.dispatchEvent(new Event('pawcircle_profile_updated'));
                      }}
                      className="px-3.5 py-1 rounded-full bg-primary-container text-on-surface font-bold text-xs shadow-2xs cursor-pointer hover:opacity-90 transition-all"
                      title="Click to toggle gender"
                    >
                      {parentGender === 'male' ? 'Male' : 'Female'}
                    </button>
                  </div>
                </div>

                {/* Parent Vibe & Routine Box - Initially Empty */}
                <div className="bg-surface-container-lowest px-3 py-2 rounded-xl border border-outline-variant/20">
                  <span className="text-[10px] uppercase font-bold text-outline block">Parent vibe &amp; routine</span>
                  <input
                    type="text"
                    value={parentVibe}
                    onChange={(e) => {
                      setParentVibe(e.target.value);
                      localStorage.setItem('pawcircle_parent_vibe', e.target.value);
                    }}
                    placeholder="Add your vibe & routine (e.g. WFH techie, weekend park explorer)..."
                    className="mt-0.5 w-full text-xs text-on-surface bg-transparent focus:outline-none placeholder:text-outline/60 placeholder:italic font-medium"
                  />
                </div>

                {/* Hobbies Box - Initially Empty */}
                <div className="bg-surface-container-lowest px-3 py-2 rounded-xl border border-outline-variant/20">
                  <span className="text-[10px] uppercase font-bold text-outline block">Hobbies</span>
                  <input
                    type="text"
                    value={parentHobbies}
                    onChange={(e) => {
                      setParentHobbies(e.target.value);
                      localStorage.setItem('pawcircle_parent_hobbies', e.target.value);
                    }}
                    placeholder="Add your hobbies (e.g. Hiking, Photography, Weekend camping)..."
                    className="mt-0.5 w-full text-xs text-on-surface bg-transparent focus:outline-none placeholder:text-outline/60 placeholder:italic font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Parent 2 */}
            {householdMode === 'couple' && (
              <div className="bg-white rounded-2xl p-5 border border-outline-variant/30 flex flex-col sm:flex-row items-start gap-4 shadow-2xs">
                <div className="flex flex-col items-center gap-2 shrink-0 self-center sm:self-start">
                  <div className="relative group shrink-0">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-white border-2 border-outline-variant/50 shadow-xs flex items-center justify-center">
                      <img
                        src={resolveParentAvatar(partnerAvatar, partnerGender)}
                        alt={partnerName || 'Co-Parent'}
                        className={`w-full h-full ${partnerAvatar ? 'object-cover' : 'object-contain p-1 bg-white'}`}
                      />
                    </div>
                    <label
                      htmlFor="partner-avatar-file"
                      className="absolute inset-0 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer text-[9px] font-bold"
                      title={partnerAvatar ? "Change co-parent photo" : "Add co-parent photo"}
                    >
                      <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                      <span>{partnerAvatar ? 'Change' : 'Add'}</span>
                    </label>
                    <input
                      id="partner-avatar-file"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePartnerPhotoSelect}
                    />
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-surface-container-high flex items-center justify-center text-[11px] font-bold text-on-surface shadow-2xs">2</span>
                  </div>

                  {/* Button for adding profile pic as done in My Pet */}
                  <div className="flex flex-col items-center gap-1">
                    <label
                      htmlFor="partner-avatar-file"
                      className="px-2.5 py-1 rounded-full bg-surface-container border border-outline-variant/40 hover:bg-surface-container-high text-on-surface text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                      title={partnerAvatar ? "Change co-parent photo" : "Upload a photo"}
                    >
                      {isUploadingPartnerPhoto ? (
                        <>
                          <span className="material-symbols-outlined text-[13px] animate-spin">progress_activity</span>
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[13px]">add_a_photo</span>
                          <span>{partnerAvatar ? 'Change Photo' : 'Add Photo'}</span>
                        </>
                      )}
                    </label>
                    {partnerAvatar && (
                      <button
                        type="button"
                        onClick={() => {
                          setPartnerAvatar('');
                          localStorage.removeItem('pawcircle_partner_avatar');
                          authApi.updateMe({ partner_avatar_url: '' }).catch(() => {});
                          showToast('Reset to default vector avatar');
                        }}
                        className="text-[10px] text-outline hover:text-error transition-colors font-medium cursor-pointer"
                        title="Reset to default vector avatar"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex-1 flex flex-col gap-2">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="flex-1">
                      <span className="text-[10px] uppercase font-bold text-outline block">Co-Parent Name</span>
                      <input
                        type="text"
                        value={partnerName}
                        onChange={(e) => {
                          setPartnerName(e.target.value);
                          localStorage.setItem('pawcircle_partner_name', e.target.value);
                        }}
                        placeholder="Enter co-parent's name..."
                        className="mt-0.5 w-full h-8 px-2.5 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-sm font-bold text-on-surface focus:outline-none"
                      />
                    </div>

                    {/* Partner Gender Display Pill */}
                    <div className="flex items-center self-start">
                      <button
                        type="button"
                        onClick={() => {
                          const next = partnerGender === 'male' ? 'female' : 'male';
                          setPartnerGender(next);
                          localStorage.setItem('pawcircle_partner_gender', next);
                        }}
                        className="px-3.5 py-1 rounded-full bg-primary-container text-on-surface font-bold text-xs shadow-2xs cursor-pointer hover:opacity-90 transition-all"
                        title="Click to toggle gender"
                      >
                        {partnerGender === 'male' ? 'Male' : 'Female'}
                      </button>
                    </div>
                  </div>

                  {/* Co-Parent Vibe & Routine Box - Initially Empty */}
                  <div className="bg-surface-container-lowest px-3 py-2 rounded-xl border border-outline-variant/20">
                    <span className="text-[10px] uppercase font-bold text-outline block">Parent vibe &amp; routine</span>
                    <input
                      type="text"
                      value={partnerVibe}
                      onChange={(e) => {
                        setPartnerVibe(e.target.value);
                        localStorage.setItem('pawcircle_partner_vibe', e.target.value);
                      }}
                      placeholder="Add vibe & routine (e.g. Coffee enthusiast & morning trail runner)..."
                      className="mt-0.5 w-full text-xs text-on-surface bg-transparent focus:outline-none placeholder:text-outline/60 placeholder:italic font-medium"
                    />
                  </div>

                  {/* Co-Parent Hobbies Box - Initially Empty */}
                  <div className="bg-surface-container-lowest px-3 py-2 rounded-xl border border-outline-variant/20">
                    <span className="text-[10px] uppercase font-bold text-outline block">Hobbies</span>
                    <input
                      type="text"
                      value={partnerHobbies}
                      onChange={(e) => {
                        setPartnerHobbies(e.target.value);
                        localStorage.setItem('pawcircle_partner_hobbies', e.target.value);
                      }}
                      placeholder="Add your hobbies (e.g. Trail running, Coffee brewing, Reading)..."
                      className="mt-0.5 w-full text-xs text-on-surface bg-transparent focus:outline-none placeholder:text-outline/60 placeholder:italic font-medium"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Area & Neighbourhood Card */}
          <div className="bg-surface-container-low rounded-2xl p-5 border border-outline-variant/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px] text-on-surface">location_on</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-label-lg text-sm font-bold text-on-surface">{userCity}</h4>
                  <span className="px-2 py-0.5 rounded-full bg-tertiary-container text-on-tertiary-container text-[11px] font-bold">Active Zone</span>
                </div>
                <p className="text-xs text-on-surface-variant mt-0.5 max-w-xl">
                  Neighbourhood shown to matches within {discoveryDistance} km. Exact home address is never collected or shown to ensure total family safety.
                </p>
                {locationFeedback && (
                  <p className="text-xs font-semibold text-primary mt-1">{locationFeedback}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              disabled={isUpdatingLocation}
              onClick={handleAutoDetectLocation}
              className="shrink-0 px-4 py-2 rounded-full bg-surface-container-lowest text-on-surface font-semibold text-xs hover:bg-surface-container transition-colors shadow-xs border border-outline-variant/40 cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
            >
              {isUpdatingLocation ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                  <span>Detecting GPS...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">near_me</span>
                  <span>Auto-detect my area</span>
                </>
              )}
            </button>
          </div>

          {/* Bumble / Tinder style Maximum Discovery Distance Control Card */}
          <div className="bg-surface-container-low rounded-2xl p-5 border border-outline-variant/30 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-tertiary-container flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px] text-on-tertiary-container">radar</span>
                </div>
                <div>
                  <h4 className="font-label-lg text-sm font-bold text-on-surface">Maximum Discovery Distance</h4>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Match with nearby dog &amp; cat parents up to {discoveryDistance} km away (Bumble / Tinder style).
                  </p>
                </div>
              </div>
              <span className="px-3.5 py-1 rounded-full bg-primary-container text-on-surface font-mono font-bold text-sm shadow-xs">
                {discoveryDistance} km
              </span>
            </div>

            <div className="flex items-center gap-4 pt-1">
              <span className="text-xs text-outline font-semibold">2 km</span>
              <input
                type="range"
                min="2"
                max="50"
                step="1"
                value={discoveryDistance}
                onChange={(e) => handleDistanceChange(Number(e.target.value))}
                className="flex-1 accent-primary cursor-pointer h-2 bg-surface-container-high rounded-lg"
              />
              <span className="text-xs text-outline font-semibold">50 km</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {[5, 10, 15, 25, 50].map((dist) => (
                <button
                  key={dist}
                  type="button"
                  onClick={() => handleDistanceChange(dist)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    discoveryDistance === dist
                      ? 'bg-primary-container text-on-surface font-bold shadow-xs scale-105'
                      : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  {dist} km {dist === 5 ? '(Walking)' : dist === 15 ? '(Neighborhood)' : dist === 50 ? '(Max Metro)' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Bio Textarea - Empty by default */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-xs">
              <label className="font-bold text-on-surface">Household Circle Bio</label>
              <span className="text-outline">{bioText.length} / 140 chars</span>
            </div>
            <textarea
              rows="3"
              maxLength={140}
              value={bioText}
              onChange={(e) => {
                setBioText(e.target.value);
                localStorage.setItem('pawcircle_parent_bio', e.target.value);
              }}
              placeholder="Describe your household circle, walking routine, or pack preferences..."
              className="w-full bg-surface-container-low text-on-surface rounded-xl p-4 text-xs sm:text-sm focus:outline-none focus:bg-surface-container-lowest border border-outline-variant/30 resize-none placeholder:text-outline/60 placeholder:italic font-medium"
            />
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
              {savedFeedback && (
                <span className="text-tertiary font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  Changes saved successfully!
                </span>
              )}
            </div>
            <button
              onClick={handleSave}
              className="px-6 py-2.5 rounded-full bg-primary-container text-on-surface font-bold text-xs sm:text-sm hover:bg-primary-fixed-dim transition-colors shadow-xs cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </section>
      )}

      {/* ================= TAB 2: MY PETS ================= */}
      {activeProfileTab === 'pets' && (
        <section className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 border border-outline-variant/40 shadow-xs flex flex-col gap-6">
          <div className="flex justify-between items-center pb-4 border-b border-outline-variant/20">
            <div>
              <h2 className="font-headline-md text-xl font-bold text-on-surface">My Pets</h2>
              <p className="text-xs text-on-surface-variant">Active pet profiles in your household circle.</p>
            </div>
            <button
              onClick={() => onOpenOnboarding && onOpenOnboarding('add-pet')}
              className="px-4 py-2 rounded-full bg-primary-container text-on-surface font-semibold text-xs hover:bg-primary-fixed-dim transition-colors shadow-xs flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>Add Another Pet</span>
            </button>
          </div>

          {/* Pets List or Empty State */}
          {(!petList || petList.length === 0) ? (
            <div className="p-8 sm:p-12 rounded-2xl bg-surface-container-low border border-dashed border-outline-variant/60 flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary-container/40 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[32px]">pets</span>
              </div>
              <div className="max-w-md">
                <h3 className="font-headline-sm text-lg font-bold text-on-surface">No pets added yet</h3>
                <p className="text-xs sm:text-sm text-on-surface-variant mt-1 leading-relaxed">
                  Add your dog or cat to unlock personalized AI meal plans, daily care routines, and health records.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenOnboarding && onOpenOnboarding('add-pet')}
                className="px-6 py-2.5 rounded-full bg-primary-container text-on-surface font-bold text-xs sm:text-sm hover:bg-primary-fixed-dim transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                <span>Add Your Pet</span>
              </button>
            </div>
          ) : (
            petList.map((pet, idx) => {
            const hasCustomPhoto = hasCustomPetPhoto(pet);
            const avatarSrc = resolvePetAvatar(pet);
            const isCat = (pet.species || '').toLowerCase() === 'cat';
            const isUploading = uploadingPetId === (pet.id || 'default');
            const petTraits = pet.play_style
              ? (Array.isArray(pet.play_style)
                  ? pet.play_style
                  : pet.play_style.split(',').map(s => s.trim()).filter(Boolean))
              : ['Ball Chaser', 'Gentle with kids'];

            return (
              <div
                key={pet.id || idx}
                className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-5 shadow-xs"
              >
                {/* Top Row: Avatar + Pet Bio + Actions */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    {/* Avatar Container with Hover Upload Badge */}
                    <div className="relative group shrink-0">
                      <img
                        src={avatarSrc}
                        alt={pet.name}
                        className={`w-20 h-20 rounded-2xl border-2 border-primary-container transition-transform group-hover:scale-105 ${
                          hasCustomPhoto
                            ? 'object-cover shadow-xs'
                            : 'object-contain p-2.5 bg-surface-container-low shadow-2xs'
                        }`}
                      />
                      <label
                        htmlFor={`pet-photo-input-${pet.id || idx}`}
                        className="absolute inset-0 rounded-2xl bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer text-[10px] font-bold"
                        title={hasCustomPhoto ? "Change pet photo" : "Add pet photo"}
                      >
                        <span className="material-symbols-outlined text-[20px]">photo_camera</span>
                        <span>{hasCustomPhoto ? 'Change' : 'Add Photo'}</span>
                      </label>
                      <input
                        id={`pet-photo-input-${pet.id || idx}`}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handlePhotoFileSelect(pet, e)}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-headline-sm text-xl font-bold text-on-surface">{pet.name}</h3>
                        <span className="px-2.5 py-0.5 rounded-full bg-tertiary-container text-on-tertiary-container text-[11px] font-bold">
                          {idx === 0 ? 'Active Pet' : 'Registered Pet'}
                        </span>
                      </div>

                      <p className="text-xs text-on-surface-variant">
                        {[
                          pet.breed || (isCat ? 'Domestic Cat' : 'Companion Dog'),
                          pet.gender ? (pet.gender.toLowerCase() === 'female' ? 'Girl 🎀' : 'Boy 🧢') : null,
                          formatPetAge(pet.birth_date),
                          pet.weight_kg ? `${pet.weight_kg} kg` : null,
                          pet.is_neutered ? 'Neutered' : 'Intact'
                        ].filter(Boolean).join(' • ')}
                      </p>
                    </div>
                  </div>

                  {/* Actions Rows */}
                  <div className="flex flex-col gap-2.5 pt-1">
                    {/* Primary Pet Actions Row */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Edit Details Button */}
                      <button
                        type="button"
                        onClick={() => openEditDetailsModal(pet)}
                        className="px-4 py-2 rounded-full bg-primary-container text-on-surface text-xs font-bold hover:bg-primary-fixed-dim transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                        title="Edit all pet details: gender, species, breed, weight, age, neutered status"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                        <span>Edit Pet Details</span>
                      </button>

                      {/* Add Photo / Change Photo Button */}
                      <label
                        htmlFor={`pet-photo-input-${pet.id || idx}`}
                        className="px-4 py-2 rounded-full bg-primary-container text-on-surface text-xs font-bold hover:bg-primary-fixed-dim transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                      >
                        {isUploading ? (
                          <>
                            <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                            <span>Uploading...</span>
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[16px]">add_a_photo</span>
                            <span>{hasCustomPhoto ? 'Change Photo' : 'Add Photo'}</span>
                          </>
                        )}
                      </label>

                      {/* Reset to vector profile button if user has custom photo */}
                      {hasCustomPhoto && (
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(pet)}
                          className="px-3 py-2 rounded-full bg-surface-container-lowest border border-outline-variant/40 text-xs font-semibold text-outline hover:text-error hover:border-error transition-colors cursor-pointer"
                          title="Remove custom photo"
                        >
                          Remove Photo
                        </button>
                      )}
                    </div>

                    {/* Pet Dossier Navigation Row (Dedicated line below) */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab('daily-care')}
                        className="px-4 py-2 rounded-full bg-surface-container-lowest border border-outline-variant text-xs font-semibold hover:bg-surface-container text-on-surface transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                      >
                        <span className="material-symbols-outlined text-[15px] text-primary">calendar_today</span>
                        <span>Daily Care</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab('medical-vault')}
                        className="px-4 py-2 rounded-full bg-surface-container-lowest border border-outline-variant text-xs font-semibold hover:bg-surface-container text-on-surface transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                      >
                        <span className="material-symbols-outlined text-[15px] text-primary">medical_services</span>
                        <span>Medical Vault</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab('diet-lab')}
                        className="px-4 py-2 rounded-full bg-surface-container-lowest border border-outline-variant text-xs font-semibold hover:bg-surface-container text-on-surface transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                      >
                        <span className="material-symbols-outlined text-[15px] text-primary">restaurant</span>
                        <span>Diet Lab</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Pet Vibe & Routine Section (shown at time of sign in) */}
                <div className="pt-3 border-t border-outline-variant/20 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-primary">mood</span>
                      <span className="text-xs font-bold text-on-surface uppercase tracking-wider">
                        Pet Vibe &amp; Routine
                      </span>
                      <span className="text-[11px] text-outline font-normal">
                        (Configured at sign in)
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => openVibeModal(pet)}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary-container/80 hover:bg-primary-container text-on-surface text-xs font-bold border border-primary-container transition-all cursor-pointer shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-[15px]">edit</span>
                      <span>Edit Vibe</span>
                    </button>
                  </div>

                  {/* Vibe Box Body - Matching Sign In Step 5 */}
                  <div className="p-4 rounded-2xl bg-surface-container/50 border border-outline-variant/30 flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <span className="text-xs font-bold text-on-surface sm:w-28 shrink-0">Energy Level:</span>
                      <div>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary-container text-on-surface border border-outline-variant/30 shadow-2xs">
                          {pet.energy_level === 'chill' || pet.energy_level === 'low'
                            ? '🛋️ Chill / Senior'
                            : pet.energy_level === 'moderate'
                            ? '🌿 Moderate'
                            : '⚡ High Energy'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                      <span className="text-xs font-bold text-on-surface sm:w-28 shrink-0 pt-1">Play Styles:</span>
                      <div className="flex flex-wrap items-center gap-1.5 flex-1">
                        {petTraits.length > 0 ? (
                          petTraits.map((trait, tIdx) => (
                            <span
                              key={tIdx}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-surface-container-high text-on-surface border border-outline-variant/30 shadow-2xs"
                            >
                              <span>✓ {trait}</span>
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-on-surface-variant italic">
                            No vibe traits configured. Click "Pet Vibe" to set energy &amp; play styles.
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Allergies & Dietary Restrictions Section */}
                <div className="pt-3 border-t border-outline-variant/20 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-tertiary">health_and_safety</span>
                      <span className="text-xs font-bold text-on-surface uppercase tracking-wider">
                        Allergies &amp; Dietary Restrictions
                      </span>
                      <span className="text-[11px] text-outline font-normal">
                        ({Array.isArray(pet.allergies) ? pet.allergies.length : 0})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Pet Vibe button next to Add Allergies */}
                      <button
                        type="button"
                        onClick={() => openVibeModal(pet)}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary-container/70 hover:bg-primary-container text-on-surface text-xs font-bold border border-primary-container transition-all cursor-pointer shadow-2xs"
                        title="Customize energy level and play style traits"
                      >
                        <span className="material-symbols-outlined text-[15px]">mood</span>
                        <span>Pet Vibe</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openAllergyModal(pet)}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary-container/70 hover:bg-primary-container text-on-surface text-xs font-bold border border-primary-container transition-all cursor-pointer shadow-2xs"
                      >
                        <span className="material-symbols-outlined text-[15px]">add</span>
                        <span>Add Allergies</span>
                      </button>
                    </div>
                  </div>

                  {/* Chips display */}
                  <div className="flex flex-wrap items-center gap-1.5 min-h-[32px]">
                    {Array.isArray(pet.allergies) && pet.allergies.length > 0 ? (
                      pet.allergies.map((allergy, aIdx) => (
                        <span
                          key={aIdx}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-error-container/30 text-on-error-container border border-error-container/60 shadow-2xs"
                        >
                          <span>⚠️ {allergy}</span>
                          <button
                            type="button"
                            onClick={() => handleQuickRemoveAllergy(pet, allergy)}
                            className="w-4 h-4 rounded-full hover:bg-error-container text-on-error-container/70 hover:text-on-error-container inline-flex items-center justify-center text-xs cursor-pointer ml-0.5"
                            title={`Remove ${allergy}`}
                          >
                            ✕
                          </button>
                        </span>
                      ))
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-on-surface-variant italic">No allergies recorded for {pet.name}.</span>
                        <button
                          type="button"
                          onClick={() => openAllergyModal(pet)}
                          className="text-xs font-bold text-primary hover:underline cursor-pointer"
                        >
                          + Log known allergies
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
          )}
        </section>
      )}

      {/* ================= TAB 3: SETTINGS & PRIVACY ================= */}
      {activeProfileTab === 'settings' && (
        <section className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 border border-outline-variant/40 shadow-xs flex flex-col gap-6">
          <div className="pb-4 border-b border-outline-variant/20">
            <h2 className="font-headline-md text-xl font-bold text-on-surface">Settings &amp; Privacy</h2>
            <p className="text-xs text-on-surface-variant">Control notifications, location precision, and discovery visibility.</p>
          </div>

          {/* Notification toggles */}
          <div className="flex flex-col gap-4">
            <span className="text-xs font-bold text-outline uppercase tracking-wider">Automated Notifications</span>

            {[
              { id: 'mealReminders', title: 'Mealtime & Feeding Reminders', desc: 'Receive morning and evening push notifications when breakfast or dinner is due.' },
              { id: 'medicationAlarms', title: 'Medication Alarms (Otomax Drops)', desc: 'Alarm chime at 8:00 AM & 8:00 PM for active prescription courses.' },
              { id: 'playdateInvites', title: 'Community Matches & Pack Walk Tickets', desc: 'Notify me when another pet parent sends a playdate invite or pack walk ticket.' }
            ].map(item => (
              <div key={item.id} className="flex items-center justify-between p-4 rounded-xl bg-surface-container-low border border-outline-variant/20">
                <div className="flex flex-col">
                  <span className="font-headline-sm text-sm font-bold text-on-surface">{item.title}</span>
                  <span className="text-xs text-on-surface-variant mt-0.5">{item.desc}</span>
                </div>
                <button
                  type="button"
                  onClick={() => toggleSetting(item.id)}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                    settings[item.id] ? 'bg-primary' : 'bg-surface-variant'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                    settings[item.id] ? 'right-0.5' : 'left-0.5'
                  }`}></span>
                </button>
              </div>
            ))}
          </div>

          {/* Privacy controls */}
          <div className="flex flex-col gap-4 pt-4 border-t border-outline-variant/20">
            <span className="text-xs font-bold text-outline uppercase tracking-wider">Discovery &amp; Location Privacy</span>

            {[
              { id: 'fuzzyLocation', title: 'Fuzzy Location Masking', desc: `Show only neighborhood (e.g. Model Town) within your selected discovery radius (${discoveryDistance} km). Never reveals street address.` },
              { id: 'incognitoMode', title: 'Incognito Walk Mode', desc: 'Temporarily hide profile from discovery deck during busy or private training walks.' }
            ].map(item => (
              <div key={item.id} className="flex items-center justify-between p-4 rounded-xl bg-surface-container-low border border-outline-variant/20">
                <div className="flex flex-col">
                  <span className="font-headline-sm text-sm font-bold text-on-surface">{item.title}</span>
                  <span className="text-xs text-on-surface-variant mt-0.5">{item.desc}</span>
                </div>
                <button
                  type="button"
                  onClick={() => toggleSetting(item.id)}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                    settings[item.id] ? 'bg-primary' : 'bg-surface-variant'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                    settings[item.id] ? 'right-0.5' : 'left-0.5'
                  }`}></span>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Floating Toast Notification */}
      {toastNotice && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold transition-all ${
          toastNotice.type === 'error'
            ? 'bg-error-container text-on-error-container border border-error-container'
            : 'bg-on-surface text-surface'
        }`}>
          <span className="material-symbols-outlined text-[18px]">
            {toastNotice.type === 'error' ? 'error' : 'check_circle'}
          </span>
          <span>{toastNotice.message}</span>
        </div>
      )}

      {/* ================= ALLERGY MANAGEMENT MODAL ================= */}
      {allergyModalPet && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-outline-variant/40 shadow-2xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-outline-variant/20">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary">Allergy Dossier</span>
                <h3 className="font-headline-sm text-xl font-bold text-on-surface mt-0.5">
                  Manage Allergies for {allergyModalPet.name}
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Tagged allergens automatically configure AI meal recipes and alert dog sitters.
                </p>
              </div>
              <button
                type="button"
                onClick={closeAllergyModal}
                className="w-8 h-8 rounded-full text-outline hover:text-on-surface hover:bg-surface-container flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Currently Tagged Allergies */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-on-surface flex items-center justify-between">
                <span>Currently Logged Allergies</span>
                <span className="text-[11px] font-normal text-outline">({tempSelectedAllergies.length} selected)</span>
              </label>
              <div className="flex flex-wrap items-center gap-1.5 p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30 min-h-[46px]">
                {tempSelectedAllergies.length > 0 ? (
                  tempSelectedAllergies.map((item, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-error-container text-on-error-container border border-error-container shadow-2xs"
                    >
                      <span>⚠️ {item}</span>
                      <button
                        type="button"
                        onClick={() => handleToggleTempAllergy(item)}
                        className="w-4 h-4 rounded-full hover:bg-black/10 inline-flex items-center justify-center text-xs cursor-pointer"
                        title={`Remove ${item}`}
                      >
                        ✕
                      </button>
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-outline italic">No allergens selected yet. Choose common presets below or enter a custom one.</span>
                )}
              </div>
            </div>

            {/* Add Custom Allergen Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface">Add Custom Allergen or Sensitivity</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customAllergyText}
                  onChange={(e) => setCustomAllergyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomAllergy();
                    }
                  }}
                  placeholder="e.g. Peanuts, Salmon, Grass, Preservatives..."
                  className="flex-1 h-10 px-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-xs sm:text-sm text-on-surface focus:outline-none focus:border-primary font-medium"
                />
                <button
                  type="button"
                  onClick={handleAddCustomAllergy}
                  className="px-4 h-10 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-xs font-bold text-on-surface transition-colors cursor-pointer"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Quick Pick Common Allergens */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-on-surface">Quick-Pick Common Allergens</label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Chicken',
                  'Beef',
                  'Dairy / Milk',
                  'Eggs',
                  'Wheat / Gluten',
                  'Soy',
                  'Corn',
                  'Fish / Seafood',
                  'Lamb',
                  'Pork',
                  'Turkey',
                  'Flea Bites',
                  'Pollen / Grass',
                  'Dust Mites',
                  'Penicillin'
                ].map((item) => {
                  const isSelected = tempSelectedAllergies.some(a => a.toLowerCase() === item.toLowerCase());
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => handleToggleTempAllergy(item)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-error-container text-on-error-container font-bold border border-error-container shadow-2xs'
                          : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/30'
                      }`}
                    >
                      {isSelected ? '✓ ' : '+ '}{item}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant/20">
              <button
                type="button"
                onClick={closeAllergyModal}
                className="px-4 py-2 rounded-full border border-outline-variant text-xs font-semibold text-outline hover:text-on-surface cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAllergies}
                className="px-6 py-2 rounded-full bg-primary-container text-on-surface text-xs font-bold hover:bg-primary-fixed-dim transition-colors cursor-pointer shadow-xs"
              >
                Save Allergies
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ================= PET VIBE MODAL (SIGN-IN STEP 5 PARITY) ================= */}
      {vibeModalPet && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-outline-variant/40 shadow-2xl flex flex-col gap-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-outline-variant/20">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary">Pet Personality &amp; Routine</span>
                <h3 className="font-headline-sm text-xl font-bold text-on-surface mt-0.5">
                  {vibeModalPet.name}'s Pet Vibe
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Help local pet parents understand {vibeModalPet.name}'s energy and favorite activities.
                </p>
              </div>
              <button
                type="button"
                onClick={closeVibeModal}
                className="w-8 h-8 rounded-full text-outline hover:text-on-surface hover:bg-surface-container flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Energy Level Selection (Identical to Step 5) */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-on-surface">Energy Level</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'high', label: '⚡ High Energy' },
                  { id: 'moderate', label: '🌿 Moderate' },
                  { id: 'chill', label: '🛋️ Chill / Senior' }
                ].map((lvl) => (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => setTempEnergyLevel(lvl.id)}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      tempEnergyLevel === lvl.id
                        ? 'bg-primary-container text-on-surface border-on-surface shadow-xs'
                        : 'bg-surface-container-low border-outline-variant/30 text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    {lvl.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Select Traits & Play Styles (Identical to Step 5) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-on-surface">Select traits &amp; play styles</label>
                <span className="text-[11px] text-outline font-normal">({tempTraits.length} selected)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  'Ball Chaser',
                  'Tug-of-war',
                  'Loves swimming',
                  'Gentle with kids',
                  'Friendly with dogs',
                  'Off-leash trained',
                  'Needs slow intro',
                  'Couch cuddler'
                ].map((trait) => {
                  const active = tempTraits.some(t => t.toLowerCase() === trait.toLowerCase());
                  return (
                    <button
                      key={trait}
                      type="button"
                      onClick={() => handleToggleTrait(trait)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                        active
                          ? 'bg-primary-container text-on-surface border border-on-surface shadow-xs'
                          : 'bg-surface-container-low text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container'
                      }`}
                    >
                      {active ? `✓ ${trait}` : `+ ${trait}`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Trait Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface">Add Custom Personality Trait</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customTraitInput}
                  onChange={(e) => setCustomTraitInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomTrait();
                    }
                  }}
                  placeholder="e.g. Snow lover, Frisbee champ, Agility runner..."
                  className="flex-1 h-10 px-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-xs sm:text-sm text-on-surface focus:outline-none focus:border-primary font-medium"
                />
                <button
                  type="button"
                  onClick={handleAddCustomTrait}
                  className="px-4 h-10 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-xs font-bold text-on-surface transition-colors cursor-pointer"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Active Traits Preview */}
            {tempTraits.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface">Active Vibe Badges</label>
                <div className="flex flex-wrap items-center gap-1.5 p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30 min-h-[46px]">
                  {tempTraits.map((t, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary-container text-on-surface border border-outline-variant/40 shadow-2xs"
                    >
                      <span>✓ {t}</span>
                      <button
                        type="button"
                        onClick={() => handleToggleTrait(t)}
                        className="w-4 h-4 rounded-full hover:bg-black/10 inline-flex items-center justify-center text-xs cursor-pointer ml-0.5"
                        title={`Remove ${t}`}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant/20">
              <button
                type="button"
                onClick={closeVibeModal}
                className="px-4 py-2 rounded-full border border-outline-variant text-xs font-semibold text-outline hover:text-on-surface cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveVibe}
                className="px-6 py-2 rounded-full bg-primary-container text-on-surface text-xs font-bold hover:bg-primary-fixed-dim transition-colors cursor-pointer shadow-xs"
              >
                Save Pet Vibe
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= COMPREHENSIVE PET DETAILS EDIT MODAL ================= */}
      {editDetailsPet && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl max-w-xl w-full p-6 sm:p-8 border border-outline-variant/40 shadow-2xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-outline-variant/20">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary">Pet Dossier</span>
                <h3 className="font-headline-sm text-xl font-bold text-on-surface mt-0.5">
                  Edit Details for {editDetailsPet.name}
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Update gender, species, weight, breed, and reproductive health.
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditDetailsModal}
                className="w-8 h-8 rounded-full text-outline hover:text-on-surface hover:bg-surface-container flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Species Toggle */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface">Species</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setEditPetSpecies('dog')}
                  className={`h-12 px-4 rounded-2xl flex items-center justify-center gap-2.5 border-2 transition-all cursor-pointer font-bold text-xs sm:text-sm ${
                    editPetSpecies === 'dog'
                      ? 'bg-primary-container/20 border-primary-container text-on-surface shadow-xs'
                      : 'bg-surface-container-low border-outline-variant/30 text-on-surface-variant hover:border-black/30'
                  }`}
                >
                  <span className="text-xl">🐕</span>
                  <span>Dog</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditPetSpecies('cat')}
                  className={`h-12 px-4 rounded-2xl flex items-center justify-center gap-2.5 border-2 transition-all cursor-pointer font-bold text-xs sm:text-sm ${
                    editPetSpecies === 'cat'
                      ? 'bg-primary-container/20 border-primary-container text-on-surface shadow-xs'
                      : 'bg-surface-container-low border-outline-variant/30 text-on-surface-variant hover:border-black/30'
                  }`}
                >
                  <span className="text-xl">🐈</span>
                  <span>Cat</span>
                </button>
              </div>
            </div>

            {/* Gender / Sex Toggle */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface">Gender / Sex</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setEditPetGender('male')}
                  className={`h-12 px-4 rounded-2xl flex items-center justify-center gap-2 border-2 transition-all cursor-pointer font-bold text-xs sm:text-sm ${
                    editPetGender === 'male'
                      ? 'bg-blue-500/10 border-blue-500 text-on-surface shadow-xs ring-1 ring-blue-500/30'
                      : 'bg-surface-container-low border-outline-variant/30 text-on-surface-variant hover:border-black/30'
                  }`}
                >
                  <span className="text-xl">🧢</span>
                  <span>Boy (Male)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditPetGender('female')}
                  className={`h-12 px-4 rounded-2xl flex items-center justify-center gap-2 border-2 transition-all cursor-pointer font-bold text-xs sm:text-sm ${
                    editPetGender === 'female'
                      ? 'bg-pink-500/10 border-pink-500 text-on-surface shadow-xs ring-1 ring-pink-500/30'
                      : 'bg-surface-container-low border-outline-variant/30 text-on-surface-variant hover:border-black/30'
                  }`}
                >
                  <span className="text-xl">🎀</span>
                  <span>Girl (Female)</span>
                </button>
              </div>
            </div>

            {/* Pet Name & Breed */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-on-surface">Pet Name</label>
                <input
                  type="text"
                  value={editPetName}
                  onChange={(e) => setEditPetName(e.target.value)}
                  placeholder="e.g. Coco"
                  className="h-11 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs sm:text-sm focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-on-surface">Breed</label>
                <input
                  type="text"
                  value={editPetBreed}
                  onChange={(e) => setEditPetBreed(e.target.value)}
                  placeholder="e.g. Golden Retriever"
                  className="h-11 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs sm:text-sm focus:outline-none"
                />
              </div>
            </div>

            {/* Age & Weight */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5 min-w-0">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-on-surface">Age</label>
                  <div className="inline-flex p-0.5 bg-surface-container rounded-lg border border-outline-variant/30 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setEditPetAgeUnit('months')}
                      className={`px-2.5 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                        editPetAgeUnit === 'months'
                          ? 'bg-primary-container text-on-surface shadow-xs'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      Months
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditPetAgeUnit('years')}
                      className={`px-2.5 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                        editPetAgeUnit === 'years'
                          ? 'bg-primary-container text-on-surface shadow-xs'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      Years
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  min="1"
                  max={editPetAgeUnit === 'months' ? 24 : 30}
                  step="1"
                  value={editPetAgeValue}
                  onChange={(e) => setEditPetAgeValue(e.target.value)}
                  placeholder={editPetAgeUnit === 'months' ? 'e.g. 5' : 'e.g. 2'}
                  className="h-11 w-full min-w-0 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs sm:text-sm focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5 min-w-0">
                <div className="flex items-center justify-between h-[25px]">
                  <label className="text-xs font-bold text-on-surface">Weight (kg)</label>
                  <span className="text-[11px] text-outline font-medium">kg</span>
                </div>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="120"
                  value={editPetWeight}
                  onChange={(e) => setEditPetWeight(e.target.value)}
                  placeholder="e.g. 9.0"
                  className="h-11 w-full min-w-0 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs sm:text-sm focus:outline-none"
                />
              </div>
            </div>

            {/* Neutered / Spayed Toggle */}
            <div className="flex flex-col gap-1.5 p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/30">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-on-surface block">Neutered or Spayed?</span>
                  <span className="text-[11px] text-on-surface-variant">Calorie target is ~20% lower for desexed pets</span>
                </div>
                <div className="grid grid-cols-2 p-1 bg-surface-container rounded-xl border border-outline-variant/30 text-xs">
                  <button
                    type="button"
                    onClick={() => setEditPetNeutered(true)}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      editPetNeutered ? 'bg-primary-container text-on-surface shadow-xs' : 'text-on-surface-variant'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditPetNeutered(false)}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      !editPetNeutered ? 'bg-primary-container text-on-surface shadow-xs' : 'text-on-surface-variant'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>
            </div>

            {/* Vaccination Status */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface">Vaccination Status</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'full', label: 'Full Protection' },
                  { id: 'partial', label: 'Partial' },
                  { id: 'unknown', label: 'Unknown / Due' }
                ].map(v => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setEditPetVaxStatus(v.id)}
                    className={`py-2 px-1 text-center rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      editPetVaxStatus === v.id
                        ? 'bg-primary-container border-primary text-on-surface shadow-xs'
                        : 'bg-surface-container-low border-outline-variant/30 text-on-surface-variant hover:border-black/30'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline-variant/20">
              <button
                type="button"
                onClick={closeEditDetailsModal}
                className="px-4 py-2 rounded-full border border-outline-variant text-xs font-semibold text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingPetDetails}
                onClick={handleSavePetDetails}
                className="px-6 py-2.5 rounded-full bg-primary-container text-on-surface font-bold text-xs sm:text-sm hover:bg-primary-fixed-dim transition-colors shadow-xs cursor-pointer disabled:opacity-60 flex items-center gap-2"
              >
                {isSavingPetDetails ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">check</span>
                    <span>Save Pet Details</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bumble / Tinder Distance Modal */}
      {showDistanceModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-surface rounded-3xl p-6 border border-outline-variant/30 shadow-2xl flex flex-col gap-5">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[24px]">radar</span>
                <h3 className="font-headline-sm text-lg font-bold text-on-surface">Maximum Distance</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDistanceModal(false)}
                className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-outline hover:text-on-surface transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              Adjust your matchmaking and pack discovery radius just like on Bumble and Tinder. Matches beyond this radius will not appear in your Community deck.
            </p>

            <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-surface-container-low border border-outline-variant/30">
              <span className="text-xs font-bold text-on-surface">Search Radius</span>
              <span className="px-3.5 py-1 rounded-full bg-primary-container text-on-surface font-mono font-bold text-sm shadow-xs">
                {discoveryDistance} km
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs text-outline font-semibold">
                <span>2 km</span>
                <span>25 km</span>
                <span>50 km</span>
              </div>
              <input
                type="range"
                min="2"
                max="50"
                step="1"
                value={discoveryDistance}
                onChange={(e) => handleDistanceChange(Number(e.target.value))}
                className="w-full accent-primary cursor-pointer h-2.5 bg-surface-container-high rounded-lg"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {[5, 10, 15, 25, 50].map((dist) => (
                <button
                  key={dist}
                  type="button"
                  onClick={() => handleDistanceChange(dist)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    discoveryDistance === dist
                      ? 'bg-primary-container text-on-surface font-bold shadow-xs scale-105'
                      : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  {dist} km
                </button>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant/20">
              <button
                type="button"
                onClick={() => setShowDistanceModal(false)}
                className="w-full h-11 rounded-full bg-primary-container text-on-surface font-bold text-xs sm:text-sm hover:bg-primary-fixed-dim transition-colors shadow-xs cursor-pointer"
              >
                Done (Save {discoveryDistance} km)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
