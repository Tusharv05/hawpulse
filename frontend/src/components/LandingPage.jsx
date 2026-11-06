import React, { useState, useEffect, useRef } from 'react';
import frontendHeroImg from '../assets/frontendhero.jpg';
import pawSectionImg from '../assets/pawsection.png';
import deckBeagleImg from '../assets/deck_beagle.png';
import deckCatImg from '../assets/deck_cat.png';
import deckLabImg from '../assets/deck_lab.png';

export default function LandingPage({ onOpenOnboarding, onOpenAuth, setActiveTab }) {
  // Loader state
  const [loading, setLoading] = useState(() => {
    try {
      return sessionStorage.getItem('pcSeen') !== '1';
    } catch {
      return false;
    }
  });
  const [loadPercent, setLoadPercent] = useState(0);
  const [loaderExiting, setLoaderExiting] = useState(false);

  // Bento Interactive States
  const [calorieCount, setCalorieCount] = useState(0);
  const counterRef = useRef(null);
  const counterStarted = useRef(false);

  const [activeTap, setActiveTap] = useState(null);
  const [tapLogMessage, setTapLogMessage] = useState('');

  const [slipEnglishActive, setSlipEnglishActive] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  // Paw AI Box State
  const [pawAiQuestion, setPawAiQuestion] = useState('');
  const [pawAiAnswer, setPawAiAnswer] = useState(null);
  const [pawAiLoading, setPawAiLoading] = useState(false);

  // Legal Modal (Privacy & Terms)
  const [legalModal, setLegalModal] = useState(null);

  useEffect(() => {
    const handleOpenTerms = () => setLegalModal('terms');
    window.addEventListener('open-terms-modal', handleOpenTerms);
    return () => window.removeEventListener('open-terms-modal', handleOpenTerms);
  }, []);

  // Section 3 (#what) Looping Background Video State & Refs
  const whatSectionRef = useRef(null);
  const bgRunVideoRef = useRef(null);
  const whatInViewRef = useRef(false);
  const [bgRunSourcesLoaded, setBgRunSourcesLoaded] = useState(false);
  const [bgRunPosterOnly, setBgRunPosterOnly] = useState(() => {
    if (typeof window === 'undefined') return false;
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const saveData = conn?.saveData === true || conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g';
    return Boolean(saveData);
  });

  // Section 5 (#community) & Section 7 (.band) Looping Background Video State & Refs
  const communitySectionRef = useRef(null);
  const communityVideoRef = useRef(null);
  const communityInViewRef = useRef(true);
  const [communitySourcesLoaded, setCommunitySourcesLoaded] = useState(true);
  const [communityPosterOnly, setCommunityPosterOnly] = useState(() => {
    if (typeof window === 'undefined') return false;
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const saveData = conn?.saveData === true || conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g';
    return Boolean(saveData);
  });

  const vetBandRef = useRef(null);
  const vetVideoRef = useRef(null);
  const vetInViewRef = useRef(true);
  const [vetSourcesLoaded, setVetSourcesLoaded] = useState(true);
  const [vetPosterOnly, setVetPosterOnly] = useState(() => {
    if (typeof window === 'undefined') return false;
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const saveData = conn?.saveData === true || conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g';
    return Boolean(saveData);
  });

  const finSectionRef = useRef(null);
  const boxpetVideoRef = useRef(null);
  const boxpetInViewRef = useRef(true);
  const [boxpetSourcesLoaded, setBoxpetSourcesLoaded] = useState(true);
  const [boxpetPosterOnly, setBoxpetPosterOnly] = useState(() => {
    if (typeof window === 'undefined') return false;
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const saveData = conn?.saveData === true || conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g';
    return Boolean(saveData);
  });

  // Vaccine Band Progress State
  const [safeWalkWidth, setSafeWalkWidth] = useState(0);
  const safeWalkRef = useRef(null);
  const safeWalkStarted = useRef(false);

  // Living Illustration Video Hero State
  const videoARef = useRef(null);
  const heroCanvasRef = useRef(null);
  const heroFrameRef = useRef(null);
  const [heroHearts, setHeroHearts] = useState([]);

  // Step 1: Animated OTP
  const [otpIndex, setOtpIndex] = useState(3);
  const otpDigits = ['8', '4', '2', '9', '1', '7'];

  // Step 2: Personality Chips
  const [selectedChips, setSelectedChips] = useState({ 0: true, 1: true });

  // Step 3: Nudge Card
  const [nudgeMessage, setNudgeMessage] = useState('Serve 450g grain-free salmon kibble + pumpkin topper.');
  const [isFed, setIsFed] = useState(false);

  // Section 4 (#how) Zig-Zag Storytelling & Scroll-Drawn Coral Line Refs
  const howSectionRef = useRef(null);
  const howSurfaceRef = useRef(null);
  const howHeadingRef = useRef(null);
  const howPetsRef = useRef(null);
  const howEyeBallRefs = useRef([]);
  const howEyePupilRefs = useRef([]);
  const howSvgRef = useRef(null);
  const howPathRef = useRef(null);
  const howHeadRef = useRef(null);
  const howWatermarkRef = useRef(null);
  const howStepRefs = useRef([]);
  const howStepIconRefs = useRef([]);
  const howStepTextRefs = useRef([]);

  // Community Deck (Swiper)
  const deckPets = [
    {
      img: deckBeagleImg,
      name: 'Barnaby, 2 yrs',
      breed: 'Labrador',
      reg: 'Couple Registered · Priya & Amit',
      loc: 'Model Town · 1.8 km away',
      tag: 'High Energy'
    },
    {
      img: deckCatImg,
      name: 'Miso, 3 yrs',
      breed: 'British Shorthair',
      reg: 'Solo parent · Riya',
      loc: 'Green Park · 2.4 km away',
      tag: 'Calm'
    },
    {
      img: deckLabImg,
      name: 'Juno, 1 yr',
      breed: 'Beagle',
      reg: 'Family Registered · The Sethis',
      loc: 'Dog Run East · 0.9 km away',
      tag: 'Ball Chaser'
    }
  ];
  const [deckIndex, setDeckIndex] = useState(0);
  const [swipeOffset, setSwipeOffset] = useState(null); // { dir: 1 | -1 }

  // Community Masonry Cards
  const masonryCards = [
    { emoji: '🐶', name: 'Biscuit', desc: 'Corgi · 0.6 km', bg: '#FFC83D', height: 260 },
    { emoji: '🐱', name: 'Luna', desc: 'Persian · 1.2 km', bg: '#FFDDD6', height: 200 },
    { emoji: '🐕‍🦺', name: 'Rex', desc: 'Shepherd · 2 km', bg: '#DCE8FA', height: 300 },
    { emoji: '🐈', name: 'Mochi', desc: 'Tabby · 0.8 km', bg: '#D8F2E4', height: 220 },
    { emoji: '🐩', name: 'Pepper', desc: 'Poodle · 1.5 km', bg: '#FFDDD6', height: 320 },
    { emoji: '🐾', name: 'Pack walk', desc: 'Sat 7 am · Lodhi Park', bg: '#FFC83D', height: 200 },
    { emoji: '🐕', name: 'Bruno', desc: 'Pug · 3 km', bg: '#D8F2E4', height: 250 },
    { emoji: '🐱', name: 'Simba', desc: 'Ginger · 1 km', bg: '#DCE8FA', height: 280 }
  ];

  // Testimonials
  const testimonials = [
    { user: 'JaneDoe', text: 'Cooper’s diary fills itself in. I haven’t missed a dose since.' },
    { user: 'HappyPF', text: 'The vet-paper decoder explained my pup’s prescription in seconds.' },
    { user: 'Mike', text: 'Our sitter loved the link. No sign-up, no fuss.' },
    { user: 'Clara', text: 'Found a pack-walk crew two streets away. Feels safe and friendly.' },
    { user: 'Torry', text: 'Meal plan portions finally made sense for our senior cat.' },
    { user: 'Flo', text: 'Double opt-in means zero awkward messages. Love it.' }
  ];

  // FAQs
  const [openFaqs, setOpenFaqs] = useState({ 0: false, 1: false, 2: false, 3: false });

  // Floating Butterfly Follower
  const butterflyRef = useRef(null);
  const butterflyCoords = useRef({ bx: -80, by: -80, tx: -80, ty: -80, ang: 0 });

  // Loader sequence
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadPercent(prev => {
        const next = Math.min(100, prev + Math.ceil(Math.random() * 14));
        if (next >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setLoaderExiting(true);
            setTimeout(() => {
              setLoading(false);
              try { sessionStorage.setItem('pcSeen', '1'); } catch { }
            }, 750);
          }, 250);
        }
        return next;
      });
    }, 80);
    return () => clearInterval(interval);
  }, [loading]);

  // Intersection Observers for 820 kcal counter & 75% progress
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          if (entry.target === counterRef.current && !counterStarted.current) {
            counterStarted.current = true;
            let current = 0;
            const timer = setInterval(() => {
              current += 20;
              setCalorieCount(Math.min(current, 820));
              if (current >= 820) clearInterval(timer);
            }, 18);
          }
          if (entry.target === safeWalkRef.current && !safeWalkStarted.current) {
            safeWalkStarted.current = true;
            setTimeout(() => setSafeWalkWidth(75), 150);
          }
        }
      });
    }, { threshold: 0.25 });

    if (counterRef.current) observer.observe(counterRef.current);
    if (safeWalkRef.current) observer.observe(safeWalkRef.current);

    return () => observer.disconnect();
  }, []);

  // Global Scroll-Triggered Once-Only Reveal Observer
  useEffect(() => {
    const targets = document.querySelectorAll('.scroll-reveal, .scroll-reveal-stagger, .scroll-reveal-scale');
    if (!targets.length) return;

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            obs.unobserve(entry.target); // Triggers once and stays revealed permanently
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -30px 0px',
      }
    );

    targets.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  // Vet slip opacity toggle loop
  useEffect(() => {
    const interval = setInterval(() => {
      setSlipEnglishActive(prev => !prev);
    }, 2400);
    return () => clearInterval(interval);
  }, []);

  // OTP automatic cycling
  useEffect(() => {
    const interval = setInterval(() => {
      setOtpIndex(prev => (prev + 1) % 7);
    }, 900);
    return () => clearInterval(interval);
  }, []);

  // Background Videos (#what, #community, .band): Save-Data / slow connection detection
  useEffect(() => {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    const evaluatePosterOnly = () => {
      const saveData =
        conn?.saveData === true ||
        conn?.effectiveType === '2g' ||
        conn?.effectiveType === 'slow-2g';
      const isPosterOnly = Boolean(saveData);
      setBgRunPosterOnly(isPosterOnly);
      setCommunityPosterOnly(isPosterOnly);
      setVetPosterOnly(isPosterOnly);
      setBoxpetPosterOnly(isPosterOnly);
    };

    evaluatePosterOnly();
    conn?.addEventListener?.('change', evaluatePosterOnly);

    return () => {
      conn?.removeEventListener?.('change', evaluatePosterOnly);
    };
  }, []);

  // Section 3 (#what) Background Video: Lazy-load within 600px, play on scroll once to completion without mid-play stops
  useEffect(() => {
    const sectionEl = whatSectionRef.current;
    if (!sectionEl || bgRunPosterOnly) return;

    let hasCompletedBgRun = false;

    const pauseVideo = () => {
      const v = bgRunVideoRef.current;
      if (v && !v.paused) {
        v.pause();
      }
    };

    const playVideo = () => {
      const v = bgRunVideoRef.current;
      if (!v) return;
      if (hasCompletedBgRun || !bgRunSourcesLoaded || !whatInViewRef.current || document.hidden || bgRunPosterOnly) {
        return;
      }
      if (v.paused && !v.ended) {
        try {
          v.muted = true;
          v.defaultMuted = true;
          const p = v.play();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } catch {
          // Ignore autoplay rejection
        }
      }
    };

    // 1. Lazy-load observer: attach <source> tags when section is within ~600px of viewport
    let lazyObserver = null;
    if (!bgRunSourcesLoaded) {
      lazyObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setBgRunSourcesLoaded(true);
              lazyObserver?.disconnect();
            }
          });
        },
        { rootMargin: '600px 0px' }
      );
      lazyObserver.observe(sectionEl);
    }

    // 2. Visibility observer: track whether section is onscreen (threshold 0.05) and play/pause accordingly
    const viewObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          whatInViewRef.current = entry.isIntersecting;
          if (entry.isIntersecting) {
            playVideo();
          } else {
            pauseVideo();
          }
        });
      },
      { threshold: 0.05 }
    );
    viewObserver.observe(sectionEl);

    // 3. Play when user scrolls and section is in view (plays smoothly to completion)
    const handleScroll = () => {
      if (whatInViewRef.current && !document.hidden && !hasCompletedBgRun) {
        playVideo();
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    // 4. Pause when browser tab is hidden
    const handleVisibilityChange = () => {
      if (document.hidden) {
        pauseVideo();
      } else if (whatInViewRef.current && !hasCompletedBgRun) {
        playVideo();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 5. Load video metadata when lazy sources mount, stop on completion and hold final frame (play once)
    const v = bgRunVideoRef.current;
    const handleTimeUpdate = () => {
      if (!v || !v.duration || !Number.isFinite(v.duration)) return;
      const remaining = v.duration - v.currentTime;
      if (remaining <= 0.08 || v.ended) {
        hasCompletedBgRun = true;
        pauseVideo();
      }
    };

    const handleEnded = () => {
      hasCompletedBgRun = true;
      pauseVideo();
    };

    if (v && bgRunSourcesLoaded) {
      v.addEventListener('timeupdate', handleTimeUpdate);
      v.addEventListener('ended', handleEnded);
      if (v.readyState === 0) {
        try {
          v.load();
        } catch {}
      }
      if (whatInViewRef.current && !hasCompletedBgRun) {
        playVideo();
      }
    }

    return () => {
      lazyObserver?.disconnect();
      viewObserver.disconnect();
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (v) {
        v.removeEventListener('timeupdate', handleTimeUpdate);
        v.removeEventListener('ended', handleEnded);
      }
    };
  }, [bgRunSourcesLoaded, bgRunPosterOnly]);

  // =========================================================
  // Section 4 (#how) Zig-Zag Scroll-Drawn Coral Line, Step Reveal & Watermark Parallax
  // Tunable constants:
  //   HOW_LERP_FACTOR:       0.12  (smoothing factor for scroll-drawn line & parallax)
  //   HOW_PARALLAX_RATIO:    0.13  (13% horizontal parallax travel for "TAP ONCE A DAY.")
  //   HOW_REVEAL_THRESHOLD:  0.30  (IntersectionObserver threshold for step reveal)
  //   HOW_LOOP_PAD_X:        44    (px horizontal padding for the loop around Step 2)
  //   HOW_LOOP_PAD_Y:        34    (px vertical padding for the loop around Step 2)
  //   HOW_RESPECT_OS_RM:     false (set true to force static line when OS reduced-motion is on)
  // =========================================================
  useEffect(() => {
    const surfaceEl = howSurfaceRef.current;
    const svgEl = howSvgRef.current;
    const pathEl = howPathRef.current;
    const headEl = howHeadRef.current;
    const watermarkEl = howWatermarkRef.current;
    if (!surfaceEl || !svgEl || !pathEl) return;

    const HOW_LERP_FACTOR = 0.12;
    const HOW_PARALLAX_RATIO = 0.13;
    const HOW_REVEAL_THRESHOLD = 0.3;
    const HOW_LOOP_PAD_X = 44;
    const HOW_LOOP_PAD_Y = 34;
    const HOW_RESPECT_OS_RM = false;

    const isReducedMotion =
      HOW_RESPECT_OS_RM &&
      Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);

    if (isReducedMotion) {
      surfaceEl.setAttribute('data-reduced-motion', 'true');
    } else {
      surfaceEl.removeAttribute('data-reduced-motion');
    }

    let totalLen = 0;
    let stepCenters = [];
    let pathStartY = 200;
    let pathEndY = 1200;
    let targetProgress = 0;
    let currentProgress = 0;
    let rafId = null;
    let isSectionNearViewport = true;
    let activeStepIdx = -1;

    // Convert Catmull-Rom control points to a smooth SVG cubic Bezier path string
    const buildCatmullRomPath = (pts, tension = 0.5) => {
      if (!pts || pts.length < 2) return '';
      let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(pts.length - 1, i + 2)];

        const cp1x = p1.x + ((p2.x - p0.x) * tension) / 3;
        const cp1y = p1.y + ((p2.y - p0.y) * tension) / 3;
        const cp2x = p2.x - ((p3.x - p1.x) * tension) / 3;
        const cp2y = p2.y - ((p3.y - p1.y) * tension) / 3;

        d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
      }
      return d;
    };

    // Measure live DOM positions relative to .how-surface and build the swooping coral SVG path
    const computePathFromDOM = () => {
      const sRect = surfaceEl.getBoundingClientRect();
      const W = sRect.width;
      const H = sRect.height;
      if (W <= 0 || H <= 0) return;

      svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);

      const relBox = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          left: r.left - sRect.left,
          right: r.right - sRect.left,
          top: r.top - sRect.top,
          bottom: r.bottom - sRect.top,
          width: r.width,
          height: r.height,
          cx: r.left - sRect.left + r.width * 0.5,
          cy: r.top - sRect.top + r.height * 0.5
        };
      };

      const hBox = relBox(howHeadingRef.current);
      const pBox = relBox(howPetsRef.current);
      const iBoxes = [0, 1, 2, 3].map((i) => relBox(howStepIconRefs.current[i]));
      const tBoxes = [0, 1, 2, 3].map((i) => relBox(howStepTextRefs.current[i]));
      const stepBoxes = [0, 1, 2, 3].map((i) => relBox(howStepRefs.current[i]));

      stepCenters = stepBoxes.map((b) => (b ? { x: b.cx, y: b.cy } : { x: 0, y: 0 }));

      const isMobile = window.innerWidth < 768;
      let d = '';

      if (isMobile) {
        // Gentle wiggly vertical line near the left edge on mobile
        let pts = [];
        const baseX = iBoxes[0] ? Math.max(24, Math.min(48, iBoxes[0].cx)) : 34;
        const startY = hBox ? hBox.bottom + 24 : 180;
        pathStartY = startY;
        pts.push({ x: baseX + 8, y: startY });

        [0, 1, 2, 3].forEach((idx) => {
          const ib = iBoxes[idx];
          const tb = tBoxes[idx];
          if (ib && tb) {
            const dir = idx % 2 === 0 ? -12 : 14;
            pts.push({ x: baseX + dir, y: ib.cy });
            pts.push({ x: baseX - dir * 0.75, y: tb.cy });
          }
        });

        if (iBoxes[3]) {
          pathEndY = iBoxes[3].bottom + 12;
          pts.push({ x: iBoxes[3].cx, y: pathEndY });
        }
        d = buildCatmullRomPath(pts, 0.5);
      } else if (
        hBox &&
        iBoxes[0] &&
        iBoxes[1] &&
        iBoxes[2] &&
        iBoxes[3] &&
        tBoxes[0] &&
        tBoxes[1] &&
        tBoxes[2] &&
        tBoxes[3]
      ) {
        // Desktop swooping S-curve built from 7 Quarter-Ellipse Cubic Bézier quadrants:
        // P0 (pets' feet) -> P1 (right of Step 01) -> M12 (Corridor 1->2 center)
        // -> P2 (left of Step 02) -> M23 (Corridor 2->3 center) -> P3 (right of Step 03)
        // -> M34 (Corridor 3->4 center) -> P4 (Step 04's icon).
        // Using 1 Cubic Bézier per 90° quadrant (with elliptical kappa ratios kX = 0.54, kY = 0.62)
        // makes every turn a true, wide elliptical arc with zero sharp corners or pinched noses.
        const startX = pBox ? pBox.cx + 28 : W * 0.72;
        const startY = pBox ? pBox.top + pBox.height * 0.9 : hBox.bottom;
        pathStartY = startY;

        // Open horizontal corridors between consecutive steps
        const s1Bottom = Math.max(tBoxes[0].bottom, iBoxes[0].bottom);
        const s2Top = Math.min(tBoxes[1].top, iBoxes[1].top);
        const corridor12Y = (s1Bottom + s2Top) * 0.5;

        const s2Bottom = Math.max(tBoxes[1].bottom, iBoxes[1].bottom);
        const s3Top = Math.min(tBoxes[2].top, iBoxes[2].top);
        const corridor23Y = (s2Bottom + s3Top) * 0.5;

        const s3Bottom = Math.max(tBoxes[2].bottom, iBoxes[2].bottom);
        const s4Top = Math.min(tBoxes[3].top, iBoxes[3].top);
        const corridor34Y = (s3Bottom + s4Top) * 0.5;

        // Outer apex positions (P1 right of Step 01, P2 left of Step 02, P3 right of Step 03)
        const x1 = Math.min(W - 20, iBoxes[0].right + 30);
        const y1 = startY + (corridor12Y - startY) * 0.52;

        const x2 = Math.max(20, iBoxes[1].left - 30);
        const y2 = (corridor12Y + corridor23Y) * 0.5;

        const x3 = Math.min(W - 20, iBoxes[2].right + 30);
        const y3 = (corridor23Y + corridor34Y) * 0.5;

        // Corridor center X and semi-axes
        const midX = (x2 + x3) * 0.5;
        const aRight1 = Math.max(120, x1 - midX);
        const aLeft2 = Math.max(120, midX - x2);
        const aRight3 = Math.max(120, x3 - midX);

        // Elliptical Bézier quadrant handle ratios + gentle corridor slope
        const kX = 0.54;
        const kY = 0.62;
        const tiltY = 18;

        // End at Step 04's Overlapping Hearts Icon on the left
        const endX = iBoxes[3].cx;
        const endY = iBoxes[3].top - 6;
        pathEndY = endY;

        const span4X = Math.max(80, midX - endX);
        const c7aDX = span4X * 0.55;
        const c7aDY = tiltY * (c7aDX / (aRight3 * kX));

        d = [
          `M ${startX.toFixed(1)} ${startY.toFixed(1)}`,
          // Q1: P0 (pets' feet) -> P1 (outer-right apex of Step 01)
          `C ${(startX + (x1 - startX) * 0.62).toFixed(1)} ${(startY + (y1 - startY) * 0.08).toFixed(1)}, ${x1.toFixed(1)} ${(y1 - (y1 - startY) * kY).toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)}`,
          // Q2: P1 -> M12 (bottom-right curve of Step 01 into Corridor 1->2 center)
          `C ${x1.toFixed(1)} ${(y1 + (corridor12Y - y1) * kY).toFixed(1)}, ${(midX + aRight1 * kX).toFixed(1)} ${(corridor12Y - tiltY).toFixed(1)}, ${midX.toFixed(1)} ${corridor12Y.toFixed(1)}`,
          // Q3: M12 -> P2 (Corridor 1->2 center into top-left curve of Step 02)
          `C ${(midX - aLeft2 * kX).toFixed(1)} ${(corridor12Y + tiltY).toFixed(1)}, ${x2.toFixed(1)} ${(y2 - (y2 - corridor12Y) * kY).toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`,
          // Q4: P2 -> M23 (bottom-left curve of Step 02 into Corridor 2->3 center)
          `C ${x2.toFixed(1)} ${(y2 + (corridor23Y - y2) * kY).toFixed(1)}, ${(midX - aLeft2 * kX).toFixed(1)} ${(corridor23Y - tiltY).toFixed(1)}, ${midX.toFixed(1)} ${corridor23Y.toFixed(1)}`,
          // Q5: M23 -> P3 (Corridor 2->3 center into top-right curve of Step 03)
          `C ${(midX + aRight3 * kX).toFixed(1)} ${(corridor23Y + tiltY).toFixed(1)}, ${x3.toFixed(1)} ${(y3 - (y3 - corridor23Y) * kY).toFixed(1)}, ${x3.toFixed(1)} ${y3.toFixed(1)}`,
          // Q6: P3 -> M34 (bottom-right curve of Step 03 into Corridor 3->4 center)
          `C ${x3.toFixed(1)} ${(y3 + (corridor34Y - y3) * kY).toFixed(1)}, ${(midX + aRight3 * kX).toFixed(1)} ${(corridor34Y - tiltY).toFixed(1)}, ${midX.toFixed(1)} ${corridor34Y.toFixed(1)}`,
          // Q7: M34 -> P4 (Corridor 3->4 center into Step 04's icon)
          `C ${(midX - c7aDX).toFixed(1)} ${(corridor34Y + c7aDY).toFixed(1)}, ${endX.toFixed(1)} ${(endY - Math.max(28, (endY - corridor34Y) * kY)).toFixed(1)}, ${endX.toFixed(1)} ${endY.toFixed(1)}`
        ].join(' ');
      }

      if (!d) return;

      pathEl.setAttribute('d', d);
      try {
        totalLen = pathEl.getTotalLength();
      } catch {
        totalLen = 0;
      }

      if (totalLen > 0) {
        pathEl.style.strokeDasharray = `${totalLen}`;
        if (isReducedMotion) {
          pathEl.style.strokeDashoffset = '0';
        } else {
          updateScrollTarget();
          applyVisuals(currentProgress);
        }
      }
    };

    const applyVisuals = (prog) => {
      if (totalLen <= 0) return;
      const clamped = Math.max(0, Math.min(1, prog));
      const drawnLen = totalLen * clamped;
      pathEl.style.strokeDashoffset = `${(totalLen - drawnLen).toFixed(1)}`;

      // Highlight the step nearest the line's leading tip
      try {
        const pt = pathEl.getPointAtLength(drawnLen);
        let nearestIdx = -1;
        let minDist = 280;
        for (let i = 0; i < stepCenters.length; i++) {
          const dist = Math.hypot(pt.x - stepCenters[i].x, pt.y - stepCenters[i].y);
          if (dist < minDist) {
            minDist = dist;
            nearestIdx = i;
          }
        }
        if (clamped < 0.03) nearestIdx = -1;
        if (nearestIdx !== activeStepIdx) {
          activeStepIdx = nearestIdx;
          howStepRefs.current.forEach((li, idx) => {
            if (!li) return;
            if (idx === activeStepIdx) li.classList.add('is-active');
            else li.classList.remove('is-active');
          });
        }
      } catch {}

      // Horizontal parallax on giant "TAP ONCE A DAY." watermark
      if (watermarkEl && !isReducedMotion) {
        const shiftPx = (0.5 - clamped) * window.innerWidth * HOW_PARALLAX_RATIO;
        watermarkEl.style.transform = `translate3d(${shiftPx.toFixed(1)}px, -50%, 0)`;
      }
    };

    // Progress: 0 when the line's start (pets' feet) enters at 85% viewport height;
    // 1 when the line's end (Step 04's icon) reaches 74% viewport height so the line finishes at Step 04 while in view
    const updateScrollTarget = () => {
      const rect = surfaceEl.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const startTrigger = vh * 0.85;
      const endTrigger = vh * 0.74;
      const scrolled = startTrigger - (rect.top + pathStartY);
      const totalSpan = Math.max(1, (pathEndY - pathStartY) + (startTrigger - endTrigger));
      const raw = scrolled / totalSpan;
      targetProgress = Math.max(0, Math.min(1, raw));
    };

    const tick = () => {
      const diff = targetProgress - currentProgress;
      if (Math.abs(diff) > 0.0005) {
        currentProgress += diff * HOW_LERP_FACTOR;
        applyVisuals(currentProgress);
        rafId = requestAnimationFrame(tick);
      } else {
        currentProgress = targetProgress;
        applyVisuals(currentProgress);
        rafId = null;
      }
    };

    const handleScroll = () => {
      if (!isSectionNearViewport || isReducedMotion) return;
      updateScrollTarget();
      if (!rafId) {
        rafId = requestAnimationFrame(tick);
      }
    };

    // Debounced resize handler to recompute path from real layout
    let resizeTimer = null;
    const handleResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        computePathFromDOM();
      }, 120);
    };

    // Enable/disable scroll loop when #how is near/off viewport
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isSectionNearViewport = entry.isIntersecting;
          if (entry.isIntersecting && !isReducedMotion) {
            updateScrollTarget();
            if (!rafId) rafId = requestAnimationFrame(tick);
          } else if (!entry.isIntersecting && rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
        });
      },
      { rootMargin: '200px 0px' }
    );
    sectionObserver.observe(surfaceEl);

    // One-shot step & pet-character reveal observer (threshold 0.3)
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: HOW_REVEAL_THRESHOLD }
    );

    if (howPetsRef.current) {
      if (isReducedMotion) howPetsRef.current.classList.add('is-revealed');
      else revealObserver.observe(howPetsRef.current);
    }

    howStepRefs.current.forEach((li) => {
      if (!li) return;
      if (isReducedMotion) li.classList.add('is-revealed');
      else revealObserver.observe(li);
    });

    // Initial path calculation + recompute once web fonts finish loading
    updateScrollTarget();
    currentProgress = targetProgress;
    computePathFromDOM();
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        computePathFromDOM();
      });
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    // Pointer-tracking eyes for the Cat & Dog in .how-pets-stage (337x282 viewBox coordinates)
    const eyeCoords = [
      { cx: 84.5, cy: 159.5 },
      { cx: 138.5, cy: 148.5 },
      { cx: 197.5, cy: 132.5 },
      { cx: 261.0, cy: 143.0 }
    ];
    const eyeCurrent = eyeCoords.map(() => ({ x: 0, y: 0 }));
    const eyeTarget = eyeCoords.map((_, idx) =>
      idx < 2 ? { x: -1.4, y: -1.6 } : { x: 2.0, y: -1.6 }
    );
    let eyeRafId = null;

    const tickEyes = () => {
      let moving = false;
      for (let i = 0; i < eyeCoords.length; i++) {
        const cur = eyeCurrent[i];
        const tgt = eyeTarget[i];
        const dx = tgt.x - cur.x;
        const dy = tgt.y - cur.y;
        if (Math.abs(dx) > 0.02 || Math.abs(dy) > 0.02) {
          cur.x += dx * 0.22;
          cur.y += dy * 0.22;
          moving = true;
        } else {
          cur.x = tgt.x;
          cur.y = tgt.y;
        }
        const pupilEl = howEyePupilRefs.current[i];
        const ballEl = howEyeBallRefs.current[i];
        if (pupilEl) {
          pupilEl.setAttribute('transform', `translate(${cur.x.toFixed(2)}, ${cur.y.toFixed(2)})`);
        }
        if (ballEl) {
          ballEl.setAttribute(
            'transform',
            `translate(${(cur.x * 0.38).toFixed(2)}, ${(cur.y * 0.38).toFixed(2)})`
          );
        }
      }
      if (moving) {
        eyeRafId = requestAnimationFrame(tickEyes);
      } else {
        eyeRafId = null;
      }
    };

    const handlePointerMove = (e) => {
      const stageEl = howPetsRef.current;
      if (!stageEl) return;
      const rect = stageEl.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const maxPupilOffset = 4.7;
      for (let i = 0; i < eyeCoords.length; i++) {
        const ec = eyeCoords[i];
        const screenX = rect.left + (ec.cx / 337) * rect.width;
        const screenY = rect.top + (ec.cy / 282) * rect.height;
        const vx = e.clientX - screenX;
        const vy = e.clientY - screenY;
        const dist = Math.hypot(vx, vy);
        const factor = Math.min(1, dist / 140);
        const angle = Math.atan2(vy, vx);
        eyeTarget[i].x = Math.cos(angle) * maxPupilOffset * factor;
        eyeTarget[i].y = Math.sin(angle) * maxPupilOffset * factor;
      }
      if (!eyeRafId) {
        eyeRafId = requestAnimationFrame(tickEyes);
      }
    };

    eyeRafId = requestAnimationFrame(tickEyes);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (eyeRafId) cancelAnimationFrame(eyeRafId);
      if (resizeTimer) clearTimeout(resizeTimer);
      sectionObserver.disconnect();
      revealObserver.disconnect();
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointermove', handlePointerMove);
    };
  }, [9]);

  // =========================================================
  // Shared Lazy-Loaded Background Video Hook:
  // Reused by Section 5 (#community), Section 7 (.band), and Section 8 (Boxpet)
  // Plays once when scrolled into view, smoothly without mid-way freeze, holding final frame on completion
  // =========================================================
  useEffect(() => {
    const targets = [
      {
        containerEl: communitySectionRef.current,
        videoRef: communityVideoRef,
        inViewRef: communityInViewRef,
        setSourcesLoaded: setCommunitySourcesLoaded,
        posterOnly: communityPosterOnly,
        loopCutTime: 7.0,
        hasCompleted: false,
      },
      {
        containerEl: vetBandRef.current,
        videoRef: vetVideoRef,
        inViewRef: vetInViewRef,
        setSourcesLoaded: setVetSourcesLoaded,
        posterOnly: vetPosterOnly,
        loopCutTime: 9.95,
        hasCompleted: false,
      },
      {
        containerEl: finSectionRef.current,
        videoRef: boxpetVideoRef,
        inViewRef: boxpetInViewRef,
        setSourcesLoaded: setBoxpetSourcesLoaded,
        posterOnly: boxpetPosterOnly,
        loopCutTime: 19.95,
        hasCompleted: false,
      },
    ].filter((t) => t.containerEl && !t.posterOnly);

    if (targets.length === 0) return;

    const pauseTarget = (t) => {
      const v = t.videoRef.current;
      if (v && !v.paused) {
        v.pause();
      }
    };

    const playTarget = (t) => {
      const v = t.videoRef.current;
      if (!v) return;
      if (t.hasCompleted || !t.inViewRef.current || document.hidden || t.posterOnly) {
        return;
      }
      if (v.paused && !v.ended) {
        try {
          v.muted = true;
          v.defaultMuted = true;
          const p = v.play();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } catch {
          // Ignore autoplay rejection
        }
      }
    };

    // 1. Lazy-load video sources when within 400px of viewport (keeps LCP/Lighthouse fast)
    const loadObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const match = targets.find((t) => t.containerEl === entry.target);
            if (match) {
              match.setSourcesLoaded(true);
              loadObserver.unobserve(entry.target);
            }
          }
        });
      },
      { rootMargin: '400px 0px' }
    );

    // 2. Track whether each section/card is onscreen (threshold 0.05) and play/pause accordingly
    const viewObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const match = targets.find((t) => t.containerEl === entry.target);
          if (!match) return;
          match.inViewRef.current = entry.isIntersecting;
          if (entry.isIntersecting) {
            match.setSourcesLoaded(true);
            playTarget(match);
          } else {
            pauseTarget(match);
          }
        });
      },
      { threshold: 0.05 }
    );

    const cleanups = [];

    targets.forEach((t) => {
      loadObserver.observe(t.containerEl);
      viewObserver.observe(t.containerEl);

      const v = t.videoRef.current;
      if (v) {
        const handleTimeUpdate = () => {
          const loopEnd =
            v.duration && Number.isFinite(v.duration)
              ? Math.min(t.loopCutTime, v.duration)
              : t.loopCutTime;
          const remaining = loopEnd - v.currentTime;
          if (remaining <= 0.08 || v.ended) {
            t.hasCompleted = true;
            pauseTarget(t);
          }
        };

        const handleEnded = () => {
          t.hasCompleted = true;
          pauseTarget(t);
        };

        v.addEventListener('timeupdate', handleTimeUpdate);
        v.addEventListener('ended', handleEnded);

        if (t.inViewRef.current && !t.hasCompleted) {
          playTarget(t);
        }

        cleanups.push(() => {
          v.removeEventListener('timeupdate', handleTimeUpdate);
          v.removeEventListener('ended', handleEnded);
        });
      }
    });

    // 3. Play when user scrolls with target in view (smooth playback to completion)
    const handleScroll = () => {
      if (document.hidden) return;
      targets.forEach((t) => {
        if (t.inViewRef.current && !t.hasCompleted) {
          playTarget(t);
        }
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    // 4. Pause when browser tab is hidden, resume when tab is active
    const handleVisibilityChange = () => {
      if (document.hidden) {
        targets.forEach((t) => pauseTarget(t));
      } else {
        targets.forEach((t) => {
          if (t.inViewRef.current && !t.hasCompleted) {
            playTarget(t);
          }
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      loadObserver.disconnect();
      viewObserver.disconnect();
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cleanups.forEach((fn) => fn());
    };
  }, [communityPosterOnly, vetPosterOnly, boxpetPosterOnly]);

  // Living Hero Video Canvas: Plays ONCE on refresh & ONCE on scroll only, with feathered edges
  useEffect(() => {
    const canvas = heroCanvasRef.current;
    const vA = videoARef.current;
    const frame = heroFrameRef.current;
    if (!canvas || !vA) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Load poster image (already pre-feathered with #FFF8E7)
    const poster = new Image();
    poster.src = '/poster.jpg';
    let posterLoaded = false;
    poster.onload = () => {
      posterLoaded = true;
      ctx.drawImage(poster, 0, 0, canvas.width, canvas.height);
    };

    // Video must play ONCE only (no loop)
    vA.loop = false;
    vA.muted = true;
    vA.defaultMuted = true;
    vA.playsInline = true;

    // Play once helper
    const playOnce = () => {
      if (vA.ended) {
        vA.currentTime = 0;
      }
      vA.play().catch(() => {
        const onFirstTouch = () => {
          vA.play().catch(() => { });
          window.removeEventListener('pointerdown', onFirstTouch);
          window.removeEventListener('scroll', onFirstTouch);
        };
        window.addEventListener('pointerdown', onFirstTouch, { once: true });
        window.addEventListener('scroll', onFirstTouch, { once: true });
      });
    };

    // Play ONCE on scroll (when hero illustration is visible)
    let hasPlayedHeroOnScroll = false;
    let scrollTimer = null;

    const handleScroll = () => {
      if (hasPlayedHeroOnScroll) return;
      if (frame) {
        const rect = frame.getBoundingClientRect();
        const inView = rect.top < window.innerHeight && rect.bottom > 0;
        if (inView) {
          hasPlayedHeroOnScroll = true;
          if (scrollTimer) clearTimeout(scrollTimer);
          scrollTimer = setTimeout(() => {
            vA.play().catch(() => {});
          }, 80);
        }
      }
    };

    const handleHeroEnded = () => {
      vA.pause();
    };
    vA.addEventListener('ended', handleHeroEnded);

    window.addEventListener('scroll', handleScroll, { passive: true });

    let animId;
    let isVisible = true;

    // Render loop: paints exact section yellow #FFF8E7, blends video, and feathers edges/corners
    const render = () => {
      if (isVisible) {
        if (vA.readyState >= 2) {
          // Base: exact yellow background of the section
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = '#FFF8E7';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Video: multiply blend onto #FFF8E7
          ctx.globalCompositeOperation = 'multiply';
          ctx.drawImage(vA, 0, 0, canvas.width, canvas.height);

          // Feather edges & corners smoothly into #FFF8E7 so no sharp lines or cuts exist
          ctx.globalCompositeOperation = 'source-over';

          // Left side feather (50px)
          const gLeft = ctx.createLinearGradient(0, 0, 50, 0);
          gLeft.addColorStop(0, '#FFF8E7');
          gLeft.addColorStop(1, 'rgba(255, 248, 231, 0)');
          ctx.fillStyle = gLeft;
          ctx.fillRect(0, 0, 50, canvas.height);

          // Right side feather (50px)
          const gRight = ctx.createLinearGradient(canvas.width - 50, 0, canvas.width, 0);
          gRight.addColorStop(0, 'rgba(255, 248, 231, 0)');
          gRight.addColorStop(1, '#FFF8E7');
          ctx.fillStyle = gRight;
          ctx.fillRect(canvas.width - 50, 0, 50, canvas.height);

          // Bottom side & corner feather (45px)
          const gBottom = ctx.createLinearGradient(0, canvas.height - 45, 0, canvas.height);
          gBottom.addColorStop(0, 'rgba(255, 248, 231, 0)');
          gBottom.addColorStop(1, '#FFF8E7');
          ctx.fillStyle = gBottom;
          ctx.fillRect(0, canvas.height - 45, canvas.width, 45);

          // Top side & corner feather (35px)
          const gTop = ctx.createLinearGradient(0, 0, 0, 35);
          gTop.addColorStop(0, '#FFF8E7');
          gTop.addColorStop(1, 'rgba(255, 248, 231, 0)');
          ctx.fillStyle = gTop;
          ctx.fillRect(0, 0, canvas.width, 35);
        } else if (posterLoaded) {
          ctx.drawImage(poster, 0, 0, canvas.width, canvas.height);
        }
      }
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        isVisible = entry.isIntersecting;
      });
    }, { threshold: 0.1 });

    if (frame) io.observe(frame);

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (scrollTimer) clearTimeout(scrollTimer);
      window.removeEventListener('scroll', handleScroll);
      vA.removeEventListener('ended', handleHeroEnded);
      io.disconnect();
    };
  }, []);

  const handleHeroFrameClick = (e) => {
    if (e.target.closest('.living-ctrl-btn')) return;
    const frame = heroFrameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const heartId = Date.now() + Math.random();
    const emojis = ['🧡', '✨', '🐾', '💖', '⭐', '❤️'];
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];

    setHeroHearts(prev => [...prev, { id: heartId, x, y, emoji }]);
    setTimeout(() => {
      setHeroHearts(prev => prev.filter(h => h.id !== heartId));
    }, 1200);
  };

  const toggleVideoPlayback = (e) => {
    e.stopPropagation();
    const cur = activeVideoRef.current === 'A' ? videoARef.current : videoBRef.current;
    if (!cur) return;
    if (cur.paused || isVideoPaused) {
      cur.play().catch(() => { });
      setIsVideoPaused(false);
    } else {
      cur.pause();
      setIsVideoPaused(true);
    }
  };

  // Butterfly cursor tracking loop
  useEffect(() => {
    const handleMouseMove = (e) => {
      butterflyCoords.current.tx = e.clientX + 18;
      butterflyCoords.current.ty = e.clientY + 18;
      if (butterflyRef.current) {
        butterflyRef.current.style.opacity = '1';
      }
    };
    window.addEventListener('mousemove', handleMouseMove);

    let animationFrame;
    const animateButterfly = () => {
      const c = butterflyCoords.current;
      c.bx += (c.tx - c.bx) * 0.07;
      c.by += (c.ty - c.by) * 0.07;
      c.ang += ((c.tx - c.bx) * 0.4 - c.ang) * 0.1;
      if (butterflyRef.current) {
        const clampedAng = Math.max(-25, Math.min(25, c.ang));
        butterflyRef.current.style.transform = `translate(${c.bx}px, ${c.by}px) rotate(${clampedAng}deg)`;
      }
      animationFrame = requestAnimationFrame(animateButterfly);
    };
    animationFrame = requestAnimationFrame(animateButterfly);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  // Parallax doodles on scroll
  useEffect(() => {
    const doodles = document.querySelectorAll('.dd');
    const handleDoodleScroll = () => {
      const y = window.scrollY;
      doodles.forEach(d => {
        const s = parseFloat(d.getAttribute('data-s') || '0.04');
        d.style.transform = `translateY(${-y * s}px)`;
      });
    };
    window.addEventListener('scroll', handleDoodleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleDoodleScroll);
  }, []);

  // Deck Swipe Handler
  const handleDeckSwipe = (direction) => {
    if (swipeOffset) return;
    setSwipeOffset(direction);
    setTimeout(() => {
      setDeckIndex(prev => (prev + 1) % deckPets.length);
      setSwipeOffset(null);
    }, 400);
  };

  // Copy link
  const handleCopyLink = () => {
    try {
      navigator.clipboard.writeText('hawpulse.app/s/cooper-9x2k');
    } catch { }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1600);
  };

  // Paw AI Interactive Q&A Handler
  const handlePawAiAsk = (queryText) => {
    const q = (queryText !== undefined ? queryText : pawAiQuestion).trim();
    if (!q) return;
    setPawAiQuestion(q);
    setPawAiLoading(true);

    setTimeout(() => {
      const lower = q.toLowerCase();
      let res = {
        verdict: 'Paw AI Care Guidance ✨',
        badgeColor: '#10B981',
        text: 'Keep track of daily energy, appetite, and hydration. For persistent or acute symptoms, consult your primary veterinarian or use HawPulse triage.',
        tag: 'General Wellness'
      };

      if (lower.includes('blueberr') || lower.includes('berry') || lower.includes('fruit')) {
        res = {
          verdict: 'Safe & Healthy Treat 🫐',
          badgeColor: '#10B981',
          text: 'Yes! Blueberries are safe for both dogs and cats. Packed with antioxidants, vitamin C, and fiber. Feed 3–6 berries as a fresh or frozen reward.',
          tag: 'Nutrition'
        };
      } else if (lower.includes('chocolat') || lower.includes('cocoa')) {
        res = {
          verdict: 'Toxic Danger 🚨',
          badgeColor: '#EF4444',
          text: 'Theobromine in chocolate is highly toxic to dogs and cats, especially dark chocolate and cocoa powder. If ingested recently, contact your emergency vet immediately.',
          tag: 'Toxin Alert'
        };
      } else if (lower.includes('grape') || lower.includes('raisin')) {
        res = {
          verdict: 'Severe Toxin 🚨',
          badgeColor: '#EF4444',
          text: 'Grapes and raisins can cause sudden acute kidney failure in dogs even in tiny amounts. Seek emergency veterinary care immediately if swallowed.',
          tag: 'Emergency'
        };
      } else if (lower.includes('limp') || lower.includes('paw') || lower.includes('leg') || lower.includes('walk')) {
        res = {
          verdict: 'Rest & Inspect 🐾',
          badgeColor: '#F59E0B',
          text: 'Check paw pads for burrs, cuts, or cracked nails. Restrict running for 24 hours. If bearing zero weight or whining, schedule a vet check to rule out sprains.',
          tag: 'Symptom Triage'
        };
      } else if (lower.includes('sneez') || lower.includes('cough') || lower.includes('runny')) {
        res = {
          verdict: 'Watch for Discharge 🤧',
          badgeColor: '#F59E0B',
          text: 'Occasional sneezing is harmless (dust, pollen). If there is cloudy nasal discharge, eye redness, or lethargy, it may be an upper respiratory infection.',
          tag: 'Respiratory'
        };
      } else if (lower.includes('water') || lower.includes('thirst') || lower.includes('drink')) {
        res = {
          verdict: 'Hydration Check 💧',
          badgeColor: '#3B82F6',
          text: 'Pets normally drink 50–60 ml per kg daily. Sudden excess thirst (polydipsia) can indicate diabetes, kidney changes, or heat stress—worth a vet check if persistent.',
          tag: 'Health Monitor'
        };
      } else if (lower.includes('vomit') || lower.includes('throw') || lower.includes('stomach')) {
        res = {
          verdict: 'Digestive Rest 🍲',
          badgeColor: '#F59E0B',
          text: 'Withhold food for 4–6 hours (keep small water sips available). Offer plain boiled chicken and white rice. If vomiting repeats or contains bile/blood, contact your vet.',
          tag: 'Digestive'
        };
      } else if (lower.includes('hiccup')) {
        res = {
          verdict: 'Harmless Puppy Habit 🐶',
          badgeColor: '#10B981',
          text: 'Puppy hiccups are super common and harmless! They happen when eating too fast or playing energetically. Usually stops in 5–10 minutes on its own.',
          tag: 'Behavior'
        };
      } else if (lower.includes('apple') || lower.includes('banana') || lower.includes('carrot')) {
        res = {
          verdict: 'Nutritious & Safe 🥕',
          badgeColor: '#10B981',
          text: 'Apples (without seeds/core), bananas, and carrots are crunchy, vitamin-rich treats loved by dogs and safe in small bites.',
          tag: 'Nutrition'
        };
      } else {
        res = {
          verdict: 'Paw AI Recommendation ✨',
          badgeColor: '#3B82F6',
          text: `Regarding "${q.length > 36 ? q.slice(0, 36) + '...' : q}": Keep track of daily behavior, appetite, and stool consistency. In HawPulse's Medical Vault, you can upload records or chat with AI clinical triage.`,
          tag: 'AI Advice'
        };
      }

      setPawAiAnswer(res);
      setPawAiLoading(false);
    }, 320);
  };

  const toggleChip = (idx) => {
    setSelectedChips(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const toggleFaq = (idx) => {
    setOpenFaqs(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className="paw-notebook-landing">
      {/* Global Embedded Styles matching PawCircle · warm pet notebook.html */}
      <style>{`
        .paw-notebook-landing {
          --bg: #FFF8E7;
          --ink: #1A1A1A;
          --mut: #6b665c;
          --card: #ffffff;
          --yel: #FFC83D;
          --pink: #FFDDD6;
          --mint: #D8F2E4;
          --blue: #DCE8FA;
          --coral: #FF6B57;
          --grn: #1E9E5A;
          --dk: #1A1A1A;
          --cl: #FFF8E7;
          --d: 'Fredoka', 'Quicksand', system-ui, sans-serif;
          --b: 'Inter', system-ui, sans-serif;
          background: var(--bg);
          color: var(--ink);
          font-family: var(--b);
          font-size: 17px;
          line-height: 1.55;
          position: relative;
          overflow-x: hidden;
          width: 100%;
          min-height: 100vh;
        }

        .paw-notebook-landing h1,
        .paw-notebook-landing h2,
        .paw-notebook-landing h3,
        .paw-notebook-landing .f {
          font-family: var(--d);
          line-height: 1.02;
          letter-spacing: -0.02em;
          color: var(--ink);
        }

        .paw-notebook-landing .wrap {
          max-width: 1180px;
          margin: 0 auto;
          padding: 0 24px;
          position: relative;
          z-index: 1;
        }

        .paw-notebook-landing section {
          padding: 100px 0;
          position: relative;
        }

        /* Scroll-triggered reveal animations (play ONCE on scroll) */
        .paw-notebook-landing .scroll-reveal {
          opacity: 0;
          transform: translateY(28px);
          transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
          will-change: opacity, transform;
        }

        .paw-notebook-landing .scroll-reveal.is-revealed {
          opacity: 1;
          transform: translateY(0);
        }

        .paw-notebook-landing .scroll-reveal-scale {
          opacity: 0;
          transform: scale(0.96) translateY(20px);
          transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
          will-change: opacity, transform;
        }

        .paw-notebook-landing .scroll-reveal-scale.is-revealed {
          opacity: 1;
          transform: scale(1) translateY(0);
        }

        .paw-notebook-landing .scroll-reveal-stagger > * {
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
          will-change: opacity, transform;
        }

        .paw-notebook-landing .scroll-reveal-stagger.is-revealed > * {
          opacity: 1;
          transform: translateY(0);
        }

        .paw-notebook-landing .scroll-reveal-stagger.is-revealed > *:nth-child(1) { transition-delay: 0.04s; }
        .paw-notebook-landing .scroll-reveal-stagger.is-revealed > *:nth-child(2) { transition-delay: 0.12s; }
        .paw-notebook-landing .scroll-reveal-stagger.is-revealed > *:nth-child(3) { transition-delay: 0.20s; }
        .paw-notebook-landing .scroll-reveal-stagger.is-revealed > *:nth-child(4) { transition-delay: 0.28s; }
        .paw-notebook-landing .scroll-reveal-stagger.is-revealed > *:nth-child(5) { transition-delay: 0.36s; }
        .paw-notebook-landing .scroll-reveal-stagger.is-revealed > *:nth-child(6) { transition-delay: 0.44s; }

        .paw-notebook-landing .btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font: 600 17px var(--d);
          padding: 16px 28px;
          border-radius: 999px;
          border: 2.5px solid var(--dk);
          background: var(--yel);
          color: #1A1A1A;
          box-shadow: 0 5px 0 var(--dk);
          cursor: pointer;
          transition: transform 0.15s, box-shadow 0.15s, background 0.15s;
          text-decoration: none;
        }

        .paw-notebook-landing .btn:hover {
          transform: translateY(2px);
          box-shadow: 0 3px 0 var(--dk);
        }

        .paw-notebook-landing .btn:active {
          transform: translateY(5px);
          box-shadow: 0 0 0 var(--dk);
        }

        .paw-notebook-landing .btn.ghost {
          background: transparent;
          color: var(--ink);
          border-color: var(--ink);
          box-shadow: 0 5px 0 var(--ink);
        }

        .paw-notebook-landing .btn.mini {
          padding: 10px 18px;
          font-size: 15px;
          box-shadow: 0 3px 0 var(--dk);
        }

        /* Animated Ball Preloader */
        .paw-notebook-landing #ld {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: var(--yel);
          display: grid;
          place-content: center;
          justify-items: center;
          gap: 18px;
          color: #1A1A1A;
          font: 600 20px var(--d);
          transition: transform 0.8s cubic-bezier(0.7, 0, 0.2, 1);
        }

        .paw-notebook-landing #ld.go {
          transform: translateY(-100%);
        }

        .paw-notebook-landing .ball {
          width: 46px;
          height: 46px;
          border-radius: 50%;
          background: #1A1A1A;
          animation: pcBall 0.6s cubic-bezier(0.3, 0, 0.7, 1) infinite alternate;
        }

        .paw-notebook-landing .shadow {
          width: 46px;
          height: 8px;
          border-radius: 50%;
          background: rgba(0,0,0,0.2);
          animation: pcShadow 0.6s infinite alternate;
          margin-top: -8px;
        }

        @keyframes pcBall {
          from { transform: translateY(-70px); }
          to { transform: translateY(0) scaleY(0.85); }
        }

        @keyframes pcShadow {
          from { transform: scale(0.5); opacity: 0.4; }
          to { transform: scale(1.1); opacity: 1; }
        }

        /* Hero */
        .paw-notebook-landing .hero {
          display: grid;
          grid-template-columns: 0.95fr 1.05fr;
          gap: 40px;
          align-items: center;
          padding: 60px 0 100px;
        }

        .paw-notebook-landing .tag {
          display: inline-flex;
          gap: 8px;
          align-items: center;
          background: var(--card);
          border: 2px solid var(--ink);
          border-radius: 999px;
          padding: 8px 16px;
          font-weight: 600;
          font-size: 15px;
        }

        .paw-notebook-landing .tag b {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--grn);
          display: inline-block;
        }

        .paw-notebook-landing h1 {
          font-family: var(--d) !important;
          font-size: clamp(44px, 6.8vw, 92px);
          font-weight: 700;
          line-height: 1.04;
          margin: 22px 0;
          letter-spacing: -0.02em;
          color: var(--ink);
        }

        .paw-notebook-landing mark {
          background: linear-gradient(transparent 52%, var(--yel) 52% 96%, transparent 96%);
          color: inherit;
          padding: 0 4px;
        }

        .paw-notebook-landing .lead {
          color: var(--mut);
          font-size: 20px;
          max-width: 520px;
          margin-bottom: 30px;
          line-height: 1.5;
        }

        .paw-notebook-landing .cta {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }

        .paw-notebook-landing .stage {
          position: relative;
          max-width: 660px;
          margin: auto;
          width: 100%;
          background: transparent;
        }

        .paw-notebook-landing .living-frame {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          background: transparent;
          border: none !important;
          box-shadow: none !important;
          outline: none !important;
          border-radius: 0 !important;
          overflow: visible;
          cursor: pointer;
          user-select: none;
        }

        .paw-notebook-landing .living-video-canvas {
          width: 100%;
          height: auto;
          aspect-ratio: 16 / 9;
          display: block;
          background: #FFF8E7;
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          -webkit-mask-image: radial-gradient(ellipse 96% 92% at 50% 50%, black 80%, transparent 100%);
          mask-image: radial-gradient(ellipse 96% 92% at 50% 50%, black 80%, transparent 100%);
        }

        .paw-notebook-landing .living-overlay-svg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 5;
          overflow: visible;
          opacity: 0;
          animation: pcOverlayEntrance 1s ease-out 1.8s forwards;
        }

        @keyframes pcOverlayEntrance {
          to { opacity: 1; }
        }

        .paw-notebook-landing .anim-butterfly-1 {
          animation: pcFlyLoop1 8s ease-in-out infinite;
          transform-origin: center;
        }

        .paw-notebook-landing .anim-butterfly-2 {
          animation: pcFlyLoop2 10s ease-in-out infinite;
          transform-origin: center;
          animation-delay: -3.5s;
        }

        @keyframes pcFlyLoop1 {
          0% { transform: translate(120px, 60px) rotate(-10deg); }
          25% { transform: translate(160px, 40px) rotate(15deg); }
          50% { transform: translate(210px, 75px) rotate(-8deg); }
          75% { transform: translate(150px, 90px) rotate(-22deg); }
          100% { transform: translate(120px, 60px) rotate(-10deg); }
        }

        @keyframes pcFlyLoop2 {
          0% { transform: translate(1050px, 70px) rotate(12deg); }
          30% { transform: translate(990px, 45px) rotate(-16deg); }
          60% { transform: translate(1080px, 95px) rotate(20deg); }
          85% { transform: translate(1120px, 50px) rotate(-5deg); }
          100% { transform: translate(1050px, 70px) rotate(12deg); }
        }

        .paw-notebook-landing .bf-wing-l, .paw-notebook-landing .bf-wing-r {
          transform-box: fill-box;
          transform-origin: center;
          animation: pcFlap 0.28s ease-in-out infinite alternate;
        }
        .paw-notebook-landing .bf-wing-r {
          animation-direction: alternate-reverse;
        }

        @keyframes pcFlap {
          0% { transform: scaleX(1); }
          100% { transform: scaleX(0.22); }
        }

        .paw-notebook-landing .anim-sparkle {
          transform-box: fill-box;
          transform-origin: center;
          animation: pcSparkleTwinkle 2.4s ease-in-out infinite;
        }
        .paw-notebook-landing .sp-1 { animation-delay: 0s; }
        .paw-notebook-landing .sp-2 { animation-delay: 0.6s; }
        .paw-notebook-landing .sp-3 { animation-delay: 1.2s; }
        .paw-notebook-landing .sp-4 { animation-delay: 1.8s; }
        .paw-notebook-landing .sp-5 { animation-delay: 0.9s; }

        @keyframes pcSparkleTwinkle {
          0%, 100% { transform: scale(0.65) rotate(0deg); opacity: 0.4; }
          50% { transform: scale(1.3) rotate(45deg); opacity: 1; }
        }

        .paw-notebook-landing .anim-spiral {
          stroke-dasharray: 120;
          stroke-dashoffset: 120;
          animation: pcSpiralDraw 5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        .paw-notebook-landing .spiral-2 {
          animation-delay: -2.5s;
        }

        @keyframes pcSpiralDraw {
          0% { stroke-dashoffset: 120; opacity: 0; }
          20% { opacity: 1; }
          60% { stroke-dashoffset: 0; opacity: 1; }
          85% { stroke-dashoffset: -120; opacity: 0.8; }
          100% { stroke-dashoffset: -120; opacity: 0; }
        }

        .paw-notebook-landing .anim-cloud-1 {
          animation: pcCloudDrift1 26s linear infinite;
        }
        .paw-notebook-landing .anim-cloud-2 {
          animation: pcCloudDrift2 32s linear infinite;
          animation-delay: -14s;
        }

        @keyframes pcCloudDrift1 {
          0% { transform: translateX(0); }
          50% { transform: translateX(35px); }
          100% { transform: translateX(0); }
        }

        @keyframes pcCloudDrift2 {
          0% { transform: translateX(0); }
          50% { transform: translateX(-30px); }
          100% { transform: translateX(0); }
        }

        .paw-notebook-landing .pop-heart {
          position: absolute;
          pointer-events: none;
          z-index: 25;
          font-size: 26px;
          user-select: none;
          animation: pcPopHeart 1.2s cubic-bezier(0.2, 0.8, 0.3, 1) forwards;
        }

        @keyframes pcPopHeart {
          0% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(0.5) rotate(0deg);
          }
          50% {
            opacity: 0.95;
            transform: translate(calc(-50% + 12px), calc(-50% - 46px)) scale(1.35) rotate(-14deg);
          }
          100% {
            opacity: 0;
            transform: translate(calc(-50% + 22px), calc(-50% - 90px)) scale(1) rotate(16deg);
          }
        }



        .paw-notebook-landing .tail {
          transform-box: fill-box;
          transform-origin: 0 100%;
          animation: pcSway 2.2s ease-in-out infinite alternate;
        }
        @keyframes pcSway {
          from { transform: rotate(-7deg); }
          to { transform: rotate(9deg); }
        }

        .paw-notebook-landing .flw {
          transform-box: fill-box;
          transform-origin: 50% 100%;
          animation: pcSway 3s ease-in-out infinite alternate;
        }

        .paw-notebook-landing .hrt {
          animation: pcHrtUp 3.4s ease-in infinite;
          opacity: 0;
        }
        @keyframes pcHrtUp {
          0% { transform: translateY(0); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translateY(-80px); opacity: 0; }
        }

        .paw-notebook-landing .fly2 {
          animation: pcFly 10s ease-in-out infinite;
        }

        .paw-notebook-landing .chip {
          position: absolute;
          background: #fff;
          color: #1A1A1A;
          border: 2.5px solid var(--dk);
          box-shadow: 0 4px 0 var(--dk);
          border-radius: 999px;
          padding: 9px 16px;
          font: 600 15px var(--d);
          animation: pcChipFloat 4s ease-in-out infinite;
          white-space: nowrap;
          z-index: 5;
        }

        @keyframes pcChipFloat {
          50% { transform: translateY(-12px) rotate(2deg); }
        }

        /* Marquee */
        .paw-notebook-landing .mq {
          background: var(--dk);
          color: #FFF8E7;
          transform: rotate(-1.6deg);
          margin: 0 -3vw;
          padding: 20px 0;
          overflow: hidden;
          border-block: 3px solid var(--dk);
          position: relative;
          z-index: 2;
          box-shadow: 0 4px 14px rgba(0,0,0,0.15);
        }

        .paw-notebook-landing .mq div {
          display: flex;
          gap: 44px;
          width: max-content;
          animation: pcMq 28s linear infinite;
          font: 600 30px var(--d);
          align-items: center;
          white-space: nowrap;
        }

        .paw-notebook-landing .mq span::after {
          content: "✺";
          color: var(--yel);
          margin-left: 44px;
        }

        @keyframes pcMq {
          to { transform: translateX(-50%); }
        }

        .paw-notebook-landing .mq.rev {
          transform: rotate(1.2deg);
          background: var(--yel);
          color: #1A1A1A;
        }
        .paw-notebook-landing .mq.rev div {
          animation-direction: reverse;
        }

        /* Fan Cards */
        .paw-notebook-landing .fan {
          display: flex;
          justify-content: center;
          gap: 26px;
          margin-top: 70px;
          flex-wrap: wrap;
        }

        .paw-notebook-landing .fc {
          width: 320px;
          max-width: 90vw;
          border: none;
          box-shadow: none;
          background: transparent !important;
          padding: 0;
          color: #1A1A1A;
          transform: rotate(var(--r, 0deg));
          transition: transform 0.45s cubic-bezier(0.3, 1.5, 0.5, 1);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .paw-notebook-landing .fc:hover {
          transform: rotate(0) translateY(-16px) scale(1.04);
        }

        .paw-notebook-landing .fc img.fc-card-img {
          width: 100%;
          height: auto;
          display: block;
          filter: drop-shadow(0 4px 14px rgba(0,0,0,0.06));
          transition: filter 0.35s ease, transform 0.35s ease;
          border-radius: 32px;
        }

        .paw-notebook-landing .fc:hover img.fc-card-img {
          filter: drop-shadow(0 18px 30px rgba(0,0,0,0.15));
        }

        .paw-notebook-landing .fc:nth-child(2) {
          margin-top: -22px;
        }

        .paw-notebook-landing .bb {
          transform-box: fill-box;
          transform-origin: 50% 100%;
        }

        .paw-notebook-landing .fc:hover .bb {
          animation: pcBob 0.5s ease-in-out infinite alternate;
        }

        /* ========================================================= */
        /* Section 3 (#what) Header & Looping Background Video       */
        /* Tunable values:                                           */
        /*   --bg-run-opacity:   0.25 (desktop) / 0.18 (mobile)      */
        /*   --bg-run-fade-out:  0.03 (opacity during loop seam)     */
        /*   --bg-run-mask-top:  12%  (top soft edge fade)           */
        /*   --bg-run-mask-bot:  88%  (bottom soft edge fade)        */
        /*   --bg-run-fade-ms:   350ms (loop cross-fade duration)    */
        /*   --bg-run-pos-y:     60%  (vertical object-position)     */
        /* ========================================================= */
        .paw-notebook-landing #what {
          --bg-run-opacity: 0.25;
          --bg-run-fade-out: 0.03;
          --bg-run-mask-top: 12%;
          --bg-run-mask-bot: 88%;
          --bg-run-fade-ms: 350ms;
          --bg-run-pos-y: 60%;
          position: relative;
          overflow: hidden;
          overflow: clip;
          isolation: isolate;
          background: var(--bg);
        }

        .paw-notebook-landing #what .bg-run {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          mix-blend-mode: multiply;
          -webkit-mask-image: linear-gradient(
            to bottom,
            transparent 0%,
            #000 var(--bg-run-mask-top),
            #000 var(--bg-run-mask-bot),
            transparent 100%
          );
          mask-image: linear-gradient(
            to bottom,
            transparent 0%,
            #000 var(--bg-run-mask-top),
            #000 var(--bg-run-mask-bot),
            transparent 100%
          );
        }

        .paw-notebook-landing #what .bg-run__sticky {
          position: sticky;
          top: 0;
          width: 100%;
          height: 100vh;
          height: 100svh;
          overflow: hidden;
        }

        .paw-notebook-landing #what .bg-run__video,
        .paw-notebook-landing #what .bg-run__poster {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          object-position: center var(--bg-run-pos-y);
          mix-blend-mode: multiply;
          opacity: var(--bg-run-opacity);
          filter: brightness(1.02) contrast(1.02);
          transition: opacity var(--bg-run-fade-ms) ease-in-out;
          will-change: opacity;
          pointer-events: none;
        }

        .paw-notebook-landing #what .bg-run__video.is-fading {
          opacity: var(--bg-run-fade-out);
        }

        .paw-notebook-landing #what .what-header {
          position: relative;
          z-index: 1;
          display: inline-block;
          max-width: 780px;
        }

        /* Faint cream radial scrim behind header text to protect WCAG AA contrast */
        .paw-notebook-landing #what .what-header::before {
          content: "";
          position: absolute;
          inset: -60px -80px;
          z-index: -1;
          pointer-events: none;
          background: radial-gradient(
            closest-side,
            rgba(255, 248, 231, 0.65) 0%,
            rgba(255, 248, 231, 0.3) 55%,
            rgba(255, 248, 231, 0) 100%
          );
        }

        /* Section display heading & eyebrow styles across all landing sections */
        .paw-notebook-landing .eyebrow {
          font: 600 15px var(--b);
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--mut);
          margin-bottom: 12px;
        }

        .paw-notebook-landing h2 {
          font-family: var(--d);
          font-size: clamp(34px, 4.4vw, 56px);
          font-weight: 700;
          line-height: 1.06;
          letter-spacing: -0.02em;
          color: var(--ink);
          margin: 0 0 18px;
        }

        .paw-notebook-landing .sub {
          color: var(--mut);
          font-size: 20px;
          max-width: 520px;
          margin: 0;
        }

        .paw-notebook-landing #what .bento {
          position: relative;
          z-index: 1;
        }

        /* Hide multiply background video on dark themes */
        :root[data-theme="dark"] .paw-notebook-landing #what .bg-run,
        .dark .paw-notebook-landing #what .bg-run {
          display: none;
        }

        @media (max-width: 768px) {
          .paw-notebook-landing #what {
            --bg-run-opacity: 0.18;
          }
        }

        /* Bento Grid */
        .paw-notebook-landing .bento {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 22px;
          margin-top: 56px;
        }

        .paw-notebook-landing .c {
          border: 2.5px solid var(--ink);
          border-radius: 32px;
          padding: 30px;
          background: var(--card);
          position: relative;
          transition: transform 0.25s, box-shadow 0.25s;
          overflow: hidden;
          min-height: 300px;
          cursor: pointer;
        }

        .paw-notebook-landing .c:hover {
          transform: translate(-4px, -4px) rotate(-0.6deg);
          box-shadow: 8px 8px 0 var(--ink);
        }

        .paw-notebook-landing .c.pc {
          color: #1A1A1A;
          border-color: #1A1A1A;
        }

        .paw-notebook-landing .c.pc:hover {
          box-shadow: 8px 8px 0 #1A1A1A;
        }

        .paw-notebook-landing .s2 { grid-column: span 2; }
        .paw-notebook-landing .s3 { grid-column: span 3; }
        .paw-notebook-landing .s4 { grid-column: span 4; }

        .paw-notebook-landing .ic {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: #fff;
          border: 2.5px solid #1A1A1A;
          display: grid;
          place-items: center;
          font-size: 26px;
          margin-bottom: 18px;
        }

        .paw-notebook-landing .c h3 {
          font-size: 30px;
          margin-bottom: 8px;
        }

        .paw-notebook-landing .c p {
          color: var(--mut);
          line-height: 1.45;
        }

        .paw-notebook-landing .big {
          font: 700 84px/1 var(--d);
          margin-top: 20px;
        }

        .paw-notebook-landing .big small {
          font-size: 22px;
          font-weight: 500;
        }

        .paw-notebook-landing .taps {
          display: flex;
          gap: 10px;
          margin-top: 22px;
        }

        .paw-notebook-landing .taps button {
          width: 62px;
          height: 62px;
          border-radius: 50%;
          border: 2.5px solid var(--ink);
          background: var(--card);
          font-size: 26px;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
          color: var(--ink);
        }

        .paw-notebook-landing .taps button:hover {
          transform: scale(1.1);
        }

        .paw-notebook-landing .taps button.on {
          background: #1A1A1A;
          transform: scale(1.12);
          box-shadow: 0 0 0 6px var(--yel);
        }

        .paw-notebook-landing #log {
          margin-top: 18px;
          font: 600 15px var(--b);
          min-height: 24px;
          color: var(--grn);
        }

        .paw-notebook-landing .slip {
          background: #fff;
          border-radius: 16px;
          padding: 14px 16px;
          margin-top: 12px;
          color: #1A1A1A;
          font-size: 15px;
          transition: opacity 0.3s;
          border: 1.5px solid #EDE6D3;
        }

        .paw-notebook-landing .slip small {
          display: block;
          color: #7a756a;
          font-size: 13px;
        }

        .paw-notebook-landing .prog {
          height: 22px;
          border: 2.5px solid #1A1A1A;
          border-radius: 99px;
          background: #fff;
          overflow: hidden;
          margin: 20px 0 8px;
        }

        .paw-notebook-landing .prog i {
          display: block;
          height: 100%;
          background: var(--grn);
          transition: width 1.6s cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .paw-notebook-landing .link {
          display: flex;
          gap: 10px;
          align-items: center;
          background: var(--bg);
          border: 2px dashed var(--ink);
          border-radius: 16px;
          padding: 12px 14px;
          margin-top: 20px;
          font: 400 14px var(--b);
          color: var(--mut);
        }

        .paw-notebook-landing .link span {
          color: var(--mut);
          font-weight: 400;
        }

        .paw-notebook-landing .faces {
          display: flex;
          margin-top: 22px;
        }

        .paw-notebook-landing .faces span {
          width: 62px;
          height: 62px;
          border-radius: 50%;
          border: 2.5px solid #1A1A1A;
          display: grid;
          place-items: center;
          font-size: 30px;
          margin-right: -14px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        /* Paw AI Card Styles */
        .paw-notebook-landing .paw-ai-card {
          display: flex;
          flex-direction: column;
        }

        .paw-notebook-landing .paw-ai-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .paw-notebook-landing .paw-ai-live-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #fff;
          border: 2px solid #1A1A1A;
          border-radius: 999px;
          padding: 4px 12px;
          font-size: 12px;
          font-weight: 700;
          color: #1A1A1A;
          box-shadow: 0 2px 0 #1A1A1A;
        }

        .paw-notebook-landing .paw-ai-live-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10B981;
          display: inline-block;
          animation: pcPulse 1.6s infinite;
        }

        @keyframes pcPulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { transform: scale(1.15); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }

        .paw-notebook-landing .paw-ai-input-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #fff;
          border: 2.5px solid #1A1A1A;
          border-radius: 999px;
          padding: 6px 6px 6px 14px;
          box-shadow: 0 3px 0 #1A1A1A;
          margin: 16px 0 10px;
          transition: transform 0.15s, box-shadow 0.15s;
        }

        .paw-notebook-landing .paw-ai-input-wrap:focus-within {
          transform: translateY(-2px);
          box-shadow: 0 5px 0 #1A1A1A;
        }

        .paw-notebook-landing .paw-ai-input {
          flex: 1;
          border: none;
          outline: none;
          background: transparent;
          font-size: 14px;
          font-family: inherit;
          color: #1A1A1A;
          font-weight: 500;
          min-width: 0;
        }

        .paw-notebook-landing .paw-ai-input::placeholder {
          color: #7A756A;
          font-weight: 400;
        }

        .paw-notebook-landing .paw-ai-btn {
          background: #1A1A1A;
          color: #fff;
          border: none;
          border-radius: 999px;
          padding: 8px 14px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
          transition: transform 0.15s, background 0.15s;
        }

        .paw-notebook-landing .paw-ai-btn:hover {
          background: #3B82F6;
          transform: scale(1.04);
        }

        .paw-notebook-landing .paw-ai-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 10px;
        }

        .paw-notebook-landing .paw-ai-chip {
          background: rgba(255, 255, 255, 0.75);
          border: 1.5px solid #1A1A1A;
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 12px;
          font-weight: 600;
          color: #1A1A1A;
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: inherit;
        }

        .paw-notebook-landing .paw-ai-chip:hover {
          background: #fff;
          transform: translateY(-2px);
          box-shadow: 0 2px 0 #1A1A1A;
        }

        .paw-notebook-landing .paw-ai-result {
          background: #fff;
          border: 2px solid #1A1A1A;
          border-radius: 18px;
          padding: 12px 14px;
          margin-top: 4px;
          box-shadow: 0 3px 0 #1A1A1A;
          animation: pcSlideUp 0.25s cubic-bezier(0.2, 0.9, 0.3, 1);
        }

        @keyframes pcSlideUp {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .paw-notebook-landing .paw-ai-result-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 5px;
        }

        .paw-notebook-landing .paw-ai-verdict {
          font-weight: 700;
          font-size: 13px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .paw-notebook-landing .paw-ai-result-text {
          font-size: 13.5px;
          color: #2D2A26;
          line-height: 1.45;
          margin: 0 0 8px 0;
        }

        .paw-notebook-landing .paw-ai-action-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px dashed #EDE6D3;
          padding-top: 6px;
        }

        .paw-notebook-landing .paw-ai-disc {
          font-size: 11px;
          color: #7A756A;
        }

        .paw-notebook-landing .paw-ai-open-chat {
          background: transparent;
          border: none;
          color: #2563EB;
          font-weight: 700;
          font-size: 12px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 0;
          text-decoration: underline;
        }

        .paw-notebook-landing .paw-ai-open-chat:hover {
          color: #1D4ED8;
        }

        .paw-notebook-landing .paw-ai-prompt-hint {
          margin-top: 4px;
          background: rgba(255, 255, 255, 0.6);
          border: 1.5px dashed rgba(26, 26, 26, 0.35);
          border-radius: 14px;
          padding: 9px 12px;
          font-size: 12.5px;
          color: #4a463e;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .paw-notebook-landing .paw-ai-prompt-hint:hover {
          background: rgba(255, 255, 255, 0.9);
          border-color: #1A1A1A;
        }

        /* ========================================================= */
        /* Section 4 (#how) Zig-Zag Storytelling Layout & Coral Line */
        /* Tunable CSS variables:                                    */
        /*   --how-line-width:    12px   (coral SVG path thickness)  */
        /*   --how-reveal-dist:   40px   (step text slide distance)  */
        /*   --how-step-gap:      115px  (vertical spacing of steps) */
        /*   --how-curve-h:       120px  (top arch curve depth)      */
        /* ========================================================= */
        .paw-notebook-landing #how {
          --how-line-width: 12px;
          --how-reveal-dist: 40px;
          --how-step-gap: 96px;
          --how-curve-h: 120px;
          padding: 0;
          margin-top: -54px;
          position: relative;
          z-index: 2;
          background: linear-gradient(to bottom, var(--yel) 0px, var(--yel) 180px, var(--bg) 180px);
          overflow: hidden;
        }

        .paw-notebook-landing .how-surface {
          position: relative;
          background: var(--bg);
          border-top: 3px solid var(--ink);
          border-radius: 50% 50% 0 0 / var(--how-curve-h) var(--how-curve-h) 0 0;
          padding: 110px 0 130px;
          overflow: hidden;
          isolation: isolate;
        }

        .paw-notebook-landing .how-wrap {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 32px;
          position: relative;
          z-index: 2;
        }

        /* Scroll-drawn Coral SVG Path Layer (sits behind text & icons) */
        .paw-notebook-landing .how-line-svg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 1;
          overflow: visible;
        }

        .paw-notebook-landing .how-line-path {
          fill: none;
          stroke: var(--coral);
          stroke-width: var(--how-line-width);
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .paw-notebook-landing .how-line-head {
          will-change: transform;
        }

        /* Giant Watermark Text ("TAP ONCE A DAY.") behind steps 2 and 3 */
        .paw-notebook-landing .how-watermark {
          position: absolute;
          top: 58%;
          left: -4vw;
          z-index: 0;
          font-family: var(--d);
          font-weight: 700;
          font-size: clamp(92px, 19.5vw, 300px);
          line-height: 0.9;
          letter-spacing: -0.03em;
          color: #F3E6C4;
          white-space: nowrap;
          pointer-events: none;
          user-select: none;
          transform: translate3d(0, -50%, 0);
          will-change: transform;
        }

        :root[data-theme="dark"] .paw-notebook-landing .how-watermark,
        .dark .paw-notebook-landing .how-watermark {
          color: rgba(255, 248, 231, 0.05);
        }

        /* Top Header Row: Left Display Heading + Right Illustrated Pet Trio */
        .paw-notebook-landing .how-top {
          display: grid;
          grid-template-columns: 1.12fr 0.88fr;
          gap: 32px;
          align-items: start;
          margin-bottom: 24px;
          position: relative;
          z-index: 2;
        }

        .paw-notebook-landing .how-top-left h2 {
          font-family: var(--d);
          font-size: clamp(46px, 5.8vw, 84px);
          font-weight: 700;
          line-height: 1.02;
          letter-spacing: -0.03em;
          color: var(--ink);
          margin: 16px 0 14px;
          text-shadow: 0 2px 14px var(--bg), 0 0 28px var(--bg);
        }

        .paw-notebook-landing .how-sub {
          color: var(--mut);
          font-size: 21px;
          line-height: 1.45;
          max-width: 500px;
          margin: 0 0 26px;
          text-shadow: 0 1px 10px var(--bg);
        }

        /* Decorative Doodles inside #how (butterfly + sparkles + cloud) */
        .paw-notebook-landing .how-doodle-mid {
          position: absolute;
          left: 44%;
          top: 72%;
          width: 110px;
          height: 80px;
          pointer-events: none;
          z-index: 2;
        }

        .paw-notebook-landing .how-doodle-cloud {
          position: absolute;
          right: 0;
          bottom: -36px;
          width: 110px;
          height: 55px;
          pointer-events: none;
          z-index: 2;
        }

        /* Top-Right Illustrated Pets */
        .paw-notebook-landing .how-pets-stage {
          justify-self: end;
          width: 100%;
          max-width: 380px;
          position: relative;
        }

        .paw-notebook-landing .how-pets-svg,
        .paw-notebook-landing .how-pets-img {
          width: 100%;
          height: auto;
          display: block;
          overflow: visible;
        }

        .paw-notebook-landing .how-pets-eyes-overlay {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          overflow: visible;
        }

        /* Speech bubble pop-in + bob animations */
        .paw-notebook-landing .how-bubble {
          transform-box: fill-box;
          transform-origin: 50% 100%;
          opacity: 0;
          transform: scale(0.4) translateY(10px);
          transition: opacity 0.45s ease-out, transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .paw-notebook-landing .how-pets-stage.is-revealed .how-bubble--1 {
          opacity: 1;
          transform: scale(1) translateY(0);
          transition-delay: 0.12s;
          animation: pcHowBubbleBob 3.4s ease-in-out 0.7s infinite alternate;
        }

        .paw-notebook-landing .how-pets-stage.is-revealed .how-bubble--2 {
          opacity: 1;
          transform: scale(1) translateY(0);
          transition-delay: 0.28s;
          animation: pcHowBubbleBob 3.8s ease-in-out 0.9s infinite alternate;
        }

        .paw-notebook-landing .how-pets-stage.is-revealed .how-bubble--3 {
          opacity: 1;
          transform: scale(1) translateY(0);
          transition-delay: 0.44s;
          animation: pcHowBubbleBob 3.2s ease-in-out 1.1s infinite alternate;
        }

        @keyframes pcHowBubbleBob {
          from { transform: translateY(0) rotate(-1.5deg); }
          to { transform: translateY(-7px) rotate(1.5deg); }
        }

        /* Periodic Pet Eye Blinking */
        .paw-notebook-landing .how-pet-eyes-1,
        .paw-notebook-landing .how-pet-eyes-2,
        .paw-notebook-landing .how-pet-eyes-3 {
          transform-box: fill-box;
          transform-origin: center;
          animation: pcHowBlink 4.8s ease-in-out infinite;
        }
        .paw-notebook-landing .how-pet-eyes-2 { animation-delay: 1.4s; animation-duration: 5.4s; }
        .paw-notebook-landing .how-pet-eyes-3 { animation-delay: 2.9s; animation-duration: 4.3s; }

        @keyframes pcHowBlink {
          0%, 92%, 100% { transform: scaleY(1); }
          95% { transform: scaleY(0.08); }
        }

        /* Occasional Floating Heart from First Pet */
        .paw-notebook-landing .how-float-heart {
          transform-box: fill-box;
          transform-origin: center;
          animation: pcHowHeartFloat 4.6s ease-in-out infinite;
          opacity: 0;
        }

        @keyframes pcHowHeartFloat {
          0%, 35% { transform: translate(0, 8px) scale(0.5); opacity: 0; }
          50% { opacity: 0.95; }
          85% { transform: translate(-10px, -42px) scale(1.08) rotate(-10deg); opacity: 0; }
          100% { opacity: 0; }
        }

        /* Micro Tracked-Out Label ("STEP BY STEP") */
        .paw-notebook-landing .how-micro-label {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font: 700 11.5px/1 var(--b);
          letter-spacing: 0.34em;
          text-transform: uppercase;
          color: var(--ink);
          margin: 0 0 18px 8px;
          position: relative;
          z-index: 2;
          background: rgba(255, 248, 231, 0.85);
          padding: 6px 12px;
          border-radius: 999px;
        }

        .paw-notebook-landing .how-micro-arrow {
          font-style: normal;
          display: inline-block;
          color: var(--coral);
          font-weight: 700;
          animation: pcHowArrowBounce 1.6s ease-in-out infinite;
        }

        @keyframes pcHowArrowBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(4px); }
        }

        /* Zig-Zag Steps Ordered List */
        .paw-notebook-landing .how-steps {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: var(--how-step-gap);
          position: relative;
          z-index: 2;
        }

        .paw-notebook-landing .how-step {
          display: flex;
          align-items: flex-start;
          gap: 32px;
          position: relative;
          transform: translate(var(--step-offset-x, 0px), var(--step-offset-y, 0px));
        }

        .paw-notebook-landing .how-step--left {
          justify-content: flex-start;
          align-self: flex-start;
          max-width: 620px;
          margin-top: 0;
        }

        .paw-notebook-landing .how-step--right {
          justify-content: flex-end;
          align-self: flex-end;
          flex-direction: row-reverse;
          max-width: 620px;
          margin-top: 0;
        }

        .paw-notebook-landing .how-step--first {
          margin-top: -28px;
        }

        /* Large Flat Original Icon (138px) + Idle Float + Pop Reveal + Active Wiggle */
        .paw-notebook-landing .how-step__icon-wrap {
          flex: none;
          width: 142px;
          height: 142px;
          position: relative;
          cursor: pointer;
          animation: pcHowIconFloat 4s ease-in-out infinite;
          animation-delay: var(--float-delay, 0s);
        }

        @keyframes pcHowIconFloat {
          0%, 100% { transform: translateY(-6px); }
          50% { transform: translateY(6px); }
        }

        .paw-notebook-landing .how-step__icon-pop {
          width: 100%;
          height: 100%;
          display: block;
          opacity: 0;
          transform: scale(0.6) rotate(calc(var(--icon-rot, 0deg) - 8deg));
          transition:
            opacity 0.5s ease-out,
            transform 0.65s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .paw-notebook-landing .how-step.is-revealed .how-step__icon-pop {
          opacity: 1;
          transform: scale(1) rotate(var(--icon-rot, 0deg));
        }

        .paw-notebook-landing .how-step__icon-wrap:hover .how-step__icon-pop,
        .paw-notebook-landing .how-step.is-active .how-step__icon-pop {
          animation: pcHowIconWiggle 0.65s ease-in-out;
        }

        @keyframes pcHowIconWiggle {
          0%, 100% { transform: scale(1) rotate(var(--icon-rot, 0deg)); }
          25% { transform: scale(1.07) rotate(calc(var(--icon-rot, 0deg) - 6deg)); }
          65% { transform: scale(1.07) rotate(calc(var(--icon-rot, 0deg) + 6deg)); }
        }

        /* Step Text & Inline Demo Block (open, unboxed, protected with soft cream halo) */
        .paw-notebook-landing .how-step__body {
          max-width: 440px;
          position: relative;
          opacity: 0;
          transform: translateX(calc(var(--slide-dir, -1) * var(--how-reveal-dist)));
          transition:
            opacity 0.6s ease-out,
            transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
        }

        .paw-notebook-landing .how-step.is-revealed .how-step__body {
          opacity: 1;
          transform: translateX(0);
        }

        /* Heading Row with Inline Outlined Number ("01", "02"...) as in reference mockup */
        .paw-notebook-landing .how-step__title-row {
          display: flex;
          align-items: baseline;
          gap: 12px;
          margin-bottom: 10px;
        }

        .paw-notebook-landing .how-step__num {
          flex: none;
          display: inline-block;
          font: 700 40px/1 var(--d);
          color: var(--yel);
          -webkit-text-stroke: 2.2px var(--ink);
          paint-order: stroke fill;
          text-shadow: 0 2px 0 var(--ink);
          transform: translateY(18px) rotate(-6deg);
          opacity: 0;
          transition:
            transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 0.08s,
            opacity 0.45s ease-out 0.08s,
            color 0.25s ease;
        }

        .paw-notebook-landing .how-step.is-revealed .how-step__num {
          transform: translateY(0) rotate(0deg);
          opacity: 1;
        }

        .paw-notebook-landing .how-step.is-active .how-step__num {
          color: var(--coral);
        }

        .paw-notebook-landing .how-step h3 {
          font-family: var(--d);
          font-size: clamp(26px, 2.8vw, 38px);
          font-weight: 700;
          line-height: 1.08;
          letter-spacing: -0.02em;
          color: var(--ink);
          max-width: 14em;
          margin: 0;
          text-shadow:
            0 2px 12px var(--bg),
            0 0 22px var(--bg),
            0 0 6px var(--bg);
        }

        .paw-notebook-landing .how-step p {
          color: #4f4a41;
          font-size: 17px;
          line-height: 1.48;
          max-width: 34em;
          margin: 0;
          text-shadow:
            0 1px 10px var(--bg),
            0 0 18px var(--bg);
        }

        /* Inline Interactive Demos (no outer card borders around steps) */
        .paw-notebook-landing .how-demo {
          margin-top: 16px;
          display: inline-flex;
          flex-direction: column;
          gap: 10px;
        }

        .paw-notebook-landing .otp {
          display: inline-flex;
          gap: 8px;
          flex-wrap: wrap;
          cursor: pointer;
          align-items: center;
        }

        .paw-notebook-landing .otp b {
          width: 40px;
          height: 48px;
          border-radius: 11px;
          background: var(--card);
          border: 2px solid var(--ink);
          box-shadow: 0 2px 0 var(--ink);
          display: grid;
          place-items: center;
          font: 600 20px var(--d);
          color: var(--ink);
          transition: transform 0.2s, background 0.2s;
        }

        .paw-notebook-landing .otp b.cur {
          background: var(--yel);
          color: #1A1A1A;
          transform: translateY(-2px);
          box-shadow: 0 4px 0 var(--ink);
        }

        .paw-notebook-landing .chips {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .paw-notebook-landing .chips button {
          font: 600 14.5px var(--b);
          padding: 8px 16px;
          border-radius: 99px;
          border: 2px solid var(--ink);
          background: var(--card);
          color: var(--ink);
          box-shadow: 0 2px 0 var(--ink);
          cursor: pointer;
          transition: transform 0.15s, background 0.15s, box-shadow 0.15s;
        }

        .paw-notebook-landing .chips button:hover {
          transform: translateY(-2px);
        }

        .paw-notebook-landing .chips button:focus-visible,
        .paw-notebook-landing .btn:focus-visible {
          outline: 3px solid var(--coral);
          outline-offset: 3px;
        }

        .paw-notebook-landing .chips button.on {
          background: var(--yel);
          color: #1A1A1A;
        }

        /* Clean Notification Pill Demo for Step 03 (matching reference mockup) */
        .paw-notebook-landing .how-nudge-inline {
          display: flex;
          flex-direction: column;
          gap: 8px;
          background: #ffffff;
          padding: 14px 18px;
          border-radius: 18px;
          box-shadow: 0 4px 16px rgba(26, 26, 26, 0.07);
          max-width: 430px;
        }

        .paw-notebook-landing .how-nudge-inline b {
          font: 700 15px var(--b);
          color: var(--ink);
        }

        .paw-notebook-landing .how-nudge-inline .row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 2px;
        }

        /* Static fallback when data-reduced-motion="true" is active */
        .paw-notebook-landing .how-surface[data-reduced-motion="true"] .how-step__icon-wrap,
        .paw-notebook-landing .how-surface[data-reduced-motion="true"] .how-bubble,
        .paw-notebook-landing .how-surface[data-reduced-motion="true"] .how-pet-eyes-1,
        .paw-notebook-landing .how-surface[data-reduced-motion="true"] .how-pet-eyes-2,
        .paw-notebook-landing .how-surface[data-reduced-motion="true"] .how-pet-eyes-3,
        .paw-notebook-landing .how-surface[data-reduced-motion="true"] .how-float-heart,
        .paw-notebook-landing .how-surface[data-reduced-motion="true"] .how-micro-arrow {
          animation: none !important;
          transition: none !important;
        }

        .paw-notebook-landing .how-surface[data-reduced-motion="true"] .how-step__body,
        .paw-notebook-landing .how-surface[data-reduced-motion="true"] .how-step__icon-pop,
        .paw-notebook-landing .how-surface[data-reduced-motion="true"] .how-step__num,
        .paw-notebook-landing .how-surface[data-reduced-motion="true"] .how-bubble {
          opacity: 1 !important;
          transform: none !important;
        }

        @media (max-width: 768px) {
          .paw-notebook-landing #how {
            --how-line-width: 8px;
            --how-step-gap: 78px;
            --how-curve-h: 56px;
            margin-top: -28px;
          }

          .paw-notebook-landing .how-surface {
            padding: 76px 0 88px;
          }

          .paw-notebook-landing .how-wrap {
            padding: 0 20px;
          }

          .paw-notebook-landing .how-top {
            grid-template-columns: 1fr;
            gap: 28px;
            margin-bottom: 56px;
          }

          .paw-notebook-landing .how-doodle-mid,
          .paw-notebook-landing .how-doodle-cloud {
            display: none;
          }

          .paw-notebook-landing .how-pets-stage {
            justify-self: start;
            max-width: 300px;
          }

          .paw-notebook-landing .how-micro-label {
            margin: -20px 0 28px 16px;
          }

          .paw-notebook-landing .how-watermark {
            font-size: 24vw;
            opacity: 0.55;
          }

          .paw-notebook-landing .how-step,
          .paw-notebook-landing .how-step--right {
            flex-direction: column;
            align-items: flex-start;
            align-self: stretch;
            text-align: left;
            gap: 16px;
            margin-top: 0;
            transform: none !important;
            padding-left: 18px;
          }

          .paw-notebook-landing .how-step__icon-wrap {
            width: 82px;
            height: 82px;
          }
        }

        /* Community Section & Deck */
        .paw-notebook-landing #community,
        .paw-notebook-landing #playdates,
        .paw-notebook-landing .community-section {
          --bg-overlay-opacity: 0.65;
          --bg-video-opacity: 1;
          position: relative;
          overflow: hidden;
          overflow: clip;
          isolation: isolate;
          background: var(--bg);
        }

        .paw-notebook-landing .section-bg,
        .paw-notebook-landing #community .section-bg,
        .paw-notebook-landing #playdates .section-bg,
        .paw-notebook-landing .community-section .section-bg {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
        }

        .paw-notebook-landing .section-bg::after,
        .paw-notebook-landing #community .section-bg::after,
        .paw-notebook-landing #playdates .section-bg::after,
        .paw-notebook-landing .community-section .section-bg::after {
          content: "";
          position: absolute;
          inset: 0;
          background: rgba(255, 247, 229, var(--bg-overlay-opacity, 0.65));
          pointer-events: none;
        }

        :root[data-theme="dark"] .paw-notebook-landing .section-bg::after,
        :root[data-theme="dark"] .paw-notebook-landing #community .section-bg::after,
        :root[data-theme="dark"] .paw-notebook-landing #playdates .section-bg::after,
        :root[data-theme="dark"] .paw-notebook-landing .community-section .section-bg::after,
        .dark .paw-notebook-landing .section-bg::after,
        .dark .paw-notebook-landing #community .section-bg::after,
        .dark .paw-notebook-landing #playdates .section-bg::after,
        .dark .paw-notebook-landing .community-section .section-bg::after {
          background: rgba(20, 19, 17, 0.82);
        }

        .paw-notebook-landing .section-bg video,
        .paw-notebook-landing .section-bg__poster,
        .paw-notebook-landing #community .section-bg video,
        .paw-notebook-landing #playdates .section-bg video,
        .paw-notebook-landing .community-section .section-bg video,
        .paw-notebook-landing #community .section-bg__poster,
        .paw-notebook-landing #playdates .section-bg__poster,
        .paw-notebook-landing .community-section .section-bg__poster {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          object-position: center;
          opacity: var(--bg-video-opacity, 1);
          transition: opacity 350ms ease-in-out;
          pointer-events: none;
        }

        .paw-notebook-landing .section-bg video.is-fading,
        .paw-notebook-landing #community .section-bg video.is-fading,
        .paw-notebook-landing #playdates .section-bg video.is-fading,
        .paw-notebook-landing .community-section .section-bg video.is-fading {
          opacity: calc(var(--bg-video-opacity, 1) * 0.45);
        }

        .paw-notebook-landing #community > .wrap,
        .paw-notebook-landing #playdates > .wrap,
        .paw-notebook-landing .community-section > .wrap {
          position: relative;
          z-index: 1;
        }

        .paw-notebook-landing #community h2,
        .paw-notebook-landing #playdates h2,
        .paw-notebook-landing .community-section h2,
        .paw-notebook-landing #community .sub,
        .paw-notebook-landing #playdates .sub,
        .paw-notebook-landing .community-section .sub,
        .paw-notebook-landing #community .ck h3,
        .paw-notebook-landing #playdates .ck h3,
        .paw-notebook-landing .community-section .ck h3,
        .paw-notebook-landing #community .ck p,
        .paw-notebook-landing #playdates .ck p,
        .paw-notebook-landing .community-section .ck p {
          text-shadow:
            0 1px 10px rgba(255, 247, 229, 0.9),
            0 0 18px rgba(255, 247, 229, 0.75);
        }

        :root[data-theme="dark"] .paw-notebook-landing #community h2,
        :root[data-theme="dark"] .paw-notebook-landing #playdates h2,
        :root[data-theme="dark"] .paw-notebook-landing .community-section h2,
        :root[data-theme="dark"] .paw-notebook-landing #community .sub,
        :root[data-theme="dark"] .paw-notebook-landing #playdates .sub,
        :root[data-theme="dark"] .paw-notebook-landing .community-section .sub,
        :root[data-theme="dark"] .paw-notebook-landing #community .ck h3,
        :root[data-theme="dark"] .paw-notebook-landing #playdates .ck h3,
        :root[data-theme="dark"] .paw-notebook-landing .community-section .ck h3,
        :root[data-theme="dark"] .paw-notebook-landing #community .ck p,
        :root[data-theme="dark"] .paw-notebook-landing #playdates .ck p,
        :root[data-theme="dark"] .paw-notebook-landing .community-section .ck p,
        .dark .paw-notebook-landing #community h2,
        .dark .paw-notebook-landing #playdates h2,
        .dark .paw-notebook-landing .community-section h2,
        .dark .paw-notebook-landing #community .sub,
        .dark .paw-notebook-landing #playdates .sub,
        .dark .paw-notebook-landing .community-section .sub,
        .dark .paw-notebook-landing #community .ck h3,
        .dark .paw-notebook-landing #playdates .ck h3,
        .dark .paw-notebook-landing .community-section .ck h3,
        .dark .paw-notebook-landing #community .ck p,
        .dark .paw-notebook-landing #playdates .ck p,
        .dark .paw-notebook-landing .community-section .ck p {
          text-shadow: 0 1px 10px rgba(20, 19, 17, 0.9);
        }

        .paw-notebook-landing .com {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 70px;
          align-items: center;
        }

        .paw-notebook-landing .deck {
          position: relative;
          height: 500px;
          max-width: 380px;
          margin: auto;
          width: 100%;
        }

        .paw-notebook-landing .pc2 {
          position: absolute;
          inset: 0;
          background: #fff;
          color: #1A1A1A;
          border: 3px solid var(--dk);
          border-radius: 34px;
          overflow: hidden;
          box-shadow: 12px 12px 0 var(--dk);
          transition: transform 0.45s cubic-bezier(0.3, 1.4, 0.5, 1), opacity 0.35s;
        }

        .paw-notebook-landing .pc2 .top {
          height: 62%;
          background: var(--yel);
          position: relative;
          display: grid;
          place-items: center;
          font-size: 130px;
          overflow: hidden;
        }

        .paw-notebook-landing .pc2 .top .deck-pet-img {
          height: 82%;
          width: auto;
          max-width: 82%;
          object-fit: contain;
          margin-top: 24px;
          pointer-events: none;
          user-select: none;
          filter: drop-shadow(0 6px 10px rgba(26, 26, 26, 0.12));
        }

        .paw-notebook-landing .pc2 .top .chip {
          animation: none;
          font-size: 13px;
          padding: 6px 12px;
          left: 16px;
          z-index: 2;
        }

        .paw-notebook-landing .pc2 .bt {
          padding: 18px 22px;
        }

        .paw-notebook-landing .pc2 h3 {
          font-size: 30px;
        }

        .paw-notebook-landing .pc2 small {
          color: #6b665c;
        }

        .paw-notebook-landing .acts {
          position: absolute;
          bottom: -34px;
          left: 0;
          right: 0;
          display: flex;
          justify-content: center;
          gap: 20px;
          z-index: 10;
        }

        .paw-notebook-landing .acts button {
          width: 66px;
          height: 66px;
          border-radius: 50%;
          border: 3px solid var(--dk);
          font-size: 26px;
          cursor: pointer;
          box-shadow: 0 4px 0 var(--dk);
          background: #fff;
          color: #1A1A1A;
          transition: transform 0.15s, box-shadow 0.15s;
        }

        .paw-notebook-landing .acts button:hover {
          transform: scale(1.08);
        }

        .paw-notebook-landing .acts button:last-child {
          background: var(--coral);
          color: #fff;
        }

        .paw-notebook-landing .ck {
          display: flex;
          gap: 16px;
          margin-top: 26px;
        }

        .paw-notebook-landing .ck i {
          flex: none;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: var(--grn);
          color: #fff;
          display: grid;
          place-items: center;
          font-style: normal;
          font-weight: 700;
          font-size: 20px;
        }

        .paw-notebook-landing .ck h3 {
          font-size: 22px;
          margin-bottom: 2px;
        }

        .paw-notebook-landing .ck p {
          color: var(--mut);
          font-size: 16px;
        }

        /* Community Masonry */
        .paw-notebook-landing .mas {
          columns: 4 220px;
          column-gap: 20px;
          margin-top: 60px;
        }

        .paw-notebook-landing .t {
          break-inside: avoid;
          margin-bottom: 20px;
          border: 2.5px solid #1A1A1A;
          border-radius: 28px;
          padding: 22px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          color: #1A1A1A;
          transition: 0.25s;
          position: relative;
          overflow: hidden;
          cursor: pointer;
        }

        .paw-notebook-landing .t:hover {
          transform: scale(1.03) rotate(-1.2deg);
          z-index: 3;
          box-shadow: 8px 8px 0 #1A1A1A;
        }

        .paw-notebook-landing .t em {
          font-style: normal;
          font-size: 84px;
          line-height: 1;
          display: block;
          margin-bottom: auto;
          padding-bottom: 20px;
        }

        .paw-notebook-landing .t b {
          font: 600 21px var(--d);
        }

        .paw-notebook-landing .t span {
          font-size: 14px;
          color: #4a463e;
        }

        /* Trio */
        .paw-notebook-landing .trio {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 22px;
          margin-top: 50px;
        }

        /* Big Cat Band */
        .paw-notebook-landing .band {
          --bg-overlay-opacity: 0.7;
          --bg-video-opacity: 1;
          background: var(--mint);
          color: #1A1A1A;
          border: 3px solid var(--dk);
          border-radius: 48px;
          display: grid;
          grid-template-columns: 1fr 1.1fr;
          align-items: end;
          padding: 50px 50px 0;
          gap: 20px;
          box-shadow: 12px 12px 0 var(--dk);
          position: relative;
          isolation: isolate;
        }

        .paw-notebook-landing .band .card-bg {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          overflow: hidden;
          border-radius: inherit;
          border-radius: calc(48px - 3px);
        }

        .paw-notebook-landing .band .card-bg::after {
          content: "";
          position: absolute;
          inset: 0;
          background: rgba(217, 242, 227, var(--bg-overlay-opacity, 0.7));
          background: linear-gradient(
            90deg,
            rgba(217, 242, 227, calc(var(--bg-overlay-opacity, 0.7) + 0.18)) 0%,
            rgba(217, 242, 227, var(--bg-overlay-opacity, 0.7)) 42%,
            rgba(217, 242, 227, 0.18) 68%,
            rgba(217, 242, 227, 0.06) 100%
          );
          pointer-events: none;
        }

        .paw-notebook-landing .band .card-bg video,
        .paw-notebook-landing .band .card-bg__poster {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          object-position: center;
          opacity: var(--bg-video-opacity, 1);
          transition: opacity 350ms ease-in-out;
          pointer-events: none;
        }

        .paw-notebook-landing .band .card-bg video.is-fading {
          opacity: calc(var(--bg-video-opacity, 1) * 0.45);
        }

        .paw-notebook-landing .band > :not(.card-bg) {
          position: relative;
          z-index: 1;
        }

        .paw-notebook-landing .band h2,
        .paw-notebook-landing .band .sub,
        .paw-notebook-landing .band b,
        .paw-notebook-landing .band > div > span:not(.tag) {
          text-shadow:
            0 1px 10px rgba(217, 242, 227, 0.92),
            0 0 18px rgba(217, 242, 227, 0.8);
        }

        .paw-notebook-landing .bigcat {
          width: 100%;
          display: block;
        }

        /* Testimonials Scrolling Marquee */
        .paw-notebook-landing .row2 {
          overflow: hidden;
          margin: 0 -24px;
          padding: 10px 0;
        }

        .paw-notebook-landing .q {
          display: flex;
          gap: 20px;
          width: max-content;
          animation: pcMq 50s linear infinite;
          padding: 10px 0;
        }

        .paw-notebook-landing .q:hover {
          animation-play-state: paused;
        }

        .paw-notebook-landing .row2:last-child .q {
          animation-direction: reverse;
          animation-duration: 60s;
        }

        .paw-notebook-landing .qc {
          width: 360px;
          border: 2.5px solid var(--ink);
          border-radius: 28px;
          padding: 26px;
          background: var(--card);
          flex: none;
          white-space: normal;
          box-shadow: 4px 4px 0 var(--ink);
        }

        .paw-notebook-landing .qc small {
          font: 600 14px var(--d);
          color: var(--coral);
        }

        .paw-notebook-landing .qc p {
          margin: 8px 0 14px;
          font-size: 17px;
          line-height: 1.45;
        }

        .paw-notebook-landing .qc b {
          font-family: var(--d);
        }

        /* FAQs */
        .paw-notebook-landing .faq {
          max-width: 780px;
          margin: 44px auto 0;
        }

        .paw-notebook-landing details {
          border: 2.5px solid var(--ink);
          border-radius: 24px;
          padding: 20px 26px;
          margin-bottom: 14px;
          background: var(--card);
          cursor: pointer;
          transition: background 0.2s, box-shadow 0.2s;
        }

        .paw-notebook-landing details[open] {
          background: var(--yel);
          color: #1A1A1A;
          box-shadow: 0 5px 0 var(--ink);
        }

        .paw-notebook-landing summary {
          font: 600 21px var(--d);
          list-style: none;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .paw-notebook-landing summary::-webkit-details-marker {
          display: none;
        }

        .paw-notebook-landing summary::after {
          content: "+";
          font-size: 28px;
          line-height: 1;
          transition: transform 0.2s;
        }

        .paw-notebook-landing details[open] summary::after {
          transform: rotate(45deg);
        }

        .paw-notebook-landing details p {
          margin-top: 10px;
          line-height: 1.5;
        }

        /* Final Banner with Popping Box Pet Video */
        .paw-notebook-landing .fin {
          --fin-bg: #F9C552;
          background: var(--fin-bg, var(--yel));
          color: #1A1A1A;
          border: 3px solid var(--dk);
          border-radius: 48px;
          padding: 80px 30px;
          text-align: center;
          box-shadow: 12px 12px 0 var(--dk);
          position: relative;
          overflow: hidden;
        }

        .paw-notebook-landing .fin h2 {
          font-size: clamp(34px, 4.6vw, 62px);
          max-width: 900px;
          margin: 0 auto 28px;
        }

        .paw-notebook-landing .illustration-video {
          width: 100%;
          max-width: 372px;
          aspect-ratio: 16 / 9;
          display: block;
          margin: -20px auto 10px;
          background: var(--fin-bg, var(--yel));
          border-radius: 20px;
          overflow: hidden;
          position: relative;
        }

        .paw-notebook-landing .illustration-video video,
        .paw-notebook-landing .illustration-video__poster {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: contain;
          pointer-events: none;
          transition: opacity 350ms ease-in-out;
          -webkit-mask-image: radial-gradient(ellipse 90% 86% at 50% 50%, #000 70%, transparent 100%);
          mask-image: radial-gradient(ellipse 90% 86% at 50% 50%, #000 70%, transparent 100%);
        }

        .paw-notebook-landing .illustration-video video.is-fading {
          opacity: 0.45;
        }

        /* Floating Butterfly Follower */
        .paw-notebook-landing #fb {
          position: fixed;
          left: 0;
          top: 0;
          width: 44px;
          z-index: 70;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.4s;
        }

        /* Parallax Doodles */
        .paw-notebook-landing .dd {
          position: absolute;
          z-index: 0;
          pointer-events: none;
          will-change: transform;
          --cl: var(--bg, #FFF8E7);
        }

        .paw-notebook-landing .fz {
          display: block;
          width: 100%;
          height: auto;
          animation: pcFzy 6s ease-in-out infinite;
        }

        .paw-notebook-landing .fly { animation: pcFly 11s ease-in-out infinite; }
        .paw-notebook-landing .tw { animation: pcTw 2.4s ease-in-out infinite; }
        .paw-notebook-landing .tw2 { animation: pcTw2 2s ease-in-out infinite; }

        @keyframes pcFly {
          0%, 100% { transform: translate(0, 0) rotate(-8deg); }
          25% { transform: translate(60px, -34px) rotate(10deg); }
          50% { transform: translate(120px, 8px) rotate(-6deg); }
          75% { transform: translate(50px, 44px) rotate(12deg); }
        }

        @keyframes pcTw {
          50% { transform: scale(0.55) rotate(25deg); opacity: 0.6; }
        }

        @keyframes pcTw2 {
          50% { opacity: 0.25; }
        }

        .paw-notebook-landing .wg {
          transform-box: fill-box;
          transform-origin: 100% 55%;
          animation: pcFp 0.32s ease-in-out infinite alternate;
        }
        .paw-notebook-landing .wg.r {
          transform-origin: 0 55%;
        }

        @keyframes pcFp {
          to { transform: scaleX(0.35); }
        }

        .paw-notebook-landing .dw {
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
          animation: pcDraw 3.6s ease-in-out infinite alternate;
        }
        @keyframes pcDraw {
          to { stroke-dashoffset: 0; }
        }

        /* Responsive Breakpoints */
        @media (max-width: 900px) {
          .paw-notebook-landing .hero,
          .paw-notebook-landing .how,
          .paw-notebook-landing .com {
            grid-template-columns: 1fr;
          }
          .paw-notebook-landing .bento {
            grid-template-columns: 1fr;
          }
          .paw-notebook-landing .s2,
          .paw-notebook-landing .s3,
          .paw-notebook-landing .s4 {
            grid-column: auto;
          }
          .paw-notebook-landing .how aside {
            position: static;
          }
          .paw-notebook-landing .step {
            grid-template-columns: 1fr;
            position: static;
          }
          .paw-notebook-landing .trio {
            grid-template-columns: 1fr;
          }
          .paw-notebook-landing .num {
            font-size: 60px;
          }
          .paw-notebook-landing .hero {
            padding: 40px 0 80px;
          }
          .paw-notebook-landing .band {
            grid-template-columns: 1fr;
            padding: 34px 24px 0;
          }
          .paw-notebook-landing .fc {
            width: 100%;
            max-width: 340px;
          }
          .paw-notebook-landing .fc:nth-child(2) {
            margin-top: 0;
          }
          .paw-notebook-landing .dd {
            opacity: 0.5;
          }
        }

        /* Dark Modern Footer */
        .landing-footer {
          background: #121212;
          color: #FAFAFA;
          padding: 70px 0 35px;
          border-top: 1px solid #222222;
          font-family: var(--b);
          position: relative;
          z-index: 2;
        }

        .landing-footer .footer-grid {
          display: grid;
          grid-template-columns: 1.7fr 1fr 1fr 1.2fr;
          gap: 48px;
          align-items: start;
        }

        @media (max-width: 900px) {
          .landing-footer .footer-grid {
            grid-template-columns: 1fr 1fr;
            gap: 36px;
          }
        }

        @media (max-width: 600px) {
          .landing-footer .footer-grid {
            grid-template-columns: 1fr;
            gap: 32px;
          }
        }

        .landing-footer .brand-col {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .landing-footer .brand-logo {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          color: #FFFFFF;
        }

        .landing-footer .brand-logo-badge {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          box-shadow: none;
          border: none;
          flex-shrink: 0;
        }

        .landing-footer .brand-logo-text {
          font-family: var(--d);
          font-size: 26px;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: #FFFFFF;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .landing-footer .brand-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: var(--coral, #FF6B57);
          display: inline-block;
          box-shadow: 0 0 10px rgba(255, 107, 87, 0.7);
        }

        .landing-footer .brand-desc {
          font-size: 14px;
          line-height: 1.55;
          color: #9E9E9E;
          max-width: 300px;
          margin: 0;
        }

        .landing-footer .footer-col {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .landing-footer .col-title {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #8A8A8A;
          margin: 0 0 2px 0;
        }

        .landing-footer .footer-links {
          display: flex;
          flex-direction: column;
          gap: 11px;
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .landing-footer .footer-links a,
        .landing-footer .footer-links button {
          font-size: 14px;
          font-weight: 500;
          color: #E4E4E7;
          text-decoration: none;
          background: none;
          border: none;
          padding: 0;
          text-align: left;
          cursor: pointer;
          font-family: var(--b);
          transition: color 0.15s ease, transform 0.15s ease;
        }

        .landing-footer .footer-links a:hover,
        .landing-footer .footer-links button:hover {
          color: #FFC83D;
          transform: translateX(2px);
        }

        .landing-footer .footer-divider {
          border: none;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          margin: 50px 0 28px;
        }

        .landing-footer .footer-bottom {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #71717A;
        }
      `}</style>

      {/* 1. Animated Ball Preloader */}
      {loading && (
        <div id="ld" className={loaderExiting ? 'go' : ''}>
          <div className="ball"></div>
          <div className="shadow"></div>
          <span>
            fetching your circle… <b>{loadPercent}</b>%
          </span>
        </div>
      )}

      {/* 2. Floating SVG Symbol Definitions */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <symbol id="bf" viewBox="0 0 60 50">
            <g stroke="#1A1A1A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <g className="wg">
                <path d="M30 25C22 6 4 2 4 16c0 9 12 12 26 9z" fill="var(--bfc, #FFC83D)" />
                <path d="M30 25C20 32 10 46 20 46c8 0 10-12 10-21z" fill="var(--bfc, #FFC83D)" />
              </g>
              <g className="wg r">
                <path d="M30 25c8-19 26-23 26-9 0 9-12 12-26 9z" fill="var(--bfc, #FFC83D)" />
                <path d="M30 25c10 7 20 21 10 21-8 0-10-12-10-21z" fill="var(--bfc, #FFC83D)" />
              </g>
              <path d="M30 14v26M30 14c-3-6-6-8-8-8M30 14c3-6 6-8 8-8" fill="none" />
            </g>
          </symbol>
          <symbol id="sp" viewBox="0 0 40 40">
            <path d="M20 2c1 11 7 17 18 18-11 1-17 7-18 18-1-11-7-17-18-18C13 19 19 13 20 2z" fill="currentColor" stroke="#1A1A1A" strokeWidth="2.4" strokeLinejoin="round" />
          </symbol>
          <symbol id="sw" viewBox="0 0 100 70">
            <path className="dw" pathLength="1" d="M10 58C6 24 46 8 66 28c14 15-2 36-20 28-12-5-6-22 6-18M70 54c10 4 20 2 26-6" fill="none" stroke="var(--sc, #FF6B57)" strokeWidth="4" strokeLinecap="round" />
          </symbol>
          <symbol id="cl" viewBox="0 0 140 70">
            <path d="M28 60C8 60 4 38 22 34 20 14 46 8 58 24 66 8 96 12 98 32 120 28 132 56 108 60z" fill="var(--cl, #FFF8E7)" stroke="#1A1A1A" strokeWidth="3" strokeLinejoin="round" />
          </symbol>
          <symbol id="ht" viewBox="0 0 30 28">
            <path d="M15 26C4 18 1 11 5 6c4-4 9-2 10 3 1-5 6-7 10-3 4 5 1 12-10 20z" fill="var(--hc, #FF6B57)" stroke="#1A1A1A" strokeWidth="2.2" strokeLinejoin="round" />
          </symbol>
          <symbol id="dogf" viewBox="0 0 120 120">
            <g stroke="#1A1A1A" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 36c-22 6-24 40-6 54 10-6 18-28 16-50z" fill="var(--ea, #E8A055)" />
              <path d="M98 36c22 6 24 40 6 54-10-6-18-28-16-50z" fill="var(--ea, #E8A055)" />
              <circle cx="60" cy="62" r="40" fill="var(--pf, #fff)" />
              <path d="M44 58q6-8 12 0M68 58q6-8 12 0" fill="none" />
              <ellipse cx="60" cy="74" rx="9" ry="7" fill="#1A1A1A" />
              <path d="M60 81q-6 9-14 5M60 81q6 9 14 5" fill="none" />
              <path d="M56 92q4 14 12 0z" fill="#FF6B57" />
            </g>
          </symbol>
          <symbol id="catf" viewBox="0 0 120 120">
            <g stroke="#1A1A1A" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M24 50L20 14l34 22z" fill="var(--pf, #F2A33A)" />
              <path d="M96 50l4-36-34 22z" fill="var(--pf, #F2A33A)" />
              <circle cx="60" cy="68" r="40" fill="var(--pf, #F2A33A)" />
              <path d="M52 38v12M60 36v14M68 38v12" stroke="#C97A1E" />
              <path d="M42 66q6 8 12 0M66 66q6 8 12 0" fill="none" />
              <path d="M54 78h12l-6 7z" fill="#FFB5C2" />
              <path d="M60 85q-6 8-14 4M60 85q6 8 14 4" fill="none" />
              <path d="M26 78l-18-4M26 86l-18 6M94 78l18-4M94 86l18 6" strokeWidth="3" />
            </g>
          </symbol>
        </defs>
      </svg>

      {/* 4. Butterfly Cursor Follower */}
      <div id="fb" ref={butterflyRef}>
        <svg viewBox="0 0 60 50" style={{ '--bfc': '#FF6B57' }}>
          <use href="#bf" />
        </svg>
      </div>

      {/* 5. Parallax Animated Background Doodles */}
      <div className="dd" data-s="0.05" style={{ top: '7%', left: '3%', width: 64 }}>
        <svg className="fz fly" viewBox="0 0 60 50"><use href="#bf" /></svg>
      </div>
      <div className="dd" data-s="0.03" style={{ top: '5%', left: '46%', width: 34 }}>
        <svg className="fz tw" viewBox="0 0 40 40" style={{ color: '#FFC83D' }}><use href="#sp" /></svg>
      </div>
      <div className="dd" data-s="0.03" style={{ top: '3%', right: '2%', width: 150 }}>
        <svg className="fz" viewBox="0 0 140 70"><use href="#cl" /></svg>
      </div>
      <div className="dd" data-s="0.06" style={{ top: '21%', left: '1%', width: 100 }}>
        <svg className="fz" viewBox="0 0 100 70"><use href="#sw" /></svg>
      </div>
      <div className="dd" data-s="0.07" style={{ top: '27%', right: '4%', width: 58 }}>
        <svg className="fz fly" viewBox="0 0 60 50" style={{ '--bfc': '#FF6B57' }}><use href="#bf" /></svg>
      </div>
      <div className="dd" data-s="0.04" style={{ top: '34%', left: '50%', width: 28 }}>
        <svg className="fz tw" viewBox="0 0 40 40" style={{ color: '#FF6B57' }}><use href="#sp" /></svg>
      </div>
      <div className="dd" data-s="0.03" style={{ top: '42%', left: '-2%', width: 140 }}>
        <svg className="fz" viewBox="0 0 140 70"><use href="#cl" /></svg>
      </div>
      <div className="dd" data-s="0.05" style={{ top: '55%', right: '2%', width: 110 }}>
        <svg className="fz" viewBox="0 0 100 70" style={{ '--sc': '#6C9BE8' }}><use href="#sw" /></svg>
      </div>
      <div className="dd" data-s="0.06" style={{ top: '64%', left: '5%', width: 60 }}>
        <svg className="fz fly" viewBox="0 0 60 50" style={{ '--bfc': '#9DBEF0' }}><use href="#bf" /></svg>
      </div>
      <div className="dd" data-s="0.04" style={{ top: '74%', right: '6%', width: 36 }}>
        <svg className="fz tw" viewBox="0 0 40 40" style={{ color: '#FFC83D' }}><use href="#sp" /></svg>
      </div>
      <div className="dd" data-s="0.05" style={{ top: '84%', right: '10%', width: 56 }}>
        <svg className="fz fly" viewBox="0 0 60 50"><use href="#bf" /></svg>
      </div>
      <div className="dd" data-s="0.03" style={{ top: '90%', left: '4%', width: 130 }}>
        <svg className="fz" viewBox="0 0 140 70"><use href="#cl" /></svg>
      </div>

      <main id="top">
        {/* ========================================================= */}
        {/* SECTION 1: HERO                                           */}
        {/* ========================================================= */}
        <div className="wrap hero">
          <div>
            <h1>
              Your pet’s<br />
              whole world,<br />
              in <mark>one circle.</mark>
            </h1>
            <p className="lead">
              AI meal plans, a one-tap daily diary, vet papers in plain English, and friendly pet parents nearby. Simple enough for a Monday morning.
            </p>
            <div className="cta">
              <button onClick={onOpenOnboarding} className="btn" type="button">
                Create your pet’s profile
              </button>
              <a className="btn ghost" href="#what">
                See how it works ↓
              </a>
            </div>
            <p style={{ marginTop: 22, color: 'var(--mut)', fontSize: 15 }}>
              🔐 Free to start. No password, just your email.
            </p>
          </div>

          {/* Living Illustration Hero Stage */}
          <div className="stage" aria-label="A girl laughing while a cat, a spotted dog, a pink-eared dog and a yellow dog cuddle her in a garden.">
            <div
              ref={heroFrameRef}
              className="living-frame"
              onClick={handleHeroFrameClick}
            >
              {/* Canvas Rendering with Exact #FFF8E7 Yellow Background */}
              <canvas
                ref={heroCanvasRef}
                className="living-video-canvas"
                width={1280}
                height={720}
              />

              {/* Hidden video element driving the animation (no loop, plays once) */}
              <video
                ref={videoARef}
                src="/video.mp4"
                muted
                playsInline
                preload="auto"
                style={{ display: 'none' }}
              />

              {/* Live Overlay SVG (ambient butterflies, clouds, twinkles, spirals) */}
              <svg
                className="living-overlay-svg"
                viewBox="0 0 1280 720"
                preserveAspectRatio="xMidYMid meet"
                aria-hidden="true"
              >
                <defs>
                  <g id="hero-sparkle-sym">
                    <path d="M 0 -18 Q 0 0 -18 0 Q 0 0 0 18 Q 0 0 18 0 Q 0 0 0 -18 Z" fill="currentColor" />
                  </g>
                  <g id="hero-cloud-sym">
                    <g stroke="#2B5288" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="#FFF8E7">
                      <path d="M 14 50 C 26 44, 46 42, 58 43 C 56 25, 74 12, 88 15 C 97 17, 96 28, 89 30 C 82 32, 81 23, 88 20 C 97 16, 111 16, 119 23 C 125 27, 121 35, 115 36 C 112 36, 113 29, 119 27 C 126 25, 136 30, 138 39 C 140 47, 131 51, 119 52 L 95 52 C 85 52, 83 47, 91 47 C 100 47, 98 53, 88 54 L 14 50 Z" />
                    </g>
                  </g>
                </defs>

                {/* 2 Blue Hand-Drawn Doodle Clouds with Yellow #FFF8E7 Interior */}
                <g className="anim-cloud-1" transform="translate(140, 20)">
                  <use href="#hero-cloud-sym" transform="scale(1.2)" />
                </g>
                <g className="anim-cloud-2" transform="translate(940, 30)">
                  <use href="#hero-cloud-sym" transform="scale(1.05)" />
                </g>

                {/* Completed Second Doodle Cloud (top right sky connecting towards butterfly) */}
                <g transform="translate(820, 18)">
                  <g stroke="#2B5288" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="#FFF8E7">
                    <path d="M 10 38 L 260 38" />
                    <path d="M 12 38 C 18 24, 34 14, 48 16 C 58 18, 56 30, 46 31 C 39 32, 38 21, 49 18 C 62 13, 80 13, 90 22 C 96 28, 92 36, 84 35 C 79 34, 80 25, 88 23 C 100 19, 116 20, 126 29 C 132 35, 127 43, 118 42 C 113 41, 114 32, 124 30 C 136 26, 154 27, 164 36 C 172 43, 190 35, 204 32 C 218 30, 236 32, 248 35 C 254 36, 258 37, 260 38" />
                  </g>
                </g>

                {/* 2 Spirals */}
                <g transform="translate(860, 60)">
                  <path
                    className="anim-spiral spiral-1"
                    d="M 0 0 C 14 -12, 34 2, 28 20 C 22 36, -2 32, -6 14 C -10 -2, 10 -16, 26 -8"
                    fill="none"
                    stroke="#FF6B57"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                </g>
                <g transform="translate(260, 110)">
                  <path
                    className="anim-spiral spiral-2"
                    d="M 0 0 C 12 -10, 30 2, 24 18 C 18 32, -2 28, -5 12"
                    fill="none"
                    stroke="#FFA3BC"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </g>

                {/* 5 Twinkling Star Sparkles */}
                <g className="anim-sparkle sp-1" style={{ color: '#FFC83D' }} transform="translate(360, 65)">
                  <use href="#hero-sparkle-sym" />
                </g>
                <g className="anim-sparkle sp-2" style={{ color: '#FF6B57' }} transform="translate(740, 50)">
                  <use href="#hero-sparkle-sym" transform="scale(0.85)" />
                </g>
                <g className="anim-sparkle sp-3" style={{ color: '#DCE8FA' }} transform="translate(220, 80)">
                  <use href="#hero-sparkle-sym" transform="scale(0.75)" />
                </g>
                <g className="anim-sparkle sp-4" style={{ color: '#FFC83D' }} transform="translate(1080, 110)">
                  <use href="#hero-sparkle-sym" transform="scale(1.1)" />
                </g>
                <g className="anim-sparkle sp-5" style={{ color: '#FF6B57' }} transform="translate(640, 35)">
                  <use href="#hero-sparkle-sym" transform="scale(0.8)" />
                </g>

                {/* 2 Flying Looping Butterflies */}
                <g className="anim-butterfly-1">
                  <g className="bf-wing-l">
                    <ellipse cx="-10" cy="-6" rx="12" ry="16" fill="#FFC83D" stroke="#1A1A1A" strokeWidth="2.5" transform="rotate(-25 -10 -6)" />
                  </g>
                  <g className="bf-wing-r">
                    <ellipse cx="10" cy="-6" rx="12" ry="16" fill="#FFC83D" stroke="#1A1A1A" strokeWidth="2.5" transform="rotate(25 10 -6)" />
                  </g>
                  <line x1="0" y1="-14" x2="0" y2="10" stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" />
                </g>
                <g className="anim-butterfly-2">
                  <g className="bf-wing-l">
                    <ellipse cx="-9" cy="-5" rx="10" ry="14" fill="#FF6B57" stroke="#1A1A1A" strokeWidth="2.5" transform="rotate(-25 -9 -5)" />
                  </g>
                  <g className="bf-wing-r">
                    <ellipse cx="9" cy="-5" rx="10" ry="14" fill="#FF6B57" stroke="#1A1A1A" strokeWidth="2.5" transform="rotate(25 9 -5)" />
                  </g>
                  <line x1="0" y1="-12" x2="0" y2="8" stroke="#1A1A1A" strokeWidth="2.5" strokeLinecap="round" />
                </g>
              </svg>

              {/* Floating Hearts spawned on tap/click */}
              {heroHearts.map(h => (
                <div
                  key={h.id}
                  className="pop-heart"
                  style={{ left: `${h.x}px`, top: `${h.y}px` }}
                >
                  {h.emoji}
                </div>
              ))}
            </div>


          </div>
        </div>

        {/* ========================================================= */}
        {/* MARQUEE BAND 1                                            */}
        {/* ========================================================= */}
        <div className="mq">
          <div>
            <span>Safer playdates</span>
            <span>Sitter links</span>
            <span>Meal plans</span>
            <span>Instant daily log</span>
            <span>Vet papers decoded</span>
            <span>Safer playdates</span>
            <span>Sitter links</span>
            <span>Meal plans</span>
            <span>Instant daily log</span>
            <span>Vet papers decoded</span>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECTION 2: BUILT BY PET PEOPLE (FAN CARDS)                */}
        {/* ========================================================= */}
        <section style={{ paddingBottom: 40 }} className="scroll-reveal">
          <div className="wrap">
            <div className="eyebrow" style={{ textAlign: 'center' }}>Professional care, personal touch</div>
            <h2 style={{ textAlign: 'center', maxWidth: 820, margin: '0 auto' }}>
              Of pet people, by pet people, for pet parents.
            </h2>
            <div className="fan scroll-reveal-stagger">
              {/* Card 1: Food made for them */}
              <div
                className="fc"
                style={{ '--r': '-7deg' }}
                onClick={() => setActiveTab('diet-lab')}
                role="button"
                tabIndex={0}
                aria-label="Food made for them. Zero guesswork. Exact portions matched to their age and weight."
              >
                <img
                  src="/fan_card_meals.png"
                  alt="Food made for them - Zero guesswork. Exact portions matched to their age and weight."
                  className="fc-card-img"
                />
              </div>

              {/* Card 2: Done in a tap */}
              <div
                className="fc"
                style={{ '--r': '0deg' }}
                onClick={() => setActiveTab('daily-care')}
                role="button"
                tabIndex={0}
                aria-label="Done in a tap. Zero paperwork. Keep track of meals, walks, and meds with a single click."
              >
                <img
                  src="/fan_card_onetap.png"
                  alt="Done in a tap - Zero paperwork. Keep track of meals, walks, and meds with a single click."
                  className="fc-card-img"
                />
              </div>

              {/* Card 3: Snap and simplify */}
              <div
                className="fc"
                style={{ '--r': '7deg' }}
                onClick={() => setActiveTab('medical-vault')}
                role="button"
                tabIndex={0}
                aria-label="Snap and simplify. Turn complex vet notes and vaccine cards into clear text and automatic reminders."
              >
                <img
                  src="/fan_card_vet.png"
                  alt="Snap and simplify - Turn complex vet notes and vaccine cards into clear text and automatic reminders."
                  className="fc-card-img"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* SECTION 3: BENTO (WHAT WE DO)                             */}
        {/* ========================================================= */}
        {/*
          FFmpeg commands used to prepare the Section 3 looping background video assets:
          - Source video: frontend/src/assets/everythingyourpetneeds.mp4 (1280x720, 24 fps, 10.0s)
          - Scrubbed cut points:
              Segment A: 0.125s to 2.458s (frames 3-58; drops initial reference frames 0-2 and stops right before close-up at frame 59)
              Segment B: 4.125s to 10.000s (frames 99-239; starts on the wide shot right after the giant paw close-up ends at frame 98)
          - Sampled corner cream background colour:
              Median RGB(245, 239, 230) / #F5EFE6 -> normalized R=0.961, G=0.937, B=0.902
              1st-percentile RGB(242, 235, 225) -> normalized R=0.949, G=0.922, B=0.882
              White points set just below sampled background: r='0/0 0.94/1':g='0/0 0.91/1':b='0/0 0.87/1', plus eq=saturation=0.9

          1) Export VP9 WebM (public/bg-run.webm, ~732 KB):
             ffmpeg -i everythingyourpetneeds.mp4 -filter_complex "[0:v]trim=0.125:2.458,setpts=PTS-STARTPTS[a];[0:v]trim=4.125:10,setpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=1:a=0,curves=r='0/0 0.94/1':g='0/0 0.91/1':b='0/0 0.87/1',eq=saturation=0.9,scale=960:-2[v]" -map "[v]" -c:v libvpx-vp9 -crf 36 -b:v 0 -an public/bg-run.webm

          2) Export H.264 MP4 (public/bg-run.mp4, ~892 KB, faststart):
             ffmpeg -i everythingyourpetneeds.mp4 -filter_complex "[0:v]trim=0.125:2.458,setpts=PTS-STARTPTS[a];[0:v]trim=4.125:10,setpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=1:a=0,curves=r='0/0 0.94/1':g='0/0 0.91/1':b='0/0 0.87/1',eq=saturation=0.9,scale=960:-2[v]" -map "[v]" -c:v libx264 -crf 28 -pix_fmt yuv420p -movflags +faststart -an public/bg-run.mp4

          3) Export wide poster frame at 5.0s (public/bg-run-poster.jpg, ~22 KB):
             ffmpeg -ss 5.0 -i everythingyourpetneeds.mp4 -vf "curves=r='0/0 0.94/1':g='0/0 0.91/1':b='0/0 0.87/1',eq=saturation=0.9,scale=960:-2" -frames:v 1 -q:v 3 public/bg-run-poster.jpg
        */}
        <section id="what" ref={whatSectionRef}>
          <span id="board" aria-hidden="true" style={{ display: 'block', position: 'relative', top: '-80px', visibility: 'hidden' }} />
          <div className="bg-run" aria-hidden="true">
            <div className="bg-run__sticky">
              {bgRunPosterOnly ? (
                <img
                  className="bg-run__poster"
                  src="/bg-run-poster.jpg"
                  alt=""
                  decoding="async"
                />
              ) : (
                <video
                  ref={bgRunVideoRef}
                  className="bg-run__video"
                  muted
                  playsInline
                  preload={bgRunSourcesLoaded ? 'metadata' : 'none'}
                  poster="/bg-run-poster.jpg"
                  disablePictureInPicture
                  tabIndex={-1}
                >
                  {bgRunSourcesLoaded && (
                    <>
                      <source src="/bg-run.webm" type="video/webm" />
                      <source src="/bg-run.mp4" type="video/mp4" />
                    </>
                  )}
                </video>
              )}
            </div>
          </div>
          <div className="wrap scroll-reveal">
            <div className="what-header">
              <div className="eyebrow">Gentle routine</div>
              <h2>Everything your pet needs.<br />Nothing you don’t.</h2>
              <p className="sub">Your pet’s whole routine, finally out of your head and into one place.</p>
            </div>

            <div className="bento scroll-reveal-stagger">
              {/* Card 1: Feed them right */}
              <div
                className="c pc s2"
                style={{ background: 'var(--yel)' }}
                onClick={() => setActiveTab('diet-lab')}
              >
                <div className="ic">🥣</div>
                <h3>Feed them right.</h3>
                <p>Get a meal plan with exact portions and calories, built for your pet’s breed, age and weight.</p>
                <div className="big" ref={counterRef}>
                  <span>{calorieCount}</span> <small>kcal / day</small>
                </div>
              </div>

              {/* Card 2: One tap day logged */}
              <div
                className="c s2"
                onClick={() => setActiveTab('daily-care')}
              >
                <div className="ic" style={{ background: 'var(--yel)' }}>👆</div>
                <h3>One tap, day logged.</h3>
                <p>Fed? Walked? Medicine given? Tap once and your diary fills itself in.</p>
                <div className="taps">
                  {[
                    { icon: '🍗', text: 'Breakfast logged · 8:02 am' },
                    { icon: '🐕', text: 'Morning walk logged · 30 min' },
                    { icon: '💧', text: 'Water bowl refilled' },
                    { icon: '💊', text: 'Medicine given · 9:15 am' }
                  ].map((btn, i) => (
                    <button
                      key={i}
                      type="button"
                      className={activeTap === i ? 'on' : ''}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTap(i);
                        setTapLogMessage(`✓ ${btn.text}`);
                      }}
                    >
                      {btn.icon}
                    </button>
                  ))}
                </div>
                <div id="log">{tapLogMessage}</div>
              </div>

              {/* Card 3: Vet papers decoded */}
              <div
                className="c pc s2"
                style={{ background: 'var(--blue)' }}
                onClick={() => setActiveTab('medical-vault')}
              >
                <div className="ic">📋</div>
                <h3>Vet papers, decoded.</h3>
                <p>Snap a prescription or vaccine booklet. We turn it into plain English and reminders.</p>
                <div className="slip">
                  <small>On the slip</small>
                  Bilateral otitis externa
                </div>
                <div className="slip" style={{ opacity: slipEnglishActive ? 1 : 0.35 }}>
                  <small>In plain English</small>
                  A yeast infection in both ears is causing itching.
                </div>
              </div>

              {/* Card 4: Meet your circle */}
              <div
                className="c pc s3"
                style={{ background: 'var(--pink)' }}
                onClick={() => setActiveTab('community')}
              >
                <div className="ic">🐾</div>
                <h3>Meet your circle.</h3>
                <p>Swipe through nearby dogs and cats, match with compatible pet parents, and plan a pack walk.</p>
                <div className="faces">
                  <span style={{ background: '#FFC83D' }}>🐶</span>
                  <span style={{ background: '#fff' }}>🐱</span>
                  <span style={{ background: '#DCE8FA' }}>🐕</span>
                  <span style={{ background: '#D8F2E4' }}>🐈</span>
                  <span style={{ background: '#FF6B57', color: '#fff', fontWeight: 'bold' }}>+12</span>
                </div>
              </div>

              {/* Card 5: Paw AI - Ask Anything */}
              <div
                className="c pc s3 paw-ai-card"
                style={{ background: 'var(--mint)', cursor: 'default' }}
                onClick={() => setActiveTab('medical-vault')}
              >
                <div className="paw-ai-header">
                  <div className="ic" style={{ marginBottom: 0 }}>✨</div>
                  <div className="paw-ai-live-badge">
                    <span className="paw-ai-live-dot"></span>
                    <span>Paw AI · Online</span>
                  </div>
                </div>

                <h3>Paw AI</h3>
                <p>Ask anything about symptoms, food safety, or daily care.</p>

                {/* Search / Question Input */}
                <form
                  className="paw-ai-input-wrap"
                  onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handlePawAiAsk();
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span style={{ fontSize: 17 }}>💬</span>
                  <input
                    type="text"
                    className="paw-ai-input"
                    placeholder="Ask anything... e.g. Can dogs eat blueberries?"
                    value={pawAiQuestion}
                    onChange={(e) => setPawAiQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handlePawAiAsk();
                      }
                    }}
                  />
                  <button
                    type="submit"
                    className="paw-ai-btn"
                    disabled={pawAiLoading}
                  >
                    {pawAiLoading ? 'Thinking...' : 'Ask ➔'}
                  </button>
                </form>

                {/* Quick Suggestion Chips */}
                <div className="paw-ai-chips" onClick={(e) => e.stopPropagation()}>
                  {[
                    { label: '🫐 Blueberries safe?', q: 'Can dogs eat blueberries?' },
                    { label: '🍫 Chocolate toxic?', q: 'Is chocolate toxic to dogs?' },
                    { label: '🐾 Limping paw', q: 'Why is my pet limping after walk?' },
                    { label: '🤧 Cat sneezing', q: 'Why is my cat sneezing a lot?' },
                  ].map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="paw-ai-chip"
                      onClick={() => handlePawAiAsk(chip.q)}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                {/* AI Answer Card or Placeholder */}
                {pawAiAnswer ? (
                  <div className="paw-ai-result" onClick={(e) => e.stopPropagation()}>
                    <div className="paw-ai-result-top">
                      <span className="paw-ai-verdict" style={{ color: pawAiAnswer.badgeColor }}>
                        {pawAiAnswer.verdict}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, background: '#F3F4F6', padding: '2px 8px', borderRadius: 999 }}>
                          {pawAiAnswer.tag}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPawAiAnswer(null)}
                          style={{
                            background: 'none',
                            border: 'none',
                            fontSize: 14,
                            cursor: 'pointer',
                            color: '#7A756A',
                            padding: '0 4px',
                            lineHeight: 1
                          }}
                          title="Close answer"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <p className="paw-ai-result-text">{pawAiAnswer.text}</p>
                    <div className="paw-ai-action-row">
                      <span className="paw-ai-disc">🛡️ Plain English AI vet triage</span>
                      <button
                        type="button"
                        className="paw-ai-open-chat"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTab('medical-vault');
                        }}
                      >
                        Open full AI Chat ➔
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="paw-ai-prompt-hint"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePawAiAsk('Can dogs eat blueberries?');
                    }}
                  >
                    <span>💡 Tap any chip above or type any question to test Paw AI instant triage.</span>
                  </div>
                )}
              </div>

              {/* Card 6: Sitters sorted */}
              <div
                className="c s4"
                style={{ minHeight: 220 }}
                onClick={() => setActiveTab('daily-care')}
              >
                <div className="ic" style={{ background: '#3B82F6', color: '#fff' }}>🔗</div>
                <h3>Sitters, sorted.</h3>
                <p>Share one link. Your sitter sees the routine and logs feeds. No sign-up required for them.</p>
                <div className="link">
                  <span>hawpulse.app/s/cooper-9x2k</span>
                  <button
                    type="button"
                    className="btn mini"
                    style={{ marginLeft: 'auto' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyLink();
                    }}
                  >
                    {copiedLink ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* SECTION 4: HOW IT WORKS (ZIG-ZAG STORYTELLING & LINE)     */}
        {/* ========================================================= */}
        <section id="how" ref={howSectionRef} aria-labelledby="how-heading">
          <div className="how-surface" ref={howSurfaceRef}>
            {/* Scroll-Drawn Coral Line (behind text & icons) */}
            <svg
              className="how-line-svg"
              ref={howSvgRef}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                ref={howPathRef}
                className="how-line-path"
                d="M 0 0"
              />
            </svg>

            <div className="how-wrap">
              {/* Top Row: Left Display Heading + Right Illustrated Pet Trio */}
              <div className="how-top">
                <div className="how-top-left">
                  <span className="tag" style={{ background: 'var(--mint)', color: '#1A1A1A' }}>
                    Easy as fetch.
                  </span>
                  <h2 id="how-heading" ref={howHeadingRef}>
                    How HawPulse works
                  </h2>
                  <p className="how-sub">Four small steps. Then one tap a day.</p>
                  <button onClick={onOpenOnboarding} className="btn" type="button">
                    Start now
                  </button>
                </div>

                {/* Center Decorative Butterfly & Sparkles Doodle */}
                <svg
                  className="how-doodle-mid"
                  viewBox="0 0 120 90"
                  fill="none"
                  aria-hidden="true"
                >
                  {/* Small Pink Butterfly */}
                  <g transform="translate(8, 10) rotate(-18)" stroke="#1A1A1A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 18C10 4 0 4 2 14c1 6 9 7 16 4z" fill="#FFDDD6" />
                    <path d="M18 18C10 24 4 34 12 33c5-1 6-8 6-15z" fill="#FFDDD6" />
                    <path d="M18 18c8-14 18-14 16-4-1 6-9 7-16 4z" fill="#FFDDD6" />
                    <path d="M18 18c8 6 14 16 6 15-5-1-6-8-6-15z" fill="#FFDDD6" />
                    <path d="M18 10v20M18 10c-2-4-5-6-7-6M18 10c2-4 5-6 7-6" />
                  </g>
                  {/* 4-point Sparkles */}
                  <path
                    d="M58 46c1 7 4 10 11 11-7 1-10 4-11 11-1-7-4-10-11-11 7-1 10-4 11-11z"
                    fill="#FFF8E7"
                    stroke="#1A1A1A"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M98 12c0.7 5 3 7.3 8 8-5 0.7-7.3 3-8 8-0.7-5-3-7.3-8-8 5-0.7 7.3-3 8-8z"
                    fill="#FFF8E7"
                    stroke="#1A1A1A"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <path d="M74 38v6M71 41h6" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" />
                </svg>

                {/* Illustrated Scene: Cat & Dog (pawsection.png) with Pointer-Tracking Eyes */}
                <div className="how-pets-stage" ref={howPetsRef} aria-hidden="true">
                  <img
                    src={pawSectionImg}
                    alt=""
                    width="337"
                    height="282"
                    className="how-pets-img"
                  />
                  <svg
                    className="how-pets-eyes-overlay"
                    viewBox="0 0 337 282"
                    fill="none"
                    aria-hidden="true"
                  >
                    {[
                      { cx: 84.5, cy: 159.5 },
                      { cx: 138.5, cy: 148.5 },
                      { cx: 197.5, cy: 132.5 },
                      { cx: 261.0, cy: 143.0 }
                    ].map((eye, idx) => (
                      <g key={idx}>
                        <ellipse
                          ref={(el) => {
                            howEyeBallRefs.current[idx] = el;
                          }}
                          cx={eye.cx}
                          cy={eye.cy}
                          rx="8.1"
                          ry="8.7"
                          fill="#000000"
                        />
                        <g
                          ref={(el) => {
                            howEyePupilRefs.current[idx] = el;
                          }}
                        >
                          <circle cx={eye.cx} cy={eye.cy} r="3.1" fill="#FFFFFF" />
                          <circle
                            cx={eye.cx - 2.2}
                            cy={eye.cy + 2.2}
                            r="1.15"
                            fill="#FFFFFF"
                            opacity="0.82"
                          />
                        </g>
                      </g>
                    ))}
                  </svg>

                  {/* Decorative Line-Art Cloud under Right Pet */}
                  <svg
                    className="how-doodle-cloud"
                    viewBox="0 0 140 70"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M28 58C10 58 6 38 22 34c-2-18 22-24 34-10 8-14 36-10 38 8 20-4 30 22 8 26z"
                      fill="#FFF8E7"
                      stroke="#1A1A1A"
                      strokeWidth="2.4"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>

              {/* Four Zig-Zag Storytelling Steps (<ol> with <li>) */}
              <ol className="how-steps">
                {/* STEP 01: Placed at the foot of the pets (Right side) — zig-zag starts from here */}
                <li
                  className="how-step how-step--right how-step--first"
                  ref={(el) => { howStepRefs.current[0] = el; }}
                  style={{ '--step-offset-x': '-4px', '--step-offset-y': '0px', '--slide-dir': '1' }}
                >
                  <div
                    className="how-step__icon-wrap"
                    ref={(el) => { howStepIconRefs.current[0] = el; }}
                    style={{ '--icon-rot': '-1.5deg', '--float-delay': '0s' }}
                    onClick={onOpenAuth}
                    aria-hidden="true"
                  >
                    <svg className="how-step__icon-pop" viewBox="0 0 142 142" fill="none">
                      {/* Soft ground shadow */}
                      <ellipse cx="66" cy="128" rx="52" ry="9" fill="#DFD9C8" />
                      {/* Sparkles at top-right */}
                      <path
                        d="M116 14c1 7 4 10 11 11-7 1-10 4-11 11-1-7-4-10-11-11 7-1 10-4 11-11z"
                        fill="#FFC83D"
                        stroke="#1A1A1A"
                        strokeWidth="2.2"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M98 10c0.5 4 2 5.5 6 6-4 0.5-5.5 2-6 6-0.5-4-2-5.5-6-6 4-0.5 5.5-2 6-6z"
                        fill="#1A1A1A"
                      />
                      {/* Cream Envelope Body */}
                      <rect
                        x="16"
                        y="32"
                        width="100"
                        height="66"
                        rx="10"
                        fill="#FFF8E7"
                        stroke="#1A1A1A"
                        strokeWidth="2.8"
                      />
                      {/* Bottom fold lines */}
                      <path
                        d="M19 95l36-28M113 95L77 67"
                        stroke="#1A1A1A"
                        strokeWidth="2.6"
                        strokeLinecap="round"
                      />
                      {/* Coral Top Flap */}
                      <path
                        d="M18 35c2-2 5-3 8-3h80c3 0 6 1 8 3L66 72 18 35z"
                        fill="#FF6B57"
                        stroke="#1A1A1A"
                        strokeWidth="2.8"
                        strokeLinejoin="round"
                      />
                      {/* 6-dot code row beneath envelope */}
                      <circle cx="22" cy="111" r="4.5" fill="#FF6B57" stroke="#1A1A1A" strokeWidth="2.2" />
                      <circle cx="40" cy="111" r="4.5" fill="#FF6B57" stroke="#1A1A1A" strokeWidth="2.2" />
                      <circle cx="58" cy="111" r="4.5" fill="#FF6B57" stroke="#1A1A1A" strokeWidth="2.2" />
                      <circle cx="76" cy="111" r="4.5" fill="#FF6B57" stroke="#1A1A1A" strokeWidth="2.2" />
                      <circle cx="94" cy="111" r="4.5" fill="#FFC83D" stroke="#1A1A1A" strokeWidth="2.2" />
                      <circle cx="112" cy="111" r="4.5" fill="#FFF8E7" stroke="#1A1A1A" strokeWidth="2.2" />
                    </svg>
                  </div>

                  <div
                    className="how-step__body"
                    ref={(el) => { howStepTextRefs.current[0] = el; }}
                  >
                    <div className="how-step__title-row">
                      <span className="how-step__num">01</span>
                      <h3>Join with your email.</h3>
                    </div>
                    <p>
                      Enter your email, then the 6-digit code we send you. No password to remember and no social logins.
                    </p>
                    <div className="how-demo">
                      <div className="otp" onClick={onOpenAuth} title="Click to sign in with email">
                        {otpDigits.map((d, i) => (
                          <b key={i} className={i === otpIndex - 1 ? 'cur' : ''}>
                            {i < otpIndex ? d : '•'}
                          </b>
                        ))}
                      </div>
                    </div>
                  </div>
                </li>

                {/* STEP 02: Left-aligned (Pet ID Collar Tag left, Text + Personality Chips right) */}
                <li
                  className="how-step how-step--left"
                  ref={(el) => { howStepRefs.current[1] = el; }}
                  style={{ '--step-offset-x': '8px', '--step-offset-y': '4px', '--slide-dir': '-1' }}
                >
                  <div
                    className="how-step__icon-wrap"
                    ref={(el) => { howStepIconRefs.current[1] = el; }}
                    style={{ '--icon-rot': '2deg', '--float-delay': '0.9s' }}
                    onClick={onOpenOnboarding}
                    aria-hidden="true"
                  >
                    <svg className="how-step__icon-pop" viewBox="0 0 142 142" fill="none">
                      {/* Soft ground shadow */}
                      <ellipse cx="72" cy="130" rx="44" ry="8" fill="#DFD9C8" />
                      {/* Round Cream Pet Tag Disc */}
                      <circle
                        cx="72"
                        cy="80"
                        r="42"
                        fill="#FFF8E7"
                        stroke="#1A1A1A"
                        strokeWidth="2.8"
                      />
                      {/* Top Metal Collar Ring */}
                      <circle cx="72" cy="46" r="5" fill="#FFF8E7" stroke="#1A1A1A" strokeWidth="2.6" />
                      <ellipse
                        cx="72"
                        cy="28"
                        rx="9"
                        ry="15"
                        fill="none"
                        stroke="#1A1A1A"
                        strokeWidth="6"
                      />
                      <ellipse
                        cx="72"
                        cy="28"
                        rx="9"
                        ry="15"
                        fill="none"
                        stroke="#FFF8E7"
                        strokeWidth="2.2"
                      />
                      {/* Coral Paw Print inside Tag */}
                      <path
                        d="M72 78c-10 0-17 7-15 15 1.5 6 8 8 15 8s13.5-2 15-8c2-8-5-15-15-15z"
                        fill="#FF6B57"
                        stroke="#1A1A1A"
                        strokeWidth="2.6"
                      />
                      <ellipse cx="53" cy="73" rx="5.2" ry="6.8" transform="rotate(-20 53 73)" fill="#FF6B57" stroke="#1A1A1A" strokeWidth="2.5" />
                      <ellipse cx="64" cy="64" rx="5.2" ry="7" transform="rotate(-6 64 64)" fill="#FF6B57" stroke="#1A1A1A" strokeWidth="2.5" />
                      <ellipse cx="80" cy="64" rx="5.2" ry="7" transform="rotate(6 80 64)" fill="#FF6B57" stroke="#1A1A1A" strokeWidth="2.5" />
                      <ellipse cx="91" cy="73" rx="5.2" ry="6.8" transform="rotate(20 91 73)" fill="#FF6B57" stroke="#1A1A1A" strokeWidth="2.5" />
                    </svg>
                  </div>

                  <div
                    className="how-step__body"
                    ref={(el) => { howStepTextRefs.current[1] = el; }}
                  >
                    <div className="how-step__title-row">
                      <span className="how-step__num">02</span>
                      <h3>Introduce your pet.</h3>
                    </div>
                    <p>
                      Add their name, breed, age, weight and photos. Pick a few personality traits. Tell us a little about you, too.
                    </p>
                    <div className="how-demo">
                      <div className="chips">
                        {['⚡ Energetic', '🎾 Ball Chaser', '🏞️ Enjoys Lakes', '🛋️ Couch Potato'].map((chip, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className={selectedChips[idx] ? 'on' : ''}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleChip(idx);
                            }}
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </li>

                {/* STEP 03: Right-aligned (Text + Cooper Nudge left, Coral Food Bowl Icon right) */}
                <li
                  className="how-step how-step--right"
                  ref={(el) => { howStepRefs.current[2] = el; }}
                  style={{ '--step-offset-x': '-6px', '--step-offset-y': '-4px', '--slide-dir': '1' }}
                >
                  <div
                    className="how-step__icon-wrap"
                    ref={(el) => { howStepIconRefs.current[2] = el; }}
                    style={{ '--icon-rot': '-2deg', '--float-delay': '1.8s' }}
                    aria-hidden="true"
                  >
                    <svg className="how-step__icon-pop" viewBox="0 0 142 142" fill="none">
                      {/* Soft ground shadow */}
                      <ellipse cx="68" cy="126" rx="54" ry="9" fill="#DFD9C8" />
                      {/* Coral Kibble Mounds in Bowl Opening */}
                      <path
                        d="M32 70c2-12 14-18 24-14 6-8 18-8 24 0 10-4 22 2 24 14z"
                        fill="#FF6B57"
                        stroke="#1A1A1A"
                        strokeWidth="2.6"
                        strokeLinejoin="round"
                      />
                      <circle cx="52" cy="64" r="4" fill="#FF6B57" stroke="#1A1A1A" strokeWidth="2.2" />
                      <circle cx="68" cy="61" r="4.5" fill="#FF6B57" stroke="#1A1A1A" strokeWidth="2.2" />
                      <circle cx="82" cy="65" r="4" fill="#FF6B57" stroke="#1A1A1A" strokeWidth="2.2" />
                      {/* Bowl Rim Ellipse */}
                      <ellipse
                        cx="68"
                        cy="72"
                        rx="40"
                        ry="9"
                        fill="#FFDDD6"
                        stroke="#1A1A1A"
                        strokeWidth="2.6"
                      />
                      {/* Coral Trapezoid Bowl Base */}
                      <path
                        d="M28 72l-12 36c-2 7 18 14 52 14s54-7 52-14l-12-36c-6 6-22 9-40 9s-34-3-40-9z"
                        fill="#FF6B57"
                        stroke="#1A1A1A"
                        strokeWidth="2.8"
                        strokeLinejoin="round"
                      />
                      {/* Paw Emblem on Front of Bowl */}
                      <ellipse cx="68" cy="103" rx="6.5" ry="5" fill="#FFDDD6" stroke="#1A1A1A" strokeWidth="2.2" />
                      <circle cx="59" cy="95" r="2.8" fill="#FFDDD6" stroke="#1A1A1A" strokeWidth="2" />
                      <circle cx="65" cy="92" r="2.8" fill="#FFDDD6" stroke="#1A1A1A" strokeWidth="2" />
                      <circle cx="71" cy="92" r="2.8" fill="#FFDDD6" stroke="#1A1A1A" strokeWidth="2" />
                      <circle cx="77" cy="95" r="2.8" fill="#FFDDD6" stroke="#1A1A1A" strokeWidth="2" />
                      {/* Mint Scalloped Check Badge at Top-Right */}
                      <circle
                        cx="104"
                        cy="54"
                        r="16"
                        fill="#7ED6A0"
                        stroke="#1A1A1A"
                        strokeWidth="2.6"
                      />
                      <path
                        d="M97 54l5 5 10-10"
                        stroke="#FFF8E7"
                        strokeWidth="3.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  <div
                    className="how-step__body"
                    ref={(el) => { howStepTextRefs.current[2] = el; }}
                  >
                    <div className="how-step__title-row">
                      <span className="how-step__num">03</span>
                      <h3>Get a plan. Tap once a day.</h3>
                    </div>
                    <p>
                      One tap builds a meal and grooming plan. Adopt it and we nudge you at mealtimes.
                    </p>
                    <div className="how-demo">
                      <div className="how-nudge-inline">
                        <b>🍗 Breakfast time for Cooper!</b>
                        <div style={{ fontSize: 14.5, color: '#4a463e' }}>{nudgeMessage}</div>
                        <div className="row">
                          <button
                            type="button"
                            className="btn mini"
                            onClick={() => {
                              setIsFed(true);
                              setNudgeMessage('🎉 Logged! Cooper is fed. Next meal at 6:30 pm.');
                            }}
                          >
                            {isFed ? 'Fed ✓' : 'Mark fed'}
                          </button>
                          <button
                            type="button"
                            className="btn mini ghost"
                            style={{ boxShadow: '0 2px 0 var(--ink)' }}
                            onClick={() => setNudgeMessage('Okay, reminding you again in 30 minutes.')}
                          >
                            Snooze 30m
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>

                {/* STEP 04: Left-aligned (Overlapping Hearts + Paw Icon left, Text right) */}
                <li
                  className="how-step how-step--left"
                  ref={(el) => { howStepRefs.current[3] = el; }}
                  style={{ '--step-offset-x': '6px', '--step-offset-y': '4px', '--slide-dir': '-1' }}
                >
                  <div
                    className="how-step__icon-wrap"
                    ref={(el) => { howStepIconRefs.current[3] = el; }}
                    style={{ '--icon-rot': '1.5deg', '--float-delay': '2.6s' }}
                    onClick={() => setActiveTab('community')}
                    aria-hidden="true"
                  >
                    <svg className="how-step__icon-pop" viewBox="0 0 142 142" fill="none">
                      {/* Soft ground shadow */}
                      <ellipse cx="66" cy="126" rx="48" ry="8" fill="#DFD9C8" />
                      {/* Right Coral Heart */}
                      <path
                        d="M78 108C52 90 42 70 50 54c7-12 21-10 26 2 5-12 19-14 26-2 8 16-2 36-24 54z"
                        fill="#FF6B57"
                        stroke="#1A1A1A"
                        strokeWidth="2.8"
                        strokeLinejoin="round"
                      />
                      {/* Left Blush-Pink Heart */}
                      <path
                        d="M48 108C22 90 12 70 20 54c7-12 21-10 26 2 5-12 19-14 26-2 8 16-2 36-24 54z"
                        fill="#FFDDD6"
                        stroke="#1A1A1A"
                        strokeWidth="2.8"
                        strokeLinejoin="round"
                      />
                      {/* Small Cream Paw Print at Center Overlap */}
                      <ellipse cx="63" cy="100" rx="7.5" ry="6" fill="#FFF8E7" stroke="#1A1A1A" strokeWidth="2.4" />
                      <circle cx="53" cy="90" r="3.2" fill="#FFF8E7" stroke="#1A1A1A" strokeWidth="2.2" />
                      <circle cx="60" cy="86" r="3.2" fill="#FFF8E7" stroke="#1A1A1A" strokeWidth="2.2" />
                      <circle cx="67" cy="86" r="3.2" fill="#FFF8E7" stroke="#1A1A1A" strokeWidth="2.2" />
                      <circle cx="74" cy="90" r="3.2" fill="#FFF8E7" stroke="#1A1A1A" strokeWidth="2.2" />
                    </svg>
                  </div>

                  <div
                    className="how-step__body"
                    ref={(el) => { howStepTextRefs.current[3] = el; }}
                  >
                    <div className="how-step__title-row">
                      <span className="how-step__num">04</span>
                      <h3>Find your circle.</h3>
                    </div>
                    <p>
                      Swipe on nearby pets. When two parents like each other, it’s a match. Chat, then plan a pack walk in a public park.
                    </p>
                  </div>
                </li>
              </ol>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* SECTION 5: PLAYDATES, BUT SAFER (DECK & MASONRY)          */}
        {/* ========================================================= */}
        <section id="playdates" className="community-section" ref={communitySectionRef}>
          <div className="section-bg" aria-hidden="true">
            {communityPosterOnly ? (
              <img
                className="section-bg__poster"
                src="/bg-community-poster.webp"
                alt=""
                decoding="async"
              />
            ) : (
              <video
                ref={communityVideoRef}
                src="/bg-community.mp4"
                muted
                playsInline
                preload="auto"
                poster="/bg-community-poster.webp"
                disablePictureInPicture
                tabIndex={-1}
              >
                <source src="/bg-community.mp4" type="video/mp4" />
              </video>
            )}
          </div>
          <div className="wrap scroll-reveal">
            <div className="com">
              <div style={{ paddingBottom: 40 }}>
                {/* 3D Swipeable Stacked Deck */}
                <div className="deck">
                  {[2, 1, 0].map(offset => {
                    const pet = deckPets[(deckIndex + offset) % deckPets.length];
                    const isTop = offset === 0;
                    let transform = `translateY(${offset * 16}px) scale(${1 - offset * 0.05}) rotate(${offset ? (offset % 2 ? 3 : -3) : -2}deg)`;
                    let opacity = 1;

                    if (isTop && swipeOffset) {
                      transform = `translateX(${swipeOffset * 140}%) rotate(${swipeOffset * 20}deg)`;
                      opacity = 0;
                    }

                    return (
                      <div
                        key={`${pet.name}-${offset}`}
                        className="pc2"
                        style={{ transform, opacity }}
                      >
                        <div className="top">
                          <span className="chip" style={{ top: 16 }}>⚡ {pet.tag}</span>
                          <span className="chip" style={{ top: 56, background: '#D8F2E4' }}>💉 Verified Vaccine</span>
                          <img src={pet.img} alt={pet.name} className="deck-pet-img" />
                        </div>
                        <div className="bt">
                          <h3>
                            {pet.name}{' '}
                            <small style={{ font: '500 14px var(--b)', border: '2px solid #ddd', borderRadius: 99, padding: '3px 10px' }}>
                              {pet.breed}
                            </small>
                          </h3>
                          <small>👫 {pet.reg}</small>
                          <br />
                          <small>📍 {pet.loc}</small>
                        </div>
                      </div>
                    );
                  })}

                  {/* Swipe Action Buttons */}
                  <div className="acts">
                    <button type="button" aria-label="Pass" onClick={() => handleDeckSwipe(-1)}>✕</button>
                    <button type="button" aria-label="Like" onClick={() => handleDeckSwipe(1)}>♥</button>
                  </div>
                </div>
                <div style={{ position: 'relative', height: 34 }}></div>
              </div>

              {/* Safety Checklist */}
              <div>
                <span className="tag" style={{ background: 'var(--yel)', color: '#1A1A1A' }}>Community first</span>
                <h2 style={{ marginTop: 16 }}>Playdates, but safer.</h2>
                <p className="sub">Meet friendly pet parents and their furry companions nearby, chat at your own pace, and turn digital chats into real-world hangouts.</p>
                <div className="ck">
                  <i>✓</i>
                  <div>
                    <h3>Neighbourhood circles</h3>
                    <p>Connect easily with fellow dog and cat parents living nearby.</p>
                  </div>
                </div>
                <div className="ck">
                  <i>✓</i>
                  <div>
                    <h3>Real conversations</h3>
                    <p>Chat with people who truly understand the joys of pet parenting.</p>
                  </div>
                </div>
                <div className="ck">
                  <i>✓</i>
                  <div>
                    <h3>Your local pack</h3>
                    <p>Find nearby humans and pets looking for companionship and outdoor fun.</p>
                  </div>
                </div>
                <div className="ck">
                  <i>✓</i>
                  <div>
                    <h3>Friendly chats</h3>
                    <p>Break the ice with custom prompts and plan your next hangout together.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* SECTION 6: THREE PILLARS (NOT A VET)                      */}
        {/* ========================================================= */}
        <section style={{ paddingTop: 20 }}>
          <div className="wrap">
            <div className="eyebrow">Honest by design</div>
            <h2>Not a vet. A very organised friend.</h2>
            <div className="trio scroll-reveal-stagger">
              <div className="c pc" style={{ background: 'var(--blue)', minHeight: 240 }} onClick={() => setActiveTab('daily-care')}>
                <div className="ic">💬</div>
                <h3>Everyday help</h3>
                <p>Paw AI assistant helps for daily care tips, nutrition advice, reading prescriptions, and decoding medical records.</p>
              </div>
              <div className="c pc" style={{ background: 'var(--pink)', minHeight: 240 }} onClick={() => setActiveTab('emergency')}>
                <div className="ic">🚨</div>
                <h3>Instant safety checks</h3>
                <p>Catch urgent warning signs early with fast guidance right when you need it.</p>
              </div>
              <div className="c pc" style={{ background: 'var(--mint)', minHeight: 240 }} onClick={() => setActiveTab('medical-vault')}>
                <div className="ic">🔒</div>
                <h3>Total security</h3>
                <p>Your pet's documents and health logs stay strictly confidential.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* SECTION 7: VACCINE BAND WITH BIG LAUGHING CAT             */}
        {/* ========================================================= */}
        <section style={{ padding: '30px 0' }} className="scroll-reveal">
          <div className="wrap">
            <div className="band scroll-reveal-scale" ref={vetBandRef}>
              <div className="card-bg" aria-hidden="true">
                {vetPosterOnly ? (
                  <img
                    className="card-bg__poster"
                    src="/bg-vet-poster.webp"
                    alt=""
                    decoding="async"
                  />
                ) : (
                  <video
                    ref={vetVideoRef}
                    src="/bg-vet.mp4"
                    muted
                    playsInline
                    preload="auto"
                    poster="/bg-vet-poster.webp"
                    disablePictureInPicture
                    tabIndex={-1}
                  >
                    <source src="/bg-vet.mp4" type="video/mp4" />
                  </video>
                )}
              </div>
              <div style={{ paddingBottom: 50 }}>
                <span className="tag" style={{ background: '#fff' }}>Vet advice, vaccine records & next boosters tracked</span>
                <h2 style={{ marginTop: 16 }}>Full of purrs, free of worry.</h2>
                <p className="sub">Ask Paw AI any question, keep track of recorded prescription details, and follow your exact schedule so you always know when the next booster is due and when the park is safe for little paws.</p>
              </div>

              {/* Right-side animation stage (replaces static orange cat photo with live video animation + floating sparkles/butterfly/heart) */}
              <svg
                className="bigcat"
                viewBox="0 0 520 400"
                fill="none"
                stroke="#1A1A1A"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <use href="#sp" x="40" y="40" width="36" height="36" style={{ color: '#FFC83D' }} className="tw2" />
                <use href="#sp" x="470" y="120" width="28" height="28" style={{ color: '#fff' }} className="tw2" />
                <use href="#bf" x="60" y="90" width="62" height="52" className="fly2" style={{ '--bfc': '#FF6B57' }} />
                <use href="#ht" x="420" y="60" width="26" height="24" className="hrt" />
              </svg>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* SECTION 9: FAQS                                           */}
        {/* ========================================================= */}
        <section style={{ paddingTop: 20 }} className="scroll-reveal">
          <div className="wrap">
            <div className="eyebrow" style={{ textAlign: 'center' }}>Common questions</div>
            <h2 style={{ textAlign: 'center' }}>Frequently asked questions</h2>
            <div className="faq scroll-reveal-stagger">
              <details open={openFaqs[0]} onToggle={() => toggleFaq(0)}>
                <summary>Is HawPulse really free to start?</summary>
                <p>Yes. Join with your email, add your pet and get your first plan without paying.</p>
              </details>
              <details open={openFaqs[1]} onToggle={() => toggleFaq(1)}>
                <summary>Does Paw AI diagnose illnesses?</summary>
                <p>Never. It offers general guidance and helps you prepare questions for your vet.</p>
              </details>
              <details open={openFaqs[2]} onToggle={() => toggleFaq(2)}>
                <summary>Does my sitter need an account?</summary>
                <p>No. Share one link and they can see the routine and log feeds.</p>
              </details>
              <details open={openFaqs[3]} onToggle={() => toggleFaq(3)}>
                <summary>Can strangers see where I live?</summary>
                <p>No. Locations are fuzzy and anchored to public spots like dog runs.</p>
              </details>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* SECTION 10: FINAL CTA (PUPPY IN BOX)                      */}
        {/* ========================================================= */}
        <section style={{ paddingTop: 20 }}>
          <div className="wrap">
            <div className="fin scroll-reveal" ref={finSectionRef}>
              <div
                className="illustration-video"
                role="img"
                aria-label="A puppy popping out of a box"
              >
                {boxpetPosterOnly ? (
                  <img
                    className="illustration-video__poster"
                    src="/boxpet-poster.webp"
                    alt=""
                    decoding="async"
                  />
                ) : (
                  <video
                    ref={boxpetVideoRef}
                    src="/boxpet-video.mp4"
                    muted
                    playsInline
                    preload="auto"
                    poster="/boxpet-poster.webp"
                    disablePictureInPicture
                    tabIndex={-1}
                  >
                    <source src="/boxpet-video.mp4" type="video/mp4" />
                  </video>
                )}
              </div>
              <h2>Ready to meet your circle?</h2>
              <button onClick={onOpenOnboarding} className="btn" type="button" style={{ background: '#1A1A1A', color: '#FFF8E7', boxShadow: '0 5px 0 rgba(0,0,0,0.4)' }}>
                Create your pet’s profile 🐾
              </button>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* FOOTER: MODERN DARK SECTION                               */}
        {/* ========================================================= */}
        <footer className="landing-footer">
          <div className="wrap">
            <div className="footer-grid">
              {/* Brand column */}
              <div className="brand-col">
                <a
                  href="#top"
                  className="brand-logo"
                  onClick={(e) => {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  <div className="brand-logo-badge">
                    <img
                      src="/logo-dark-transparent.png"
                      alt="HawPulse"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <span className="brand-logo-text">
                    hawpulse
                  </span>
                </a>
                <p className="brand-desc">
                  Your pet’s whole world in one place, for cats, dogs &amp; the humans who love them.
                </p>
              </div>

              {/* Column: HAWPULSE */}
              <div className="footer-col">
                <div className="col-title">HAWPULSE</div>
                <div className="footer-links">
                  <a
                    href="#top"
                    onClick={(e) => {
                      e.preventDefault();
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    Home
                  </a>
                  <a href="#what">What we do</a>
                  <a href="#how">How it works</a>
                  <button type="button" onClick={onOpenOnboarding}>
                    Meet your pet circle
                  </button>
                </div>
              </div>

              {/* Column: LEGAL */}
              <div className="footer-col">
                <div className="col-title">LEGAL</div>
                <div className="footer-links">
                  <a
                    href="/privacy"
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveTab('privacy');
                    }}
                  >
                    Privacy
                  </a>
                  <a
                    href="/terms"
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveTab('terms');
                    }}
                  >
                    Terms of use
                  </a>
                </div>
              </div>

              {/* Column: SAY HI */}
              <div className="footer-col">
                <div className="col-title">SAY HI</div>
                <div className="footer-links">
                  <a
                    href="https://www.instagram.com/hawpulse?psln=dzBrNDJrMGg5MGtj&utm_source=qr"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Instagram
                  </a>
                  <a href="mailto:supporthawpulse@gmail.com">
                    supporthawpulse@gmail.com
                  </a>
                </div>
              </div>
            </div>

            <hr className="footer-divider" />

            <div className="footer-bottom">
              <div>© 2026 HAWPULSE</div>
              <div>MADE BY PET PARENTS 🐾 FOR LOVE AND CARE</div>
            </div>
          </div>
        </footer>
      </main>

      {/* Legal Privacy & Terms Modal */}
      {legalModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
          onClick={() => setLegalModal(null)}
        >
          <div
            className="w-full max-w-lg bg-surface-container-lowest rounded-3xl p-6 sm:p-8 border border-outline-variant/40 shadow-2xl relative text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLegalModal(null)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>

            <h3 className="font-headline-lg text-2xl font-bold text-on-surface mb-3">
              {legalModal === 'privacy' ? 'Privacy Policy' : 'Terms of Use'}
            </h3>

            <div className="text-xs sm:text-sm text-on-surface-variant leading-relaxed space-y-3 max-h-[60vh] overflow-y-auto pr-2">
              {legalModal === 'privacy' ? (
                <>
                  <p>
                    <strong>Your privacy is protected by design.</strong> HawPulse never sells your personal information or pet data to third-party brokers.
                  </p>
                  <p>
                    <strong>Location Shield:</strong> Neighborhood radar locations are always fuzz-masked to public park anchor coordinates, never revealing exact residential addresses.
                  </p>
                  <p>
                    <strong>Clinical &amp; Health Records:</strong> Vault prescriptions, vaccination certificates, and clinical triage logs remain completely private to your household unless shared via a temporary Sitter Pass.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    <strong>Acceptance:</strong> By using HawPulse, you agree to treat local pet parents with kindness and maintain a safe environment during community pack walks.
                  </p>
                  <p>
                    <strong>Clinical Disclaimer:</strong> HawPulse AI tools provide educational triage and general wellness coaching. They do not replace hands-on examination, diagnosis, or emergency intervention by a licensed veterinarian.
                  </p>
                  <p>
                    <strong>Safety First:</strong> Users are responsible for verifying their pet’s vaccinations and temperament before joining community meetups.
                  </p>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setLegalModal(null)}
              className="mt-6 w-full py-2.5 rounded-full bg-primary-container text-on-surface font-bold text-sm hover:bg-primary-fixed-dim transition-colors cursor-pointer"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
