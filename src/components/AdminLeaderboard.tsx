import React, { useState, useMemo } from 'react';
import { 
  Trophy, 
  Send, 
  RefreshCw, 
  CheckCircle2, 
  Calendar, 
  Flame, 
  Award, 
  Key, 
  History,
  AlertCircle,
  TrendingUp,
  Sparkles,
  Search,
  ExternalLink,
  PlusCircle,
  UserPlus,
  Trash2,
  Sliders,
  Check,
  Edit3
} from 'lucide-react';
import { 
  Submission, 
  UserProfile, 
  AppSettings, 
  LeaderboardRound, 
  LeaderboardWinner,
  calculateLeaderboardForPassword,
  detectPreviousPasswords,
  maskWorkerId,
  saveSettings
} from '../firebaseService';

interface AdminLeaderboardProps {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  submissions: Submission[];
  profiles: UserProfile[];
}

export default function AdminLeaderboard({
  settings,
  setSettings,
  submissions,
  profiles
}: AdminLeaderboardProps) {
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastStatus, setBroadcastStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [selectedHistoricalPassword, setSelectedHistoricalPassword] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'manual' | 'settings'>('overview');

  // Available dedicated categories that admin can enable/disable for leaderboard
  const allCategoryOptions = [
    { id: 'facebook', label: 'FB Cookie (ফেসবুক)', field: 'facebookPassword', workActive: settings.facebookWorkActive !== false },
    { id: 'fb_hotmail', label: 'FB Hotmail 30+fd', field: 'fbHotmailPassword', workActive: settings.fbHotmailWorkActive !== false },
    { id: 'fb_hotmail_0fd', label: 'FB Hotmail 0fd (জিরো ফ্রেন্ড)', field: 'fbHotmail0fdPassword', workActive: settings.fbHotmail0fdWorkActive !== false },
    { id: 'instagram', label: 'Instagram (ইনস্টাগ্রাম)', field: 'dailyPassword', workActive: settings.instagramWorkActive !== false },
  ];

  // Enabled categories in settings (default to facebook and fb_hotmail if not explicitly set)
  const enabledCategories: string[] = useMemo(() => {
    if (Array.isArray(settings.leaderboardEnabledCategories)) {
      return settings.leaderboardEnabledCategories;
    }
    // Default sensible categories (FB cookie and FB hotmail 30+fd, leaving 0fd off)
    return ['facebook', 'fb_hotmail'];
  }, [settings.leaderboardEnabledCategories]);

  // Handle toggling dedicated category
  const handleToggleCategory = async (catId: string) => {
    const isCurrentlyEnabled = enabledCategories.includes(catId);
    const newCats = isCurrentlyEnabled 
      ? enabledCategories.filter(c => c !== catId)
      : [...enabledCategories, catId];

    const updatedSettings: AppSettings = {
      ...settings,
      leaderboardEnabledCategories: newCats
    };

    try {
      await saveSettings(updatedSettings);
      setSettings(updatedSettings);
      setBroadcastStatus({
        success: true,
        message: `✅ লিডারবোর্ড ক্যাটাগরি আপডেট হয়েছে!`
      });
      setTimeout(() => setBroadcastStatus(null), 3000);
    } catch (err: any) {
      setBroadcastStatus({
        success: false,
        message: `❌ এরর: ${err?.message || err}`
      });
    }
  };

  // Active passwords currently live in the app (only include enabled and active categories)
  const activePasswords = useMemo(() => {
    return allCategoryOptions
      .filter(opt => enabledCategories.includes(opt.id) && opt.workActive)
      .map(opt => ({
        category: opt.id,
        label: opt.label,
        pwd: (settings as any)[opt.field] || ''
      }));
  }, [allCategoryOptions, enabledCategories, settings]);

  const activePwdList = useMemo(() => {
    return activePasswords.map(p => p.pwd.trim()).filter(Boolean);
  }, [activePasswords]);

  // Historical passwords detected from submissions (not currently active)
  const historicalPasswords = useMemo(() => {
    return detectPreviousPasswords(submissions, activePwdList);
  }, [submissions, activePwdList]);

  // Active completed round (from settings or fallback to dynamic computation)
  const currentRound: LeaderboardRound | null = useMemo(() => {
    if (settings.lastLeaderboardRound && settings.lastLeaderboardRound.winners?.length > 0) {
      return settings.lastLeaderboardRound;
    }
    // Dynamic fallback if no round explicitly recorded yet
    if (historicalPasswords.length > 0) {
      return calculateLeaderboardForPassword(submissions, profiles, historicalPasswords[0]);
    }
    if (activePwdList.length > 0) {
      return calculateLeaderboardForPassword(submissions, profiles, activePwdList[0]);
    }
    return null;
  }, [settings.lastLeaderboardRound, historicalPasswords, activePwdList, submissions, profiles]);

  // Preview for selected historical password (if admin clicks one)
  const selectedHistoricalRound: LeaderboardRound | null = useMemo(() => {
    if (!selectedHistoricalPassword) return null;
    return calculateLeaderboardForPassword(submissions, profiles, selectedHistoricalPassword);
  }, [selectedHistoricalPassword, submissions, profiles]);

  // Running round live contenders (to see who is currently in the lead)
  const runningRoundPreviews = useMemo(() => {
    return activePasswords.filter(item => Boolean(item.pwd.trim())).map(item => {
      const round = calculateLeaderboardForPassword(submissions, profiles, item.pwd, item.category);
      return {
        ...item,
        round
      };
    });
  }, [activePasswords, submissions, profiles]);

  // ----------------------------------------------------
  // MANUAL / CUSTOM LEADERBOARD CREATOR STATE
  // ----------------------------------------------------
  const [manualTitle, setManualTitle] = useState('বিশেষ কাজের শিফট লিডারবোর্ড');
  const [manualPassword, setManualPassword] = useState('');
  const [manualCategory, setManualCategory] = useState('facebook');
  const [manualWinners, setManualWinners] = useState<Array<{ workerId: string; count: number | string; label?: string }>>([
    { workerId: '01712345678', count: 185, label: '১ম স্থান' },
    { workerId: '01898765432', count: 142, label: '২য় স্থান' },
    { workerId: '01934567890', count: 98, label: '৩য় স্থান' }
  ]);
  const [isSavingManual, setIsSavingManual] = useState(false);

  // Add winner slot
  const handleAddManualWinner = () => {
    const nextRank = manualWinners.length + 1;
    setManualWinners([
      ...manualWinners,
      { workerId: '', count: '', label: `${nextRank}ম স্থান` }
    ]);
  };

  // Remove winner slot
  const handleRemoveManualWinner = (index: number) => {
    if (manualWinners.length <= 1) return;
    setManualWinners(manualWinners.filter((_, idx) => idx !== index));
  };

  // Update winner row
  const handleUpdateManualWinner = (index: number, field: 'workerId' | 'count', val: string) => {
    const updated = [...manualWinners];
    if (field === 'count') {
      updated[index].count = val === '' ? '' : parseInt(val) || 0;
    } else {
      updated[index].workerId = val;
    }
    setManualWinners(updated);
  };

  // Save manual leaderboard round
  const handleSaveManualLeaderboard = async () => {
    const validWinners: LeaderboardWinner[] = manualWinners
      .filter(w => String(w.workerId).trim().length > 0 && Number(w.count) > 0)
      .map((w, idx) => ({
        rank: idx + 1,
        workerId: String(w.workerId).trim(),
        maskedWorker: maskWorkerId(String(w.workerId).trim()),
        count: Number(w.count) || 0,
        category: manualCategory
      }));

    if (validWinners.length === 0) {
      setBroadcastStatus({
        success: false,
        message: '❌ অনুগ্রহ করে অন্তত একজন কর্মীর সঠিক আইডি/নম্বর এবং কাজের সংখ্যা লিখুন।'
      });
      return;
    }

    setIsSavingManual(true);
    try {
      const now = new Date().toISOString();
      const newRound: LeaderboardRound = {
        password: manualPassword.trim() || 'স্পেশাল শিফট',
        category: manualCategory,
        completedAt: now,
        winners: validWinners,
        totalApproved: validWinners.reduce((acc, curr) => acc + curr.count, 0),
        totalSubmissions: validWinners.reduce((acc, curr) => acc + curr.count, 0),
        isManual: true,
        note: manualTitle.trim()
      };

      const updatedSettings: AppSettings = {
        ...settings,
        lastLeaderboardRound: newRound,
        previousPassword: newRound.password,
        previousPasswordCategory: newRound.category,
        roundsHistory: [newRound, ...(settings.roundsHistory || []).slice(0, 19)]
      };

      await saveSettings(updatedSettings);
      setSettings(updatedSettings);
      
      // Invalidate backend cache
      fetch("/api/admin/invalidate-cache", { method: "POST" }).catch(() => {});

      setBroadcastStatus({
        success: true,
        message: '🎉 ম্যানুয়াল লিডারবোর্ড সফলভাবে তৈরি ও সক্রিয় লিডারবোর্ড হিসেবে সেট করা হয়েছে!'
      });
      setActiveSubTab('overview');
      setTimeout(() => setBroadcastStatus(null), 6000);
    } catch (err: any) {
      setBroadcastStatus({
        success: false,
        message: `❌ সেভ করতে ব্যর্থ: ${err?.message || err}`
      });
    } finally {
      setIsSavingManual(false);
    }
  };

  // Set selected password round as the official active round
  const handleSetActiveRound = async (roundToSet: LeaderboardRound) => {
    const updatedSettings: AppSettings = {
      ...settings,
      lastLeaderboardRound: roundToSet,
      previousPassword: roundToSet.password,
      previousPasswordCategory: roundToSet.category,
      roundsHistory: [roundToSet, ...(settings.roundsHistory || []).filter(r => r.password !== roundToSet.password).slice(0, 19)]
    };
    try {
      await saveSettings(updatedSettings);
      setSettings(updatedSettings);
      fetch("/api/admin/invalidate-cache", { method: "POST" }).catch(() => {});
      setBroadcastStatus({
        success: true,
        message: `✅ "${roundToSet.password}" পাসওয়ার্ডের ফলাফল সফলভাবে সক্রিয় লিডারবোর্ড হিসেবে সেট করা হয়েছে!`
      });
      setTimeout(() => setBroadcastStatus(null), 5000);
    } catch (err: any) {
      setBroadcastStatus({
        success: false,
        message: `❌ সংরক্ষণ করতে সমস্যা হয়েছে: ${err?.message || err}`
      });
    }
  };

  // Broadcast current round to Telegram channel
  const handleBroadcast = async (round: LeaderboardRound) => {
    if (!round) return;
    setIsBroadcasting(true);
    setBroadcastStatus(null);
    try {
      const res = await fetch('/api/admin/broadcast-leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ round })
      });
      const data = await res.json();
      if (data.success) {
        setBroadcastStatus({
          success: true,
          message: '🎉 টেলিগ্রাম চ্যানেলে সফলভাবে সেরা কর্মীদের তালিকা ঘোষণা করা হয়েছে!'
        });
      } else {
        setBroadcastStatus({
          success: false,
          message: `❌ ${data.error || data.message || 'টেলিগ্রাম চ্যানেলে পাঠাতে ব্যর্থ হয়েছে।'}`
        });
      }
    } catch (err: any) {
      setBroadcastStatus({
        success: false,
        message: `❌ এরর: ${err?.message || 'নেটওয়ার্ক সমস্যা।'}`
      });
    } finally {
      setIsBroadcasting(false);
      setTimeout(() => setBroadcastStatus(null), 7000);
    }
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { bg: 'from-amber-500/20 to-yellow-500/10 border-amber-500/50 text-amber-300', icon: '🥇', label: '১ম স্থান (1st)' };
    if (rank === 2) return { bg: 'from-slate-400/20 to-slate-500/10 border-slate-400/50 text-slate-300', icon: '🥈', label: '২য় স্থান (2nd)' };
    if (rank === 3) return { bg: 'from-amber-700/20 to-amber-800/10 border-amber-700/50 text-amber-400', icon: '🥉', label: '৩য় স্থান (3rd)' };
    return { bg: 'from-slate-800/40 to-slate-900/40 border-slate-700/40 text-slate-400', icon: `#${rank}`, label: `${rank}ম স্থান` };
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-amber-950/70 via-slate-900 to-indigo-950/70 border border-amber-500/30 rounded-2xl p-5 md:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-4">
            <div className="p-3.5 bg-gradient-to-br from-amber-500/20 to-yellow-600/20 border border-amber-500/40 rounded-2xl text-amber-400 shadow-inner">
              <Trophy size={32} />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
                সেরা কর্মী লিডারবোর্ড কন্ট্রোল
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300">
                  অটো ও ম্যানুয়াল সিস্টেম
                </span>
              </h2>
              <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
                পাসওয়ার্ডভিত্তিক স্বয়ংক্রিয় শিফট ও কাস্টম ম্যানুয়াল লিডারবোর্ড নিয়ন্ত্রণ করুন। বন্ধ থাকা কাজগুলো নির্বাচন বাদ দিয়ে শুধুমাত্র সক্রিয় কাজের ডেডিকেটেড লিডারবোর্ড প্রকাশ করুন।
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start md:self-center">
            {currentRound && (
              <button
                onClick={() => handleBroadcast(currentRound)}
                disabled={isBroadcasting}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white text-xs font-bold rounded-xl shadow-lg hover:shadow-amber-500/20 transition-all disabled:opacity-50"
              >
                <Send size={15} className={isBroadcasting ? "animate-pulse" : ""} />
                <span>{isBroadcasting ? "পোস্ট হচ্ছে..." : "📢 টেলিগ্রামে ঘোষণা দিন"}</span>
              </button>
            )}
          </div>
        </div>

        {broadcastStatus && (
          <div className={`mt-4 p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
            broadcastStatus.success 
              ? 'bg-emerald-950/60 border-emerald-700/50 text-emerald-300' 
              : 'bg-rose-950/60 border-rose-700/50 text-rose-300'
          }`}>
            {broadcastStatus.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{broadcastStatus.message}</span>
          </div>
        )}

        {/* Sub Navigation Tabs */}
        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-slate-800/80">
          <button
            onClick={() => setActiveSubTab('overview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'overview'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Trophy size={14} />
            <span>লিডারবোর্ড ওভারভিউ</span>
          </button>

          <button
            onClick={() => setActiveSubTab('manual')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'manual'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Edit3 size={14} />
            <span>✍️ ম্যানুয়াল লিডারবোর্ড তৈরি করুন</span>
          </button>

          <button
            onClick={() => setActiveSubTab('settings')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'settings'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Sliders size={14} />
            <span>⚙️ ক্যাটাগরি সিলেকশন ফিল্টার</span>
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 1. DEDICATED CATEGORY SELECTOR SETTINGS SUB-TAB */}
      {/* ---------------------------------------------------- */}
      {activeSubTab === 'settings' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-lg space-y-5">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sliders size={18} className="text-amber-400" />
              ডেডিকেটেড কাজের ক্যাটাগরি সিলেকশন (Category Visibility)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              এখানে আপনি নির্ধারণ করতে পারবেন কোন কোন কাজের লিডারবোর্ড বা পাসওয়ার্ড আপনার কর্মীরা এবং বটে দেখতে পাবে। যে কাজগুলো এখন বন্ধ আছে (যেমন: হটমেইল জিরো ফ্রেন্ড) সেগুলোর টিক উঠিয়ে দিন।
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
            {allCategoryOptions.map((opt) => {
              const isChecked = enabledCategories.includes(opt.id);
              return (
                <div
                  key={opt.id}
                  onClick={() => handleToggleCategory(opt.id)}
                  className={`cursor-pointer border rounded-2xl p-4 flex items-center justify-between transition-all select-none ${
                    isChecked 
                      ? 'bg-amber-950/20 border-amber-500/50 shadow-md' 
                      : 'bg-slate-950/60 border-slate-800/80 opacity-70 hover:opacity-100 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${
                      isChecked 
                        ? 'bg-amber-500 border-amber-400 text-slate-950' 
                        : 'border-slate-700 bg-slate-900 text-transparent'
                    }`}>
                      <Check size={14} className="stroke-[3]" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{opt.label}</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                        {opt.workActive ? (
                          <span className="text-emerald-400 font-medium">● মূল কাজ চালু আছে</span>
                        ) : (
                          <span className="text-rose-400 font-medium">○ মূল কাজ বন্ধ আছে</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                    isChecked ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-500'
                  }`}>
                    {isChecked ? 'লিডারবোর্ডে যুক্ত' : 'বাদ দেওয়া'}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 flex items-start gap-2.5">
            <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <p>
              <b>টিপস:</b> আপনি যদি হটমেইল জিরো ফ্রেন্ড (0fd) আনচেক করে রাখেন, তবে টেলিগ্রাম বটে কিংবা রানিং পাসওয়ার্ড তালিকায় এটি কর্মীদের দেখানো হবে না এবং ওই পাসওয়ার্ড পরিবর্তন হলেও স্বয়ংক্রিয়ভাবে লিডারবোর্ডে যুক্ত হবে না।
            </p>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 2. MANUAL / CUSTOM LEADERBOARD CREATOR SUB-TAB */}
      {/* ---------------------------------------------------- */}
      {activeSubTab === 'manual' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-lg space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <PlusCircle size={18} className="text-amber-400" />
              ম্যানুয়ালি লিডারবোর্ড তৈরি করুন (Manual Custom Leaderboard)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              টেলিগ্রাম বট ছাড়াও যদি আপনার বাইরে কর্মীরা কাজ করে থাকে, তবে আপনি নিজেই পছন্দের ইউজার আইডি/মোবাইল নম্বর ও কাজের সংখ্যা বসিয়ে একটি অফিশিয়াল লিডারবোর্ড তৈরি করতে পারেন।
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-300 mb-1.5 block">
                রাউন্ডের শিরোনাম / নোট:
              </label>
              <input
                type="text"
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                placeholder="যেমন: বিশেষ নাইট শিফট লিডারবোর্ড"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 mb-1.5 block">
                কাজের পাসওয়ার্ড (ঐচ্ছিক):
              </label>
              <input
                type="text"
                value={manualPassword}
                onChange={(e) => setManualPassword(e.target.value)}
                placeholder="যেমন: PASS_SHIFT_12"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-amber-300 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 mb-1.5 block">
                কাজের ক্যাটাগরি:
              </label>
              <select
                value={manualCategory}
                onChange={(e) => setManualCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="facebook">ফেসবুক কুকি (FB Cookie)</option>
                <option value="fb_hotmail">FB Hotmail 30+fd</option>
                <option value="fb_hotmail_0fd">FB Hotmail 0fd</option>
                <option value="instagram">Instagram</option>
                <option value="special">স্পেশাল শিফট / অন্যান্য</option>
              </select>
            </div>
          </div>

          {/* Winner Row Inputs */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                সেরা কর্মীদের তালিকা (ID / ওয়ালেট নম্বর ও কাজের সংখ্যা):
              </h4>
              <button
                type="button"
                onClick={handleAddManualWinner}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold rounded-lg border border-slate-700 transition-all"
              >
                <UserPlus size={14} />
                <span>+ আরো কর্মী যোগ করুন</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {manualWinners.map((winner, idx) => {
                const badge = getRankBadge(idx + 1);
                return (
                  <div
                    key={idx}
                    className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
                  >
                    <div className="flex items-center gap-2 sm:w-28 shrink-0">
                      <span className="text-xl">{badge.icon}</span>
                      <span className="text-xs font-bold text-slate-300">{idx + 1}ম স্থান</span>
                    </div>

                    <div className="flex-1">
                      <input
                        type="text"
                        value={winner.workerId}
                        onChange={(e) => handleUpdateManualWinner(idx, 'workerId', e.target.value)}
                        placeholder="কর্মী আইডি / ওয়ালেট নম্বর (যেমন: 01712345678)"
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="sm:w-36 shrink-0">
                      <div className="relative">
                        <input
                          type="number"
                          value={winner.count}
                          onChange={(e) => handleUpdateManualWinner(idx, 'count', e.target.value)}
                          placeholder="কাজের সংখ্যা"
                          className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-3 pr-8 py-2 text-xs font-bold text-amber-300 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">টি</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-center gap-2">
                      <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                        মাস্কড: {winner.workerId ? maskWorkerId(winner.workerId) : '...'}
                      </span>
                      {manualWinners.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveManualWinner(idx)}
                          className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-950/50 rounded-lg transition-all"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setActiveSubTab('overview')}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all"
            >
              বাতিল
            </button>
            <button
              type="button"
              disabled={isSavingManual}
              onClick={handleSaveManualLeaderboard}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all disabled:opacity-50"
            >
              <CheckCircle2 size={15} />
              <span>{isSavingManual ? "সংরক্ষণ হচ্ছে..." : "💾 এই লিডারবোর্ড প্রকাশ ও সক্রিয় করুন"}</span>
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 3. MAIN LEADERBOARD OVERVIEW SUB-TAB */}
      {/* ---------------------------------------------------- */}
      {activeSubTab === 'overview' && (
        <>
          {/* Main Active Round Display */}
          {currentRound ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-lg space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                    <Sparkles size={14} />
                    <span>
                      {currentRound.isManual ? 'অফিশিয়াল স্পেশাল লিডারবোর্ড (Manual Leaderboard)' : 'সর্বশেষ সমাপ্ত রাউন্ডের অফিশিয়াল ফলাফল (Active Official Round)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    {currentRound.password && (
                      <span className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
                        <Key size={14} className="text-amber-400" />
                        পাসওয়ার্ড: <code className="bg-slate-800 text-amber-300 px-2 py-0.5 rounded font-mono font-bold text-xs">{currentRound.password}</code>
                      </span>
                    )}
                    {currentRound.category && (
                      <span className="text-xs bg-blue-950/80 border border-blue-800/40 text-blue-300 px-2.5 py-0.5 rounded-full font-medium">
                        {currentRound.category === 'facebook' ? 'ফেসবুক' : currentRound.category === 'fb_hotmail' ? 'FB Hotmail 30+fd' : currentRound.category === 'fb_hotmail_0fd' ? 'FB Hotmail 0fd' : currentRound.category}
                      </span>
                    )}
                    {currentRound.isManual && (
                      <span className="text-[11px] bg-amber-500/20 border border-amber-500/40 text-amber-300 px-2.5 py-0.5 rounded-full font-bold">
                        ✍️ ম্যানুয়াল
                      </span>
                    )}
                    {currentRound.completedAt && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Calendar size={13} />
                        {new Date(currentRound.completedAt).toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka' })}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 bg-slate-800/60 px-3 py-1.5 rounded-xl border border-slate-700/50">
                    মোট কাজ: <b className="text-white">{currentRound.totalApproved || currentRound.totalSubmissions || 0} টি</b>
                  </span>
                </div>
              </div>

              {/* Winners Podium Cards (Top 3) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {currentRound.winners?.slice(0, 3).map((winner) => {
                  const badge = getRankBadge(winner.rank);
                  return (
                    <div
                      key={winner.rank}
                      className={`bg-gradient-to-b ${badge.bg} border rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between transition-all hover:scale-[1.01]`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-2xl">{badge.icon}</span>
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-900/60 border border-white/10 text-white">
                          {badge.label}
                        </span>
                      </div>

                      <div className="space-y-1 my-2">
                        <span className="text-[11px] text-slate-400 font-medium block">কর্মী আইডি / ওয়ালেট:</span>
                        <span className="text-lg font-mono font-black text-white tracking-wide block">
                          {maskWorkerId(winner.maskedWorker || winner.workerId)}
                        </span>
                      </div>

                      <div className="pt-3 mt-2 border-t border-white/10 flex items-center justify-between">
                        <span className="text-xs text-slate-300 font-medium">সম্পন্ন কাজ:</span>
                        <span className="text-base font-black text-amber-300 bg-slate-900/80 px-3 py-0.5 rounded-lg border border-amber-500/30">
                          {winner.count} টি
                        </span>
                      </div>
                    </div>
                  );
                })}

                {(!currentRound.winners || currentRound.winners.length === 0) && (
                  <div className="col-span-3 py-8 text-center text-slate-400 bg-slate-950/50 rounded-xl border border-slate-800">
                    <AlertCircle size={28} className="mx-auto mb-2 text-slate-500" />
                    <p className="text-sm">এই পাসওয়ার্ডে এখনো কোনো কাজ সম্পন্ন হয়নি।</p>
                  </div>
                )}
              </div>

              {/* Runners up (Rank 4 to 10) */}
              {currentRound.winners && currentRound.winners.length > 3 && (
                <div className="mt-4 pt-4 border-t border-slate-800">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                    পরবর্তী শীর্ষ কর্মীবৃন্দ (৪র্থ থেকে {currentRound.winners.length}ম স্থান):
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {currentRound.winners.slice(3, 10).map((w) => (
                      <div key={w.rank} className="flex items-center justify-between bg-slate-950/70 border border-slate-800/80 px-3 py-2 rounded-xl text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-400 text-[10px]">
                            {w.rank}
                          </span>
                          <span className="font-mono text-slate-300 font-bold">{maskWorkerId(w.maskedWorker || w.workerId)}</span>
                        </div>
                        <span className="font-bold text-amber-400">{w.count} টি</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
              <Trophy size={36} className="mx-auto mb-3 text-amber-500/50" />
              <h3 className="text-base font-bold text-white mb-1">কোনো সমাপ্ত রাউন্ডের ডাটা পাওয়া যায়নি</h3>
              <p className="text-xs max-w-md mx-auto mb-4">
                আপনি যখন কাজের পাসওয়ার্ড পরিবর্তন করবেন তখন স্বয়ংক্রিয়ভাবে আগের পাসওয়ার্ডের সেরা ৩ জন কর্মীর তালিকা এখানে তৈরি হবে, অথবা আপনি ম্যানুয়ালি নতুন লিডারবোর্ড তৈরি করতে পারেন।
              </p>
              <button
                onClick={() => setActiveSubTab('manual')}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition-all inline-flex items-center gap-2"
              >
                <Edit3 size={14} />
                <span>ম্যানুয়ালি তৈরি করুন</span>
              </button>
            </div>
          )}

          {/* Live Contenders: Currently Running Passwords */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm md:text-base font-bold text-white flex items-center gap-2">
                  <Flame size={18} className="text-orange-400 animate-pulse" />
                  সক্রিয় ক্যাটাগরির রানিং পাসওয়ার্ড পরিসংখ্যান (Live Contenders Preview)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  বর্তমানে চালু থাকা নির্বাচিত কাজের মধ্যে কারা এগিয়ে রয়েছে তা লাইভ দেখুন।
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {runningRoundPreviews.map((item) => (
                <div key={item.category} className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">{item.label}</span>
                    <span className="text-[10px] bg-emerald-950/80 border border-emerald-700/40 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                      রানিং
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 block mb-0.5">বর্তমান পাসওয়ার্ড:</span>
                    <code className="text-xs font-mono font-bold text-amber-300 bg-slate-900 px-2 py-1 rounded border border-slate-800 block truncate">
                      {item.pwd || 'পাসওয়ার্ড সেট নেই'}
                    </code>
                  </div>

                  <div className="border-t border-slate-800/60 pt-2.5">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                      <span>মোট জমা কাজ:</span>
                      <span className="font-bold text-white">{item.round.totalApproved || item.round.totalSubmissions || 0} টি</span>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">বর্তমানে এগিয়ে রয়েছেন:</span>
                      {item.round.winners?.slice(0, 3).map((w, idx) => (
                        <div key={w.workerId} className="flex items-center justify-between text-xs bg-slate-900/60 px-2.5 py-1.5 rounded-lg">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>
                            <span className="font-mono text-slate-300">{maskWorkerId(w.maskedWorker || w.workerId)}</span>
                          </div>
                          <span className="font-bold text-amber-300">{w.count} টি</span>
                        </div>
                      ))}

                      {(!item.round.winners || item.round.winners.length === 0) && (
                        <p className="text-[11px] text-slate-500 italic py-1">এই পাসওয়ার্ডে এখনো কাজ জমা পড়েনি।</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {runningRoundPreviews.length === 0 && (
                <div className="col-span-3 py-6 text-center text-slate-400 bg-slate-950/60 rounded-xl border border-slate-800">
                  <p className="text-xs">কোনো রানিং ক্যাটাগরি লিডারবোর্ডের জন্য সিলেক্ট করা নেই। 'ক্যাটাগরি সিলেকশন ফিল্টার' থেকে ক্যাটাগরি অন করুন।</p>
                </div>
              )}
            </div>
          </div>

          {/* Historical Passwords Inspector */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm md:text-base font-bold text-white flex items-center gap-2">
                  <History size={18} className="text-indigo-400" />
                  পূর্ববর্তী পাসওয়ার্ডের ইতিহাস ও ফলাফল অনুসন্ধান
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  আগের যেকোনো পাসওয়ার্ড নির্বাচন করে দেখে নিন সে সময় কারা শীর্ষ ৩ এ ছিল, এবং চাইলে তা অফিশিয়াল লিডারবোর্ড হিসেবে সেট করুন।
                </p>
              </div>

              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="পাসওয়ার্ড সার্চ করুন..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-48"
                />
              </div>
            </div>

            {historicalPasswords.length > 0 ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2 pt-1">
                  {historicalPasswords
                    .filter(pwd => !searchFilter || pwd.toLowerCase().includes(searchFilter.toLowerCase()))
                    .map((pwd) => {
                      const isSelected = selectedHistoricalPassword === pwd;
                      return (
                        <button
                          key={pwd}
                          onClick={() => setSelectedHistoricalPassword(isSelected ? '' : pwd)}
                          className={`px-3 py-1.5 text-xs font-mono font-bold rounded-xl border transition-all flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-indigo-950 border-indigo-500 text-indigo-300 shadow-md shadow-indigo-950'
                              : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                          }`}
                        >
                          <Key size={12} className={isSelected ? "text-indigo-400" : "text-slate-500"} />
                          <span>{pwd}</span>
                        </button>
                      );
                    })}
                </div>

                {/* Selected Historical Password Detail Preview */}
                {selectedHistoricalRound && (
                  <div className="bg-slate-950 border border-indigo-900/50 rounded-2xl p-5 mt-4 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                      <div>
                        <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider block">
                          নির্বাচিত পাসওয়ার্ডের ফলাফল:
                        </span>
                        <span className="text-base font-mono font-black text-white flex items-center gap-2 mt-0.5">
                          <code>{selectedHistoricalRound.password}</code>
                          <span className="text-xs text-slate-400 font-sans font-normal">
                            (মোট কাজ: {selectedHistoricalRound.totalApproved || selectedHistoricalRound.totalSubmissions} টি)
                          </span>
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSetActiveRound(selectedHistoricalRound)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md"
                        >
                          🏆 এটিকে সক্রিয় লিডারবোর্ড করুন
                        </button>
                        <button
                          onClick={() => handleBroadcast(selectedHistoricalRound)}
                          disabled={isBroadcasting}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5"
                        >
                          <Send size={13} />
                          <span>চ্যানেলে পোস্ট</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {selectedHistoricalRound.winners?.slice(0, 3).map((w) => {
                        const badge = getRankBadge(w.rank);
                        return (
                          <div key={w.rank} className={`bg-gradient-to-b ${badge.bg} border rounded-xl p-3.5 flex items-center justify-between`}>
                            <div className="flex items-center gap-2.5">
                              <span className="text-xl">{badge.icon}</span>
                              <div>
                                <span className="text-[10px] text-slate-400 block">{badge.label}</span>
                                <span className="font-mono text-xs font-bold text-white">{maskWorkerId(w.maskedWorker || w.workerId)}</span>
                              </div>
                            </div>
                            <span className="text-xs font-black text-amber-300 bg-slate-900/80 px-2 py-1 rounded">
                              {w.count} টি
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">
                এখনো কোনো পূর্ববর্তী পাসওয়ার্ডের রেকর্ড পাওয়া যায়নি। বর্তমান পাসওয়ার্ড পরিবর্তন করার পর অটোমেটিক তা এখানে তালিকাভুক্ত হবে।
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
