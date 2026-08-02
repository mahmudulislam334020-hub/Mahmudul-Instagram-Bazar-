import React, { useState } from 'react';
import { 
  X, 
  User, 
  Wallet, 
  Send, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Download, 
  Facebook, 
  Instagram, 
  MessageSquare,
  ShieldCheck,
  TrendingUp,
  DollarSign,
  RefreshCw,
  Plus,
  Minus
} from 'lucide-react';
import { Submission, Withdrawal, UserProfile, AppSettings } from '../firebaseService';

export interface UserDetailsModalProps {
  workerName: string;
  onClose: () => void;
  allSubmissions: Submission[];
  withdrawals: Withdrawal[];
  allProfiles: UserProfile[];
  settings: AppSettings;
  calculateUserBalance?: (workerName: string) => number;
  handleAdjustUserBalance?: (workerName: string, amount: number) => Promise<void>;
}

export default function UserDetailsModal({
  workerName,
  onClose,
  allSubmissions,
  withdrawals,
  allProfiles,
  settings,
  calculateUserBalance,
  handleAdjustUserBalance
}: UserDetailsModalProps) {
  const [messageText, setMessageText] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [sendMessageStatus, setSendMessageStatus] = useState<{ type: 'success' | 'error' | 'warning', text: string } | null>(null);

  // Balance adjustment state inside modal
  const [adjustAmount, setAdjustAmount] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustStatus, setAdjustStatus] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Profile lookup
  const userProfile = allProfiles.find(p => p.walletNumber === workerName || p.telegramChatId === workerName || p.payoutNumber === workerName);
  
  // Withdrawal lookup for chat ID or wallet numbers
  const withdrawalInfo = withdrawals.find(w => w.submittedBy === workerName || (w as any).telegramChatId === workerName);
  
  const telegramChatId = userProfile?.telegramChatId || withdrawalInfo?.telegramChatId || (workerName.match(/^\d+$/) && !workerName.startsWith('01') ? workerName : '');
  const payoutNumber = userProfile?.payoutNumber || userProfile?.walletNumber || withdrawalInfo?.number || '—';
  const walletType = userProfile?.walletType || withdrawalInfo?.method || 'bKash';
  const bonusBalance = userProfile?.bonusBalance || 0;

  // Submissions for this worker
  const userSubs = allSubmissions.filter(s => s.submittedBy === workerName);
  const fbSubs = userSubs.filter(s => s.category === 'facebook');
  const instaSubs = userSubs.filter(s => (s.category || 'instagram') === 'instagram');

  // Submissions stats
  const totalSubmittedCount = userSubs.length;
  const approvedSubs = userSubs.filter(s => s.status === 'approved');
  const pendingSubs = userSubs.filter(s => s.status === 'pending');
  const rejectedSubs = userSubs.filter(s => s.status === 'rejected');

  const fbApprovedCount = fbSubs.filter(s => s.status === 'approved').length;
  const fbPendingCount = fbSubs.filter(s => s.status === 'pending').length;
  const fbRejectedCount = fbSubs.filter(s => s.status === 'rejected').length;

  const instaApprovedCount = instaSubs.filter(s => s.status === 'approved').length;
  const instaPendingCount = instaSubs.filter(s => s.status === 'pending').length;
  const instaRejectedCount = instaSubs.filter(s => s.status === 'rejected').length;

  // Work Earnings calculation
  const totalWorkEarned = approvedSubs.reduce((sum, s) => {
    if (s.rate !== undefined && s.rate > 0) return sum + s.rate;
    const isFb = s.category === 'facebook';
    const rate = isFb 
      ? (settings.facebookRatePerId !== undefined ? settings.facebookRatePerId : settings.ratePerId)
      : settings.ratePerId;
    return sum + (rate || 45);
  }, 0);

  // Withdrawals stats for this worker
  const userWithdrawals = withdrawals.filter(w => 
    w.submittedBy === workerName || 
    ((w as any).telegramChatId && (w as any).telegramChatId === telegramChatId)
  );

  const approvedWithdrawals = userWithdrawals.filter(w => w.status === 'approved');
  const pendingWithdrawals = userWithdrawals.filter(w => w.status === 'pending');
  const rejectedWithdrawals = userWithdrawals.filter(w => w.status === 'rejected');

  const totalApprovedWithdrawnAmount = approvedWithdrawals.reduce((sum, w) => sum + w.amount, 0);
  const totalPendingWithdrawnAmount = pendingWithdrawals.reduce((sum, w) => sum + w.amount, 0);

  // Available current balance
  const currentAvailableBalance = calculateUserBalance ? calculateUserBalance(workerName) : Math.max(0, (totalWorkEarned + bonusBalance) - (totalApprovedWithdrawnAmount + totalPendingWithdrawnAmount));

  // Send Direct Message via Bot
  const handleSendDirectMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    setIsSendingMessage(true);
    setSendMessageStatus(null);

    try {
      const res = await fetch("/api/telegram-direct-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetWalletNumber: workerName,
          telegramChatId: telegramChatId,
          type: "custom_message",
          details: {
            message: messageText.trim()
          }
        })
      });

      const data = await res.json();
      if (res.ok && data.status === "success") {
        setSendMessageStatus({
          type: 'success',
          text: '✅ টেলিগ্রাম বটে ইউজারকে মেসেজ সফলভাবে পাঠানো হয়েছে!'
        });
        setMessageText('');
      } else if (data.status === "skipped") {
        setSendMessageStatus({
          type: 'warning',
          text: `⚠️ মেসেজ পাঠানো যায়নি: ${data.message || 'ইউজার এখনো টেলিগ্রাম বটে চ্যাট সক্রিয় করেননি।'}`
        });
      } else {
        setSendMessageStatus({
          type: 'error',
          text: `❌ ব্যর্থ হয়েছে: ${data.error || 'টেলিগ্রাম সার্ভারে বার্তা পাঠানো যায়নি'}`
        });
      }
    } catch (err: any) {
      setSendMessageStatus({
        type: 'error',
        text: `❌ এরর: ${err.message || 'কানেকশন সমস্যা'}`
      });
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Adjust Balance
  const handleModalAdjustBalance = async (type: 'add' | 'deduct') => {
    const val = parseFloat(adjustAmount);
    if (isNaN(val) || val <= 0 || !handleAdjustUserBalance) return;
    setIsAdjusting(true);
    setAdjustStatus(null);
    const amountToAdjust = type === 'add' ? val : -val;

    try {
      await handleAdjustUserBalance(workerName, amountToAdjust);
      setAdjustStatus({
        type: 'success',
        text: `💰 ইউজার ব্যালেন্স ৳${val} ${type === 'add' ? 'যোগ' : 'কমানো'} হয়েছে!`
      });
      setAdjustAmount('');
    } catch (err) {
      setAdjustStatus({
        type: 'error',
        text: '❌ ব্যালেন্স আপডেট করতে ব্যর্থ হয়েছে।'
      });
    } finally {
      setIsAdjusting(false);
    }
  };

  // Export User CSV
  const handleExportUserAccounts = () => {
    if (userSubs.length === 0) return;
    const headers = ["Category", "Username/UID", "Password", "2FA Key / Cookie", "Submitted By", "Status", "Submitted At"];
    const rows = userSubs.map(s => [
      s.category || "instagram",
      s.username,
      s.password,
      s.category === 'facebook' ? (s.cookie || "") : (s.twoFactorKey || ""),
      s.submittedBy,
      s.status,
      new Date(s.createdAt).toLocaleString()
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val || '').replace(/"/g, '""')}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `user_${workerName}_full_report_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl space-y-6 p-6 sm:p-8 relative my-8">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-9 h-9 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl flex items-center justify-center transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Header Title Banner */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4 pr-8">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 font-bold text-xl">
            <User size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>ইউজারের সম্পূর্ণ ডিটেইলস (User Detail Summary)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">
              User ID / Wallet: <strong className="text-indigo-400">{workerName}</strong>
            </p>
          </div>
        </div>

        {/* PROFILE & CONTACT INFORMATION BOX */}
        <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">ইউজার ওয়ালেট / আইডি:</span>
            <span className="font-mono font-bold text-slate-200 text-sm">{workerName}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">পেমেন্ট ওয়ালেট নাম্বার:</span>
            <span className="font-mono font-bold text-emerald-400 text-sm">{payoutNumber} ({walletType})</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">টেলিগ্রাম চ্যাট আইডি (Chat ID):</span>
            <span className="font-mono font-bold text-indigo-400 text-sm">
              {telegramChatId ? telegramChatId : 'কানেক্ট করা হয়নি'}
            </span>
          </div>
        </div>

        {/* MAIN METRICS & STATS CARDS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Total Submitted Accounts */}
          <div className="bg-slate-950 border border-slate-800/80 p-4 rounded-xl space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">মোট জমা দেওয়া আইডি</span>
            <div className="text-2xl font-extrabold text-white flex items-baseline gap-1 font-mono">
              <span>{totalSubmittedCount}</span>
              <span className="text-xs text-slate-400 font-sans font-normal">টি</span>
            </div>
            <div className="text-[10px] text-slate-400 pt-1 flex justify-between border-t border-slate-800/60">
              <span>📘 FB: {fbSubs.length}টি</span>
              <span>📸 IG: {instaSubs.length}টি</span>
            </div>
          </div>

          {/* 2. Total Earned Income */}
          <div className="bg-emerald-950/30 border border-emerald-500/20 p-4 rounded-xl space-y-1">
            <span className="text-[10px] uppercase font-bold text-emerald-400 block">মোট আয় (Approved Income)</span>
            <div className="text-2xl font-extrabold text-emerald-300 font-mono">
              ৳{totalWorkEarned + bonusBalance}
            </div>
            <div className="text-[10px] text-slate-400 pt-1 flex justify-between border-t border-emerald-500/10">
              <span>কাজের আয়: ৳{totalWorkEarned}</span>
              <span>বোনাস: ৳{bonusBalance}</span>
            </div>
          </div>

          {/* 3. Withdrawals Paid & Pending */}
          <div className="bg-amber-950/30 border border-amber-500/20 p-4 rounded-xl space-y-1">
            <span className="text-[10px] uppercase font-bold text-amber-400 block">উইথড্রকৃত ও পেন্ডিং</span>
            <div className="text-xl font-bold text-amber-300 font-mono">
              ৳{totalApprovedWithdrawnAmount} <span className="text-xs text-amber-500">(পেইড)</span>
            </div>
            <div className="text-[10px] text-amber-400/80 font-mono">
              পেন্ডিং উইথড্র: <strong>৳{totalPendingWithdrawnAmount}</strong> ({pendingWithdrawals.length}টি)
            </div>
          </div>

          {/* 4. Current Available Balance */}
          <div className="bg-indigo-950/40 border border-indigo-500/30 p-4 rounded-xl space-y-1">
            <span className="text-[10px] uppercase font-bold text-indigo-300 block">বর্তমান ওয়ালেট ব্যালেন্স</span>
            <div className="text-2xl font-black text-indigo-200 font-mono">
              ৳{currentAvailableBalance}
            </div>
            <span className="text-[10px] text-indigo-400 block">উত্তোলনযোগ্য ব্যালেন্স</span>
          </div>
        </div>

        {/* DETAILED WORK & SUBMISSIONS BREAKDOWN */}
        <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-4">
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center justify-between">
            <span>📊 আইডি জমা কাজের ব্রেকডাউন (Submissions Stats):</span>
            <button
              onClick={handleExportUserAccounts}
              disabled={userSubs.length === 0}
              className="text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
            >
              <Download size={13} />
              <span>আইডি রিপোর্ট এক্সেল (CSV)</span>
            </button>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Facebook breakdown */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                  <Facebook size={14} />
                  <span>ফেসবুক আইডি কাজ (Facebook)</span>
                </span>
                <span className="text-xs font-mono font-bold text-white">{fbSubs.length}টি</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-[11px] pt-1">
                <div className="bg-emerald-950/40 border border-emerald-500/20 p-2 rounded-lg">
                  <span className="text-[9px] text-emerald-400 font-bold block">অনুমোদিত</span>
                  <span className="font-mono font-bold text-white text-sm">{fbApprovedCount}</span>
                </div>
                <div className="bg-amber-950/40 border border-amber-500/20 p-2 rounded-lg">
                  <span className="text-[9px] text-amber-400 font-bold block">পেন্ডিং</span>
                  <span className="font-mono font-bold text-white text-sm">{fbPendingCount}</span>
                </div>
                <div className="bg-rose-950/40 border border-rose-500/20 p-2 rounded-lg">
                  <span className="text-[9px] text-rose-400 font-bold block">বাতিল</span>
                  <span className="font-mono font-bold text-white text-sm">{fbRejectedCount}</span>
                </div>
              </div>
            </div>

            {/* Instagram breakdown */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-pink-400 flex items-center gap-1.5">
                  <Instagram size={14} />
                  <span>ইনস্টাগ্রাম আইডি কাজ (Instagram)</span>
                </span>
                <span className="text-xs font-mono font-bold text-white">{instaSubs.length}টি</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-[11px] pt-1">
                <div className="bg-emerald-950/40 border border-emerald-500/20 p-2 rounded-lg">
                  <span className="text-[9px] text-emerald-400 font-bold block">অনুমোদিত</span>
                  <span className="font-mono font-bold text-white text-sm">{instaApprovedCount}</span>
                </div>
                <div className="bg-amber-950/40 border border-amber-500/20 p-2 rounded-lg">
                  <span className="text-[9px] text-amber-400 font-bold block">পেন্ডিং</span>
                  <span className="font-mono font-bold text-white text-sm">{instaPendingCount}</span>
                </div>
                <div className="bg-rose-950/40 border border-rose-500/20 p-2 rounded-lg">
                  <span className="text-[9px] text-rose-400 font-bold block">বাতিল</span>
                  <span className="font-mono font-bold text-white text-sm">{instaRejectedCount}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* DETAILED WITHDRAWALS BREAKDOWN */}
        <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-3">
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <DollarSign size={15} className="text-emerald-400" />
            <span>💸 পেমেন্ট উত্তোলন হিসাব (Withdrawal History Summary):</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-emerald-950/30 border border-emerald-500/20 p-3 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] text-emerald-400 font-bold block">অনুমোদিত ও পেইড উইথড্র:</span>
                <span className="font-mono font-bold text-white text-sm">৳{totalApprovedWithdrawnAmount}</span>
              </div>
              <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold">
                {approvedWithdrawals.length}টি পেইড
              </span>
            </div>

            <div className="bg-amber-950/30 border border-amber-500/20 p-3 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] text-amber-400 font-bold block">পেন্ডিং উইথড্র রিকোয়েস্ট:</span>
                <span className="font-mono font-bold text-white text-sm">৳{totalPendingWithdrawnAmount}</span>
              </div>
              <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded text-[10px] font-bold">
                {pendingWithdrawals.length}টি পেন্ডিং
              </span>
            </div>

            <div className="bg-rose-950/30 border border-rose-500/20 p-3 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] text-rose-400 font-bold block">বাতিলকৃত উইথড্র:</span>
                <span className="font-mono font-bold text-white text-sm">{rejectedWithdrawals.length}টি</span>
              </div>
              <span className="bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded text-[10px] font-bold">
                রিজেক্টড
              </span>
            </div>
          </div>
        </div>

        {/* SEND DIRECT TELEGRAM BOT MESSAGE TO THIS SPECIFIC USER */}
        <div className="bg-slate-950 border border-indigo-500/30 p-5 rounded-2xl space-y-4">
          <div className="border-b border-slate-800 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <h4 className="text-xs font-bold text-indigo-300 flex items-center gap-2">
              <Send size={15} className="text-indigo-400" />
              <span>এই নির্দিষ্ট ইউজারকে টেলিগ্রাম বট থেকে মেসেজ পাঠান (Send Direct Bot Message)</span>
            </h4>
            <span className="text-[10px] text-slate-400">
              {telegramChatId ? `Target Chat ID: ${telegramChatId}` : 'ওয়ালেট নাম্বার দিয়ে খুঁজে বের করা হবে'}
            </span>
          </div>

          <form onSubmit={handleSendDirectMessage} className="space-y-3">
            <div>
              <textarea
                rows={3}
                placeholder="ইউজারকে পাঠানোর মেসেজটি এখানে লিখুন... (যেমন: আপনার আইডি চেক করে পেমেন্ট দেওয়া হয়েছে, ধন্যবাদ!)"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 p-3 rounded-xl text-slate-200 text-xs outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600 leading-relaxed"
              />
            </div>

            {/* Quick Template buttons */}
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setMessageText('👋 স্বাগতম! আপনার জমা দেওয়া আইডিগুলো চেক করা হচ্ছে। অনুগ্রহ করে অপেক্ষা করুন।')}
                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] rounded-lg border border-slate-800 transition-all"
              >
                💬 আইডি চেক করার নোটিশ
              </button>
              <button
                type="button"
                onClick={() => setMessageText('✅ আপনার উত্তোলনের পেমেন্ট বিকাশ/নগদে সফলভাবে পাঠানো হয়েছে! ওয়ালেট চেক করুন।')}
                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] rounded-lg border border-slate-800 transition-all"
              >
                💸 পেমেন্ট পেইড নোটিশ
              </button>
              <button
                type="button"
                onClick={() => setMessageText('⚠️ আপনার কিছু আইডিতে ভুল তথ্য ছিল। সঠিক পাসওয়ার্ড ও টু-এফএ দিয়ে আবার জমা দিন।')}
                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] rounded-lg border border-slate-800 transition-all"
              >
                ⚠️ আইডি ভুল থাকার নোটিশ
              </button>
            </div>

            {sendMessageStatus && (
              <div className={`p-3 rounded-xl text-xs font-semibold ${
                sendMessageStatus.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                sendMessageStatus.type === 'warning' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}>
                {sendMessageStatus.text}
              </div>
            )}

            <button
              type="submit"
              disabled={isSendingMessage || !messageText.trim()}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSendingMessage ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>মেসেজ পাঠানো হচ্ছে...</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>বট থেকে ইউজারকে মেসেজ পাঠান (Send Message)</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* MANUAL BALANCE ADJUSTMENT SECTION IN MODAL */}
        {handleAdjustUserBalance && (
          <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-3">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center justify-between">
              <span>💰 এই ইউজারের ব্যালেন্স সামঞ্জস্য করুন (Manual Balance Adjustment):</span>
              <span className="text-[11px] font-mono text-emerald-400 font-bold">বর্তমান: ৳{currentAvailableBalance}</span>
            </h4>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="number"
                placeholder="টাকার পরিমাণ (যেমন: ৫০, ১০০)..."
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                className="flex-grow bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl text-slate-200 text-xs font-mono outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => handleModalAdjustBalance('add')}
                disabled={isAdjusting || !adjustAmount.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus size={14} />
                <span>ব্যালেন্স বাড়ান (+)</span>
              </button>
              <button
                type="button"
                onClick={() => handleModalAdjustBalance('deduct')}
                disabled={isAdjusting || !adjustAmount.trim()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Minus size={14} />
                <span>ব্যালেন্স কমান (-)</span>
              </button>
            </div>

            {adjustStatus && (
              <p className={`text-xs font-semibold p-2.5 rounded-lg ${
                adjustStatus.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}>
                {adjustStatus.text}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
