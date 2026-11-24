'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/mock-auth';
import { userService } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, ShieldCheck, Mail, Phone, BookOpen, Briefcase, Award, GraduationCap, Clock, Loader2, ArrowRight, X, ChevronDown, Search } from 'lucide-react';
import PhoneVerificationStep from '@/components/onboarding/PhoneVerificationStep';

// ─── LPU schools & degree programmes (real data, 2026-11-12) ─────────────
// School list: LPU's own archives site (archives.lpu.in school list) +
// LPU business placement report + LPU Happenings 2024. Programme names:
// lpu.in sitemap, LPUNEST UG page, Annexure-D master programme list 2026
// and the Mittal School of Business page. Do not invent entries —
// anything not in these lists goes through the "Other" free-text input.
const OTHER_OPTION = 'Other';

const LPU_SCHOOLS: string[] = [
  'School of Computer Science and Engineering',
  'School of Computer Applications',
  'School of Mechanical Engineering',
  'School of Electronics and Electrical Engineering',
  'School of Civil Engineering',
  'School of Chemical Engineering and Physical Sciences',
  'School of Bio Engineering and Biosciences',
  'School of Agriculture',
  'School of Polytechnic',
  'Mittal School of Business',
  'School of Management & Commerce',
  'School of Social Sciences and Languages',
  'School of Journalism, Films and Creative Arts',
  'School of Journalism, Films and Creative Arts – II (Fine Arts)',
  'School of Hotel Management and Tourism',
  'School of Education',
  'School of Physical Education',
  'School of Design (Fashion Design and Technology)',
  'School of Design – II (Interior and Product Design)',
  'School of Design – III (Multimedia)',
  'School of Architecture and Planning',
  'School of Law',
  'School of Pharmaceutical Sciences',
  'School of Physiotherapy and Paramedical Sciences',
  'School of Liberal & Creative Arts',
];

const LPU_PROGRAMMES_BY_SCHOOL: Record<string, string[]> = {
  'School of Computer Science and Engineering': [
    'B.Tech. (Computer Science and Engineering)',
    'B.Tech. (Computer Science and Engineering – Artificial Intelligence and Machine Learning)',
    'B.Tech. (Artificial Intelligence and Data Science)',
    'B.Tech. (CSE – Generative Artificial Intelligence)',
    'B.Tech. (CSE – Computer Science and Business Systems)',
    'B.Tech. (CSE – Data Science with ML)',
    'B.Tech. (CSE – Cyber Security and Blockchain)',
    'B.Tech. (Information Technology)',
    'M.Tech. (Computer Science and Engineering)',
    'Integrated B.Tech. – M.Tech.',
  ],
  'School of Computer Applications': [
    'BCA (Bachelor of Computer Applications)',
    'BCA (AI and Cloud Computing)',
    'BCA (Cyber Security)',
    'BCA (Data Analytics)',
    'B.Sc. (Information Technology)',
    'B.Sc. (Computer Science – Cyber Security)',
    'MCA (Master of Computer Applications)',
    'MCA (Hons.) (Artificial Intelligence and Machine Learning)',
    'M.Sc. (Information Technology)',
  ],
  'School of Mechanical Engineering': [
    'B.Tech. (Mechanical Engineering)',
    'B.Tech. (Automobile Engineering)',
    'B.Tech. (Aerospace Engineering)',
    'B.Tech. (Mechatronics Engineering)',
    'B.Tech. (Robotics and Automation)',
    'M.Tech. (Mechanical Engineering)',
    'M.Tech. (Thermal Engineering)',
    'M.Tech. (Robotics)',
    'M.Tech. (Automobile Engineering)',
  ],
  'School of Electronics and Electrical Engineering': [
    'B.Tech. (Electronics and Communication Engineering)',
    'B.Tech. (Electrical Engineering)',
    'B.Tech. (Electrical and Electronics Engineering)',
    'M.Tech. (VLSI Design)',
    'M.Tech. (Power Systems)',
    'M.Tech. (Electronics and Communication Engineering)',
  ],
  'School of Civil Engineering': [
    'B.Tech. (Civil Engineering)',
    'B.Tech. (Construction Technology)',
    'M.Tech. (Structural Engineering)',
    'M.Tech. (Transportation Engineering)',
    'M.Tech. (Construction Management)',
  ],
  'School of Chemical Engineering and Physical Sciences': [
    'B.Tech. (Chemical Engineering)',
    'B.Tech. (Food Technology)',
    'B.Sc. (Hons.) Physics',
    'B.Sc. (Hons.) Chemistry',
    'B.Sc. (Hons.) Mathematics',
    'M.Tech. (Food Technology)',
    'M.Sc. (Physics)',
    'M.Sc. (Chemistry)',
    'M.Sc. (Mathematics)',
  ],
  'School of Bio Engineering and Biosciences': [
    'B.Tech. (Biotechnology)',
    'B.Tech. (Biomedical Engineering)',
    'B.Sc. (Biotechnology)',
    'B.Sc. (Hons.) Biotechnology',
    'M.Tech. (Biotechnology)',
    'M.Sc. (Biotechnology)',
    'M.Sc. (Microbiology)',
    'M.Sc. (Botany)',
    'M.Sc. (Zoology)',
  ],
  'School of Agriculture': [
    'B.Sc. (Hons.) Agriculture',
    'M.Sc. (Agriculture – Agronomy)',
    'M.Sc. (Agriculture – Horticulture)',
    'M.Sc. (Agriculture – Genetics and Plant Breeding)',
    'M.Sc. (Agriculture – Entomology)',
    'M.Sc. (Agriculture – Soil Science)',
  ],
  'School of Polytechnic': [
    'Diploma (Engg.) Computer Science and Engineering',
    'Diploma (Engg.) AI and Machine Learning',
    'Diploma (Engg.) Electronics and Communication Engineering',
    'Diploma (Engg.) Mechanical Engineering',
    'Diploma (Engg.) Civil Engineering',
  ],
  'Mittal School of Business': [
    'MBA',
    'MBA (Business Analytics)',
    'MBA (Financial Markets)',
    'MBA (Supply Chain & Logistics)',
    'MBA (Hospital & Healthcare Management)',
    'MBA (Fintech and Artificial Intelligence)',
    'MBA (Data Science and Artificial Intelligence)',
    'MBA (Management Technology)',
    'Ph.D. (Management)',
  ],
  'School of Management & Commerce': [
    'BBA (Bachelor of Business Administration)',
    'BBA (Hons.)',
    'BBA (Business Analytics)',
    'BBA (Digital Marketing and Artificial Intelligence)',
    'BBA (Fintech and Artificial Intelligence)',
    'BBA (Financial Markets)',
    'BBA (International Finance)',
    'BBA (International Accounting)',
    'BBA (Corporate Finance)',
    'BBA (Airlines and Airport Management)',
    'BBA (Tourism and Hospitality)',
    'BBA (Information Technology)',
    'BBA (Artificial Intelligence and Machine Learning)',
    'BBA (Cargo, Logistics and Supply Chain Management)',
    'Integrated BBA – MBA',
    'B.Com. (Bachelor of Commerce)',
    'B.Com. (Hons.)',
    'M.Com.',
    'Diploma in Business Administration',
    'M.A. (Economics)',
  ],
  'School of Social Sciences and Languages': [
    'B.A. (Bachelor of Arts)',
    'B.A. (Hons.)',
    'B.A. (Economics)',
    'B.Sc. (Hons.) Economics',
    'M.A. (English)',
    'M.A. (Hindi)',
    'M.A. (History)',
    'M.A. (Political Science)',
    'M.A. (Punjabi)',
    'M.A. (Sociology)',
    'M.A. (Education)',
  ],
  'School of Journalism, Films and Creative Arts': [
    'B.A. (Journalism and Mass Communication)',
    'B.Sc. (Film and TV Production)',
    'M.A. (Journalism and Mass Communication)',
    'M.Sc. (Film and TV Production)',
  ],
  'School of Journalism, Films and Creative Arts – II (Fine Arts)': [
    'B.A. (Fine Arts)',
    'BFA (Bachelor of Fine Arts)',
  ],
  'School of Hotel Management and Tourism': [
    'BHMCT (Bachelor of Hotel Management and Catering Technology)',
    'B.Sc. (Hotel Management)',
    'BBA (Tourism and Hospitality)',
  ],
  'School of Education': [
    'B.Ed. (Bachelor of Education)',
    'B.A. B.Ed.',
    'M.Ed.',
  ],
  'School of Physical Education': [
    'B.P.Ed. (Bachelor of Physical Education)',
    'M.P.Ed.',
    'B.Sc. (Health and Physical Education)',
  ],
  'School of Design (Fashion Design and Technology)': [
    'B.Des. (Fashion Design)',
    'M.Des. (Fashion Design)',
    'Master of Fashion Management (MFM)',
  ],
  'School of Design – II (Interior and Product Design)': [
    'B.Des. (Interior and Furniture Design)',
    'B.Des. (Product and Industrial Design)',
  ],
  'School of Design – III (Multimedia)': [
    'B.Des. (Multimedia)',
    'B.Sc. (Design – Multimedia)',
    'B.Sc. (Design – Fashion)',
  ],
  'School of Architecture and Planning': [
    'B.Arch. (Bachelor of Architecture)',
    'M.Arch.',
    'B.Plan.',
    'Integrated B.Tech. – M.Tech. (Urban and Regional Planning)',
  ],
  'School of Law': [
    'B.A. LL.B. (Hons.)',
    'BBA LL.B. (Hons.)',
    'LL.B.',
    'LL.M.',
  ],
  'School of Pharmaceutical Sciences': [
    'B.Pharm. (Bachelor of Pharmacy)',
    'M.Pharm.',
    'M.Pharm. (Pharmacy Practice)',
    'Pharm.D.',
  ],
  'School of Physiotherapy and Paramedical Sciences': [
    'BPT (Bachelor of Physiotherapy)',
    'B.Sc. (Medical Lab Technology)',
    'B.Sc. (Nutrition and Dietetics)',
    'B.Sc. (Forensic Sciences)',
    'M.Sc. (Clinical Embryology)',
    'M.Sc. (Nutrition and Dietetics)',
  ],
  'School of Liberal & Creative Arts': [
    'B.A. (Liberal Arts)',
    'B.A. (Hons.) (Liberal Arts)',
  ],
};


// ─── Skills, target roles & target industries (Step 3 pickers) ──────────
// Curated lists for LPU students / mentors. Extend by adding entries
// here — the pickers, validation and draft restore all read these
// constants. Anything not in a list is still reachable: skills accept
// free-typed custom entries, and role / industry have an "Other"
// free-text input (same pattern as the School / Programme dropdowns).
const SKILL_GROUPS: { label: string; skills: string[] }[] = [
  {
    label: 'Programming Languages',
    skills: ['JavaScript', 'TypeScript', 'Python', 'Java', 'C', 'C++', 'C#', 'Go', 'Rust', 'Kotlin', 'Swift', 'PHP', 'Ruby', 'SQL', 'R', 'Dart'],
  },
  {
    label: 'Web & Mobile Development',
    skills: ['React', 'Next.js', 'Vue.js', 'Angular', 'Node.js', 'Express.js', 'Django', 'Flask', 'Spring Boot', 'React Native', 'Flutter', 'HTML/CSS', 'Tailwind CSS', 'System Design', 'REST APIs', 'MongoDB', 'PostgreSQL', 'MySQL', 'Firebase'],
  },
  {
    label: 'Data & AI',
    skills: ['Machine Learning', 'Deep Learning', 'Data Analysis', 'Data Science', 'NLP', 'Computer Vision', 'TensorFlow', 'PyTorch', 'Pandas', 'NumPy', 'Power BI', 'Tableau', 'Excel', 'Statistics', 'Generative AI'],
  },
  {
    label: 'Cloud & DevOps',
    skills: ['AWS', 'Azure', 'Google Cloud', 'Docker', 'Kubernetes', 'CI/CD', 'Git', 'GitHub', 'Linux', 'Terraform', 'Jenkins'],
  },
  {
    label: 'Cybersecurity',
    skills: ['Ethical Hacking', 'Network Security', 'Penetration Testing', 'Cryptography'],
  },
  {
    label: 'Design',
    skills: ['UI/UX Design', 'Figma', 'Adobe XD', 'Photoshop', 'Illustrator', 'Video Editing', 'Canva'],
  },
  {
    label: 'Business & Management',
    skills: ['Marketing', 'Digital Marketing', 'Sales', 'Finance', 'Accounting', 'Business Analytics', 'Project Management', 'Product Management', 'HR Management', 'Supply Chain', 'Data Visualization'],
  },
  {
    label: 'General',
    skills: ['Communication', 'Leadership', 'Public Speaking', 'Content Writing', 'SEO'],
  },
];

const ALL_SKILLS: string[] = SKILL_GROUPS.flatMap((g) => g.skills);

const TARGET_ROLES: string[] = [
  'Software Development Engineer (SDE-1)',
  'SDE-2',
  'SDE-3',
  'Frontend Developer',
  'Backend Developer',
  'Full Stack Developer',
  'Mobile App Developer',
  'Data Analyst',
  'Data Scientist',
  'Machine Learning Engineer',
  'AI Engineer',
  'DevOps Engineer',
  'Cloud Engineer',
  'Cybersecurity Analyst',
  'QA Engineer / SDET',
  'UI/UX Designer',
  'Product Manager',
  'Project Manager',
  'Business Analyst',
  'Marketing Manager',
  'Digital Marketing Executive',
  'Financial Analyst',
  'Accountant',
  'HR Executive',
  'Operations Manager',
  'Supply Chain Analyst',
  'Content Writer',
  'Graphic Designer',
  'Research Scientist',
  'Lecturer / Professor',
  'Entrepreneur / Founder',
];

const TARGET_INDUSTRIES: string[] = [
  'Software & Tech',
  'IT Services',
  'FinTech & Banking',
  'E-commerce & Retail',
  'Healthcare & Pharma',
  'Education & EdTech',
  'Media & Entertainment',
  'Manufacturing & Automotive',
  'Agriculture & Food Tech',
  'Hospitality & Tourism',
  'Real Estate & Construction',
  'Logistics & Supply Chain',
  'Energy & Utilities',
  'Government & Public Sector',
  'Consulting',
  'Telecommunications',
  'Gaming',
  'Aerospace & Defence',
  'Non-profit / NGO',
];

// Skills are stored as one comma-separated string — the same shape the
// field always had. The submit payload splits it into an array and the
// auto-save draft stores the same string, so chips are purely a view
// over that string: draft restore and submit need no changes, and a
// restored comma-separated string automatically becomes chips.
function parseSkills(value: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of value.split(',')) {
    const skill = part.trim();
    const key = skill.toLowerCase();
    if (skill && !seen.has(key)) {
      seen.add(key);
      out.push(skill);
    }
  }
  return out;
}

// Chip multi-select for skills. The box looks like the other inputs;
// opening it shows a searchable, grouped dropdown (overlay — the page
// never scrolls for it). Selected skills render as chips inside the
// box, each with a × on its right to remove it. Typing a skill that is
// not in the list and pressing Enter (or the "Add …" row) adds it as a
// custom chip; comma-separated text adds each part. No duplicates.
function SkillsPicker({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const chips = parseSkills(value);

  const addSkills = (names: string[]) => {
    const merged = [...chips];
    const seen = new Set(chips.map((c) => c.toLowerCase()));
    for (const raw of names) {
      const name = raw.trim();
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        merged.push(name);
      }
    }
    onChange(merged.join(', '));
  };

  const removeSkill = (name: string) => {
    onChange(chips.filter((c) => c.toLowerCase() !== name.toLowerCase()).join(', '));
  };

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open ]);

  const q = query.trim().toLowerCase();
  const filteredGroups = SKILL_GROUPS.map((g) => ({
    label: g.label,
    skills: g.skills.filter((s) => !q || s.toLowerCase().includes(q)),
  })).filter((g) => g.skills.length > 0);
  const exactMatch = q !== '' && ALL_SKILLS.some((s) => s.toLowerCase() === q);
  const alreadyAdded = (s: string) => chips.some((c) => c.toLowerCase() === s.toLowerCase());

  const commitQuery = () => {
    const parts = query.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) return;
    addSkills(parts);
    setQuery('');
  };

  return (
    <div ref={containerRef} className="relative">
      <div
        tabIndex={0}
        aria-label="Skills picker. Activate to open the skills list."
        onClick={() => {
          setOpen((o) => !o);
          if (!open) setTimeout(() => searchRef.current?.focus(), 0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(true);
            setTimeout(() => searchRef.current?.focus(), 0);
          }
        }}
        className="w-full min-h-10 lg:min-h-9 px-3 py-1.5 rounded-xl border border-lpu-border bg-white text-sm flex flex-wrap items-center gap-1.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-white"
      >
        {chips.length === 0 && <span className="text-gray-400 px-1">{placeholder}</span>}
        {chips.map((chip) => (
          <span key={chip.toLowerCase()} className="inline-flex items-center gap-1 rounded-full bg-neutral-100 border border-neutral-200 px-2.5 py-0.5 text-[13px] font-medium text-neutral-900">
            {chip}
            <button
              type="button"
              aria-label={`Remove ${chip}`}
              onClick={(e) => {
                e.stopPropagation();
                removeSkill(chip);
              }}
              className="flex items-center justify-center h-4 w-4 rounded-full text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>
      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 rounded-xl border border-lpu-border bg-white shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
            <Search className="h-4 w-4 shrink-0 text-gray-400" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitQuery();
                }
              }}
              placeholder="Search or type a skill, press Enter to add"
              className="w-full h-8 text-sm focus:outline-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1.5">
            {filteredGroups.map((g) => (
              <div key={g.label}>
                <p className="px-2 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-gray-400">{g.label}</p>
                {g.skills.map((s) => {
                  const added = alreadyAdded(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        if (added) removeSkill(s);
                        else addSkills([s]);
                      }}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left text-sm text-gray-800 hover:bg-neutral-100"
                    >
                      <span>{s}</span>
                      {added && <Check className="h-4 w-4 text-neutral-900" />}
                    </button>
                  );
                })}
              </div>
            ))}
            {q !== '' && !exactMatch && (
              <button
                type="button"
                onClick={commitQuery}
                className="w-full px-2 py-2 rounded-lg text-left text-sm font-medium text-neutral-900 hover:bg-neutral-100"
              >
                Add &ldquo;{query.trim()}&rdquo; as a custom skill
              </button>
            )}
            {filteredGroups.length === 0 && q !== '' && (
              <p className="px-2 py-2 text-sm text-gray-400">No matching skills — press Enter to add it as a custom skill.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function OnboardingPage() {
  const { signIn, signUp, user, users } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<'STUDENT' | 'MENTOR'>('STUDENT');
  const [needsRoleSelection, setNeedsRoleSelection] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // True when /me could not be reached at all (backend down): the user is
  // signed in, but no profile could load. Shows a banner instead of
  // bouncing to /login (see refreshAuth).
  const [serverUnreachable, setServerUnreachable] = useState(false);

  // Clerk mock auth states
  const [clerkTab, setClerkTab] = useState<'signin' | 'signup'>('signin');
  const [clerkEmail, setClerkEmail] = useState('');
  const [clerkPassword, setClerkPassword] = useState('');
  const [clerkFirst, setClerkFirst] = useState('');
  const [clerkLast, setClerkLast] = useState('');
  const [clerkRole, setClerkRole] = useState<'STUDENT' | 'MENTOR'>('STUDENT');
  const [clerkError, setClerkError] = useState('');

  // Form inputs
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneCode, setPhoneCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');

  // PIN code auto-fetch (India Post API)
  const [pinCode, setPinCode] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState('');
  
  // Phone OTP verification (real flow lives in PhoneVerificationStep).
  const [phoneVerified, setPhoneVerified] = useState(false);

  // Identity & Academics
  const [regNum, setRegNum] = useState('');
  const [lpuEmail, setLpuEmail] = useState('');
  const [programme, setProgramme] = useState('');
  const [school, setSchool] = useState('');
  // True when the user picked "Other" in the dropdown and is typing a
  // school / programme that is not in the LPU lists. The typed value
  // still lives in `school` / `programme` (the submitted + drafted
  // values); these flags only decide which control is shown. They are
  // UI-only state — on draft restore they are re-derived from whether
  // the restored value is in the list.
  const [schoolIsOther, setSchoolIsOther] = useState(false);
  const [programmeIsOther, setProgrammeIsOther] = useState(false);
  // Same "Other" pattern as school / programme (Step 3): the typed
  // value lives in `targetRole` / `targetIndustry`; these flags only
  // decide which control is shown, and are re-derived on draft restore.
  const [roleIsOther, setRoleIsOther] = useState(false);
  const [industryIsOther, setIndustryIsOther] = useState(false);
  const [campus, setCampus] = useState('Main Campus, Phagwara');
  const [admissionYear, setAdmissionYear] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [currentSemester, setCurrentSemester] = useState('');
  const [currentYear, setCurrentYear] = useState('');
  
  // Career / Professional details
  const [skills, setSkills] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [targetIndustry, setTargetIndustry] = useState('');
  const [careerGoals, setCareerGoals] = useState('');
  
  // Alumni Career (Mentor specific)
  const [currentCompany, setCurrentCompany] = useState('');
  const [currentDesignation, setCurrentDesignation] = useState('');
  const [yearsOfExperience, setYearsOfExperience] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [mentoringAreas, setMentoringAreas] = useState<string[]>([]);
  const [maxMentees, setMaxMentees] = useState('3');
  
  // Preferences & Verification
  const [preferredFrequency, setPreferredFrequency] = useState('Weekly');
  const [mentoringNeeds, setMentoringNeeds] = useState('');
  const [proofDocumentUrl, setProofDocumentUrl] = useState('');
  
  // Consent checkboxes
  const [confirmAccurate, setConfirmAccurate] = useState(false);
  const [confirmBelongs, setConfirmBelongs] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Location Selector Cascading Logic
  const [countriesAndStates, setCountriesAndStates] = useState<any[]>([]);
  const [statesList, setStatesList] = useState<any[]>([]);
  const [citiesList, setCitiesList] = useState<string[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);

  // ── Onboarding auto-save (local draft, per user) ─────────────────────
  // The server has no draft endpoint: PATCH /me only allows firstName /
  // lastName / avatar, and /me returns no city/state/country/pinCode, so
  // the draft lives in localStorage. The key includes the user id so one
  // user's draft never leaks into another's. Server profile data always
  // wins on restore: a draft value only fills a field the server left
  // empty. The draft is cleared only after a successful final submit.
  const draftKey = `mentorly_onboarding_draft_${user?.id || user?.email || 'guest'}`;
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  // Inline validation message for the current step (replaces the old
  // native alert() in handleNext — see themed-alerts, 2026-11-11).
  const [stepError, setStepError] = useState('');
  const hydratedRef = useRef(false);
  // PIN whose location autofill already ran. The PIN effect skips a PIN
  // it already autofilled, so restoring a draft (or re-rendering when
  // the countries list arrives) never re-derives city/state and wipes a
  // manual edit the user made after the autofill. Cleared whenever the
  // user edits the PIN field.
  const pinAutofillForRef = useRef('');

  const buildDraft = useCallback(() => ({
    version: 1,
    savedAt: new Date().toISOString(),
    step,
    role,
    phoneVerified,
    phoneCode,
    phoneNumber,
    firstName,
    lastName,
    pinCode,
    country,
    state,
    city,
    regNum,
    lpuEmail,
    programme,
    school,
    campus,
    admissionYear,
    graduationYear,
    currentSemester,
    currentYear,
    skills,
    targetRole,
    targetIndustry,
    careerGoals,
    currentCompany,
    currentDesignation,
    yearsOfExperience,
    linkedinUrl,
    mentoringAreas,
    maxMentees,
    preferredFrequency,
    mentoringNeeds,
    proofDocumentUrl,
    confirmAccurate,
    confirmBelongs,
  }), [step, role, phoneVerified, phoneCode, phoneNumber, firstName, lastName, pinCode, country, state, city, regNum, lpuEmail, programme, school, campus, admissionYear, graduationYear, currentSemester, currentYear, skills, targetRole, targetIndustry, careerGoals, currentCompany, currentDesignation, yearsOfExperience, linkedinUrl, mentoringAreas, maxMentees, preferredFrequency, mentoringNeeds, proofDocumentUrl, confirmAccurate, confirmBelongs]);

  const saveDraftNow = useCallback(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(buildDraft()));
      setSaveStatus('saved');
      setSavedAt(new Date());
    } catch (err) {
      console.error('Failed to auto-save onboarding draft:', err);
    }
  }, [draftKey, buildDraft]);

  // Debounced auto-save as the user types, and on step/role change.
  // Skipped until the draft has been restored, so the initial empty form
  // never clobbers a saved draft.
  useEffect(() => {
    if (!hydratedRef.current) return;
    setSaveStatus('saving');
    const t = setTimeout(saveDraftNow, 700);
    return () => clearTimeout(t);
  }, [saveDraftNow]);

  // Flush the draft when the tab closes or hides, so the last keystroke
  // survives even without the 700ms debounce.
  useEffect(() => {
    const flush = () => { if (hydratedRef.current) saveDraftNow(); };
    window.addEventListener('beforeunload', flush);
    const onVisibility = () => { if (document.hidden) flush(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [saveDraftNow]);

  // Restore the draft once the server profile has loaded. Server values
  // win: a draft value only fills a field the server left empty
  // (firstName/lastName/email come from /me; PIN, location, phone and
  // steps 2-5 exist only in the draft). Runs once per signed-in user —
  // the owner key re-runs it if the user identity arrives late.
  const restoredForRef = useRef<string | null>(null);
  useEffect(() => {
    if (loading || !isAuthenticated) return;
    const owner = user?.id || user?.email || 'guest';
    if (restoredForRef.current === owner) return;
    restoredForRef.current = owner;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d || typeof d !== 'object') return;
      const fillIfEmpty = (current: string, value: unknown, setter: (v: string) => void) => {
        if (!current && typeof value === 'string' && value) setter(value);
      };
      // Server-first fields (refreshAuth already set these from /me).
      fillIfEmpty(firstName, d.firstName, setFirstName);
      fillIfEmpty(lastName, d.lastName, setLastName);
      fillIfEmpty(lpuEmail, d.lpuEmail, setLpuEmail);
      // Draft-only fields.
      if (typeof d.pinCode === 'string' && d.pinCode) {
        setPinCode(d.pinCode);
        pinAutofillForRef.current = d.pinCode;
      }
      if (typeof d.country === 'string' && d.country) setCountry(d.country);
      if (typeof d.state === 'string' && d.state) setState(d.state);
      if (typeof d.city === 'string' && d.city) setCity(d.city);
      if (typeof d.phoneCode === 'string' && d.phoneCode) setPhoneCode(d.phoneCode);
      if (typeof d.phoneNumber === 'string' && d.phoneNumber) setPhoneNumber(d.phoneNumber);
      if (d.phoneVerified === true) setPhoneVerified(true);
      const fill = (value: unknown, setter: (v: string) => void) => {
        if (typeof value === 'string' && value) setter(value);
      };
      fill(d.regNum, setRegNum);
      // School / programme: a restored value that matches the LPU list
      // selects it in the dropdown; anything else (a value typed when
      // the fields were free text, or typed via "Other") restores into
      // the "Other" free-text input, so no typed value is ever lost.
      if (typeof d.school === 'string' && d.school) {
        setSchool(d.school);
        setSchoolIsOther(!LPU_SCHOOLS.includes(d.school));
      }
      if (typeof d.programme === 'string' && d.programme) {
        const schoolValue = typeof d.school === 'string' ? d.school : '';
        const list = LPU_PROGRAMMES_BY_SCHOOL[schoolValue] ?? [];
        setProgramme(d.programme);
        setProgrammeIsOther(!list.includes(d.programme));
      }
      fill(d.campus, setCampus);
      fill(d.admissionYear, setAdmissionYear);
      fill(d.graduationYear, setGraduationYear);
      fill(d.currentSemester, setCurrentSemester);
      fill(d.currentYear, setCurrentYear);
      fill(d.skills, setSkills);
      // Target role / industry: a restored value that matches the list
      // selects it in the dropdown; anything else (typed when the
      // fields were free text, or typed via "Other") restores into
      // the "Other" free-text input, so no typed value is ever lost.
      // Skills need no such handling — chips derive from the stored
      // comma-separated string, so a restored string becomes chips.
      if (typeof d.targetRole === 'string' && d.targetRole) {
        setTargetRole(d.targetRole);
        setRoleIsOther(!TARGET_ROLES.includes(d.targetRole));
      }
      if (typeof d.targetIndustry === 'string' && d.targetIndustry) {
        setTargetIndustry(d.targetIndustry);
        setIndustryIsOther(!TARGET_INDUSTRIES.includes(d.targetIndustry));
      }
      fill(d.careerGoals, setCareerGoals);
      fill(d.currentCompany, setCurrentCompany);
      fill(d.currentDesignation, setCurrentDesignation);
      fill(d.yearsOfExperience, setYearsOfExperience);
      fill(d.linkedinUrl, setLinkedinUrl);
      fill(d.maxMentees, setMaxMentees);
      fill(d.preferredFrequency, setPreferredFrequency);
      fill(d.mentoringNeeds, setMentoringNeeds);
      fill(d.proofDocumentUrl, setProofDocumentUrl);
      if (Array.isArray(d.mentoringAreas)) setMentoringAreas(d.mentoringAreas.filter((a: unknown) => typeof a === 'string'));
      if (typeof d.confirmAccurate === 'boolean') setConfirmAccurate(d.confirmAccurate);
      if (typeof d.confirmBelongs === 'boolean') setConfirmBelongs(d.confirmBelongs);
      if (typeof d.step === 'number' && d.step >= 1 && d.step <= 5) setStep(d.step);
      // Role from the draft only when no explicit role was found —
      // otherwise the gate / backend role already decided it.
      if (needsRoleSelection && (d.role === 'STUDENT' || d.role === 'MENTOR')) {
        setRole(d.role);
        setNeedsRoleSelection(false);
      }
    } catch (err) {
      console.error('Failed to restore onboarding draft:', err);
    } finally {
      hydratedRef.current = true;
    }
  }, [loading, isAuthenticated, draftKey, user?.id, user?.email]);

  // Rebuild the location dropdown options for restored values once the
  // countries list arrives (it loads async on mount). Runs once.
  const locationListsDoneRef = useRef(false);
  useEffect(() => {
    if (!restoredForRef.current || locationListsDoneRef.current) return;
    if (countriesAndStates.length === 0 || !country) return;
    locationListsDoneRef.current = true;
    const foundCountry = countriesAndStates.find((c: any) => c.name === country);
    if (foundCountry?.states) setStatesList(foundCountry.states);
    if (!state) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`https://countriesnow.space/api/v0.1/countries/state/cities/q?country=${encodeURIComponent(country)}&state=${encodeURIComponent(state)}`);
        const json = await res.json();
        let cities: string[] = !json.error && Array.isArray(json.data) ? json.data : [];
        if (city && !cities.some((c) => c.toLowerCase() === city.toLowerCase())) cities = [city, ...cities];
        if (!cancelled) setCitiesList(cities);
      } catch {
        if (!cancelled && city) setCitiesList([city]);
      }
    })();
    return () => { cancelled = true; };
  }, [countriesAndStates, country, state, city]);

  // Phone verification callbacks (stable identities so
  // PhoneVerificationStep doesn't re-create its handlers each render).
  const handlePhoneVerified = useCallback(() => {
    setPhoneVerified(true);
  }, []);

  const handlePhoneChange = useCallback(({ countryCode, nationalNumber }: { countryCode: string; nationalNumber: string }) => {
    setPhoneCode(countryCode);
    setPhoneNumber(nationalNumber);
  }, []);

  const handleChangePhone = useCallback(() => {
    // Back to entry: the number stays in the field for editing, the
    // verified flag clears, and the draft saves the unverified state.
    setPhoneVerified(false);
  }, []);

  // Fetch countries and states on mount
  useEffect(() => {
    const fetchCountries = async () => {
      setLoadingLocations(true);
      try {
        const res = await fetch('https://countriesnow.space/api/v0.1/countries/states');
        const json = await res.json();
        if (!json.error && json.data) {
          setCountriesAndStates(json.data);
        }
      } catch (err) {
        console.error('Failed to load countries and states:', err);
      } finally {
        setLoadingLocations(false);
      }
    };
    fetchCountries();
  }, []);

  // When Country changes
  const handleCountryChange = (selectedCountry: string) => {
    setCountry(selectedCountry);
    setState('');
    setCity('');
    setStatesList([]);
    setCitiesList([]);

    const foundCountry = countriesAndStates.find(c => c.name === selectedCountry);
    if (foundCountry?.states) {
      setStatesList(foundCountry.states);
    }
  };

  // When State changes
  const handleStateChange = async (selectedState: string) => {
    setState(selectedState);
    setCity('');
    setCitiesList([]);

    if (!selectedState || !country) return;

    setLoadingCities(true);
    try {
      const res = await fetch(`https://countriesnow.space/api/v0.1/countries/state/cities/q?country=${encodeURIComponent(country)}&state=${encodeURIComponent(selectedState)}`);
      const json = await res.json();
      if (!json.error && json.data) {
        setCitiesList(json.data);
      }
    } catch (err) {
      console.error('Failed to load cities:', err);
    } finally {
      setLoadingCities(false);
    }
  };


  const refreshAuth = useCallback(async () => {
    setLoading(true);
    setServerUnreachable(false);
    try {
      const fresh = await userService.getMe();
      if (fresh) {
        setIsAuthenticated(true);
        if (fresh.onboardingStatus === 'APPROVED') {
          router.push(`/app/${fresh.role.toLowerCase().replace('_', '-')}/dashboard`);
        } else if (fresh.onboardingStatus === 'UNDER_REVIEW' || fresh.onboardingStatus === 'SUBMITTED') {
          router.push('/onboarding/status');
        } else if (fresh.onboardingStatus === 'REJECTED' || fresh.onboardingStatus === 'CHANGES_REQUESTED') {
          router.push('/onboarding/review');
        }
        // Determine the explicitly-chosen role (from registration form or a previous selection).
        const localRole = typeof window !== 'undefined' && user?.id
          ? localStorage.getItem(`clerk_role_${user.id}`)
          : null;
        const wClerkUser = typeof window !== 'undefined' ? (window as any).Clerk?.user : null;
        const metaRole = (wClerkUser?.unsafeMetadata?.role ?? '') as string;
        const explicitRole = localRole || metaRole;

        if (explicitRole === 'MENTOR' || explicitRole === 'STUDENT') {
          setRole(explicitRole);
          setNeedsRoleSelection(false);
        } else if (fresh.role === 'PENDING' || fresh.onboardingStatus === 'NOT_STARTED') {
          // Brand-new user with no role choice (e.g. first-time OAuth
          // sign-in) — ask them. This branch used to read
          // `else if (fresh.onboardingStatus)`, which is ALWAYS truthy
          // (the schema defaults it to 'NOT_STARTED'), so the gate below
          // was dead code and every such user was silently captured as
          // STUDENT. The gate must trigger for every user who has not
          // chosen and has not progressed past NOT_STARTED.
          setNeedsRoleSelection(true);
        } else {
          // Onboarding already progressed — trust the backend role.
          setRole(fresh.role === 'MENTOR' ? 'MENTOR' : 'STUDENT');
          setNeedsRoleSelection(false);
        }
        setFirstName(fresh.firstName || '');
        setLastName(fresh.lastName || '');
        // Email seed: the server value is only the Clerk-email seed until
        // the user types their university email. If the auto-save draft
        // already has a typed email, keep it — the restore effect below
        // applies it — instead of overwriting it with the seed on every
        // refresh. firstName/lastName keep the server-wins rule (the
        // Clerk profile is the authority there).
        let draftHasEmail = false;
        try {
          const raw = localStorage.getItem(draftKey);
          const d = raw ? JSON.parse(raw) : null;
          draftHasEmail = typeof d?.lpuEmail === 'string' && !!d.lpuEmail;
        } catch { /* ignore a corrupt draft — restore handles it */ }
        if (!draftHasEmail) setLpuEmail(fresh.lpuEmail || fresh.email || '');
        // Server is the source of truth for a verified phone: /me returns
        // the full user doc incl. phoneDetails (countryCode /
        // nationalNumber / verified) and phoneVerification.status. If the
        // server says verified, restore the number + flag so a refresh
        // keeps the green check without re-verifying.
        if (fresh.phoneDetails?.verified || fresh.phoneVerification?.status === 'VERIFIED') {
          if (fresh.phoneDetails?.nationalNumber) {
            setPhoneCode(fresh.phoneDetails.countryCode || '+91');
            setPhoneNumber(fresh.phoneDetails.nationalNumber);
          }
          setPhoneVerified(true);
        }
      } else {
        // /me returned no user. That is NOT automatically "not signed in":
        // the user just authenticated with Clerk (a cloud service that
        // works while the local backend is down), so a dead backend looks
        // exactly like this. Bouncing to /login here is the login redirect
        // loop. Only go to /login when the backend answers but still has
        // no user for this session (a genuine 401).
        if (!(await userService.isBackendReachable())) {
          setIsAuthenticated(true);
          setServerUnreachable(true);
        } else {
          router.push('/login');
        }
      }
    } catch (err) {
      console.error(err);
      // Same distinction as above: a failed /me call (network error, 401)
      // only means "not signed in" when the backend is actually answering.
      if (!(await userService.isBackendReachable())) {
        setIsAuthenticated(true);
        setServerUnreachable(true);
      } else {
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  }, [user, router]);

  // Run the auth check exactly once per mount. refreshAuth's identity
  // changes on every render (its deps `user` and `router` are fresh objects
  // each render), so an effect depending on it re-ran — and re-pushed
  // /login — on every render. The ref guard makes this a one-shot check;
  // the Retry button re-runs refreshAuth on demand. (The old setTimeout(0)
  // is dropped: getClerkToken already polls the Clerk session up to 3s.)
  const initialCheckDone = useRef(false);
  useEffect(() => {
    if (initialCheckDone.current) return;
    initialCheckDone.current = true;
    refreshAuth();
  }, [refreshAuth]);

  const handleRoleSelect = async (selected: 'STUDENT' | 'MENTOR') => {
    setRole(selected);
    try {
      if (user?.id) {
        localStorage.setItem(`clerk_role_${user.id}`, selected);
      }
      // Persist to Clerk so the choice survives new devices / sessions
      const wClerkUser = typeof window !== 'undefined' ? (window as any).Clerk?.user : null;
      if (wClerkUser?.update) {
        await wClerkUser.update({
          unsafeMetadata: { ...(wClerkUser.unsafeMetadata || {}), role: selected },
        });
      }
    } catch (err) {
      console.error('Failed to persist role selection:', err);
    }
    setNeedsRoleSelection(false);
  };

  // Auto-fetch Country / State / City from PIN code (debounced) and sync cascading dropdowns
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!/^\d{6}$/.test(pinCode)) {
        setPinError('');
        return;
      }
      // Skip when this PIN's autofill already ran — e.g. the values were
      // restored from the auto-save draft (the user may have edited the
      // city after the autofill; re-deriving would silently undo it).
      if (pinCode === pinAutofillForRef.current) return;
      setPinLoading(true);
      setPinError('');

      // Local dictionary lookup for common university PIN codes to bypass slow/unreliable public APIs
      const localPincodes: Record<string, { state: string, city: string }> = {
        '144411': { state: 'Punjab', city: 'Phagwara' },
        '144001': { state: 'Punjab', city: 'Jalandhar' },
        '144002': { state: 'Punjab', city: 'Jalandhar' },
        '144008': { state: 'Punjab', city: 'Jalandhar' },
      };

      if (localPincodes[pinCode]) {
        const localData = localPincodes[pinCode];
        
        // 1) Match country (India)
        const foundCountry = countriesAndStates.find(
          (c: any) => c.name?.toLowerCase() === 'india'
        );
        const states = foundCountry?.states ?? [];
        setCountry(foundCountry?.name ?? 'India');
        setStatesList(states);

        // 2) Match state (Punjab)
        const matchedState = states.find(
          (s: any) => s.name?.toLowerCase() === localData.state.toLowerCase()
        );
        const selectedStateName = matchedState?.name ?? localData.state;
        setState(selectedStateName);

        // 3) Match city (Phagwara / Jalandhar)
        setLoadingCities(true);
        try {
          const citiesRes = await fetch(
            `https://countriesnow.space/api/v0.1/countries/state/cities/q?country=India&state=${encodeURIComponent(selectedStateName)}`
          );
          const citiesJson = await citiesRes.json();
          let cities: string[] = !citiesJson.error && Array.isArray(citiesJson.data) ? citiesJson.data : [];
          if (!cities.some(c => c.toLowerCase() === localData.city.toLowerCase())) {
            cities = [localData.city, ...cities];
          }
          setCitiesList(cities);
        } catch {
          setCitiesList([localData.city]);
        } finally {
          setLoadingCities(false);
        }
        setCity(localData.city);
        pinAutofillForRef.current = pinCode;
        setPinLoading(false);
        return;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 seconds timeout

        const res = await fetch(`https://api.postalpincode.in/pincode/${pinCode}`, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        const data = await res.json();
        const office = data?.[0]?.PostOffice?.[0];
        if (!office) {
          setPinError('No location found for this PIN code. Please fill details manually.');
          return;
        }

        const pinStateName: string = office.State || '';
        const pinCityName: string = office.Block || office.District || '';

        // 1) Match country (postal API serves Indian pincodes)
        const foundCountry = countriesAndStates.find(
          (c: any) => c.name?.toLowerCase() === 'india'
        );
        const states: any[] = foundCountry?.states ?? [];
        setCountry(foundCountry?.name ?? 'India');
        setStatesList(states);

        // 2) Match state within India's states
        const matchedState = states.find(
          (s: any) => s.name?.toLowerCase() === pinStateName.toLowerCase()
        );
        const selectedStateName = matchedState?.name ?? pinStateName;
        setState(selectedStateName);

        // 3) Load cities for that state, then match city (fall back to Block/District)
        setCitiesList([]);
        let finalCity = pinCityName;
        setLoadingCities(true);
        try {
          const citiesRes = await fetch(
            `https://countriesnow.space/api/v0.1/countries/state/cities/q?country=${encodeURIComponent(
              foundCountry?.name ?? 'India'
            )}&state=${encodeURIComponent(selectedStateName)}`
          );
          const citiesJson = await citiesRes.json();
          let cities: string[] = !citiesJson.error && Array.isArray(citiesJson.data) ? citiesJson.data : [];
          const matchedCity = cities.find(
            (c: string) => c.toLowerCase() === pinCityName.toLowerCase()
          );
          if (matchedCity) {
            finalCity = matchedCity;
          } else if (pinCityName) {
            cities = [pinCityName, ...cities];
          }
          setCitiesList(cities);
        } catch {
          setCitiesList(pinCityName ? [pinCityName] : []);
        } finally {
          setLoadingCities(false);
        }
        setCity(finalCity);
        pinAutofillForRef.current = pinCode;
      } catch {
        setPinError('Could not fetch location details. Please fill them manually.');
      } finally {
        setPinLoading(false);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [pinCode, countriesAndStates]);

  // School / programme dropdowns (Step 2). The programme list is
  // filtered by the selected school. Changing the school clears a
  // programme selection that is not offered by the new school (a
  // programme offered by both schools is kept). Picking "Other" in
  // either dropdown reveals a free-text input; the typed value is what
  // gets saved and submitted.
  const handleSchoolChange = (value: string) => {
    if (value === OTHER_OPTION) {
      setSchoolIsOther(true);
      setSchool('');
      // No programme list applies to a custom school: clear the
      // programme and switch it to free-text as well.
      setProgramme('');
      setProgrammeIsOther(true);
      return;
    }
    setSchoolIsOther(false);
    setSchool(value);
    const valid = LPU_PROGRAMMES_BY_SCHOOL[value] ?? [];
    if (programme && !valid.includes(programme)) {
      setProgramme('');
      setProgrammeIsOther(false);
    }
  };

  const handleProgrammeChange = (value: string) => {
    if (value === OTHER_OPTION) {
      setProgrammeIsOther(true);
      setProgramme('');
      return;
    }
    setProgrammeIsOther(false);
    setProgramme(value);
  };

  // Target role / industry dropdowns (Step 3, student). Same
  // "Other" pattern as school / programme: picking Other reveals a
  // free-text input whose value is what gets saved and submitted.
  const handleTargetRoleChange = (value: string) => {
    if (value === OTHER_OPTION) {
      setRoleIsOther(true);
      setTargetRole('');
      return;
    }
    setRoleIsOther(false);
    setTargetRole(value);
  };

  const handleTargetIndustryChange = (value: string) => {
    if (value === OTHER_OPTION) {
      setIndustryIsOther(true);
      setTargetIndustry('');
      return;
    }
    setIndustryIsOther(false);
    setTargetIndustry(value);
  };

  // Proof-document link validation: a mentor's verification link must be
  // a real http(s) URL. Empty means missing; anything that fails URL
  // parsing (or uses another scheme) is malformed. Returns the inline
  // error message to show, or null when the value is acceptable.
  const getProofLinkError = (value: string): string | null => {
    const link = value.trim();
    if (!link) return 'Verification document link is required.';
    try {
      const url = new URL(link);
      if (url.protocol === 'http:' || url.protocol === 'https:') return null;
    } catch {
      // Not a parseable URL — falls through to the error below.
    }
    return 'Please enter a valid link to your verification document, starting with http:// or https://.';
  };

  // Step validation errors render inline above the footer (themed
  // banner), never a native alert() dialog.
  const handleNext = () => {
    if (step === 1 && !phoneVerified) {
      setStepError('Please complete phone verification before proceeding.');
      return;
    }
    if (step === 2 && (!regNum || !lpuEmail)) {
      setStepError('Registration number and email are required.');
      return;
    }
    if (step === 3 && role === 'STUDENT' && parseSkills(skills).length === 0) {
      setStepError('Please add at least one skill.');
      return;
    }
    if (step === 4 && role === 'MENTOR') {
      const proofLinkError = getProofLinkError(proofDocumentUrl);
      if (proofLinkError) {
        setStepError(proofLinkError);
        return;
      }
    }
    setStepError('');
    saveDraftNow();
    setStep(prev => prev + 1);
  };

  const handleSubmit = async () => {
    setSubmitError('');
    if (!confirmAccurate || !confirmBelongs) {
      setSubmitError('Please verify and check the confirmation statements.');
      return;
    }
    if (role === 'MENTOR') {
      const proofLinkError = getProofLinkError(proofDocumentUrl);
      if (proofLinkError) {
        setSubmitError(proofLinkError);
        return;
      }
    }

    const payload = {
      role,
      firstName,
      lastName,
      phone: `${phoneCode}${phoneNumber}`,
      city,
      state,
      country,
      pinCode,
      lpuRegistrationNumber: regNum,
      lpuEmail,
      programme,
      school,
      campus,
      admissionYear,
      graduationYear,
      semester: currentSemester,
      year: currentYear,
      skills: skills.split(',').map(s => s.trim()).filter(Boolean),
      targetRole: targetRole || currentDesignation,
      targetIndustry: targetIndustry || currentCompany,
      careerGoals: careerGoals ? [careerGoals] : [],
      currentCompany,
      currentDesignation,
      yearsOfExperience: parseInt(yearsOfExperience, 10) || 0,
      linkedinUrl,
      expertise: mentoringAreas,
      mentoringAreas,
      maxMentees: parseInt(maxMentees, 10) || 3,
      preferredFrequency,
      mentoringNeeds: mentoringNeeds || 'General guidance',
      proofDocumentUrl,
    };

    try {
      setLoading(true);
      const res = await userService.submitOnboarding(payload);
      if (res && res.onboardingStatus === 'UNDER_REVIEW') {
        try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
        router.push('/onboarding/status');
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit onboarding request.');
      setLoading(false);
    }
  };

  const toggleMentoringArea = (area: string) => {
    if (mentoringAreas.includes(area)) {
      setMentoringAreas(prev => prev.filter(a => a !== area));
    } else {
      setMentoringAreas(prev => [...prev, area]);
    }
  };

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-lpu-bg py-6 lg:py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto space-y-8 animate-pulse">
          {/* Header Skeleton */}
          <div className="text-center space-y-3">
            <div className="h-8 bg-gray-200 rounded-full w-2/3 mx-auto"></div>
            <div className="h-4 bg-gray-200 rounded-full w-1/2 mx-auto"></div>
          </div>

          {/* Steps Indicators Skeleton */}
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-lpu-border shadow-xs">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-gray-200"></div>
                <div className="h-3 bg-gray-200 rounded-full w-12 hidden md:block"></div>
                {i < 5 && <div className="h-0.5 w-8 bg-gray-100 hidden md:block" />}
              </div>
            ))}
          </div>

          {/* Form Body Card Skeleton */}
          <div className="bg-white rounded-3xl border border-lpu-border overflow-hidden shadow-sm">
            <div className="bg-lpu-surface border-b border-lpu-border p-5 space-y-3">
              <div className="h-6 bg-gray-200 rounded-full w-1/3"></div>
              <div className="h-4 bg-gray-200 rounded-full w-2/3"></div>
            </div>
            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded-full w-1/4"></div>
                  <div className="h-10 lg:h-9 bg-gray-100 rounded-xl"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded-full w-1/4"></div>
                  <div className="h-10 lg:h-9 bg-gray-100 rounded-xl"></div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded-full w-1/6"></div>
                <div className="h-10 lg:h-9 bg-gray-100 rounded-xl"></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map((idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded-full w-1/3"></div>
                    <div className="h-10 lg:h-9 bg-gray-100 rounded-xl"></div>
                  </div>
                ))}
              </div>
              <div className="h-10 lg:h-9 bg-gray-200 rounded-xl w-full mt-4"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  {/* Role Selection Gate — shown when the user hasn't explicitly chosen Student or Mentor */}
  if (needsRoleSelection) {
    const roleOptions = [
      {
        value: 'STUDENT' as const,
        icon: <GraduationCap className="h-8 w-8" />,
        title: 'I am a Student',
        tagline: 'Get mentored by alumni',
        points: ['Find verified alumni mentors', 'Get resume & interview help', 'Build a career roadmap'],
      },
      {
        value: 'MENTOR' as const,
        icon: <Briefcase className="h-8 w-8" />,
        title: 'I am an Alumni Mentor',
        tagline: 'Guide students, give back',
        points: ['Share industry experience', 'Review resumes & conduct mock interviews', 'Set your own availability'],
      },
    ];

    return (
      <div className="glass-theme app-shell relative min-h-screen py-6 lg:py-4 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="relative max-w-2xl w-full text-center">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">How will you use Mentorly?</h1>
          <p className="mt-2 text-sm text-lpu-text-secondary">
            Choose your account type to continue. This personalizes your onboarding experience.
          </p>

          <div className="grid sm:grid-cols-2 gap-6 mt-6">
            {roleOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleRoleSelect(option.value)}
                className="group flex flex-col items-center text-left bg-white p-6 rounded-3xl border border-lpu-border shadow-sm hover:border-neutral-300 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-neutral-900"
              >
                <div className="h-14 w-14 rounded-2xl bg-neutral-900 border border-neutral-900 text-white flex items-center justify-center mb-5 transition-colors">
                  {option.icon}
                </div>
                <h3 className="text-lg font-bold text-gray-900">{option.title}</h3>
                <p className="text-sm text-neutral-600 font-semibold mt-1">{option.tagline}</p>
                <ul className="mt-4 space-y-2 w-full">
                  {option.points.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-xs text-lpu-text-secondary">
                      <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      {point}
                    </li>
                  ))}
                </ul>
                <span className="mt-6 inline-flex items-center gap-1 text-sm font-bold text-neutral-900">
                  Continue as {option.value === 'STUDENT' ? 'Student' : 'Mentor'}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </button>
            ))}
          </div>

          <p className="mt-6 text-xs text-lpu-text-muted">
            You can complete verification for your chosen role in the next steps.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-theme app-shell relative min-h-screen lg:h-screen lg:overflow-hidden py-4 lg:py-3 px-4 sm:px-6 lg:px-8">
      <div className="relative max-w-3xl lg:max-w-4xl mx-auto space-y-4 lg:space-y-2.5 lg:h-full lg:flex lg:flex-col">

        {/* Shown when /me could not be reached at all: the user is signed in
            (Clerk), but the local backend is down. Never bounce to /login
            for this — the server just needs starting. */}
        {serverUnreachable && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
            <p className="font-bold">Mentorly server is unreachable</p>
            <p className="mt-1">You are signed in, but your profile could not be loaded because the backend (localhost:3000) is not responding. Start the backend, then retry — do not sign in again.</p>
            <Button type="button" className="mt-2" onClick={() => refreshAuth()}>
              Retry
            </Button>
          </div>
        )}
        
        {/* Onboarding Header */}
        <div className="text-center">
          <h1 className="text-2xl lg:text-xl font-extrabold text-gray-900 tracking-tight">Onboarding & Verification Portal</h1>
          <p className="mt-1 text-xs lg:text-[13px] text-lpu-text-secondary">Complete your profile to gain platform credentials as a verified member.</p>
        </div>

        {/* Steps Indicators — solid dark pill with white / neutral labels.
            The old light pill broke inside .app-shell: its unlayered overrides
            re-skin bg-white to dark glass, text-gray-950 stays near-black and
            text-gray-400 becomes 40%-white, so labels were unreadable grey on
            dark. Every class below is outside the override list, so it renders
            identically with or without .app-shell. Active: light circle, white
            number, bold white label. Completed: mid-grey circle, white check,
            neutral-300 label. Upcoming: outlined circle, neutral-400 label —
            muted but readable, never grey-on-dark-grey. */}
        <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded-2xl px-4 py-2.5 shadow-sm">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <div
                aria-current={step === i ? 'step' : undefined}
                className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-[13px] font-bold transition-colors ${step === i ? 'bg-neutral-100 text-neutral-950 ring-2 ring-white/70' : step > i ? 'bg-neutral-700 text-white' : 'bg-transparent border border-neutral-600 text-neutral-300'}`}
              >
                {step > i ? <Check className="w-4 h-4" /> : i}
              </div>
              <span className={`text-[13px] font-semibold whitespace-nowrap hidden md:inline ml-2 ${step === i ? 'text-white font-bold' : step > i ? 'text-neutral-300' : 'text-neutral-400'}`}>
                {i === 1 ? 'Personal' : i === 2 ? 'Identity' : i === 3 ? 'Professional' : i === 4 ? 'Preferences' : 'Verification'}
              </span>
              {i < 5 && <div className={`h-0.5 flex-1 min-w-4 mx-3 ${step > i ? 'bg-neutral-500' : 'bg-neutral-800'}`} />}
            </div>
          ))}
        </div>

        <Card className="rounded-2xl shadow-sm border border-lpu-border overflow-hidden lg:flex-1 lg:min-h-0 lg:flex lg:flex-col">
          <CardHeader className="bg-lpu-surface border-b border-lpu-border px-5 lg:px-6 py-4 lg:py-3">
            <CardTitle className="text-lg lg:text-base">Step {step}: {
              step === 1 ? 'Personal Details' :
              step === 2 ? 'Identity Verification' :
              step === 3 ? (role === 'STUDENT' ? 'Career Portfolio' : 'Alumni Professional Experience') :
              step === 4 ? (role === 'STUDENT' ? 'Mentorship Intentions' : 'Mentoring Profile') :
              'Review and Declare'
            }</CardTitle>
            <CardDescription>All fields marked with * are required to submit verification.</CardDescription>
          </CardHeader>
          <CardContent className="p-5 lg:p-5 lg:pt-4 space-y-5 lg:space-y-4 lg:flex-1 lg:min-h-0 lg:overflow-y-auto">

            {/* STEP 1: Personal info */}
            {step === 1 && (
              <div className="space-y-5 lg:space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">First Name *</label>
                    <input 
                      type="text" 
                      value={firstName} 
                      onChange={(e) => setFirstName(e.target.value)} 
                      className="w-full h-10 lg:h-9 px-4 rounded-xl border border-lpu-border text-sm focus:outline-none focus:ring-2 focus:ring-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Last Name *</label>
                    <input 
                      type="text" 
                      value={lastName} 
                      onChange={(e) => setLastName(e.target.value)} 
                      className="w-full h-10 lg:h-9 px-4 rounded-xl border border-lpu-border text-sm focus:outline-none focus:ring-2 focus:ring-white"
                    />
                  </div>
                </div>

                {/* PIN Code — auto-fills Country, State & City */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">PIN Code *</label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="e.g. 144411"
                      maxLength={6}
                      value={pinCode}
                      onChange={(e) => { setPinCode(e.target.value.replace(/\D/g, '')); pinAutofillForRef.current = ''; }}
                      className="w-full h-10 lg:h-9 px-4 pr-10 rounded-xl border border-lpu-border text-sm focus:outline-none focus:ring-2 focus:ring-white"
                    />
                    {pinLoading && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-neutral-500" />
                    )}
                  </div>
                  {pinError ? (
                    <p className="text-[11px] text-red-500 mt-1">{pinError}</p>
                  ) : (
                    <p className="text-[11px] text-lpu-text-secondary mt-1">Country, State and City are auto-filled from your PIN code.</p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {/* Country Dropdown */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Country *</label>
                    {countriesAndStates.length > 0 ? (
                      <select
                        value={country}
                        onChange={(e) => handleCountryChange(e.target.value)}
                        className="w-full h-10 lg:h-9 px-4 rounded-xl border border-lpu-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-white"
                      >
                        <option value="">Select Country</option>
                        {countriesAndStates.map((c, idx) => (
                          <option key={`${c.name}-${idx}`} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input 
                        type="text" 
                        value={country} 
                        onChange={(e) => setCountry(e.target.value)} 
                        placeholder={loadingLocations ? "Loading Countries..." : "Enter Country"}
                        className="w-full h-10 lg:h-9 px-4 rounded-xl border border-lpu-border text-sm focus:outline-none focus:ring-2 focus:ring-white"
                      />
                    )}
                  </div>

                  {/* State Dropdown */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">State *</label>
                    {statesList.length > 0 ? (
                      <select
                        value={state}
                        onChange={(e) => handleStateChange(e.target.value)}
                        disabled={!country}
                        className="w-full h-10 lg:h-9 px-4 rounded-xl border border-lpu-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-50"
                      >
                        <option value="">Select State</option>
                        {statesList.map((s, idx) => (
                          <option key={`${s.name || s.state_code}-${idx}`} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input 
                        type="text" 
                        value={state} 
                        onChange={(e) => setState(e.target.value)} 
                        placeholder={!country ? "Select Country First" : "Enter State"}
                        disabled={!country}
                        className="w-full h-10 lg:h-9 px-4 rounded-xl border border-lpu-border text-sm focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-50"
                      />
                    )}
                  </div>

                  {/* City Dropdown */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">City *</label>
                    {citiesList.length > 0 ? (
                      <select
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        disabled={!state}
                        className="w-full h-10 lg:h-9 px-4 rounded-xl border border-lpu-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-50"
                      >
                        <option value="">Select City</option>
                        {citiesList.map((cName, idx) => (
                          <option key={`${cName}-${idx}`} value={cName}>
                            {cName}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input 
                        type="text" 
                        value={city} 
                        onChange={(e) => setCity(e.target.value)} 
                        placeholder={loadingCities ? "Loading Cities..." : !state ? "Select State First" : "Enter City"}
                        disabled={!state}
                        className="w-full h-10 lg:h-9 px-4 rounded-xl border border-lpu-border text-sm focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-50"
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-2 pt-3 lg:pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Phone className="h-4 w-4 text-neutral-900" />
                    <label className="text-xs font-bold text-gray-700 uppercase">Phone Number Verification *</label>
                  </div>
                  {phoneVerified ? (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-gray-700 uppercase">Mobile Number</label>
                      <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white" aria-hidden="true">
                          <Check className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-emerald-700">{phoneCode} {phoneNumber}</p>
                          <p className="text-xs text-emerald-600">This mobile number has been verified</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleChangePhone}
                          className="shrink-0 text-xs font-semibold text-neutral-500 underline hover:text-neutral-900"
                        >
                          Change phone number
                        </button>
                      </div>
                    </div>
                  ) : (
                    <PhoneVerificationStep
                      onVerified={handlePhoneVerified}
                      onPhoneChange={handlePhoneChange}
                      initialCountryCode={phoneCode}
                      initialNationalNumber={phoneNumber}
                    />
                  )}
                </div>
              </div>
            )}



            {/* STEP 2: Identity */}
            {step === 2 && (
              <div className="space-y-5 lg:space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Registration Number *</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 12204567"
                    value={regNum} 
                    onChange={(e) => setRegNum(e.target.value)} 
                    className="w-full h-10 lg:h-9 px-4 rounded-xl border border-lpu-border text-sm focus:outline-none focus:ring-2 focus:ring-white"
                  />
                  <p className="text-[11px] text-lpu-text-secondary mt-1">This registration number will be securely masked on public platform screens (e.g. 122XXXXX).</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Email *</label>
                  <input 
                    type="email" 
                    placeholder="e.g. yourname@email.com"
                    value={lpuEmail} 
                    onChange={(e) => setLpuEmail(e.target.value)} 
                    className="w-full h-10 lg:h-9 px-4 rounded-xl border border-lpu-border text-sm focus:outline-none focus:ring-2 focus:ring-white"
                  />
                </div>
              </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">School / Faculty</label>
                    <select
                      value={schoolIsOther ? OTHER_OPTION : school}
                      onChange={(e) => handleSchoolChange(e.target.value)}
                      className="w-full h-10 lg:h-9 px-4 rounded-xl border border-lpu-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-white"
                    >
                      <option value="">Select School / Faculty</option>
                      {LPU_SCHOOLS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                      <option value={OTHER_OPTION}>{OTHER_OPTION}</option>
                    </select>
                    {schoolIsOther && (
                      <input
                        type="text"
                        value={school}
                        onChange={(e) => setSchool(e.target.value)}
                        placeholder="Enter your school / faculty"
                        className="mt-2 w-full h-10 lg:h-9 px-4 rounded-xl border border-lpu-border text-sm focus:outline-none focus:ring-2 focus:ring-white"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Degree Programme</label>
                    <select
                      value={programmeIsOther ? OTHER_OPTION : programme}
                      onChange={(e) => handleProgrammeChange(e.target.value)}
                      disabled={!school && !schoolIsOther}
                      className="w-full h-10 lg:h-9 px-4 rounded-xl border border-lpu-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-50"
                    >
                      <option value="">{!school && !schoolIsOther ? 'Select School / Faculty First' : 'Select Degree Programme'}</option>
                      {!schoolIsOther && (LPU_PROGRAMMES_BY_SCHOOL[school] ?? []).map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                      <option value={OTHER_OPTION}>{OTHER_OPTION}</option>
                    </select>
                    {programmeIsOther && (
                      <input
                        type="text"
                        value={programme}
                        onChange={(e) => setProgramme(e.target.value)}
                        placeholder="Enter your degree programme"
                        className="mt-2 w-full h-10 lg:h-9 px-4 rounded-xl border border-lpu-border text-sm focus:outline-none focus:ring-2 focus:ring-white"
                      />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Campus</label>
                    <input 
                      type="text" 
                      value={campus} 
                      disabled 
                      className="w-full h-10 lg:h-9 px-4 rounded-xl border border-lpu-border text-sm bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Admission Year</label>
                    <input 
                      type="number" 
                      value={admissionYear} 
                      onChange={(e) => setAdmissionYear(e.target.value)} 
                      className="w-full h-10 lg:h-9 px-4 rounded-xl border border-lpu-border text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Graduation Year</label>
                    <input 
                      type="number" 
                      value={graduationYear} 
                      onChange={(e) => setGraduationYear(e.target.value)} 
                      className="w-full h-10 lg:h-9 px-4 rounded-xl border border-lpu-border text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Career/Profession */}
            {step === 3 && (
              <div className="space-y-5 lg:space-y-4">
                {role === 'STUDENT' ? (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Skills *</label>
                      <SkillsPicker value={skills} onChange={setSkills} placeholder="Select or type skills, e.g. React, TypeScript" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Target Professional Role</label>
                        <select
                          value={roleIsOther ? OTHER_OPTION : targetRole}
                          onChange={(e) => handleTargetRoleChange(e.target.value)}
                          className="w-full h-10 lg:h-9 px-4 rounded-xl border border-lpu-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-white"
                        >
                          <option value="">Select Target Role</option>
                          {TARGET_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                          <option value={OTHER_OPTION}>{OTHER_OPTION}</option>
                        </select>
                        {roleIsOther && (
                          <input
                            type="text"
                            value={targetRole}
                            onChange={(e) => setTargetRole(e.target.value)}
                            placeholder="Enter your target role"
                            className="mt-2 w-full h-10 lg:h-9 px-4 rounded-xl border border-lpu-border text-sm focus:outline-none focus:ring-2 focus:ring-white"
                          />
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Target Industry</label>
                        <select
                          value={industryIsOther ? OTHER_OPTION : targetIndustry}
                          onChange={(e) => handleTargetIndustryChange(e.target.value)}
                          className="w-full h-10 lg:h-9 px-4 rounded-xl border border-lpu-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-white"
                        >
                          <option value="">Select Target Industry</option>
                          {TARGET_INDUSTRIES.map((ind) => (
                            <option key={ind} value={ind}>
                              {ind}
                            </option>
                          ))}
                          <option value={OTHER_OPTION}>{OTHER_OPTION}</option>
                        </select>
                        {industryIsOther && (
                          <input
                            type="text"
                            value={targetIndustry}
                            onChange={(e) => setTargetIndustry(e.target.value)}
                            placeholder="Enter your target industry"
                            className="mt-2 w-full h-10 lg:h-9 px-4 rounded-xl border border-lpu-border text-sm focus:outline-none focus:ring-2 focus:ring-white"
                          />
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Career Goal Statement</label>
                      <textarea 
                        rows={2}
                        placeholder="Detail your career target or specific company objectives..."
                        value={careerGoals} 
                        onChange={(e) => setCareerGoals(e.target.value)} 
                        className="w-full p-4 rounded-xl border border-lpu-border text-sm focus:outline-none"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Current Company *</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Google"
                          value={currentCompany} 
                          onChange={(e) => setCurrentCompany(e.target.value)} 
                          className="w-full h-10 lg:h-9 px-4 rounded-xl border border-lpu-border text-sm focus:outline-none focus:ring-2 focus:ring-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Current Designation *</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Senior Software Architect"
                          value={currentDesignation} 
                          onChange={(e) => setCurrentDesignation(e.target.value)} 
                          className="w-full h-10 lg:h-9 px-4 rounded-xl border border-lpu-border text-sm focus:outline-none focus:ring-2 focus:ring-white"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Years of Industry Experience *</label>
                        <input 
                          type="number" 
                          value={yearsOfExperience} 
                          onChange={(e) => setYearsOfExperience(e.target.value)} 
                          className="w-full h-10 lg:h-9 px-4 rounded-xl border border-lpu-border text-sm focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">LinkedIn Profile Link</label>
                        <input 
                          type="url" 
                          placeholder="https://linkedin.com/in/username"
                          value={linkedinUrl} 
                          onChange={(e) => setLinkedinUrl(e.target.value)} 
                          className="w-full h-10 lg:h-9 px-4 rounded-xl border border-lpu-border text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Skills</label>
                      <SkillsPicker value={skills} onChange={setSkills} placeholder="Select or type skills, e.g. Node.js, AWS" />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* STEP 4: Preferences */}
            {step === 4 && (
              <div className="space-y-5 lg:space-y-4">
                {role === 'STUDENT' ? (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Preferred Mentoring Frequency</label>
                      <select 
                        value={preferredFrequency} 
                        onChange={(e) => setPreferredFrequency(e.target.value)}
                        className="w-full h-10 lg:h-9 px-4 rounded-xl border border-lpu-border text-sm bg-white cursor-pointer focus:outline-none"
                      >
                        <option value="Weekly">Weekly (1 session per week)</option>
                        <option value="Bi-Weekly">Bi-Weekly (Every 2 weeks)</option>
                        <option value="Monthly">Monthly</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Specific Area Where Mentorship is Needed *</label>
                      <textarea 
                        rows={2}
                        placeholder="Describe what guidance or goals you would like your alumni mentor to help you with..."
                        value={mentoringNeeds} 
                        onChange={(e) => setMentoringNeeds(e.target.value)} 
                        className="w-full p-4 rounded-xl border border-lpu-border text-sm focus:outline-none focus:ring-2 focus:ring-white"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-2">Areas of Mentoring Expertise (Select multiple)</label>
                      <div className="flex flex-wrap gap-2">
                        {['Software Development', 'System Design', 'AI/ML & Data Science', 'Product Management', 'UI/UX Design', 'Resume Review', 'Interview Prep', 'Career Transition', 'Competitive Programming'].map((area) => (
                          <button
                            key={area}
                            type="button"
                            onClick={() => toggleMentoringArea(area)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${mentoringAreas.includes(area) ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-gray-700 border-gray-200'}`}
                          >
                            {area}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Max Capacity (Students) *</label>
                        <input 
                          type="number" 
                          value={maxMentees} 
                          onChange={(e) => setMaxMentees(e.target.value)} 
                          className="w-full h-10 lg:h-9 px-4 rounded-xl border border-lpu-border text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Verification Document Link (Degree/Alumni Card URL) *</label>
                        <input 
                          type="text" 
                          placeholder="Enter link to verification proof"
                          value={proofDocumentUrl} 
                          onChange={(e) => setProofDocumentUrl(e.target.value)} 
                          className="w-full h-10 lg:h-9 px-4 rounded-xl border border-lpu-border text-sm focus:outline-none focus:ring-2 focus:ring-white"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* STEP 5: Review & Submit */}
            {step === 5 && (
              <div className="space-y-5 lg:space-y-4">
                <div className="p-4 bg-lpu-bg rounded-2xl border border-lpu-border space-y-3 text-sm text-lpu-text-primary">
                  <h4 className="font-bold border-b border-lpu-border pb-1.5 text-base">Summary Review</h4>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                    <p className="text-lpu-text-secondary">Name:</p>
                    <p className="font-semibold">{firstName} {lastName}</p>
                    
                    <p className="text-lpu-text-secondary">Registration:</p>
                    <p className="font-semibold">{regNum ? `${regNum.substring(0, 3)}XXXXXX` : 'N/A'}</p>
                    
                    <p className="text-lpu-text-secondary">Verified Phone:</p>
                    <p className="font-semibold">{phoneCode} {phoneNumber}</p>
                    
                    <p className="text-lpu-text-secondary">Selected Role:</p>
                    <p className="font-semibold">{role}</p>

                    <p className="text-lpu-text-secondary">Email:</p>
                    <p className="font-semibold">{lpuEmail}</p>

                    <p className="text-lpu-text-secondary">Degree & School:</p>
                    <p className="font-semibold">{programme} - {school}</p>
                  </div>
                </div>

                <div className="space-y-2 pt-3 lg:pt-2 border-t border-gray-100">
                  <div className="flex items-start gap-3">
                    <input 
                      type="checkbox"
                      id="confirmAccurate"
                      checked={confirmAccurate}
                      onChange={(e) => setConfirmAccurate(e.target.checked)}
                      className="rounded border-gray-300 accent-neutral-900 focus:ring-neutral-900 mt-1 cursor-pointer"
                    />
                    <label htmlFor="confirmAccurate" className="text-xs text-lpu-text-secondary select-none cursor-pointer">
                      I confirm that the information provided is accurate and all graduation/registration fields are correct.
                    </label>
                  </div>

                  <div className="flex items-start gap-3">
                    <input 
                      type="checkbox"
                      id="confirmBelongs"
                      checked={confirmBelongs}
                      onChange={(e) => setConfirmBelongs(e.target.checked)}
                      className="rounded border-gray-300 accent-neutral-900 focus:ring-neutral-900 mt-1 cursor-pointer"
                    />
                    <label htmlFor="confirmBelongs" className="text-xs text-lpu-text-secondary select-none cursor-pointer">
                      I confirm that the registration number provided belongs to me.
                    </label>
                  </div>
                </div>

                {submitError && <p className="text-xs text-red-500 font-semibold">{submitError}</p>}
              </div>
            )}

          </CardContent>
          {stepError && (
            <div className="border-t border-red-200 bg-red-50 px-5 lg:px-6 py-3 text-sm text-red-700" role="alert">
              {stepError}
            </div>
          )}
          <div className="bg-lpu-bg border-t border-lpu-border px-5 lg:px-6 py-4 lg:py-3 flex items-center justify-between gap-4">
            {step > 1 ? (
              <Button variant="outline" onClick={() => { setStepError(''); saveDraftNow(); setStep(prev => prev - 1); }} className="rounded-xl h-10 lg:h-9 px-6 bg-white">
                Back
              </Button>
            ) : <div />}
            <p className="hidden sm:block text-xs text-neutral-400" aria-live="polite">
              {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' && savedAt ? `Saved ${savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
            </p>
            {step < 5 ? (
              <Button onClick={handleNext} className="rounded-xl h-10 lg:h-9 px-8">
                Continue
              </Button>
            ) : (
              <Button onClick={handleSubmit} className="rounded-xl h-10 lg:h-9 px-8">
                Submit for Verification
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
