import React, { useState, useMemo, useEffect } from 'react';
import { 
  Mail, 
  Flame,
  Download, 
  List, 
  Users, 
  Settings, 
  Database, 
  Trash2, 
  AlertCircle, 
  Key,
  Search,
  Wallet,
  Calendar,
  CheckCircle2,
  Copy,
  Check,
  Sparkles,
  Shield,
  FileSpreadsheet
} from 'lucide-react';
import { Submission, AppSettings, Withdrawal, UserProfile } from '../firebaseService';
import UserDetailsModal from './UserDetailsModal';
import ApprovalRateModal from './ApprovalRateModal';

export interface AdminFbHotmailProps {
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
  fbHotmailSubTab: 'submissions' | 'summary' | 'settings' | 'clear';
  setFbHotmailSubTab: React.Dispatch<React.SetStateAction<'submissions' | 'summary' | 'settings' | 'clear'>>;
  calculateUserBalance?: (workerName: string) => number;
  handleAdjustUserBalance?: (workerName: string, amount: number) => Promise<void>;
  handleBulkRateUpdate?: (targetIds: string[], newRate: number) => Promise<void>;
  allSubmissions?: Submission[];
  allProfiles?: UserProfile[];
}

export default function AdminFbHotmail({
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
  fbHotmailSubTab,
  setFbHotmailSubTab,
  calculateUserBalance,
  handleAdjustUserBalance,
  handleBulkRateUpdate,
  allSubmissions = [],
  allProfiles = []
}: AdminFbHotmailProps) {
  const [passwordFilter, setPasswordFilter] = useState('');
  const [exportStatusMode, setExportStatusMode] = useState<'pending' | 'all' | 'approved' | 'rejected'>('pending');
  const [customApprovalRate, setCustomApprovalRate] = useState<number>(settings.fbHotmailRatePerId !== undefined ? settings.fbHotmailRatePerId : 50);
  const [isBulkDeletingByPassword, setIsBulkDeletingByPassword] = useState(false);
  const [passwordActionResult, setPasswordActionResult] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [selectedWorkerForBalance, setSelectedWorkerForBalance] = useState<string | null>(null);
  const [selectedWorkerForDetails, setSelectedWorkerForDetails] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Rate Approval Modals
  const [showBulkApproveModal, setShowBulkApproveModal] = useState(false);
  const [showPasteApproveModal, setShowPasteApproveModal] = useState(false);
  const [showReRateModal, setShowReRateModal] = useState(false);
  const [singleApproveTarget, setSingleApproveTarget] = useState<Submission | null>(null);

  useEffect(() => {
    const defaultRate = settings.fbHotmailRatePerId !== undefined ? settings.fbHotmailRatePerId : 50;
    setCustomApprovalRate(defaultRate);
  }, [settings.fbHotmailRatePerId]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Extract unique passwords and count
  const passwordCounts = useMemo(() => {
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
  const displayedSubmissions = useMemo(() => {
    if (!passwordFilter.trim()) return categoryFilteredSubmissions;
    const query = passwordFilter.trim().toLowerCase();
    return categoryFilteredSubmissions.filter(sub => 
      (sub.password || '').toLowerCase().includes(query)
    );
  }, [categoryFilteredSubmissions, passwordFilter]);

  // Filter displayed submissions based on selected export status mode
  const exportSubmissionsList = useMemo(() => {
    if (exportStatusMode === 'pending') {
      return displayedSubmissions.filter(s => s.status === 'pending');
    } else if (exportStatusMode === 'approved') {
      return displayedSubmissions.filter(s => s.status === 'approved');
    } else if (exportStatusMode === 'rejected') {
      return displayedSubmissions.filter(s => s.status === 'rejected');
    }
    return displayedSubmissions;
  }, [displayedSubmissions, exportStatusMode]);

  // Parse pasted usernames to calculate count
  const parsedPastedCount = useMemo(() => {
    if (!pastedUsernamesText.trim()) return 0;
    const parsed = pastedUsernamesText.split(/[\s,\n]+/).map(u => u.trim()).filter(Boolean);
    const matching = categoryFilteredSubmissions.filter(sub => 
      parsed.some(u => u.toLowerCase() === sub.username.toLowerCase())
    );
    return matching.length;
  }, [pastedUsernamesText, categoryFilteredSubmissions]);

  // Delete all submissions matching password filter
  const handleDeleteFilteredByPassword = async () => {
    if (!passwordFilter.trim()) return;
    const count = displayedSubmissions.length;
    if (count === 0) return;

    const confirmMsg = `আপনি কি নিশ্চিত যে '${passwordFilter}' পাসওয়ার্ডযুক্ত সকল ${count}টি FB Hotmail আইডি স্থায়ীভাবে ডাটাবেজ থেকে মুছে ফেলতে চান?`;
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
        text: `✅ '${passwordFilter}' পাসওয়ার্ডের মোট ${count}টি FB Hotmail আইডি সফলভাবে মুছে ফেলা হয়েছে!`
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

  // Export filtered FB Hotmail submissions as Excel (CSV)
  const handleExportFilteredCSV = () => {
    if (exportSubmissionsList.length === 0) return;
    const headers = ["UID", "Password", "First Name", "Last Name", "Cookie", "2FA Key", "Hotmail Token", "Rate (Taka)", "Submitted By", "Status", "Submitted At"];

    const rows = exportSubmissionsList.map(s => [
      s.username,
      s.password,
      s.firstName || "",
      s.lastName || "",
      s.cookie || "",
      s.twoFactorKey || "",
      s.hotmailToken || "",
      s.rate !== undefined ? s.rate : (settings.fbHotmailRatePerId || 50),
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
    link.setAttribute("download", `fb_hotmail_${exportStatusMode}_ids${pwdTag}_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Flame size={22} className="text-orange-500" />
            <Mail size={20} className="text-amber-400" />
            <span>FB Hotmail Control (FB Hotmail 30+fd Cookie + 2fa)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            হটমেইল মেইল, ৩০+ ফ্রেন্ডস, কুকি এবং ২এফএ যুক্ত ফেসবুক আইডি ম্যানেজমেন্ট ও অনুমোদন
          </p>
        </div>

        {/* Sub Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 self-stretch sm:self-auto overflow-x-auto">
          <button
            onClick={() => setFbHotmailSubTab('submissions')}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              fbHotmailSubTab === 'submissions'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <List size={14} />
            <span>আইডি তালিকা ({categoryFilteredSubmissions.length})</span>
          </button>

          <button
            onClick={() => setFbHotmailSubTab('summary')}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              fbHotmailSubTab === 'summary'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Users size={14} />
            <span>ওয়ার্কার সামারি ({categoryGroupedSubmissions.length})</span>
          </button>

          <button
            onClick={() => setFbHotmailSubTab('settings')}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              fbHotmailSubTab === 'settings'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Settings size={14} />
            <span>FB Hotmail সেটিংস</span>
          </button>

          <button
            onClick={() => setFbHotmailSubTab('clear')}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              fbHotmailSubTab === 'clear'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20'
                : 'text-slate-400 hover:text-rose-400 hover:bg-slate-800/50'
            }`}
          >
            <Database size={14} />
            <span>ডাটা ক্লিয়ার</span>
          </button>
        </div>
      </div>

      {/* SUBMISSION LIST TAB */}
      {fbHotmailSubTab === 'submissions' && (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedSubIds.length > 0 && selectedSubIds.length === categoryFilteredSubmissions.length}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedSubIds(categoryFilteredSubmissions.map(s => s.id || '').filter(Boolean));
                  } else {
                    setSelectedSubIds([]);
                  }
                }}
                className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-300">
                {selectedSubIds.length > 0 ? `${selectedSubIds.length} টি সিলেক্ট করা হয়েছে` : 'সব সিলেক্ট করুন'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Quick Rate Badge/Input */}
              <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                <span className="text-[11px] text-emerald-400 font-bold whitespace-nowrap">ডিফল্ট রেট:</span>
                <span className="text-emerald-400 font-extrabold text-xs font-mono">
                  ৳{settings.fbHotmailRatePerId !== undefined ? settings.fbHotmailRatePerId : 50}
                </span>
              </div>

              {/* Excel Export Button */}
              <button 
                onClick={handleExportFilteredCSV}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors border border-slate-700 text-slate-300"
              >
                <Download size={14} />
                <span>এক্সেল ({exportStatusMode})</span>
              </button>

              {/* Bulk Approve Button (Opens Rate Modal) */}
              <button 
                onClick={() => setShowBulkApproveModal(true)}
                disabled={selectedSubIds.length === 0}
                className="px-3.5 py-2 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/20 disabled:opacity-40 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
              >
                <CheckCircle2 size={14} />
                <span>বাল্ক অনুমোদন ({selectedSubIds.length}) [রেট নির্বাচন]</span>
              </button>

              {/* Re-Rate / Adjust Rate Button for Selected IDs */}
              {handleBulkRateUpdate && (
                <button 
                  onClick={() => setShowReRateModal(true)}
                  disabled={selectedSubIds.length === 0}
                  className="px-3.5 py-2 bg-amber-600/10 hover:bg-amber-600 text-amber-400 hover:text-white border border-amber-500/20 disabled:opacity-40 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Sparkles size={14} />
                  <span>রেট রি-এডজাস্ট ({selectedSubIds.length})</span>
                </button>
              )}

              {/* Bulk Reject Button */}
              <button 
                onClick={() => handleBulkSubAction('rejected')}
                disabled={selectedSubIds.length === 0}
                className="px-3.5 py-2 bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/20 disabled:opacity-40 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
              >
                <Trash2 size={14} />
                <span>বাল্ক বাতিল ({selectedSubIds.length})</span>
              </button>
            </div>
          </div>

          {/* BULK PASTE BOX */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Sparkles size={14} className="text-amber-400" />
              <span>একসাথে একাধিক FB Hotmail UID/ইউজারনেম পেস্ট করে অনুমোদন / বাতিল করুন</span>
            </h4>
            <p className="text-xs text-slate-400">
              নিচে এক বা একাধিক FB Hotmail UID বা ইউজারনেম পেস্ট করুন (স্পেস, কমা বা নতুন লাইনে)। সিস্টেমে ম্যাচ করা আইডিগুলো এক ক্লিকে অনুমোদন বা বাতিল হবে।
            </p>

            <textarea
              rows={3}
              value={pastedUsernamesText}
              onChange={(e) => setPastedUsernamesText(e.target.value)}
              placeholder="100087654321&#10;100098765432&#10;100012345678"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-mono outline-none focus:border-amber-500 transition-all placeholder:text-slate-600"
            />

            {bulkPasteResult && (
              <div className={`p-3 rounded-lg text-xs font-medium ${
                bulkPasteResult.type === 'success' ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-800/40' :
                bulkPasteResult.type === 'error' ? 'bg-rose-950/50 text-rose-300 border border-rose-800/40' :
                'bg-blue-950/50 text-blue-300 border border-blue-800/40'
              }`}>
                {bulkPasteResult.text}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="text-xs text-slate-400">
                {parsedPastedCount > 0 && (
                  <span className="text-emerald-400 font-bold">
                    ✓ সাবমিশন তালিকায় মোট {parsedPastedCount}টি ম্যাচিং আইডি পাওয়া গেছে!
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleBulkPasteAction('rejected')}
                  disabled={!pastedUsernamesText.trim()}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg shadow-lg transition-all flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                >
                  ❌ পেস্টকৃতগুলো বাতিল করুন
                </button>
                <button
                  type="button"
                  onClick={() => setShowPasteApproveModal(true)}
                  disabled={!pastedUsernamesText.trim()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-lg transition-all flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                >
                  ✅ পেস্টকৃতগুলো অনুমোদন করুন (রেট যাচাই)
                </button>
              </div>
            </div>
          </div>

          {/* PASSWORD FILTER & EXPORT STATUS OPTIONS BOX */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Search size={16} className="text-amber-400" />
                <span className="text-xs font-bold text-white">পাসওয়ার্ড দিয়ে ফিল্টার ও এক্সেল ডাউনলোড:</span>
              </div>

              {/* Status Mode Selector */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                {(['pending', 'all', 'approved', 'rejected'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setExportStatusMode(mode)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded capitalize transition-all cursor-pointer ${
                      exportStatusMode === mode
                        ? 'bg-amber-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {mode === 'pending' ? 'পেন্ডিং' : mode === 'approved' ? 'অনুমোদিত' : mode === 'rejected' ? 'বাতিল' : 'সব'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-center">
              <div className="relative flex-1 w-full">
                <input
                  type="text"
                  value={passwordFilter}
                  onChange={(e) => setPasswordFilter(e.target.value)}
                  placeholder="পাসওয়ার্ড লিখে সার্চ করুন..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 outline-none focus:border-amber-500 font-mono"
                />
                <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              </div>

              {passwordFilter && (
                <button
                  onClick={handleDeleteFilteredByPassword}
                  disabled={isBulkDeletingByPassword || displayedSubmissions.length === 0}
                  className="w-full sm:w-auto px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-40"
                >
                  <Trash2 size={14} />
                  <span>এই পাসওয়ার্ডের সব আইডি মুছুন ({displayedSubmissions.length})</span>
                </button>
              )}
            </div>

            {passwordActionResult && (
              <div className={`p-2.5 rounded-lg text-xs ${
                passwordActionResult.type === 'success' ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40' : 'bg-rose-950/60 text-rose-300 border border-rose-800/40'
              }`}>
                {passwordActionResult.text}
              </div>
            )}
          </div>

          {/* Submissions Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-4 w-10">
                      <input
                        type="checkbox"
                        checked={selectedSubIds.length > 0 && selectedSubIds.length === displayedSubmissions.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSubIds(displayedSubmissions.map(s => s.id || '').filter(Boolean));
                          } else {
                            setSelectedSubIds([]);
                          }
                        }}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-amber-600 cursor-pointer"
                      />
                    </th>
                    <th className="p-4">UID / একাউন্ট</th>
                    <th className="p-4">পাসওয়ার্ড & নাম</th>
                    <th className="p-4">2FA Key</th>
                    <th className="p-4">Hotmail Token</th>
                    <th className="p-4">Cookie</th>
                    <th className="p-4">রেট (৳)</th>
                    <th className="p-4">ওয়ার্কার</th>
                    <th className="p-4">স্ট্যাটাস</th>
                    <th className="p-4 text-right">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {displayedSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-500 font-medium">
                        কোনো FB Hotmail সাবমিশন পাওয়া যায়নি।
                      </td>
                    </tr>
                  ) : (
                    displayedSubmissions.map((sub) => {
                      const isSelected = selectedSubIds.includes(sub.id || '');
                      const effectiveRate = sub.rate !== undefined ? sub.rate : (settings.fbHotmailRatePerId || 50);

                      return (
                        <tr 
                          key={sub.id} 
                          className={`hover:bg-slate-800/40 transition-colors ${
                            isSelected ? 'bg-amber-950/20' : ''
                          }`}
                        >
                          <td className="p-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedSubIds(prev => [...prev, sub.id || '']);
                                } else {
                                  setSelectedSubIds(prev => prev.filter(id => id !== sub.id));
                                }
                              }}
                              className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-amber-600 cursor-pointer"
                            />
                          </td>
                          <td className="p-4 font-mono font-bold text-white">
                            <div className="flex items-center gap-2">
                              <span>{sub.username}</span>
                              <button
                                onClick={() => copyToClipboard(sub.username, `uid_${sub.id}`)}
                                title="UID কপি করুন"
                                className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                              >
                                {copiedKey === `uid_${sub.id}` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                              </button>
                            </div>
                            <div className="text-[10px] text-slate-500 font-sans mt-0.5">
                              {new Date(sub.createdAt).toLocaleString()}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2 font-mono font-bold text-amber-400">
                              <span>{sub.password}</span>
                              <button
                                onClick={() => copyToClipboard(sub.password, `pwd_${sub.id}`)}
                                title="পাসওয়ার্ড কপি করুন"
                                className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                              >
                                {copiedKey === `pwd_${sub.id}` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                              </button>
                            </div>
                            {(sub.firstName || sub.lastName) && (
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                {sub.firstName} {sub.lastName}
                              </div>
                            )}
                          </td>
                          <td className="p-4 font-mono text-xs">
                            {sub.twoFactorKey ? (
                              <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded border border-slate-800 w-fit">
                                <span className="max-w-[100px] truncate text-indigo-300 font-bold">{sub.twoFactorKey}</span>
                                <button
                                  onClick={() => copyToClipboard(sub.twoFactorKey, `2fa_${sub.id}`)}
                                  title="2FA Key কপি করুন"
                                  className="p-0.5 text-slate-400 hover:text-white"
                                >
                                  {copiedKey === `2fa_${sub.id}` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>
                          <td className="p-4 font-mono text-xs">
                            {sub.hotmailToken ? (
                              <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded border border-slate-800 w-fit">
                                <span className="max-w-[110px] truncate text-amber-300">{sub.hotmailToken}</span>
                                <button
                                  onClick={() => copyToClipboard(sub.hotmailToken || '', `tok_${sub.id}`)}
                                  title="Hotmail Token কপি করুন"
                                  className="p-0.5 text-slate-400 hover:text-white"
                                >
                                  {copiedKey === `tok_${sub.id}` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>
                          <td className="p-4 font-mono text-xs">
                            {sub.cookie ? (
                              <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded border border-slate-800 w-fit">
                                <span className="max-w-[100px] truncate text-slate-400">{sub.cookie}</span>
                                <button
                                  onClick={() => copyToClipboard(sub.cookie || '', `cookie_${sub.id}`)}
                                  title="Cookie কপি করুন"
                                  className="p-0.5 text-slate-400 hover:text-white"
                                >
                                  {copiedKey === `cookie_${sub.id}` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>
                          <td className="p-4 font-bold text-emerald-400 font-mono">
                            ৳{effectiveRate}
                          </td>
                          <td className="p-4">
                            <button
                              onClick={() => setSelectedWorkerForDetails(sub.submittedBy)}
                              className="text-indigo-400 hover:underline font-medium text-left"
                            >
                              {sub.submittedBy}
                            </button>
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                              sub.status === 'approved' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50' :
                              sub.status === 'rejected' ? 'bg-rose-950 text-rose-400 border border-rose-800/50' :
                              'bg-amber-950 text-amber-400 border border-amber-800/50'
                            }`}>
                              {sub.status}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {sub.status !== 'approved' && (
                                <button
                                  onClick={() => setSingleApproveTarget(sub)}
                                  title="অনুমোদন করুন (রেট নির্ধারণ)"
                                  className="p-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-lg transition-all cursor-pointer"
                                >
                                  <CheckCircle2 size={14} />
                                </button>
                              )}
                              {sub.status !== 'rejected' && (
                                <button
                                  onClick={() => handleApproveRejectSub(sub.id || '', 'rejected')}
                                  title="বাতিল করুন"
                                  className="p-1.5 bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white rounded-lg transition-all cursor-pointer"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteSub(sub.id || '')}
                                title="স্থায়ীভাবে মুছে ফেলুন"
                                className="p-1.5 bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 rounded-lg transition-all cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* WORKER SUMMARY TAB */}
      {fbHotmailSubTab === 'summary' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="ওয়ার্কার সার্চ করুন (নাম বা ওয়ালেট)..."
                value={workerSearchQuery}
                onChange={(e) => setWorkerSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 outline-none focus:border-amber-500"
              />
            </div>
            <div className="text-xs text-slate-400 font-bold">
              মোট ওয়ার্কার: {categoryGroupedSubmissions.length} জন
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoryGroupedSubmissions
              .filter(g => !workerSearchQuery.trim() || g.worker.toLowerCase().includes(workerSearchQuery.toLowerCase()))
              .map((group) => {
                const userBalance = calculateUserBalance ? calculateUserBalance(group.worker) : 0;
                return (
                  <div key={group.worker} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4 shadow-lg">
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                      <div>
                        <h4 className="font-bold text-white text-sm">{group.worker}</h4>
                        <span className="text-[10px] text-slate-500">FB Hotmail Worker</span>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-400">বর্তমান ব্যালেন্স</div>
                        <div className="text-emerald-400 font-extrabold text-sm font-mono">৳{userBalance.toFixed(2)}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                        <div className="text-slate-500 text-[10px]">মোট</div>
                        <div className="font-bold text-white">{group.total}</div>
                      </div>
                      <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                        <div className="text-emerald-500 text-[10px]">অনুমোদিত</div>
                        <div className="font-bold text-emerald-400">{group.approved}</div>
                      </div>
                      <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                        <div className="text-amber-500 text-[10px]">পেন্ডিং</div>
                        <div className="font-bold text-amber-400">{group.pending}</div>
                      </div>
                      <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                        <div className="text-rose-500 text-[10px]">বাতিল</div>
                        <div className="font-bold text-rose-400">{group.rejected}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => setSelectedWorkerForDetails(group.worker)}
                        className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all"
                      >
                        বিস্তারিত দেখুন
                      </button>
                      <button
                        onClick={() => setSelectedWorkerForBalance(group.worker)}
                        className="px-3 py-2 bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white text-xs font-bold rounded-xl transition-all"
                      >
                        ব্যালেন্স এডজাস্ট
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* FB HOTMAIL SETTINGS TAB */}
      {fbHotmailSubTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-6 max-w-2xl">
          <div className="border-b border-slate-800 pb-4">
            <h4 className="font-bold text-white text-base flex items-center gap-2">
              <Settings size={18} className="text-amber-400" />
              <span>FB Hotmail সেটিংস ও রেট কনফিগারেশন</span>
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              টেলিগ্রাম বটে FB Hotmail কাজের সক্রিয়তা, রেট ও ডিফল্ট পাসওয়ার্ড নিয়ন্ত্রণ করুন।
            </p>
          </div>

          <div className="space-y-4">
            {/* Work Active Toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-800">
              <div>
                <span className="font-bold text-white text-sm block">FB Hotmail কাজ চালু / বন্ধ</span>
                <span className="text-xs text-slate-400">টেলিগ্রাম বটে মেম্বাররা FB Hotmail অপশনে ক্লিক করলে কাজ সাবমিট করতে পারবে কি না</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.fbHotmailWorkActive !== false}
                  onChange={(e) => setAppSettings(prev => ({ ...prev, fbHotmailWorkActive: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>

            {/* Rate Per ID */}
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <label className="text-xs font-bold text-slate-300 block uppercase tracking-wider">
                FB Hotmail রেট প্রতি অনুমোদিত আইডি (Taka):
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400 font-extrabold text-lg">৳</span>
                <input 
                  type="number"
                  step="any"
                  min="0"
                  value={settings.fbHotmailRatePerId !== undefined ? settings.fbHotmailRatePerId : 50}
                  onChange={(e) => setAppSettings(prev => ({ ...prev, fbHotmailRatePerId: parseFloat(e.target.value) || 0 }))}
                  className="w-full pl-9 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-emerald-400 font-extrabold text-lg outline-none focus:border-amber-500 font-mono"
                  placeholder="যেমন: 50 বা 6.5 বা 4.9"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                এই রেটটি বটে বাটন এবং নতুন কাজে প্রদর্শিত হবে। বাল্ক অনুমোদনের সময়ও আপনি তাৎক্ষণিক রেট পরিবর্তন করতে পারবেন।
              </p>
            </div>

            {/* Default Password */}
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <label className="text-xs font-bold text-slate-300 block uppercase tracking-wider">
                FB Hotmail ডিফল্ট পাসওয়ার্ড:
              </label>
              <input 
                type="text"
                value={settings.fbHotmailPassword || ''}
                onChange={(e) => setAppSettings(prev => ({ ...prev, fbHotmailPassword: e.target.value }))}
                placeholder="বটে মেম্বারদের জন্য সেট করা পাসওয়ার্ড"
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 text-sm outline-none focus:border-amber-500 font-mono"
              />
            </div>

            {/* First Name & Last Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <label className="text-xs font-bold text-slate-300 block uppercase tracking-wider">
                  ডিফল্ট First Name (ঐচ্ছিক):
                </label>
                <input 
                  type="text"
                  value={settings.fbHotmailFirstName || ''}
                  onChange={(e) => setAppSettings(prev => ({ ...prev, fbHotmailFirstName: e.target.value }))}
                  placeholder="যেমন: John"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 text-sm outline-none focus:border-amber-500"
                />
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <label className="text-xs font-bold text-slate-300 block uppercase tracking-wider">
                  ডিফল্ট Last Name (ঐচ্ছিক):
                </label>
                <input 
                  type="text"
                  value={settings.fbHotmailLastName || ''}
                  onChange={(e) => setAppSettings(prev => ({ ...prev, fbHotmailLastName: e.target.value }))}
                  placeholder="যেমন: Doe"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 text-sm outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {settingsStatus && (
            <div className={`p-3 rounded-xl text-xs font-medium ${
              settingsStatus.type === 'success' ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40' :
              settingsStatus.type === 'error' ? 'bg-rose-950/60 text-rose-300 border border-rose-800/40' :
              'bg-blue-950/60 text-blue-300 border border-blue-800/40'
            }`}>
              {settingsStatus.text}
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-amber-600/20 transition-all cursor-pointer"
            >
              💾 FB Hotmail সেটিংস সংরক্ষণ করুন
            </button>
          </div>
        </form>
      )}

      {/* CLEAR DATA TAB */}
      {fbHotmailSubTab === 'clear' && (
        <div className="bg-slate-900 border border-rose-900/50 p-6 rounded-2xl space-y-4 max-w-xl">
          <div className="flex items-center gap-3 text-rose-400">
            <AlertCircle size={24} />
            <h4 className="font-bold text-base text-white">বিপজ্জনক অঞ্চল: শুধুমাত্র FB Hotmail সাবমিশন ক্লিয়ার</h4>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            আপনি কি নিশ্চিত যে সকল FB Hotmail সাবমিশন ডাটা মুছে ফেলতে চান? এটি ফেসবুক বা ইনস্টাগ্রামের অন্যান্য ডাটা অক্ষত রাখবে।
          </p>

          <div className="space-y-2">
            <label className="text-xs text-slate-300 block">
              নিশ্চিত করতে নিচে <strong>"DELETE ALL SUBMISSIONS"</strong> লিখুন:
            </label>
            <input
              type="text"
              value={clearConfirmationText}
              onChange={(e) => setClearConfirmationText(e.target.value)}
              placeholder="DELETE ALL SUBMISSIONS"
              className="w-full px-4 py-2.5 bg-slate-950 border border-rose-900/50 rounded-xl text-xs text-rose-300 font-mono outline-none focus:border-rose-500"
            />
          </div>

          <button
            onClick={handleClearAllSubmissions}
            disabled={clearConfirmationText !== 'DELETE ALL SUBMISSIONS' || isClearingSubmissions}
            className="w-full py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/20 transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            {isClearingSubmissions ? 'মুছে ফেলা হচ্ছে...' : '⚠️ FB Hotmail সকল সাবমিশন মুছুন'}
          </button>
        </div>
      )}

      {/* BULK APPROVAL RATE MODAL */}
      <ApprovalRateModal
        isOpen={showBulkApproveModal}
        onClose={() => setShowBulkApproveModal(false)}
        onConfirm={(rate) => handleBulkSubAction('approved', rate)}
        itemCount={selectedSubIds.length}
        defaultRate={settings.fbHotmailRatePerId !== undefined ? settings.fbHotmailRatePerId : 50}
        categoryName="FB Hotmail"
        mode="approve"
      />

      {/* BULK PASTE APPROVE RATE MODAL */}
      <ApprovalRateModal
        isOpen={showPasteApproveModal}
        onClose={() => setShowPasteApproveModal(false)}
        onConfirm={(rate) => handleBulkPasteAction('approved', rate)}
        itemCount={parsedPastedCount || 1}
        defaultRate={settings.fbHotmailRatePerId !== undefined ? settings.fbHotmailRatePerId : 50}
        categoryName="FB Hotmail (পেস্টকৃত)"
        mode="approve"
      />

      {/* RE-RATE / ADJUST RATE MODAL */}
      {handleBulkRateUpdate && (
        <ApprovalRateModal
          isOpen={showReRateModal}
          onClose={() => setShowReRateModal(false)}
          onConfirm={(newRate) => handleBulkRateUpdate(selectedSubIds, newRate)}
          itemCount={selectedSubIds.length}
          defaultRate={settings.fbHotmailRatePerId !== undefined ? settings.fbHotmailRatePerId : 50}
          categoryName="FB Hotmail"
          title="সিলেক্টকৃত আইডির রেট পরিবর্তন"
          mode="adjust_rate"
        />
      )}

      {/* SINGLE SUBMISSION APPROVE MODAL */}
      {singleApproveTarget && (
        <ApprovalRateModal
          isOpen={!!singleApproveTarget}
          onClose={() => setSingleApproveTarget(null)}
          onConfirm={(rate) => {
            if (singleApproveTarget.id) {
              handleApproveRejectSub(singleApproveTarget.id, 'approved', rate);
            }
          }}
          itemCount={1}
          defaultRate={singleApproveTarget.rate !== undefined ? singleApproveTarget.rate : (settings.fbHotmailRatePerId !== undefined ? settings.fbHotmailRatePerId : 50)}
          categoryName={`FB Hotmail (${singleApproveTarget.username})`}
          mode="approve"
        />
      )}

      {/* User Details Modal */}
      {selectedWorkerForDetails && (
        <UserDetailsModal
          workerName={selectedWorkerForDetails}
          allSubmissions={allSubmissions}
          withdrawals={withdrawals}
          allProfiles={allProfiles}
          settings={settings}
          onClose={() => setSelectedWorkerForDetails(null)}
          calculateUserBalance={calculateUserBalance}
          handleAdjustUserBalance={handleAdjustUserBalance}
        />
      )}

      {/* Balance Adjust Modal */}
      {selectedWorkerForBalance && handleAdjustUserBalance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <h4 className="font-bold text-white text-sm">
              ব্যালেন্স এডজাস্ট: {selectedWorkerForBalance}
            </h4>
            <p className="text-xs text-slate-400">
              ব্যালেন্স বাড়াতে ধনাত্মক সংখ্যা (যেমন: 50) অথবা কমাতে ঋণাত্মক সংখ্যা (যেমন: -50) লিখুন।
            </p>
            <input
              type="number"
              step="any"
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              placeholder="পরিমাণ (টাকা)"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-sm outline-none focus:border-amber-500"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => { setSelectedWorkerForBalance(null); setAdjustAmount(''); }}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-lg"
              >
                বাতিল
              </button>
              <button
                onClick={async () => {
                  const amt = parseFloat(adjustAmount);
                  if (!isNaN(amt) && amt !== 0) {
                    await handleAdjustUserBalance(selectedWorkerForBalance, amt);
                    setSelectedWorkerForBalance(null);
                    setAdjustAmount('');
                  }
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg shadow-lg"
              >
                এডজাস্ট করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
