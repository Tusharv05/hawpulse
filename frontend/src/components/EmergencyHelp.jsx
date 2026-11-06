import React, { useState } from 'react';
import { getStoredUser, getStoredActivePet } from '../services/api';

export default function EmergencyHelp({ setActiveTab }) {
  const [toxicSearch, setToxicSearch] = useState('');
  const [selectedSymptom, setSelectedSymptom] = useState(null);
  const user = getStoredUser();
  const activePet = getStoredActivePet();
  const petName = activePet?.name || 'your pet';
  const userRegion = user?.area_neighborhood ? `${user.area_neighborhood}, ${user.city}` : (user?.city || 'Your Area');

  const emergencyContacts = [
    {
      name: "Amritsar 24/7 Pet Emergency Hospital",
      doctor: "Dr. Vikram Dogra & Emergency Team",
      distance: "1.2 km away • Model Town",
      phone: "+91 98765 43210",
      address: "SCO 42, B-Block Market, Model Town, Amritsar",
      open: "Open 24 Hours • Emergency Trauma Ward"
    },
    {
      name: "Punjab Veterinary University Polyclinic",
      doctor: "On-Duty Clinical Surgeons",
      distance: "3.5 km away • Mall Road",
      phone: "+91 98140 12345",
      address: "Near Circuit House, Mall Road, Amritsar",
      open: "24/7 Critical Care & Blood Bank"
    }
  ];

  const symptoms = [
    {
      id: 1,
      title: "Trouble breathing",
      priority: "Priority 1",
      icon: "pulmonology",
      desc: "Heavy panting without exercise, blue or porcelain pale gums, audible gasping, or neck rigidly extended to pull air.",
      tip: "Oxygen starvation risk: keep completely calm, do not compress chest."
    },
    {
      id: 2,
      title: "Collapse or can't stand",
      priority: "Priority 1",
      icon: "personal_injury",
      desc: "Sudden limb weakness, extreme unresponsiveness, staggering, glassy eyes, or complete loss of consciousness.",
      tip: "Possible internal bleed, anaphylactic shock, or cardiac event. Transport flat."
    },
    {
      id: 3,
      title: "Seizures or tremors",
      priority: "Priority 1",
      icon: "neurology",
      desc: "Continuous shaking, involuntary limb paddling, rigid stiffness, or multiple twitching episodes exceeding 2 minutes.",
      tip: "Keep hands away from mouth; cushion head and clear hard objects."
    },
    {
      id: 4,
      title: "Swollen belly (Bloat / GDV)",
      priority: "Immediate Danger",
      icon: "crisis_alert",
      highlight: true,
      desc: "Unproductive retching/dry heaving, distended hard stomach, extreme pacing. High risk in Golden Retrievers.",
      tip: "Stomach torsion kills within 2 hours: drive to clinic immediately."
    },
    {
      id: 5,
      title: "Ate something toxic",
      priority: "Toxic Hazard",
      icon: "skull",
      desc: "Dark chocolate, raisins, sugar-free xylitol gum, lilies, rat bait, paracetamol, ibuprofen, or garden fertilizers.",
      tip: "Bring packaging, wrapper, or plant leaf sample to the vet."
    },
    {
      id: 6,
      title: "Heavy bleeding or trauma",
      priority: "Priority 1",
      icon: "emergency",
      desc: "Arterial spurting, bleeding that won't stop with 3 minutes of direct pressure, hit by car, or deep bite wound.",
      tip: "Apply clean cloth with firm continuous pressure. Do not lift cloth to peek."
    }
  ];

  return (
    <div className="w-full max-w-[1140px] mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
      {/* Top Triage Alert Ribbon */}
      <div className="relative overflow-hidden rounded-2xl bg-secondary-fixed/50 border-2 border-secondary p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-secondary text-white flex items-center justify-center shrink-0 shadow-md">
            <span className="material-symbols-outlined text-[30px]">e911_emergency</span>
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white text-secondary font-label-sm text-xs uppercase tracking-wide font-extrabold mb-1 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-secondary animate-ping"></span>
              24/7 Veterinary Emergency Protocol Active
            </div>
            <p className="font-body-md text-base text-on-surface font-bold">
              {userRegion} Region Triage Active
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <a
            href="tel:+919876543210"
            className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-secondary text-white font-label-md text-sm font-bold hover:brightness-110 active:scale-95 transition-all shadow-md"
          >
            <span className="material-symbols-outlined text-[20px]">call</span>
            <span>Call Nearest 24/7 Vet Now</span>
          </a>
        </div>
      </div>

      {/* Page Header */}
      <div>
        <div className="flex items-center gap-1.5 text-secondary font-label-sm text-xs uppercase tracking-wider font-bold mb-1">
          <span className="material-symbols-outlined text-[16px]">health_and_safety</span>
          <span>Immediate Clinical Triage</span>
        </div>
        <h1 className="font-headline-lg text-3xl sm:text-4xl font-bold text-on-surface tracking-tight mb-2">
          Is this an emergency?
        </h1>
        <p className="font-body-lg text-base text-on-surface-variant max-w-3xl leading-relaxed">
          Call an emergency vet immediately if {petName} shows any of these critical red-flag signs. Minutes matter during acute trauma, respiratory collapse, or toxin ingestion.
        </p>
      </div>

      {/* Critical Symptoms Grid */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-label-lg text-base font-bold text-on-surface">Critical Symptoms Checklist</span>
            <span className="px-3 py-0.5 rounded-full bg-secondary text-white font-label-sm text-xs font-bold">
              Requires Instant Action
            </span>
          </div>
          <span className="text-xs text-outline hidden sm:inline">Tap symptom for quick triage notes</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {symptoms.map(s => (
            <div
              key={s.id}
              onClick={() => setSelectedSymptom(selectedSymptom === s.id ? null : s.id)}
              className={`rounded-2xl p-6 border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between gap-4 ${
                s.highlight
                  ? 'bg-secondary-fixed/40 border-secondary shadow-md'
                  : 'bg-surface-container-lowest border-outline-variant/40 shadow-xs hover:shadow-md'
              }`}
            >
              <div className="absolute top-0 left-0 w-1.5 h-full bg-secondary"></div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-secondary">
                    <span className="material-symbols-outlined text-[22px]">{s.icon}</span>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-secondary-fixed text-secondary">
                    {s.priority}
                  </span>
                </div>
                <h3 className="font-headline-sm text-base font-bold text-on-surface mb-1">{s.title}</h3>
                <p className="font-body-sm text-xs text-on-surface-variant leading-relaxed">
                  {s.desc}
                </p>
              </div>

              <div className="pt-2 border-t border-outline-variant/20 text-xs font-semibold text-secondary flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">warning</span>
                <span>{s.tip}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3 Strict First Aid Rules */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 border border-outline-variant/40 shadow-xs flex flex-col gap-6">
        <div>
          <span className="text-xs font-bold text-outline uppercase tracking-wider">Crucial Pre-Hospital Rules</span>
          <h3 className="font-headline-lg text-2xl font-bold text-on-surface mt-1">What to do while heading to the vet</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-2">
            <div className="w-10 h-10 rounded-full bg-error-container text-on-error-container flex items-center justify-center font-bold">
              1
            </div>
            <h4 className="font-headline-sm text-sm font-bold text-on-surface">Do not induce vomiting</h4>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Unless explicitly instructed by a licensed veterinarian. Caustic toxins, bleach, or batteries cause severe burning to the esophagus on the way back up.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-2">
            <div className="w-10 h-10 rounded-full bg-primary-container text-on-surface flex items-center justify-center font-bold">
              2
            </div>
            <h4 className="font-headline-sm text-sm font-bold text-on-surface">Keep warm &amp; calm</h4>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Shock drops core body temperature rapidly. Wrap {petName} in a clean blanket, speak in low calm voices, and minimize movement in the car.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-2">
            <div className="w-10 h-10 rounded-full bg-tertiary-container text-on-tertiary-container flex items-center justify-center font-bold">
              3
            </div>
            <h4 className="font-headline-sm text-sm font-bold text-on-surface">Transport strictly flat</h4>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              If GDV bloat, spinal injury, or unconsciousness is suspected, carry your pet on a flat wooden board, blanket stretcher, or firm cardboard base.
            </p>
          </div>
        </div>
      </div>

      {/* Emergency Vet Clinics in Amritsar */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 border border-outline-variant/40 shadow-xs flex flex-col gap-6">
        <div>
          <span className="text-xs font-bold text-outline uppercase tracking-wider">Nearby Emergency Services</span>
          <h3 className="font-headline-lg text-2xl font-bold text-on-surface mt-1">24/7 Emergency Animal Hospitals in Amritsar</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {emergencyContacts.map((clinic, index) => (
            <div key={index} className="p-5 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col justify-between gap-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-start">
                  <h4 className="font-headline-sm text-base font-bold text-on-surface">{clinic.name}</h4>
                  <span className="px-2.5 py-0.5 rounded-full bg-tertiary-container text-on-tertiary-container text-[11px] font-bold shrink-0">
                    {clinic.open.split('•')[0].trim()}
                  </span>
                </div>
                <span className="text-xs font-medium text-outline">{clinic.doctor}</span>
                <span className="text-xs text-on-surface-variant flex items-center gap-1 mt-1">
                  <span className="material-symbols-outlined text-[16px] text-primary">place</span>
                  {clinic.address} ({clinic.distance})
                </span>
              </div>

              <div className="flex gap-2 pt-2 border-t border-outline-variant/20">
                <a
                  href={`tel:${clinic.phone}`}
                  className="flex-1 h-10 rounded-full bg-secondary text-white font-bold text-xs flex items-center justify-center gap-1.5 hover:brightness-110 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">call</span>
                  <span>{clinic.phone}</span>
                </a>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(clinic.name + " " + clinic.address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 h-10 rounded-full border border-outline-variant text-on-surface font-semibold text-xs flex items-center justify-center gap-1 hover:bg-surface-container transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">directions</span>
                  <span>Directions</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
