"use client"

import { useState, useEffect } from 'react';
import { X, ChevronRight, MessageCircle } from 'lucide-react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';

// Mascot name
const MASCOT_NAME = "Sky";

type UserRole = 'student' | 'adviser' | 'admin' | 'member' | 'manager';

interface GuideStep {
  title: string;
  text: string;
  image: string;
  roles?: UserRole[];
}

// Page-specific guides for different roles
const PAGE_GUIDES: Record<string, GuideStep> = {
  // Portal Home - Welcome message
  '/': {
    title: "Welcome to ScholarFlow!",
    text: `Hello, I am ${MASCOT_NAME} and I am here to guide you throughout this whole site, but I will not be restrictive as I will give you freedom to choose wherever, so click what interests you the most!`,
    image: "/mascot.png"
  },
  // Academic Portal Welcome
  '/scholar/dashboard': {
    title: "Welcome to Academic Portal!",
    text: "This is your Academic Dashboard! Here you can see AI-powered insights about your courses, track consultation logs, and get personalized recommendations for your academic journey.",
    image: "/mascot.png"
  },
  // Academic Dashboard - Student specific
  '/scholar/dashboard/student': {
    title: "Your Academic Dashboard",
    text: "Welcome to your Academic Dashboard! Here you can see all your enrolled courses, view AI-powered insights about your group's progress, and track upcoming consultation schedules. The insights section shows personalized recommendations for your capstone journey.",
    image: "/mascot.png",
    roles: ['student', 'member']
  },
  // Academic Dashboard - Adviser/Admin specific  
  '/scholar/dashboard/adviser': {
    title: "Adviser Dashboard",
    text: "Welcome to the Adviser Dashboard! Here you can monitor all your assigned groups, track their consultation progress, and view AI-generated insights about group performance. You'll also see risk alerts for groups that may need additional support.",
    image: "/mascot.png",
    roles: ['adviser', 'admin', 'manager']
  },
  // Courses - Student
  '/scholar/courses/student': {
    title: "Your Courses",
    text: "This is the Courses page! Here you can see all your enrolled courses. Each course card shows important details like course code and section. If you need to join a new course, click 'Enroll' and enter the course key provided by your adviser.",
    image: "/mascot-thinking.png",
    roles: ['student', 'member']
  },
  // Courses - Adviser/Admin
  '/scholar/courses/adviser': {
    title: "Course Management",
    text: "This is the Courses management page! Here you can view all courses in the system. As an adviser, you can see which courses have groups without advisers assigned. Admins can also create new courses and generate enrollment keys for students.",
    image: "/mascot-thinking.png",
    roles: ['adviser', 'admin', 'manager']
  },
  // Schedule - Student (Consultation Schedule/Booking)
  '/scholar/booking': {
    title: "Book Consultations",
    text: "This is where you book consultation slots with your adviser! Browse available time slots, select a convenient time, and submit your booking request. Make sure to prepare your questions or concerns before the meeting.",
    image: "/mascot.png",
    roles: ['student', 'member']
  },
  // Schedule - Adviser (My Schedule)
  '/scholar/schedule': {
    title: "Manage Your Schedule",
    text: "This is your consultation schedule management page! Here you can set your available time slots for students to book, view upcoming confirmed consultations, and manage your availability throughout the semester.",
    image: "/mascot.png",
    roles: ['adviser', 'admin', 'manager']
  },
  // Calendar - Student
  '/scholar/calendar/student': {
    title: "Academic Calendar",
    text: "This calendar shows all important academic events, deadlines, and scheduled consultations. You can view events but cannot edit them - that's for admins and advisers. Check this regularly to stay on top of important dates!",
    image: "/mascot-thinking.png",
    roles: ['student', 'member']
  },
  // Calendar - Adviser/Admin
  '/scholar/calendar/adviser': {
    title: "Manage Academic Calendar",
    text: "This is the Academic Calendar where you can create and manage events for your students. Add important deadlines, consultation periods, and milestone dates. Students will see these events in their read-only view.",
    image: "/mascot-thinking.png",
    roles: ['adviser', 'admin', 'manager']
  },
  // Workspace Sync - Admin only
  '/scholar/workspace-sync': {
    title: "Google Workspace Sync",
    text: "This is the Workspace Sync page for administrators! Here you can connect Google Workspace resources, manage shared drives, and configure automatic synchronization of documents and calendars across the academic portal.",
    image: "/mascot-thinking.png",
    roles: ['admin']
  },
  // PM Side - Dashboard
  '/dashboard': {
    title: "Welcome to Project Management!",
    text: "Welcome to the Project Management workspace! This is where you manage your capstone or research projects. You can track tasks, collaborate with team members, and monitor project progress using our Kanban boards and AI-powered insights.",
    image: "/mascot.png"
  },
  // PM Dashboard - Member/Student
  '/dashboard/member': {
    title: "Your Project Dashboard",
    text: "This is your Project Dashboard! Here you can see all your assigned tasks, track upcoming deadlines, and view team progress. The AI Insights section provides personalized recommendations to help you stay on track with your project milestones.",
    image: "/mascot.png",
    roles: ['student', 'member']
  },
  // PM Dashboard - Manager/Adviser
  '/dashboard/manager': {
    title: "Project Management Dashboard",
    text: "This is your Project Management Dashboard! As a manager or adviser, you can oversee multiple teams, track their progress across various projects, and use AI insights to identify teams that may need support or intervention.",
    image: "/mascot.png",
    roles: ['adviser', 'admin', 'manager']
  },
  // Boards
  '/boards': {
    title: "Team Boards",
    text: "This is the Team Boards page! Here you can see an overview of all your teams. Click on any team card to see detailed information including members, current project status, checkpoints, and recent activity.",
    image: "/mascot-thinking.png"
  },
  // Tasks
  '/tasks': {
    title: "Task Management",
    text: "This is the Task Management workspace! Use the Kanban board to create tasks, assign them to team members, and track progress from 'To Do' to 'Done'. You can drag and drop tasks between columns to update their status.",
    image: "/mascot.png"
  },
  // Team
  '/team': {
    title: "Team Members",
    text: "This page shows all members of your organization or team. You can see their roles, contact information, and current assignments. Managers can also invite new members or update existing member permissions here.",
    image: "/mascot-thinking.png"
  },
  // PM Calendar
  '/calendar': {
    title: "Project Calendar",
    text: "This is your Project Calendar! View all team events, meetings, and deadlines in one place. It syncs with Google Calendar so your schedules stay up to date automatically.",
    image: "/mascot.png"
  },
  // PM Drive
  '/drive': {
    title: "Google Drive",
    text: "This is the Drive integration! Access your team's shared Google Drive files directly from here. Browse folders, view documents, and stay organized without leaving ScholarFlow.",
    image: "/mascot-thinking.png"
  },
  // PM Sheets (Manager/Admin only)
  '/sheets': {
    title: "Google Sheets",
    text: "This is the Sheets integration for managers and admins! Import your Work Breakdown Structure (WBS) from Google Sheets to automatically generate tasks with proper hierarchy and assignments.",
    image: "/mascot-thinking.png",
    roles: ['adviser', 'admin', 'manager']
  },
  // PM Analytics (Manager/Admin only)
  '/analytics': {
    title: "Project Analytics",
    text: "This is the Analytics dashboard! View detailed charts and metrics about your team's performance, task completion rates, sprint velocity, and project health. Use these insights to make data-driven decisions.",
    image: "/mascot.png",
    roles: ['adviser', 'admin', 'manager']
  },
  // PM Settings (Manager/Admin only)
  '/settings': {
    title: "Organization Settings",
    text: "This is the Settings page where managers and admins can configure organization details, manage team preferences, and customize the workspace to fit your project needs.",
    image: "/mascot-thinking.png",
    roles: ['adviser', 'admin', 'manager']
  },
  // Academic Calendar (generic fallback)
  '/scholar/calendar': {
    title: "Academic Calendar",
    text: "This is the Academic Calendar! View important academic events, deadlines, and consultation schedules all in one place. Stay on top of key dates throughout the semester.",
    image: "/mascot-thinking.png"
  }
};

// Admin panel pages
const ADMIN_PAGES: Record<string, GuideStep> = {
  '/scholar/admin/accounts': {
    title: "Accounts Management",
    text: "This is the Accounts Management page for administrators! Here you can create new accounts, manage existing users, assign roles (Admin, Adviser, Student), and handle account-related issues across the ScholarSync system.",
    image: "/mascot-thinking.png",
    roles: ['admin']
  },
  '/scholar/admin/data-integrity': {
    title: "Data Integrity",
    text: "This page helps administrators ensure data consistency across the system. You'll see alerts for groups without advisers, courses without assigned groups, and other data issues that need attention to maintain a healthy academic workflow.",
    image: "/mascot-thinking.png",
    roles: ['admin']
  },
  '/scholar/admin/adviser-availability': {
    title: "Adviser Availability",
    text: "This page shows the availability status of all advisers in the system. You can see their current workload, how many groups they're advising, and their consultation schedule availability. Useful for balancing adviser assignments.",
    image: "/mascot-thinking.png",
    roles: ['admin']
  },
  '/scholar/admin/semester-readiness': {
    title: "Semester Readiness",
    text: "This dashboard helps you prepare for a new semester! Check if all courses have assigned advisers, if groups are properly formed, and if the system is ready for student enrollment. It provides a readiness score and actionable items.",
    image: "/mascot-thinking.png",
    roles: ['admin']
  }
};

// Adviser-specific pages
const ADVISER_PAGES: Record<string, GuideStep> = {
  '/scholar/adviser/follow-ups': {
    title: "Follow-ups Management",
    text: "This page helps you track and manage follow-ups with your advisee groups. You can see which groups need attention, record follow-up actions, and ensure no group falls through the cracks during the capstone process.",
    image: "/mascot-thinking.png",
    roles: ['adviser', 'admin', 'manager']
  }
};

// Combine all page guides
const ALL_PAGE_GUIDES: Record<string, GuideStep> = {
  ...PAGE_GUIDES,
  ...ADMIN_PAGES,
  ...ADVISER_PAGES
};

interface OnboardingState {
  hasSeenWelcome: boolean;
  visitedPages: string[];
  lastRole?: string;
}

function normalizeRole(value: unknown): UserRole {
  const role = String(value || '').trim().toLowerCase();
  if (role === 'admin') return 'admin';
  if (role === 'adviser' || role === 'advisers' || role === 'manager') return 'adviser';
  if (role === 'student') return 'student';
  return 'member';
}

function getEffectiveRole(): UserRole {
  if (typeof window === 'undefined') return 'member';
  
  // Try scholar profile first
  const scholarProfile = localStorage.getItem('scholar_profile');
  if (scholarProfile) {
    try {
      const profile = JSON.parse(scholarProfile);
      const role = normalizeRole(profile.scholarsyncRole || profile.role || profile.accountRole);
      if (role) return role;
    } catch { }
  }
  
  // Try JWT token
  const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
  if (token) {
    try {
      const decoded: any = jwtDecode(token);
      const role = normalizeRole(decoded.scholarsyncRole || decoded.role);
      if (role) return role;
    } catch { }
  }
  
  // Try user object
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      const role = normalizeRole(user.scholarsyncRole || user.role);
      if (role) return role;
    } catch { }
  }
  
  return 'member';
}

function getGuideKey(pathname: string, role: UserRole): string | null {
  // Check for exact match first
  if (ALL_PAGE_GUIDES[pathname]) {
    const guide = ALL_PAGE_GUIDES[pathname];
    if (!guide.roles || guide.roles.includes(role)) {
      return pathname;
    }
  }
  
  // Check for role-specific variants
  const roleKey = `${pathname}/${role}`;
  if (PAGE_GUIDES[roleKey]) {
    return roleKey;
  }
  
  // For Academic portal pages without role-specific guides, try the base path
  if (pathname.startsWith('/scholar/')) {
    // Try to match the base scholar path
    const basePath = pathname.split('/').slice(0, 3).join('/');
    if (ALL_PAGE_GUIDES[basePath]) {
      const guide = ALL_PAGE_GUIDES[basePath];
      if (!guide.roles || guide.roles.includes(role)) {
        return basePath;
      }
    }
  }
  
  return null;
}

function loadOnboardingState(): OnboardingState {
  if (typeof window === 'undefined') return { hasSeenWelcome: false, visitedPages: [] };
  try {
    const saved = localStorage.getItem('scholarflow_onboarding');
    if (saved) return JSON.parse(saved);
  } catch (_e) { /* ignore */ }
  return { hasSeenWelcome: false, visitedPages: [] };
}

function saveOnboardingState(state: OnboardingState) {
  try {
    localStorage.setItem('scholarflow_onboarding', JSON.stringify(state));
  } catch (_e) { /* ignore */ }
}

export default function InteractiveGuide() {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [currentStep, setCurrentStep] = useState<GuideStep | null>(null);
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('member');
  const [loaded, setLoaded] = useState(false);

  // Load user role on mount and mark as loaded
  useEffect(() => {
    setUserRole(getEffectiveRole());
    setLoaded(true);
  }, []);

  // Handle route changes - only after localStorage is ready
  useEffect(() => {
    if (!pathname || !loaded) return;

    const role = getEffectiveRole();
    setUserRole(role);

    // Always read fresh from localStorage to avoid stale state
    const state = loadOnboardingState();

    const guideKey = getGuideKey(pathname, role);
    if (!guideKey) return;

    const guide = ALL_PAGE_GUIDES[guideKey];

    if (guideKey === '/') {
      if (state.hasSeenWelcome) return;
      const next = { ...state, hasSeenWelcome: true };
      saveOnboardingState(next);
      setCurrentStep(guide);
      setIsVisible(true);
      setIsMinimized(false);
      return;
    }

    if (state.visitedPages.includes(pathname)) return;

    const next = { ...state, visitedPages: [...state.visitedPages, pathname] };
    saveOnboardingState(next);
    setCurrentStep(guide);
    setIsVisible(true);
    setIsMinimized(false);
  }, [pathname, loaded]);

  // Typewriter effect
  useEffect(() => {
    if (!isVisible || isMinimized || !currentStep) return;
    
    setIsTyping(true);
    setDisplayedText("");
    
    let i = 0;
    const text = currentStep.text;
    const speed = 25; // ms per character
    
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayedText(text.substring(0, i + 1));
        i++;
      } else {
        setIsTyping(false);
        clearInterval(timer);
      }
    }, speed);
    
    return () => clearInterval(timer);
  }, [currentStep, isVisible, isMinimized]);

  const handleDismiss = () => {
    setIsVisible(false);
    setIsMinimized(false);
  };

  const handleMinimize = () => {
    setIsMinimized(true);
  };

  const handleResume = () => {
    setIsMinimized(false);
    setIsVisible(true);
  };

  const handleFinishTyping = () => {
    if (isTyping && currentStep) {
      setDisplayedText(currentStep.text);
      setIsTyping(false);
    }
  };

  // Don't render if no current step or not visible
  if (!isVisible && !isMinimized) return null;

  // Minimized state - floating button
  if (isMinimized) {
    return (
      <button 
        onClick={handleResume}
        className="fixed bottom-6 left-6 z-[9999] p-4 bg-emerald-500 text-white rounded-full shadow-2xl hover:scale-110 transition-transform animate-bounce"
        title={`Resume - ${MASCOT_NAME} is here to help!`}
      >
        <MessageCircle size={28} />
      </button>
    );
  }

  if (!currentStep) return null;

  return (
    <div className="fixed bottom-6 left-6 z-[9999] flex flex-row-reverse items-end gap-4 max-w-[500px] animate-in slide-in-from-bottom-8 duration-500">
      
      {/* Dialogue Box */}
      <div className="bg-white dark:bg-slate-900 border-2 border-emerald-500/30 rounded-3xl p-6 shadow-2xl relative mb-8">
        {/* Triangle pointer */}
        <div className="absolute -left-3 bottom-10 w-6 h-6 bg-white dark:bg-slate-900 border-b-2 border-l-2 border-emerald-500/30 transform rotate-45 z-[-1]"></div>
        
        <div className="flex justify-between items-center mb-3">
            <h3 className="font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest text-xs">
              {currentStep.title}
            </h3>
            <div className="flex gap-2">
                <button onClick={handleMinimize} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                    <span className="text-xl leading-none">-</span>
                </button>
                <button onClick={handleDismiss} className="text-gray-400 hover:text-rose-500">
                    <X size={16} />
                </button>
            </div>
        </div>
        
        <p 
          className="text-sm text-gray-700 dark:text-gray-300 min-h-[60px] leading-relaxed font-medium cursor-pointer"
          onClick={handleFinishTyping}
        >
          {displayedText}
          {isTyping && <span className="inline-block w-2 h-4 ml-1 bg-emerald-500 animate-pulse"></span>}
        </p>
        
        <div className="mt-4 flex justify-between items-center">
            <span className="text-xs font-bold text-gray-400">
                {MASCOT_NAME} • Click text to speed up
            </span>
            <button 
              onClick={handleDismiss}
              className="flex items-center gap-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-all active:scale-95"
            >
              Got it!
              <ChevronRight size={14} />
            </button>
        </div>
      </div>

      {/* Mascot Image */}
      <div className="relative w-36 h-48 flex-shrink-0 animate-in slide-in-from-right-8 duration-700">
        <div className="absolute inset-0 bg-emerald-500/10 blur-2xl rounded-full"></div>
        <Image 
          src={currentStep.image || "/mascot.png"} 
          alt={`${MASCOT_NAME} - ScholarFlow Guide`} 
          fill
          className="object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-500 relative z-10"
        />
      </div>
    </div>
  );
}
