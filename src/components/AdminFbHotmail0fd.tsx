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

export interface AdminFbHotmail0fdProps {
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
  fbHotmail0fdSubTab: 'submissions' | 'summary' | 'settings' | 'clear';
  setFbHotmail0fdSubTab: React.Dispatch<React.SetStateAction<'submissions' | 'summary' | 'settings' | 'clear'>>;
  calculateUserBalance?: (workerName: string) => number;
  handleAdjustUserBalance?: (workerName: string, amount: number) => Promise<void>;
  handleBulkRateUpdate?: (targetIds: string[], newRate: number) => Promise<void>;
  allSubmissions?: Submission[];
  allProfiles?: UserProfile[];
}

export default function AdminFbHotmail0fd({
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
  fbHotmail0fdSubTab,
  setFbHotmail0fdSubTab,
  calculateUserBalance,
  handleAdjustUserBalance,
  handleBulkRateUpdate,
  allSubmissions = [],
  allProfiles = []
}: AdminFbHotmail0fdProps) {
  const [passwordFilter, setPasswordFilter] = useState('');
  const [exportStatusMode, setExportStatusMode] = useState<'pending' | 'all' | 'approved' | 'rejected'>('pending');
  const [customApprovalRate, setCustomApprovalRate] = useState<number>(settings.fbHotmail0fdRatePerId !== undefined ? settings.fbHotmail0fdRatePerId : 40);
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
    const defaultRate = settings.fbHotmail0fdRatePerId !== undefined ? settings.fbHotmail0fdRatePerId : 40;
    setCustomApprovalRate(defaultRate);
  }, [settings.fbHotmail0fdRatePerId]);

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

    const confirmMsg = `আপনি কি নিশ্চিত যে '${passwordFilter}' পাসওয়ার্ডযুক্ত সকল ${count}টি FB Hotmail 0fd আইডি স্থায়ীভাবে ডাটাবেজ থেকে মুছে ফেলতে চান?`;
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
        text: `✅ '${passwordFilter}' পাসওয়ার্ডের মোট ${count}টি FB Hotmail 0fd আইডি সফলভাবে মুছে ফেলা হয়েছে!`
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

  // Export filtered FB Hotmail 0fd submissions as Excel (CSV)
  const handleExportFilteredCSV = () => {
    if (exportSubmissionsList.length === 0) return;
    const headers = ["UID", "Password", "First Name", "Last Name", "Cookie", "Hotmail Full Token", "Rate (Taka)", "Submitted By", "Status", "Submitted At"];

    const rows = exportSubmissionsList.map(s => [
      s.username,
      s.password,
      s.firstName || "",
      s.lastName || "",
      s.cookie || "",
      s.hotmailToken || "",
      s.rate !== undefined ? s.rate : (settings.fbHotmail0fdRatePerId || 40),
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
    link.setAttribute("download", `fb_hotmail_0fd_${exportStatusMode}_ids${pwdTag}_${new Date().toLocaleDateString()}.csv`);
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
            <Mail size={22} className="text-emerald-400" />
            <span>Facebook Hotmaill 0fd cookie Control</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            টেলিগ্রাম বটে হটমেইল দিয়ে খোলা 0 ফ্রেন্ড (0fd) কুকি ও ফুল টোকেন কাজের অনুমোদন, রেট কনফিগারেশন এবং ডাটা ম্যানেজমেন্ট
          </p>
        </div>

        {/* Global Stats Badges */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800 text-center">
            <span className="text-[10px] uppercase text-slate-500 font-bold block">মোট 0fd আইডি</span>
            <span className="text-base font-extrabold text-white font-mono">{categoryFilteredSubmissions.length}</span>
          </div>
          <div className="bg-amber-950/40 px-3.5 py-2 rounded-xl border border-amber-800/40 text-center">
            <span className="text-[10px] uppercase text-amber-400 font-bold block">পেন্ডিং</span>
            <span className="text-base font-extrabold text-amber-400 font-mono">
              {categoryFilteredSubmissions.filter(s => s.status === 'pending').length}
            </span>
          </div>
          <div className="bg-emerald-950/40 px-3.5 py-2 rounded-xl border border-emerald-800/40 text-center">
            <span className="text-[10px] uppercase text-emerald-400 font-bold block">অনুমোদিত</span>
            <span className="text-base font-extrabold text-emerald-400 font-mono">
              {categoryFilteredSubmissions.filter(s => s.status === 'approved').length}
            </span>
          </div>
          <div className="bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800 text-center">
            <span className="text-[10px] uppercase text-slate-500 font-bold block">বর্তমান রেট</span>
            <span className="text-base font-extrabold text-emerald-400 font-mono">
              ৳{settings.fbHotmail0fdRatePerId !== undefined ? settings.fbHotmail0fdRatePerId : 40}
            </span>
          </div>
        </div>
      </div>

      {/* Sub Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
        <button
          onClick={() => setFbHotmail0fdSubTab('submissions')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap cursor-pointer ${
            fbHotmail0fdSubTab === 'submissions'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <List size={16} />
          <span>আইডি সাবমিশন তালিকা ({categoryFilteredSubmissions.length})</span>
        </button>

        <button
          onClick={() => setFbHotmail0fdSubTab('summary')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap cursor-pointer ${
            fbHotmail0fdSubTab === 'summary'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Users size={16} />
          <span>ওয়ার্কার সামারি ({categoryGroupedSubmissions.length})</span>
        </button>

        <button
          onClick={() => setFbHotmail0fdSubTab('settings')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap cursor-pointer ${
            fbHotmail0fdSubTab === 'settings'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Settings size={16} />
          <span>0fd কাজের রেট ও সেটিংস</span>
        </button>

        <button
          onClick={() => setFbHotmail0fdSubTab('clear')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap cursor-pointer ${
            fbHotmail0fdSubTab === 'clear'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20'
              : 'text-rose-400 hover:text-rose-300 hover:bg-rose-950/40'
          }`}
        >
          <Database size={16} />
          <span>ডাটা ক্লিয়ার</span>
        </button>
      </div>

      {/* SUBMISSIONS TAB CONTENT */}
      {fbHotmail0fdSubTab === 'submissions' && (
        <div className="space-y-6">
          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
            {/* Left Controls: Selection & Bulk Approve */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400 font-bold">
                সিলেক্টেড: <span className="text-white font-mono">{selectedSubIds.length}</span> টি
              </span>

              <button
                onClick={() => setShowBulkApproveModal(true)}
                disabled={selectedSubIds.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-600/20 cursor-pointer disabled:cursor-not-allowed"
              >
                <CheckCircle2 size={15} />
                <span>বাল্ক অনুমোদন (এডিটেবল রেট)</span>
              </button>

              <button
                onClick={() => handleBulkSubAction('rejected')}
                disabled={selectedSubIds.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-rose-600/20 cursor-pointer disabled:cursor-not-allowed"
              >
                <Trash2 size={15} />
                <span>বাল্ক বাতিল ({selectedSubIds.length})</span>
              </button>

              {handleBulkRateUpdate && (
                <button
                  onClick={() => setShowReRateModal(true)}
                  disabled={selectedSubIds.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/20 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Sparkles size={15} />
                  <span>রেট পরিবর্তন (Re-rate)</span>
                </button>
              )}
            </div>

            {/* Right Controls: Filter & Export */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Status Filter for Export */}
              <div className="flex items-center bg-slate-950 rounded-xl p-1 border border-slate-800">
                {(['pending', 'all', 'approved', 'rejected'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setExportStatusMode(mode)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize cursor-pointer ${
                      exportStatusMode === mode
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {mode === 'all' ? 'সকল' : mode === 'pending' ? 'পেন্ডিং' : mode === 'approved' ? 'অনুমোদিত' : 'বাতিল'}
                  </button>
                ))}
              </div>

              {/* Export Button */}
              <button
                onClick={handleExportFilteredCSV}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold border border-slate-700 transition-all cursor-pointer shadow-sm"
              >
                <FileSpreadsheet size={15} className="text-emerald-400" />
                <span>এক্সেল ডাউনলোড ({exportSubmissionsList.length})</span>
              </button>
            </div>
          </div>

          {/* Password Filter & Bulk Deletion Section */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Key size={18} className="text-emerald-400" />
                <h4 className="font-bold text-white text-xs uppercase tracking-wider">
                  পাসওয়ার্ড অনুযায়ী ফিল্টার ও বাল্ক ডিলিট
                </h4>
              </div>

              {passwordFilter && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-300">
                    ফিল্টারে প্রাপ্ত: <strong className="text-white font-mono">{displayedSubmissions.length}</strong> টি
                  </span>
                  <button
                    onClick={handleDeleteFilteredByPassword}
                    disabled={isBulkDeletingByPassword || displayedSubmissions.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600/80 hover:bg-rose-600 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm"
                  >
                    <Trash2 size={14} />
                    <span>এই পাসওয়ার্ডের সকল {displayedSubmissions.length}টি মুছুন</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={passwordFilter}
                  onChange={(e) => setPasswordFilter(e.target.value)}
                  placeholder="পাসওয়ার্ড লিখে সার্চ করুন..."
                  className="w-full pl-9 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-emerald-500 font-mono"
                />
                {passwordFilter && (
                  <button 
                    onClick={() => setPasswordFilter('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Quick Password Pills */}
              <div className="flex flex-wrap items-center gap-1.5 max-h-24 overflow-y-auto py-1">
                {passwordCounts.slice(0, 8).map(([pwd, cnt]) => (
                  <button
                    key={pwd}
                    onClick={() => setPasswordFilter(pwd === passwordFilter ? '' : pwd)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                      passwordFilter === pwd
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {pwd} <span className="opacity-60 text-[10px]">({cnt})</span>
                  </button>
                ))}
              </div>
            </div>

            {passwordActionResult && (
              <div className={`p-3 rounded-xl text-xs font-medium ${
                passwordActionResult.type === 'success' ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40' : 'bg-rose-950/60 text-rose-300 border border-rose-800/40'
              }`}>
                {passwordActionResult.text}
              </div>
            )}
          </div>

          {/* Paste List Approval Section */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                <List size={16} className="text-emerald-400" />
                <span>ইউআইডি বা ইউজারনেম লিস্ট পেস্ট করে অ্যাকশন (বাল্ক অ্যাপ্রুভ / রিজেক্ট)</span>
              </h4>
              {parsedPastedCount > 0 && (
                <span className="text-xs text-emerald-400 font-bold">
                  তালিকায় প্রাপ্ত: {parsedPastedCount} টি আইডি
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <textarea
                value={pastedUsernamesText}
                onChange={(e) => setPastedUsernamesText(e.target.value)}
                placeholder="একাধিক UID লাইন বাই লাইন অথবা স্পেস/কমা দিয়ে পেস্ট করুন..."
                rows={2}
                className="flex-1 p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-emerald-500 font-mono resize-y"
              />
              <div className="flex sm:flex-col gap-2 justify-end">
                <button
                  onClick={() => setShowPasteApproveModal(true)}
                  disabled={!pastedUsernamesText.trim() || parsedPastedCount === 0}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
                >
                  ✅ পেস্টকৃতগুলো অনুমোদন ({parsedPastedCount})
                </button>
                <button
                  onClick={() => handleBulkPasteAction('rejected')}
                  disabled={!pastedUsernamesText.trim() || parsedPastedCount === 0}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
                >
                  ❌ পেস্টকৃতগুলো বাতিল ({parsedPastedCount})
                </button>
              </div>
            </div>

            {bulkPasteResult && (
              <div className={`p-3 rounded-xl text-xs font-medium ${
                bulkPasteResult.type === 'success' ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40' : 'bg-rose-950/60 text-rose-300 border border-rose-800/40'
              }`}>
                {bulkPasteResult.text}
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
                        className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-emerald-600 cursor-pointer"
                      />
                    </th>
                    <th className="p-4">UID / একাউন্ট</th>
                    <th className="p-4">পাসওয়ার্ড & নাম</th>
                    <th className="p-4">Hotmail Full Token</th>
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
                      <td colSpan={9} className="p-8 text-center text-slate-500 font-medium">
                        কোনো Facebook Hotmaill 0fd সাবমিশন পাওয়া যায়নি।
                      </td>
                    </tr>
                  ) : (
                    displayedSubmissions.map((sub) => {
                      const isSelected = selectedSubIds.includes(sub.id || '');
                      const effectiveRate = sub.rate !== undefined ? sub.rate : (settings.fbHotmail0fdRatePerId || 40);

                      return (
                        <tr 
                          key={sub.id} 
                          className={`hover:bg-slate-800/40 transition-colors ${
                            isSelected ? 'bg-emerald-950/20' : ''
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
                              className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-emerald-600 cursor-pointer"
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
                            <div className="flex items-center gap-2 font-mono font-bold text-emerald-400">
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
                            {sub.hotmailToken ? (
                              <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded border border-slate-800 w-fit">
                                <span className="max-w-[130px] truncate text-emerald-300 font-bold">{sub.hotmailToken}</span>
                                <button
                                  onClick={() => copyToClipboard(sub.hotmailToken || '', `tok_${sub.id}`)}
                                  title="Hotmail Token কপি করুন"
                                  className="p-0.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                                >
                                  {copiedKey === `tok_${sub.id}` ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-600 italic">টোকেন নেই</span>
                            )}
                          </td>
                          <td className="p-4 font-mono text-xs">
                            {sub.cookie ? (
                              <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded border border-slate-800 w-fit">
                                <span className="max-w-[120px] truncate text-slate-400">{sub.cookie}</span>
                                <button
                                  onClick={() => copyToClipboard(sub.cookie || '', `ck_${sub.id}`)}
                                  title="Cookie কপি করুন"
                                  className="p-0.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                                >
                                  {copiedKey === `ck_${sub.id}` ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-600 italic">কুকি নেই</span>
                            )}
                          </td>
                          <td className="p-4 font-bold">
                            <span className="px-2 py-1 bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 rounded-md font-mono">
                              ৳{effectiveRate}
                            </span>
                            {sub.rate !== undefined && sub.rate !== (settings.fbHotmail0fdRatePerId || 40) && (
                              <span className="block text-[9px] text-amber-400 mt-0.5 font-normal">কাস্টম রেট</span>
                            )}
                          </td>
                          <td className="p-4">
                            <span className="font-mono text-slate-300 font-semibold">{sub.submittedBy}</span>
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                              sub.status === 'approved' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40' :
                              sub.status === 'rejected' ? 'bg-rose-950 text-rose-400 border border-rose-800/40' :
                              'bg-amber-950 text-amber-400 border border-amber-800/40'
                            }`}>
                              {sub.status === 'approved' ? 'অনুমোদিত' : sub.status === 'rejected' ? 'বাতিল' : 'পেন্ডিং'}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {sub.status !== 'approved' && (
                                <button
                                  onClick={() => setSingleApproveTarget(sub)}
                                  title="অনুমোদন করুন (রেট নির্ধারণসহ)"
                                  className="p-1.5 bg-emerald-600/80 hover:bg-emerald-500 text-white rounded-lg transition-colors cursor-pointer"
                                >
                                  <CheckCircle2 size={14} />
                                </button>
                              )}
                              {sub.status !== 'rejected' && (
                                <button
                                  onClick={() => sub.id && handleApproveRejectSub(sub.id, 'rejected')}
                                  title="বাতিল করুন"
                                  className="p-1.5 bg-rose-600/80 hover:bg-rose-500 text-white rounded-lg transition-colors cursor-pointer"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                              <button
                                onClick={() => sub.id && handleDeleteSub(sub.id)}
                                title="মুছে ফেলুন"
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
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

      {/* SUMMARY TAB CONTENT */}
      {fbHotmail0fdSubTab === 'summary' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={workerSearchQuery}
                onChange={(e) => setWorkerSearchQuery(e.target.value)}
                placeholder="ওয়ার্কার এর নাম বা ওয়ালেট দিয়ে খুঁজুন..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-emerald-500 font-mono"
              />
            </div>
            <span className="text-xs text-slate-400 font-bold">
              মোট ওয়ার্কার: <strong className="text-white font-mono">{categoryGroupedSubmissions.length}</strong> জন
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoryGroupedSubmissions.map((group) => {
              const workerBalance = calculateUserBalance ? calculateUserBalance(group.worker) : 0;
              return (
                <div 
                  key={group.worker} 
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 hover:border-slate-700 transition-all shadow-lg"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-950 border border-emerald-800/50 flex items-center justify-center text-emerald-400 font-bold font-mono text-xs">
                        {group.worker.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <span className="text-xs font-mono font-bold text-white block truncate max-w-[140px]">
                          {group.worker}
                        </span>
                        <span className="text-[10px] text-slate-500">FB Hotmail 0fd ওয়ার্কার</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedWorkerForDetails(group.worker)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      বিস্তারিত
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-950 p-2 rounded-xl border border-slate-800/80">
                      <span className="text-[10px] uppercase text-slate-500 block">মোট কাজ</span>
                      <span className="text-sm font-bold text-white font-mono">{group.total}</span>
                    </div>
                    <div className="bg-amber-950/30 p-2 rounded-xl border border-amber-800/30">
                      <span className="text-[10px] uppercase text-amber-400 block">পেন্ডিং</span>
                      <span className="text-sm font-bold text-amber-400 font-mono">{group.pending}</span>
                    </div>
                    <div className="bg-emerald-950/30 p-2 rounded-xl border border-emerald-800/30">
                      <span className="text-[10px] uppercase text-emerald-400 block">অনুমোদিত</span>
                      <span className="text-sm font-bold text-emerald-400 font-mono">{group.approved}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <div>
                      <span className="text-[10px] uppercase text-slate-500 font-bold block">বর্তমান ব্যালেন্স</span>
                      <span className="text-sm font-extrabold text-emerald-400 font-mono">৳{workerBalance}</span>
                    </div>

                    {handleAdjustUserBalance && (
                      <button
                        onClick={() => {
                          setSelectedWorkerForBalance(group.worker);
                          setAdjustAmount('');
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-950 border border-emerald-800/40 text-emerald-400 hover:bg-emerald-900/40 rounded-lg text-xs font-bold transition-all cursor-pointer"
                      >
                        <Wallet size={12} />
                        <span>এডজাস্ট</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* FB HOTMAIL 0FD SETTINGS TAB */}
      {fbHotmail0fdSubTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-6 max-w-2xl">
          <div className="border-b border-slate-800 pb-4">
            <h4 className="font-bold text-white text-base flex items-center gap-2">
              <Settings size={18} className="text-emerald-400" />
              <span>Facebook Hotmaill 0fd cookie সেটিংস ও রেট কনফিগারেশন</span>
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              টেলিগ্রাম বটে Facebook Hotmaill 0fd cookie কাজের সক্রিয়তা, রেট ও ডিফল্ট পাসওয়ার্ড নিয়ন্ত্রণ করুন।
            </p>
          </div>

          <div className="space-y-4">
            {/* Work Active Toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-800">
              <div>
                <span className="font-bold text-white text-sm block">0fd cookie কাজ চালু / বন্ধ</span>
                <span className="text-xs text-slate-400">টেলিগ্রাম বটে মেম্বাররা Facebook Hotmaill 0fd cookie অপশনে ক্লিক করলে কাজ সাবমিট করতে পারবে কি না</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.fbHotmail0fdWorkActive !== false}
                  onChange={(e) => setAppSettings(prev => ({ ...prev, fbHotmail0fdWorkActive: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* Rate Per ID */}
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <label className="text-xs font-bold text-slate-300 block uppercase tracking-wider">
                Facebook Hotmaill 0fd রেট প্রতি অনুমোদিত আইডি (Taka):
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400 font-extrabold text-lg">৳</span>
                <input 
                  type="number"
                  step="any"
                  min="0"
                  value={settings.fbHotmail0fdRatePerId !== undefined ? settings.fbHotmail0fdRatePerId : 40}
                  onChange={(e) => setAppSettings(prev => ({ ...prev, fbHotmail0fdRatePerId: parseFloat(e.target.value) || 0 }))}
                  className="w-full pl-9 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-emerald-400 font-extrabold text-lg outline-none focus:border-emerald-500 font-mono"
                  placeholder="যেমন: 40 বা 45"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                এই রেটটি বটে বাটন এবং নতুন কাজে প্রদর্শিত হবে। বাল্ক অনুমোদনের সময়ও আপনি তাৎক্ষণিক রেট পরিবর্তন করতে পারবেন।
              </p>
            </div>

            {/* Default Password */}
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <label className="text-xs font-bold text-slate-300 block uppercase tracking-wider">
                Facebook Hotmaill 0fd ডিফল্ট পাসওয়ার্ড:
              </label>
              <input 
                type="text"
                value={settings.fbHotmail0fdPassword || ''}
                onChange={(e) => setAppSettings(prev => ({ ...prev, fbHotmail0fdPassword: e.target.value }))}
                placeholder="বটে মেম্বারদের জন্য সেট করা পাসওয়ার্ড (ফাঁকা রাখলে অটো জেনারেট হবে)"
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 text-sm outline-none focus:border-emerald-500 font-mono"
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
                  value={settings.fbHotmail0fdFirstName || ''}
                  onChange={(e) => setAppSettings(prev => ({ ...prev, fbHotmail0fdFirstName: e.target.value }))}
                  placeholder="যেমন: Tanvir"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <label className="text-xs font-bold text-slate-300 block uppercase tracking-wider">
                  ডিফল্ট Last Name (ঐচ্ছিক):
                </label>
                <input 
                  type="text"
                  value={settings.fbHotmail0fdLastName || ''}
                  onChange={(e) => setAppSettings(prev => ({ ...prev, fbHotmail0fdLastName: e.target.value }))}
                  placeholder="যেমন: Ahmed"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 text-sm outline-none focus:border-emerald-500"
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
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
            >
              💾 Facebook Hotmaill 0fd সেটিংস সংরক্ষণ করুন
            </button>
          </div>
        </form>
      )}

      {/* CLEAR DATA TAB */}
      {fbHotmail0fdSubTab === 'clear' && (
        <div className="bg-slate-900 border border-rose-900/50 p-6 rounded-2xl space-y-4 max-w-xl">
          <div className="flex items-center gap-3 text-rose-400">
            <AlertCircle size={24} />
            <h4 className="font-bold text-base text-white">বিপজ্জনক অঞ্চল: শুধুমাত্র FB Hotmail 0fd সাবমিশন ক্লিয়ার</h4>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            আপনি কি নিশ্চিত যে সকল Facebook Hotmaill 0fd cookie সাবমিশন ডাটা মুছে ফেলতে চান? এটি ফেসবুক বা হটমেইল ৩০+ বা ইনস্টাগ্রামের অন্যান্য ডাটা অক্ষত রাখবে।
          </p>

          <div className="space-y-2">
            <label className="text-xs text-slate-300 block">
              নিশ্চিত করতে নিচে <strong>"CONFIRM"</strong> লিখুন:
            </label>
            <input
              type="text"
              value={clearConfirmationText}
              onChange={(e) => setClearConfirmationText(e.target.value)}
              placeholder="CONFIRM"
              className="w-full px-4 py-2.5 bg-slate-950 border border-rose-900/50 rounded-xl text-xs text-rose-300 font-mono outline-none focus:border-rose-500"
            />
          </div>

          <button
            onClick={handleClearAllSubmissions}
            disabled={(clearConfirmationText.toUpperCase() !== 'CONFIRM' && clearConfirmationText !== 'DELETE ALL SUBMISSIONS') || isClearingSubmissions}
            className="w-full py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/20 transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            {isClearingSubmissions ? 'মুছে ফেলা হচ্ছে...' : '⚠️ FB Hotmail 0fd সকল সাবমিশন মুছুন'}
          </button>
        </div>
      )}

      {/* BULK APPROVAL RATE MODAL */}
      <ApprovalRateModal
        isOpen={showBulkApproveModal}
        onClose={() => setShowBulkApproveModal(false)}
        onConfirm={(rate) => handleBulkSubAction('approved', rate)}
        itemCount={selectedSubIds.length}
        defaultRate={settings.fbHotmail0fdRatePerId !== undefined ? settings.fbHotmail0fdRatePerId : 40}
        categoryName="Facebook Hotmaill 0fd cookie"
        mode="approve"
      />

      {/* BULK PASTE APPROVE RATE MODAL */}
      <ApprovalRateModal
        isOpen={showPasteApproveModal}
        onClose={() => setShowPasteApproveModal(false)}
        onConfirm={(rate) => handleBulkPasteAction('approved', rate)}
        itemCount={parsedPastedCount || 1}
        defaultRate={settings.fbHotmail0fdRatePerId !== undefined ? settings.fbHotmail0fdRatePerId : 40}
        categoryName="Facebook Hotmaill 0fd cookie (পেস্টকৃত)"
        mode="approve"
      />

      {/* RE-RATE / ADJUST RATE MODAL */}
      {handleBulkRateUpdate && (
        <ApprovalRateModal
          isOpen={showReRateModal}
          onClose={() => setShowReRateModal(false)}
          onConfirm={(newRate) => handleBulkRateUpdate(selectedSubIds, newRate)}
          itemCount={selectedSubIds.length}
          defaultRate={settings.fbHotmail0fdRatePerId !== undefined ? settings.fbHotmail0fdRatePerId : 40}
          categoryName="Facebook Hotmaill 0fd cookie"
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
          defaultRate={singleApproveTarget.rate !== undefined ? singleApproveTarget.rate : (settings.fbHotmail0fdRatePerId !== undefined ? settings.fbHotmail0fdRatePerId : 40)}
          categoryName={`Facebook Hotmaill 0fd (${singleApproveTarget.username})`}
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
              ব্যালেন্স বাড়াতে ধনাত্মক সংখ্যা (যেমন: 40) অথবা কমাতে ঋণাত্মক সংখ্যা (যেমন: -40) লিখুন।
            </p>
            <input
              type="number"
              step="any"
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              placeholder="পরিমাণ (টাকা)"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-sm outline-none focus:border-emerald-500"
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
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-lg"
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
