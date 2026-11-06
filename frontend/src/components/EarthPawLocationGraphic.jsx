import React from 'react';

/**
 * EarthPawLocationGraphic
 * Renders an animated 3D-styled Earth globe with rotating continents, atmospheric glow,
 * twinkling stars, and a cute paw continuously hopping up and down while traversing
 * across the curved surface of the Earth.
 */
export default function EarthPawLocationGraphic({ selectedCity, discoveryDistance = 10 }) {
  return (
    <div className="relative w-full h-44 sm:h-48 rounded-2xl overflow-hidden border border-amber-900/10 shadow-inner flex flex-col items-center justify-between p-3 select-none bg-gradient-to-b from-[#0d1527] via-[#111c35] to-[#18233e]">
      {/* Background Starfield */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Ambient Warm Nebula Glow */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-72 h-36 bg-amber-400/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/4 w-40 h-28 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>

        {/* Scattered Twinkling Stars */}
        {[
          { top: '12%', left: '8%', delay: '0s', size: 'w-1 h-1' },
          { top: '24%', left: '18%', delay: '0.8s', size: 'w-1.5 h-1.5' },
          { top: '15%', left: '82%', delay: '0.4s', size: 'w-1.5 h-1.5' },
          { top: '35%', left: '92%', delay: '1.2s', size: 'w-1 h-1' },
          { top: '68%', left: '12%', delay: '1.6s', size: 'w-1 h-1' },
          { top: '78%', left: '88%', delay: '0.7s', size: 'w-1.5 h-1.5' },
          { top: '8%', left: '46%', delay: '1.1s', size: 'w-1 h-1' },
          { top: '48%', left: '5%', delay: '0.3s', size: 'w-1 h-1' },
          { top: '55%', left: '95%', delay: '1.5s', size: 'w-1 h-1' },
        ].map((star, i) => (
          <div
            key={i}
            className={`absolute rounded-full bg-white shadow-xs ${star.size} animate-star-twinkle`}
            style={{
              top: star.top,
              left: star.left,
              animationDelay: star.delay,
            }}
          />
        ))}

        {/* Subtle Orbit / Horizon Arc */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none opacity-20"
          viewBox="0 0 400 190"
          fill="none"
          preserveAspectRatio="none"
        >
          <path
            d="M -20 160 Q 200 40 420 160"
            stroke="url(#orbitGradient)"
            strokeWidth="1.5"
            strokeDasharray="4 6"
          />
          <defs>
            <linearGradient id="orbitGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
              <stop offset="50%" stopColor="#fcd34d" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Main Center Stage: 3D Earth Globe + Walking Hopping Paw */}
      <div className="relative z-10 w-full flex-1 flex items-center justify-center">
        <div className="relative w-36 h-36 flex items-center justify-center">
          {/* Outer Earth Atmosphere Glow */}
          <div className="absolute w-32 h-32 rounded-full bg-sky-400/25 blur-xl pointer-events-none animate-pulse"></div>
          <div className="absolute w-28 h-28 rounded-full bg-emerald-400/15 blur-lg pointer-events-none"></div>

          {/* SVG Earth Globe */}
          <svg
            className="w-28 h-28 drop-shadow-[0_8px_20px_rgba(0,0,0,0.5)]"
            viewBox="0 0 120 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* Globe Clipping Circle */}
              <clipPath id="earthGlobeClip">
                <circle cx="60" cy="60" r="48" />
              </clipPath>

              {/* Ocean Gradient (Deep Navy to Azure Tropical Blue) */}
              <radialGradient id="oceanGrad" cx="42%" cy="38%" r="65%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="35%" stopColor="#0284c7" />
                <stop offset="70%" stopColor="#0369a1" />
                <stop offset="100%" stopColor="#0f2b5c" />
              </radialGradient>

              {/* 3D Sphere Shading (Light source at top-left, deep shadow at bottom-right) */}
              <radialGradient id="sphereShade" cx="35%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
                <stop offset="40%" stopColor="#ffffff" stopOpacity="0" />
                <stop offset="75%" stopColor="#030712" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#020617" stopOpacity="0.85" />
              </radialGradient>

              {/* Specular Rim Light */}
              <linearGradient id="rimLight" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
              </linearGradient>

              {/* Landmass Shading Pattern */}
              <linearGradient id="landGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="60%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
            </defs>

            {/* Atmosphere Halo Ring */}
            <circle
              cx="60"
              cy="60"
              r="49.5"
              fill="none"
              stroke="url(#rimLight)"
              strokeWidth="2.5"
              opacity="0.85"
            />

            {/* Earth Content Clipped to Globe Sphere */}
            <g clipPath="url(#earthGlobeClip)">
              {/* Ocean Base */}
              <circle cx="60" cy="60" r="48" fill="url(#oceanGrad)" />

              {/* Graticule Latitude & Longitude Lines (Curved 3D Grid) */}
              <g stroke="rgba(255, 255, 255, 0.15)" strokeWidth="0.75" fill="none">
                {/* Equator */}
                <ellipse cx="60" cy="60" rx="48" ry="12" strokeDasharray="3 2" />
                {/* Northern Latitudes */}
                <ellipse cx="60" cy="38" rx="43" ry="9" strokeDasharray="2 3" />
                {/* Southern Latitudes */}
                <ellipse cx="60" cy="82" rx="43" ry="9" strokeDasharray="2 3" />
                {/* Prime Meridian & Longitudes */}
                <ellipse cx="60" cy="60" rx="16" ry="48" />
                <ellipse cx="60" cy="60" rx="34" ry="48" />
              </g>

              {/* Rotating Continents (Two identical sets seamless infinite scroll) */}
              <g className="animate-earth-rotate" fill="url(#landGrad)" opacity="0.95">
                {/* Continent Set 1 */}
                <g transform="translate(0, 0)">
                  {/* North America */}
                  <path d="M 12 32 Q 22 24 35 28 Q 42 36 34 46 Q 24 48 18 40 Z" />
                  <path d="M 32 46 Q 36 50 34 56 Q 30 58 28 52 Z" />
                  {/* Greenland */}
                  <path d="M 40 18 Q 48 16 52 22 Q 46 26 38 23 Z" />
                  {/* South America */}
                  <path d="M 30 62 Q 38 60 42 68 Q 40 82 34 94 Q 28 88 28 74 Z" />
                  {/* Europe */}
                  <path d="M 64 26 Q 72 24 76 30 Q 74 38 66 36 Q 60 32 64 26 Z" />
                  <circle cx="60" cy="28" r="2.5" /> {/* UK */}
                  {/* Africa */}
                  <path d="M 66 44 Q 80 44 82 54 Q 84 70 76 84 Q 68 82 66 66 Q 62 56 66 44 Z" />
                  <circle cx="86" cy="74" r="2" /> {/* Madagascar */}
                  {/* Asia */}
                  <path d="M 78 24 Q 96 20 114 28 Q 118 42 108 52 Q 94 48 88 38 Q 80 36 78 24 Z" />
                  <path d="M 94 48 Q 100 48 102 58 Q 96 62 92 56 Z" /> {/* India */}
                  {/* Australia & Oceania */}
                  <path d="M 104 74 Q 118 72 118 84 Q 112 92 104 88 Q 100 80 104 74 Z" />
                </g>

                {/* Continent Set 2 (Seamless Offset by 130px) */}
                <g transform="translate(130, 0)">
                  {/* North America */}
                  <path d="M 12 32 Q 22 24 35 28 Q 42 36 34 46 Q 24 48 18 40 Z" />
                  <path d="M 32 46 Q 36 50 34 56 Q 30 58 28 52 Z" />
                  {/* Greenland */}
                  <path d="M 40 18 Q 48 16 52 22 Q 46 26 38 23 Z" />
                  {/* South America */}
                  <path d="M 30 62 Q 38 60 42 68 Q 40 82 34 94 Q 28 88 28 74 Z" />
                  {/* Europe */}
                  <path d="M 64 26 Q 72 24 76 30 Q 74 38 66 36 Q 60 32 64 26 Z" />
                  <circle cx="60" cy="28" r="2.5" />
                  {/* Africa */}
                  <path d="M 66 44 Q 80 44 82 54 Q 84 70 76 84 Q 68 82 66 66 Q 62 56 66 44 Z" />
                  <circle cx="86" cy="74" r="2" />
                  {/* Asia */}
                  <path d="M 78 24 Q 96 20 114 28 Q 118 42 108 52 Q 94 48 88 38 Q 80 36 78 24 Z" />
                  <path d="M 94 48 Q 100 48 102 58 Q 96 62 92 56 Z" />
                  {/* Australia */}
                  <path d="M 104 74 Q 118 72 118 84 Q 112 92 104 88 Q 100 80 104 74 Z" />
                </g>
              </g>

              {/* Drifting Clouds Layer */}
              <g className="animate-clouds-drift" fill="#ffffff" opacity="0.32">
                <g transform="translate(0, 0)">
                  <path d="M 18 36 Q 28 32 38 36 Q 44 42 34 44 Q 22 46 18 36 Z" />
                  <path d="M 60 22 Q 74 18 86 24 Q 80 28 66 26 Z" />
                  <path d="M 52 64 Q 68 58 78 66 Q 68 74 54 70 Z" />
                  <path d="M 88 42 Q 102 38 112 44 Q 102 50 90 48 Z" />
                  <path d="M 98 80 Q 110 76 116 82 Q 108 88 98 84 Z" />
                </g>
                <g transform="translate(130, 0)">
                  <path d="M 18 36 Q 28 32 38 36 Q 44 42 34 44 Q 22 46 18 36 Z" />
                  <path d="M 60 22 Q 74 18 86 24 Q 80 28 66 26 Z" />
                  <path d="M 52 64 Q 68 58 78 66 Q 68 74 54 70 Z" />
                  <path d="M 88 42 Q 102 38 112 44 Q 102 50 90 48 Z" />
                  <path d="M 98 80 Q 110 76 116 82 Q 108 88 98 84 Z" />
                </g>
              </g>

              {/* Polar Ice Caps */}
              <ellipse cx="60" cy="14" rx="22" ry="5" fill="#f8fafc" opacity="0.75" />
              <ellipse cx="60" cy="106" rx="20" ry="4" fill="#f8fafc" opacity="0.7" />

              {/* 3D Sphere Shading Overlay (Light & Shadow curvature) */}
              <circle cx="60" cy="60" r="48" fill="url(#sphereShade)" />

              {/* Glassy Specular Gloss Arc on Top Hemisphere */}
              <ellipse
                cx="52"
                cy="32"
                rx="28"
                ry="14"
                fill="#ffffff"
                opacity="0.22"
                transform="rotate(-20 52 32)"
              />
            </g>
          </svg>

          {/* Paw Footprints Along the Curvature of Earth */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {[-24, -12, 0, 12, 24].map((deg, i) => (
              <div
                key={i}
                className="absolute text-amber-300/40 animate-footprint-glow pointer-events-none"
                style={{
                  transform: `rotate(${deg}deg) translateY(-46px) rotate(${-deg}deg)`,
                  animationDelay: `${i * 0.4}s`,
                }}
              >
                <span className="material-symbols-outlined text-[10px]">pets</span>
              </div>
            ))}
          </div>

          {/* 
            Traversing Paw Arm (moves back and forth along the round curve of Earth)
            The arm rotates between -26deg and +26deg.
            Inside, the Paw hops continuously up and down off the surface!
          */}
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none animate-paw-traverse"
            style={{ transformOrigin: '50% 50%' }}
          >
            {/* The Paw Pin positioned exactly at the top curvature of Earth */}
            <div
              className="relative flex flex-col items-center animate-paw-hop"
              style={{ transform: 'translateY(-48px)' }}
            >
              {/* Radar Discovery Ripple Wave (pulses from the point of contact on Earth) */}
              <div className="absolute top-8 w-10 h-10 rounded-full border-2 border-amber-400/80 bg-amber-400/20 animate-paw-pulse pointer-events-none"></div>

              {/* Paw Marker Badge */}
              <div className="relative z-20 w-11 h-11 rounded-full bg-gradient-to-tr from-amber-400 via-amber-300 to-yellow-200 text-stone-900 flex items-center justify-center shadow-[0_4px_16px_rgba(245,158,11,0.6)] border-2 border-white">
                <span className="material-symbols-outlined text-[22px] drop-shadow-xs select-none">
                  pets
                </span>
                {/* Tiny Sparkle Badge on Paw */}
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-400 border border-white"></span>
                </span>
              </div>

              {/* Marker Pointer Pin (touching the Earth horizon) */}
              <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[7px] border-t-amber-400 -mt-0.5 filter drop-shadow-xs"></div>

              {/* Soft landing shadow on Earth surface */}
              <div className="w-4 h-1.5 rounded-full bg-black/40 blur-[1px] mt-0.5"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Bottom Location Badge Pill */}
      <div className="relative z-20 px-3.5 py-1.5 rounded-full bg-slate-900/85 backdrop-blur-md border border-white/20 text-xs font-semibold text-white shadow-lg flex items-center gap-2 max-w-[90%] truncate">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="truncate tracking-wide text-[11px] sm:text-xs">
          {selectedCity || 'Location not set'} • {discoveryDistance} km radius
        </span>
      </div>
    </div>
  );
}
