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
  List
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

export default function App() {
  // Navigation & Role State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'instagram' | 'withdraw' | 'admin_submissions' | 'admin_withdrawals' | 'admin_settings'>('dashboard');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
        setActiveTab('admin_submissions');
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
  const [adminCategory, setAdminCategory] = useState<'instagram' | 'facebook'>('instagram');

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
      fetch("/api/telegram-direct-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetWalletNumber: sub.submittedBy,
          type: newStatus === 'approved' ? 'id_approved' : 'id_rejected',
          details: { username: sub.username, category: sub.category }
        })
      }).catch(err => console.error("Error triggering user notification:", err));
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
    for (const id of selectedSubIds) {
      await updateSubmissionStatus(id, newStatus);
      
      const sub = submissions.find(s => s.id === id);
      if (sub) {
        fetch("/api/telegram-direct-notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetWalletNumber: sub.submittedBy,
            type: newStatus === 'approved' ? 'id_approved' : 'id_rejected',
            details: { username: sub.username, category: sub.category }
          })
        }).catch(err => console.error("Error triggering user notification:", err));
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

    for (const sub of matchingSubs) {
      if (!sub.id) continue;
      await updateSubmissionStatus(sub.id, newStatus);
      updatedIds.push(sub.id);
      processedCount++;

      // Notify user via Telegram
      fetch("/api/telegram-direct-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetWalletNumber: sub.submittedBy,
          type: newStatus === 'approved' ? 'id_approved' : 'id_rejected',
          details: { username: sub.username, category: sub.category }
        })
      }).catch(err => console.error("Error triggering user notification:", err));
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
      fetch("/api/telegram-direct-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetWalletNumber: w.submittedBy,
          type: newStatus === 'approved' ? 'withdraw_approved' : 'withdraw_rejected',
          details: { amount: w.amount, method: w.method, number: w.number }
        })
      }).catch(err => console.error("Error triggering withdraw notification:", err));
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
    // Earn settings.ratePerId per approved account
    const approvedCount = submissions.filter(s => s.submittedBy === name && s.status === 'approved').length;
    const totalEarned = approvedCount * settings.ratePerId;
    
    // Deduct approved withdrawals
    const withdrawnAmount = withdrawals
      .filter(w => w.submittedBy === name && w.status === 'approved')
      .reduce((sum, current) => sum + current.amount, 0);

    return totalEarned - withdrawnAmount;
  };

  const calculateUserTotalEarned = (name: string) => {
    const approvedCount = submissions.filter(s => s.submittedBy === name && s.status === 'approved').length;
    return approvedCount * settings.ratePerId;
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
                <button onClick={() => { setActiveTab('admin_submissions'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium rounded-lg transition-all ${activeTab === 'admin_submissions' ? 'bg-indigo-950 border border-indigo-800/50 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                  <Shield size={15} />
                  <span>আইডি অনুমোদন (IDs Approval)</span>
                </button>
                <button onClick={() => { setActiveTab('admin_withdrawals'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium rounded-lg transition-all ${activeTab === 'admin_withdrawals' ? 'bg-indigo-950 border border-indigo-800/50 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                  <DollarSign size={15} />
                  <span>পেমেন্ট রিকোয়েস্ট (Payouts)</span>
                </button>
                <button onClick={() => { setActiveTab('admin_settings'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium rounded-lg transition-all ${activeTab === 'admin_settings' ? 'bg-indigo-950 border border-indigo-800/50 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                  <Settings size={15} />
                  <span>টেলিগ্রাম সেটিংস (Settings)</span>
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

          {/* ADMIN: SUBMISSIONS APPROVAL TAB */}
          {activeTab === 'admin_submissions' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                <div>
                  <h3 className="text-lg font-bold text-white">আইডি সাবমিশন ও অনুমোদন (Submissions Manager)</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    মোট {categoryFilteredSubmissions.length}টি {adminCategory === 'facebook' ? 'ফেসবুক' : 'ইনস্টাগ্রাম'} আইডি রেকর্ড রয়েছে। অনুমোদন এবং বাল্ক অনুমোদন সিলেক্ট করুন।
                  </p>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={handleExportCSV}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors border border-slate-700"
                  >
                    <Download size={14} />
                    <span>এক্সেল ফাইল ডাউনলোড (CSV)</span>
                  </button>

                  <button 
                    onClick={() => handleBulkSubAction('approved')}
                    disabled={selectedSubIds.length === 0}
                    className="px-3.5 py-2 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/20 disabled:opacity-40 text-xs font-bold rounded-lg transition-all"
                  >
                    বাল্ক অনুমোদন ({selectedSubIds.length})
                  </button>

                  <button 
                    onClick={() => handleBulkSubAction('rejected')}
                    disabled={selectedSubIds.length === 0}
                    className="px-3.5 py-2 bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/20 disabled:opacity-40 text-xs font-bold rounded-lg transition-all"
                  >
                    বাল্ক বাতিল ({selectedSubIds.length})
                  </button>
                </div>
              </div>

              {/* Category Switcher bar */}
              <div className="bg-slate-900 p-2 rounded-2xl border border-slate-800 flex flex-col sm:flex-row gap-2 max-w-xl">
                <button
                  onClick={() => {
                    setAdminCategory('instagram');
                    setSelectedSubIds([]);
                  }}
                  className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 border ${
                    adminCategory === 'instagram'
                      ? 'bg-gradient-to-r from-pink-600 to-indigo-600 border-indigo-500 text-white shadow-md'
                      : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Instagram size={14} />
                  <span>Instagram Work ({submissions.filter(s => (s.category || 'instagram') === 'instagram').length})</span>
                </button>
                <button
                  onClick={() => {
                    setAdminCategory('facebook');
                    setSelectedSubIds([]);
                  }}
                  className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 border ${
                    adminCategory === 'facebook'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 border-indigo-500 text-white shadow-md'
                      : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Users size={14} />
                  <span>Facebook Work ({submissions.filter(s => s.category === 'facebook').length})</span>
                </button>
              </div>

              {/* ADMIN SUB-TABS NAVIGATION */}
              <div className="flex border-b border-slate-800 gap-1">
                <button
                  onClick={() => setAdminSubTab('all')}
                  className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-t border-x ${
                    adminSubTab === 'all'
                      ? 'bg-slate-900 border-slate-800 text-white border-t-indigo-500'
                      : 'bg-transparent border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <List size={14} />
                  <span>সব আইডি তালিকা ({categoryFilteredSubmissions.length})</span>
                </button>
                <button
                  onClick={() => setAdminSubTab('user_summary')}
                  className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-t border-x ${
                    adminSubTab === 'user_summary'
                      ? 'bg-slate-900 border-slate-800 text-white border-t-indigo-500'
                      : 'bg-transparent border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <Users size={14} />
                  <span>ইউজার ভিত্তিক সামারি ({categoryGroupedSubmissions.length})</span>
                </button>
                <button
                  onClick={() => setAdminSubTab('db_control')}
                  className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-t border-x ${
                    adminSubTab === 'db_control'
                      ? 'bg-slate-900 border-slate-800 text-white border-t-rose-500 font-bold text-rose-400'
                      : 'bg-transparent border-transparent text-rose-500/70 hover:text-rose-400'
                  }`}
                >
                  <Database size={14} />
                  <span>ডাটাবেজ কন্ট্রোল ও রিসেট ⚠️</span>
                </button>
              </div>

              {adminSubTab === 'all' && (
                <>
                  {/* BULK USERNAME PASTE ACTIONS */}
                  <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
                          পেস্টিং বাল্ক একশন (Bulk Username Paste Action)
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-1">
                          একসাথে অনেকগুলো ইউজারনেম কপি করে এনে এখানে পেস্ট করে সরাসরি অনুমোদন বা বাতিল করতে পারেন।
                        </p>
                      </div>
                      <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded font-bold border border-indigo-500/15">অটো-টেলিগ্রাম নোটিফিকেশন ⚡</span>
                    </div>

                    <div className="space-y-3">
                      <textarea
                        rows={3}
                        value={pastedUsernamesText}
                        onChange={(e) => setPastedUsernamesText(e.target.value)}
                        placeholder="এখানে ইউজারনেমগুলো পেস্ট করুন (যেমন: abir_khan_secure4783, tanvir_ig_insta9344 অথবা স্পেস, কমা বা নতুন লাইনে আলাদা করে লিখুন)"
                        className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-slate-300 text-xs font-mono outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600 leading-relaxed"
                      />

                      {bulkPasteResult && (
                        <div className={`p-3 rounded-xl text-xs font-medium leading-relaxed border ${
                          bulkPasteResult.type === 'success' 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {bulkPasteResult.text}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => handleBulkPasteAction('rejected')}
                          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg shadow-lg transition-all flex items-center gap-1.5"
                        >
                          ❌ পেস্টকৃতগুলো বাতিল করুন (Bulk Reject)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBulkPasteAction('approved')}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-lg transition-all flex items-center gap-1.5"
                        >
                          ✅ পেস্টকৃতগুলো অনুমোদন করুন (Bulk Approve)
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Submissions list */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-950 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-800">
                            <th className="py-4 px-6 w-12 text-center">
                              <input 
                                type="checkbox"
                                checked={selectedSubIds.length === categoryFilteredSubmissions.length && categoryFilteredSubmissions.length > 0}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedSubIds(categoryFilteredSubmissions.map(s => s.id || '').filter(Boolean));
                                  } else {
                                    setSelectedSubIds([]);
                                  }
                                }}
                                className="rounded accent-indigo-600"
                              />
                            </th>
                            {adminCategory === 'facebook' ? (
                              <>
                                <th className="py-4 px-4">UID (Username)</th>
                                <th className="py-4 px-4">Password</th>
                                <th className="py-4 px-4">Name</th>
                                <th className="py-4 px-4">Cookie</th>
                              </>
                            ) : (
                              <>
                                <th className="py-4 px-4">Username</th>
                                <th className="py-4 px-4">Password</th>
                                <th className="py-4 px-4">2FA Key</th>
                              </>
                            )}
                            <th className="py-4 px-4">Worker</th>
                            <th className="py-4 px-4">Submitted At</th>
                            <th className="py-4 px-4 text-center">Status</th>
                            <th className="py-4 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {categoryFilteredSubmissions.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="py-10 text-center text-slate-500 text-sm">কোনো আইডি এখনও জমা দেওয়া হয়নি।</td>
                            </tr>
                          ) : (
                            categoryFilteredSubmissions.map((sub, index) => (
                              <tr key={sub.id || index} className="hover:bg-slate-950/40 transition-colors">
                                <td className="py-4 px-6 text-center">
                                  <input 
                                    type="checkbox"
                                    checked={selectedSubIds.includes(sub.id || '')}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedSubIds(prev => [...prev, sub.id || '']);
                                      } else {
                                        setSelectedSubIds(prev => prev.filter(id => id !== sub.id));
                                      }
                                    }}
                                    className="rounded accent-indigo-600"
                                  />
                                </td>
                                {adminCategory === 'facebook' ? (
                                  <>
                                    <td className="py-4 px-4 font-mono text-xs text-white truncate max-w-[140px]" title={sub.username}>{sub.username}</td>
                                    <td className="py-4 px-4 font-mono text-xs text-slate-400 truncate max-w-[140px]" title={sub.password}>{sub.password}</td>
                                    <td className="py-4 px-4 text-slate-300 text-xs font-semibold">{sub.firstName || ""} {sub.lastName || ""}</td>
                                    <td className="py-4 px-4 font-mono text-xs text-indigo-400 truncate max-w-[160px]" title={sub.cookie}>
                                      <div className="flex items-center gap-1.5">
                                        <span className="truncate max-w-[100px]">{sub.cookie}</span>
                                        <button
                                          onClick={() => {
                                            navigator.clipboard.writeText(sub.cookie || "");
                                            alert("Cookie copied to clipboard!");
                                          }}
                                          className="text-[9px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700 font-bold flex-shrink-0"
                                        >
                                          Copy
                                        </button>
                                      </div>
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td className="py-4 px-4 font-mono text-xs text-white truncate max-w-[140px]" title={sub.username}>{sub.username}</td>
                                    <td className="py-4 px-4 font-mono text-xs text-slate-400 truncate max-w-[140px]" title={sub.password}>{sub.password}</td>
                                    <td className="py-4 px-4 font-mono text-xs text-indigo-400 truncate max-w-[160px]" title={sub.twoFactorKey}>{sub.twoFactorKey}</td>
                                  </>
                                )}
                                <td className="py-4 px-4 text-slate-300 text-xs font-semibold">{sub.submittedBy}</td>
                                <td className="py-4 px-4 text-slate-500 text-[10px]">{new Date(sub.createdAt).toLocaleString()}</td>
                                <td className="py-4 px-4 text-center">
                                  <span className={`text-[9px] px-2 py-1 rounded font-bold uppercase ${
                                    sub.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' :
                                    sub.status === 'rejected' ? 'bg-rose-500/10 text-rose-400' :
                                    'bg-amber-500/10 text-amber-500'
                                  }`}>
                                    {sub.status}
                                  </span>
                                </td>
                                <td className="py-4 px-4 text-right">
                                  {sub.status === 'pending' ? (
                                    <div className="flex gap-1.5 justify-end">
                                      <button 
                                        onClick={() => handleApproveRejectSub(sub.id || '', 'approved')}
                                        className="w-8 h-8 flex items-center justify-center bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white rounded-lg transition-colors"
                                        title="Approve"
                                      >
                                        ✓
                                      </button>
                                      <button 
                                        onClick={() => handleApproveRejectSub(sub.id || '', 'rejected')}
                                        className="w-8 h-8 flex items-center justify-center bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500 hover:text-white rounded-lg transition-colors"
                                        title="Reject"
                                      >
                                        ✕
                                      </button>
                                      <button 
                                        onClick={() => handleDeleteSub(sub.id || '')}
                                        className="w-8 h-8 flex items-center justify-center bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-600 hover:text-white rounded-lg transition-colors"
                                        title="Delete"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex gap-2 justify-end items-center">
                                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                        sub.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                                      }`}>
                                        {sub.status === 'approved' ? 'Approved' : 'Rejected'}
                                      </span>
                                      <button 
                                        onClick={() => handleDeleteSub(sub.id || '')}
                                        className="w-8 h-8 flex items-center justify-center bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-600 hover:text-white rounded-lg transition-colors"
                                        title="Delete"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {adminSubTab === 'user_summary' && (
                <div className="space-y-6 animate-fade-in">
                  {/* Search Bar */}
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row items-center gap-3">
                    <div className="relative flex-1 w-full">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                        <Users size={15} />
                      </span>
                      <input
                        type="text"
                        placeholder="ইউজার (ওয়ালেট নাম্বার) অথবা আইডি দিয়ে সার্চ করুন..."
                        value={workerSearchQuery}
                        onChange={(e) => setWorkerSearchQuery(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 pl-10 pr-4 py-2.5 rounded-lg text-slate-300 text-xs outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600"
                      />
                    </div>
                    {workerSearchQuery && (
                      <button
                        onClick={() => setWorkerSearchQuery('')}
                        className="text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20"
                      >
                        ক্লিয়ার করুন
                      </button>
                    )}
                  </div>

                  {/* Grouped list */}
                  <div className="grid grid-cols-1 gap-4">
                    {(() => {
                      const query = workerSearchQuery.toLowerCase().trim();
                      const filteredGroups = groupedSubmissions.filter(g => {
                        if (!query) return true;
                        // Match worker name
                        if (g.worker.toLowerCase().includes(query)) return true;
                        // Match any of their submission IDs
                        return g.submissions.some(sub => 
                          sub.username.toLowerCase().includes(query) ||
                          sub.password.toLowerCase().includes(query) ||
                          sub.twoFactorKey.toLowerCase().includes(query)
                        );
                      });

                      if (filteredGroups.length === 0) {
                        return (
                          <div className="bg-slate-900 border border-slate-800 rounded-2xl py-12 text-center text-slate-500 text-sm">
                            কোনো তথ্য পাওয়া যায়নি।
                          </div>
                        );
                      }

                      return filteredGroups.map((group) => {
                        const isExpanded = expandedWorker === group.worker;
                        return (
                          <div key={group.worker} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden transition-all">
                            {/* Header row */}
                            <div 
                              onClick={() => setExpandedWorker(isExpanded ? null : group.worker)}
                              className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-950/20 cursor-pointer transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400">
                                  <User size={18} />
                                </div>
                                <div>
                                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                    {group.worker}
                                    <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full font-bold border border-indigo-500/15">Worker</span>
                                  </h4>
                                  <p className="text-[10.5px] text-slate-400 mt-1">
                                    মোট আইডি সাবমিট করেছেন: <strong className="text-white">{group.total} টি</strong>
                                  </p>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-bold px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/15">
                                  Approved: {group.approved}
                                </span>
                                <span className="text-[10px] font-bold px-2.5 py-1 bg-amber-500/10 text-amber-500 rounded-full border border-amber-500/15">
                                  Pending: {group.pending}
                                </span>
                                <span className="text-[10px] font-bold px-2.5 py-1 bg-rose-500/10 text-rose-400 rounded-full border border-rose-500/15">
                                  Rejected: {group.rejected}
                                </span>
                                <div className="text-slate-400 ml-2">
                                  {isExpanded ? '▲' : '▼'}
                                </div>
                              </div>
                            </div>

                            {/* Expandable IDs list */}
                            {isExpanded && (
                              <div className="border-t border-slate-800/80 bg-slate-950/40 p-5 space-y-3">
                                <h5 className="text-xs font-bold text-slate-300">সাবমিটকৃত আইডি সমূহের তালিকা:</h5>
                                <div className="overflow-x-auto rounded-xl border border-slate-800">
                                  <table className="w-full text-left border-collapse">
                                    <thead>
                                      <tr className="bg-slate-950 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-800">
                                        <th className="py-3 px-4">Username</th>
                                        <th className="py-3 px-4">Password</th>
                                        <th className="py-3 px-4">2FA Key</th>
                                        <th className="py-3 px-4">Submitted At</th>
                                        <th className="py-3 px-4 text-center">Status</th>
                                        <th className="py-3 px-4 text-right">Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60">
                                      {group.submissions.map((sub, idx) => (
                                        <tr key={sub.id || idx} className="hover:bg-slate-950/20 transition-colors">
                                          <td className="py-3.5 px-4 font-mono text-xs text-white max-w-[130px] truncate" title={sub.username}>{sub.username}</td>
                                          <td className="py-3.5 px-4 font-mono text-xs text-slate-400 max-w-[130px] truncate" title={sub.password}>{sub.password}</td>
                                          <td className="py-3.5 px-4 font-mono text-xs text-indigo-400 max-w-[150px] truncate" title={sub.twoFactorKey}>{sub.twoFactorKey}</td>
                                          <td className="py-3.5 px-4 text-slate-500 text-[10px]">{new Date(sub.createdAt).toLocaleString()}</td>
                                          <td className="py-3.5 px-4 text-center">
                                            <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${
                                              sub.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' :
                                              sub.status === 'rejected' ? 'bg-rose-500/10 text-rose-400' :
                                              'bg-amber-500/10 text-amber-500'
                                            }`}>
                                              {sub.status}
                                            </span>
                                          </td>
                                          <td className="py-3.5 px-4 text-right">
                                            {sub.status === 'pending' ? (
                                              <div className="flex gap-1.5 justify-end">
                                                <button 
                                                  onClick={() => handleApproveRejectSub(sub.id || '', 'approved')}
                                                  className="w-7 h-7 flex items-center justify-center bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white rounded-lg text-xs transition-colors"
                                                  title="Approve"
                                                >
                                                  ✓
                                                </button>
                                                <button 
                                                  onClick={() => handleApproveRejectSub(sub.id || '', 'rejected')}
                                                  className="w-7 h-7 flex items-center justify-center bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500 hover:text-white rounded-lg text-xs transition-colors"
                                                  title="Reject"
                                                >
                                                  ✕
                                                </button>
                                                <button 
                                                  onClick={() => handleDeleteSub(sub.id || '')}
                                                  className="w-7 h-7 flex items-center justify-center bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-600 hover:text-white rounded-lg transition-colors"
                                                  title="Delete"
                                                >
                                                  <Trash2 size={12} />
                                                </button>
                                              </div>
                                            ) : (
                                              <div className="flex gap-2 justify-end items-center">
                                                <button 
                                                  onClick={() => handleDeleteSub(sub.id || '')}
                                                  className="w-7 h-7 flex items-center justify-center bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-600 hover:text-white rounded-lg transition-colors"
                                                  title="Delete"
                                                >
                                                  <Trash2 size={12} />
                                                </button>
                                              </div>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              {adminSubTab === 'db_control' && (
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-6 animate-fade-in">
                  {/* Warning Header */}
                  <div className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-xl flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400 border border-rose-500/20 shrink-0">
                      <AlertCircle size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider">বিপজ্জনক অঞ্চল (Danger Zone) — ডাটা রিসেট ও ডাটাবেজ ক্লিয়ারিং</h4>
                      <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                        এখানে থাকা অপশনগুলো ব্যবহার করে ডাটাবেজের সকল রেকর্ড চিরতরে মুছে ফেলা সম্ভব। এই অ্যাকশন সম্পূর্ণ অপরিবর্তনশীল (Irreversible) এবং কোনো ব্যাকআপ রিকভারি সম্ভব নয়। অনুগ্রহ করে সতর্কতার সাথে সিদ্ধান্ত নিন।
                      </p>
                    </div>
                  </div>

                  {/* Feedback Message */}
                  {dbMessage && (
                    <div className={`p-4 rounded-xl text-xs font-semibold border ${
                      dbMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}>
                      {dbMessage.text}
                    </div>
                  )}

                  {/* Safety input lock */}
                  <div className="bg-slate-950 p-5 rounded-xl border border-slate-800/80 space-y-3">
                    <label className="text-xs font-bold text-slate-300 block">
                      নিশ্চিত করতে নিচে ইংরেজি বড় হাতের অক্ষরে <strong className="text-rose-400 font-mono">"CONFIRM"</strong> লিখুন:
                    </label>
                    <input
                      type="text"
                      placeholder="CONFIRM"
                      value={clearConfirmationText}
                      onChange={(e) => setClearConfirmationText(e.target.value)}
                      className="w-full max-w-xs bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-lg text-slate-200 text-sm font-bold uppercase tracking-wider outline-none focus:border-rose-500 transition-all placeholder:text-slate-700"
                    />
                  </div>

                  {/* Danger operations actions */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    {/* Clear Submissions Card */}
                    <div className="bg-slate-950/50 border border-slate-800 p-5 rounded-xl flex flex-col justify-between gap-4">
                      <div>
                        <h5 className="text-xs font-bold text-white flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                          {adminCategory === 'facebook' ? 'ফেসবুক সাবমিশন ক্লিয়ার' : 'ইনস্টাগ্রাম সাবমিশন ক্লিয়ার'}
                        </h5>
                        <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                          ডাটাবেজের সকল {adminCategory === 'facebook' ? 'ফেসবুক' : 'ইনস্টাগ্রাম'} আইডি সাবমিশন রেকর্ড (মোট {categoryFilteredSubmissions.length}টি) মুছে ফেলে সম্পূর্ণ শূন্য করে দেওয়া হবে।
                        </p>
                      </div>
                      <button
                        onClick={handleClearAllSubmissions}
                        disabled={clearConfirmationText !== 'CONFIRM' || isClearingSubmissions}
                        className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-950/20 text-white disabled:text-rose-800/60 font-bold text-xs rounded-lg transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed border border-rose-600/30"
                      >
                        {isClearingSubmissions ? 'মুছে ফেলা হচ্ছে...' : `সব ${adminCategory === 'facebook' ? 'ফেসবুক' : 'ইনস্টাগ্রাম'} সাবমিশন মুছুন ❌`}
                      </button>
                    </div>

                    {/* Clear Withdrawals Card */}
                    <div className="bg-slate-950/50 border border-slate-800 p-5 rounded-xl flex flex-col justify-between gap-4">
                      <div>
                        <h5 className="text-xs font-bold text-white flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                          উইথড্রয়াল ক্লিয়ার
                        </h5>
                        <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                          ডাটাবেজের সকল প্রকার পেমেন্ট উইথড্রয়াল হিস্ট্রি (মোট {withdrawals.length}টি) মুছে ফেলা হবে।
                        </p>
                      </div>
                      <button
                        onClick={handleClearAllWithdrawals}
                        disabled={clearConfirmationText !== 'CONFIRM' || isClearingWithdrawals}
                        className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-950/20 text-white disabled:text-rose-800/60 font-bold text-xs rounded-lg transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed border border-rose-600/30"
                      >
                        {isClearingWithdrawals ? 'মুছে ফেলা হচ্ছে...' : 'সব উইথড্রয়াল মুছুন ❌'}
                      </button>
                    </div>

                    {/* Clear User Profiles Card */}
                    <div className="bg-slate-950/50 border border-slate-800 p-5 rounded-xl flex flex-col justify-between gap-4">
                      <div>
                        <h5 className="text-xs font-bold text-white flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                          ইউজার প্রোফাইল ক্লিয়ার
                        </h5>
                        <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                          ডাটাবেজে নিবন্ধিত সকল ওয়ার্কার বা ব্যবহারকারী প্রোফাইল সম্পূর্ণ ডিলিট বা রিসেট করে দেওয়া হবে।
                        </p>
                      </div>
                      <button
                        onClick={handleClearAllProfiles}
                        disabled={clearConfirmationText !== 'CONFIRM' || isClearingProfiles}
                        className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-950/20 text-white disabled:text-rose-800/60 font-bold text-xs rounded-lg transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed border border-rose-600/30"
                      >
                        {isClearingProfiles ? 'মুছে ফেলা হচ্ছে...' : 'সব ইউজার প্রোফাইল মুছুন ❌'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
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

          {/* ADMIN: SYSTEM SETTINGS TAB */}
          {activeTab === 'admin_settings' && (
            <div className="max-w-xl mx-auto space-y-6">
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">সিস্টেম কনফিগারেশন (System Settings)</h3>
                  <p className="text-xs text-slate-400">
                    এখানে আপনার টেলিগ্রাম বট এবং প্রতি আইডি কাজের রেট নির্ধারণ করতে পারেন।
                  </p>
                </div>

                <form onSubmit={handleSaveSettings} className="space-y-4 pt-2">
                  {/* ID work rate */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Instagram Rate Per Approved Account (Taka)</label>
                      <input 
                        type="number"
                        value={settings.ratePerId}
                        onChange={(e) => setAppSettings(prev => ({ ...prev, ratePerId: parseFloat(e.target.value) || 0 }))}
                        className="w-full bg-slate-950 border border-slate-800 px-4 py-3 rounded-lg text-slate-300 text-sm outline-none focus:border-indigo-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Facebook Rate Per Approved Account (Taka)</label>
                      <input 
                        type="number"
                        value={settings.facebookRatePerId !== undefined ? settings.facebookRatePerId : 45}
                        onChange={(e) => setAppSettings(prev => ({ ...prev, facebookRatePerId: parseFloat(e.target.value) || 0 }))}
                        className="w-full bg-slate-950 border border-slate-800 px-4 py-3 rounded-lg text-slate-300 text-sm outline-none focus:border-indigo-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Minimum Withdraw Limit (Taka)</label>
                      <input 
                        type="number"
                        value={settings.minWithdraw || 50}
                        onChange={(e) => setAppSettings(prev => ({ ...prev, minWithdraw: parseFloat(e.target.value) || 0 }))}
                        className="w-full bg-slate-950 border border-slate-800 px-4 py-3 rounded-lg text-slate-300 text-sm outline-none focus:border-indigo-500 transition-all"
                      />
                    </div>
                  </div>

                  {/* Facebook Settings Panel */}
                  <div className="bg-slate-950 border border-slate-800/60 p-5 rounded-xl space-y-4">
                    <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">ফেসবুক কাজ সেটিংস (Facebook Work Configs)</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Facebook First Name (বটের জন্য)</label>
                        <input 
                          type="text"
                          value={settings.facebookFirstName || ""}
                          onChange={(e) => setAppSettings(prev => ({ ...prev, facebookFirstName: e.target.value }))}
                          className="w-full bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-lg text-slate-300 text-sm outline-none focus:border-indigo-500 transition-all"
                          placeholder="e.g. Robin"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Facebook Last Name (বটের জন্য)</label>
                        <input 
                          type="text"
                          value={settings.facebookLastName || ""}
                          onChange={(e) => setAppSettings(prev => ({ ...prev, facebookLastName: e.target.value }))}
                          className="w-full bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-lg text-slate-300 text-sm outline-none focus:border-indigo-500 transition-all"
                          placeholder="e.g. Khan"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Facebook Password (বটের জন্য)</label>
                        <input 
                          type="text"
                          value={settings.facebookPassword || ""}
                          onChange={(e) => setAppSettings(prev => ({ ...prev, facebookPassword: e.target.value }))}
                          className="w-full bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-lg text-slate-300 text-sm outline-none focus:border-indigo-500 transition-all"
                          placeholder="e.g. pass123456"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 bg-slate-900/60 p-3.5 rounded-lg border border-slate-800">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Facebook Work Status (ফেসবুক কাজ সচল/বন্ধ)</span>
                        <span className="text-xs text-slate-300 font-bold">
                          {settings.facebookWorkActive !== false ? "🟢 সচল (ON)" : "🔴 বন্ধ (OFF)"}
                        </span>
                        <p className="text-[9px] text-slate-500 mt-0.5">
                          এটি বন্ধ করলে টেলিগ্রামের ফেসবুক কাজ সাময়িকভাবে অফ থাকবে।
                        </p>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setAppSettings(prev => ({ ...prev, facebookWorkActive: prev.facebookWorkActive === false ? true : false }))} 
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all shrink-0 ${settings.facebookWorkActive !== false ? 'bg-indigo-600' : 'bg-slate-800'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-all ${settings.facebookWorkActive !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  </div>

                  {/* Work Status Toggle */}
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg flex items-center justify-between gap-4">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Instagram Work Status (ইন্সটাগ্রাম কাজ সচল/বন্ধ)</span>
                      <span className="text-xs text-slate-300 font-bold">
                        {settings.instagramWorkActive !== false ? "🟢 সচল (ON)" : "🔴 বন্ধ (OFF)"}
                      </span>
                      <p className="text-[9px] text-slate-500 mt-0.5">
                        এটি বন্ধ করলে টেলিগ্রামের কাজ এবং ওয়েবসাইটের নতুন আইডি তৈরি সাময়িকভাবে বন্ধ হয়ে যাবে।
                      </p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setAppSettings(prev => ({ ...prev, instagramWorkActive: prev.instagramWorkActive === false ? true : false }))} 
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all shrink-0 ${settings.instagramWorkActive !== false ? 'bg-indigo-600' : 'bg-slate-800'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-all ${settings.instagramWorkActive !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  {/* Telegram token */}
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Telegram Bot Token</label>
                    <input 
                      type="text"
                      placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQRsT"
                      value={settings.telegramBotToken}
                      onChange={(e) => setAppSettings(prev => ({ ...prev, telegramBotToken: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 px-4 py-3 rounded-lg text-slate-300 text-sm outline-none focus:border-indigo-500 transition-all"
                    />
                  </div>

                  {/* Telegram chat ID with auto detector */}
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Telegram Chat ID / Group ID</label>
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        placeholder="e.g. -100XXXXXXXXXX or @my_channel"
                        value={settings.telegramChatId}
                        onChange={(e) => setAppSettings(prev => ({ ...prev, telegramChatId: e.target.value }))}
                        className="flex-grow bg-slate-950 border border-slate-800 px-4 py-3 rounded-lg text-slate-300 text-sm outline-none focus:border-indigo-500 transition-all"
                      />
                      <button
                        type="button"
                        onClick={handleDetectChatId}
                        disabled={findingChatId}
                        className="px-4 py-3 bg-indigo-600/10 border border-indigo-500/20 hover:bg-indigo-600 text-indigo-400 hover:text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50 whitespace-nowrap"
                      >
                        {findingChatId ? 'খোঁজা হচ্ছে...' : 'আইডি খুঁজুন 🔍'}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      বটকে গ্রুপে অ্যাড করে একটি মেসেজ দেওয়ার পর "আইডি খুঁজুন" বাটনে চাপ দিলে অটোমেটিক আইডি বসে যাবে।
                    </p>
                  </div>

                  {/* Admin Password */}
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Admin Panel Access Password</label>
                    <input 
                      type="password"
                      placeholder="e.g. admin123"
                      value={settings.adminPassword || ''}
                      onChange={(e) => setAppSettings(prev => ({ ...prev, adminPassword: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 px-4 py-3 rounded-lg text-slate-300 text-sm outline-none focus:border-indigo-500 transition-all"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      🔒 এডমিন প্যানেলে প্রবেশ করার সিকিউরিটি পাসওয়ার্ড। এটি ডাটাবেজে এনক্রিপ্ট হয়ে সুরক্ষিত থাকবে।
                    </p>
                  </div>

                  {/* Daily Generated Password */}
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Daily Generated Instagram Password (ঐচ্ছিক)</label>
                    <input 
                      type="text"
                      placeholder="খালি রাখলে প্রতিবার রেন্ডম পাসওয়ার্ড তৈরি হবে"
                      value={settings.dailyPassword || ''}
                      onChange={(e) => setAppSettings(prev => ({ ...prev, dailyPassword: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 px-4 py-3 rounded-lg text-slate-300 text-sm outline-none focus:border-indigo-500 transition-all"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      নির্ধারিত পাসওয়ার্ড দিলে ইউজার কাজ শুরু করার পর অটোমেটিক এই পাসওয়ার্ডটিই পাবে।
                    </p>
                  </div>

                  {chatIdMessage && (
                    <div className={`p-3.5 rounded-xl text-xs font-medium leading-relaxed ${
                      chatIdMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      chatIdMessage.type === 'error' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                      'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 animate-pulse'
                    }`}>
                      {chatIdMessage.text}
                    </div>
                  )}

                  <AnimatePresence>
                    {settingsStatus && (
                      <motion.div
                        initial={{ opacity: 0, y: -12, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 12, scale: 0.96 }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                        className={`p-4 rounded-xl border flex items-start gap-3 ${
                          settingsStatus.type === 'success' 
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 shadow-lg shadow-emerald-500/5' 
                            : settingsStatus.type === 'error'
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-300 shadow-lg shadow-rose-500/5'
                            : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300 border-dashed'
                        }`}
                      >
                        {settingsStatus.type === 'success' && (
                          <div className="p-1 bg-emerald-500/20 rounded-lg text-emerald-400 flex-shrink-0">
                            <CheckCircle size={18} className="animate-bounce" />
                          </div>
                        )}
                        {settingsStatus.type === 'error' && (
                          <div className="p-1 bg-rose-500/20 rounded-lg text-rose-400 flex-shrink-0">
                            <XCircle size={18} />
                          </div>
                        )}
                        {settingsStatus.type === 'saving' && (
                          <div className="p-1 bg-indigo-500/20 rounded-lg text-indigo-400 flex-shrink-0">
                            <RefreshCw size={18} className="animate-spin" />
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="text-xs font-bold uppercase tracking-wider mb-0.5">
                            {settingsStatus.type === 'success' ? 'সফল হয়েছে! (Saved)' : settingsStatus.type === 'error' ? 'ব্যর্থ হয়েছে! (Failed)' : 'সংরক্ষণ করা হচ্ছে... (Saving)'}
                          </p>
                          <p className="text-xs font-normal leading-relaxed opacity-95">{settingsStatus.text}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button 
                    type="submit"
                    className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all text-sm"
                  >
                    সেটিংস সংরক্ষণ করুন (Save Settings)
                  </button>
                </form>
              </div>

              {/* TELEGRAM BULK BROADCAST */}
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2.5">
                    <Send className="text-indigo-400" size={18} />
                    টেলিগ্রাম বাল্ক ব্রডকাস্ট (Telegram Bulk Broadcast)
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    বটের সাথে কানেক্টেড সকল ব্যবহারকারীকে একসাথে সরাসরি মেসেজ বা নোটিশ পাঠান।
                  </p>
                </div>

                <form onSubmit={handleSendBroadcast} className="space-y-4 pt-2">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Broadcast Message Text (HTML Supported)</label>
                    <textarea 
                      rows={4}
                      placeholder="যেমন: 📢 আমাদের নতুন আপডেট এসেছে! অথবা আপনি HTML ট্যাগ ব্যবহার করতে পারেন যেমন <b>bold</b> বা <code>code</code>"
                      value={broadcastMessageText}
                      onChange={(e) => setBroadcastMessageText(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-slate-300 text-sm outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600 leading-relaxed font-sans"
                    />
                  </div>

                  {broadcastStatus && (
                    <div className={`p-4 rounded-xl text-xs font-medium leading-relaxed border ${
                      broadcastStatus.type === 'success' 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : broadcastStatus.type === 'sending'
                        ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20 animate-pulse'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}>
                      {broadcastStatus.text}
                    </div>
                  )}

                  <button 
                    type="submit"
                    disabled={isBroadcasting}
                    className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg transition-all text-sm flex items-center justify-center gap-2"
                  >
                    {isBroadcasting ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        মেসেজ পাঠানো হচ্ছে...
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        সকল ইউজারকে মেসেজ পাঠান (Broadcast)
                      </>
                    )}
                  </button>
                </form>

                <div className="text-[11px] bg-slate-950 border border-slate-800/80 p-4 rounded-xl text-slate-400 leading-relaxed space-y-1.5">
                  <span className="font-bold text-indigo-400 block mb-0.5">💡 ব্রডকাস্ট কীভাবে কাজ করে (Guide):</span>
                  <p>১. আপনার টেলিগ্রাম বটের টোকেন সেটিংসের ওপরে সঠিকভাবে প্রদান করা থাকতে হবে।</p>
                  <p>২. মেসেজ বক্সে আপনার কাঙ্ক্ষিত মেসেজ বা নোটিশটি টাইপ করুন। আপনি সাধারণ টেক্সট ছাড়াও <code>&lt;b&gt;বোল্ড&lt;/b&gt;</code>, <code>&lt;i&gt;ইটালিক&lt;/i&gt;</code>, বা <code>&lt;code&gt;কোড&lt;/code&gt;</code> এর মতো HTML ফর্ম্যাটিং ট্যাগ ব্যবহার করতে পারেন।</p>
                  <p>৩. এরপর <b>'সকল ইউজারকে মেসেজ পাঠান'</b> বাটনে ক্লিক করলে সিস্টেম অটোমেটিকলি ডাটাবেজ থেকে সকল সচল ব্যবহারকারীর চ্যাট আইডি সংগ্রহ করে এবং ব্যাকএন্ড প্রক্সি ব্যবহার করে প্রতিটি ব্যবহারকারীকে পৃথক নোটিফিকেশন পাঠায়।</p>
                </div>
              </div>
            </div>
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
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
