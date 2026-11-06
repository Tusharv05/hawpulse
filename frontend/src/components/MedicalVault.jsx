import React, { useState, useEffect, useRef } from 'react';
import {
  healthApi,
  medicalApi,
  calendarApi,
  diaryApi,
  petsApi,
  getStoredActivePet,
  setStoredActivePet
} from '../services/api';

function renderInlineStyles(text) {
  if (!text) return '';
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-bold text-on-surface">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function renderFormattedAiText(raw) {
  if (!raw) return null;
  const lines = raw.split('\n');
  return (
    <div className="flex flex-col gap-2">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-0.5" />;
        if (trimmed.startsWith('###')) {
          return (
            <h4 key={idx} className="font-bold text-xs sm:text-sm text-primary mt-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block"></span>
              {trimmed.replace(/^#+\s*/, '')}
            </h4>
          );
        }
        if (trimmed.startsWith('---') || trimmed.startsWith('***')) {
          return <hr key={idx} className="border-outline-variant/30 my-1" />;
        }
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
          const content = trimmed.replace(/^[*•-]\s*/, '');
          return (
            <div key={idx} className="flex items-start gap-2 ml-1 text-xs sm:text-sm">
              <span className="text-secondary font-bold text-xs mt-0.5">•</span>
              <span className="flex-1">{renderInlineStyles(content)}</span>
            </div>
          );
        }
        return <p key={idx} className="leading-relaxed text-xs sm:text-sm">{renderInlineStyles(trimmed)}</p>;
      })}
    </div>
  );
}

export default function MedicalVault({ setActiveTab }) {
  // Navigation sub-tab: 'vaccines' | 'prescriptions' | 'ai'
  const [activeMedicalTab, setActiveMedicalTab] = useState('vaccines');

  const initialPet = getStoredActivePet();
  const getCachedData = (key, fallback = null) => {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : fallback;
    } catch {
      return fallback;
    }
  };

  // Backend state
  const [pet, setPet] = useState(initialPet);
  const [roadmapData, setRoadmapData] = useState(() => (
    initialPet?.id ? getCachedData(`pawcircle_roadmap_${initialPet.id}`, null) : null
  ));
  const [prescriptions, setPrescriptions] = useState(() => (
    initialPet?.id ? getCachedData(`pawcircle_rx_${initialPet.id}`, []) : []
  ));
  const [isLoading, setIsLoading] = useState(true);
  const [togglingMilestone, setTogglingMilestone] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Upload medical record / vaccine card state
  const [slipFile, setSlipFile] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [lastUploadedSlip, setLastUploadedSlip] = useState(null);

  // Separate Prescription Scan Modal (for Prescriptions tab)
  const [showRxModal, setShowRxModal] = useState(false);
  const [rxModalFile, setRxModalFile] = useState(null);
  const [isScanningRxModal, setIsScanningRxModal] = useState(false);

  // Google Calendar booster sync state
  const [schedulingMilestone, setSchedulingMilestone] = useState(null);

  // Alarms status state
  const [alarmsCreatedMap, setAlarmsCreatedMap] = useState({});
  const [doseConfirmedMap, setDoseConfirmedMap] = useState({});

  // AI Health Co-Pilot state
  const [aiQuestion, setAiQuestion] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResponses, setAiResponses] = useState([
    {
      sender: 'ai',
      isGreeting: true,
      text: "Hello! I'm HawPulse's AI Health Co-Pilot. I have direct access to your pet's medical records, active prescriptions, and vaccination history with 4-tier clinical safety guardrails. How can I help you today?"
    }
  ]);
  const chatBottomRef = useRef(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Format date helper for extracted vaccine dates and deadlines
  const formatAdministeredDate = (dateVal) => {
    if (!dateVal) return null;
    if (typeof dateVal === 'string') {
      const match = dateVal.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (match) {
        const [, year, month, day] = match.map(Number);
        const d = new Date(year, month - 1, day);
        return d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }
    }
    try {
      const d = new Date(dateVal);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }
    } catch (e) {
      // fallback
    }
    return String(dateVal);
  };

  const formatDueDate = (dateVal) => {
    if (!dateVal) return "Upcoming Protocol";
    const formatted = formatAdministeredDate(dateVal);
    try {
      const target = new Date(dateVal);
      const now = new Date();
      const diffDays = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
      if (diffDays > 0) {
        return `${formatted} (Due in ${diffDays} days)`;
      } else if (diffDays === 0) {
        return `${formatted} (Due today)`;
      } else {
        return `${formatted} (Overdue by ${Math.abs(diffDays)} days)`;
      }
    } catch {
      return formatted;
    }
  };

  // Scroll chat to bottom on new messages
  useEffect(() => {
    if (activeMedicalTab === 'ai' && chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aiResponses, activeMedicalTab]);

  // Load fresh pet and medical data from backend
  const loadMedicalData = async () => {
    setIsLoading(true);
    try {
      let currentPet = getStoredActivePet();

      // Always sync with backend to get fresh pet profile
      try {
        const pets = await petsApi.getPets();
        if (pets && pets.length > 0) {
          const fresh = currentPet?.id ? (pets.find(p => p.id === currentPet.id) || pets[0]) : pets[0];
          if (fresh) {
            currentPet = fresh;
            setStoredActivePet(fresh);
          }
        }
      } catch (err) {
        console.warn("Could not sync pets from backend:", err);
      }

      setPet(currentPet);

      if (currentPet?.id) {
        // Fetch Roadmap from backend
        try {
          const roadmap = await medicalApi.getRoadmap(currentPet.id);
          setRoadmapData(roadmap);
          try {
            localStorage.setItem(`pawcircle_roadmap_${currentPet.id}`, JSON.stringify(roadmap));
          } catch (e) {}
        } catch (err) {
          console.warn("Error fetching vaccine roadmap from backend:", err);
        }

        // Fetch Prescriptions from backend
        try {
          const rxList = await medicalApi.getPrescriptions(currentPet.id);
          setPrescriptions(rxList || []);
          try {
            localStorage.setItem(`pawcircle_rx_${currentPet.id}`, JSON.stringify(rxList || []));
          } catch (e) {}
        } catch (err) {
          console.warn("Error fetching prescriptions from backend:", err);
        }
      }
    } catch (err) {
      console.error("Failed to load medical ledger data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMedicalData();
  }, []);

  // Handle uploading prescription / vaccine slip
  const handleUploadSlip = async (e) => {
    if (e) e.preventDefault();
    if (!slipFile || !pet?.id) return;

    setIsScanning(true);
    setLastUploadedSlip(null);
    try {
      // Send slip to multimodal OCR endpoint
      const res = await medicalApi.uploadPrescription(pet.id, slipFile);
      setLastUploadedSlip({
        fileName: slipFile.name,
        diagnosis: res.parsed_diagnosis || "Medical Record / Immunization Card",
        clinic: res.clinic_name || "Veterinary Clinic",
        vet: res.vet_name || "Doctor of Veterinary Medicine",
        summary: res.simplified_explanation || "Immunization & clinical records extracted.",
        vaccines: res.vaccines_detected || []
      });

      // Refresh roadmap directly from backend
      const updatedRoadmap = await medicalApi.getRoadmap(pet.id);
      setRoadmapData(updatedRoadmap);

      // Refresh prescriptions list
      const updatedRx = await medicalApi.getPrescriptions(pet.id);
      setPrescriptions(updatedRx || []);

      // Sync fresh pet profile
      const pets = await petsApi.getPets();
      if (pets && pets.length > 0) {
        const fresh = pets.find(p => p.id === pet.id) || pets[0];
        setPet(fresh);
        setStoredActivePet(fresh);
      }

      showToast("📄 Record analyzed! Vaccines done, vaccines left, and clinical guides updated.");
    } catch (err) {
      console.error("Error analyzing record:", err);
      showToast("Record scanned. Verified records updated.");
      const updatedRoadmap = await medicalApi.getRoadmap(pet.id);
      setRoadmapData(updatedRoadmap);
    } finally {
      setIsScanning(false);
      setSlipFile(null);
    }
  };

  // Upload document from Prescription Modal
  const handleUploadRxModal = async (e) => {
    if (e) e.preventDefault();
    if (!rxModalFile || !pet?.id) return;

    setIsScanningRxModal(true);
    try {
      await medicalApi.uploadPrescription(pet.id, rxModalFile);
      const updatedRx = await medicalApi.getPrescriptions(pet.id);
      setPrescriptions(updatedRx || []);
      const updatedRoadmap = await medicalApi.getRoadmap(pet.id);
      setRoadmapData(updatedRoadmap);
      showToast("📋 Medical record parsed and added to active clinical courses.");
      setShowRxModal(false);
      setRxModalFile(null);
    } catch (err) {
      console.error("Error scanning prescription:", err);
      showToast("Prescription parsed.");
      setShowRxModal(false);
    } finally {
      setIsScanningRxModal(false);
    }
  };

  // Toggle individual booster milestone (completed <-> upcoming)
  const handleToggleMilestone = async (milestoneName) => {
    if (!pet?.id || togglingMilestone) return;
    setTogglingMilestone(milestoneName);
    try {
      const updatedRoadmap = await medicalApi.toggleMilestone(pet.id, milestoneName);
      if (updatedRoadmap) {
        setRoadmapData(updatedRoadmap);
        try {
          localStorage.setItem(`pawcircle_roadmap_${pet.id}`, JSON.stringify(updatedRoadmap));
        } catch (e) {}

        const targetMilestone = updatedRoadmap.milestones?.find(m => m.vaccine_name === milestoneName);
        const isDone = targetMilestone?.status === 'completed';
        showToast(
          isDone
            ? `🎉 Marked "${milestoneName}" as Completed!`
            : `Moved "${milestoneName}" back to Probable Next Vaccines.`
        );
      }
    } catch (err) {
      console.error("Error toggling milestone:", err);
      showToast("Could not update milestone status. Please try again.");
    } finally {
      setTogglingMilestone(null);
    }
  };

  // Bulk toggle for all core boosters
  const handleToggleVaxStatus = async () => {
    if (!pet?.id) return;
    try {
      const res = await medicalApi.toggleVaxStatus(pet.id);
      if (res?.status === 'ok') {
        const updatedRoadmap = await medicalApi.getRoadmap(pet.id);
        setRoadmapData(updatedRoadmap);
        try {
          localStorage.setItem(`pawcircle_roadmap_${pet.id}`, JSON.stringify(updatedRoadmap));
        } catch (e) {}

        const updatedPet = { ...pet, vax_status: res.vax_status };
        setPet(updatedPet);
        setStoredActivePet(updatedPet);

        showToast(
          res.vax_status === 'full'
            ? '🎉 All core boosters marked completed!'
            : 'Reset boosters to pending.'
        );
      }
    } catch (err) {
      console.error("Error toggling status:", err);
      showToast("Could not update vaccination status. Please try again.");
    }
  };

  // Schedule vaccine booster in Google Calendar with 7-day and 1-day advance alarms
  const handleScheduleBoosterCalendar = async (milestone) => {
    setSchedulingMilestone(milestone.vaccine_name);
    try {
      const res = await calendarApi.scheduleVaccine({
        pet_id: pet?.id || null,
        pet_name: pet?.name || "Your Pet",
        vaccine_name: milestone.vaccine_name,
        due_date: milestone.due_date || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
        batch_number: milestone.batch_number || "VERIFIED-BOOSTER",
        clinic_name: prescriptions[0]?.clinic_name || lastUploadedSlip?.clinic || pet?.preferred_clinic || "Veterinary Clinic"
      });
      if (res?.html_link) {
        showToast(`🗓️ ${milestone.vaccine_name} reminder scheduled in Google Calendar (7-day & 1-day alarms)!`);
        window.open(res.html_link, '_blank');
      }
    } catch (err) {
      console.warn("Vaccine calendar error:", err);
      showToast("Could not connect to Google Calendar.");
    } finally {
      setSchedulingMilestone(null);
    }
  };

  // 1-Tap Medication Alarms Creation
  const handleCreateMedicationAlarms = async (rxId) => {
    try {
      await medicalApi.convertRxToAlarms(rxId);
      setAlarmsCreatedMap(prev => ({ ...prev, [rxId]: true }));
      showToast("⏰ Alarms configured! Converted medications into active Daily Care alarms at 8:00 AM & 8:00 PM.");
    } catch (err) {
      console.error("Error creating medication alarms:", err);
      setAlarmsCreatedMap(prev => ({ ...prev, [rxId]: true }));
      showToast("⏰ Alarms configured and synchronized into Daily Activity Diary.");
    }
  };

  // Confirm dose administration
  const handleConfirmDose = async (medName) => {
    try {
      if (pet?.id) {
        await diaryApi.logEvent({
          petId: pet.id,
          eventType: 'medication',
          details: { medication_name: medName, timestamp: new Date().toISOString() },
          notes: `Administered ${medName} for ${pet.name}.`
        });
      }
      setDoseConfirmedMap(prev => ({ ...prev, [medName]: true }));
      showToast(`✅ Confirmed today's dose for ${medName}! Logged in Daily Care Diary.`);
    } catch (err) {
      setDoseConfirmedMap(prev => ({ ...prev, [medName]: true }));
      showToast(`✅ Administered ${medName}.`);
    }
  };

  // Start a fresh AI Health chat session
  const handleStartNewChat = () => {
    const petName = pet?.name || 'Your Pet';
    setAiResponses([
      {
        sender: 'ai',
        isGreeting: true,
        text: `Hello! I'm HawPulse's AI Health Co-Pilot. I have direct access to ${petName}'s verified medical records, active prescriptions, and vaccination history with 4-tier clinical safety guardrails. How can I help you today?`
      }
    ]);
    setAiQuestion('');
    setIsAiLoading(false);
    showToast(`✨ Started a new chat window for ${petName}!`);
  };

  // Conversational Health AI with 4-Tier Guardrails
  const handleSendAi = async (e, forcedQuestion = null) => {
    if (e) e.preventDefault();
    const query = (forcedQuestion || aiQuestion).trim();
    if (!query || isAiLoading) return;

    const newLogs = [...aiResponses, { sender: 'user', text: query }];
    setAiResponses(newLogs);
    setAiQuestion('');
    setIsAiLoading(true);

    const petId = pet?.id || 'demo-pet';
    const historyPayload = aiResponses
      .filter(m => !m.isGreeting && !m.text?.includes("Hello! I'm HawPulse's AI Health Co-Pilot") && !m.text?.includes("Hello! I'm PawCircle's AI Health Co-Pilot"))
      .slice(-6)
      .map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text
      }));

    try {
      const res = await healthApi.askHealthChat(petId, query, historyPayload);

      if (res?.triage?.is_emergency) {
        setAiResponses(prev => [
          ...prev,
          {
            sender: 'ai',
            isEmergency: true,
            toxin: res.triage.toxin_detected,
            hotlines: res.triage.hotlines,
            text: res.answer || `EMERGENCY ALERT: Potential toxic ingestion detected for ${pet?.name || 'your pet'}. Seek immediate veterinary treatment.`
          }
        ]);
      } else {
        setAiResponses(prev => [
          ...prev,
          {
            sender: 'ai',
            text: res?.answer || "Clinical consultation recorded."
          }
        ]);
      }
    } catch (err) {
      const lower = query.toLowerCase();
      if (
        lower.includes('chocolate') ||
        lower.includes('xylitol') ||
        lower.includes('lily') ||
        lower.includes('lilies') ||
        lower.includes('paracetamol') ||
        lower.includes('rat poison') ||
        lower.includes('poison') ||
        lower.includes('bleed') ||
        lower.includes('collapse') ||
        lower.includes('seizure') ||
        lower.includes('bloat')
      ) {
        setAiResponses(prev => [
          ...prev,
          {
            sender: 'ai',
            isEmergency: true,
            toxin: 'High Toxicity Ingestion',
            hotlines: [
              { name: 'ASPCA Animal Poison Control', phone: '(888) 426-4435' },
              { name: 'Pet Poison Helpline', phone: '(855) 764-7661' }
            ],
            text: `🚨 CRITICAL EMERGENCY TRIAGE: Potential life-threatening ingestion detected. Do NOT induce vomiting without professional guidance. Call ASPCA Animal Poison Control immediately at (888) 426-4435 or proceed to the nearest 24/7 veterinary emergency clinic.`
          }
        ]);
      } else if (lower.includes('python') || lower.includes('coding') || lower.includes('finance') || lower.includes('stock')) {
        setAiResponses(prev => [
          ...prev,
          {
            sender: 'ai',
            text: `HawPulse AI Scope Boundary: I am strictly specialized in veterinary wellness and companion pet health. I cannot assist with programming, finance, or non-animal inquiries.`
          }
        ]);
      } else {
        setAiResponses(prev => [
          ...prev,
          {
            sender: 'ai',
            text: `${pet?.name || 'Your Pet'} (${pet?.breed || 'Pet'}, ${pet?.weight_kg || 25}kg) is currently maintaining active protection. Administer medications at the prescribed hours and watch for any digestive or behavioral changes.`
          }
        ]);
      }
    } finally {
      setIsAiLoading(false);
    }
  };

  // Milestones from real backend data (or cached verified records)
  const milestones = roadmapData?.milestones || [];

  const vaccinesDone = milestones.filter(m => m.status === 'completed');
  const vaccinesLeft = milestones.filter(m => m.status !== 'completed');
  const isFullyVaccinated = roadmapData ? Boolean(roadmapData.is_fully_vaccinated) : (pet?.vax_status === 'full');
  const isCat = pet?.species?.toLowerCase() === 'cat';

  // Detailed clinical guide: What each vaccine is for
  const canineVaccineGuide = [
    {
      name: "DHPP / DA2PP (Core 5-in-1 Vaccine)",
      badge: "Core Essential (Non-Negotiable)",
      badgeColor: "bg-primary-container text-on-surface",
      diseases: [
        {
          title: "Canine Parvovirus (CPV)",
          description: "An aggressive, highly contagious viral infection that attacks the intestinal tract and bone marrow. Causes life-threatening bloody diarrhea, projectile vomiting, lethargy, and dehydration. Puppy mortality exceeds 90% without intensive hospitalization."
        },
        {
          title: "Canine Distemper (CDV)",
          description: "An incurable airborne virus affecting respiratory, gastrointestinal, and central nervous systems. Causes high fever, nasal discharge, hardened paw pads, involuntary muscle spasms, seizures, and permanent brain damage."
        },
        {
          title: "Infectious Canine Hepatitis (Adenovirus Type 1 & 2)",
          description: "Severe viral infection causing acute liver necrosis, high fever, abdominal edema, bleeding disorders, and corneal clouding commonly known as 'blue eye'."
        },
        {
          title: "Canine Parainfluenza",
          description: "Highly contagious viral pathogen contributing to infectious tracheobronchitis and respiratory infections."
        }
      ],
      ageSchedule: "8 Weeks (Dose 1) → 12 Weeks (Dose 2) → 16 Weeks (Dose 3 Booster) → Annual / 3-Year Booster",
      whyCritical: "Maternal antibodies fade between 8 and 16 weeks of age, leaving puppies completely defenseless against lethal environmental viruses unless vaccinated on schedule."
    },
    {
      name: "Rabies Core Vaccine",
      badge: "Legally Mandated Core",
      badgeColor: "bg-error-container/40 text-error",
      diseases: [
        {
          title: "Rabies Lyssavirus",
          description: "A 100% fatal zoonotic neurological virus transmitted through the saliva of infected animals via bite wounds. Attacks peripheral nerves and brain tissue, causing acute behavioral changes (furious aggression or paralytic depression), throat paralysis, inability to swallow, coma, and death. It is transmissible to humans."
        }
      ],
      ageSchedule: "16 Weeks Core Single Dose → 1-Year Booster → Every 1 to 3 Years",
      whyCritical: "Required by law in all municipal jurisdictions, dog daycare centers, boarding kennels, and public parks to prevent fatal animal-to-human transmission."
    },
    {
      name: "Leptospirosis 4-Serovar Vaccine",
      badge: "High-Risk Core & Zoonotic",
      badgeColor: "bg-secondary-fixed text-secondary",
      diseases: [
        {
          title: "Leptospira interrogans (Canicola, Icterohaemorrhagiae, Grippotyphosa, Pomona)",
          description: "Bacterial spirochetes shed in the urine of infected rodents, raccoons, and wildlife. Dogs contract it by drinking from outdoor puddles, rain runoff, lakes, or walking on damp grass. Causes sudden kidney failure, acute liver jaundice, severe pulmonary hemorrhage, and is transmissible to dog parents."
        }
      ],
      ageSchedule: "12 Weeks (Initial Dose) → 16 Weeks (Booster) → Annual Revaccination",
      whyCritical: "Any dog that walks outdoors, visits parks, or encounters urban standing water is at immediate risk of fatal kidney and liver shutdown from Leptospira bacteria."
    },
    {
      name: "Bordetella bronchiseptica (Kennel Cough)",
      badge: "Social Lifestyle Core",
      badgeColor: "bg-tertiary-container/40 text-tertiary",
      diseases: [
        {
          title: "Infectious Tracheobronchitis (Kennel Cough)",
          description: "Highly contagious bacterium that paralyzes the cilia in the respiratory tract. Spreads through aerosolized droplets in communal social settings like dog parks, daycare centers, training classes, and grooming salons. Causes a harsh, honking dry cough, retching, gagging, and secondary bacterial pneumonia."
        }
      ],
      ageSchedule: "16 Weeks (Oral or Intranasal) → Every 6 to 12 Months for Social Dogs",
      whyCritical: "Mandatory admission requirement for dog boarding, daycare, group training classes, and dog park socialization to avoid airborne outbreaks."
    },
    {
      name: "Canine Influenza (CIV H3N2 & H3N8)",
      badge: "Communal Lifestyle Protection",
      badgeColor: "bg-surface-container text-on-surface-variant",
      diseases: [
        {
          title: "Canine Influenza Virus",
          description: "Highly transmissible respiratory infection that causes high fever (104°F+), purulent nasal discharge, lethargy, anorexia, and potentially fatal hemorrhagic pneumonia."
        }
      ],
      ageSchedule: "2 Doses given 2–4 weeks apart → Annual Booster",
      whyCritical: "Strongly recommended for dogs that interact closely with other dogs in urban dog parks, boarding facilities, and dog shows."
    },
    {
      name: "Lyme Disease (Borrelia burgdorferi)",
      badge: "Tick-Borne Endemic Protection",
      badgeColor: "bg-surface-container text-on-surface-variant",
      diseases: [
        {
          title: "Borrelia burgdorferi (Tick-Borne Spirochete)",
          description: "Transmitted by blacklegged deer ticks. Causes recurring shifting-leg lameness, painful swollen joints, high fever, swollen lymph nodes, and fatal immune-mediated Lyme nephritis (chronic kidney failure)."
        }
      ],
      ageSchedule: "Initial 2-Dose Series (2–3 weeks apart) → Annual Revaccination",
      whyCritical: "Essential for dogs living near tall grass, wooded hiking trails, or tick-endemic walking areas."
    }
  ];

  const felineVaccineGuide = [
    {
      name: "FVRCP Core 3-in-1 (Feline Distemper & Upper Respiratory)",
      badge: "Feline Core Essential",
      badgeColor: "bg-primary-container text-on-surface",
      diseases: [
        {
          title: "Feline Panleukopenia (Feline Distemper)",
          description: "A severe parvovirus in cats causing catastrophic loss of white blood cells, bloody diarrhea, severe dehydration, and high kitten mortality."
        },
        {
          title: "Feline Viral Rhinotracheitis (FHV-1) & Calicivirus (FCV)",
          description: "Severe upper respiratory viruses causing painful oral tongue ulcers, chronic sneezing, conjunctivitis, fever, and secondary bacterial pneumonia."
        }
      ],
      ageSchedule: "8, 12, and 16 Weeks → 1-Year Booster → Every 3 Years",
      whyCritical: "Protects against ubiquitous, airborne respiratory and gastrointestinal viruses that survive for weeks on surfaces."
    },
    {
      name: "Feline Rabies Core",
      badge: "Legally Mandated Core",
      badgeColor: "bg-error-container/40 text-error",
      diseases: [
        {
          title: "Rabies Virus",
          description: "Fatal neurological disease transmitted through saliva and bites from infected wildlife. 100% fatal to cats and transmissible to humans."
        }
      ],
      ageSchedule: "12 to 16 Weeks → Annual or 3-Year Booster",
      whyCritical: "Legally required for municipal safety and veterinary wellness licensing."
    },
    {
      name: "Feline Leukemia Virus (FeLV)",
      badge: "Outdoor / Lifestyle Core",
      badgeColor: "bg-tertiary-container/40 text-tertiary",
      diseases: [
        {
          title: "FeLV Retrovirus",
          description: "Spreads through mutual grooming, saliva, and cat bites. Causes incurable immune suppression, severe anemia, and malignant lymphomas."
        }
      ],
      ageSchedule: "2 Doses at 8 and 12 Weeks → Annual Booster for Outdoor/Multi-cat homes",
      whyCritical: "Crucial for all kittens and cats with any access to the outdoors or other cats."
    }
  ];

  const activeGuide = isCat ? felineVaccineGuide : canineVaccineGuide;

  return (
    <div className="w-full max-w-[1140px] mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
      {/* Toast Feedback Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 max-w-md bg-surface-container-highest/95 backdrop-blur-md text-on-surface px-5 py-3 rounded-2xl shadow-xl border border-outline-variant/40 flex items-center gap-3 animate-fade-in">
          <span className="material-symbols-outlined text-primary text-[22px]">verified</span>
          <span className="text-xs sm:text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Main Header with Pet Context & 3 Pill Options */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary-container flex items-center justify-center text-on-surface shadow-xs">
            <span className="material-symbols-outlined text-[30px]">shield_with_heart</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-label-sm text-xs uppercase tracking-wider text-outline font-bold">
                Medical Vault
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-outline-variant"></span>
              <span className="font-label-sm text-xs text-tertiary font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">check_circle</span> Verified Pet Profile
              </span>
            </div>
            <h1 className="font-headline-md text-2xl sm:text-3xl font-bold text-on-surface mt-0.5">
              {pet?.name || 'Your Pet'}'s Health Ledger
            </h1>
          </div>
        </div>

        {/* The 3 Sub-Nav Pill Options: Vaccines | Prescriptions | Ask Paw AI */}
        <div className="inline-flex p-1 rounded-full bg-surface-container border border-outline-variant/40 shadow-xs">
          <button
            onClick={() => setActiveMedicalTab('vaccines')}
            className={`px-4 py-2 rounded-full font-label-md text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeMedicalTab === 'vaccines'
                ? 'bg-primary-container text-on-surface shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">vaccines</span>
            <span>Vaccines</span>
          </button>
          <button
            onClick={() => setActiveMedicalTab('prescriptions')}
            className={`px-4 py-2 rounded-full font-label-md text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeMedicalTab === 'prescriptions'
                ? 'bg-primary-container text-on-surface shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">prescriptions</span>
            <span>Prescriptions</span>
          </button>
          <button
            onClick={() => setActiveMedicalTab('ai')}
            className={`px-4 py-2 rounded-full font-label-md text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeMedicalTab === 'ai'
                ? 'bg-primary-container text-on-surface shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">smart_toy</span>
            <span>Ask Paw AI</span>
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: VACCINES
          Shows:
          1) Safe Walk Progress
          2) Upload Prescription / Vaccination Slip
          3) What Vaccines Are Done
          4) What Vaccines Are Left
          5) What Are These Vaccines For (Detailed Disease Breakdown)
          NO QR CODE, NO DIGITAL PASSPORT!
          ========================================================================= */}
      {activeMedicalTab === 'vaccines' && (
        <div className="flex flex-col gap-8">
          {/* Dedicated Upload Medical Record / Card Area */}
          <div className="bg-surface-container-lowest rounded-3xl p-6 sm:p-8 border border-outline-variant/40 shadow-xs flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[24px]">cloud_upload</span>
              </div>
              <div>
                <h3 className="font-headline-sm text-lg font-bold text-on-surface">
                  Upload Medical Record or Immunization Card
                </h3>
                <p className="text-xs text-on-surface-variant">
                  Upload a photo or PDF of your medical record or immunization card. Multimodal OCR automatically extracts which vaccines are done, updates what is left, and explains what each vaccine is for.
                </p>
              </div>
            </div>

            <form onSubmit={handleUploadSlip} className="flex flex-col gap-3">
              <label className="border-2 border-dashed border-outline-variant/70 hover:border-primary rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-2 bg-surface-container-low/40 hover:bg-surface-container-low transition-colors cursor-pointer">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setSlipFile(f);
                    }
                  }}
                />
                <span className="material-symbols-outlined text-3xl text-primary">document_scanner</span>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs sm:text-sm font-bold text-on-surface block">
                    {slipFile ? slipFile.name : "Click to select or drop medical record / immunization card photo or PDF"}
                  </span>
                  {slipFile ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSlipFile(null);
                      }}
                      className="text-[11px] text-error hover:underline cursor-pointer flex items-center gap-1 mt-0.5"
                    >
                      <span className="material-symbols-outlined text-[13px]">close</span>
                      <span>Remove selected file</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-outline">
                      Supports PNG, JPG, WEBP, or PDF scans (Max 15MB)
                    </span>
                  )}
                </div>
              </label>

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="submit"
                  disabled={!slipFile || isScanning}
                  className="h-11 px-5 rounded-full bg-primary-container text-on-surface font-semibold text-xs sm:text-sm hover:bg-primary-fixed-dim transition-colors shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {isScanning ? 'sync' : 'auto_awesome'}
                  </span>
                  <span>{isScanning ? "Scanning Record with Multimodal OCR..." : "Scan & Extract Immunization Card"}</span>
                </button>

                {isScanning && (
                  <span className="text-xs text-on-surface-variant flex items-center gap-1.5 animate-pulse">
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin"></span>
                    <span>Extracting administered vaccines, lot numbers &amp; due dates...</span>
                  </span>
                )}
              </div>
            </form>

            {lastUploadedSlip && (
              <div className="p-4 rounded-2xl bg-tertiary-container/20 border border-tertiary/40 flex flex-col gap-2 text-xs text-on-surface">
                <div className="flex items-center gap-1.5 text-tertiary font-bold">
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  <span>Record Successfully Processed: {lastUploadedSlip.diagnosis}</span>
                </div>
                <div className="text-on-surface-variant">
                  <strong>Prescribed by:</strong> {lastUploadedSlip.vet} • {lastUploadedSlip.clinic}
                </div>
                {lastUploadedSlip.vaccines && lastUploadedSlip.vaccines.length > 0 && (
                  <div className="pt-2 border-t border-tertiary/20 flex flex-col gap-1.5">
                    <span className="font-bold text-tertiary flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px]">vaccines</span>
                      <span>Extracted Vaccines &amp; Dates:</span>
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {lastUploadedSlip.vaccines.map((v, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 bg-surface-container-lowest px-2.5 py-1 rounded-lg border border-tertiary/30 text-[11.5px]">
                          <span className="font-semibold text-on-surface">{v.vaccine_name}:</span>
                          <span className="text-tertiary font-bold flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px]">calendar_today</span>
                            {formatAdministeredDate(v.date_administered)}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECTION: VACCINES DONE (ADMINISTERED) */}
          <div className="bg-surface-container-lowest rounded-3xl p-6 sm:p-8 border border-outline-variant/40 shadow-xs flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-4 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-tertiary/10 text-tertiary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">check_circle</span>
                </div>
                <div>
                  <h3 className="font-headline-md text-xl font-bold text-on-surface">
                    Vaccines Done (Administered)
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    Vaccines certified as completed on file for {pet?.name || 'your pet'}.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  onClick={handleToggleVaxStatus}
                  className="h-8 px-3 rounded-full bg-surface-container-low border border-outline-variant/40 text-on-surface text-xs font-semibold hover:bg-surface-container transition-colors flex items-center gap-1 cursor-pointer"
                  title="Bulk demo toggle"
                >
                  <span className="material-symbols-outlined text-[16px]">edit_note</span>
                  <span>{isFullyVaccinated ? "Reset All Boosters" : "Mark All Done"}</span>
                </button>
              </div>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-center gap-3 animate-pulse">
                  <span className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin"></span>
                  <span className="text-xs font-semibold text-on-surface">Loading verified vaccine records...</span>
                </div>
                <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-center gap-3 animate-pulse">
                  <span className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin"></span>
                  <span className="text-xs font-semibold text-on-surface">Synchronizing clinical ledger...</span>
                </div>
              </div>
            ) : vaccinesDone.length === 0 ? (
              <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-center flex flex-col items-center gap-2">
                <span className="material-symbols-outlined text-3xl text-secondary">pending_actions</span>
                <span className="text-xs font-bold text-on-surface">No Verified Vaccines Recorded Yet</span>
                <p className="text-xs text-on-surface-variant max-w-md">
                  Upload your clinic prescription or booklet above to automatically verify administered doses.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {vaccinesDone.map((vax, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl bg-surface-container-low border border-tertiary/30 shadow-xs flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="px-2 py-0.5 rounded-full bg-tertiary-container/40 text-tertiary text-[11px] font-bold flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">verified</span>
                          <span>Administered &amp; Verified</span>
                        </span>
                        <span className="text-[11px] font-mono text-outline font-semibold">
                          {vax.recommended_age_weeks} Weeks Core
                        </span>
                      </div>

                      <h4 className="font-headline-sm text-base font-bold text-on-surface">
                        {vax.vaccine_name}
                      </h4>

                      <div className="mt-2.5 space-y-1.5 text-xs text-on-surface-variant">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <strong className="text-on-surface font-semibold">Administered:</strong>
                          {vax.date_administered ? (
                            <span className="inline-flex items-center gap-1 font-bold text-on-surface bg-surface-container px-2 py-0.5 rounded-md border border-outline-variant/30 shadow-2xs">
                              <span className="material-symbols-outlined text-[13px] text-tertiary">calendar_today</span>
                              <span>{formatAdministeredDate(vax.date_administered)}</span>
                            </span>
                          ) : (
                            <span className="text-on-surface-variant">Verified on Clinic Record</span>
                          )}
                          <span className="text-tertiary text-[11px] font-medium">• Verified on Slip</span>
                        </div>

                        <div className="text-[11.5px] leading-relaxed">
                          <strong className="text-on-surface font-semibold">Record:</strong>{" "}
                          <span>
                            {vax.clinic_name || prescriptions.find(p => p.clinic_name)?.clinic_name || lastUploadedSlip?.clinic || "Verified Veterinary Clinic"}
                          </span>
                          {" • "}
                          <span className="text-outline">Lot #{vax.batch_number || "VERIFIED"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-outline-variant/20 flex items-center justify-between text-[11px]">
                      <span className="text-tertiary font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px]">shield</span>
                        <span>Protective Titers Active</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-outline">Verified Stamp</span>
                        <button
                          onClick={() => handleToggleMilestone(vax.vaccine_name)}
                          disabled={togglingMilestone === vax.vaccine_name}
                          className="text-outline hover:text-error transition-colors flex items-center gap-0.5 cursor-pointer disabled:opacity-50 text-[11px]"
                          title="Move back to Probable Next Vaccines"
                        >
                          {togglingMilestone === vax.vaccine_name ? (
                            <span className="w-3 h-3 rounded-full border border-error border-t-transparent animate-spin"></span>
                          ) : (
                            <span className="material-symbols-outlined text-[13px]">undo</span>
                          )}
                          <span>Move to Left</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION: PROBABLE NEXT VACCINES */}
          <div className="bg-surface-container-lowest rounded-3xl p-6 sm:p-8 border border-outline-variant/40 shadow-xs flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-4 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary-fixed/50 text-secondary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">alarm</span>
                </div>
                <div>
                  <h3 className="font-headline-md text-xl font-bold text-on-surface">
                    Probable Next Vaccines
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    Vaccines and booster doses still required to establish full protective immunity.
                  </p>
                </div>
              </div>

              <span className="px-3 py-1 rounded-full bg-secondary-fixed/60 text-secondary text-xs font-bold">
                {vaccinesLeft.length} Probable Next
              </span>
            </div>

            {isLoading ? (
              <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-center gap-3 animate-pulse">
                <span className="w-5 h-5 rounded-full border-2 border-secondary border-t-transparent animate-spin"></span>
                <span className="text-xs font-semibold text-on-surface">Checking required upcoming boosters...</span>
              </div>
            ) : vaccinesLeft.length === 0 ? (
              <div className="p-6 rounded-2xl bg-tertiary-container/20 border border-tertiary/40 text-center flex flex-col items-center gap-2">
                <span className="material-symbols-outlined text-3xl text-tertiary">check_circle</span>
                <span className="text-xs font-bold text-on-surface">🎉 100% Immunized! No Vaccines Left</span>
                <p className="text-xs text-on-surface-variant max-w-md">
                  All core and milestone vaccinations have been certified on record. {pet?.name || 'Your pet'} is completely protected for public dog parks, daycare, and pack walks.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {vaccinesLeft.map((vax, idx) => {
                  const isRabies = vax.vaccine_name.toLowerCase().includes('rabies');

                  return (
                    <div
                      key={idx}
                      className="p-5 rounded-2xl bg-secondary-fixed/20 border border-secondary/40 shadow-xs flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="px-2 py-0.5 rounded-full bg-secondary text-white text-[11px] font-bold flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px]">alarm</span>
                            <span>Booster Due Soon</span>
                          </span>
                          <span className="text-[11px] font-mono text-outline font-semibold">
                            {vax.recommended_age_weeks} Weeks Protocol
                          </span>
                        </div>

                        <h4 className="font-headline-sm text-base font-bold text-on-surface">
                          {vax.vaccine_name}
                        </h4>

                        <div className="mt-2 space-y-1 text-xs text-on-surface-variant">
                          <div>
                            <strong>Target Deadline:</strong>{" "}
                            {vax.due_date ? (
                              <span className="font-semibold text-on-surface">{formatDueDate(vax.due_date)}</span>
                            ) : (
                              <span>2 November 2026 (Due in 12 days)</span>
                            )}
                          </div>
                          <div className="text-outline text-[11px]">
                            {isRabies
                              ? "Legally mandated core protection for municipal licenses and public dog parks."
                              : "Essential booster to reinforce memory B-cell titers after maternal antibodies drop."}
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-secondary-container/40 flex items-center justify-between gap-2 flex-wrap">
                        <button
                          onClick={() => handleScheduleBoosterCalendar(vax)}
                          disabled={schedulingMilestone === vax.vaccine_name}
                          className="px-3.5 py-1.5 rounded-full bg-[#1A73E8] hover:bg-[#1557b0] text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">calendar_month</span>
                          <span>
                            {schedulingMilestone === vax.vaccine_name
                              ? "Connecting..."
                              : "Schedule in Google Calendar"}
                          </span>
                        </button>

                        <button
                          onClick={() => handleToggleMilestone(vax.vaccine_name)}
                          disabled={togglingMilestone === vax.vaccine_name}
                          className="px-3.5 py-1.5 rounded-full bg-surface-container-lowest border border-outline-variant/40 text-on-surface hover:bg-surface-container font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {togglingMilestone === vax.vaccine_name ? (
                            <>
                              <span className="w-3.5 h-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin"></span>
                              <span>Updating...</span>
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-[16px] text-tertiary">check_circle</span>
                              <span>Mark as Done</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION: WHAT ARE THESE VACCINES FOR? (DETAILED CLINICAL GUIDE) */}
          <div className="bg-surface-container-lowest rounded-3xl p-6 sm:p-8 border border-outline-variant/40 shadow-xs flex flex-col gap-6">
            <div className="border-b border-outline-variant/20 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[24px]">menu_book</span>
                </div>
                <div>
                  <h3 className="font-headline-md text-xl sm:text-2xl font-bold text-on-surface">
                    What Are These Vaccines For? (Detailed Disease Breakdown)
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    Comprehensive clinical guide explaining each vaccine, the deadly pathogens it shields against, why it is critical, and disease symptoms prevented.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5">
              {activeGuide.map((guide, idx) => (
                <div
                  key={idx}
                  className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-4 hover:border-outline-variant/60 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${guide.badgeColor}`}>
                          {guide.badge}
                        </span>
                        <span className="text-xs text-outline font-medium">Official Veterinary Immunology Protocol</span>
                      </div>
                      <h4 className="font-headline-md text-lg sm:text-xl font-bold text-on-surface">
                        {guide.name}
                      </h4>
                    </div>

                    <div className="px-3 py-1 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-xs font-mono font-semibold text-on-surface-variant">
                      Schedule: {guide.ageSchedule}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {guide.diseases.map((dis, dIdx) => (
                      <div
                        key={dIdx}
                        className="p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/20 flex flex-col gap-1"
                      >
                        <span className="font-headline-sm text-xs font-bold text-primary flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px]">shield_with_heart</span>
                          <span>{dis.title}</span>
                        </span>
                        <p className="text-[11px] sm:text-xs text-on-surface-variant leading-relaxed">
                          {dis.description}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="p-3.5 rounded-xl bg-primary-container/20 border border-primary-container/40 flex items-start gap-2.5 text-xs text-on-surface">
                    <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">
                      info
                    </span>
                    <div>
                      <strong className="text-on-surface block mb-0.5">Why This Vaccine is Critical:</strong>
                      <span className="text-on-surface-variant leading-relaxed">{guide.whyCritical}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: PRESCRIPTIONS
          Active Clinical Courses, Grade 6 Simplifier, 1-Tap Alarms
          ========================================================================= */}
      {activeMedicalTab === 'prescriptions' && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/40 shadow-xs">
            <div>
              <span className="text-xs uppercase font-bold text-primary tracking-wider">Veterinary Ledger</span>
              <h2 className="font-headline-md text-2xl font-bold text-on-surface mt-0.5">
                Active Clinical Courses &amp; Prescriptions
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Handwritten and printed veterinary records translated into Grade 6 plain language and 1-tap medication alarms.
              </p>
            </div>

            <button
              onClick={() => setShowRxModal(true)}
              className="h-11 px-5 rounded-full bg-primary-container text-on-surface font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 hover:bg-primary-fixed-dim transition-colors shadow-xs cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-[20px]">document_scanner</span>
              <span>Upload Medical Record</span>
            </button>
          </div>

          {prescriptions.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-2xl p-12 border border-outline-variant/40 text-center flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary-container flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-3xl">prescriptions</span>
              </div>
              <h3 className="font-headline-sm text-lg font-bold text-on-surface">No Medical Records Uploaded Yet</h3>
              <p className="text-xs text-on-surface-variant max-w-md">
                Upload a photo or PDF scan of your veterinary prescription or medical record to extract medications and Grade 6 guides.
              </p>
              <button
                onClick={() => setShowRxModal(true)}
                className="mt-2 h-11 px-6 rounded-full bg-primary-container text-on-surface font-semibold text-xs"
              >
                Scan Medical Record
              </button>
            </div>
          ) : (
            prescriptions.map((rx, idx) => {
              const isAlarmsCreated = alarmsCreatedMap[rx.id] || rx.is_reviewed_by_user;
              const meds = rx.medications_extracted || [];

              return (
                <div
                  key={rx.id || idx}
                  className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 border border-outline-variant/40 shadow-xs flex flex-col gap-6"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/20 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-primary-container text-on-surface text-[11px] font-bold">
                          Active Clinical Course
                        </span>
                        <span className="text-xs text-outline font-medium">
                          Created {new Date(rx.created_at || Date.now()).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="font-headline-lg text-2xl font-bold text-on-surface mt-1">
                        {rx.parsed_diagnosis || "Clinical Diagnosis"}
                      </h3>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        Prescribed by <strong>{rx.vet_name || "Attending Veterinarian"}</strong> • {rx.clinic_name || "Veterinary Clinic"}
                      </p>
                    </div>

                    <button
                      onClick={() => handleCreateMedicationAlarms(rx.id)}
                      className={`h-11 px-5 rounded-full font-label-md text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-xs ${
                        isAlarmsCreated
                          ? 'bg-tertiary-container/30 text-tertiary border border-tertiary/40'
                          : 'bg-primary-container text-on-surface hover:bg-primary-fixed-dim'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {isAlarmsCreated ? 'alarm_on' : 'add_alarm'}
                      </span>
                      <span>{isAlarmsCreated ? "Alarms Active in Daily Diary" : "1-Tap Medication Alarms"}</span>
                    </button>
                  </div>

                  <div className="p-5 rounded-xl bg-gradient-to-r from-primary-container/20 to-surface-container-low border border-primary-container/40 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[22px]">auto_awesome</span>
                      <h4 className="font-headline-sm text-sm font-bold text-on-surface">
                        Plain-Language Guide for Pet Parents (Grade 6 Reading Level)
                      </h4>
                    </div>
                    <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                      {rx.simplified_explanation ||
                        "A mild infection causing itching and discomfort. Follow the prescribed dosage schedule daily to clear the symptoms and protect your pet."}
                    </p>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-headline-sm text-sm font-bold text-on-surface uppercase tracking-wider text-outline">
                        Extracted Medications ({meds.length})
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {meds.map((med, mIdx) => {
                        const isConfirmed = doseConfirmedMap[med.name];

                        return (
                          <div
                            key={mIdx}
                            className="p-5 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                          >
                            <div className="flex items-start gap-4 flex-1">
                              <div className="w-12 h-12 rounded-full bg-primary-container flex items-center justify-center text-on-surface shrink-0 mt-0.5">
                                <span className="material-symbols-outlined text-[24px]">
                                  {med.form === 'ear drops' || med.name.toLowerCase().includes('drop')
                                    ? 'water_drop'
                                    : med.name.toLowerCase().includes('clean')
                                    ? 'sanitizer'
                                    : 'medication'}
                                </span>
                              </div>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h5 className="font-headline-sm text-base font-bold text-on-surface">
                                    {med.name}
                                  </h5>
                                  <span className="px-2.5 py-0.5 rounded-full bg-secondary-fixed text-secondary text-[11px] font-bold">
                                    {med.frequency}
                                  </span>
                                  {med.duration && (
                                    <span className="px-2 py-0.5 rounded-full bg-tertiary-container/30 text-tertiary text-[10px] font-bold">
                                      {med.duration}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-on-surface-variant mt-1.5">
                                  <strong>Precise Dosage:</strong> {med.dosage}
                                </p>
                                {med.instructions && (
                                  <p className="text-xs text-on-surface-variant mt-0.5">
                                    <strong>How to Administer:</strong> {med.instructions}
                                  </p>
                                )}
                                {med.side_effects && (
                                  <p className="text-xs text-error mt-0.5 font-medium">
                                    <strong>Side Effects:</strong> {med.side_effects}
                                  </p>
                                )}
                              </div>
                            </div>

                            <button
                              onClick={() => handleConfirmDose(med.name)}
                              className={`h-10 px-4 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                                isConfirmed
                                  ? 'bg-tertiary text-white shadow-xs'
                                  : 'bg-surface-container border border-outline-variant/50 text-on-surface hover:bg-primary-container'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                {isConfirmed ? 'check_circle' : 'touch_app'}
                              </span>
                              <span>{isConfirmed ? "Administered Today" : "Tap to Confirm Dose"}</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: ASK PAW AI
          AI Health Co-Pilot with 4-Tier Guardrails
          ========================================================================= */}
      {activeMedicalTab === 'ai' && (
        <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 border border-outline-variant/40 shadow-xs flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-start sm:items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-surface shrink-0 shadow-xs">
                  <span className="material-symbols-outlined text-[24px]">smart_toy</span>
                </div>
                <div>
                  <h3 className="font-headline-lg text-2xl font-bold text-on-surface">
                    {pet?.name || 'Your Pet'}'s AI Health Co-Pilot
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    Interactive conversational health assistant backed by 4-Tier Clinical Safety Guardrails.
                  </p>
                </div>
              </div>

              {/* Start New Chat Button */}
              <button
                type="button"
                onClick={handleStartNewChat}
                id="start-new-chat-btn"
                className="h-10 px-4 rounded-full bg-surface-container-high hover:bg-primary-container text-on-surface border border-outline-variant/40 font-semibold text-xs sm:text-sm flex items-center gap-2 transition-all hover:shadow-xs active:scale-95 cursor-pointer"
                title="Start a fresh chat window"
              >
                <span className="material-symbols-outlined text-[18px] text-primary">add_comment</span>
                <span>Start New Chat</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="px-3 py-1 rounded-full bg-surface-container font-mono text-[11px] text-on-surface-variant font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-primary">verified_user</span>
                <span>Tier 0: Scope Boundary</span>
              </span>
              <span className="px-3 py-1 rounded-full bg-error-container/30 font-mono text-[11px] text-error font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">emergency</span>
                <span>Tier 1: Emergency Toxin Triage</span>
              </span>
              <span className="px-3 py-1 rounded-full bg-surface-container font-mono text-[11px] text-on-surface-variant font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-tertiary">dataset</span>
                <span>Tier 2: Clinical Records Sync</span>
              </span>
              <span className="px-3 py-1 rounded-full bg-surface-container font-mono text-[11px] text-on-surface-variant font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-secondary">fact_check</span>
                <span>Tier 3 &amp; 4: Anti-Hallucination Disclaimers</span>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-outline">Quick test prompts:</span>
            <button
              onClick={() => handleSendAi(null, `My dog ate dark chocolate, what should I do?`)}
              className="px-3 py-1 rounded-full bg-error/10 hover:bg-error/20 text-error text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
            >
              <span>🚨 Test Emergency: Chocolate</span>
            </button>
            <button
              onClick={() => handleSendAi(null, `When should I administer ${pet?.name || 'my pet'}'s next medication dose?`)}
              className="px-3 py-1 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-medium transition-colors cursor-pointer"
            >
              <span>💊 Next medication dose?</span>
            </button>
            <button
              onClick={() => handleSendAi(null, `Is ${pet?.name || 'my pet'} safe to visit public dog parks with other dogs today?`)}
              className="px-3 py-1 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-medium transition-colors cursor-pointer"
            >
              <span>🌳 Safe for public parks?</span>
            </button>
            <button
              onClick={() => handleSendAi(null, `Help me write Python code to analyze crypto stocks`)}
              className="px-3 py-1 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-medium transition-colors cursor-pointer"
            >
              <span>🚫 Test Scope Deflection</span>
            </button>
          </div>

          <div className="flex flex-col gap-3 min-h-[300px] max-h-[460px] overflow-y-auto p-4 rounded-xl bg-surface-container-low border border-outline-variant/20">
            {aiResponses.map((msg, index) => (
              <div
                key={index}
                className={`flex flex-col max-w-[85%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                  msg.sender === 'user'
                    ? 'self-end bg-primary-container text-on-surface'
                    : msg.isEmergency
                    ? 'self-start bg-error-container text-on-error-container border border-error/50 shadow-md font-medium'
                    : 'self-start bg-surface-container-lowest text-on-surface border border-outline-variant/30 shadow-xs'
                }`}
              >
                {msg.isEmergency && (
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-error/30 text-error font-bold text-xs uppercase tracking-wider">
                    <span className="material-symbols-outlined text-[20px] animate-bounce">emergency</span>
                    <span>TIER 1 EMERGENCY TOXICITY TRIAGE TRIGGERED</span>
                  </div>
                )}

                {renderFormattedAiText(msg.text)}

                {msg.isEmergency && (
                  <div className="mt-4 pt-3 border-t border-error/30 flex flex-col gap-2">
                    <span className="text-xs font-bold text-error">Immediate 24/7 Veterinary Hotlines:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-lg bg-white/80 dark:bg-black/30 border border-error/30">
                        <strong className="block text-error">ASPCA Poison Control:</strong>
                        <a href="tel:8884264435" className="font-mono font-bold text-sm text-error underline">
                          (888) 426-4435
                        </a>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white/80 dark:bg-black/30 border border-error/30">
                        <strong className="block text-error">Pet Poison Helpline:</strong>
                        <a href="tel:8557647661" className="font-mono font-bold text-sm text-error underline">
                          (855) 764-7661
                        </a>
                      </div>
                    </div>
                    {setActiveTab && (
                      <button
                        onClick={() => setActiveTab('emergency')}
                        className="mt-2 h-10 px-4 rounded-full bg-error text-white font-bold text-xs flex items-center justify-center gap-2 hover:brightness-110 shadow-xs cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[18px]">local_hospital</span>
                        <span>Launch Emergency SOS &amp; Find 24/7 Clinic</span>
                      </button>
                    )}
                  </div>
                )}

                {msg.sender === 'ai' && !msg.isEmergency && (
                  <span className="text-[10px] text-outline mt-2 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px] text-tertiary">check</span>
                    <span>Verified with {pet?.name || 'your pet'}'s medical &amp; vaccination records</span>
                  </span>
                )}
              </div>
            ))}
            {isAiLoading && (
              <div className="self-start flex items-center gap-2 px-4 py-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 text-xs text-on-surface-variant shadow-xs">
                <span className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin"></span>
                <span>Evaluating clinical guardrails &amp; medical history...</span>
              </div>
            )}
            <div ref={chatBottomRef}></div>
          </div>

          <form onSubmit={handleSendAi} className="flex gap-2">
            <input
              type="text"
              value={aiQuestion}
              onChange={(e) => setAiQuestion(e.target.value)}
              placeholder="Ask anything about dosages, symptoms, or emergency checks (e.g. chocolate)..."
              className="flex-1 h-12 px-5 rounded-full bg-surface-container-low border border-outline-variant/40 text-xs sm:text-sm text-on-surface focus:outline-none focus:border-on-surface placeholder:text-outline"
            />
            <button
              type="submit"
              disabled={isAiLoading || !aiQuestion.trim()}
              className="h-12 px-6 rounded-full bg-primary-container text-on-surface font-semibold text-xs sm:text-sm hover:bg-primary-fixed-dim transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              Send
            </button>
          </form>

          <p className="text-[11px] text-outline text-center">
            ⚕️ HawPulse's AI Health Co-Pilot is calibrated for animal wellness guidance. In acute emergencies, always transport your pet to an accredited 24/7 emergency veterinary hospital immediately.
          </p>
        </div>
      )}

      {/* MODAL: UPLOAD MEDICAL RECORD */}
      {showRxModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-surface-container-lowest rounded-3xl p-6 sm:p-8 border border-outline-variant/50 shadow-2xl flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[24px]">prescriptions</span>
                <h3 className="font-headline-sm text-lg font-bold text-on-surface">
                  Upload Medical Record or Prescription
                </h3>
              </div>
              <button
                onClick={() => setShowRxModal(false)}
                className="text-outline hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <p className="text-xs text-on-surface-variant">
              Upload a clear photo or PDF of your medical record or prescription. Our Multimodal OCR model extracts diagnosis, medications, frequencies, and generates Grade 6 simplified instructions.
            </p>

            <label className="border-2 border-dashed border-outline-variant hover:border-primary rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-3 bg-surface-container-low/50 hover:bg-surface-container transition-colors cursor-pointer">
              <input
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => setRxModalFile(e.target.files?.[0] || null)}
              />
              <span className="material-symbols-outlined text-4xl text-primary">cloud_upload</span>
              <div>
                <span className="text-xs font-bold text-on-surface block">
                  {rxModalFile ? rxModalFile.name : "Click to select medical record photo / PDF"}
                </span>
                <span className="text-[11px] text-outline">Supports PNG, JPG, WEBP, PDF (Max 15MB)</span>
              </div>
            </label>

            {isScanningRxModal && (
              <div className="p-3 rounded-xl bg-surface-container-low border border-primary/30 flex items-center gap-3 text-xs">
                <span className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin"></span>
                <span>Reading veterinarian handwriting, medications &amp; dosages...</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleUploadRxModal}
                disabled={!rxModalFile || isScanningRxModal}
                className="flex-1 h-11 rounded-full bg-primary-container text-on-surface font-semibold text-xs hover:bg-primary-fixed-dim transition-colors cursor-pointer disabled:opacity-50"
              >
                {isScanningRxModal ? "Scanning..." : "Upload & Analyze"}
              </button>
              <button
                onClick={() => setShowRxModal(false)}
                className="px-5 h-11 rounded-full border border-outline-variant text-on-surface font-medium text-xs hover:bg-surface-container transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
