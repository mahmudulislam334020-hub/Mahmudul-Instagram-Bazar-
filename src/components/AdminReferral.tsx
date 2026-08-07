import React, { useState } from 'react';
import { 
  Users, 
  Gift, 
  DollarSign, 
  Save, 
  Search, 
  CheckCircle, 
  XCircle, 
  Edit, 
  TrendingUp, 
  UserCheck, 
  Bot,
  Sliders
} from 'lucide-react';
import { AppSettings, UserProfile, Withdrawal } from '../firebaseService';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseService';

export interface AdminReferralProps {
  settings: AppSettings;
  setAppSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  handleSaveSettings: (e: React.FormEvent) => Promise<void>;
  settingsStatus: { type: 'success' | 'error' | 'saving', text: string } | null;
  allProfiles: UserProfile[];
  withdrawals: Withdrawal[];
}

export default function AdminReferral({
  settings,
  setAppSettings,
  handleSaveSettings,
  settingsStatus,
  allProfiles,
  withdrawals
}: AdminReferralProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null);
  const [newRefBalance, setNewRefBalance] = useState<number>(0);
  const [adjustMsg, setAdjustMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [savingBalance, setSavingBalance] = useState(false);

  // Statistics
  const usersWithReferrals = allProfiles.filter(p => (p.totalReferrals || 0) > 0 || p.referredBy);
  const totalReferralCount = allProfiles.reduce((sum, p) => sum + (p.totalReferrals || 0), 0);
  const totalDistributedBonus = allProfiles.reduce((sum, p) => sum + (p.referralBalance || 0), 0);
  
  const totalReferralWithdrawalsApproved = withdrawals
    .filter(w => w.balanceType === 'referral' && w.status === 'approved')
    .reduce((sum, w) => sum + w.amount, 0);

  const totalReferralWithdrawalsPending = withdrawals
    .filter(w => w.balanceType === 'referral' && w.status === 'pending')
    .reduce((sum, w) => sum + w.amount, 0);

  // Filtered Profiles
  const filteredProfiles = allProfiles.filter(p => {
    const term = searchTerm.toLowerCase();
    return (
      (p.walletNumber && p.walletNumber.toLowerCase().includes(term)) ||
      (p.telegramChatId && p.telegramChatId.toLowerCase().includes(term)) ||
      (p.payoutNumber && p.payoutNumber.toLowerCase().includes(term)) ||
      (p.referredBy && p.referredBy.toLowerCase().includes(term))
    );
  });

  const handleOpenEditBalance = (profile: UserProfile) => {
    setEditingProfile(profile);
    setNewRefBalance(profile.referralBalance || 0);
    setAdjustMsg(null);
  };

  const handleSaveUserBalance = async () => {
    if (!editingProfile || !editingProfile.id) return;
    setSavingBalance(true);
    setAdjustMsg(null);

    try {
      const profileRef = doc(db, "profiles", editingProfile.id);
      await updateDoc(profileRef, {
        referralBalance: Math.max(0, newRefBalance)
      });

      setAdjustMsg({ type: 'success', text: 'রেফার ব্যালেন্স সফলভাবে আপডেট করা হয়েছে!' });
      setTimeout(() => {
        setEditingProfile(null);
        setAdjustMsg(null);
      }, 1500);
    } catch (err: any) {
      console.error("Error updating user referral balance:", err);
      setAdjustMsg({ type: 'error', text: 'ব্যালেন্স আপডেট করতে ব্যর্থ হয়েছে।' });
    } finally {
      setSavingBalance(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="space-y-2 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
              <Gift size={22} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">🎁 রেফারেল সিস্টেম কন্ট্রোল সেন্টার</h2>
              <p className="text-xs text-slate-400">রেফারেল বোনাস, উত্তোলন সীমা এবং ব্যবহারকারীদের রেফার ব্যালেন্স পরিচালনা করুন</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 z-10">
          <div className={`px-4 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 ${
            settings.referralSystemEnabled !== false 
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}>
            <span className={`w-2.5 h-2.5 rounded-full ${settings.referralSystemEnabled !== false ? 'bg-amber-400 animate-pulse' : 'bg-rose-500'}`}></span>
            <span>{settings.referralSystemEnabled !== false ? 'রেফারেল প্রোগ্রাম সক্রিয় ✅' : 'রেফারেল প্রোগ্রাম নিষ্ক্রিয় ❌'}</span>
          </div>
        </div>
      </div>

      {/* Top Stat Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-xl shadow-lg space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>মোট রেফারেল ব্যবহারকারী</span>
            <Users size={18} className="text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white">{usersWithReferrals.length} <span className="text-xs font-normal text-slate-400">জন</span></div>
          <p className="text-[10px] text-slate-500">মোট রেফারেল সংখ্যা: {totalReferralCount} টি</p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-xl shadow-lg space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>বর্তমান বিতরণকৃত রেফার বোনাস</span>
            <Gift size={18} className="text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">৳{totalDistributedBonus} <span className="text-xs font-normal text-slate-400">Taka</span></div>
          <p className="text-[10px] text-slate-500">ইউজারদের বর্তমান অ্যাকাউন্টে জমা</p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-xl shadow-lg space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>উইথড্র হওয়া রেফার টাকা</span>
            <DollarSign size={18} className="text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-indigo-400">৳{totalReferralWithdrawalsApproved} <span className="text-xs font-normal text-slate-400">Taka</span></div>
          <p className="text-[10px] text-amber-400">পেন্ডিং উইথড্র: ৳{totalReferralWithdrawalsPending} Taka</p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-xl shadow-lg space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>রেফারেল কাজের কমিশন</span>
            <TrendingUp size={18} className="text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-300">{settings.referralCommissionPercent !== undefined ? settings.referralCommissionPercent : 10}% <span className="text-xs font-normal text-slate-400">কমিশন</span></div>
          <p className="text-[10px] text-slate-500">সর্বনিম্ন উইথড্র সীমা: ৳{settings.minReferralWithdrawLimit !== undefined ? settings.minReferralWithdrawLimit : 500} Taka</p>
        </div>
      </div>

      {/* Referral System Settings Form */}
      <div className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-2xl shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <Sliders className="text-amber-400" size={20} />
            <h3 className="text-base font-bold text-white uppercase tracking-wider">⚙️ রেফারেল গ্লোবাল সেটিংস (Settings)</h3>
          </div>
          
          {settingsStatus && (
            <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 ${
              settingsStatus.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
              settingsStatus.type === 'error' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
              'bg-blue-500/10 text-blue-400 border border-blue-500/20'
            }`}>
              {settingsStatus.type === 'success' && <CheckCircle size={14} />}
              {settingsStatus.type === 'error' && <XCircle size={14} />}
              <span>{settingsStatus.text}</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Enable/Disable Toggle */}
            <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-sm font-bold text-white block">রেফারেল প্রোগ্রাম সক্রিয়করণ (Status)</span>
                <p className="text-xs text-slate-400">বন্ধ করলে নতুন কেউ রেফারেল লিংক ব্যবহারে বোনাস পাবে না।</p>
              </div>
              <button
                type="button"
                onClick={() => setAppSettings(prev => ({ ...prev, referralSystemEnabled: prev.referralSystemEnabled === false ? true : false }))}
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${settings.referralSystemEnabled !== false ? 'bg-amber-500' : 'bg-slate-800'}`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings.referralSystemEnabled !== false ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </button>
            </div>

            {/* Referral Commission Percentage */}
            <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-amber-400 block">
                🎁 রেফারেল কাজের কমিশন হার (Commission Rate - %)
              </label>
              <div className="relative">
                <input 
                  type="number"
                  value={settings.referralCommissionPercent !== undefined ? settings.referralCommissionPercent : 10}
                  onChange={(e) => setAppSettings(prev => ({ ...prev, referralCommissionPercent: parseFloat(e.target.value) || 0 }))}
                  className="w-full bg-slate-900 border border-slate-700 px-4 py-3 pr-10 rounded-lg text-amber-300 font-black text-base outline-none focus:border-amber-500 transition-all"
                  placeholder="e.g. 10"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-amber-400 font-bold">%</span>
              </div>
              <p className="text-[11px] text-slate-500">রেফারকৃত মেম্বার কাজ জমা দিয়ে অনুমোদিত (Approved) হলে তাদের মোট আয় থেকে রেফারকারী এই % কমিশন পাবে।</p>
            </div>

            {/* Minimum Referral Withdraw Limit */}
            <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-indigo-400 block">
                💸 রেফার ব্যালেন্স সর্বনিম্ন উইথড্র সীমা (Min Withdraw Limit - ৳)
              </label>
              <input 
                type="number"
                value={settings.minReferralWithdrawLimit !== undefined ? settings.minReferralWithdrawLimit : 500}
                onChange={(e) => setAppSettings(prev => ({ ...prev, minReferralWithdrawLimit: parseFloat(e.target.value) || 0 }))}
                className="w-full bg-slate-900 border border-slate-700 px-4 py-3 rounded-lg text-indigo-300 font-black text-base outline-none focus:border-indigo-500 transition-all"
                placeholder="e.g. 500"
              />
              <p className="text-[11px] text-slate-500">রেফার ব্যালেন্স থেকে টাকা তুলতে ব্যবহারকারীর অ্যাকাউন্টে সর্বনিম্ন এই পরিমাণ জমা হতে হবে।</p>
            </div>

            {/* Telegram Bot Username */}
            <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block flex items-center gap-1.5">
                <Bot size={16} className="text-blue-400" />
                টেলিগ্রাম বট ইউজারনেম (Bot Username)
              </label>
              <input 
                type="text"
                value={settings.botUsername || ''}
                onChange={(e) => setAppSettings(prev => ({ ...prev, botUsername: e.target.value.replace('@', '').trim() }))}
                className="w-full bg-slate-900 border border-slate-700 px-4 py-3 rounded-lg text-white font-mono text-sm outline-none focus:border-blue-500 transition-all"
                placeholder="e.g. accounttradecenterXincome_bot"
              />
              <p className="text-[11px] text-slate-500">রেফারেল লিংক তৈরির কাজ করবে (যেমন t.me/BotUsername?start=ref_chatId)</p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={settingsStatus?.type === 'saving'}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-sm rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save size={18} />
              <span>রেফারেল সেটিংস সংরক্ষণ করুন (Save Settings)</span>
            </button>
          </div>
        </form>
      </div>

      {/* User Referral Directory Table */}
      <div className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-2xl shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <UserCheck size={20} className="text-emerald-400" />
              👥 ব্যবহারকারীদের রেফারেল তথ্য ও ব্যালেন্স ডিরেক্টরি
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">সকল ইউজারের মোট রেফার সংখ্যা এবং বর্তমান রেফার ব্যালেন্স পরিচালনা করুন</p>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              type="text"
              placeholder="ইউজার / ওয়ালেট / চ্যাট আইডি খুঁজুন..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 pl-9 pr-4 py-2.5 rounded-xl text-xs text-slate-200 outline-none focus:border-amber-500 transition-all"
            />
          </div>
        </div>

        {/* Directory Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-800">
                <th className="py-3.5 px-4">ইউজার / ওয়ালেট</th>
                <th className="py-3.5 px-4">টেলিগ্রাম চ্যাট আইডি</th>
                <th className="py-3.5 px-4">কে রেফার করেছে (Referred By)</th>
                <th className="py-3.5 px-4">মোট রেফার</th>
                <th className="py-3.5 px-4">রেফার ব্যালেন্স</th>
                <th className="py-3.5 px-4 text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredProfiles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 text-sm">
                    কোনো রেফারেল তথ্য পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                filteredProfiles.map((profile) => (
                  <tr key={profile.id || profile.telegramChatId} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white">
                      {profile.walletNumber || profile.payoutNumber || profile.telegramChatId || 'N/A'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                      {profile.telegramChatId ? (
                        <span className="bg-slate-950 px-2 py-1 rounded border border-slate-800 text-indigo-400">
                          {profile.telegramChatId}
                        </span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                      {profile.referredBy ? (
                        <span className="bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40 text-amber-300">
                          ID: {profile.referredBy}
                        </span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 font-extrabold rounded-lg border border-amber-500/20 text-xs">
                        {profile.totalReferrals || 0} জন
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-black text-amber-300">
                      ৳{profile.referralBalance || 0} Taka
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenEditBalance(profile)}
                        className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-300 font-bold text-[11px] rounded-lg transition-all flex items-center gap-1.5 ml-auto cursor-pointer"
                      >
                        <Edit size={12} />
                        <span>ব্যালেন্স এডিট</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User Balance Modal */}
      {editingProfile && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-2xl max-w-md w-full shadow-2xl space-y-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit size={18} className="text-amber-400" />
                রেফার ব্যালেন্স এডজাস্ট করুন
              </h3>
              <button 
                onClick={() => setEditingProfile(null)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-1.5">
                <p className="text-xs text-slate-400">ইউজার:</p>
                <p className="text-sm font-bold text-white">{editingProfile.walletNumber || editingProfile.telegramChatId}</p>
                <p className="text-[11px] text-indigo-400 font-mono">Chat ID: {editingProfile.telegramChatId || 'N/A'}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  নতুন রেফার ব্যালেন্স (Taka - ৳)
                </label>
                <input 
                  type="number"
                  value={newRefBalance}
                  onChange={(e) => setNewRefBalance(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 px-4 py-3 rounded-xl text-amber-300 font-black text-lg outline-none focus:border-amber-500"
                />
              </div>

              {adjustMsg && (
                <div className={`p-3 rounded-xl text-xs font-semibold ${
                  adjustMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}>
                  {adjustMsg.text}
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setEditingProfile(null)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                বাতিল করুন
              </button>
              <button
                onClick={handleSaveUserBalance}
                disabled={savingBalance}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {savingBalance ? 'সংরক্ষণ হচ্ছে...' : 'আপডেট করুন'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
