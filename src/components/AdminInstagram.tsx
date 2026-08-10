import React from 'react';
import { 
  Instagram, 
  Download, 
  List, 
  Users, 
  Settings, 
  Database, 
  Trash2, 
  AlertCircle, 
  User,
  Key,
  Search,
  Wallet,
  Calendar
} from 'lucide-react';
import { Submission, AppSettings, Withdrawal, UserProfile } from '../firebaseService';
import UserDetailsModal from './UserDetailsModal';

export interface AdminInstagramProps {
  settings: AppSettings;
  setAppSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  categoryFilteredSubmissions: Submission[];
  categoryGroupedSubmissions: any[];
  selectedSubIds: string[];
  setSelectedSubIds: React.Dispatch<React.SetStateAction<string[]>>;
  pastedUsernamesText: string;
  setPastedUsernamesText: React.Dispatch<React.SetStateAction<string>>;
  bulkPasteResult: { type: 'success' | 'error' | 'info', text: string } | null;
  handleBulkPasteAction: (action: 'approved' | 'rejected', overrideRate?: number) => void;
  handleBulkSubAction: (action: 'approved' | 'rejected', overrideRate?: number) => void;
  handleApproveRejectSub: (id: string, action: 'approved' | 'rejected', overrideRate?: number) => void;
  handleDeleteSub: (id: string) => void;
  handleExportCSV: () => void;
  workerSearchQuery: string;
  setWorkerSearchQuery: (query: string) => void;
  expandedWorker: string | null;
  setExpandedWorker: (worker: string | null) => void;
  clearConfirmationText: string;
  setClearConfirmationText: (text: string) => void;
  dbMessage: { type: 'success' | 'error', text: string } | null;
  handleClearAllSubmissions: () => void;
  handleClearAllWithdrawals: () => void;
  handleClearAllProfiles: () => void;
  isClearingSubmissions: boolean;
  isClearingWithdrawals: boolean;
  isClearingProfiles: boolean;
  handleSaveSettings: (e: React.FormEvent) => Promise<void>;
  settingsStatus: { type: 'success' | 'error' | 'saving', text: string } | null;
  withdrawals: Withdrawal[];
  igSubTab: 'submissions' | 'summary' | 'settings' | 'clear';
  setIgSubTab: React.Dispatch<React.SetStateAction<'submissions' | 'summary' | 'settings' | 'clear'>>;
  calculateUserBalance?: (workerName: string) => number;
  handleAdjustUserBalance?: (workerName: string, amount: number) => Promise<void>;
  allSubmissions?: Submission[];
  allProfiles?: UserProfile[];
}

export default function AdminInstagram({
  settings,
  setAppSettings,
  categoryFilteredSubmissions,
  categoryGroupedSubmissions,
  selectedSubIds,
  setSelectedSubIds,
  pastedUsernamesText,
  setPastedUsernamesText,
  bulkPasteResult,
  handleBulkPasteAction,
  handleBulkSubAction,
  handleApproveRejectSub,
  handleDeleteSub,
  handleExportCSV,
  workerSearchQuery,
  setWorkerSearchQuery,
  expandedWorker,
  setExpandedWorker,
  clearConfirmationText,
  setClearConfirmationText,
  dbMessage,
  handleClearAllSubmissions,
  handleClearAllWithdrawals,
  handleClearAllProfiles,
  isClearingSubmissions,
  isClearingWithdrawals,
  isClearingProfiles,
  handleSaveSettings,
  settingsStatus,
  withdrawals,
  igSubTab,
  setIgSubTab,
  calculateUserBalance,
  handleAdjustUserBalance,
  allSubmissions = [],
  allProfiles = []
}: AdminInstagramProps) {
  const [passwordFilter, setPasswordFilter] = React.useState('');
  const [exportStatusMode, setExportStatusMode] = React.useState<'pending' | 'all' | 'approved' | 'rejected'>('pending');
  const [customApprovalRate, setCustomApprovalRate] = React.useState<number>(settings.ratePerId || 45);
  const [isBulkDeletingByPassword, setIsBulkDeletingByPassword] = React.useState(false);

  React.useEffect(() => {
    if (settings.ratePerId !== undefined) {
      setCustomApprovalRate(settings.ratePerId);
    }
  }, [settings.ratePerId]);
  const [passwordActionResult, setPasswordActionResult] = React.useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [selectedWorkerForBalance, setSelectedWorkerForBalance] = React.useState<string | null>(null);
  const [selectedWorkerForDetails, setSelectedWorkerForDetails] = React.useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = React.useState<string>('');

  // Extract unique passwords and count how many submissions have each password
  const passwordCounts = React.useMemo(() => {
    const map: { [pwd: string]: number } = {};
    categoryFilteredSubmissions.forEach(sub => {
      const pwd = (sub.password || '').trim();
      if (pwd) {
        map[pwd] = (map[pwd] || 0) + 1;
      }
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [categoryFilteredSubmissions]);

  // Filter submissions based on password search query
  const displayedSubmissions = React.useMemo(() => {
    if (!passwordFilter.trim()) return categoryFilteredSubmissions;
    const query = passwordFilter.trim().toLowerCase();
    return categoryFilteredSubmissions.filter(sub => 
      (sub.password || '').toLowerCase().includes(query)
    );
  }, [categoryFilteredSubmissions, passwordFilter]);

  // Filter displayed submissions based on selected export status mode (pending, all, approved, rejected)
  const exportSubmissionsList = React.useMemo(() => {
    if (exportStatusMode === 'pending') {
      return displayedSubmissions.filter(s => s.status === 'pending');
    } else if (exportStatusMode === 'approved') {
      return displayedSubmissions.filter(s => s.status === 'approved');
    } else if (exportStatusMode === 'rejected') {
      return displayedSubmissions.filter(s => s.status === 'rejected');
    }
    return displayedSubmissions; // 'all'
  }, [displayedSubmissions, exportStatusMode]);

  // Handle deleting all submissions matching current password filter
  const handleDeleteFilteredByPassword = async () => {
    if (!passwordFilter.trim()) return;
    const count = displayedSubmissions.length;
    if (count === 0) return;

    const confirmMsg = `আপনি কি নিশ্চিত যে '${passwordFilter}' পাসওয়ার্ডযুক্ত সকল ${count}টি আইডি স্থায়ীভাবে ডাটাবেজ থেকে মুছে ফেলতে চান?`;
    if (!window.confirm(confirmMsg)) return;

    setIsBulkDeletingByPassword(true);
    setPasswordActionResult(null);

    try {
      const idsToDelete = displayedSubmissions.map(s => s.id).filter(Boolean) as string[];
      for (const id of idsToDelete) {
        await handleDeleteSub(id);
      }
      setPasswordActionResult({
        type: 'success',
        text: `✅ '${passwordFilter}' পাসওয়ার্ডের মোট ${count}টি আইডি সফলভাবে মুছে ফেলা হয়েছে!`
      });
      setPasswordFilter('');
    } catch (err) {
      console.error("Bulk password delete error:", err);
      setPasswordActionResult({
        type: 'error',
        text: '❌ আইডি মোছার সময় সমস্যা হয়েছে!'
      });
    } finally {
      setIsBulkDeletingByPassword(false);
    }
  };

  // Export filtered submissions by password as Excel (CSV)
  const handleExportFilteredCSV = () => {
    if (exportSubmissionsList.length === 0) return;
    const headers = ["Username", "Password", "2FA Key", "Submitted By", "Status", "Submitted At"];

    const rows = exportSubmissionsList.map(s => [
      s.username,
      s.password,
      s.twoFactorKey || "",
      s.submittedBy,
      s.status,
      new Date(s.createdAt).toLocaleString()
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val || '').replace(/"/g, '""')}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const pwdTag = passwordFilter ? `_pass_${passwordFilter}` : '';
    link.setAttribute("download", `instagram_${exportStatusMode}_ids${pwdTag}_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export specific user's submissions as Excel (CSV)
  const handleExportUserCSV = (worker: string, subs: Submission[]) => {
    if (!subs || subs.length === 0) return;
    const headers = ["Username", "Password", "2FA Key", "Submitted By", "Status", "Submitted At"];
    const rows = subs.map(s => [
      s.username,
      s.password,
      s.twoFactorKey || "",
      s.submittedBy,
      s.status,
      new Date(s.createdAt).toLocaleString()
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val || '').replace(/"/g, '""')}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `instagram_user_${worker}_ids_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Instagram size={20} className="text-pink-500" />
            <span>Instagram Control (ইন্সটাগ্রাম কন্ট্রোল)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            মোট {categoryFilteredSubmissions.length}টি ইনস্টাগ্রাম আইডি রেকর্ড রয়েছে। সেটিংস এবং অনুমোদন করুন।
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="text-[11px] text-emerald-400 font-bold whitespace-nowrap">রেট (৳):</span>
            <input
              type="number"
              step="0.1"
              min="0"
              value={customApprovalRate}
              onChange={(e) => setCustomApprovalRate(parseFloat(e.target.value) || 0)}
              className="w-16 bg-slate-900 border border-slate-700 text-emerald-400 text-xs font-bold px-2 py-1 rounded text-center outline-none focus:border-emerald-500"
              title="আইডি এপ্রুভ করার সময় প্রতিটি আইডির জন্য যে রেট ইউজার পাবে"
            />
          </div>

          <button 
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors border border-slate-700 text-slate-300"
          >
            <Download size={14} />
            <span>এক্সেল (CSV)</span>
          </button>

          <button 
            onClick={() => handleBulkSubAction('approved', customApprovalRate)}
            disabled={selectedSubIds.length === 0}
            className="px-3.5 py-2 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/20 disabled:opacity-40 text-xs font-bold rounded-lg transition-all"
          >
            বাল্ক অনুমোদন ({selectedSubIds.length}) [৳{customApprovalRate}]
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

      {/* SUB-TABS NAVIGATION */}
      <div className="flex border-b border-slate-800 gap-1 overflow-x-auto">
        <button
          onClick={() => setIgSubTab('submissions')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-t border-x whitespace-nowrap ${
            igSubTab === 'submissions'
              ? 'bg-slate-900 border-slate-800 text-white border-t-pink-500'
              : 'bg-transparent border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <List size={14} />
          <span>ইন্সটাগ্রাম আইডি তালিকা ({categoryFilteredSubmissions.length})</span>
        </button>
        <button
          onClick={() => setIgSubTab('summary')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-t border-x whitespace-nowrap ${
            igSubTab === 'summary'
              ? 'bg-slate-900 border-slate-800 text-white border-t-pink-500'
              : 'bg-transparent border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Users size={14} />
          <span>ইউজার ভিত্তিক সামারি ({categoryGroupedSubmissions.length})</span>
        </button>
        <button
          onClick={() => setIgSubTab('settings')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-t border-x whitespace-nowrap ${
            igSubTab === 'settings'
              ? 'bg-slate-900 border-slate-800 text-white border-t-pink-500 font-bold'
              : 'bg-transparent border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Settings size={14} />
          <span>ইন্সটাগ্রাম কাজ সেটিংস (Settings)</span>
        </button>
        <button
          onClick={() => setIgSubTab('clear')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-t border-x whitespace-nowrap ${
            igSubTab === 'clear'
              ? 'bg-slate-900 border-slate-800 text-white border-t-rose-500 font-bold text-rose-400'
              : 'bg-transparent border-transparent text-rose-500/70 hover:text-rose-400'
          }`}
        >
          <Database size={14} />
          <span>ডাটাবেজ ক্লিয়ার ও রিসেট ⚠️</span>
        </button>
      </div>

      {igSubTab === 'submissions' && (
        <>
          {/* BULK USERNAME PASTE ACTIONS */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-pink-500 animate-pulse"></span>
                  পেস্টিং বাল্ক একশন (Bulk Username Paste Action)
                </h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  একসাথে অনেকগুলো ইন্সটাগ্রাম ইউজারনেম কপি করে এনে এখানে পেস্ট করে সরাসরি অনুমোদন বা বাতিল করতে পারেন।
                </p>
              </div>
              <span className="text-[10px] bg-pink-500/10 text-pink-400 px-2 py-0.5 rounded font-bold border border-pink-500/15">অটো-টেলিগ্রাম নোটিফিকেশন ⚡</span>
            </div>

            <div className="space-y-3">
              <textarea
                rows={3}
                value={pastedUsernamesText}
                onChange={(e) => setPastedUsernamesText(e.target.value)}
                placeholder="এখানে ইন্সটাগ্রাম ইউজারনেমগুলো পেস্ট করুন (যেমন: abir_ig_user, tanvir_insta455 অথবা স্পেস, কমা বা নতুন লাইনে আলাদা করে লিখুন)"
                className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-slate-300 text-xs font-mono outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600 leading-relaxed"
              />

              {bulkPasteResult && (
                <div className={`p-3 rounded-xl text-xs font-medium leading-relaxed border ${
                  bulkPasteResult.type === 'success' 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                    : bulkPasteResult.type === 'info'
                    ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                }`}>
                  {bulkPasteResult.text}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                  <span className="text-[11px] text-emerald-400 font-bold whitespace-nowrap">অনুমোদন রেট (৳/আইডি):</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={customApprovalRate}
                    onChange={(e) => setCustomApprovalRate(parseFloat(e.target.value) || 0)}
                    className="w-16 bg-slate-900 border border-slate-700 text-emerald-400 text-xs font-bold px-2 py-1 rounded text-center outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleBulkPasteAction('rejected')}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg shadow-lg transition-all flex items-center gap-1.5"
                  >
                    ❌ পেস্টকৃতগুলো বাতিল করুন (Bulk Reject)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkPasteAction('approved', customApprovalRate)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-lg transition-all flex items-center gap-1.5"
                  >
                    ✅ পেস্টকৃতগুলো অনুমোদন করুন (৳{customApprovalRate} রেটে)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* PASSWORD FILTER & EXPORT STATUS OPTIONS BOX */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Key size={16} className="text-amber-400" />
                  <span>পাসওয়ার্ড ভিত্তিক ফিল্টার ও ডাউনলোড অপশন (Password Search & Excel Export)</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  পাসওয়ার্ড ফিল্টার করুন এবং ডাউনলোডের সময় শুধুমাত্র পেন্ডিং আইডি নাকি সবগুলো আইডি ডাউনলোড করবেন তা সিলেক্ট করুন।
                </p>
              </div>
              {passwordFilter && (
                <button
                  type="button"
                  onClick={() => setPasswordFilter('')}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg border border-slate-700 transition-colors shrink-0"
                >
                  ✕ ফিল্টার রিসেট
                </button>
              )}
            </div>

            <div className="space-y-4">
              {/* Search input field */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                  <Search size={15} />
                </span>
                <input
                  type="text"
                  placeholder="পাসওয়ার্ড বা কোড টাইপ করুন (যেমন: nihad@16, @16, pass2026)..."
                  value={passwordFilter}
                  onChange={(e) => setPasswordFilter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 pl-10 pr-4 py-2.5 rounded-xl text-slate-200 text-xs font-mono outline-none focus:border-amber-500 transition-all placeholder:text-slate-600"
                />
              </div>

              {/* Quick Password Badges */}
              {passwordCounts.length > 0 && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5">
                    বিদ্যমান পাসওয়ার্ড ব্যাজ (Quick Filters):
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                    {passwordCounts.map(([pwd, count]) => {
                      const isActive = passwordFilter.toLowerCase() === pwd.toLowerCase();
                      return (
                        <button
                          key={pwd}
                          type="button"
                          onClick={() => setPasswordFilter(isActive ? '' : pwd)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all flex items-center gap-1.5 border ${
                            isActive
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                          }`}
                        >
                          <span>🔑 {pwd}</span>
                          <span className="bg-slate-900 text-slate-400 px-1.5 py-0.2 rounded text-[9px] border border-slate-800">
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* DOWNLOAD STATUS FILTER SELECTOR */}
              <div className="bg-slate-950 border border-slate-800/80 p-4 rounded-xl space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 pb-2">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Download size={14} className="text-emerald-400" />
                    <span>এক্সেল ডাউনলোড ফিল্টার অপশন (Export Mode):</span>
                  </span>
                  <span className="text-[10px] text-slate-400">
                    আপনি ডাউনলোডের ফাইলে কোন আইডিগুলো রাখতে চান?
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setExportStatusMode('pending')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                      exportStatusMode === 'pending'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <span>⏳ শুধুমাত্র পেন্ডিং আইডি</span>
                    <span className="bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded text-[10px] font-mono border border-amber-500/30">
                      {displayedSubmissions.filter(s => s.status === 'pending').length}টি
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportStatusMode('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                      exportStatusMode === 'all'
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 shadow'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <span>📁 সবগুলো আইডি (All)</span>
                    <span className="bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded text-[10px] font-mono border border-indigo-500/30">
                      {displayedSubmissions.length}টি
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportStatusMode('approved')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                      exportStatusMode === 'approved'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <span>✅ শুধুমাত্র অ্যাপ্রুভড</span>
                    <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded text-[10px] font-mono border border-emerald-500/30">
                      {displayedSubmissions.filter(s => s.status === 'approved').length}টি
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportStatusMode('rejected')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                      exportStatusMode === 'rejected'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <span>❌ শুধুমাত্র রিজেক্টড</span>
                    <span className="bg-rose-500/20 text-rose-300 px-1.5 py-0.2 rounded text-[10px] font-mono border border-rose-500/30">
                      {displayedSubmissions.filter(s => s.status === 'rejected').length}টি
                    </span>
                  </button>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-slate-800/60">
                  <span className="text-[11px] text-slate-400">
                    {passwordFilter ? (
                      <>সার্চ: <code className="text-amber-300 font-mono">{passwordFilter}</code> | </>
                    ) : null}
                    ডাউনলোডের জন্য রেডি: <strong className="text-emerald-400">{exportSubmissionsList.length}টি</strong> আইডি
                  </span>

                  <button
                    type="button"
                    onClick={handleExportFilteredCSV}
                    disabled={exportSubmissionsList.length === 0}
                    className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download size={14} />
                    <span>
                      ডাউনলোড এক্সেল ({exportStatusMode === 'pending' ? 'শুধুমাত্র পেন্ডিং' : exportStatusMode === 'approved' ? 'শুধুমাত্র অ্যাপ্রুভড' : exportStatusMode === 'rejected' ? 'শুধুমাত্র রিজেক্টড' : 'সবগুলো'}: {exportSubmissionsList.length}টি)
                    </span>
                  </button>
                </div>
              </div>

              {/* Delete action bar when password filter is active */}
              {passwordFilter.trim() && (
                <div className="bg-slate-950 border border-amber-500/30 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="text-xs text-slate-300 space-y-0.5">
                    <span className="text-amber-400 font-bold block">
                      🔍 ফিল্টারিকৃত পাসওয়ার্ড: <code className="bg-slate-900 px-2 py-0.5 rounded text-amber-300 font-mono">{passwordFilter}</code>
                    </span>
                    <p className="text-slate-400 text-[11px]">
                      মোট {displayedSubmissions.length}টি আইডি ম্যাচ করেছে।
                    </p>
                  </div>

                  {displayedSubmissions.length > 0 && (
                    <button
                      type="button"
                      onClick={handleDeleteFilteredByPassword}
                      disabled={isBulkDeletingByPassword}
                      className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                    >
                      <Trash2 size={14} />
                      <span>
                        {isBulkDeletingByPassword
                          ? 'ডিলিট হচ্ছে...'
                          : `এই পাসওয়ার্ডের আইডি সব ডিলিট (${displayedSubmissions.length}টি)`}
                      </span>
                    </button>
                  )}
                </div>
              )}

              {passwordActionResult && (
                <div className={`p-3 rounded-xl text-xs font-medium leading-relaxed border ${
                  passwordActionResult.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                }`}>
                  {passwordActionResult.text}
                </div>
              )}
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
                        checked={selectedSubIds.length === displayedSubmissions.length && displayedSubmissions.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSubIds(displayedSubmissions.map(s => s.id || '').filter(Boolean));
                          } else {
                            setSelectedSubIds([]);
                          }
                        }}
                        className="rounded accent-indigo-600"
                      />
                    </th>
                    <th className="py-4 px-4">Username</th>
                    <th className="py-4 px-4">Password</th>
                    <th className="py-4 px-4">2FA Key</th>
                    <th className="py-4 px-4">Worker</th>
                    <th className="py-4 px-4">Submitted At</th>
                    <th className="py-4 px-4 text-center">Status</th>
                    <th className="py-4 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {displayedSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-500 text-sm">
                        {passwordFilter ? `'${passwordFilter}' পাসওয়ার্ডযুক্ত কোনো ইন্সটাগ্রাম আইডি রেকর্ড পাওয়া যায়নি।` : 'কোনো ইন্সটাগ্রাম আইডি রেকর্ড পাওয়া যায়নি।'}
                      </td>
                    </tr>
                  ) : (
                    displayedSubmissions.map((sub, index) => (
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
                        <td className="py-4 px-4 font-mono text-xs text-white truncate max-w-[140px]" title={sub.username}>{sub.username}</td>
                        <td className="py-4 px-4 font-mono text-xs text-slate-400 truncate max-w-[140px]" title={sub.password}>{sub.password}</td>
                        <td className="py-4 px-4 font-mono text-xs text-indigo-400 truncate max-w-[160px]" title={sub.twoFactorKey}>
                          <div className="flex items-center gap-1.5">
                            <span className="truncate max-w-[100px]">{sub.twoFactorKey}</span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(sub.twoFactorKey || "");
                                alert("2FA Key copied!");
                              }}
                              className="text-[9px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700 font-bold flex-shrink-0"
                            >
                              Copy
                            </button>
                          </div>
                        </td>
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
                                onClick={() => handleApproveRejectSub(sub.id || '', 'approved', customApprovalRate)}
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

      {igSubTab === 'summary' && (
        <div className="space-y-6">
          {/* Search Bar */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                <Users size={15} />
              </span>
              <input
                type="text"
                placeholder="ইউজার (ওয়ালেট নাম্বার) দিয়ে সার্চ করুন..."
                value={workerSearchQuery}
                onChange={(e) => setWorkerSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 pl-10 pr-4 py-2.5 rounded-lg text-slate-300 text-xs outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600"
              />
            </div>
            {workerSearchQuery && (
              <button
                onClick={() => setWorkerSearchQuery('')}
                className="text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20 whitespace-nowrap"
              >
                ক্লিয়ার করুন
              </button>
            )}
          </div>

          {/* Grouped list */}
          <div className="grid grid-cols-1 gap-4">
            {(() => {
              const query = workerSearchQuery.toLowerCase().trim();
              const filteredGroups = categoryGroupedSubmissions.filter(g => {
                if (!query) return true;
                return g.worker.toLowerCase().includes(query);
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
                    <div 
                      onClick={() => setExpandedWorker(isExpanded ? null : group.worker)}
                      className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-950/20 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-pink-500/10 flex items-center justify-center border border-pink-500/20 text-pink-400">
                          <User size={18} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white flex items-center gap-2">
                            {group.worker}
                            <span className="text-[10px] bg-pink-500/10 text-pink-400 px-2 py-0.5 rounded-full font-bold border border-pink-500/15">Instagram Worker</span>
                          </h4>
                          <p className="text-[10.5px] text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                            <span>মোট ইন্সটাগ্রাম আইডি সাবমিট করেছেন: <strong className="text-white">{group.total} টি</strong></span>
                            {calculateUserBalance && (
                              <span className="text-[10.5px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                                <Wallet size={11} />
                                <span>ব্যালেন্স: ৳{calculateUserBalance(group.worker)} Taka</span>
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedWorkerForBalance(group.worker);
                                setAdjustAmount('');
                              }}
                              className="text-[10.5px] font-bold text-indigo-300 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 px-2 py-0.5 rounded-md inline-flex items-center gap-1 transition-all cursor-pointer"
                            >
                              💰 ব্যালেন্স বাড়ান / কমান
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedWorkerForDetails(group.worker);
                              }}
                              className="text-[10.5px] font-bold text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 px-2 py-0.5 rounded-md inline-flex items-center gap-1 transition-all cursor-pointer"
                            >
                              🔍 ইউজারের ডিটেইলস দেখুন
                            </button>
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

                    {isExpanded && (
                      <div className="border-t border-slate-800/80 bg-slate-950/40 p-5 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h5 className="text-xs font-bold text-slate-300">সাবমিটকৃত ইন্সটাগ্রাম আইডির তালিকা:</h5>
                          <button
                            type="button"
                            onClick={() => handleExportUserCSV(group.worker, group.submissions)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] rounded-lg shadow transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <Download size={13} />
                            <span>এই ইউজারের আইডি এক্সেল (Excel) ডাউনলোড ({group.submissions.length}টি)</span>
                          </button>
                        </div>
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
                                          onClick={() => handleApproveRejectSub(sub.id || '', 'approved', customApprovalRate)}
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

      {igSubTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="space-y-4 pt-2 max-w-xl mx-auto">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white mb-1">ইন্সটাগ্রাম কাজ সেটিংস (Instagram Configs)</h3>
              <p className="text-xs text-slate-400">
                এখানে ইন্সটাগ্রাম প্রতি অনুমোদিত আইডির রেট, পাসওয়ার্ড এবং কাজ সচল বা বন্ধ রাখার তথ্য পরিবর্তন করুন।
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Daily Generated Instagram Password (ঐচ্ছিক)</label>
                  <input 
                    type="text"
                    placeholder="খালি রাখলে প্রতিবার রেন্ডম পাসওয়ার্ড তৈরি হবে"
                    value={settings.dailyPassword || ''}
                    onChange={(e) => setAppSettings(prev => ({ ...prev, dailyPassword: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 px-4 py-3 rounded-lg text-slate-300 text-sm outline-none focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 bg-slate-950 border border-slate-800 p-5 rounded-xl">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Instagram Work Status (ইন্সটাগ্রাম কাজ সচল/বন্ধ)</span>
                  <span className="text-xs text-slate-300 font-bold">
                    {settings.instagramWorkActive !== false ? "🟢 সচল (ON)" : "🔴 বন্ধ (OFF)"}
                  </span>
                </div>
                <button 
                  type="button"
                  onClick={() => setAppSettings(prev => ({ ...prev, instagramWorkActive: prev.instagramWorkActive === false ? true : false }))} 
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all shrink-0 ${settings.instagramWorkActive !== false ? 'bg-pink-600' : 'bg-slate-800'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-all ${settings.instagramWorkActive !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            {settingsStatus && (
              <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                settingsStatus.type === 'success' 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}>
                <div className="flex-1 text-xs">{settingsStatus.text}</div>
              </div>
            )}

            <button 
              type="submit"
              className="w-full py-3.5 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-xl shadow-lg transition-all text-sm"
            >
              ইন্সটাগ্রাম সেটিংস সংরক্ষণ করুন (Save Instagram Settings)
            </button>
          </div>
        </form>
      )}

      {igSubTab === 'clear' && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-6">
          {/* Warning Header */}
          <div className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-xl flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400 border border-rose-500/20 shrink-0">
              <AlertCircle size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">বিপজ্জামানক অঞ্চল (Danger Zone) — ইন্সটাগ্রাম ডাটা ক্লিয়ার</h4>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                এখানে থাকা অপশনগুলো ব্যবহার করে ডাটাবেজের ইন্সটাগ্রাম রেকর্ড চিরতরে মুছে ফেলা সম্ভব। এই অ্যাকশন সম্পূর্ণ অপরিবর্তনশীল (Irreversible)। অনুগ্রহ করে সতর্কতার সাথে সিদ্ধান্ত নিন।
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
                  ইন্সটাগ্রাম সাবমিশন ক্লিয়ার
                </h5>
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                  ডাটাবেজের সকল ইন্সটাগ্রাম আইডি সাবমিশন রেকর্ড (মোট {categoryFilteredSubmissions.length}টি) মুছে ফেলে সম্পূর্ণ শূন্য করে দেওয়া হবে।
                </p>
              </div>
              <button
                onClick={handleClearAllSubmissions}
                disabled={clearConfirmationText !== 'CONFIRM' || isClearingSubmissions}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-950/20 text-white disabled:text-rose-800/60 font-bold text-xs rounded-lg transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed border border-rose-600/30"
              >
                {isClearingSubmissions ? 'মুছে ফেলা হচ্ছে...' : 'সব ইন্সটাগ্রাম সাবমিশন মুছুন ❌'}
              </button>
            </div>

            {/* Clear Withdrawals Card */}
            <div className="bg-slate-950/50 border border-slate-800 p-5 rounded-xl flex flex-col justify-between gap-4">
              <div>
                <h5 className="text-xs font-bold text-white flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  উইথড্রয়াল ক্লিয়ার (সকল কাজের)
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
                  ইউজার প্রোফাইল ক্লিয়ার (সকল কাজের)
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

      {/* Modal: Adjust User Balance */}
      {selectedWorkerForBalance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Wallet className="text-emerald-400" size={18} />
                <span>ইউজার ব্যালেন্স এডজাস্ট (Modify Balance)</span>
              </h3>
              <button 
                onClick={() => setSelectedWorkerForBalance(null)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>ইউজার (Worker):</span>
                <span className="font-bold text-white">{selectedWorkerForBalance}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>বর্তমান ব্যালেন্স:</span>
                <span className="font-extrabold text-emerald-400">৳{calculateUserBalance ? calculateUserBalance(selectedWorkerForBalance) : 0} Taka</span>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1.5">
                কত টাকা পরিবর্তন করতে চান? (যেমন: +50 বা -50)
              </label>
              <div className="flex gap-2">
                <input 
                  type="number"
                  placeholder="যেমন: 50 বা -50"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 px-3.5 py-2.5 rounded-xl text-white text-xs outline-none focus:border-indigo-500 font-mono"
                  autoFocus
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5">
                💡 পজিটিভ এমাউন্ট (যেমন <code>50</code>) লিখলে ইউজারের ব্যালেন্স বাড়বে, আর নেগেটিভ এমাউন্ট (যেমন <code>-50</code>) লিখলে ইউজারের ব্যালেন্স কমবে।
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  const amt = parseFloat(adjustAmount);
                  if (isNaN(amt) || amt === 0) {
                    alert("অনুগ্রহ করে একটি সঠিক টাকার পরিমাণ লিখুন!");
                    return;
                  }
                  if (handleAdjustUserBalance) {
                    handleAdjustUserBalance(selectedWorkerForBalance, amt);
                    setSelectedWorkerForBalance(null);
                    setAdjustAmount('');
                  }
                }}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition-all cursor-pointer"
              >
                নিশ্চিত করুন (Save Balance)
              </button>
              <button
                onClick={() => {
                  setSelectedWorkerForBalance(null);
                  setAdjustAmount('');
                }}
                className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                বাতিল
              </button>
            </div>
          </div>
        </div>
      )}

      {/* USER DETAILS FULL MODAL */}
      {selectedWorkerForDetails && (
        <UserDetailsModal
          workerName={selectedWorkerForDetails}
          onClose={() => setSelectedWorkerForDetails(null)}
          allSubmissions={allSubmissions}
          withdrawals={withdrawals}
          allProfiles={allProfiles}
          settings={settings}
          calculateUserBalance={calculateUserBalance}
          handleAdjustUserBalance={handleAdjustUserBalance}
        />
      )}
    </div>
  );
}
