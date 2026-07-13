import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Instagram, 
  DollarSign, 
  CheckCircle, 
  XCircle, 
  Menu, 
  User, 
  Shield, 
  Download, 
  TrendingUp, 
  RefreshCw, 
  Send, 
  Wallet,
  Settings,
  Grid,
  Clipboard,
  Trash2,
  AlertCircle,
  Users,
  Database,
  List,
  Facebook
} from 'lucide-react';
import { generateCredentials, getTotpCode, getTotpRemainingSeconds } from './utils';
import { 
  addSubmission, 
  getSubmissions, 
  updateSubmissionStatus, 
  deleteSubmission,
  addWithdrawal, 
  getWithdrawals, 
  updateWithdrawalStatus, 
  getSettings, 
  saveSettings,
  saveUserProfile,
  getUserProfile,
  getAllUserProfiles,
  clearAllSubmissions,
  clearSubmissionsByCategory,
  clearAllWithdrawals,
  clearAllUserProfiles,
  updateSubmissionSubmittedBy,
  Submission,
  Withdrawal,
  AppSettings,
  UserProfile
} from './firebaseService';

import AdminFacebook from './components/AdminFacebook';
import AdminInstagram from './components/AdminInstagram';
import AdminBot from './components/AdminBot';

export default function App() {
  // Navigation & Role State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'instagram' | 'withdraw' | 'admin_facebook' | 'admin_instagram' | 'admin_withdrawals' | 'admin_bot'>('dashboard');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Facebook and Instagram Admin sub-tab states
  const [fbSubTab, setFbSubTab] = useState<'submissions' | 'summary' | 'settings' | 'clear'>('submissions');
  const [igSubTab, setIgSubTab] = useState<'submissions' | 'summary' | 'settings' | 'clear'>('submissions');

  // Admin Login Security States
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);

  // Auto admin login from sessionStorage
  useEffect(() => {
    const savedAdmin = sessionStorage.getItem("is_admin_logged_in") === "true";
    if (savedAdmin) {
      setIsAdmin(true);
    }
  }, []);

  const handleAdminToggle = () => {
    if (isAdmin) {
      setIsAdmin(false);
      sessionStorage.removeItem("is_admin_logged_in");
      if (activeTab.startsWith('admin_')) {
        setActiveTab('dashboard');
      }
    } else {
      setAdminPasswordInput('');
      setLoginError('');
      setShowLoginModal(true);
    }
  };

  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPasswordInput) {
      setLoginError("পাসওয়ার্ড প্রদান করুন!");
      return;
    }
    setIsVerifyingPassword(true);
    setLoginError("");
    try {
      const response = await fetch("/api/admin/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPasswordInput })
      });
      const data = await response.json();
      if (data.success) {
        setIsAdmin(true);
        sessionStorage.setItem("is_admin_logged_in", "true");
        setShowLoginModal(false);
        setActiveTab('admin_facebook');
      } else {
        setLoginError("❌ ভুল পাসওয়ার্ড! অনুগ্রহ করে আবার চেষ্টা করুন।");
      }
    } catch (err) {
      setLoginError("সার্ভার কানেকশন ত্রুটি! অনুগ্রহ করে আবার চেষ্টা করুন।");
    } finally {
      setIsVerifyingPassword(false);
    }
  };
  
  // User Permanent Wallet States
  const [userWalletNumber, setUserWalletNumber] = useState(() => {
    return localStorage.getItem("user_wallet_number") || "";
  });
  const [userWalletType, setUserWalletType] = useState<'bKash' | 'Nagad' | 'Rocket'>(() => {
    return (localStorage.getItem("user_wallet_type") as 'bKash' | 'Nagad' | 'Rocket') || 'bKash';
  });

  // Active Viewed Wallet Profile
  const [activeWalletNumber, setActiveWalletNumber] = useState(() => {
    return localStorage.getItem("active_wallet_number") || localStorage.getItem("user_wallet_number") || "";
  });
  const [activeWalletType, setActiveWalletType] = useState<'bKash' | 'Nagad' | 'Rocket'>('bKash');
  const [activeProfile, setActiveProfile] = useState<UserProfile | null>(null);

  // Keep workerName synchronized for backward compatible stats calculation
  const [workerName, setWorkerName] = useState(() => {
    return localStorage.getItem("active_wallet_number") || localStorage.getItem("user_wallet_number") || "";
  });

  // App Config & Pricing
  const [settings, setAppSettings] = useState<AppSettings>({
    ratePerId: 45,
    telegramBotToken: "",
    telegramChatId: "",
    adminPassword: "admin123",
    usernamePrefix: "",
    dailyPassword: "",
    minWithdraw: 50,
    instagramWorkActive: true
  });

  // DB Data States
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  
  const adminCategory = useMemo<'instagram' | 'facebook'>(() => {
    if (activeTab === 'admin_facebook') return 'facebook';
    return 'instagram';
  }, [activeTab]);

  const categoryFilteredSubmissions = useMemo(() => {
    return submissions.filter(sub => {
      const cat = sub.category || 'instagram';
      return cat === adminCategory;
    });
  }, [submissions, adminCategory]);

  const categoryGroupedSubmissions = useMemo(() => {
    const groups: Record<string, {
      worker: string;
      submissions: Submission[];
      total: number;
      approved: number;
      pending: number;
      rejected: number;
    }> = {};

    categoryFilteredSubmissions.forEach((sub) => {
      const worker = sub.submittedBy || 'Unknown Worker';
      if (!groups[worker]) {
        groups[worker] = {
          worker,
          submissions: [],
          total: 0,
          approved: 0,
          pending: 0,
          rejected: 0
        };
      }
      groups[worker].submissions.push(sub);
      groups[worker].total++;
      if (sub.status === 'approved') groups[worker].approved++;
      else if (sub.status === 'pending') groups[worker].pending++;
      else if (sub.status === 'rejected') groups[worker].rejected++;
    });

    return Object.values(groups);
  }, [categoryFilteredSubmissions]);

  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);

  // Onboarding setup states
  const [setupNumber, setSetupNumber] = useState('');
  const [setupType, setSetupType] = useState<'bKash' | 'Nagad' | 'Rocket'>('bKash');

  // Active Task States
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(null);
  const [twoFactorKey, setTwoFactorKey] = useState('');
  const [generatedCode, setGeneratedCode] = useState('------');
  const [totpCountdown, setTotpCountdown] = useState(30);
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [copiedField, setCopiedField] = useState<'user' | 'pass' | 'code' | null>(null);

  // Bulk Selection States
  const [selectedSubIds, setSelectedSubIds] = useState<string[]>([]);
  const [selectedWithIds, setSelectedWithIds] = useState<string[]>([]);
  const [pastedUsernamesText, setPastedUsernamesText] = useState('');
  const [adminSubTab, setAdminSubTab] = useState<'all' | 'user_summary' | 'db_control'>('all');
  const [expandedWorker, setExpandedWorker] = useState<string | null>(null);
  const [isClearingSubmissions, setIsClearingSubmissions] = useState(false);
  const [isClearingWithdrawals, setIsClearingWithdrawals] = useState(false);
  const [isClearingProfiles, setIsClearingProfiles] = useState(false);
  const [clearConfirmationText, setClearConfirmationText] = useState('');
  const [dbMessage, setDbMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [workerSearchQuery, setWorkerSearchQuery] = useState('');
  const [bulkPasteResult, setBulkPasteResult] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Telegram Broadcast States
  const [broadcastMessageText, setBroadcastMessageText] = useState('');
  const [broadcastStatus, setBroadcastStatus] = useState<{ type: 'success' | 'error' | 'sending'; text: string } | null>(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // Withdrawal Form States
  const [withdrawMethod, setWithdrawMethod] = useState<'bKash' | 'Nagad' | 'Rocket'>('bKash');
  const [withdrawNumber, setWithdrawNumber] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMsg, setWithdrawMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Telegram Chat ID Finder states
  const [findingChatId, setFindingChatId] = useState(false);
  const [chatIdMessage, setChatIdMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // System Settings Save animation states
  const [settingsStatus, setSettingsStatus] = useState<{ type: 'success' | 'error' | 'saving'; text: string } | null>(null);

  // Web App Custom 6-Button Menu Modals
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showWorkSelectModal, setShowWorkSelectModal] = useState(false);

  // Admin Toast Notifications state
  interface AdminToast {
    id: string;
    type: 'success' | 'error' | 'info';
    message: string;
  }
  const [adminToasts, setAdminToasts] = useState<AdminToast[]>([]);

  const showAdminToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now().toString() + Math.random().toString();
    setAdminToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setAdminToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  // Sync settings and local states
  useEffect(() => {
    localStorage.setItem("user_wallet_number", userWalletNumber);
  }, [userWalletNumber]);

  useEffect(() => {
    localStorage.setItem("user_wallet_type", userWalletType);
  }, [userWalletType]);

  useEffect(() => {
    localStorage.setItem("active_wallet_number", activeWalletNumber);
    setWorkerName(activeWalletNumber);

    const fetchActiveProfile = async () => {
      if (!activeWalletNumber) {
        setActiveProfile(null);
        return;
      }
      try {
        const profile = await getUserProfile(activeWalletNumber);
        if (profile) {
          setActiveWalletType(profile.walletType);
          setActiveProfile(profile);
        } else {
          setActiveProfile(null);
          if (activeWalletNumber === userWalletNumber) {
            setActiveWalletType(userWalletType);
          } else {
            setActiveWalletType('bKash');
          }
        }
      } catch (err) {
        console.warn("Failed to fetch active profile:", err);
        setActiveProfile(null);
      }
    };
    fetchActiveProfile();
  }, [activeWalletNumber, userWalletNumber, userWalletType]);

  // Sync withdrawal form inputs with permanent wallet settings
  useEffect(() => {
    if (userWalletNumber) {
      setWithdrawNumber(userWalletNumber);
      setWithdrawMethod(userWalletType);
    }
  }, [userWalletNumber, userWalletType, activeTab]);

  // Load Data from Firestore on mount & periodically
  const loadAllData = async () => {
    setLoading(true);
    try {
      const fetchedSettings = await getSettings();
      setAppSettings(fetchedSettings);

      const fetchedSubs = await getSubmissions();
      setSubmissions(fetchedSubs);

      const fetchedWithdraws = await getWithdrawals();
      setWithdrawals(fetchedWithdraws);
    } catch (e) {
      console.error("Error loading data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
    const interval = setInterval(loadAllData, 20000); // Poll every 20 seconds
    return () => clearInterval(interval);
  }, []);

  // Self-healing: If there are submissions belonging to this user's telegramChatId
  // but they aren't linked to the activeWalletNumber, link them in Firestore.
  useEffect(() => {
    if (!activeWalletNumber || !activeProfile || !(activeProfile as any).telegramChatId) return;

    const unlinked = submissions.filter(
      s => (s as any).telegramChatId === (activeProfile as any).telegramChatId && s.submittedBy !== activeWalletNumber
    );

    if (unlinked.length > 0) {
      console.log(`Web client self-healing: Found ${unlinked.length} submissions to link to ${activeWalletNumber}`);
      
      const healAll = async () => {
        let updatedAny = false;
        for (const sub of unlinked) {
          if (sub.id) {
            try {
              await updateSubmissionSubmittedBy(sub.id, activeWalletNumber);
              updatedAny = true;
            } catch (err) {
              console.error(`Web client self-healing error for submission ${sub.id}:`, err);
            }
          }
        }
        if (updatedAny) {
          loadAllData();
        }
      };

      healAll();
    }
  }, [submissions, activeWalletNumber, activeProfile]);

  // Memoized user submissions grouping
  const groupedSubmissions = useMemo(() => {
    const groups: Record<string, {
      worker: string;
      submissions: Submission[];
      total: number;
      approved: number;
      pending: number;
      rejected: number;
    }> = {};

    submissions.forEach((sub) => {
      const worker = sub.submittedBy || 'Unknown Worker';
      if (!groups[worker]) {
        groups[worker] = {
          worker,
          submissions: [],
          total: 0,
          approved: 0,
          pending: 0,
          rejected: 0
        };
      }
      groups[worker].submissions.push(sub);
      groups[worker].total++;
      if (sub.status === 'approved') groups[worker].approved++;
      else if (sub.status === 'pending') groups[worker].pending++;
      else if (sub.status === 'rejected') groups[worker].rejected++;
    });

    return Object.values(groups);
  }, [submissions]);

  // Real-time 2FA/TOTP Code Generation & Countdown update loop
  useEffect(() => {
    if (!twoFactorKey) {
      setGeneratedCode('------');
      return;
    }

    const updateTotp = () => {
      const code = getTotpCode(twoFactorKey);
      setGeneratedCode(code);
      setTotpCountdown(getTotpRemainingSeconds());
    };

    updateTotp();
    const timer = setInterval(updateTotp, 1000);
    return () => clearInterval(timer);
  }, [twoFactorKey]);

  // Handle Starting a new task
  const handleStartTask = () => {
    setCredentials(generateCredentials(settings.usernamePrefix, settings.dailyPassword));
    setTwoFactorKey('');
    setSubmissionStatus('idle');
  };

  // Submit the account details to Firebase
  const handleAccountSubmit = async () => {
    if (!credentials || !twoFactorKey) return;
    setSubmissionStatus('submitting');
    try {
      const codeToSubmit = getTotpCode(twoFactorKey);
      await addSubmission({
        username: credentials.username,
        password: credentials.password,
        twoFactorKey: twoFactorKey.trim(),
        status: "pending",
        createdAt: new Date().toISOString(),
        submittedBy: workerName
      });
      setSubmissionStatus('success');
      setCredentials(null);
      setTwoFactorKey('');
      loadAllData();
    } catch (e) {
      console.error(e);
      setSubmissionStatus('error');
    }
  };

  // Submit Withdrawal Request
  const handleWithdrawRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawMsg(null);
    const amount = parseFloat(withdrawAmount);

    // Enforce safety constraints
    if (activeWalletNumber !== userWalletNumber) {
      setWithdrawMsg({ 
        type: 'error', 
        text: 'নিরাপত্তা লক: আপনি শুধুমাত্র নিজের ওয়ালেট প্রোফাইল থেকেই ব্যালেন্স উইথড্র করতে পারবেন।' 
      });
      return;
    }

    if (!withdrawNumber || isNaN(amount) || amount <= 0) {
      setWithdrawMsg({ type: 'error', text: 'সঠিক নাম্বার এবং টাকা প্রদান করুন।' });
      return;
    }

    if (withdrawNumber !== userWalletNumber || withdrawMethod !== userWalletType) {
      setWithdrawMsg({ 
        type: 'error', 
        text: 'নিরাপত্তা সতর্কতা: আপনি আপনার স্থায়ী ওয়ালেট নাম্বার ও মাধ্যম ছাড়া টাকা তুলতে পারবেন না।' 
      });
      return;
    }

    const minW = settings.minWithdraw || 50;
    if (amount < minW) {
      setWithdrawMsg({ type: 'error', text: `নূন্যতম উত্তোলন পরিমাণ হচ্ছে ৳${minW} Taka।` });
      return;
    }

    const hasPendingWithdraw = withdrawals.some(w => w.submittedBy === workerName && w.status === 'pending');
    if (hasPendingWithdraw) {
      setWithdrawMsg({ 
        type: 'error', 
        text: 'আপনার একটি উইথড্রয়াল অনুরোধ বর্তমানে পেন্ডিং রয়েছে। সেটি সফল বা বাতিল হওয়ার আগে নতুন উইথড্র দিতে পারবেন না।' 
      });
      return;
    }

    const balance = calculateUserBalance(workerName);
    if (amount > balance) {
      setWithdrawMsg({ type: 'error', text: `আপনার পর্যাপ্ত ব্যালেন্স নেই। সর্বোচ্চ উত্তোলনযোগ্য: ৳${balance}` });
      return;
    }

    try {
      await addWithdrawal({
        method: userWalletType,
        number: userWalletNumber,
        amount: amount,
        status: 'pending',
        createdAt: new Date().toISOString(),
        submittedBy: workerName
      });
      setWithdrawMsg({ type: 'success', text: 'উত্তোলন অনুরোধ সফলভাবে জমা দেওয়া হয়েছে!' });
      setWithdrawAmount('');
      loadAllData();
    } catch (err) {
      setWithdrawMsg({ type: 'error', text: 'অনুরোধ জমা দিতে समस्या হয়েছে, অনুগ্রহ করে আবার চেষ্টা করুন।' });
    }
  };

  // Admin: Update Single Submission
  const handleApproveRejectSub = async (id: string, newStatus: 'approved' | 'rejected') => {
    await updateSubmissionStatus(id, newStatus);
    
    // Notify user via Telegram
    const sub = submissions.find(s => s.id === id);
    if (sub) {
      try {
        const res = await fetch("/api/telegram-direct-notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetWalletNumber: sub.submittedBy,
            type: newStatus === 'approved' ? 'id_approved' : 'id_rejected',
            details: { username: sub.username, category: sub.category }
          })
        });
        const data = await res.json();
        if (data.status === "success") {
          showAdminToast(`💬 টেলিগ্রাম মেসেজ পাঠানো হয়েছে! ইউজার: ${sub.submittedBy} (আইডি: ${sub.username})`, 'success');
        } else if (data.status === "skipped") {
          showAdminToast(`⚠️ মেসেজ স্কিপ হয়েছে: ${data.message || 'বট কনফিগারেশন নেই'}`, 'info');
        } else {
          showAdminToast(`❌ টেলিগ্রাম মেসেজ পাঠানো ব্যর্থ হয়েছে।`, 'error');
        }
      } catch (err) {
        console.error("Error triggering user notification:", err);
        showAdminToast(`❌ নোটিফিকেশন পাঠাতে সার্ভার বা কানেকশন ত্রুটি।`, 'error');
      }
    }

    // update local state instantly
    setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s));
  };

  // Admin: Delete Single Submission
  const handleDeleteSub = async (id: string) => {
    try {
      await deleteSubmission(id);
      setSubmissions(prev => prev.filter(s => s.id !== id));
      setSelectedSubIds(prev => prev.filter(subId => subId !== id));
    } catch (err) {
      console.error("Error deleting submission:", err);
    }
  };

  // Admin: Clear All Submissions
  const handleClearAllSubmissions = async () => {
    if (clearConfirmationText.toUpperCase() !== 'CONFIRM') {
      setDbMessage({ type: 'error', text: "অনুগ্রহ করে নিশ্চিত করতে 'CONFIRM' শব্দটি সঠিক বানানে লিখুন।" });
      return;
    }
    setIsClearingSubmissions(true);
    setDbMessage(null);
    try {
      await clearSubmissionsByCategory(adminCategory);
      setSubmissions(prev => prev.filter(s => (s.category || 'instagram') !== adminCategory));
      setSelectedSubIds([]);
      setClearConfirmationText('');
      setDbMessage({ type: 'success', text: `✅ ডাটাবেজের সকল ${adminCategory === 'facebook' ? 'ফেসবুক' : 'ইনস্টাগ্রাম'} সাবমিশন সফলভাবে মুছে ফেলা হয়েছে!` });
    } catch (err) {
      console.error(err);
      setDbMessage({ type: 'error', text: '❌ সাবমিশন মুছতে সমস্যা হয়েছে।' });
    } finally {
      setIsClearingSubmissions(false);
    }
  };

  // Admin: Clear All Withdrawals
  const handleClearAllWithdrawals = async () => {
    if (clearConfirmationText.toUpperCase() !== 'CONFIRM') {
      setDbMessage({ type: 'error', text: "অনুগ্রহ করে নিশ্চিত করতে 'CONFIRM' শব্দটি সঠিক বানানে লিখুন।" });
      return;
    }
    setIsClearingWithdrawals(true);
    setDbMessage(null);
    try {
      await clearAllWithdrawals();
      setWithdrawals([]);
      setSelectedWithIds([]);
      setClearConfirmationText('');
      setDbMessage({ type: 'success', text: '✅ ডাটাবেজের সকল উইথড্রয়াল সফলভাবে মুছে ফেলা হয়েছে!' });
    } catch (err) {
      console.error(err);
      setDbMessage({ type: 'error', text: '❌ উইথড্রয়াল মুছতে সমস্যা হয়েছে।' });
    } finally {
      setIsClearingWithdrawals(false);
    }
  };

  // Admin: Clear All User Profiles
  const handleClearAllProfiles = async () => {
    if (clearConfirmationText.toUpperCase() !== 'CONFIRM') {
      setDbMessage({ type: 'error', text: "অনুগ্রহ করে নিশ্চিত করতে 'CONFIRM' শব্দটি সঠিক বানানে লিখুন।" });
      return;
    }
    setIsClearingProfiles(true);
    setDbMessage(null);
    try {
      await clearAllUserProfiles();
      setClearConfirmationText('');
      setDbMessage({ type: 'success', text: '✅ ডাটাবেজের সকল ইউজার প্রোফাইল সফলভাবে মুছে ফেলা হয়েছে!' });
    } catch (err) {
      console.error(err);
      setDbMessage({ type: 'error', text: '❌ ইউজার প্রোফাইল মুছতে সমস্যা হয়েছে।' });
    } finally {
      setIsClearingProfiles(false);
    }
  };

  // Admin: Broadcast message to all registered Telegram users
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMessageText.trim()) {
      setBroadcastStatus({ type: 'error', text: 'অনুগ্রহ করে ব্রডকাস্ট মেসেজ টাইপ করুন!' });
      return;
    }

    setIsBroadcasting(true);
    setBroadcastStatus({ type: 'sending', text: 'মেসেজ পাঠানো হচ্ছে... অনুগ্রহ করে অপেক্ষা করুন।' });

    try {
      // 1. Get all user profiles
      const profiles = await getAllUserProfiles();
      
      // 2. Extract unique telegram chat IDs
      const chatIds = Array.from(new Set(
        profiles
          .map(p => (p as any).telegramChatId)
          .filter(Boolean)
          .map(id => String(id).trim())
      ));

      if (chatIds.length === 0) {
        setBroadcastStatus({ 
          type: 'error', 
          text: 'বটের সাথে কানেক্টেড কোনো রেজিস্টার্ড ইউজার পাওয়া যায়নি!' 
        });
        setIsBroadcasting(false);
        return;
      }

      // 3. Send via backend API
      const res = await fetch("/api/telegram-broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatIds,
          message: broadcastMessageText
        })
      });

      const data = await res.json();
      if (data.success) {
        setBroadcastStatus({
          type: 'success',
          text: `✅ ব্রডকাস্ট সম্পন্ন হয়েছে! মোট ব্যবহারকারী: ${data.total}, সফল: ${data.successCount}, ব্যর্থ: ${data.failCount}`
        });
        setBroadcastMessageText('');
      } else {
        setBroadcastStatus({
          type: 'error',
          text: data.error || 'ব্রডকাস্ট মেসেজ পাঠাতে সমস্যা হয়েছে।'
        });
      }
    } catch (err: any) {
      console.error("Broadcast error:", err);
      setBroadcastStatus({
        type: 'error',
        text: 'সার্ভার বা ডাটাবেজ কানেকশন ত্রুটি! অনুগ্রহ করে আবার চেষ্টা করুন।'
      });
    } finally {
      setIsBroadcasting(false);
    }
  };

  // Admin: Bulk Approve/Reject Submissions
  const handleBulkSubAction = async (newStatus: 'approved' | 'rejected') => {
    if (selectedSubIds.length === 0) return;
    const subsToNotify: { [walletNumber: string]: typeof submissions } = {};

    for (const id of selectedSubIds) {
      await updateSubmissionStatus(id, newStatus);
      
      const sub = submissions.find(s => s.id === id);
      if (sub) {
        if (!subsToNotify[sub.submittedBy]) {
          subsToNotify[sub.submittedBy] = [];
        }
        subsToNotify[sub.submittedBy].push(sub);
      }
    }

    // Send grouped/consolidated notifications
    for (const walletNumber of Object.keys(subsToNotify)) {
      const userSubs = subsToNotify[walletNumber];
      if (userSubs.length === 1) {
        const sub = userSubs[0];
        try {
          const res = await fetch("/api/telegram-direct-notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              targetWalletNumber: walletNumber,
              type: newStatus === 'approved' ? 'id_approved' : 'id_rejected',
              details: { username: sub.username, category: sub.category }
            })
          });
          const data = await res.json();
          if (data.status === "success") {
            showAdminToast(`💬 টেলিগ্রাম মেসেজ পাঠানো হয়েছে! ইউজার: ${walletNumber} (আইডি: ${sub.username})`, 'success');
          } else if (data.status === "skipped") {
            showAdminToast(`⚠️ মেসেজ স্কিপ হয়েছে: ${data.message || 'বট কনফিগারেশন নেই'}`, 'info');
          } else {
            showAdminToast(`❌ টেলিগ্রাম মেসেজ পাঠানো ব্যর্থ হয়েছে।`, 'error');
          }
        } catch (err) {
          console.error("Error triggering user notification:", err);
          showAdminToast(`❌ নোটিফিকেশন পাঠাতে সার্ভার বা কানেকশন ত্রুটি।`, 'error');
        }
      } else if (userSubs.length > 1) {
        const items = userSubs.map(s => ({ username: s.username, category: s.category }));
        try {
          const res = await fetch("/api/telegram-direct-notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              targetWalletNumber: walletNumber,
              type: newStatus === 'approved' ? 'id_bulk_approved' : 'id_bulk_rejected',
              items: items
            })
          });
          const data = await res.json();
          if (data.status === "success") {
            showAdminToast(`💬 ১টি মেসেজে ${userSubs.length}টি কাজের বিবরণ পাঠানো হয়েছে! ইউজার: ${walletNumber}`, 'success');
          } else if (data.status === "skipped") {
            showAdminToast(`⚠️ মেসেজ স্কিপ হয়েছে: ${data.message || 'বট কনফিগারেশন নেই'}`, 'info');
          } else {
            showAdminToast(`❌ টেলিগ্রাম মেসেজ পাঠানো ব্যর্থ হয়েছে।`, 'error');
          }
        } catch (err) {
          console.error("Error triggering user notification:", err);
          showAdminToast(`❌ নোটিফিকেশন পাঠাতে সার্ভার বা কানেকশন ত্রুটি।`, 'error');
        }
      }
    }

    setSubmissions(prev => prev.map(s => selectedSubIds.includes(s.id || '') ? { ...s, status: newStatus } : s));
    setSelectedSubIds([]);
  };

  // Admin: Bulk Approve/Reject by pasted list of usernames
  const handleBulkPasteAction = async (newStatus: 'approved' | 'rejected') => {
    setBulkPasteResult(null);
    if (!pastedUsernamesText.trim()) {
      setBulkPasteResult({ type: 'error', text: 'অনুগ্রহ করে এক বা একাধিক ইউজারনেম পেস্ট করুন!' });
      return;
    }

    const parsedUsernames = pastedUsernamesText
      .split(/[\s,\n]+/)
      .map(u => u.trim())
      .filter(Boolean);

    if (parsedUsernames.length === 0) {
      setBulkPasteResult({ type: 'error', text: 'কোনো সঠিক ইউজারনেম খুঁজে পাওয়া যায়নি!' });
      return;
    }

    // Find submissions matching the parsed usernames (case-insensitive)
    const matchingSubs = submissions.filter(sub => 
      parsedUsernames.some(u => u.toLowerCase() === sub.username.toLowerCase())
    );

    if (matchingSubs.length === 0) {
      setBulkPasteResult({ 
        type: 'error', 
        text: '❌ সাবমিশন তালিকার সাথে পেস্ট করা কোনো ইউজারনেমের মিল পাওয়া যায়নি!' 
      });
      return;
    }

    let processedCount = 0;
    const updatedIds: string[] = [];
    const subsToNotify: { [walletNumber: string]: typeof submissions } = {};

    for (const sub of matchingSubs) {
      if (!sub.id) continue;
      await updateSubmissionStatus(sub.id, newStatus);
      updatedIds.push(sub.id);
      processedCount++;

      if (!subsToNotify[sub.submittedBy]) {
        subsToNotify[sub.submittedBy] = [];
      }
      subsToNotify[sub.submittedBy].push(sub);
    }

    // Send grouped/consolidated notifications
    for (const walletNumber of Object.keys(subsToNotify)) {
      const userSubs = subsToNotify[walletNumber];
      if (userSubs.length === 1) {
        const sub = userSubs[0];
        try {
          const res = await fetch("/api/telegram-direct-notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              targetWalletNumber: walletNumber,
              type: newStatus === 'approved' ? 'id_approved' : 'id_rejected',
              details: { username: sub.username, category: sub.category }
            })
          });
          const data = await res.json();
          if (data.status === "success") {
            showAdminToast(`💬 টেলিগ্রাম মেসেজ পাঠানো হয়েছে! ইউজার: ${walletNumber} (আইডি: ${sub.username})`, 'success');
          } else if (data.status === "skipped") {
            showAdminToast(`⚠️ মেসেজ স্কিপ হয়েছে: ${data.message || 'বট কনফিগারেশন নেই'}`, 'info');
          } else {
            showAdminToast(`❌ টেলিগ্রাম মেসেজ পাঠানো ব্যর্থ হয়েছে।`, 'error');
          }
        } catch (err) {
          console.error("Error triggering user notification:", err);
          showAdminToast(`❌ নোটিফিকেশন পাঠাতে সার্ভার বা কানেকশন ত্রুটি।`, 'error');
        }
      } else if (userSubs.length > 1) {
        const items = userSubs.map(s => ({ username: s.username, category: s.category }));
        try {
          const res = await fetch("/api/telegram-direct-notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              targetWalletNumber: walletNumber,
              type: newStatus === 'approved' ? 'id_bulk_approved' : 'id_bulk_rejected',
              items: items
            })
          });
          const data = await res.json();
          if (data.status === "success") {
            showAdminToast(`💬 ১টি মেসেজে ${userSubs.length}টি কাজের বিবরণ পাঠানো হয়েছে! ইউজার: ${walletNumber}`, 'success');
          } else if (data.status === "skipped") {
            showAdminToast(`⚠️ মেসেজ স্কিপ হয়েছে: ${data.message || 'বট কনফিগারেশন নেই'}`, 'info');
          } else {
            showAdminToast(`❌ টেলিগ্রাম মেসেজ পাঠানো ব্যর্থ হয়েছে।`, 'error');
          }
        } catch (err) {
          console.error("Error triggering user notification:", err);
          showAdminToast(`❌ নোটিফিকেশন পাঠাতে সার্ভার বা কানেকশন ত্রুটি।`, 'error');
        }
      }
    }

    // Update local state instantly
    setSubmissions(prev => prev.map(s => updatedIds.includes(s.id || '') ? { ...s, status: newStatus } : s));
    
    setBulkPasteResult({
      type: 'success',
      text: `✅ সফলভাবে ${processedCount}টি আইডি ${newStatus === 'approved' ? 'অনুমোদন' : 'বাতিল'} করা হয়েছে!`
    });
    setPastedUsernamesText('');
  };

  // Admin: Update Single Withdrawal Request
  const handleApproveRejectWithdraw = async (id: string, newStatus: 'approved' | 'rejected') => {
    await updateWithdrawalStatus(id, newStatus);
    
    // Notify user via Telegram
    const w = withdrawals.find(w => w.id === id);
    if (w) {
      try {
        const res = await fetch("/api/telegram-direct-notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetWalletNumber: w.submittedBy,
            type: newStatus === 'approved' ? 'withdraw_approved' : 'withdraw_rejected',
            details: { amount: w.amount, method: w.method, number: w.number }
          })
        });
        const data = await res.json();
        if (data.status === "success") {
          showAdminToast(`💸 উইথড্র মেসেজ পাঠানো হয়েছে! ইউজার: ${w.submittedBy} (৳${w.amount})`, 'success');
        } else if (data.status === "skipped") {
          showAdminToast(`⚠️ উইথড্র মেসেজ স্কিপ হয়েছে: ${data.message || 'বট কনফিগারেশন নেই'}`, 'info');
        } else {
          showAdminToast(`❌ উইথড্র মেসেজ পাঠানো ব্যর্থ হয়েছে।`, 'error');
        }
      } catch (err) {
        console.error("Error triggering withdraw notification:", err);
        showAdminToast(`❌ উইথড্র নোটিফিকেশন পাঠাতে সার্ভার ত্রুটি।`, 'error');
      }
    }

    setWithdrawals(prev => prev.map(w => w.id === id ? { ...w, status: newStatus } : w));
  };

  // Admin: Save App Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsStatus({ type: 'saving', text: "সেটিংস ক্লাউড ডাটাবেজে সংরক্ষণ করা হচ্ছে..." });
    try {
      await saveSettings(settings);
      setSettingsStatus({ 
        type: 'success', 
        text: "অভিনন্দন! আপনার সিস্টেম সেটিংস এবং কনফিগারেশন সফলভাবে ক্লাউড ডাটাবেজে সংরক্ষিত ও আপডেট হয়েছে।" 
      });
      await loadAllData();
      // Clear after 4.5 seconds
      setTimeout(() => {
        setSettingsStatus(null);
      }, 4500);
    } catch (err: any) {
      setSettingsStatus({ 
        type: 'error', 
        text: "দুঃখিত! সেটিংস সংরক্ষণে ত্রুটি ঘটেছে: " + (err?.message || "ক্লাউডে ডাটা রাইট করতে সমস্যা হয়েছে।") 
      });
    }
  };

  // Admin: Auto-Detect Chat ID from Telegram Bot Updates
  const handleDetectChatId = async () => {
    if (!settings.telegramBotToken) {
      setChatIdMessage({ type: 'error', text: 'অনুগ্রহ করে প্রথমে Telegram Bot Token টি ইনপুট বক্সে দিন!' });
      return;
    }

    setFindingChatId(true);
    setChatIdMessage({ type: 'info', text: 'বটের লেটেস্ট আপডেট খোঁজা হচ্ছে... অনুগ্রহ করে আপনার গ্রুপে বা বটের ইনবক্সে মেসেজ পাঠিয়ে ক্লিক করুন।' });

    try {
      const response = await fetch("/api/telegram-updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botToken: settings.telegramBotToken.trim() })
      });

      if (!response.ok) {
        throw new Error("টেলিগ্রাম এপিআই সংযোগে ব্যর্থ হয়েছে।");
      }

      const data = await response.json();
      if (!data.ok) {
        throw new Error(data.description || "বট টোকেনটি সঠিক নয় বা কাজ করছে না।");
      }

      const updates = data.result || [];
      if (updates.length === 0) {
        setChatIdMessage({ 
          type: 'error', 
          text: 'বটের সাথে কোনো চ্যাট হিস্ট্রি পাওয়া যায়নি! অনুগ্রহ করে টেলিগ্রামে আপনার গ্রুপে বটটিকে এড করুন এবং গ্রুপে একটি সাধারণ টেক্সট মেসেজ লিখে পাঠান (অথবা বটের ইনবক্সে হাই লিখুন), তারপর আবার এখানে ক্লিক করুন।' 
        });
        return;
      }

      // Loop from the end to find the latest valid chat ID
      let foundChatId = "";
      let foundChatTitle = "";
      let foundChatType = "";

      for (let i = updates.length - 1; i >= 0; i--) {
        const update = updates[i];
        const chatObj = update.message?.chat || update.channel_post?.chat || update.my_chat_member?.chat || update.edited_message?.chat;
        if (chatObj && chatObj.id) {
          foundChatId = String(chatObj.id);
          foundChatTitle = chatObj.title || chatObj.username || `${chatObj.first_name || ''} ${chatObj.last_name || ''}`.trim() || 'Private';
          foundChatType = chatObj.type || 'unknown';
          break;
        }
      }

      if (foundChatId) {
        setAppSettings(prev => ({ ...prev, telegramChatId: foundChatId }));
        setChatIdMessage({ 
          type: 'success', 
          text: `সফলভাবে সনাক্ত করা হয়েছে! সর্বশেষ চ্যাট আইডি: "${foundChatId}" (${foundChatTitle} - ${foundChatType === 'private' ? 'ইনবক্স' : 'গ্রুপ/চ্যানেল'})। এটি অটোমেটিক ইনপুটে বসানো হয়েছে। নিচের "সেটিংস সংরক্ষণ করুন" বাটনে চাপ দিন।` 
        });
      } else {
        setChatIdMessage({ 
          type: 'error', 
          text: 'কোনো চ্যাট আইডি সনাক্ত করা যায়নি। অনুগ্রহ করে গ্রুপে বা বটের ইনবক্সে নতুন কোনো মেসেজ পাঠিয়ে আবার চেষ্টা করুন।' 
        });
      }
    } catch (err: any) {
      setChatIdMessage({ type: 'error', text: `ভুল: ${err?.message || 'সমস্যা হয়েছে, অনুগ্রহ করে টোকেন চেক করুন।'}` });
    } finally {
      setFindingChatId(false);
    }
  };

  // Helper calculation functions
  const calculateUserBalance = (name: string) => {
    const userApprovedSubs = submissions.filter(s => s.submittedBy === name && s.status === 'approved');
    const totalEarned = userApprovedSubs.reduce((sum, s) => {
      const isFacebook = s.category === 'facebook';
      const rate = isFacebook 
        ? (settings.facebookRatePerId !== undefined ? settings.facebookRatePerId : settings.ratePerId)
        : settings.ratePerId;
      return sum + rate;
    }, 0);
    
    // Deduct both approved and pending withdrawals to lock pending amounts and prevent double-withdrawing
    const withdrawnAmount = withdrawals
      .filter(w => w.submittedBy === name && (w.status === 'approved' || w.status === 'pending'))
      .reduce((sum, current) => sum + current.amount, 0);

    return Math.max(0, totalEarned - withdrawnAmount);
  };

  const calculateUserTotalEarned = (name: string) => {
    const userApprovedSubs = submissions.filter(s => s.submittedBy === name && s.status === 'approved');
    return userApprovedSubs.reduce((sum, s) => {
      const isFacebook = s.category === 'facebook';
      const rate = isFacebook 
        ? (settings.facebookRatePerId !== undefined ? settings.facebookRatePerId : settings.ratePerId)
        : settings.ratePerId;
      return sum + rate;
    }, 0);
  };

  const getApprovedCount = (name: string) => {
    return submissions.filter(s => s.submittedBy === name && s.status === 'approved').length;
  };

  const getPendingCount = (name: string) => {
    return submissions.filter(s => s.submittedBy === name && s.status === 'pending').length;
  };

  // Export Submissions as beautiful CSV format that opens natively in Excel
  const handleExportCSV = () => {
    const headers = adminCategory === 'facebook'
      ? ["UID", "Password", "First Name", "Last Name", "Cookie", "Submitted By", "Status", "Submitted At"]
      : ["Username", "Password", "2FA Key", "Submitted By", "Status", "Submitted At"];
      
    const rows = categoryFilteredSubmissions.map(s => {
      if (adminCategory === 'facebook') {
        return [
          s.username,
          s.password,
          s.firstName || "",
          s.lastName || "",
          s.cookie || "",
          s.submittedBy,
          s.status,
          new Date(s.createdAt).toLocaleString()
        ];
      } else {
        return [
          s.username,
          s.password,
          s.twoFactorKey,
          s.submittedBy,
          s.status,
          new Date(s.createdAt).toLocaleString()
        ];
      }
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val || '').replace(/"/g, '""')}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${adminCategory}_accounts_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  // Copy to clipboard helper
  const copyToClipboard = (text: string, field: 'user' | 'pass' | 'code') => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div id="app-root">
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col md:flex-row overflow-hidden">
        {/* Mobile Header Banner */}
        <div className="md:hidden flex items-center justify-between bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-white shadow-md shadow-indigo-600/30">I</div>
            <span className="font-bold tracking-tight text-white uppercase text-base">InstaSafe</span>
          </div>
          <button onClick={toggleSidebar} className="p-2 text-slate-400 hover:text-white transition-colors">
            <Menu size={24} />
          </button>
        </div>

      {/* Sidebar Mobile Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-30 md:hidden" onClick={toggleSidebar}></div>
      )}

      {/* Sidebar Layout */}
      <div className={`fixed md:relative inset-y-0 left-0 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-in-out w-68 bg-slate-900 border-r border-slate-800 flex flex-col z-45`}>
        <div className="p-6 flex-grow overflow-y-auto">
          <div className="hidden md:flex items-center gap-3 mb-8">
            <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-white text-lg shadow-lg shadow-indigo-600/30">I</div>
            <h1 className="text-xl font-bold tracking-tight text-white uppercase">InstaSafe</h1>
          </div>

          {/* Permanent Wallet Profile & Switch View */}
          {userWalletNumber ? (
            <div className="mb-6 space-y-3">
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 w-16 h-16 bg-indigo-500/5 rounded-full blur-xl"></div>
                
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block mb-1.5">আপনার স্থায়ী ওয়ালেট (My Wallet)</span>
                
                <div className="flex items-center gap-2">
                  <div className={`px-2 py-0.5 text-[9px] font-extrabold rounded-md uppercase ${
                    userWalletType === 'bKash' ? 'bg-pink-600/10 text-pink-500 border border-pink-500/20' :
                    userWalletType === 'Nagad' ? 'bg-orange-600/10 text-orange-500 border border-orange-500/20' :
                    'bg-sky-600/10 text-sky-500 border border-sky-500/20'
                  }`}>
                    {userWalletType}
                  </div>
                  <span className="text-sm font-bold text-white font-mono tracking-wide">{userWalletNumber}</span>
                </div>
                
                <p className="text-[9px] text-slate-500 mt-2 leading-relaxed">
                  ⚠️ এই ওয়ালেট ছাড়া অন্য কোনো নাম্বারে টাকা উত্তোলন করতে পারবেন না।
                </p>
              </div>

              {/* View/Search Another Wallet */}
              <div className="bg-slate-950/40 border border-slate-850 p-3.5 rounded-xl space-y-2">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">অন্য প্রোফাইল দেখুন (Check Wallet)</span>
                
                <input 
                  type="text" 
                  placeholder="ওয়ালেট নাম্বার লিখুন"
                  value={activeWalletNumber} 
                  onChange={(e) => {
                    const val = e.target.value.replace(/\s+/g, '');
                    setActiveWalletNumber(val);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 font-medium font-mono focus:border-indigo-500 outline-none transition-all"
                />

                {activeWalletNumber !== userWalletNumber && (
                  <button 
                    onClick={() => setActiveWalletNumber(userWalletNumber)}
                    className="w-full py-1 text-[10px] text-indigo-400 font-bold hover:text-indigo-300 transition-colors flex items-center justify-center gap-1"
                  >
                    ← নিজের ওয়ালেটে ফিরুন
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="mb-6 bg-slate-950 border border-amber-500/20 p-4 rounded-xl">
              <span className="text-[10px] text-amber-500 uppercase font-bold tracking-wider block mb-1">প্রোফাইল অসম্পূর্ণ</span>
              <p className="text-xs text-slate-400 leading-relaxed">
                অনুগ্রহ করে আপনার স্থায়ী ওয়ালেট সেট করুন।
              </p>
            </div>
          )}

          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block px-3 mb-2">Work & Wallet</span>
          <nav className="space-y-1 mb-6">
            <button onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
              <Grid size={18} />
              <span>ড্যাশবোর্ড (Dashboard)</span>
            </button>
            <button onClick={() => { setActiveTab('instagram'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all ${activeTab === 'instagram' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
              <Instagram size={18} />
              <span>আইডি কাজ (2FA Tool)</span>
            </button>
            <button onClick={() => { setActiveTab('withdraw'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all ${activeTab === 'withdraw' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
              <Wallet size={18} />
              <span>টাকা উত্তোলন (Withdraw)</span>
            </button>
          </nav>

          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block px-3 mb-2">Admin Control</span>
          <nav className="space-y-1">
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-xs text-slate-400">Admin Mode</span>
              <button 
                onClick={handleAdminToggle} 
                className={`relative inline-flex h-5 w-10 items-center rounded-full transition-all ${isAdmin ? 'bg-indigo-600' : 'bg-slate-800'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-all ${isAdmin ? 'translate-x-5.5' : 'translate-x-1'}`} />
              </button>
            </div>

            {isAdmin && (
              <div className="space-y-1 pl-1">
                <button onClick={() => { setActiveTab('admin_facebook'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium rounded-lg transition-all ${activeTab === 'admin_facebook' ? 'bg-blue-950/80 border border-blue-800/40 text-blue-400 font-bold' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                  <Facebook size={15} className="text-blue-500" />
                  <span>Facebook Control (ফেসবুক)</span>
                </button>
                <button onClick={() => { setActiveTab('admin_instagram'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium rounded-lg transition-all ${activeTab === 'admin_instagram' ? 'bg-pink-950/80 border border-pink-800/40 text-pink-400 font-bold' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                  <Instagram size={15} className="text-pink-500" />
                  <span>Instagram Control (ইনস্টা)</span>
                </button>
                <button onClick={() => { setActiveTab('admin_withdrawals'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium rounded-lg transition-all ${activeTab === 'admin_withdrawals' ? 'bg-indigo-950 border border-indigo-800/50 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                  <DollarSign size={15} />
                  <span>পেমেন্ট রিকোয়েস্ট (Payouts)</span>
                </button>
                <button onClick={() => { setActiveTab('admin_bot'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium rounded-lg transition-all ${activeTab === 'admin_bot' ? 'bg-indigo-950 border border-indigo-800/50 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                  <Settings size={15} />
                  <span>টেলিগ্রাম বট সেটিংস (Bot)</span>
                </button>
              </div>
            )}
          </nav>
        </div>

        {/* Telegram Status Info Footer */}
        <div className="p-6 border-t border-slate-800 bg-slate-950/40">
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl">
            <p className="text-[10px] text-emerald-400 font-bold mb-1 uppercase tracking-widest">Telegram Bot Status</p>
            <p className="text-xs text-slate-400 truncate">{settings.telegramBotToken ? 'Configured ✅' : 'Not Configured ⚠️'}</p>
            <div className="flex items-center gap-2 mt-2">
              <div className={`w-2 h-2 rounded-full ${settings.telegramBotToken ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></div>
              <span className="text-[9px] text-slate-400 uppercase tracking-widest">{settings.telegramBotToken ? 'Active Notification' : 'Idle'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Dynamic header */}
        <header className="hidden md:flex h-20 border-b border-slate-800 items-center justify-between px-8 bg-slate-900/40">
          <div>
            <span className="text-xs text-slate-500 uppercase tracking-widest font-mono">Current Workspace</span>
            <h2 className="text-lg font-bold text-white tracking-tight capitalize">
              {activeTab.replace('_', ' ')}
            </h2>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <span className="text-xs text-slate-500 uppercase tracking-widest font-mono">My Earnings Balance</span>
              <span className="text-xl font-extrabold text-indigo-400">৳{calculateUserBalance(workerName)}</span>
            </div>
            <div className="w-px h-8 bg-slate-800"></div>
            <button 
              onClick={loadAllData} 
              className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white hover:border-slate-700 transition-all flex items-center justify-center"
              title="Refresh Data"
            >
              <RefreshCw size={16} className={`${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="p-4 md:p-8 flex-grow">
          {/* Main Content Area */}
          {loading && (
            <div className="mb-4 flex items-center gap-2 text-indigo-400 text-xs bg-indigo-500/10 border border-indigo-500/20 p-2.5 rounded-lg animate-pulse">
              <RefreshCw size={14} className="animate-spin" />
              <span>নতুন তথ্য সিঙ্ক করা হচ্ছে... (Syncing latest database updates...)</span>
            </div>
          )}

          {!userWalletNumber ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-xl mx-auto my-6 bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl space-y-6 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 via-indigo-500 to-emerald-500"></div>
              
              <div className="space-y-2 text-center md:text-left">
                <div className="w-12 h-12 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center mx-auto md:mx-0">
                  <Wallet size={24} />
                </div>
                <h3 className="text-xl font-extrabold text-white">স্থায়ী ওয়ালেট অ্যাকাউন্ট সেটআপ (Profile Wallet Setup)</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  আপনার কাজের হিসাব এবং টাকা উত্তোলনের জন্য একটি স্থায়ী ওয়ালেট নাম্বার যোগ করা আবশ্যক। এটি আপনার প্রোফাইল আইডি হিসেবে কাজ করবে।
                </p>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/25 p-4 rounded-xl space-y-2">
                <span className="text-xs font-bold text-amber-500 uppercase tracking-widest block">⚠️ গুরুত্বপূর্ণ সতর্কতা (Important Notice)</span>
                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                  একবার আপনার ওয়ালেট নাম্বার সেট হয়ে গেলে তা <span className="text-amber-400 underline decoration-wavy">স্থায়ী ও অপরিবর্তনযোগ্য</span> থাকবে। আপনি ভবিষ্যতে শুধুমাত্র এই ওয়ালেট নাম্বারের মাধ্যমেই পেমেন্ট উত্তোলন করতে পারবেন। অন্য কোনো নাম্বারে পেমেন্ট পাঠানো সম্ভব হবে না।
                </p>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!setupNumber || setupNumber.length !== 11 || !/^\d+$/.test(setupNumber)) {
                  return;
                }

                try {
                  await saveUserProfile({
                    walletNumber: setupNumber,
                    walletType: setupType,
                    createdAt: new Date().toISOString()
                  });
                  
                  // Save permanently locally
                  localStorage.setItem("user_wallet_number", setupNumber);
                  localStorage.setItem("user_wallet_type", setupType);
                  setUserWalletNumber(setupNumber);
                  setUserWalletType(setupType);
                  setActiveWalletNumber(setupNumber);
                  setWorkerName(setupNumber);
                  setActiveTab('dashboard');
                } catch (err) {
                  console.error("Error saving profile to Firestore:", err);
                  // fallback save
                  localStorage.setItem("user_wallet_number", setupNumber);
                  localStorage.setItem("user_wallet_type", setupType);
                  setUserWalletNumber(setupNumber);
                  setUserWalletType(setupType);
                  setActiveWalletNumber(setupNumber);
                  setWorkerName(setupNumber);
                  setActiveTab('dashboard');
                }
              }} className="space-y-4">
                
                {/* Method selector */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-2">ওয়ালেট মাধ্যম সিলেক্ট করুন (Payment Method)</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'bKash', name: 'bKash (বিকাশ)' },
                      { id: 'Nagad', name: 'Nagad (নগদ)' },
                      { id: 'Rocket', name: 'Rocket (রকেট)' }
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSetupType(item.id as any)}
                        className={`py-3 px-2 text-center rounded-xl border text-xs font-bold transition-all ${
                          setupType === item.id 
                            ? 'border-indigo-500 bg-indigo-500/10 text-white shadow-lg shadow-indigo-500/10' 
                            : 'bg-slate-950 border-slate-850 text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                        }`}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Number Input */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">অ্যাকাউন্ট মোবাইল নাম্বার (Wallet Number)</label>
                  <input 
                    type="text" 
                    maxLength={11}
                    placeholder="যেমন: 017XXXXXXXX"
                    value={setupNumber}
                    onChange={(e) => setSetupNumber(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-slate-950 border border-slate-800 px-4 py-3 rounded-xl text-slate-300 text-sm outline-none focus:border-indigo-500 transition-all font-mono tracking-wide"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">১১ সংখ্যার সচল পার্সোনাল মোবাইল ব্যাংকিং অ্যাকাউন্ট নাম্বার দিন।</p>
                </div>

                {/* Submit */}
                <button 
                  type="submit"
                  disabled={!(setupNumber.length === 11 && setupNumber.startsWith('01'))}
                  className={`w-full py-4 font-bold rounded-xl transition-all text-sm mt-2 ${
                    (setupNumber.length === 11 && setupNumber.startsWith('01'))
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 cursor-pointer'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-750'
                  }`}
                >
                  স্থায়ী সেটআপ সম্পন্ন করুন (Confirm & Register)
                </button>
              </form>
            </motion.div>
          ) : (
            <>
              {/* DASHBOARD TAB */}
              {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Custom Telegram Bot style 6-Button Grid */}
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                      বট ড্যাশবোর্ড মেনু (Quick Bot Menu)
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">কালারফুল বাটনগুলোর মাধ্যমে সরাসরি ফিচারে প্রবেশ করুন</p>
                  </div>
                  <span className="text-[9px] font-mono bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20 uppercase tracking-widest">Bot View</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {/* Row 1: 📋 কাজ ▸ (Crimson Red / Maroon Background) */}
                  <button 
                    onClick={() => setShowWorkSelectModal(true)}
                    className="md:col-span-2 py-4 px-6 rounded-xl bg-[#8E2424] hover:bg-[#A33B3F] text-white font-bold text-sm shadow-md shadow-red-950/20 flex items-center justify-between border border-[#A93C3C] transition-all hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="text-base">📋</span>
                      <span>কাজ শুরু করুন ▸</span>
                    </span>
                    <span className="text-xs bg-black/20 px-2 py-0.5 rounded font-mono">Select Work</span>
                  </button>

                  {/* Row 2, Col 1: 💵 ব্যালেন্স (Olive-gray Background) */}
                  <button 
                    onClick={() => setShowStatsModal(true)}
                    className="py-3.5 px-5 rounded-xl bg-[#2D332D] hover:bg-[#394039] text-[#B5C9BE] font-bold text-sm shadow-sm flex items-center gap-2.5 border border-[#3E473E] transition-all hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <span className="text-base">💵</span>
                    <span>ব্যালেন্স চেক</span>
                  </button>

                  {/* Row 2, Col 2: 💰 টাকা উত্তোলন (Vibrant/Dark Green Background) */}
                  <button 
                    onClick={() => setActiveTab('withdraw')}
                    className="py-3.5 px-5 rounded-xl bg-[#1E4D2B] hover:bg-[#256036] text-[#A7F3D0] font-bold text-sm shadow-md shadow-emerald-950/20 flex items-center gap-2.5 border border-[#235F35] transition-all hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <span className="text-base">💰</span>
                    <span>টাকা উত্তোলন</span>
                  </button>

                  {/* Row 3, Col 1: 🎁 My Referrals (Olive-gray Background) */}
                  <button 
                    onClick={() => setShowReferralModal(true)}
                    className="py-3.5 px-5 rounded-xl bg-[#2D332D] hover:bg-[#394039] text-[#B5C9BE] font-bold text-sm shadow-sm flex items-center gap-2.5 border border-[#3E473E] transition-all hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <span className="text-base">🎁</span>
                    <span>My Referrals</span>
                  </button>

                  {/* Row 3, Col 2: 📞 সাপোর্ট (Olive-gray Background) */}
                  <a 
                    href="https://t.me/Mahmudulinstabazar" 
                    target="_blank" 
                    rel="noreferrer"
                    className="py-3.5 px-5 rounded-xl bg-[#2D332D] hover:bg-[#394039] text-[#B5C9BE] font-bold text-sm shadow-sm flex items-center justify-center md:justify-start gap-2.5 border border-[#3E473E] transition-all hover:scale-[1.01] active:scale-[0.99] text-center"
                  >
                    <span className="text-base">📞</span>
                    <span>সাপোর্ট</span>
                  </a>

                  {/* Row 4: 👶 আমি নতুন (Full Width Muted Gray) */}
                  <button 
                    onClick={() => setShowHelpModal(true)}
                    className="md:col-span-2 py-3.5 px-5 rounded-xl bg-[#2D332D] hover:bg-[#394039] text-[#B5C9BE] font-bold text-sm shadow-sm flex items-center justify-center gap-2.5 border border-[#3E473E] transition-all hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <span className="text-base">👶</span>
                    <span>আমি নতুন (ভিডিও গাইড)</span>
                  </button>
                </div>
              </div>

              {/* Top Banner Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between">
                  <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">মোট আয় (Total Earned)</span>
                  <div className="mt-2 flex items-baseline gap-1 text-2xl font-extrabold text-white">
                    <span>৳{calculateUserTotalEarned(workerName)}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1">৳{settings.ratePerId} Taka per approved ID</span>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between">
                  <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">উত্তোলনযোগ্য ব্যালেন্স (Balance)</span>
                  <div className="mt-2 flex items-baseline gap-1 text-2xl font-extrabold text-emerald-400">
                    <span>৳{calculateUserBalance(workerName)}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1">Available for instant Payout</span>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between">
                  <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">অনুমোদিত আইডি (Approved)</span>
                  <div className="mt-2 flex items-baseline gap-1 text-2xl font-extrabold text-blue-400">
                    <span>{getApprovedCount(workerName)}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1">Success submissions</span>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between">
                  <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">অপেক্ষমান আইডি (Pending)</span>
                  <div className="mt-2 flex items-baseline gap-1 text-2xl font-extrabold text-amber-500">
                    <span>{getPendingCount(workerName)}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1">Under verification review</span>
                </div>
              </div>

              {/* Pending Balance Notice */}
              {getPendingCount(workerName) > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-amber-500/10 border border-amber-500/20 p-5 rounded-2xl flex items-start gap-4 animate-pulse-subtle"
                >
                  <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={20} />
                  <div className="text-xs text-slate-300 space-y-1.5">
                    <span className="font-bold text-amber-500 uppercase tracking-widest block">আইডি ভেরিফিকেশন অপেক্ষমান (Under Verification Review)</span>
                    <p className="leading-relaxed text-[12px]">
                      আপনার <strong>{getPendingCount(workerName)}টি আইডি সাবমিশন</strong> বর্তমানে এডমিন ভেরিফিকেশনের জন্য অপেক্ষায় (Pending) রয়েছে। এডমিন এগুলো চেক করে অনুমোদন (Approve) করলে আপনার উত্তোলনযোগ্য ব্যালেন্সে <strong>৳{getPendingCount(workerName) * settings.ratePerId} Taka</strong> যুক্ত হবে। আইডিগুলো এপ্রুভ হওয়ার পূর্বে আপনার উইথড্রযোগ্য ব্যালেন্স ৳০ দেখাবে। দয়া করে ধৈর্য ধরুন, ধন্যবাদ!
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Quick Actions Card */}
              <div className="bg-gradient-to-r from-indigo-950/40 to-slate-900 border border-indigo-900/30 p-8 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">ইনস্টাগ্রাম টু-ফ্যাক্টর আইডি কাজ শুরু করুন</h3>
                  <p className="text-slate-400 text-sm max-w-xl">
                    এক ক্লিকে নতুন ইনস্টাগ্রাম আইডি তৈরির কাজ শুরু করতে নিচের বাটনে চাপ দিন। আপনার জন্য আমাদের সিস্টেম অটোমেটিক ইউজারনেম ও পাসওয়ার্ড দিয়ে দিবে।
                  </p>
                </div>
                <button 
                  onClick={() => { setActiveTab('instagram'); handleStartTask(); }}
                  className="px-6 py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-600/20 whitespace-nowrap transition-all duration-150"
                >
                  কাজ শুরু করুন (Start Work)
                </button>
              </div>

              {/* Working Instructions */}
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                  <AlertCircle className="text-indigo-400" size={18} />
                  <span>আইডি তৈরি ও ২এফএ কাজের নিয়মাবলী</span>
                </h3>
                <ol className="space-y-3 text-sm text-slate-300 list-decimal pl-5">
                  <li>প্রথমে <strong>"আইডি কাজ"</strong> ট্যাবে যান অথবা উপরের <strong>"কাজ শুরু করুন"</strong> বাটনে ক্লিক করুন।</li>
                  <li>সিস্টেম আপনাকে একটি অটোমেটিক <strong>ইউজারনেম</strong> এবং <strong>পাসওয়ার্ড</strong> প্রদর্শন করবে।</li>
                  <li>এই ইউজারনেম ও পাসওয়ার্ড ব্যবহার করে ইনস্টাগ্রামে অ্যাকাউন্ট তৈরি করুন।</li>
                  <li>অ্যাকাউন্ট তৈরির সময় ২-ফ্যাক্টর অথেনটিকেশন (2FA) অপশন চালু করুন এবং ওখানকার <strong>Secret Key (২এফএ কী)</strong> টি কপি করুন।</li>
                  <li>আমাদের ওয়েবসাইটে এসে <strong>"২-ফ্যাক্টর অথেনটিকেশন কী"</strong> বক্সে কপি করা কী-টি পেস্ট করুন।</li>
                  <li>পেস্ট করার সাথে সাথে আমাদের ওয়েবসাইট আপনাকে অটোমেটিক একটি ৬ ডিজিটের <strong>২এফএ কোড</strong> দিবে, যা ইনস্টাগ্রাম ভেরিফিকেশনে ব্যবহার করতে পারবেন।</li>
                  <li>ইনস্টাগ্রামে অ্যাকাউন্ট তৈরি সম্পূর্ণ করা হলে <strong>"অ্যাকাউন্ট তৈরি শেষ - অ্যাডমিনে জমা দিন"</strong> বাটনে ক্লিক করুন।</li>
                  <li>অ্যাডমিন আপনার জমা দেওয়া তথ্য যাচাই করে অনুমোদন করলে আপনার ব্যালেন্সে টাকা যুক্ত হবে।</li>
                </ol>
              </div>
            </div>
          )}

          {/* INSTAGRAM WORK TAB */}
          {activeTab === 'instagram' && (
            <div className="max-w-xl mx-auto space-y-6">
              {settings.instagramWorkActive === false ? (
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl text-center space-y-6 flex-grow">
                  <div className="w-16 h-16 bg-rose-600/10 rounded-full flex items-center justify-center mx-auto border border-rose-500/20">
                    <AlertCircle size={32} className="text-rose-400 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white mb-2">কাজটি সাময়িকভাবে বন্ধ আছে</h2>
                    <p className="text-slate-400 text-sm">
                      আপডেট এর জন্য চ্যানেলে চোখ রাখুন,,,
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {!credentials && submissionStatus !== 'success' && (
                <div className="flex flex-col h-full">
                  <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl text-center space-y-6 flex-grow">
                    <div className="w-16 h-16 bg-indigo-600/10 rounded-full flex items-center justify-center mx-auto border border-indigo-600/20">
                      <Instagram size={32} className="text-indigo-400" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white mb-2">Instagram 2FA ID Work</h2>
                      <p className="text-slate-400 text-sm">
                        নতুন অ্যাকাউন্ট খোলার জন্য ইউজারনেম ও পাসওয়ার্ড তৈরি করতে নিচের বাটনে ক্লিক করুন।
                      </p>
                    </div>
                  </div>
                  
                <button 
                  onClick={handleStartTask} 
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/25 transition-all"
                >
                  নতুন আইডি তৈরি শুরু করুন
                </button>
                </div>
              )}

              {credentials && submissionStatus !== 'success' && (
                <div className="bg-slate-900 border border-slate-800 p-6 md:p-8 rounded-2xl shadow-2xl space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white">Instagram Credentials</h2>
                    <span className="text-[10px] text-indigo-400 font-bold bg-indigo-400/10 px-2.5 py-1 rounded">Active Generator</span>
                  </div>

                  <div className="space-y-4">
                    {/* Username copy row */}
                    <div>
                      <label className="text-[10px] uppercase font-bold tracking-widest text-slate-500 block mb-1">Generated Username</label>
                      <div className="flex gap-2">
                        <div className="flex-grow bg-slate-950 border border-slate-800 px-4 py-3 rounded-lg font-mono text-sm text-indigo-400 tracking-wide select-all truncate">
                          {credentials.username}
                        </div>
                        <button 
                          onClick={() => copyToClipboard(credentials.username, 'user')}
                          className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap min-w-[70px] justify-center"
                        >
                          <Clipboard size={14} />
                          <span>{copiedField === 'user' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Password copy row */}
                    <div>
                      <label className="text-[10px] uppercase font-bold tracking-widest text-slate-500 block mb-1">Generated Password</label>
                      <div className="flex gap-2">
                        <div className="flex-grow bg-slate-950 border border-slate-800 px-4 py-3 rounded-lg font-mono text-sm text-indigo-400 tracking-wide select-all truncate">
                          {credentials.password}
                        </div>
                        <button 
                          onClick={() => copyToClipboard(credentials.password, 'pass')}
                          className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap min-w-[70px] justify-center"
                        >
                          <Clipboard size={14} />
                          <span>{copiedField === 'pass' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>

                    {/* 2FA input */}
                    <div className="pt-2 border-t border-slate-800/60">
                      <label className="text-[10px] uppercase font-bold tracking-widest text-slate-500 block mb-1.5">২-ফ্যাক্টর অথেনটিকেশন কী (Paste 2FA Secret Key)</label>
                      <input 
                        type="text" 
                        placeholder="ইনস্টাগ্রাম থেকে কপি করা 2FA Secret Key টি এখানে দিন..." 
                        value={twoFactorKey} 
                        onChange={(e) => setTwoFactorKey(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 p-4 rounded-lg font-mono text-base tracking-widest text-indigo-300 transition-all outline-none"
                      />
                    </div>

                    {/* Dynamic OTP Generated Box */}
                    {twoFactorKey && (
                      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 text-center flex flex-col items-center justify-center relative overflow-hidden">
                        <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">২-ফ্যাক্টর ভেরিফিকেশন কোড (TOTP Code)</span>
                        <div className="text-4xl font-bold font-mono tracking-widest text-indigo-400 my-2">
                          {generatedCode}
                        </div>
                        
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-semibold tracking-wider">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"></div>
                          <span>Refreshes in {totpCountdown} seconds</span>
                        </div>
                        
                        {generatedCode !== "INVALID" && generatedCode !== "------" && (
                          <button 
                            onClick={() => copyToClipboard(generatedCode, 'code')}
                            className="mt-3 px-3 py-1 bg-indigo-600/10 border border-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all text-xs rounded-full font-medium"
                          >
                            {copiedField === 'code' ? 'Copied 2FA Code!' : 'Copy 2FA Code'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Submit accounts button */}
                  <div className="pt-4 border-t border-slate-800">
                    <button 
                      onClick={handleAccountSubmit} 
                      disabled={!credentials || !twoFactorKey || submissionStatus === 'submitting'}
                      className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold rounded-xl shadow-lg transition-all text-sm tracking-wide"
                    >
                      {submissionStatus === 'submitting' ? 'জমা দেওয়া হচ্ছে...' : 'অ্যাকাউন্ট তৈরি শেষ - অ্যাডমিনে জমা দিন'}
                    </button>
                  </div>
                </div>
              )}

              {submissionStatus === 'success' && (
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl text-center space-y-6">
                  <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
                    <CheckCircle size={32} className="text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">অনুরোধ সফলভাবে জমা হয়েছে!</h2>
                    <p className="text-slate-400 text-sm max-w-sm mx-auto">
                      আপনার সাবমিট করা অ্যাকাউন্টটি অ্যাডমিন প্যানেলে জমা দেওয়া হয়েছে। এডমিন যাচাই করে পেমেন্ট রিলিজ করবে।
                    </p>
                  </div>
                  <button 
                    onClick={handleStartTask} 
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all text-sm"
                  >
                    আরেকটি আইডি কাজ শুরু করুন
                  </button>
                </div>
              )}
              </>
              )}
            </div>
          )}

          {/* WITHDRAW TAB */}
          {activeTab === 'withdraw' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-5xl mx-auto">
              
              {/* Request Payout Form */}
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-5">
                <h3 className="text-lg font-bold text-white">টাকা উত্তোলন করুন (Withdraw Cash)</h3>
                
                <form onSubmit={handleWithdrawRequest} className="space-y-4">
                  {/* Select Platform Payment Method */}
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5">উত্তোলন মাধ্যম (Method) - স্থায়ী লক 🔒</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['bKash', 'Nagad', 'Rocket'] as const).map(method => (
                        <button
                          key={method}
                          type="button"
                          disabled
                          className={`py-2 px-3 text-xs font-bold rounded-lg border text-center transition-all ${userWalletType === method ? 'bg-indigo-600/10 border-indigo-500/40 text-indigo-400' : 'bg-slate-950/30 border-slate-900 text-slate-600'}`}
                        >
                          {method === 'bKash' ? 'বিকাশ' : method === 'Nagad' ? 'নগদ' : 'রকেট'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Account number */}
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">অ্যাকাউন্ট নাম্বার (Phone Number) - স্থায়ী লক 🔒</label>
                    <input 
                      type="text" 
                      disabled
                      value={userWalletNumber}
                      className="w-full bg-slate-950/40 border border-slate-900 px-4 py-3 rounded-lg text-slate-500 text-sm outline-none font-mono cursor-not-allowed"
                    />
                    <p className="text-[9px] text-slate-500 mt-1">🔒 আপনার স্থায়ী ওয়ালেট নাম্বার ছাড়া অন্য কোনো নাম্বারে উত্তোলন সম্ভব নয়।</p>
                  </div>

                  {/* Withdraw Amount */}
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">উত্তোলনের পরিমাণ (Amount in Taka)</label>
                    <input 
                      type="number" 
                      placeholder={`৳ সর্বনিম্ন ৳${settings.minWithdraw || 50}`}
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 px-4 py-3 rounded-lg text-slate-300 text-sm outline-none focus:border-indigo-500 transition-all"
                    />
                  </div>

                  {/* Notification Alerts */}
                  {withdrawMsg && (
                    <div className={`p-3 rounded-lg text-xs font-semibold ${withdrawMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                      {withdrawMsg.text}
                    </div>
                  )}

                  <button 
                    type="submit"
                    className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all text-sm"
                  >
                    উত্তোলন অনুরোধ পাঠান (Submit Request)
                  </button>
                </form>
              </div>

              {/* History list */}
              <div className="lg:col-span-7 bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col h-full">
                <h3 className="text-base font-bold text-white mb-4">উত্তোলন ইতিহাস (Withdrawal History)</h3>
                
                <div className="space-y-3 overflow-y-auto max-h-[360px] flex-grow pr-1">
                  {withdrawals.filter(w => w.submittedBy === workerName).length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-sm">আপনার উত্তোলনের কোনো ইতিহাস নেই।</div>
                  ) : (
                    withdrawals.filter(w => w.submittedBy === workerName).map((w, index) => (
                      <div key={w.id || index} className="p-4 bg-slate-950 border border-slate-850 rounded-xl flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded uppercase ${
                              w.method === 'bKash' ? 'bg-pink-600/10 text-pink-500 border border-pink-500/20' :
                              w.method === 'Nagad' ? 'bg-orange-600/10 text-orange-500 border border-orange-500/20' :
                              'bg-sky-600/10 text-sky-500 border border-sky-500/20'
                            }`}>{w.method}</span>
                            <span className="text-slate-400 text-xs font-medium font-mono">{w.number}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1">{new Date(w.createdAt).toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-white">৳{w.amount}</span>
                          <span className={`text-[9px] px-2 py-1 rounded-full font-bold uppercase tracking-wide ${
                            w.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' :
                            w.status === 'rejected' ? 'bg-rose-500/10 text-rose-400' :
                            'bg-amber-500/10 text-amber-500'
                          }`}>
                            {w.status === 'approved' ? 'Approved' : w.status === 'rejected' ? 'Rejected' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}

          {/* ADMIN: FACEBOOK CONTROL TAB */}
          {activeTab === 'admin_facebook' && (
            <AdminFacebook
              settings={settings}
              setAppSettings={setAppSettings}
              categoryFilteredSubmissions={categoryFilteredSubmissions}
              categoryGroupedSubmissions={categoryGroupedSubmissions}
              selectedSubIds={selectedSubIds}
              setSelectedSubIds={setSelectedSubIds}
              pastedUsernamesText={pastedUsernamesText}
              setPastedUsernamesText={setPastedUsernamesText}
              bulkPasteResult={bulkPasteResult}
              handleBulkPasteAction={handleBulkPasteAction}
              handleBulkSubAction={handleBulkSubAction}
              handleApproveRejectSub={handleApproveRejectSub}
              handleDeleteSub={handleDeleteSub}
              handleExportCSV={handleExportCSV}
              workerSearchQuery={workerSearchQuery}
              setWorkerSearchQuery={setWorkerSearchQuery}
              expandedWorker={expandedWorker}
              setExpandedWorker={setExpandedWorker}
              clearConfirmationText={clearConfirmationText}
              setClearConfirmationText={setClearConfirmationText}
              dbMessage={dbMessage}
              handleClearAllSubmissions={handleClearAllSubmissions}
              handleClearAllWithdrawals={handleClearAllWithdrawals}
              handleClearAllProfiles={handleClearAllProfiles}
              isClearingSubmissions={isClearingSubmissions}
              isClearingWithdrawals={isClearingWithdrawals}
              isClearingProfiles={isClearingProfiles}
              handleSaveSettings={handleSaveSettings}
              settingsStatus={settingsStatus}
              withdrawals={withdrawals}
              fbSubTab={fbSubTab}
              setFbSubTab={setFbSubTab}
            />
          )}

          {/* ADMIN: INSTAGRAM CONTROL TAB */}
          {activeTab === 'admin_instagram' && (
            <AdminInstagram
              settings={settings}
              setAppSettings={setAppSettings}
              categoryFilteredSubmissions={categoryFilteredSubmissions}
              categoryGroupedSubmissions={categoryGroupedSubmissions}
              selectedSubIds={selectedSubIds}
              setSelectedSubIds={setSelectedSubIds}
              pastedUsernamesText={pastedUsernamesText}
              setPastedUsernamesText={setPastedUsernamesText}
              bulkPasteResult={bulkPasteResult}
              handleBulkPasteAction={handleBulkPasteAction}
              handleBulkSubAction={handleBulkSubAction}
              handleApproveRejectSub={handleApproveRejectSub}
              handleDeleteSub={handleDeleteSub}
              handleExportCSV={handleExportCSV}
              workerSearchQuery={workerSearchQuery}
              setWorkerSearchQuery={setWorkerSearchQuery}
              expandedWorker={expandedWorker}
              setExpandedWorker={setExpandedWorker}
              clearConfirmationText={clearConfirmationText}
              setClearConfirmationText={setClearConfirmationText}
              dbMessage={dbMessage}
              handleClearAllSubmissions={handleClearAllSubmissions}
              handleClearAllWithdrawals={handleClearAllWithdrawals}
              handleClearAllProfiles={handleClearAllProfiles}
              isClearingSubmissions={isClearingSubmissions}
              isClearingWithdrawals={isClearingWithdrawals}
              isClearingProfiles={isClearingProfiles}
              handleSaveSettings={handleSaveSettings}
              settingsStatus={settingsStatus}
              withdrawals={withdrawals}
              igSubTab={igSubTab}
              setIgSubTab={setIgSubTab}
            />
          )}

          {/* ADMIN: WITHDRAWALS APPROVAL TAB */}
          {activeTab === 'admin_withdrawals' && (
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                <h3 className="text-lg font-bold text-white">উত্তোলন অনুরোধ ও পেমেন্ট (Payouts Manager)</h3>
                <p className="text-xs text-slate-400 mt-1">
                  ইউজারদের বিকাশ, নগদ ও রকেট পেমেন্ট উত্তোলন অনুরোধ এখানে থেকে অনুমোদন করুন।
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-950 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-800">
                        <th className="py-4 px-6">Worker Name</th>
                        <th className="py-4 px-4">Method</th>
                        <th className="py-4 px-4">Account Number</th>
                        <th className="py-4 px-4">Amount</th>
                        <th className="py-4 px-4">Submitted At</th>
                        <th className="py-4 px-4 text-center">Status</th>
                        <th className="py-4 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {withdrawals.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-10 text-center text-slate-500 text-sm">কোনো উত্তোলনের অনুরোধ নেই।</td>
                        </tr>
                      ) : (
                        withdrawals.map((w, index) => (
                          <tr key={w.id || index} className="hover:bg-slate-950/40 transition-colors">
                            <td className="py-4 px-6 text-slate-300 font-bold text-xs">{w.submittedBy}</td>
                            <td className="py-4 px-4">
                              <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded uppercase ${
                                w.method === 'bKash' ? 'bg-pink-600/10 text-pink-500 border border-pink-500/20' :
                                w.method === 'Nagad' ? 'bg-orange-600/10 text-orange-500 border border-orange-500/20' :
                                'bg-sky-600/10 text-sky-500 border border-sky-500/20'
                              }`}>{w.method}</span>
                            </td>
                            <td className="py-4 px-4 font-mono text-xs text-slate-300">{w.number}</td>
                            <td className="py-4 px-4 text-white font-extrabold text-xs">৳{w.amount} Taka</td>
                            <td className="py-4 px-4 text-slate-500 text-[10px]">{new Date(w.createdAt).toLocaleString()}</td>
                            <td className="py-4 px-4 text-center">
                              <span className={`text-[9px] px-2 py-1 rounded font-bold uppercase ${
                                w.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' :
                                w.status === 'rejected' ? 'bg-rose-500/10 text-rose-400' :
                                'bg-amber-500/10 text-amber-500'
                              }`}>
                                {w.status}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-right">
                              {w.status === 'pending' ? (
                                <div className="flex gap-1.5 justify-end">
                                  <button 
                                    onClick={() => handleApproveRejectWithdraw(w.id || '', 'approved')}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] rounded-lg transition-colors animate-pulse"
                                  >
                                    Approve
                                  </button>
                                  <button 
                                    onClick={() => handleApproveRejectWithdraw(w.id || '', 'rejected')}
                                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] rounded-lg transition-colors"
                                  >
                                    Reject
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-500 font-bold uppercase">Settled</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ADMIN: SYSTEM/BOT SETTINGS TAB */}
          {activeTab === 'admin_bot' && (
            <AdminBot
              settings={settings}
              setAppSettings={setAppSettings}
              handleSaveSettings={handleSaveSettings}
              settingsStatus={settingsStatus}
              handleDetectChatId={handleDetectChatId}
              findingChatId={findingChatId}
              chatIdMessage={chatIdMessage}
              broadcastMessageText={broadcastMessageText}
              setBroadcastMessageText={setBroadcastMessageText}
              handleSendBroadcast={handleSendBroadcast}
              isBroadcasting={isBroadcasting}
              broadcastStatus={broadcastStatus}
            />
          )}
        </>
      )}
      </div>
    </div>
        
        <div>
          <AnimatePresence>
            {showLoginModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowLoginModal(false)}
                  className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
                />
                
                {/* Modal Body */}
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 16 }}
                  className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl"
                >
                  <div className="mb-4 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-400 mb-3">
                      <Shield size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-white">এডমিন প্যানেল ভেরিফিকেশন (Admin Verification)</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      এই প্যানেলে প্রবেশ করতে অনুগ্রহ করে সিকিউরিটি পাসওয়ার্ডটি প্রদান করুন।
                    </p>
                  </div>

                  <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Admin Security Password</label>
                      <input 
                        type="password"
                        placeholder="পাসওয়ার্ড দিন"
                        value={adminPasswordInput}
                        onChange={(e) => setAdminPasswordInput(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 px-4 py-3 rounded-lg text-slate-300 text-sm outline-none focus:border-indigo-500 transition-all text-center tracking-widest"
                        autoFocus
                      />
                    </div>

                    {loginError && (
                      <p className="text-xs text-rose-400 text-center font-medium leading-relaxed bg-rose-500/10 py-2.5 px-3 rounded-lg border border-rose-500/15">
                        {loginError}
                      </p>
                    )}

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowLoginModal(false)}
                        className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all text-sm"
                      >
                        বাতিল করুন
                      </button>
                      <button
                        type="submit"
                        disabled={isVerifyingPassword}
                        className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg transition-all text-sm flex items-center justify-center gap-2"
                      >
                        {isVerifyingPassword ? (
                          <>
                            <RefreshCw size={15} className="animate-spin" />
                            যাচাই হচ্ছে...
                          </>
                        ) : (
                          'প্রবেশ করুন'
                        )}
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}

            {/* Custom Modal: Work Selection */}
            {showWorkSelectModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowWorkSelectModal(false)} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl space-y-4">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Grid size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-white">কাজের ক্যাটাগরি নির্বাচন করুন</h3>
                    <p className="text-xs text-slate-400 mt-1">যেকোনো একটি কাজ সম্পন্ন করে সহজেই ইনকাম শুরু করুন</p>
                  </div>
                  <div className="space-y-3 pt-2">
                    <button 
                      onClick={() => { setActiveTab('instagram'); setShowWorkSelectModal(false); }}
                      className="w-full p-4 bg-gradient-to-r from-purple-900/40 to-indigo-900/20 hover:from-purple-900/60 hover:to-indigo-900/40 border border-purple-500/30 rounded-xl flex items-center gap-4 transition-all"
                    >
                      <div className="w-10 h-10 bg-purple-500/10 text-purple-400 rounded-lg flex items-center justify-center">
                        <Instagram size={20} />
                      </div>
                      <div className="text-left">
                        <span className="font-bold text-white text-sm block">📸 ইনস্টাগ্রাম টু-এফএ কাজ</span>
                        <span className="text-[11px] text-purple-300">প্রতি সঠিক আইডি সাবমিশনে ৳{settings.ratePerId} Taka</span>
                      </div>
                    </button>

                    <button 
                      onClick={() => { 
                        alert("ফেসবুক কাজ করার জন্য এডমিনের দেওয়া ইনস্ট্রাকশন ও দৈনিক পাসওয়ার্ড ব্যবহার করুন। আপনি ফেসবুক কন্ট্রোলের মাধ্যমে এডমিন ভিউ পাবেন।");
                        setShowWorkSelectModal(false);
                      }}
                      className="w-full p-4 bg-gradient-to-r from-blue-900/40 to-indigo-900/20 hover:from-blue-900/60 hover:to-indigo-900/40 border border-blue-500/30 rounded-xl flex items-center gap-4 transition-all"
                    >
                      <div className="w-10 h-10 bg-blue-500/10 text-blue-400 rounded-lg flex items-center justify-center">
                        <Facebook size={20} />
                      </div>
                      <div className="text-left">
                        <span className="font-bold text-white text-sm block">👥 ফেসবুক আইডি কাজ</span>
                        <span className="text-[11px] text-blue-300">প্রতি সঠিক আইডি সাবমিশনে ৳{settings.facebookRatePerId || settings.ratePerId} Taka</span>
                      </div>
                    </button>
                  </div>
                  <button onClick={() => setShowWorkSelectModal(false)} className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors rounded-xl text-xs font-bold">
                    বন্ধ করুন
                  </button>
                </motion.div>
              </div>
            )}

            {/* Custom Modal: Detailed Balance Stats */}
            {showStatsModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowStatsModal(false)} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl space-y-4">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-3">
                      <DollarSign size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-white">ব্যালেন্স ও কাজের রিপোর্ট</h3>
                    <p className="text-xs text-slate-400 mt-1">আপনার রিয়েল-টাইম কাজের বিবরণ ও মোট আয়</p>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-3 font-medium">
                    <div className="flex justify-between text-xs text-slate-400 border-b border-slate-900 pb-2">
                      <span>ওয়ালেট অ্যাকাউন্ট:</span>
                      <span className="text-white font-mono">{workerName} ({userWalletType})</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">মোট আয় (Total Earned):</span>
                      <span className="text-white font-bold">৳{calculateUserTotalEarned(workerName)} Taka</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">উত্তোলনযোগ্য ব্যালেন্স (Available):</span>
                      <span className="text-emerald-400 font-extrabold">৳{calculateUserBalance(workerName)} Taka</span>
                    </div>
                    <div className="flex justify-between text-xs border-t border-slate-900 pt-2 text-slate-400">
                      <span>অনুমোদিত সাবমিশন:</span>
                      <span className="text-blue-400 font-bold">{getApprovedCount(workerName)}টি</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>অপেক্ষমান সাবমিশন:</span>
                      <span className="text-amber-500 font-bold">{getPendingCount(workerName)}টি</span>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-500 bg-amber-500/5 p-3 rounded-lg border border-amber-500/10 leading-relaxed">
                    ℹ️ প্রতি সঠিক আইডি এপ্রুভ হওয়ার পর ব্যালেন্সে সরাসরি টাকা যুক্ত হয়ে যায়। এডমিন চেক করার পূর্বে আইডি পেন্ডিং থাকবে।
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => { setActiveTab('withdraw'); setShowStatsModal(false); }} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all">
                      টাকা উত্তোলন করুন
                    </button>
                    <button onClick={() => setShowStatsModal(false)} className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all">
                      বন্ধ করুন
                    </button>
                  </div>
                </motion.div>
              </div>
            )}

            {/* Custom Modal: My Referrals */}
            {showReferralModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowReferralModal(false)} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl space-y-4">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-amber-500/10 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Users size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-white">🎁 রেফারেল ইনকাম প্রোগ্রাম</h3>
                    <p className="text-xs text-slate-400 mt-1">বন্ধুদের রেফার করে আজীবনে ইনকাম করুন ১০% কমিশন!</p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">আপনার ব্যক্তিগত রেফারেল লিংক</label>
                      <div className="flex gap-2">
                        <div className="flex-grow bg-slate-950 border border-slate-800 p-3 rounded-lg font-mono text-xs text-indigo-400 tracking-tight truncate select-all">
                          https://t.me/accounttradecenterXincome_bot?start=ref_{workerName || "user"}
                        </div>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(`https://t.me/accounttradecenterXincome_bot?start=ref_${workerName || "user"}`);
                            alert("রেফার লিংক কপি হয়েছে!");
                          }}
                          className="px-3 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-lg text-white"
                        >
                          Copy
                        </button>
                      </div>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-2 text-xs leading-relaxed text-slate-300">
                      <p>📢 <b>কমিশন পলিসি:</b></p>
                      <ul className="list-disc pl-4 space-y-1 text-slate-400">
                        <li>আপনার রেফার লিংকে ক্লিক করে কেউ আমাদের টেলিগ্রাম বটে জয়েন হলে সে আপনার রেফার হবে।</li>
                        <li>সে যতগুলো সঠিক আইডি তৈরি করে সাবমিট করবে, প্রতি আইডির জন্য আপনি পাবেন ১০% অতিরিক্ত বোনাস কমিশন!</li>
                        <li>এটি একটি আনলিমিটেড আজীবন অফার, রেফার করুন বেশি এবং আয় করুন দ্বিগুণ!</li>
                      </ul>
                    </div>
                  </div>

                  <button onClick={() => setShowReferralModal(false)} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all">
                    বন্ধ করুন
                  </button>
                </motion.div>
              </div>
            )}

            {/* Custom Modal: Help Guide */}
            {showHelpModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowHelpModal(false)} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-3">
                      <AlertCircle size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-white">👶 আমি নতুন - কাজ শিখুন</h3>
                    <p className="text-xs text-slate-400 mt-1">ধাপগুলো অনুসরণ করে সহজেই কাজ আয়ত্ত করুন</p>
                  </div>

                  <div className="space-y-4">
                    {/* Fake video block */}
                    <div className="aspect-video bg-slate-950 border border-slate-850 rounded-xl flex flex-col items-center justify-center p-4 relative overflow-hidden group cursor-pointer">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10"></div>
                      <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center text-white z-20 group-hover:scale-110 transition-transform">
                        <span className="text-xl pl-0.5">▶</span>
                      </div>
                      <span className="z-20 text-xs text-slate-200 font-bold mt-2">টিউটোরিয়াল ভিডিও (Video Guide)</span>
                      <span className="z-20 text-[10px] text-slate-500">How to create Instagram 2FA accounts</span>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">ধাপসমূহ (Step-by-step Guides):</h4>
                      <div className="space-y-2 text-xs text-slate-400">
                        <div className="flex gap-2">
                          <span className="w-5 h-5 bg-indigo-500/10 text-indigo-400 rounded-full flex items-center justify-center shrink-0 font-bold">১</span>
                          <p>ড্যাশবোর্ডের <b>"কাজ শুরু করুন"</b> বাটনে চাপ দিন, সিস্টেম আপনাকে একটি র্যান্ডম ইউজারনেম ও পাসওয়ার্ড দিয়ে দিবে।</p>
                        </div>
                        <div className="flex gap-2">
                          <span className="w-5 h-5 bg-indigo-500/10 text-indigo-400 rounded-full flex items-center justify-center shrink-0 font-bold">২</span>
                          <p>এই ক্রেডেনশিয়াল কপি করে ইনস্টাগ্রাম অ্যাপে যান এবং নতুন অ্যাকাউন্ট খুলুন।</p>
                        </div>
                        <div className="flex gap-2">
                          <span className="w-5 h-5 bg-indigo-500/10 text-indigo-400 rounded-full flex items-center justify-center shrink-0 font-bold">৩</span>
                          <p>অ্যাকাউন্টের সেটিংস এ গিয়ে ২-ফ্যাক্টর অথেনটিকেশন (2FA Key) চালু করুন এবং পাওয়া Secret Key টি আমাদের বক্সে পেস্ট করুন।</p>
                        </div>
                        <div className="flex gap-2">
                          <span className="w-5 h-5 bg-indigo-500/10 text-indigo-400 rounded-full flex items-center justify-center shrink-0 font-bold">৪</span>
                          <p>আমাদের জেনারেট করা ৬ সংখ্যার কোড ইনস্টাগ্রামে ইনপুট দিয়ে অ্যাকাউন্ট ভেরিফাই করুন এবং অ্যাডমিনে জমা দিন।</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button onClick={() => setShowHelpModal(false)} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all">
                    বন্ধ করুন
                  </button>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Admin Toast Notifications */}
          <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
            <AnimatePresence>
              {adminToasts.map((toast) => (
                <motion.div
                  key={toast.id}
                  initial={{ opacity: 0, y: 30, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, y: -20 }}
                  className={`p-4 rounded-xl shadow-2xl border text-xs font-bold flex items-center gap-3 pointer-events-auto backdrop-blur-md ${
                    toast.type === 'success' 
                      ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/30' 
                      : toast.type === 'error'
                      ? 'bg-red-950/90 text-red-300 border-red-500/30'
                      : 'bg-indigo-950/90 text-indigo-300 border-indigo-500/30'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    toast.type === 'success' ? 'bg-emerald-400' : toast.type === 'error' ? 'bg-red-400' : 'bg-indigo-400'
                  }`} />
                  <div className="flex-1 leading-relaxed">{toast.message}</div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
