import React from 'react';
import { 
  Facebook, 
  Download, 
  List, 
  Users, 
  Settings, 
  Database, 
  Trash2, 
  AlertCircle, 
  User 
} from 'lucide-react';
import { Submission, AppSettings, Withdrawal } from '../firebaseService';

export interface AdminFacebookProps {
  settings: AppSettings;
  setAppSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  categoryFilteredSubmissions: Submission[];
  categoryGroupedSubmissions: any[];
  selectedSubIds: string[];
  setSelectedSubIds: React.Dispatch<React.SetStateAction<string[]>>;
  pastedUsernamesText: string;
  setPastedUsernamesText: React.Dispatch<React.SetStateAction<string>>;
  bulkPasteResult: { type: 'success' | 'error', text: string } | null;
  handleBulkPasteAction: (action: 'approved' | 'rejected') => void;
  handleBulkSubAction: (action: 'approved' | 'rejected') => void;
  handleApproveRejectSub: (id: string, action: 'approved' | 'rejected') => void;
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
  fbSubTab: 'submissions' | 'summary' | 'settings' | 'clear';
  setFbSubTab: React.Dispatch<React.SetStateAction<'submissions' | 'summary' | 'settings' | 'clear'>>;
}

export default function AdminFacebook({
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
  fbSubTab,
  setFbSubTab
}: AdminFacebookProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Facebook size={20} className="text-blue-500" />
            <span>Facebook Control (ফেসবুক কন্ট্রোল)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            মোট {categoryFilteredSubmissions.length}টি ফেসবুক আইডি রেকর্ড রয়েছে। সেটিংস এবং অনুমোদন করুন।
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={handleExportCSV}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors border border-slate-700 text-slate-300"
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

      {/* SUB-TABS NAVIGATION */}
      <div className="flex border-b border-slate-800 gap-1 overflow-x-auto">
        <button
          onClick={() => setFbSubTab('submissions')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-t border-x whitespace-nowrap ${
            fbSubTab === 'submissions'
              ? 'bg-slate-900 border-slate-800 text-white border-t-blue-500'
              : 'bg-transparent border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <List size={14} />
          <span>ফেসবুক আইডি তালিকা ({categoryFilteredSubmissions.length})</span>
        </button>
        <button
          onClick={() => setFbSubTab('summary')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-t border-x whitespace-nowrap ${
            fbSubTab === 'summary'
              ? 'bg-slate-900 border-slate-800 text-white border-t-blue-500'
              : 'bg-transparent border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Users size={14} />
          <span>ইউজার ভিত্তিক সামারি ({categoryGroupedSubmissions.length})</span>
        </button>
        <button
          onClick={() => setFbSubTab('settings')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-t border-x whitespace-nowrap ${
            fbSubTab === 'settings'
              ? 'bg-slate-900 border-slate-800 text-white border-t-blue-500 font-bold'
              : 'bg-transparent border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Settings size={14} />
          <span>ফেসবুক কাজ সেটিংস (Settings)</span>
        </button>
        <button
          onClick={() => setFbSubTab('clear')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-t border-x whitespace-nowrap ${
            fbSubTab === 'clear'
              ? 'bg-slate-900 border-slate-800 text-white border-t-rose-500 font-bold text-rose-400'
              : 'bg-transparent border-transparent text-rose-500/70 hover:text-rose-400'
          }`}
        >
          <Database size={14} />
          <span>ডাটাবেজ ক্লিয়ার ও রিসেট ⚠️</span>
        </button>
      </div>

      {fbSubTab === 'submissions' && (
        <>
          {/* BULK USERNAME PASTE ACTIONS */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
                  পেস্টিং বাল্ক একশন (Bulk Username Paste Action)
                </h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  একসাথে অনেকগুলো ফেসবুক ইউজারনেম/ইউআইডি কপি করে এনে এখানে পেস্ট করে সরাসরি অনুমোদন বা বাতিল করতে পারেন।
                </p>
              </div>
              <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded font-bold border border-blue-500/15">অটো-টেলিগ্রাম নোটিফিকেশন ⚡</span>
            </div>

            <div className="space-y-3">
              <textarea
                rows={3}
                value={pastedUsernamesText}
                onChange={(e) => setPastedUsernamesText(e.target.value)}
                placeholder="এখানে ফেসবুক ইউজারনেম/ইউআইডিগুলো পেস্ট করুন (যেমন: 1000838392918239, 1000839291929344 অথবা স্পেস, কমা বা নতুন লাইনে আলাদা করে লিখুন)"
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
                    <th className="py-4 px-4">UID (Username)</th>
                    <th className="py-4 px-4">Password</th>
                    <th className="py-4 px-4">Name</th>
                    <th className="py-4 px-4">Cookie</th>
                    <th className="py-4 px-4">Worker</th>
                    <th className="py-4 px-4">Submitted At</th>
                    <th className="py-4 px-4 text-center">Status</th>
                    <th className="py-4 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {categoryFilteredSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-slate-500 text-sm">কোনো ফেসবুক আইডি রেকর্ড পাওয়া যায়নি।</td>
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

      {fbSubTab === 'summary' && (
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
                        <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-400">
                          <User size={18} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white flex items-center gap-2">
                            {group.worker}
                            <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full font-bold border border-blue-500/15">Facebook Worker</span>
                          </h4>
                          <p className="text-[10.5px] text-slate-400 mt-1">
                            মোট ফেসবুক আইডি সাবমিট করেছেন: <strong className="text-white">{group.total} টি</strong>
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
                        <h5 className="text-xs font-bold text-slate-300">সাবমিটকৃত ফেসবুক আইডির তালিকা:</h5>
                        <div className="overflow-x-auto rounded-xl border border-slate-800">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-950 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-800">
                                <th className="py-3 px-4">UID (Username)</th>
                                <th className="py-3 px-4">Password</th>
                                <th className="py-3 px-4">Name</th>
                                        <th className="py-3 px-4">Cookie</th>
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
                                  <td className="py-3.5 px-4 text-slate-300 text-xs font-semibold">{sub.firstName || ""} {sub.lastName || ""}</td>
                                  <td className="py-3.5 px-4 font-mono text-xs text-indigo-400 max-w-[150px] truncate" title={sub.cookie}>{sub.cookie}</td>
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

      {fbSubTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="space-y-4 pt-2 max-w-xl mx-auto">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white mb-1">ফেসবুক কাজ সেটিংস (Facebook Configs)</h3>
              <p className="text-xs text-slate-400">
                এখানে ফেসবুক প্রতি অনুমোদিত আইডির রেট, পাসওয়ার্ড এবং কাজ সচল বা বন্ধ রাখার তথ্য পরিবর্তন করুন।
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Facebook Rate Per Approved Account (Taka)</label>
                <input 
                  type="number"
                  value={settings.facebookRatePerId !== undefined ? settings.facebookRatePerId : 45}
                  onChange={(e) => setAppSettings(prev => ({ ...prev, facebookRatePerId: parseFloat(e.target.value) || 0 }))}
                  className="w-full bg-slate-950 border border-slate-800 px-4 py-3 rounded-lg text-slate-300 text-sm outline-none focus:border-indigo-500 transition-all"
                />
              </div>

              <div className="bg-slate-950 border border-slate-800/60 p-5 rounded-xl space-y-4">
                <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider">ফেসবুক বটের তথ্য (Facebook Bot Fields)</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">First Name (অটো বাংলাদেশী জেনারেট)</label>
                    <input 
                      type="text"
                      disabled
                      value="অটো বাংলাদেশী নাম জেনারেট"
                      className="w-full bg-slate-900/40 border border-slate-800 px-4 py-2.5 rounded-lg text-slate-500 text-sm outline-none cursor-not-allowed"
                      placeholder="Auto Generated"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Last Name (অটো বাংলাদেশী জেনারেট)</label>
                    <input 
                      type="text"
                      disabled
                      value="অটো বাংলাদেশী নাম জেনারেট"
                      className="w-full bg-slate-900/40 border border-slate-800 px-4 py-2.5 rounded-lg text-slate-500 text-sm outline-none cursor-not-allowed"
                      placeholder="Auto Generated"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Facebook Password</label>
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
                  </div>
                  <button 
                    type="button"
                    onClick={() => setAppSettings(prev => ({ ...prev, facebookWorkActive: prev.facebookWorkActive === false ? true : false }))} 
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all shrink-0 ${settings.facebookWorkActive !== false ? 'bg-blue-600' : 'bg-slate-800'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-all ${settings.facebookWorkActive !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
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
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg transition-all text-sm"
            >
              ফেসবুক সেটিংস সংরক্ষণ করুন (Save Facebook Settings)
            </button>
          </div>
        </form>
      )}

      {fbSubTab === 'clear' && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-6">
          {/* Warning Header */}
          <div className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-xl flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400 border border-rose-500/20 shrink-0">
              <AlertCircle size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">বিপজ্জনক অঞ্চল (Danger Zone) — ফেসবুক ডাটা ক্লিয়ার</h4>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                এখানে থাকা অপশনগুলো ব্যবহার করে ডাটাবেজের ফেসবুক রেকর্ড চিরতরে মুছে ফেলা সম্ভব। এই অ্যাকশন সম্পূর্ণ অপরিবর্তনশীল (Irreversible)। অনুগ্রহ করে সতর্কতার সাথে সিদ্ধান্ত নিন।
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
                  ফেসবুক সাবমিশন ক্লিয়ার
                </h5>
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                  ডাটাবেজের সকল ফেসবুক আইডি সাবমিশন রেকর্ড (মোট {categoryFilteredSubmissions.length}টি) মুছে ফেলে সম্পূর্ণ শূন্য করে দেওয়া হবে।
                </p>
              </div>
              <button
                onClick={handleClearAllSubmissions}
                disabled={clearConfirmationText !== 'CONFIRM' || isClearingSubmissions}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-950/20 text-white disabled:text-rose-800/60 font-bold text-xs rounded-lg transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed border border-rose-600/30"
              >
                {isClearingSubmissions ? 'মুছে ফেলা হচ্ছে...' : 'সব ফেসবুক সাবমিশন মুছুন ❌'}
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
    </div>
  );
}
