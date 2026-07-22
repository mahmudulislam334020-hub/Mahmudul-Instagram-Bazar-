import React from 'react';
import { 
  Settings, 
  Send, 
  CheckCircle, 
  XCircle, 
  RefreshCw 
} from 'lucide-react';
import { AppSettings } from '../firebaseService';

export interface AdminBotProps {
  settings: AppSettings;
  setAppSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  handleSaveSettings: (e: React.FormEvent) => Promise<void>;
  settingsStatus: { type: 'success' | 'error' | 'saving', text: string } | null;
  handleDetectChatId: () => void;
  findingChatId: boolean;
  chatIdMessage: { type: 'success' | 'error' | 'info'; text: string } | null;
  broadcastMessageText: string;
  setBroadcastMessageText: (text: string) => void;
  handleSendBroadcast: (e: React.FormEvent) => Promise<void>;
  isBroadcasting: boolean;
  broadcastStatus: { type: 'success' | 'error' | 'sending'; text: string } | null;
}

export default function AdminBot({
  settings,
  setAppSettings,
  handleSaveSettings,
  settingsStatus,
  handleDetectChatId,
  findingChatId,
  chatIdMessage,
  broadcastMessageText,
  setBroadcastMessageText,
  handleSendBroadcast,
  isBroadcasting,
  broadcastStatus
}: AdminBotProps) {
  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl space-y-6">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Settings size={20} className="text-indigo-500" />
            <span>টেলিগ্রাম বট এবং সিস্টেম কনফিগারেশন (Bot Settings)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            এখানে আপনার টেলিগ্রাম বট, এডমিন পাসওয়ার্ড এবং নূন্যতম উইথড্র সীমা নির্ধারণ করতে পারেন।
          </p>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Minimum Withdraw Limit (Taka)</label>
              <input 
                type="number"
                value={settings.minWithdraw || 50}
                onChange={(e) => setAppSettings(prev => ({ ...prev, minWithdraw: parseFloat(e.target.value) || 0 }))}
                className="w-full bg-slate-950 border border-slate-800 px-4 py-3 rounded-lg text-slate-300 text-sm outline-none focus:border-indigo-500 transition-all"
              />
            </div>

            {/* Withdraw Activation/Deactivation Option */}
            <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl flex items-center justify-between mt-1">
              <div className="space-y-0.5">
                <span className="text-[11px] font-bold text-slate-300 block">টাকা উত্তোলন অপশন (Withdrawal Status)</span>
                <span className="text-[10px] text-slate-500 block">
                  {settings.withdrawalsEnabled !== false 
                    ? "🟢 বর্তমানে টাকা উত্তোলন সচল রয়েছে" 
                    : "🔴 বর্তমানে টাকা উত্তোলন সাময়িকভাবে বন্ধ রয়েছে"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAppSettings(prev => ({ ...prev, withdrawalsEnabled: prev.withdrawalsEnabled === false ? true : false }))}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${settings.withdrawalsEnabled !== false ? 'bg-emerald-600' : 'bg-slate-800'}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings.withdrawalsEnabled !== false ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </button>
            </div>
          </div>

          {/* Telegram token */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Telegram Bot Token</label>
            <input 
              type="text"
              placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQRsT"
              value={settings.telegramBotToken || ''}
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
                value={settings.telegramChatId || ''}
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

          {/* Telegram Webhook / Vercel / Render URL */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Server Webhook URL (Vercel / Render App URL)</label>
            <input 
              type="text"
              placeholder="e.g. https://your-app.vercel.app or https://your-app.onrender.com"
              value={settings.webhookUrl || ''}
              onChange={(e) => setAppSettings(prev => ({ ...prev, webhookUrl: e.target.value }))}
              className="w-full bg-slate-950 border border-slate-800 px-4 py-3 rounded-lg text-slate-300 text-sm outline-none focus:border-indigo-500 transition-all font-mono text-xs"
            />
            <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
              🚀 <b>ভার্সেল (Vercel) / রেন্ডার-এ ২৪/৭ ঘণ্টা বট সচল রাখার উপায়:</b> আপনার Vercel অ্যাপের মেইন ডোমেইন লিঙ্কটি এখানে দিন (যেমন: <code>https://your-app.vercel.app</code>)। সেটিংস সেভ করলেই টেলিগ্রাম বট <b>WebHook (ওয়েব হুক)</b> মোডে সেট হয়ে যাবে। এর ফলে আপনার ব্রাউজার বন্ধ থাকলেও বা আপনি এখানে না থাকলেও টেলিগ্রামে কোনো মেসেজ আসলেই ভার্সেল সার্ভার সাথে সাথে রেসপন্স করে ২৪/৭ অটো-রিপ্লাই দিবে!
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
              🔒 এডমিন প্যানেলে প্রবেশ করার সিকিউরিটি পাসওয়ার্ড। এটি ডাটাবেজে সুরক্ষিত থাকবে।
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

          {settingsStatus && (
            <div className={`p-4 rounded-xl border flex items-start gap-3 ${
              settingsStatus.type === 'success' 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 shadow-lg shadow-emerald-500/5' 
                : settingsStatus.type === 'error'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300 shadow-lg shadow-rose-500/5'
                : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300 border-dashed'
            }`}>
              {settingsStatus.type === 'success' && (
                <div className="p-1 bg-emerald-500/20 rounded-lg text-emerald-400 flex-shrink-0">
                  <CheckCircle size={18} />
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
            </div>
          )}

          <button 
            type="submit"
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all text-sm"
          >
            সেটিংস সংরক্ষণ করুন (Save Settings)
          </button>
        </form>
      </div>

      {/* TELEGRAM BULK BROADCAST */}
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl space-y-6">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Send size={20} className="text-indigo-400" />
            <span>বাল্ক মেসেজ ব্রডকাস্ট (Telegram Bulk Broadcast)</span>
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
              className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-slate-300 text-xs outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600 leading-relaxed"
            />
          </div>

          {broadcastStatus && (
            <div className={`p-4 rounded-xl border flex items-start gap-3 ${
              broadcastStatus.type === 'success' 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                : broadcastStatus.type === 'error'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300 animate-pulse border-dashed'
            }`}>
              <div className="flex-1 text-xs">
                <p className="font-bold uppercase tracking-wider mb-0.5">
                  {broadcastStatus.type === 'success' ? 'সফল হয়েছে!' : broadcastStatus.type === 'error' ? 'ব্যর্থ হয়েছে!' : 'মেসেজ পাঠানো হচ্ছে...'}
                </p>
                <p className="opacity-95 leading-relaxed">{broadcastStatus.text}</p>
              </div>
            </div>
          )}

          <button 
            type="submit"
            disabled={isBroadcasting}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-950/20 text-white font-bold rounded-xl shadow-lg transition-all text-sm flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed border border-indigo-600/30"
          >
            {isBroadcasting ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>মেসেজ পাঠানো হচ্ছে...</span>
              </>
            ) : (
              <>
                <Send size={16} />
                <span>সকল ইউজারকে মেসেজ পাঠান (Broadcast)</span>
              </>
            )}
          </button>
        </form>

        <div className="text-[11px] bg-slate-950 border border-slate-800/80 p-4 rounded-xl text-slate-400 leading-relaxed space-y-1.5">
          <span className="font-bold text-indigo-400 block mb-0.5">💡 ব্রডকাস্ট কীভাবে কাজ করে (Guide):</span>
          <p>১. আপনার টেলিগ্রাম বটের টোকেন সেটিংসের ওপরে সঠিকভাবে প্রদান করা থাকতে হবে।</p>
          <p>২. মেসেজ বক্সে আপনার কাঙ্ক্ষিত মেসেজ বা নোটিশটি টাইপ করুন। আপনি সাধারণ টেক্সট ছাড়াও HTML ফর্ম্যাটিং ট্যাগ ব্যবহার করতে পারেন।</p>
          <p>৩. এরপর 'সকল ইউজারকে মেসেজ পাঠান' বাটনে ক্লিক করলে সিস্টেম অটোমেটিকলি ডাটাবেজ থেকে সকল ব্যবহারকারীর চ্যাট আইডি সংগ্রহ করে এবং প্রতিটি ব্যবহারকারীকে পৃথক নোটিফিকেশন পাঠায়।</p>
        </div>
      </div>
    </div>
  );
}
