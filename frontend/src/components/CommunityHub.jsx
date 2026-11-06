import React, { useState, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { communityApi, getStoredActivePet } from '../services/api';

// Safe image resolver supporting absolute, proxy uploads, and fallbacks
export const resolveImageUrl = (url) => {
  if (!url) return 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=600&q=80';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/uploads/')) return url;
  if (url.startsWith('uploads/')) return `/${url}`;
  return url;
};

export default function CommunityHub() {
  const [activeSubView, setActiveSubView] = useState('discover'); // 'discover' | 'browse' | 'matches' | 'chat' | 'events'
  const [currentPetIndex, setCurrentPetIndex] = useState(0);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [inspectPet, setInspectPet] = useState(null);
  const [matchedPet, setMatchedPet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [speciesFilter, setSpeciesFilter] = useState('all');
  const [energyFilter, setEnergyFilter] = useState('all');
  const [discoveryDistance, setDiscoveryDistance] = useState(() => {
    const saved = localStorage.getItem('pawcircle_discovery_distance');
    return saved ? Number(saved) : 25;
  });
  const [showDistanceFilterModal, setShowDistanceFilterModal] = useState(false);

  // Swipe Gesture & Animation States
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [flyOutAnim, setFlyOutAnim] = useState(null); // 'left' | 'right' | null

  // Backend state
  const [pets, setPets] = useState([]);
  const [likedYouPets, setLikedYouPets] = useState([]);
  const [likedFilter, setLikedFilter] = useState('all'); // 'all' | 'pending' | 'matched'
  const [likedYouLoading, setLikedYouLoading] = useState(false);
  const [matches, setMatches] = useState([]);
  const [activeMatch, setActiveMatch] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [replyInput, setReplyInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [events, setEvents] = useState([]);
  const [rsvpSuccess, setRsvpSuccess] = useState(null);
  const [swipeNotice, setSwipeNotice] = useState(null);

  const showSwipeNotice = (message, type = 'info') => {
    setSwipeNotice({ message, type });
    setTimeout(() => {
      setSwipeNotice(prev => (prev?.message === message ? null : prev));
    }, 3800);
  };

  const activePet = getStoredActivePet();

  const DEFAULT_PET_AVATAR = 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=600&q=80';

  // 1. Fetch Discover Pets from Backend
  const loadCommunityPets = async () => {
    setLoading(true);
    try {
      const data = await communityApi.discoverPets({
        species: speciesFilter,
        energyLevel: energyFilter,
        radiusKm: discoveryDistance
      });
      if (Array.isArray(data)) {
        setPets(data);
      } else {
        setPets([]);
      }
    } catch (err) {
      console.warn('Backend discover query note:', err);
      setPets([]);
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Matches from Backend
  const loadMatches = async () => {
    try {
      const data = await communityApi.getMatches();
      if (Array.isArray(data)) {
        setMatches(data);
      }
    } catch (err) {
      console.warn('Backend matches query note:', err);
    }
  };

  // 3. Fetch Events from Backend
  const loadEvents = async () => {
    try {
      const data = await communityApi.getEvents();
      if (Array.isArray(data)) {
        setEvents(data);
      }
    } catch (err) {
      console.warn('Backend events query note:', err);
    }
  };

  // 4. Fetch Profiles Who Liked You from Backend
  const loadLikedYou = async () => {
    setLikedYouLoading(true);
    try {
      const data = await communityApi.getLikedYou();
      if (Array.isArray(data)) {
        // Exclude any that are already mutual matches
        const unMatchedLikedPets = data.filter(p => !p.is_matched && !matches.some(m => m.matched_pet_id === p.id));
        setLikedYouPets(unMatchedLikedPets);
      } else {
        const fromPets = pets.filter(p => p.has_liked_you && !matches.some(m => m.matched_pet_id === p.id));
        setLikedYouPets(fromPets);
      }
    } catch (err) {
      console.warn('Backend liked-you query note:', err);
      const fromPets = pets.filter(p => p.has_liked_you && !matches.some(m => m.matched_pet_id === p.id));
      setLikedYouPets(fromPets);
    } finally {
      setLikedYouLoading(false);
    }
  };

  // Auto-reload community profiles when pet or user profile updates
  useEffect(() => {
    const handleReload = () => {
      loadCommunityPets();
      loadLikedYou();
      loadMatches();
    };
    window.addEventListener('pawcircle_profile_updated', handleReload);
    window.addEventListener('pawcircle_pet_updated', handleReload);
    window.addEventListener('storage', handleReload);
    return () => {
      window.removeEventListener('pawcircle_profile_updated', handleReload);
      window.removeEventListener('pawcircle_pet_updated', handleReload);
      window.removeEventListener('storage', handleReload);
    };
  }, []);

  useEffect(() => {
    loadCommunityPets();
    loadLikedYou();
    loadMatches();
    loadEvents();
  }, [speciesFilter, energyFilter, discoveryDistance]);

  // Sync likes if pets change
  useEffect(() => {
    if (likedYouPets.length === 0 && pets.length > 0) {
      const fromPets = pets.filter(p => p.has_liked_you && !matches.some(m => m.matched_pet_id === p.id));
      if (fromPets.length > 0) {
        setLikedYouPets(fromPets);
      }
    }
  }, [pets, matches]);

  // Filtered Liked You profiles (strictly pending likes, mutual matches are removed!)
  const filteredLikedYouPets = useMemo(() => {
    let list = likedYouPets.filter(p => !p.is_matched && !matches.some(m => m.matched_pet_id === p.id));
    if (speciesFilter !== 'all') {
      list = list.filter(p => (p.species || 'dog').toLowerCase() === speciesFilter.toLowerCase());
    }
    return list;
  }, [likedYouPets, matches, speciesFilter]);

  // 1. Playdate Matches (New mutual matches where NO conversation has been started yet)
  const unstartedMatches = useMemo(() => {
    return matches.filter(m => !m.has_conversation && !m.latest_message);
  }, [matches]);

  // 2. Active Playdate Conversations (Matches shifted to chats once a conversation starts)
  const activeChatMatches = useMemo(() => {
    return matches.filter(m => m.has_conversation || Boolean(m.latest_message));
  }, [matches]);

  // Like Back & Match handler from Liked You tab
  const handleLikeBack = async (pet) => {
    try {
      // Optimistically remove from Liked You immediately!
      setLikedYouPets(prev => prev.filter(p => p.id !== pet.id && p.id !== pet.matched_pet_id));

      if (pet.id && !String(pet.id).startsWith('demo-')) {
        const res = await communityApi.swipePet(pet.id, 'like', activePet?.id, true);
        if (res?.is_match || true) {
          const newMatchId = res?.match_id || `match-${pet.id}-${Date.now()}`;
          setMatchedPet(pet);
          setShowMatchModal(true);
          triggerConfetti();
          setMatches(prev => {
            if (prev.some(m => m.matched_pet_id === pet.id)) return prev;
            return [{
              match_id: newMatchId,
              matched_pet_id: pet.id,
              matched_pet_name: pet.name,
              matched_pet_breed: pet.breed,
              matched_pet_species: pet.species,
              matched_pet_energy: pet.energy_level,
              matched_pet_play_style: pet.play_style,
              matched_pet_avatar: pet.image,
              matched_pet_photos: pet.photos || [pet.image],
              owner_id: pet.owner_id || pet.id,
              owner_name: pet.parents,
              owner_neighborhood: pet.area_neighborhood,
              matched_at: new Date().toISOString(),
              latest_message: null,
              has_conversation: false
            }, ...prev];
          });
          await loadMatches();
          await loadLikedYou();
        } else {
          showSwipeNotice(`Liked ${pet.name}! When they like ${activePet?.name || 'your pet'} back, it's a mutual match! 🐾`, 'like');
          await loadLikedYou();
        }
      } else {
        setMatchedPet(pet);
        setShowMatchModal(true);
        triggerConfetti();
        setMatches(prev => {
          if (prev.some(m => m.matched_pet_id === pet.id)) return prev;
          return [{
            match_id: `demo-match-${pet.id}`,
            matched_pet_id: pet.id,
            matched_pet_name: pet.name,
            matched_pet_breed: pet.breed,
            matched_pet_species: pet.species,
            matched_pet_energy: pet.energy_level,
            matched_pet_play_style: pet.play_style,
            matched_pet_avatar: pet.image,
            matched_pet_photos: pet.photos || [pet.image],
            owner_id: pet.owner_id || pet.id,
            owner_name: pet.parents,
            owner_neighborhood: pet.area_neighborhood,
            matched_at: new Date().toISOString(),
            latest_message: null,
            has_conversation: false
          }, ...prev];
        });
        setLikedYouPets(prev => prev.filter(p => p.id !== pet.id));
      }
    } catch (err) {
      console.warn('Swipe error in Liked You:', err);
    }
  };

  // Dismiss / pass handler from Liked You tab
  const handlePassOnLikedYou = async (pet) => {
    try {
      if (pet.id && !String(pet.id).startsWith('demo-')) {
        await communityApi.swipePet(pet.id, 'pass');
      }
      setLikedYouPets(prev => prev.filter(p => p.id !== pet.id));
      showSwipeNotice(`Dismissed ${pet.name} from Liked You.`, 'pass');
    } catch (err) {
      console.warn('Pass error in Liked You:', err);
    }
  };

  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  const activeDeck = useMemo(() => {
    if (activePet?.id) {
      return pets.filter(p => p.id !== activePet.id);
    }
    return pets;
  }, [pets, activePet?.id]);

  const currentPet = (activeDeck.length > 0 && currentPetIndex < activeDeck.length)
    ? activeDeck[currentPetIndex]
    : null;
  const nextPet = (activeDeck.length > 1 && (currentPetIndex + 1) < activeDeck.length)
    ? activeDeck[currentPetIndex + 1]
    : null;

  // Resolve multiple gallery photos for active pet
  const currentPetPhotos = useMemo(() => {
    if (!currentPet) return [];
    if (Array.isArray(currentPet.photos) && currentPet.photos.length > 0) {
      return currentPet.photos;
    }
    return currentPet.image ? [currentPet.image] : [];
  }, [currentPet]);

  const nextPetPhotos = useMemo(() => {
    if (!nextPet) return [];
    if (Array.isArray(nextPet.photos) && nextPet.photos.length > 0) {
      return nextPet.photos;
    }
    return nextPet.image ? [nextPet.image] : [];
  }, [nextPet]);

  // Reset photo index when current pet changes
  useEffect(() => {
    setCurrentPhotoIndex(0);
  }, [currentPetIndex]);

  const handleDistanceChange = (val) => {
    const num = Math.min(100, Math.max(1, Number(val)));
    setDiscoveryDistance(num);
    localStorage.setItem('pawcircle_discovery_distance', String(num));
  };

  const triggerConfetti = () => {
    // 1. Center high-spread burst
    confetti({
      particleCount: 100,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#ffc93c', '#fc6955', '#75e6a4', '#ff4d6d', '#775a00']
    });
    // 2. Left celebration cannon
    setTimeout(() => {
      confetti({
        particleCount: 60,
        angle: 60,
        spread: 60,
        origin: { x: 0.15, y: 0.7 },
        colors: ['#ffc93c', '#fc6955', '#75e6a4', '#ff4d6d']
      });
    }, 160);
    // 3. Right celebration cannon
    setTimeout(() => {
      confetti({
        particleCount: 60,
        angle: 120,
        spread: 60,
        origin: { x: 0.85, y: 0.7 },
        colors: ['#ffc93c', '#fc6955', '#75e6a4', '#ff4d6d']
      });
    }, 320);
  };

  // Swiping (like or pass) with snappy optimistic animation & non-blocking background sync
  const handleSwipe = (action, simulateReciprocal = false) => {
    if (!currentPet || flyOutAnim) return;

    const animDirection = action === 'like' ? 'right' : 'left';
    setFlyOutAnim(animDirection);
    const targetPet = currentPet;
    const isReciprocal = Boolean(simulateReciprocal || targetPet.has_liked_you);

    // Fast, responsive card fly-out: advance deck after 200ms without blocking on network!
    setTimeout(() => {
      setFlyOutAnim(null);
      setDragOffset({ x: 0, y: 0 });
      setCurrentPhotoIndex(0);
      setCurrentPetIndex(prev => prev + 1);
    }, 200);

    // Non-blocking background sync with backend
    (async () => {
      try {
        if (targetPet.id && !String(targetPet.id).startsWith('demo-')) {
          const res = await communityApi.swipePet(targetPet.id, action, activePet?.id, isReciprocal);
          if (res?.is_match || (action === 'like' && isReciprocal)) {
            // Both parties like each other -> Mutual Match!
            const newMatchId = res?.match_id || `match-${targetPet.id}-${Date.now()}`;
            setMatchedPet(targetPet);
            setShowMatchModal(true);
            triggerConfetti();
            setLikedYouPets(prev => prev.filter(p => p.id !== targetPet.id));
            setMatches(prev => {
              if (prev.some(m => m.matched_pet_id === targetPet.id)) return prev;
              return [{
                match_id: newMatchId,
                matched_pet_id: targetPet.id,
                matched_pet_name: targetPet.name,
                matched_pet_breed: targetPet.breed,
                matched_pet_species: targetPet.species,
                matched_pet_energy: targetPet.energy_level,
                matched_pet_play_style: targetPet.play_style,
                matched_pet_avatar: targetPet.image,
                matched_pet_photos: targetPet.photos || [targetPet.image],
                owner_id: targetPet.owner_id || targetPet.id,
                owner_name: targetPet.parents,
                owner_neighborhood: targetPet.area_neighborhood,
                matched_at: new Date().toISOString(),
                latest_message: null,
                has_conversation: false
              }, ...prev];
            });
            loadMatches();
            showSwipeNotice(`🎉 It's a Mutual Match with ${targetPet.name}!`, 'like');
          } else if (action === 'like') {
            showSwipeNotice(`Liked ${targetPet.name}! When they like ${activePet?.name || 'your pet'} back, it's a mutual match! 🐾`, 'like');
          } else {
            showSwipeNotice(`Passed on ${targetPet.name}.`, 'pass');
          }
        } else {
          // Fallback demo pet profile handling
          if (action === 'like') {
            if (isReciprocal) {
              // Reciprocal like exists -> Mutual Match!
              const newMatchId = `demo-match-${targetPet.id}`;
              setMatchedPet(targetPet);
              setShowMatchModal(true);
              triggerConfetti();
              setLikedYouPets(prev => prev.filter(p => p.id !== targetPet.id));
              setMatches(prev => {
                if (prev.some(m => m.matched_pet_id === targetPet.id)) return prev;
                return [{
                  match_id: newMatchId,
                  matched_pet_id: targetPet.id,
                  matched_pet_name: targetPet.name,
                  matched_pet_breed: targetPet.breed,
                  matched_pet_species: targetPet.species,
                  matched_pet_energy: targetPet.energy_level,
                  matched_pet_play_style: targetPet.play_style,
                  matched_pet_avatar: targetPet.image,
                  matched_pet_photos: targetPet.photos || [targetPet.image],
                  owner_id: targetPet.owner_id || targetPet.id,
                  owner_name: targetPet.parents,
                  owner_neighborhood: targetPet.area_neighborhood,
                  matched_at: new Date().toISOString(),
                  latest_message: null,
                  has_conversation: false
                }, ...prev];
              });
              showSwipeNotice(`🎉 It's a Mutual Match with ${targetPet.name}!`, 'like');
            } else {
              showSwipeNotice(`Liked ${targetPet.name}! When they like ${activePet?.name || 'your pet'} back, it's a mutual match! 🐾`, 'like');
            }
          } else {
            showSwipeNotice(`Passed on ${targetPet.name}.`, 'pass');
          }
        }
      } catch (err) {
        console.warn('Backend swipe sync note:', err.message);
        if (action === 'like') {
          if (isReciprocal) {
            const fallbackMatchId = `match-fb-${targetPet.id}-${Date.now()}`;
            setMatchedPet(targetPet);
            setShowMatchModal(true);
            triggerConfetti();
            setLikedYouPets(prev => prev.filter(p => p.id !== targetPet.id));
            setMatches(prev => {
              if (prev.some(m => m.matched_pet_id === targetPet.id)) return prev;
              return [{
                match_id: fallbackMatchId,
                matched_pet_id: targetPet.id,
                matched_pet_name: targetPet.name,
                matched_pet_breed: targetPet.breed,
                matched_pet_species: targetPet.species,
                matched_pet_energy: targetPet.energy_level,
                matched_pet_play_style: targetPet.play_style,
                matched_pet_avatar: targetPet.image,
                matched_pet_photos: targetPet.photos || [targetPet.image],
                owner_id: targetPet.owner_id || targetPet.id,
                owner_name: targetPet.parents,
                owner_neighborhood: targetPet.area_neighborhood,
                matched_at: new Date().toISOString(),
                latest_message: null,
                has_conversation: false
              }, ...prev];
            });
            showSwipeNotice(`🎉 It's a Mutual Match with ${targetPet.name}!`, 'like');
          } else {
            showSwipeNotice(`Liked ${targetPet.name}! When they like ${activePet?.name || 'your pet'} back, it's a mutual match! 🐾`, 'like');
          }
        }
      }
    })();
  };

  // Profile-only Navigation
  const handlePrevPet = () => {
    if (!activeDeck || activeDeck.length === 0) return;
    setFlyOutAnim(null);
    setDragOffset({ x: 0, y: 0 });
    setIsDragging(false);
    setCurrentPhotoIndex(0);
    setCurrentPetIndex(prev => Math.max(0, prev - 1));
  };

  const handleNextPet = () => {
    if (!activeDeck || activeDeck.length === 0) return;
    setFlyOutAnim(null);
    setDragOffset({ x: 0, y: 0 });
    setIsDragging(false);
    setCurrentPhotoIndex(0);
    setCurrentPetIndex(prev => prev + 1);
  };

  // Card Left/Right Arrow Navigation: steps through pet's photos, then advances profile
  const handleNextMediaOrPet = () => {
    if (!currentPet || !activeDeck || activeDeck.length === 0) return;
    setFlyOutAnim(null);
    setDragOffset({ x: 0, y: 0 });
    setIsDragging(false);

    if (currentPhotoIndex < currentPetPhotos.length - 1) {
      setCurrentPhotoIndex(prev => prev + 1);
    } else {
      setCurrentPhotoIndex(0);
      setCurrentPetIndex(prev => prev + 1);
    }
  };

  const handlePrevMediaOrPet = () => {
    if (!currentPet || !activeDeck || activeDeck.length === 0) return;
    setFlyOutAnim(null);
    setDragOffset({ x: 0, y: 0 });
    setIsDragging(false);

    if (currentPhotoIndex > 0) {
      setCurrentPhotoIndex(prev => prev - 1);
    } else if (currentPetIndex > 0) {
      const prevIndex = currentPetIndex - 1;
      const prevPet = activeDeck[prevIndex];
      const prevPhotos = (prevPet?.photos && prevPet.photos.length > 0) ? prevPet.photos : [prevPet?.image].filter(Boolean);
      setCurrentPhotoIndex(Math.max(0, prevPhotos.length - 1));
      setCurrentPetIndex(prevIndex);
    }
  };

  // Drag & Swipe gesture handlers (protected against capturing button/link clicks)
  const handlePointerDown = (e) => {
    if (e.target.closest('button, a, input, select, textarea')) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    setIsDragging(true);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setDragOffset({ x: 0, y: 0 });
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartPos.x;
    const dy = e.clientY - dragStartPos.y;
    setDragOffset({ x: dx, y: dy });
  };

  const handlePointerUp = (e) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}

    if (dragOffset.x > 85) {
      handleSwipe('like');
    } else if (dragOffset.x < -85) {
      handleSwipe('pass');
    } else {
      setDragOffset({ x: 0, y: 0 });
    }
  };

  const handlePointerCancel = () => {
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
  };

  // Keyboard arrow keys for swipe and photo navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (activeSubView !== 'discover' || inspectPet || showMatchModal || showDistanceFilterModal) return;
      if (e.target.closest('input, textarea, select')) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevMediaOrPet();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextMediaOrPet();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentPet) setInspectPet(currentPet);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSubView, currentPet, inspectPet, showMatchModal, showDistanceFilterModal, currentPhotoIndex, currentPetPhotos, currentPetIndex, activeDeck]);

  // Open Chat with a Match
  const handleOpenChatWithMatch = async (match) => {
    setActiveMatch(match);
    setActiveSubView('chat');
    setChatLoading(true);

    try {
      const msgs = await communityApi.getMessages(match.owner_id);
      if (Array.isArray(msgs) && msgs.length > 0) {
        setChatMessages(msgs.map(m => ({
          id: m.id,
          sender: m.sender_id === match.owner_id ? 'them' : 'me',
          author: m.sender_id === match.owner_id ? (match.owner_name || match.matched_pet_name) : 'You',
          time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: m.content
        })));
      } else {
        // No messages yet — clean empty chat ready for user's starter!
        setChatMessages([]);
      }
    } catch (err) {
      console.warn('Could not load chat messages:', err);
      setChatMessages([]);
    } finally {
      setChatLoading(false);
    }
  };

  // Direct chat sender
  const handleSendChat = async (e) => {
    if (e) e.preventDefault();
    if (!replyInput.trim()) return;

    const textToSend = replyInput.trim();
    const tempId = Date.now();
    const newMsg = {
      id: tempId,
      sender: 'me',
      author: 'You',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: textToSend
    };

    setChatMessages(prev => [...prev, newMsg]);
    setReplyInput('');

    // Instantly shift this match from "Playdate Matches" to "Active Playdate Conversations"
    setMatches(prev => prev.map(m => {
      const isTarget = m.match_id === activeMatch?.match_id || 
                       m.matched_pet_id === activeMatch?.matched_pet_id || 
                       m.owner_id === activeMatch?.owner_id;
      if (isTarget) {
        return {
          ...m,
          has_conversation: true,
          latest_message: textToSend,
          latest_message_time: new Date().toISOString()
        };
      }
      return m;
    }));

    try {
      const recipientId = activeMatch?.owner_id || matchedPet?.owner_id;
      if (recipientId) {
        await communityApi.sendMessage(recipientId, textToSend, activeMatch?.match_id);
        // Refresh messages after 1.2s to pick up neighbor's auto-reply
        setTimeout(async () => {
          try {
            const updated = await communityApi.getMessages(recipientId);
            if (Array.isArray(updated) && updated.length > 0) {
              setChatMessages(updated.map(m => ({
                id: m.id,
                sender: m.sender_id === recipientId ? 'them' : 'me',
                author: m.sender_id === recipientId ? (activeMatch?.owner_name || 'Neighbor') : 'You',
                time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                text: m.content
              })));
              loadMatches();
            }
          } catch (_) {}
        }, 1200);
      }
    } catch (err) {
      console.warn('Backend message sync note:', err.message);
    }
  };

  // RSVP for Pack Walk Event
  const handleRsvp = async (event) => {
    try {
      const petId = activePet?.id || (pets[0]?.id && !String(pets[0].id).startsWith('demo-') ? pets[0].id : null);
      if (petId) {
        await communityApi.rsvpEvent(event.id, petId, 'going');
      }
      setRsvpSuccess(`RSVP Confirmed for "${event.title}"! Pack ticket issued.`);
      loadEvents();
      setTimeout(() => setRsvpSuccess(null), 4000);
    } catch (err) {
      alert(err.message || 'Could not RSVP for event.');
    }
  };

  return (
    <div className="w-full max-w-[1180px] mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
      
      {/* ================= TOP SUB-NAV RIBBON ================= */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-2.5 bg-surface-container-lowest p-2 rounded-2xl border border-outline-variant/40 shadow-xs">
        {/* Left side navigation pills */}
        <div className="flex items-center gap-1 flex-wrap w-full md:w-auto">
          <button
            onClick={() => setActiveSubView('discover')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-sans text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubView === 'discover'
                ? 'bg-primary-container text-[#1c1b1a] shadow-xs'
                : 'text-on-surface-variant hover:text-[#1c1b1a] hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">view_carousel</span>
            <span>Discover Deck</span>
          </button>

          <button
            onClick={() => setActiveSubView('liked')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-sans text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              (activeSubView === 'liked' || activeSubView === 'browse')
                ? 'bg-primary-container text-[#1c1b1a] shadow-xs'
                : 'text-on-surface-variant hover:text-[#1c1b1a] hover:bg-surface-container'
            }`}
          >
            <span className={`material-symbols-outlined text-[16px] ${filteredLikedYouPets.length > 0 ? 'text-rose-500' : ''}`}>favorite</span>
            <span>Liked You</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${filteredLikedYouPets.length > 0 ? 'bg-rose-500 text-white animate-pulse' : 'bg-surface-container text-on-surface-variant'}`}>
              {filteredLikedYouPets.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubView('matches')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-sans text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubView === 'matches'
                ? 'bg-primary-container text-[#1c1b1a] shadow-xs'
                : 'text-on-surface-variant hover:text-[#1c1b1a] hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">favorite</span>
            <span>Matches &amp; Chats</span>
            {matches.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-secondary text-white text-[10px] font-bold">
                {matches.length}
              </span>
            )}
          </button>
        </div>

        {/* Right side filter controls */}
        <div className="flex items-center gap-1.5 w-full md:w-auto justify-end flex-wrap">
          {/* Species quick pill */}
          <div className="flex items-center bg-surface-container rounded-full p-0.5 text-xs font-semibold gap-0.5">
            <button
              onClick={() => setSpeciesFilter('all')}
              className={`px-2.5 py-1 rounded-full transition-colors cursor-pointer text-xs ${
                speciesFilter === 'all' ? 'bg-surface-container-lowest text-[#1c1b1a] shadow-xs font-bold' : 'text-outline hover:text-[#1c1b1a]'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSpeciesFilter('dog')}
              className={`px-2.5 py-1 rounded-full transition-colors cursor-pointer text-xs ${
                speciesFilter === 'dog' ? 'bg-surface-container-lowest text-[#1c1b1a] shadow-xs font-bold' : 'text-outline hover:text-[#1c1b1a]'
              }`}
            >
              Dogs 🐕
            </button>
            <button
              onClick={() => setSpeciesFilter('cat')}
              className={`px-2.5 py-1 rounded-full transition-colors cursor-pointer text-xs ${
                speciesFilter === 'cat' ? 'bg-surface-container-lowest text-[#1c1b1a] shadow-xs font-bold' : 'text-outline hover:text-[#1c1b1a]'
              }`}
            >
              Cats 🐈
            </button>
          </div>

          {/* Distance radar pill */}
          <button
            type="button"
            onClick={() => setShowDistanceFilterModal(true)}
            className="flex items-center gap-1 px-3 py-1 bg-surface-container-low hover:bg-surface-container rounded-full border border-outline-variant/40 shadow-xs text-xs font-semibold text-[#1c1b1a] transition-all cursor-pointer group"
            title="Adjust discovery distance"
          >
            <span className="material-symbols-outlined text-secondary text-[15px]">radar</span>
            <span>{currentPet?.area_neighborhood || 'Model Town'} • {discoveryDistance} km</span>
            <span className="material-symbols-outlined text-[13px] text-outline group-hover:text-primary transition-colors">tune</span>
          </button>

          {/* Simulate Mutual Match button */}
          <button
            type="button"
            onClick={() => {
              if (currentPet) {
                currentPet.has_liked_you = true;
                handleSwipe('like', true);
              }
            }}
            className="flex items-center gap-1 px-2.5 py-1 bg-surface-container-low hover:bg-amber-50 rounded-full border border-outline-variant/40 hover:border-amber-300 shadow-xs text-xs font-bold text-[#1c1b1a] hover:text-amber-900 transition-all cursor-pointer hover:scale-105 active:scale-95"
            title="Simulate that this pet liked you first, triggering an instant mutual match!"
          >
            <span className="material-symbols-outlined text-[15px] text-amber-500">auto_awesome</span>
            <span>Simulate Like</span>
          </button>
        </div>
      </div>

      {/* RSVP Notification Banner */}
      {rsvpSuccess && (
        <div className="w-full p-3.5 rounded-2xl bg-tertiary-container/30 border border-tertiary/40 text-on-surface flex items-center justify-between text-xs sm:text-sm font-semibold animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-tertiary text-[20px]">check_circle</span>
            <span>{rsvpSuccess}</span>
          </div>
          <button onClick={() => setRsvpSuccess(null)} className="text-outline hover:text-on-surface">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* ================= VIEW 1: DISCOVER (SWIPE DECK) ================= */}
      {activeSubView === 'discover' && loading && (
        <section className="flex flex-col items-center justify-center w-full py-20 text-center">
          <div className="w-12 h-12 rounded-full border-3 border-amber-500/20 border-t-amber-500 animate-spin mb-4"></div>
          <h3 className="font-headline-sm text-base font-bold text-[#1c1b1a]">Scanning neighborhood radar...</h3>
          <p className="text-xs text-on-surface-variant mt-1">Discovering nearby pet parents within {discoveryDistance} km</p>
        </section>
      )}

      {activeSubView === 'discover' && !loading && currentPet && (
        <section className="flex flex-col items-center justify-center w-full py-1">
          {/* Card counter ribbon & keyboard hints */}
          <div className="flex items-center justify-between w-full max-w-[440px] px-2 mb-2 text-xs font-bold">
            <span className="flex items-center gap-1.5 text-[#1c1b1a]">
              <span className="material-symbols-outlined text-[16px] text-primary animate-pulse">pets</span>
              <span>
                Profile {currentPetIndex + 1} of {activeDeck.length}
                {currentPetPhotos.length > 1 && (
                  <span className="text-outline font-normal ml-1.5 text-[11px]">
                    · Photo {currentPhotoIndex + 1}/{currentPetPhotos.length}
                  </span>
                )}
              </span>
            </span>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-[#4f4634] text-[11px] font-semibold">
                {currentPet.distance_label || `${currentPet.distance_km || 1.8} km away`}
              </span>
            </div>
          </div>

          <div className="relative w-full max-w-[440px] flex flex-col items-center">
            {/* Background stacked rim (3rd suggestion) */}
            <div className="absolute top-2.5 w-[92%] h-[460px] bg-surface-container-high rounded-3xl -z-20 shadow-xs opacity-60 pointer-events-none"></div>

            {/* Next Card in Deck (Directly visible underneath during drag/swipe - no blank square!) */}
            {nextPet && (
              <div
                style={{
                  transform: (isDragging || flyOutAnim)
                    ? 'scale(1) translate3d(0, 0, 0)'
                    : 'scale(0.96) translate3d(0, 6px, 0)',
                  opacity: (isDragging || flyOutAnim) ? 1 : 0.88,
                  transition: isDragging ? 'transform 0.08s ease-out, opacity 0.08s ease-out' : 'all 0.20s cubic-bezier(0.2, 0.8, 0.2, 1)',
                  zIndex: 1
                }}
                className="absolute top-0 w-full bg-white rounded-3xl border border-outline-variant/40 shadow-md overflow-hidden flex flex-col select-none pointer-events-none"
              >
                {/* Photo Canvas */}
                <div className="relative h-[230px] sm:h-[250px] w-full bg-surface-variant overflow-hidden">
                  <img
                    src={resolveImageUrl(nextPetPhotos[0] || nextPet.image)}
                    alt={nextPet.name}
                    className="w-full h-full object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/30"></div>
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full bg-black/55 backdrop-blur-md text-[11px] font-bold text-white flex items-center gap-1 shadow-xs">
                      <span className="material-symbols-outlined text-[14px] text-amber-300">stars</span>
                      <span>High Compatibility</span>
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-white/95 backdrop-blur-md text-[11px] font-bold text-[#1c1b1a] shadow-xs">
                      {nextPet.species === 'cat' ? 'Cat 🐈' : 'Dog 🐕'}
                    </span>
                  </div>
                  <div className="absolute bottom-2.5 left-3 right-3 flex flex-wrap gap-1.5">
                    {nextPet.tags?.map((tag, i) => (
                      <span key={i} className="px-2.5 py-0.5 rounded-full bg-white/95 backdrop-blur-md text-[10px] sm:text-[11px] font-bold text-[#1c1b1a] shadow-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Card Profile Details */}
                <div className="p-4 sm:p-5 bg-white flex flex-col gap-3 text-[#1c1b1a]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-2">
                      <h2 className="font-headline-md text-xl sm:text-2xl font-extrabold text-[#1c1b1a] tracking-tight">
                        {nextPet.name}, {nextPet.age}
                      </h2>
                      <span className="text-xs text-[#715500] font-bold">· {nextPet.breed}</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-[#1c1b1a] text-[11px] font-bold">
                      {nextPet.distance_km || 1.8} km
                    </span>
                  </div>

                  <div className="bg-[#fcfaf7] border border-[#ede5d8] rounded-2xl p-3 flex items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-tr from-amber-200 to-amber-100 border-2 border-white shadow-xs flex items-center justify-center">
                        {nextPet.owner_avatar ? (
                          <img src={resolveImageUrl(nextPet.owner_avatar)} alt={nextPet.parents} className="w-full h-full object-cover" />
                        ) : (
                          <span className="font-extrabold text-xs text-[#775a00] tracking-wider">
                            {nextPet.owner_initials || (nextPet.parents ? nextPet.parents.slice(0, 2).toUpperCase() : 'PP')}
                          </span>
                        )}
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-xs sm:text-sm text-[#1c1b1a] truncate">{nextPet.parents}</span>
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                            Verified
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-[#5c5346] font-medium truncate mt-0.5">
                          <span className="font-semibold text-amber-800">{nextPet.household_mode === 'couple' ? 'Couple' : 'Solo Parent'}</span>
                          <span>•</span>
                          <span>{nextPet.area_neighborhood || nextPet.city || 'Local area'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-[#4f4634] leading-relaxed line-clamp-2 mt-0.5 font-normal">
                    {nextPet.bio}
                  </p>
                </div>
              </div>
            )}

            {/* Main Interactive Swipe Card (Draggable Tinder/Bumble card) */}
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              style={{
                transform: flyOutAnim === 'left'
                  ? 'translate3d(-130%, 0, 0) rotate(-22deg)'
                  : flyOutAnim === 'right'
                  ? 'translate3d(130%, 0, 0) rotate(22deg)'
                  : isDragging
                  ? `translate3d(${dragOffset.x}px, ${dragOffset.y * 0.25}px, 0) rotate(${dragOffset.x * 0.08}deg)`
                  : 'none',
                transition: isDragging ? 'none' : 'transform 0.20s cubic-bezier(0.2, 0.8, 0.2, 1)',
                cursor: isDragging ? 'grabbing' : 'grab',
                touchAction: 'none',
                zIndex: 10
              }}
              className="relative w-full bg-white rounded-3xl border border-outline-variant/50 shadow-xl overflow-hidden flex flex-col transition-shadow select-none group"
            >
              {/* Dynamic LIKE & PLAY Overlay Stamp */}
              {(dragOffset.x > 20 || flyOutAnim === 'right') && (
                <div
                  style={{ opacity: flyOutAnim === 'right' ? 1 : Math.min(1, (dragOffset.x - 20) / 70) }}
                  className="absolute top-7 left-6 z-30 px-4 py-1.5 rounded-2xl border-4 border-emerald-500 bg-white/95 backdrop-blur-xs text-emerald-600 font-extrabold text-lg sm:text-xl uppercase tracking-wider rotate-[-12deg] shadow-lg pointer-events-none flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[24px]">favorite</span>
                  <span>LIKE &amp; PLAY</span>
                </div>
              )}

              {/* Dynamic PASS Overlay Stamp */}
              {(dragOffset.x < -20 || flyOutAnim === 'left') && (
                <div
                  style={{ opacity: flyOutAnim === 'left' ? 1 : Math.min(1, (Math.abs(dragOffset.x) - 20) / 70) }}
                  className="absolute top-7 right-6 z-30 px-4 py-1.5 rounded-2xl border-4 border-rose-500 bg-white/95 backdrop-blur-xs text-rose-600 font-extrabold text-lg sm:text-xl uppercase tracking-wider rotate-[12deg] shadow-lg pointer-events-none flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[24px]">close</span>
                  <span>PASS</span>
                </div>
              )}
              
              {/* Card Photo Canvas */}
              <div className="relative h-[230px] sm:h-[250px] w-full bg-surface-variant overflow-hidden">
                <img
                  key={`${currentPet.id || currentPetIndex}-${currentPhotoIndex}`}
                  src={resolveImageUrl(currentPetPhotos[currentPhotoIndex] || currentPet.image)}
                  alt={`${currentPet.name} - Photo ${currentPhotoIndex + 1}`}
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 pointer-events-none"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/30 pointer-events-none"></div>

                {/* Photo Story Progress Indicator Bars (Instagram/Tinder style) */}
                {currentPetPhotos.length > 1 && (
                  <div className="absolute top-2 left-3 right-3 z-20 flex items-center gap-1.5">
                    {currentPetPhotos.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        aria-label={`Jump to photo ${idx + 1}`}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentPhotoIndex(idx);
                        }}
                        className={`h-1 flex-1 rounded-full transition-all duration-200 cursor-pointer ${
                          idx === currentPhotoIndex
                            ? 'bg-white shadow-xs'
                            : 'bg-white/40 hover:bg-white/75'
                        }`}
                      />
                    ))}
                  </div>
                )}

                {/* Top Badge: Compatibility & Species & Liked You */}
                <div className={`absolute ${currentPetPhotos.length > 1 ? 'top-5' : 'top-3'} left-3 right-3 z-10 flex items-center justify-between pointer-events-none`}>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {currentPet.has_liked_you && (
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-500 text-white text-[11px] font-extrabold flex items-center gap-1 shadow-md animate-pulse">
                        <span className="material-symbols-outlined text-[13px]">favorite</span>
                        <span>Liked Your Pet!</span>
                      </span>
                    )}
                    <span className="px-3 py-1 rounded-full bg-black/55 backdrop-blur-md text-[11px] font-bold text-white flex items-center gap-1 shadow-xs">
                      <span className="material-symbols-outlined text-[14px] text-amber-300">stars</span>
                      <span>High Compatibility</span>
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-white/95 backdrop-blur-md text-[11px] font-bold text-[#1c1b1a] shadow-xs">
                    {currentPet.species === 'cat' ? 'Cat 🐈' : 'Dog 🐕'}
                  </span>
                </div>

                {/* Floating Previous & Next arrow buttons on card */}
                <button
                  type="button"
                  aria-label="Previous photo or pet profile"
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onMouseUp={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrevMediaOrPet();
                  }}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/50 hover:bg-black/85 backdrop-blur-md text-white flex items-center justify-center transition-all cursor-pointer shadow-lg opacity-85 hover:opacity-100 hover:scale-115 active:scale-90 z-30 group/btn"
                  title={currentPhotoIndex > 0 ? "Previous photo" : "Previous pet profile"}
                >
                  <span className="material-symbols-outlined text-[18px] sm:text-[20px] pointer-events-none select-none group-hover/btn:-translate-x-0.5 transition-transform">chevron_left</span>
                </button>
                <button
                  type="button"
                  aria-label="Next photo or pet profile"
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onMouseUp={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNextMediaOrPet();
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/50 hover:bg-black/85 backdrop-blur-md text-white flex items-center justify-center transition-all cursor-pointer shadow-lg opacity-85 hover:opacity-100 hover:scale-115 active:scale-90 z-30 group/btn"
                  title={currentPhotoIndex < currentPetPhotos.length - 1 ? "Next photo" : "Next pet profile"}
                >
                  <span className="material-symbols-outlined text-[18px] sm:text-[20px] pointer-events-none select-none group-hover/btn:translate-x-0.5 transition-transform">chevron_right</span>
                </button>

                {/* Bottom trait chips */}
                <div className="absolute bottom-2.5 left-3 right-3 flex flex-wrap gap-1.5 z-10 pointer-events-none">
                  {currentPet.tags?.map((tag, i) => (
                    <span key={i} className="px-2.5 py-0.5 rounded-full bg-white/95 backdrop-blur-md text-[10px] sm:text-[11px] font-bold text-[#1c1b1a] shadow-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Card Profile Details Panel */}
              <div className="p-4 sm:p-5 bg-white flex flex-col gap-3 text-[#1c1b1a]">
                {/* Pet Name & Proximity */}
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-2">
                    <h2 className="font-headline-md text-xl sm:text-2xl font-extrabold text-[#1c1b1a] tracking-tight">
                      {currentPet.name}, {currentPet.age}
                    </h2>
                    <span className="text-xs text-[#715500] font-bold">· {currentPet.breed}</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-[#1c1b1a] text-[11px] font-bold">
                    {currentPet.distance_km || 1.8} km
                  </span>
                </div>

                {/* DEDICATED PET PARENT CARD (High-contrast, rich details) */}
                <div className="bg-[#fcfaf7] border border-[#ede5d8] rounded-2xl p-3 flex items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Parent Avatar / Monogram */}
                    <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-tr from-amber-200 to-amber-100 border-2 border-white shadow-xs flex items-center justify-center">
                      {currentPet.owner_avatar ? (
                        <img src={resolveImageUrl(currentPet.owner_avatar)} alt={currentPet.parents} className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-extrabold text-xs text-[#775a00] tracking-wider">
                          {currentPet.owner_initials || (currentPet.parents ? currentPet.parents.slice(0, 2).toUpperCase() : 'PP')}
                        </span>
                      )}
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" title="Active pet parent"></span>
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-extrabold text-xs sm:text-sm text-[#1c1b1a] truncate">
                          {currentPet.parents}
                        </span>
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                          <span className="material-symbols-outlined text-[11px]">verified</span>
                          Verified
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-[#5c5346] font-medium truncate mt-0.5">
                        <span className="font-semibold text-amber-800">{currentPet.household_mode === 'couple' ? 'Couple' : 'Solo Parent'}</span>
                        <span>•</span>
                        <span>{currentPet.area_neighborhood || currentPet.city || 'Model Town'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Say Hi chat trigger */}
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenChatWithMatch({
                        owner_id: currentPet.owner_id,
                        owner_name: currentPet.parents,
                        matched_pet_name: currentPet.name,
                        matched_pet_avatar: currentPet.image,
                        owner_neighborhood: currentPet.area_neighborhood
                      });
                    }}
                    className="px-2.5 py-1 rounded-full bg-amber-100 hover:bg-amber-200 text-[#715500] text-xs font-bold transition-all flex items-center gap-1 shadow-2xs cursor-pointer flex-shrink-0"
                    title="Send a message to this parent"
                  >
                    <span className="material-symbols-outlined text-[14px]">chat</span>
                    <span>Say Hi</span>
                  </button>
                </div>

                {/* Bio text */}
                <p className="text-xs text-[#4f4634] leading-relaxed line-clamp-2 mt-0.5 font-normal">
                  {currentPet.bio}
                </p>

                {/* View Details trigger */}
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setInspectPet(currentPet)}
                  className="self-start text-xs font-bold text-primary hover:text-[#5a4300] flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>View Full Profile &amp; Vaccination Card</span>
                  <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                </button>
              </div>
            </div>

            {/* Action Buttons: Pass, Inspect, Like */}
            <div className="flex items-center justify-center gap-6 mt-3.5 w-full">
              {/* Pass Button */}
              <button
                type="button"
                aria-label="Pass Profile"
                onClick={() => handleSwipe('pass')}
                className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-white border-2 border-rose-200 hover:border-rose-400 hover:bg-rose-50 text-rose-600 flex items-center justify-center shadow-md hover:scale-110 active:scale-90 transition-all cursor-pointer group"
                title="Pass (Left Arrow ←)"
              >
                <span className="material-symbols-outlined text-[28px] sm:text-[30px] font-bold group-hover:rotate-90 transition-transform">close</span>
              </button>

              {/* Inspect Profile Button */}
              <button
                type="button"
                aria-label="Inspect Profile"
                onClick={() => setInspectPet(currentPet)}
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-amber-50 hover:bg-amber-100 border-2 border-amber-200 text-amber-800 flex items-center justify-center shadow-xs hover:scale-110 active:scale-90 transition-all cursor-pointer"
                title="View Full Profile Details (Up Arrow ↑)"
              >
                <span className="material-symbols-outlined text-[22px] sm:text-[24px]">info</span>
              </button>

              {/* Like Button */}
              <button
                type="button"
                aria-label="Like and Match"
                onClick={() => handleSwipe('like')}
                className="w-15 h-15 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-amber-400 to-amber-300 hover:from-amber-500 hover:to-amber-400 text-[#1c1b1a] border-2 border-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/25 hover:scale-110 active:scale-90 transition-all cursor-pointer group"
                title="Like & Playdate Match (Right Arrow →)"
              >
                <span className="material-symbols-outlined text-[32px] sm:text-[36px] text-[#1c1b1a] group-hover:scale-110 transition-transform">pets</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {activeSubView === 'discover' && !loading && !currentPet && (
        <section className="flex flex-col items-center justify-center w-full py-16 px-4 text-center bg-white rounded-3xl border border-outline-variant/40 shadow-xs max-w-lg mx-auto my-6">
          <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mb-4 text-amber-700">
            <span className="material-symbols-outlined text-[36px]">pets</span>
          </div>
          <h3 className="font-headline-sm text-lg font-bold text-[#1c1b1a]">
            {activeDeck.length > 0 ? "You've seen all nearby profiles!" : "No pet profiles discovered nearby"}
          </h3>
          <p className="text-xs text-on-surface-variant max-w-sm mt-1.5 leading-relaxed">
            {activeDeck.length > 0
              ? `You have swiped through all ${activeDeck.length} available pet profiles in your area. Expand your radius or check back later for new pet parents!`
              : `There are no other active pet profiles within ${discoveryDistance} km of your area right now. Expand your search radius or invite neighborhood pet parents to join!`
            }
          </p>
          <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
            {activeDeck.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setCurrentPetIndex(0);
                  setCurrentPhotoIndex(0);
                }}
                className="px-4 py-2.5 rounded-full bg-primary-container hover:bg-primary-fixed-dim text-[#1c1b1a] text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">replay</span>
                <span>Review Again</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                const nextDist = Math.min(discoveryDistance + 25, 100);
                setDiscoveryDistance(nextDist);
                localStorage.setItem('pawcircle_discovery_distance', nextDist);
                setCurrentPetIndex(0);
                setCurrentPhotoIndex(0);
              }}
              className="px-4 py-2.5 rounded-full border border-outline-variant hover:bg-surface-container text-[#1c1b1a] text-xs font-bold transition-colors cursor-pointer"
            >
              Expand Radius ({Math.min(discoveryDistance + 25, 100)} km)
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrentPetIndex(0);
                setCurrentPhotoIndex(0);
                loadCommunityPets();
              }}
              className="px-4 py-2.5 rounded-full border border-outline-variant hover:bg-surface-container text-[#1c1b1a] text-xs font-bold transition-colors cursor-pointer"
            >
              Refresh Radar
            </button>
          </div>
        </section>
      )}

      {/* ================= VIEW 2: LIKED YOU (PETS & PARENTS WHO LIKED YOUR PROFILE) ================= */}
      {(activeSubView === 'liked' || activeSubView === 'browse') && (
        <section className="flex flex-col gap-6">
          {/* Header Banner */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-rose-50/80 via-surface-container-lowest to-amber-50/50 p-5 rounded-3xl border border-rose-200/60 shadow-xs">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white shadow-md flex-shrink-0">
                <span className="material-symbols-outlined text-2xl">favorite</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-headline-sm text-xl font-extrabold text-[#1c1b1a]">
                    People &amp; Pets Who Liked You
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-500 text-white text-xs font-black shadow-xs">
                    {filteredLikedYouPets.length}
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant mt-1 max-w-2xl leading-relaxed">
                  These verified neighborhood pet parents swiped like on {activePet?.name ? <strong className="text-[#1c1b1a]">{activePet.name}</strong> : 'your pet'}! Tap <strong>Like Back &amp; Match</strong> to instantly trigger a mutual match and shift them into Playdate Matches.
                </p>
              </div>
            </div>

            {/* Sub-view filters & actions */}
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <button
                onClick={() => setActiveSubView('matches')}
                className="px-4 py-2 rounded-full bg-white border border-outline-variant/60 text-[#1c1b1a] text-xs font-bold hover:bg-surface-container transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px] text-secondary">forum</span>
                <span>Matches &amp; Chats ({matches.length})</span>
              </button>

              <button
                onClick={() => setActiveSubView('discover')}
                className="px-4 py-2 rounded-full bg-white border border-outline-variant/60 text-[#1c1b1a] text-xs font-bold hover:bg-surface-container transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">view_carousel</span>
                <span>Discover Deck</span>
              </button>
            </div>
          </div>

          {/* Cards Grid or Empty State */}
          {filteredLikedYouPets.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-3xl p-12 text-center border border-dashed border-rose-200/80 flex flex-col items-center justify-center max-w-xl mx-auto shadow-xs my-6">
              <div className="w-16 h-16 rounded-full bg-rose-100/80 flex items-center justify-center text-rose-500 mb-4 shadow-inner">
                <span className="material-symbols-outlined text-3xl">favorite_border</span>
              </div>
              <h4 className="font-headline-sm text-lg font-bold text-[#1c1b1a] mb-1">
                No pending likes right now
              </h4>
              <p className="text-xs text-on-surface-variant max-w-md mx-auto mb-5 leading-relaxed">
                When other verified pet parents swipe like on {activePet?.name || 'your pet'}, they will appear here so you can like them back! When a like turns into a mutual match, it automatically moves to Matches &amp; Chats.
              </p>
              <div className="flex items-center gap-2 flex-wrap justify-center">
                {matches.length > 0 && (
                  <button
                    onClick={() => setActiveSubView('matches')}
                    className="px-4 py-2 rounded-full border border-outline-variant text-[#1c1b1a] text-xs font-bold hover:bg-surface-container transition-colors cursor-pointer"
                  >
                    View Matches &amp; Chats ({matches.length})
                  </button>
                )}
                <button
                  onClick={() => setActiveSubView('discover')}
                  className="px-5 py-2.5 rounded-full bg-primary-container text-[#1c1b1a] text-xs font-bold hover:bg-primary-fixed-dim transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">view_carousel</span>
                  <span>Explore Discover Deck</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredLikedYouPets.map((pet, idx) => (
                <div
                  key={pet.id || idx}
                  className="bg-white rounded-3xl border border-outline-variant/40 shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col overflow-hidden group hover:border-rose-300/80"
                >
                  {/* Photo Header */}
                  <div className="relative h-[220px] w-full overflow-hidden bg-surface-variant">
                    <img
                      src={resolveImageUrl(pet.image)}
                      alt={pet.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none"></div>

                    {/* Top status badges */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 z-10 pointer-events-none">
                      <span className="px-3 py-1 rounded-full bg-rose-600/95 backdrop-blur-md text-white text-[11px] font-extrabold flex items-center gap-1 shadow-xs animate-pulse">
                        <span className="material-symbols-outlined text-[13px]">favorite</span>
                        Liked Your Profile!
                      </span>

                      <span className="px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-bold text-white shadow-xs">
                        {pet.distance_km ? `${pet.distance_km} km` : '1.5 km'}
                      </span>
                    </div>

                    {/* Bottom overlay tags */}
                    <div className="absolute bottom-2.5 left-3 right-3 flex flex-wrap gap-1 z-10 pointer-events-none">
                      {pet.tags?.slice(0, 2).map((tag, tIdx) => (
                        <span key={tIdx} className="px-2 py-0.5 rounded-full bg-white/95 text-[10px] font-bold text-[#1c1b1a] shadow-xs">
                          {tag}
                        </span>
                      ))}
                      {pet.species && (
                        <span className="px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm text-[10px] font-bold text-white shadow-xs capitalize">
                          {pet.species === 'cat' ? '🐱 Cat' : '🐶 Dog'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 flex flex-col gap-2 flex-1 justify-between">
                    <div>
                      <div className="flex items-baseline justify-between gap-2">
                        <h4 className="font-headline-sm text-lg font-bold text-[#1c1b1a] truncate">
                          {pet.name}, <span className="text-on-surface-variant font-medium text-base">{pet.age}</span>
                        </h4>
                        <span className="text-[11px] text-[#5a4300] font-bold px-2 py-0.5 bg-amber-50 rounded-md border border-amber-200/50 whitespace-nowrap">
                          {pet.breed}
                        </span>
                      </div>

                      {/* Pet Parent Card */}
                      <div className="flex items-center gap-2.5 mt-2.5 p-2 rounded-xl bg-[#fcfaf7] border border-[#ede5d8]">
                        <div className="w-7 h-7 rounded-full bg-amber-100 border border-white shadow-2xs flex items-center justify-center font-extrabold text-[10px] text-[#775a00] flex-shrink-0">
                          {pet.owner_initials || (pet.parents ? pet.parents.slice(0, 2).toUpperCase() : 'PP')}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-xs font-bold text-[#1c1b1a] truncate flex items-center gap-1">
                            {pet.parents}
                            <span className="material-symbols-outlined text-[13px] text-emerald-600">verified</span>
                          </span>
                          <span className="text-[10px] text-[#5c5346] truncate">
                            {pet.household_mode === 'couple' ? 'Couple' : 'Solo Parent'} • {pet.area_neighborhood || pet.city || 'Model Town'}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-[#4f4634] mt-2 line-clamp-2 leading-relaxed">
                        {pet.bio || `${pet.name} is a friendly ${pet.breed} who loved your profile!`}
                      </p>
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="flex items-center gap-2 pt-3 border-t border-outline-variant/30 mt-3">
                      <button
                        onClick={() => setInspectPet(pet)}
                        className="py-2 px-3 rounded-full border border-outline-variant text-[#1c1b1a] text-xs font-bold hover:bg-surface-container transition-colors cursor-pointer"
                        title="View Full Profile & Photos"
                      >
                        Profile
                      </button>

                      <button
                        onClick={() => handlePassOnLikedYou(pet)}
                        className="p-2 rounded-full border border-outline-variant/60 text-outline hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Dismiss Like"
                      >
                        <span className="material-symbols-outlined text-[16px] block">close</span>
                      </button>

                      <button
                        onClick={() => handleLikeBack(pet)}
                        className="flex-1 py-2 rounded-full bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white text-xs font-bold transition-all shadow-xs hover:shadow-md flex items-center justify-center gap-1.5 cursor-pointer transform active:scale-95"
                      >
                        <span className="material-symbols-outlined text-[16px]">favorite</span>
                        <span>Like Back &amp; Match! 🐾</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ================= VIEW 3: MATCHES & MESSAGES ================= */}
      {activeSubView === 'matches' && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 flex flex-col gap-6">
            
            {/* Horizontal Matches Carousel Strip */}
            <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/40 shadow-xs flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-[22px]">favorite</span>
                  <h3 className="font-headline-sm text-lg font-bold text-[#1c1b1a]">Playdate Matches</h3>
                  {unstartedMatches.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-secondary text-white text-[11px] font-extrabold shadow-2xs">
                      {unstartedMatches.length} New
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold text-outline">
                  {unstartedMatches.length > 0
                    ? `${unstartedMatches.length} Mutual ${unstartedMatches.length === 1 ? 'Match' : 'Matches'}`
                    : (matches.length > 0 ? 'All matches in chats' : 'Swiping to find matches...')}
                </span>
              </div>

              {/* Matches list */}
              {unstartedMatches.length > 0 ? (
                <div className="flex items-center gap-5 overflow-x-auto pb-2 scrollbar-none">
                  {unstartedMatches.map((item, idx) => {
                    const petName = item.matched_pet_name || item.name;
                    const petBreed = item.matched_pet_breed || item.breed;
                    const petImage = item.matched_pet_avatar || item.image;
                    return (
                      <div
                        key={item.match_id || idx}
                        onClick={() => handleOpenChatWithMatch(item)}
                        className="flex flex-col items-center gap-1.5 group cursor-pointer shrink-0"
                        title={`Tap to start conversation with ${petName}`}
                      >
                        <div className="relative p-1 rounded-full bg-gradient-to-tr from-amber-400 via-rose-400 to-primary shadow-xs group-hover:scale-105 transition-all">
                          <img
                            src={petImage}
                            alt={petName}
                            className="w-16 h-16 rounded-full object-cover"
                          />
                          <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-tertiary border-2 border-white shadow-2xs"></span>
                        </div>
                        <span className="text-xs font-bold text-[#1c1b1a] group-hover:text-primary transition-colors max-w-[76px] truncate text-center">
                          {petName}
                        </span>
                        <span className="text-[10px] text-outline -mt-1 max-w-[76px] truncate text-center">
                          {petBreed}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-surface-container-low border border-dashed border-outline-variant/40 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 flex-shrink-0">
                      <span className="material-symbols-outlined text-lg">forum</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#1c1b1a]">
                        {matches.length > 0
                          ? 'All matches have shifted to active conversations!'
                          : 'No mutual matches yet'}
                      </p>
                      <p className="text-[11px] text-on-surface-variant">
                        {matches.length > 0
                          ? 'Tap any active chat below to coordinate playdates, or explore more friends in Discover Deck.'
                          : 'Swipe right on pets in the Discover Deck to get your first mutual match.'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveSubView('discover')}
                    className="px-3.5 py-1.5 rounded-full bg-primary-container hover:bg-primary-fixed-dim text-[#1c1b1a] text-xs font-bold transition-all shadow-2xs cursor-pointer whitespace-nowrap"
                  >
                    Discover Pals 🐾
                  </button>
                </div>
              )}
            </div>

            {/* Active Conversations Feed */}
            <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/40 shadow-xs flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[22px]">chat</span>
                  <h3 className="font-headline-sm text-lg font-bold text-[#1c1b1a]">Active Playdate Conversations</h3>
                  {activeChatMatches.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-primary-container text-[#1c1b1a] text-[11px] font-extrabold shadow-2xs">
                      {activeChatMatches.length}
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold text-outline">
                  {activeChatMatches.length} Active {activeChatMatches.length === 1 ? 'Chat' : 'Chats'}
                </span>
              </div>

              {/* Conversation items */}
              {activeChatMatches.length > 0 ? (
                activeChatMatches.map((conv, cIdx) => (
                  <div
                    key={conv.match_id || cIdx}
                    onClick={() => handleOpenChatWithMatch(conv)}
                    className="flex items-center gap-4 p-3.5 rounded-xl bg-surface-container-low hover:bg-surface-container transition-all cursor-pointer border border-outline-variant/30 hover:border-primary/40 shadow-2xs"
                  >
                    <div className="relative flex-shrink-0">
                      <img
                        src={conv.matched_pet_avatar || DEFAULT_PET_AVATAR}
                        alt={conv.matched_pet_name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-secondary border-2 border-white"></span>
                    </div>
                    <div className="flex-1 flex flex-col min-w-0">
                      <div className="flex justify-between items-center gap-2">
                        <span className="font-bold text-sm text-[#1c1b1a] truncate">
                          {conv.owner_name} ({conv.matched_pet_name})
                        </span>
                        <span className="text-[11px] text-outline font-semibold whitespace-nowrap">Today</span>
                      </div>
                      <p className="text-xs text-on-surface-variant truncate mt-0.5">
                        {conv.latest_message || "Let's coordinate a weekend park stroll!"}
                      </p>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-secondary flex-shrink-0"></span>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center flex flex-col items-center justify-center p-6 rounded-xl bg-surface-container-low border border-dashed border-outline-variant/50">
                  <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mb-2.5">
                    <span className="material-symbols-outlined text-2xl">mark_chat_unread</span>
                  </div>
                  <h4 className="text-sm font-bold text-[#1c1b1a] mb-1">No chats started yet</h4>
                  <p className="text-xs text-on-surface-variant max-w-sm mb-3">
                    {unstartedMatches.length > 0
                      ? 'Tap any pet in Playdate Matches above to start your first message and shift it to chats!'
                      : 'Match with local pets in the Discover Deck to start playdate conversations.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Safety & Meetup Guide Sidebar */}
          <div className="lg:col-span-4 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/40 shadow-xs flex flex-col gap-4">
            <h4 className="font-headline-sm text-base font-bold text-[#1c1b1a]">Playdate Safety Protocol</h4>
            <div className="flex flex-col gap-3 text-xs text-on-surface-variant">
              <div className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-tertiary text-[18px]">verified</span>
                <span>Always meet in a fenced, neutral dog park or busy open trail first.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-tertiary text-[18px]">verified</span>
                <span>Confirm both dogs have verified rabies and core vaccines.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-tertiary text-[18px]">verified</span>
                <span>Keep both dogs on loose leashes during greeting to prevent leash reactivity.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-tertiary text-[18px]">verified</span>
                <span>Bring independent water bottles and avoid competitive toys initially.</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ================= VIEW 4: DIRECT CHAT WITH MATCH ================= */}
      {activeSubView === 'chat' && (
        <section className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 shadow-xs flex flex-col overflow-hidden max-w-3xl mx-auto w-full">
          {/* Chat Header */}
          <div className="p-4 sm:p-5 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container-low">
            <div className="flex items-center gap-3">
              <img
                src={activeMatch?.matched_pet_avatar || DEFAULT_PET_AVATAR}
                alt="Matched Pet"
                className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-xs"
              />
              <div className="flex flex-col">
                <span className="font-bold text-sm text-[#1c1b1a]">
                  {activeMatch?.matched_pet_name || 'Barnaby'} &amp; {activeMatch?.owner_name || 'Priya'}
                </span>
                <span className="text-[11px] text-tertiary font-semibold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
                  Online now • {activeMatch?.owner_neighborhood || 'Model Town'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveSubView('matches')}
                className="px-3.5 py-1.5 rounded-full border border-outline-variant text-xs font-bold text-[#1c1b1a] hover:bg-surface-container transition-colors cursor-pointer"
              >
                Back to Matches
              </button>
            </div>
          </div>

          {/* Messages Stream */}
          <div className="p-4 sm:p-6 flex flex-col gap-4 min-h-[360px] max-h-[480px] overflow-y-auto bg-surface">
            {chatLoading ? (
              <div className="py-12 flex justify-center items-center text-xs text-outline font-semibold">
                Loading messages...
              </div>
            ) : chatMessages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center my-auto">
                <div className="w-14 h-14 rounded-full bg-primary-container flex items-center justify-center text-2xl mb-3 shadow-inner">
                  🐾
                </div>
                <h4 className="font-headline-sm text-base font-bold text-[#1c1b1a] mb-1">
                  You and {activeMatch?.matched_pet_name || 'your playmate'} matched!
                </h4>
                <p className="text-xs text-on-surface-variant max-w-sm mb-4 leading-relaxed">
                  Send a friendly message to {activeMatch?.owner_name || 'pet parent'} below to start coordinating your playdate and shift this match to chats.
                </p>
                <div className="flex flex-wrap gap-2 justify-center max-w-md">
                  {[
                    `Hi! Would love for our pets to meet! 🎾`,
                    `Hi there! When are you free for a park walk? 🐾`,
                    `Hello! ${activeMatch?.matched_pet_name || 'Your pet'} looks so friendly!`
                  ].map((starter, sIdx) => (
                    <button
                      key={sIdx}
                      type="button"
                      onClick={() => setReplyInput(starter)}
                      className="text-xs px-3 py-1.5 rounded-full bg-white border border-outline-variant/60 text-on-surface-variant hover:text-[#1c1b1a] hover:border-[#1c1b1a] transition-all cursor-pointer shadow-2xs"
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              chatMessages.map(msg => {
                const isMe = msg.sender === 'me';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col max-w-[82%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed shadow-xs ${
                      isMe
                        ? 'self-end bg-primary-container text-[#1c1b1a] rounded-br-none'
                        : 'self-start bg-white text-[#1c1b1a] border border-outline-variant/30 rounded-bl-none'
                    }`}
                  >
                    <span className="text-[10px] font-semibold text-outline mb-0.5">{msg.author} • {msg.time}</span>
                    <span className="font-medium">{msg.text}</span>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Suggestion Buttons */}
          <div className="px-4 py-2 bg-surface-container-low flex items-center gap-2 overflow-x-auto border-t border-outline-variant/20 scrollbar-none">
            {["Are you free Sunday morning at Rose Garden? 🐾", "Sounds great! See you at 8:00 AM", "Extra tennis balls packed! 🎾"].map((txt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setReplyInput(txt)}
                className="px-3 py-1 rounded-full bg-white border border-outline-variant/40 text-xs text-on-surface-variant hover:text-[#1c1b1a] whitespace-nowrap cursor-pointer transition-colors"
              >
                {txt}
              </button>
            ))}
          </div>

          {/* Input Form */}
          <form onSubmit={handleSendChat} className="p-3 bg-surface-container-low flex gap-2">
            <input
              type="text"
              value={replyInput}
              onChange={(e) => setReplyInput(e.target.value)}
              placeholder="Send a message to coordinate playdate..."
              className="flex-1 h-11 px-4 rounded-full bg-white border border-outline-variant/40 text-xs sm:text-sm text-[#1c1b1a] focus:outline-none focus:border-[#1c1b1a]"
            />
            <button
              type="submit"
              className="h-11 px-6 rounded-full bg-primary-container text-[#1c1b1a] font-bold text-xs hover:bg-primary-fixed-dim transition-colors cursor-pointer shadow-xs"
            >
              Send
            </button>
          </form>
        </section>
      )}

      {/* ================= VIEW 5: PACK WALKS & COMMUNITY EVENTS ================= */}
      {activeSubView === 'events' && (
        <section className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/40">
            <div>
              <h3 className="font-headline-sm text-xl font-extrabold text-[#1c1b1a]">
                Neighborhood Pack Walks &amp; Meetups
              </h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Join structured, safe socialization walks guided in public parks. Vaccine verification enforced.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {events.length === 0 ? (
              <div className="col-span-full py-12 px-6 rounded-3xl bg-surface-container-low border border-outline-variant/30 text-center flex flex-col items-center justify-center gap-3">
                <span className="material-symbols-outlined text-4xl text-outline">event_busy</span>
                <span className="font-headline-sm text-base font-bold text-on-surface">No Upcoming Pack Walks</span>
                <p className="text-xs text-on-surface-variant max-w-sm">
                  There are no scheduled pack walks or community meetups in your area right now.
                </p>
              </div>
            ) : (
              events.map((ev, eIdx) => (
                <div
                  key={ev.id || eIdx}
                  className="bg-white p-6 rounded-3xl border border-outline-variant/40 shadow-xs flex flex-col justify-between gap-4"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-start gap-2">
                      <span className="px-2.5 py-1 rounded-full bg-tertiary-container text-on-tertiary-container text-[11px] font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">verified</span>
                        <span>Verified Vaccines Only</span>
                      </span>
                      <span className="text-xs font-bold text-outline">
                        {ev.current_rsvps || 0} / {ev.max_attendees || 20} Going
                      </span>
                    </div>

                    <h4 className="font-headline-sm text-lg font-bold text-[#1c1b1a] mt-1">
                      {ev.title}
                    </h4>
                    <p className="text-xs text-[#4f4634] leading-relaxed">
                      {ev.description}
                    </p>

                    <div className="flex flex-col gap-1.5 text-xs text-[#1c1b1a] font-medium mt-2">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[17px] text-primary">schedule</span>
                        <span>{new Date(ev.event_time).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[17px] text-primary">place</span>
                        <span>{ev.location_name}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-outline-variant/30 flex gap-2">
                    <button
                      onClick={() => handleRsvp(ev)}
                      className="flex-1 py-2.5 rounded-full bg-primary-container text-[#1c1b1a] text-xs font-bold hover:bg-primary-fixed-dim transition-colors shadow-xs cursor-pointer"
                    >
                      RSVP with Active Pet
                    </button>
                    <button
                      onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(ev.location_name)}`, '_blank')}
                      className="px-4 py-2.5 rounded-full border border-outline-variant text-[#1c1b1a] text-xs font-semibold hover:bg-surface-container transition-colors cursor-pointer"
                    >
                      View Map
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* ================= MODAL: DETAILED PET PROFILE INSPECTION ================= */}
      {inspectPet && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-7 border border-outline-variant/30 shadow-2xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[24px]">pets</span>
                <h3 className="font-headline-sm text-xl font-bold text-[#1c1b1a]">
                  {inspectPet.name}'s Profile
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectPet(null)}
                className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-outline hover:text-[#1c1b1a] transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Photo */}
            <div className="relative h-[220px] rounded-2xl overflow-hidden bg-surface-variant">
              <img
                src={resolveImageUrl(inspectPet.image)}
                alt={inspectPet.name}
                className="w-full h-full object-cover"
              />
              <span className="absolute bottom-3 left-3 px-3 py-1 rounded-full bg-white/95 text-xs font-bold text-[#1c1b1a] shadow-xs">
                {inspectPet.breed} • {inspectPet.age}
              </span>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              {inspectPet.tags?.map((t, idx) => (
                <span key={idx} className="px-3 py-1 rounded-full bg-surface-container text-xs font-bold text-[#1c1b1a]">
                  {t}
                </span>
              ))}
              <span className="px-3 py-1 rounded-full bg-tertiary-container text-xs font-bold text-on-tertiary-container flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">verified</span>
                Verified Vaccines
              </span>
            </div>

            {/* Dedicated Pet Parent Card in Inspection Modal */}
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/70 flex flex-col gap-2.5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-tr from-amber-200 to-amber-100 border-2 border-white shadow-xs flex items-center justify-center">
                  {inspectPet.owner_avatar ? (
                    <img src={resolveImageUrl(inspectPet.owner_avatar)} alt={inspectPet.parents} className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-extrabold text-sm text-[#775a00]">
                      {inspectPet.owner_initials || (inspectPet.parents ? inspectPet.parents.slice(0, 2).toUpperCase() : 'PP')}
                    </span>
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-extrabold text-base text-[#1c1b1a]">
                      {inspectPet.parents}
                    </span>
                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                      <span className="material-symbols-outlined text-[12px]">verified</span>
                      Verified Pet Parent
                    </span>
                  </div>
                  <span className="text-xs text-[#5c5346] font-medium mt-0.5">
                    {inspectPet.household_mode === 'couple' ? 'Couple Registered' : 'Solo Parent'} • {inspectPet.area_neighborhood || inspectPet.city || 'Model Town'}
                  </span>
                </div>
              </div>

              {inspectPet.lifestyle && (
                <div className="text-xs text-[#4f4634] bg-white p-2.5 rounded-xl border border-amber-100 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-amber-700">routine</span>
                  <span>{inspectPet.lifestyle}</span>
                </div>
              )}
            </div>

            {/* Bio */}
            <div>
              <h4 className="text-xs font-bold text-[#1c1b1a] uppercase tracking-wider mb-1">About &amp; Play Style</h4>
              <p className="text-xs text-[#4f4634] leading-relaxed">
                {inspectPet.bio}
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={async () => {
                  const target = inspectPet;
                  setInspectPet(null);
                  try {
                    const isReciprocal = Boolean(target.has_liked_you);
                    if (target.id && !String(target.id).startsWith('demo-')) {
                      const res = await communityApi.swipePet(target.id, 'like', activePet?.id, isReciprocal);
                      if (res?.is_match || isReciprocal) {
                        const newMatchId = res?.match_id || `match-${target.id}-${Date.now()}`;
                        setMatchedPet(target);
                        setShowMatchModal(true);
                        triggerConfetti();
                        setLikedYouPets(prev => prev.filter(p => p.id !== target.id));
                        setMatches(prev => {
                          if (prev.some(m => m.matched_pet_id === target.id)) return prev;
                          return [{
                            match_id: newMatchId,
                            matched_pet_id: target.id,
                            matched_pet_name: target.name,
                            matched_pet_breed: target.breed,
                            matched_pet_species: target.species,
                            matched_pet_energy: target.energy_level,
                            matched_pet_play_style: target.play_style,
                            matched_pet_avatar: target.image,
                            matched_pet_photos: target.photos || [target.image],
                            owner_id: target.owner_id || target.id,
                            owner_name: target.parents,
                            owner_neighborhood: target.area_neighborhood,
                            matched_at: new Date().toISOString(),
                            latest_message: null,
                            has_conversation: false
                          }, ...prev];
                        });
                        loadMatches();
                        loadLikedYou();
                      } else {
                        showSwipeNotice(`Liked ${target.name}! When they like ${activePet?.name || 'your pet'} back, it's a mutual match! 🐾`, 'like');
                        loadLikedYou();
                      }
                    } else {
                      if (target.has_liked_you) {
                        setMatchedPet(target);
                        setShowMatchModal(true);
                        triggerConfetti();
                        setLikedYouPets(prev => prev.filter(p => p.id !== target.id));
                        setMatches(prev => {
                          if (prev.some(m => m.matched_pet_id === target.id)) return prev;
                          return [{
                            match_id: `demo-match-${target.id}`,
                            matched_pet_id: target.id,
                            matched_pet_name: target.name,
                            matched_pet_breed: target.breed,
                            matched_pet_species: target.species,
                            matched_pet_energy: target.energy_level,
                            matched_pet_play_style: target.play_style,
                            matched_pet_avatar: target.image,
                            matched_pet_photos: target.photos || [target.image],
                            owner_id: target.owner_id || target.id,
                            owner_name: target.parents,
                            owner_neighborhood: target.area_neighborhood,
                            matched_at: new Date().toISOString(),
                            latest_message: null,
                            has_conversation: false
                          }, ...prev];
                        });
                      } else {
                        showSwipeNotice(`Liked ${target.name}! When they like ${activePet?.name || 'your pet'} back, it's a mutual match! 🐾`, 'like');
                      }
                    }
                  } catch (err) {
                    console.warn('Swipe error:', err);
                  }
                }}
                className="flex-1 py-3 rounded-full bg-primary-container text-[#1c1b1a] text-xs font-bold hover:bg-primary-fixed-dim transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">pets</span>
                <span>{inspectPet.has_liked_you ? 'Like Back & Match! 🐾' : 'Like & Send Playdate Invite'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: MUTUAL MATCH CELEBRATION ================= */}
      {showMatchModal && matchedPet && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 border border-outline-variant/40 shadow-2xl flex flex-col items-center text-center gap-5 relative overflow-hidden">
            {/* Ambient celebratory glow */}
            <div className="absolute -top-20 -left-20 w-44 h-44 bg-amber-300/30 rounded-full blur-2xl pointer-events-none"></div>
            <div className="absolute -bottom-20 -right-20 w-44 h-44 bg-rose-300/30 rounded-full blur-2xl pointer-events-none"></div>

            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-300 via-rose-300 to-primary-container flex items-center justify-center text-3xl shadow-md animate-bounce z-10">
              🎉
            </div>

            <div className="z-10">
              <span className="text-xs font-black uppercase tracking-widest text-rose-600 flex items-center justify-center gap-1.5">
                <span className="material-symbols-outlined text-sm">favorite</span>
                It’s a Mutual Match!
                <span className="material-symbols-outlined text-sm">favorite</span>
              </span>
              <h3 className="font-headline-lg text-2xl font-extrabold text-[#1c1b1a] mt-1.5">
                {activePet?.name || 'Your Pet'} &amp; {matchedPet.name} liked each other!
              </h3>
              <p className="text-xs text-[#4f4634] mt-1 leading-relaxed">
                Both pet parents in {matchedPet.area_neighborhood || 'Model Town'} swiped like! You can now start chatting to coordinate safe, fun park strolls.
              </p>
            </div>

            {/* Colliding Pet Avatars with Centered Heart */}
            <div className="relative flex items-center justify-center my-2 z-10">
              <div className="w-20 h-20 rounded-full border-4 border-white shadow-xl overflow-hidden bg-primary-fixed -mr-3 z-10">
                <img
                  src={activePet?.avatar_url || DEFAULT_PET_AVATAR}
                  alt={activePet?.name || 'Your Pet'}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="w-9 h-9 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-lg z-30 -my-2 border-2 border-white animate-pulse">
                <span className="material-symbols-outlined text-base">favorite</span>
              </div>
              <div className="w-20 h-20 rounded-full border-4 border-white shadow-xl overflow-hidden bg-secondary-fixed -ml-3 z-10">
                <img
                  src={matchedPet.image}
                  alt={matchedPet.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2.5 w-full z-10">
              <button
                onClick={() => {
                  setShowMatchModal(false);
                  handleOpenChatWithMatch({
                    owner_id: matchedPet.owner_id,
                    owner_name: matchedPet.parents,
                    matched_pet_name: matchedPet.name,
                    matched_pet_avatar: matchedPet.image
                  });
                }}
                className="w-full h-12 rounded-full bg-primary-container hover:bg-primary-fixed-dim text-[#1c1b1a] font-bold text-sm transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">chat</span>
                <span>Chat with {matchedPet.name}'s Parent</span>
              </button>
              <button
                onClick={() => setShowMatchModal(false)}
                className="w-full h-11 rounded-full border border-outline-variant text-[#1c1b1a] font-semibold text-xs hover:bg-surface-container transition-colors cursor-pointer"
              >
                Keep Exploring Profiles
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: DISTANCE RADIUS FILTER ================= */}
      {showDistanceFilterModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 border border-outline-variant/30 shadow-2xl flex flex-col gap-5">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[24px]">radar</span>
                <h3 className="font-headline-sm text-lg font-bold text-[#1c1b1a]">Discovery Radius</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDistanceFilterModal(false)}
                className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-outline hover:text-[#1c1b1a] transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              Expand your search radius to discover playmates and packs across your whole city or neighborhood.
            </p>

            <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-surface-container-low border border-outline-variant/30">
              <span className="text-xs font-bold text-[#1c1b1a]">Maximum Distance</span>
              <span className="px-3.5 py-1 rounded-full bg-primary-container text-[#1c1b1a] font-mono font-bold text-sm shadow-xs">
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
                      ? 'bg-primary-container text-[#1c1b1a] font-bold shadow-xs scale-105'
                      : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  {dist} km {dist === 5 ? '(Walking)' : dist === 15 ? '(Neighborhood)' : dist === 50 ? '(Max)' : ''}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant/20">
              <button
                type="button"
                onClick={() => setShowDistanceFilterModal(false)}
                className="w-full h-11 rounded-full bg-primary-container text-[#1c1b1a] font-bold text-xs sm:text-sm hover:bg-primary-fixed-dim transition-colors shadow-xs cursor-pointer"
              >
                Apply Radius ({discoveryDistance} km)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Swipe & Match Toast Notice */}
      {swipeNotice && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-[#1c1b1a]/95 text-white shadow-2xl backdrop-blur-md border border-white/10 flex items-center gap-2.5 text-xs sm:text-sm font-semibold animate-fadeIn pointer-events-none">
          <span className="material-symbols-outlined text-[18px] text-amber-400">
            {swipeNotice.type === 'like' ? 'favorite' : swipeNotice.type === 'match' ? 'celebration' : 'info'}
          </span>
          <span>{swipeNotice.message}</span>
        </div>
      )}

    </div>
  );
}
