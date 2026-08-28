import React, { useState, useEffect } from 'react';
import { CheckCircle2, DollarSign, X, AlertCircle, Sparkles } from 'lucide-react';

interface ApprovalRateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (rate: number) => void;
  itemCount: number;
  defaultRate: number;
  categoryName: string;
  title?: string;
  mode?: 'approve' | 'adjust_rate';
}

export default function ApprovalRateModal({
  isOpen,
  onClose,
  onConfirm,
  itemCount,
  defaultRate,
  categoryName,
  title,
  mode = 'approve'
}: ApprovalRateModalProps) {
  const [rateInput, setRateInput] = useState<string>(String(defaultRate || 0));

  useEffect(() => {
    if (isOpen) {
      setRateInput(String(defaultRate !== undefined ? defaultRate : 45));
    }
  }, [isOpen, defaultRate]);

  if (!isOpen) return null;

  const currentRate = parseFloat(rateInput);
  const validRate = !isNaN(currentRate) && currentRate >= 0 ? currentRate : 0;
  const totalPayout = (itemCount * validRate).toFixed(2);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(currentRate) || currentRate < 0) return;
    onConfirm(validRate);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              mode === 'adjust_rate' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
            }`}>
              {mode === 'adjust_rate' ? <Sparkles size={20} /> : <CheckCircle2 size={20} />}
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                {title || (mode === 'adjust_rate' ? 'রেট পরিবর্তন নিশ্চিতকরণ' : 'বাল্ক অনুমোদন - রেট নির্ধারণ')}
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                {categoryName} • মোট {itemCount}টি আইডি নির্বাচিত
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div className="text-slate-300 text-sm leading-relaxed bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/80">
            {mode === 'adjust_rate' ? (
              <span>
                আপনি সিলেক্টকৃত <strong className="text-amber-400">{itemCount}টি</strong> আইডির রেট পরিবর্তন করতে চাচ্ছেন। প্রতিটি আইডির নতুন রেট কত টাকা নির্ধারণ করতে চান?
              </span>
            ) : (
              <span>
                আপনি সিলেক্টকৃত <strong className="text-emerald-400">{itemCount}টি</strong> আইডি অনুমোদন করতে চাচ্ছেন। প্রতিটি আইডির জন্য মেম্বারদের ওয়ালেটে কত টাকা রেটে যোগ করতে চান?
              </span>
            )}
          </div>

          {/* Rate Input Field */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              প্রতি আইডি অনুমোদন রেট (টাকা / Taka):
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400 font-extrabold text-xl">
                ৳
              </span>
              <input
                type="number"
                step="any"
                min="0"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                placeholder="যেমন: 4.9 বা 6.5"
                autoFocus
                className="w-full pl-10 pr-4 py-3.5 bg-slate-950 border-2 border-slate-700 focus:border-emerald-500 rounded-xl text-white font-extrabold text-2xl outline-none transition-all font-mono"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              দশমিক সংখ্যা (যেমন: 4.9, 6.5, 9.5) বা পূর্ণসংখ্যা উভয়ই গ্রহণযোগ্য।
            </p>
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-400 mr-1 font-semibold">কুইক সিলেক্ট:</span>
            {[4.9, 5, 6.5, 9.5, defaultRate].filter((v, i, a) => v !== undefined && a.indexOf(v) === i).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setRateInput(String(preset))}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                  parseFloat(rateInput) === preset
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                ৳{preset}
              </button>
            ))}
          </div>

          {/* Calculation Summary Box */}
          <div className="bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
            <div className="flex justify-between text-xs text-slate-400 font-medium">
              <span>মোট নির্বাচিত আইডি:</span>
              <span className="text-white font-bold">{itemCount} টি</span>
            </div>
            <div className="flex justify-between text-xs text-slate-400 font-medium">
              <span>নির্ধারিত রেট:</span>
              <span className="text-emerald-400 font-bold">৳{validRate} Taka</span>
            </div>
            <div className="border-t border-slate-800 pt-2 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-200">মেম্বারদের মোট প্রদেয় ব্যালেন্স:</span>
              <span className="text-base font-extrabold text-emerald-400 font-mono">৳{totalPayout} Taka</span>
            </div>
          </div>

          <div className="flex items-start gap-2 text-[11px] text-slate-400 bg-slate-950/30 p-2.5 rounded-lg border border-slate-800/50">
            <AlertCircle size={14} className="text-blue-400 shrink-0 mt-0.5" />
            <span>
              অনুমোদনের সাথে সাথে ডাটাবেজে প্রতিটি আইডির রেট ৳{validRate} টাকা সেট হবে এবং মেম্বারদের টেলিগ্রাম বটে সঠিক ব্যালেন্স আপডেট ও নোটিফিকেশন পৌঁছাবে।
            </span>
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors"
            >
              বাতিল (Cancel)
            </button>
            <button
              type="submit"
              disabled={isNaN(currentRate) || currentRate < 0}
              className={`px-5 py-2.5 text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 ${
                mode === 'adjust_rate'
                  ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {mode === 'adjust_rate' ? <Sparkles size={16} /> : <CheckCircle2 size={16} />}
              <span>
                {mode === 'adjust_rate' 
                  ? `হ্যাঁ, ৳${validRate} রেট আপডেট করুন`
                  : `হ্যাঁ, ৳${validRate} রেটেই অনুমোদন করুন`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
