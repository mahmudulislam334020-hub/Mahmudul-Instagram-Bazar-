import _TelegramBot from "node-telegram-bot-api";

const TelegramBot = (typeof _TelegramBot === "function"
  ? _TelegramBot
  : (_TelegramBot as any).default) as typeof _TelegramBot;

type TelegramBot = _TelegramBot;
import crypto from "crypto";
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { db } from "./firebase";
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  collection, 
  getDocs, 
  addDoc, 
  query, 
  where,
  limit
} from "firebase/firestore";
import { 
  calculateLeaderboardForPassword, 
  detectPreviousPasswords, 
  maskWorkerId, 
  LeaderboardRound 
} from "./firebaseService";

interface BotState {
  step: 
    | 'main_menu' 
    | 'awaiting_instagram_2fa_key' 
    | 'awaiting_withdraw_balance_type'
    | 'awaiting_withdraw_method'
    | 'awaiting_withdraw_number'
    | 'awaiting_withdraw_amount'
    | 'awaiting_independent_2fa_key'
    | 'awaiting_facebook_uid'
    | 'awaiting_facebook_cookie'
    | 'awaiting_facebook_complete'
    | 'awaiting_fb_hotmail_uid'
    | 'awaiting_fb_hotmail_cookie'
    | 'awaiting_fb_hotmail_2fa'
    | 'awaiting_fb_hotmail_token'
    | 'awaiting_fb_hotmail_complete'
    | 'awaiting_fb_hotmail_0fd_uid'
    | 'awaiting_fb_hotmail_0fd_cookie'
    | 'awaiting_fb_hotmail_0fd_token'
    | 'awaiting_fb_hotmail_0fd_complete'
    | 'awaiting_admin_broadcast_message'
    | 'awaiting_admin_broadcast_confirm';
  broadcastData?: {
    type: 'text' | 'photo';
    text: string;
    photoFileId?: string;
  };
  instagramData?: {
    username?: string;
    password?: string;
    twoFactorKey?: string;
    credentialMsgId?: number; // Message containing the auto username/password
    promptMsgId?: number;     // Message requesting 2FA or displaying TOTP
  };
  withdrawData?: {
    balanceType?: 'main' | 'referral';
    method?: 'bKash' | 'Nagad' | 'Rocket';
    number?: string;
  };
  facebookData?: {
    firstName?: string;
    lastName?: string;
    password?: string;
    uid?: string;
    cookie?: string;
    promptMsgId?: number;
  };
  fbHotmailData?: {
    firstName?: string;
    lastName?: string;
    password?: string;
    uid?: string;
    cookie?: string;
    twoFactorKey?: string;
    hotmailToken?: string;
    promptMsgId?: number;
  };
  fbHotmail0fdData?: {
    firstName?: string;
    lastName?: string;
    password?: string;
    uid?: string;
    cookie?: string;
    hotmailToken?: string;
    promptMsgId?: number;
  };
}

const userStates = new Map<number, BotState>();

// --- Helper: Base32 decoding and TOTP code generation ---
function base32ToBytes(base32: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = base32.toUpperCase().replace(/[\s-]/g, "");
  let bits = "";
  for (let i = 0; i < cleaned.length; i++) {
    const val = alphabet.indexOf(cleaned[i]);
    if (val === -1) {
      if (cleaned[i] === '=') continue;
      throw new Error(`Invalid base32 character: ${cleaned[i]}`);
    }
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateTOTP(secret: string): string {
  try {
    const key = base32ToBytes(secret);
    const epoch = Math.floor(Date.now() / 1000);
    const counter = Math.floor(epoch / 30);
    
    const buffer = Buffer.alloc(8);
    let tempCounter = counter;
    for (let i = 7; i >= 0; i--) {
      buffer[i] = tempCounter & 0xff;
      tempCounter = Math.floor(tempCounter / 256);
    }
    
    const hmac = crypto.createHmac("sha1", key).update(buffer).digest();
    const offset = hmac[hmac.length - 1] & 0xf;
    const code =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);
    
    return (code % 1000000).toString().padStart(6, "0");
  } catch (err) {
    console.error("Error generating TOTP:", err);
    return "INVALID_KEY";
  }
}

// --- Helper: Prefixless Username Generator ---
function generatePrefixlessUsername(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// --- Helper: Bangladeshi Name Generator ---
function generateBangladeshiName(): { firstName: string; lastName: string } {
  const firstNames = [
    "Robin", "Hasan", "Arif", "Jamil", "Shakil", "Rakib", "Sourav", "Naim", "Fahim", 
    "Sajjad", "Tamim", "Rony", "Hridoy", "Sabbir", "Akash", "Amit", "Mehedi", "Tanvir", 
    "Imran", "Joy", "Shuvo", "Yeasin", "Rifat", "Asif", "Sifat", "Alamin", "Sajib", 
    "Rasel", "Monir", "Babu", "Manik", "Milon", "Rubel", "Sohel", "Rana", "Sumon", 
    "Sujon", "Ripon", "Jewel", "Pavel", "Shimul", "Palash", "Shanto", "Rashed", 
    "Ashik", "Anik", "Opu", "Salman", "Nayem", "Emon", "Jihad", "Siam", "Shihab", 
    "Mahfuz", "Kamrul", "Masud", "Tareq", "Zahid", "Said", "Farhan", "Arman", 
    "Saikat", "Shuvro", "Niloy", "Ariful", "Saiful", "Ashraful", "Shariful", "Rafiqul", 
    "Shafiqul", "Aminul", "Mizanur", "Atiar", "Habibur", "Mostafizur", "Anisur", "Rezaul", 
    "Jahangir", "Alamgir", "Shahadat", "Shahin", "Liton", "Polash", "Sadek", "Jafar", 
    "Iqbal", "Mainul"
  ];

  const lastNames = [
    "Khan", "Ahmed", "Rahman", "Islam", "Hasan", "Chowdhury", "Hossain", "Ali", 
    "Sheikh", "Uddin", "Sarkar", "Bhowmick", "Sen", "Das", "Roy", "Sikder", 
    "Talukder", "Patwary", "Mazumder", "Bhuiyan", "Molla", "Akand", "Halder", 
    "Ghorami", "Kazi", "Mia", "Miah", "Munshi", "Dewan", "Prodhan", "Joarder", 
    "Pramanik", "Mondal", "Gain", "Biswas", "Ghosh", "Banik", "Paul", "Sutradhar", 
    "Karmakar", "Basak", "Saha", "Karim", "Alam", "Zaman", "Sharkar", "Sharker", 
    "Khondokar", "Kabir", "Mahmud", "Munna", "Gazi", "Haque", "Howlader", "Farazi", 
    "Matubbar", "Sarder"
  ];

  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];

  return { firstName, lastName };
}

// --- Helper: Credential Generator ---
function generateInstagramCreds(prefix?: string, dailyPassword?: string) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let username = "";
  for (let i = 0; i < 10; i++) {
    username += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  let password = "";
  if (dailyPassword) {
    password = dailyPassword;
  } else {
    const passChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#%*";
    for (let i = 0; i < 10; i++) {
      password += passChars[Math.floor(Math.random() * passChars.length)];
    }
  }
  return { username, password };
}

let cachedSettings: any = null;
let cachedSettingsTime = 0;

export function invalidateSettingsCache() {
  cachedSettings = null;
  cachedSettingsTime = 0;
}

export async function getGlobalSettings(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedSettings && (now - cachedSettingsTime < 120000)) { // 2 minutes TTL
    return cachedSettings;
  }
  try {
    const settingsRef = doc(db, "settings", "global");
    const settingsSnap = await getDoc(settingsRef);
    if (settingsSnap.exists()) {
      cachedSettings = settingsSnap.data();
      cachedSettingsTime = now;
      return cachedSettings;
    }
  } catch (err: any) {
    if (cachedSettings) return cachedSettings;
    if (err?.message?.includes("Quota limit exceeded") || err?.message?.includes("quota")) {
      console.warn("[Quota Limit] Using fallback settings for Telegram Bot.");
    } else {
      console.warn("Notice fetching global settings:", err?.message || err);
    }
  }
  return cachedSettings || { ratePerId: 45, facebookRatePerId: 45, instagramRatePerId: 45 };
}

const userStatsCache = new Map<string, { data: any; time: number }>();
const profileInMemoryCache = new Map<string, { profile: any; time: number }>();

export function invalidateProfileCache(chatId?: string) {
  if (chatId) {
    profileInMemoryCache.delete(String(chatId));
  } else {
    profileInMemoryCache.clear();
  }
}

export function invalidateUserStatsCache(key?: string) {
  if (key) {
    userStatsCache.delete(key);
  } else {
    userStatsCache.clear();
  }
}

// --- Helper: Fetch user statistics ---
async function getUserStats(walletNumber?: string, telegramChatId?: string) {
  const cacheKey = `${walletNumber || ''}_${telegramChatId || ''}`;
  const cached = userStatsCache.get(cacheKey);
  const now = Date.now();
  if (cached && (now - cached.time < 30000)) { // 30 seconds TTL cache
    return cached.data;
  }

  try {
    const settings = await getGlobalSettings();
    const ratePerId = settings.ratePerId || 45;
    const facebookRatePerId = settings.facebookRatePerId !== undefined ? settings.facebookRatePerId : ratePerId;
    const fbHotmailRatePerId = settings.fbHotmailRatePerId !== undefined ? settings.fbHotmailRatePerId : (facebookRatePerId || ratePerId);
    const fbHotmail0fdRatePerId = settings.fbHotmail0fdRatePerId !== undefined ? settings.fbHotmail0fdRatePerId : (fbHotmailRatePerId || facebookRatePerId || ratePerId);

    const submissionsRef = collection(db, "submissions");
    const uniqueSubmissions = new Map<string, any>();

    // Fetch user profiles to gather all linked IDs (walletNumber, telegramChatId, payoutNumber)
    const profilesRef = collection(db, "profiles");
    const matchingProfilesMap = new Map<string, any>();

    if (walletNumber) {
      try {
        const pDoc = await getDoc(doc(db, "profiles", walletNumber));
        if (pDoc.exists()) matchingProfilesMap.set(pDoc.id, pDoc.data());
      } catch (e) {}

      try {
        const q1 = query(profilesRef, where("walletNumber", "==", walletNumber));
        const s1 = await getDocs(q1);
        s1.forEach(d => matchingProfilesMap.set(d.id, d.data()));
      } catch (e) {}

      try {
        const q2 = query(profilesRef, where("payoutNumber", "==", walletNumber));
        const s2 = await getDocs(q2);
        s2.forEach(d => matchingProfilesMap.set(d.id, d.data()));
      } catch (e) {}
    }

    if (telegramChatId) {
      try {
        const q3 = query(profilesRef, where("telegramChatId", "==", String(telegramChatId)));
        const s3 = await getDocs(q3);
        s3.forEach(d => matchingProfilesMap.set(d.id, d.data()));
      } catch (e) {}
    }

    const matchingProfiles = Array.from(matchingProfilesMap.values());
    const searchIds = new Set<string>();
    if (walletNumber) searchIds.add(walletNumber);
    if (telegramChatId) searchIds.add(String(telegramChatId));

    matchingProfiles.forEach(pData => {
      if (pData?.walletNumber) searchIds.add(pData.walletNumber);
      if (pData?.telegramChatId) searchIds.add(String(pData.telegramChatId));
      if (pData?.payoutNumber) searchIds.add(pData.payoutNumber);
    });

    for (const sid of Array.from(searchIds)) {
      if (!sid) continue;
      try {
        const q1 = query(submissionsRef, where("submittedBy", "==", sid));
        const snap1 = await getDocs(q1);
        snap1.forEach(docSnap => {
          uniqueSubmissions.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
        });
      } catch (e) {}

      try {
        const q2 = query(submissionsRef, where("telegramChatId", "==", sid));
        const snap2 = await getDocs(q2);
        snap2.forEach(docSnap => {
          uniqueSubmissions.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
        });
      } catch (e) {}
    }

    const userSubmissions = Array.from(uniqueSubmissions.values());

    const approvedCount = userSubmissions.filter(s => s.status === "approved").length;
    const pendingCount = userSubmissions.filter(s => s.status === "pending").length;
    const rejectedCount = userSubmissions.filter(s => s.status === "rejected").length;

    // Fetch extra preserved earnings & bonus balance from ALL matching user profiles in Firestore
    let extraEarnings = 0;
    matchingProfiles.forEach(p => {
      extraEarnings += (p.accumulatedApprovedEarnings || 0) + (p.bonusBalance || 0);
    });

    // Calculate rate based on category
    const activeEarned = userSubmissions
      .filter(s => s.status === "approved")
      .reduce((sum, s) => {
        if (s.rate !== undefined && s.rate > 0) {
          return sum + s.rate;
        }
        const isFbHotmail0fd = s.category === "fb_hotmail_0fd";
        const isFbHotmail = s.category === "fb_hotmail";
        const isFacebook = s.category === "facebook";
        const rate = isFbHotmail0fd
          ? (fbHotmail0fdRatePerId || fbHotmailRatePerId || facebookRatePerId || ratePerId || 40)
          : (isFbHotmail 
            ? (fbHotmailRatePerId || facebookRatePerId || ratePerId || 45)
            : (isFacebook ? (facebookRatePerId || ratePerId || 45) : (ratePerId || 45)));
        return sum + rate;
      }, 0);

    const totalEarned = activeEarned + extraEarnings;

    // Fetch withdrawals for this user (by telegramChatId and/or walletNumber)
    const withdrawalsRef = collection(db, "withdrawals");
    const uniqueWithdrawals = new Map<string, any>();

    if (telegramChatId) {
      try {
        const wQuery1 = query(withdrawalsRef, where("telegramChatId", "==", String(telegramChatId)));
        const wSnap1 = await getDocs(wQuery1);
        wSnap1.forEach(docSnap => {
          uniqueWithdrawals.set(docSnap.id, docSnap.data());
        });
      } catch (e) {}
    }

    if (walletNumber) {
      try {
        const wQuery2 = query(withdrawalsRef, where("submittedBy", "==", walletNumber));
        const wSnap2 = await getDocs(wQuery2);
        wSnap2.forEach(docSnap => {
          uniqueWithdrawals.set(docSnap.id, docSnap.data());
        });
      } catch (e) {}
    }

    const withdrawals = Array.from(uniqueWithdrawals.values());

    // Fetch referral stats & commission from ALL matching user profiles in Firestore
    let rawReferralBalance = 0;
    let totalReferrals = 0;
    const processedRefProfiles = new Set<string>();

    matchingProfiles.forEach(p => {
      const pKey = p.walletNumber || p.telegramChatId || p.payoutNumber;
      if (pKey && !processedRefProfiles.has(pKey)) {
        processedRefProfiles.add(pKey);
        rawReferralBalance += (p.referralBalance || 0);
        totalReferrals += (p.totalReferrals || 0);
      }
    });

    // Calculate percentage commission earned from referred users' approved work
    let referredWorkEarnings = 0;
    const referralCommissionPercent = settings.referralCommissionPercent !== undefined ? settings.referralCommissionPercent : 10;

    for (const sid of Array.from(searchIds)) {
      if (!sid) continue;
      try {
        const refUsersQuery = query(profilesRef, where("referredBy", "==", sid));
        const refUsersSnap = await getDocs(refUsersQuery);
        
        for (const refDoc of refUsersSnap.docs) {
          const refUserData = refDoc.data();
          const refUserIds = new Set<string>();
          if (refUserData.telegramChatId) refUserIds.add(String(refUserData.telegramChatId));
          if (refUserData.walletNumber) refUserIds.add(refUserData.walletNumber);
          if (refUserData.payoutNumber) refUserIds.add(refUserData.payoutNumber);

          for (const rId of Array.from(refUserIds)) {
            if (!rId) continue;
            try {
              const refSubQuery = query(submissionsRef, where("submittedBy", "==", rId), where("status", "==", "approved"));
              const refSubSnap = await getDocs(refSubQuery);
              refSubSnap.forEach(sDoc => {
                const sData = sDoc.data();
                const sRate = sData.rate !== undefined ? sData.rate : (sData.category === 'fb_hotmail_0fd' ? (fbHotmail0fdRatePerId || fbHotmailRatePerId || facebookRatePerId || ratePerId || 40) : (sData.category === 'fb_hotmail' ? (fbHotmailRatePerId || facebookRatePerId || ratePerId || 45) : (sData.category === 'facebook' ? (facebookRatePerId || ratePerId || 45) : (ratePerId || 45))));
                referredWorkEarnings += sRate;
              });
            } catch (e) {}
          }
        }
      } catch (refErr) {
        console.error("Error calculating referral commission:", refErr);
      }
    }

    const referralCommissionEarned = Math.round(referredWorkEarnings * (referralCommissionPercent / 100));
    const totalRawReferralBalance = rawReferralBalance + referralCommissionEarned;

    const approvedMainWithdrawn = withdrawals
      .filter(w => w.status === "approved" && w.balanceType !== "referral")
      .reduce((sum, current) => sum + current.amount, 0);

    const pendingMainWithdrawn = withdrawals
      .filter(w => w.status === "pending" && w.balanceType !== "referral")
      .reduce((sum, current) => sum + current.amount, 0);

    const approvedReferralWithdrawn = withdrawals
      .filter(w => w.status === "approved" && w.balanceType === "referral")
      .reduce((sum, current) => sum + current.amount, 0);

    const pendingReferralWithdrawn = withdrawals
      .filter(w => w.status === "pending" && w.balanceType === "referral")
      .reduce((sum, current) => sum + current.amount, 0);

    const mainBalance = Math.max(0, totalEarned - approvedMainWithdrawn - pendingMainWithdrawn);
    const referralBalance = Math.max(0, totalRawReferralBalance - approvedReferralWithdrawn - pendingReferralWithdrawn);

    const statsData = {
      approvedCount,
      pendingCount,
      rejectedCount,
      totalEarned,
      approvedWithdrawn: approvedMainWithdrawn,
      pendingWithdrawn: pendingMainWithdrawn,
      approvedReferralWithdrawn,
      pendingReferralWithdrawn,
      balance: mainBalance,
      referralBalance,
      rawReferralBalance,
      totalReferrals,
      ratePerId
    };

    userStatsCache.set(cacheKey, { data: statsData, time: now });
    return statsData;
  } catch (err: any) {
    if (cached) {
      return cached.data;
    }
    if (err?.message?.includes("Quota limit exceeded") || err?.message?.includes("quota")) {
      throw new Error("Quota limit exceeded");
    }
    throw err;
  }
}

// --- Helper: Safe Message Deletion ---
async function safeDeleteMessage(bot: TelegramBot, chatId: number, messageId: number | undefined) {
  if (!messageId) return;
  try {
    await bot.deleteMessage(chatId, messageId);
  } catch (err) {
    console.warn(`Could not delete message ${messageId}:`, err);
  }
}

async function cleanUpInstagramMessages(bot: TelegramBot, chatId: number, state: BotState | undefined) {
  if (state?.instagramData) {
    await safeDeleteMessage(bot, chatId, state.instagramData.credentialMsgId);
  }
}


// --- View Renderers with Bottom Keyboard Markup ---
export function formatLeaderboardMessage(round: LeaderboardRound | undefined, settings: any, profile?: any, chatId?: number): string {
  // Check which categories are enabled in settings / work active
  const enabledCats = settings?.leaderboardEnabledCategories || ['facebook', 'fb_hotmail'];
  
  const lines: string[] = [];
  if (enabledCats.includes('facebook') && settings?.facebookWorkActive !== false) {
    lines.push(`• FB Cookie: <code>${settings?.facebookPassword || "নির্ধারিত নয়"}</code>`);
  }
  if (enabledCats.includes('fb_hotmail') && settings?.fbHotmailWorkActive !== false) {
    lines.push(`• FB Hotmail 30+fd: <code>${settings?.fbHotmailPassword || "নির্ধারিত নয়"}</code>`);
  }
  if (enabledCats.includes('fb_hotmail_0fd') && settings?.fbHotmail0fdWorkActive !== false) {
    lines.push(`• FB Hotmail 0fd: <code>${settings?.fbHotmail0fdPassword || "নির্ধারিত নয়"}</code>`);
  }
  if (enabledCats.includes('instagram') && settings?.instagramWorkActive !== false) {
    lines.push(`• Instagram: <code>${settings?.dailyPassword || "নির্ধারিত নয়"}</code>`);
  }
  const runningPwdBlock = lines.length > 0 ? lines.join("\n") : "• বর্তমানে সব কাজ বিরতিতে আছে";

  const bonusNotice = settings?.leaderboardBonusNotice?.trim() || 
    (settings?.leaderboardMinRequiredIds 
      ? `বোনাস পেতে হলে কমপক্ষে ${settings.leaderboardMinRequiredIds}টি আইডি জমা করতে হবে`
      : "বোনাস পেতে হলে কমপক্ষে ৬০টি আইডি জমা করতে হবে");

  const bonusNoticeBlock = `🎁 <b>বোনাস নোটিশ:</b> <i>${bonusNotice}</i>`;

  if (!round || !round.winners || round.winners.length === 0) {
    return `🏆 <b>সেরা কর্মী লিডারবোর্ড (Leaderboard)</b>\n\n` +
           `🔑 <b>বর্তমান রানিং পাসওয়ার্ড:</b>\n` +
           `${runningPwdBlock}\n\n` +
           `━━━━━━━━━━━━━━━━━━━━━\n` +
           `${bonusNoticeBlock}\n` +
           `━━━━━━━━━━━━━━━━━━━━━\n\n` +
           `⏳ <i>এই পাসওয়ার্ডের রাউন্ড শেষ হলে এবং নতুন পাসওয়ার্ড শুরু হলে স্বয়ংক্রিয়ভাবে আগের পাসওয়ার্ডের সেরা ৩ জন কর্মীকে এখানে দেখতে পাবেন।</i>\n\n` +
           `🔥 দ্রুত কাজ জমা দিয়ে সেরা ৩ জনের মধ্যে নিজের জায়গা করে নিন!`;
  }

  const winnerIcons = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
  const winnersList = round.winners.slice(0, 3).map((w, idx) => {
    const icon = winnerIcons[idx] || "⭐";
    const masked = maskWorkerId(w.maskedWorker || w.workerId || "");
    return `${icon} <b>${idx + 1}ম স্থান:</b> <code>${masked}</code> — <b>${w.count}টি কাজ</b>`;
  }).join("\n");

  let userRankText = "";
  if (!round.isManual && (profile?.walletNumber || profile?.telegramChatId || chatId)) {
    const myWallet = (profile?.walletNumber || "").trim();
    const myChat = String(profile?.telegramChatId || chatId || "");
    const myWinner = round.winners.find(w => w.workerId === myWallet || w.workerId === myChat);
    if (myWinner) {
      userRankText = `\n👤 <b>আপনার অবস্থান:</b> #${myWinner.rank} (${myWinner.count}টি কাজ)\n`;
    }
  }

  const categoryName = round.category === "facebook" ? "ফেসবুক (Facebook)" 
    : round.category === "fb_hotmail" ? "FB Hotmail 30+fd" 
    : round.category === "fb_hotmail_0fd" ? "FB Hotmail 0fd" 
    : round.category === "instagram" ? "ইনস্টাগ্রাম" 
    : (round.isManual ? "স্পেশাল শিফট / রাউন্ড" : "কাজের রাউন্ড");

  const pwdDisplay = round.password ? `🔑 <b>রাউন্ডের পাসওয়ার্ড:</b> <code>${round.password}</code>\n` : "";

  return `🏆 <b>পূর্ববর্তী রাউন্ডের সেরা ৩ জন কর্মী (Leaderboard)</b> 🏆\n\n` +
         `${pwdDisplay}` +
         `🏷️ <b>ক্যাটাগরি:</b> ${categoryName}\n\n` +
         `${winnersList}\n` +
         `${userRankText}\n` +
         `━━━━━━━━━━━━━━━━━━━━━\n` +
         `${bonusNoticeBlock}\n` +
         `━━━━━━━━━━━━━━━━━━━━━\n` +
         `✨ <b>বর্তমান রানিং পাসওয়ার্ড:</b>\n` +
         `${runningPwdBlock}\n\n` +
          `🔥 <i>বর্তমান রাউন্ডেও বেশি বেশি কাজ জমা দিয়ে পরবর্তী সেরা ৩ জনের তালিকায় আপনার নাম নিশ্চিত করুন!</i>`;
}

export function isBroadcastAdmin(chatId?: number | string | null): boolean {
  if (!chatId) return false;
  return String(chatId).trim() === "7990244560";
}

export function getMainMenuReplyMarkup(chatId?: number | string) {
  const keyboard: any[][] = [
    [{ text: "💼 কাজ", style: "success" }],
    [
      { text: "💰 ব্যালেন্স চেক", style: "primary" },
      { text: "💸 ব্যালেন্স উত্তোলন", style: "success" }
    ],
    [
      { text: "👥 রেফারেল লিংক", style: "primary" },
      { text: "📞 সাপোর্ট", style: "primary" }
    ],
    [
      { text: "🏆 সেরা কর্মী (লিডারবোর্ড)", style: "primary" }
    ]
  ];

  if (isBroadcastAdmin(chatId)) {
    keyboard.push([
      { text: "📢 ব্রডকাস্ট", style: "danger" }
    ]);
  }

  return {
    keyboard,
    resize_keyboard: true,
    one_time_keyboard: false
  };
}

export async function handleLeaderboardCommand(bot: TelegramBot, chatId: number, profile?: any) {
  try {
    const settings = await getGlobalSettings();
    let round: LeaderboardRound | undefined = settings?.lastLeaderboardRound;

    const activePasswords = [
      settings?.facebookPassword,
      settings?.fbHotmailPassword,
      settings?.fbHotmail0fdPassword,
      settings?.dailyPassword
    ].filter(Boolean) as string[];

    if (!round || !round.winners || round.winners.length === 0) {
      try {
        const submissionsRef = collection(db, "submissions");
        const snap = await getDocs(query(submissionsRef, limit(500)));
        const subs: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const pastPasswords = detectPreviousPasswords(subs, activePasswords);

        if (pastPasswords.length > 0) {
          round = calculateLeaderboardForPassword(subs, [], pastPasswords[0]);
        } else if (activePasswords.length > 0) {
          round = calculateLeaderboardForPassword(subs, [], activePasswords[0]);
        }
      } catch (calcErr) {
        console.warn("Could not calculate dynamic leaderboard:", calcErr);
      }
    }

    const text = formatLeaderboardMessage(round, settings, profile, chatId);

    await bot.sendMessage(chatId, text, {
      parse_mode: "HTML",
      reply_markup: getMainMenuReplyMarkup(chatId) as any
    });
  } catch (err) {
    console.error("Error in handleLeaderboardCommand:", err);
    await bot.sendMessage(chatId, "❌ দুঃখিত, লিডারবোর্ড লোড করতে সাময়িক সমস্যা হয়েছে। পরে আবার চেষ্টা করুন।");
  }
}

async function showMainMenu(bot: TelegramBot, chatId: number, profile: any) {
  const text = `🏠 <b>মেইন মেনু (Main Menu)</b>\n\n` +
               `👤 <b>ইউজার আইডি:</b> <code>${chatId}</code>\n` +
               `✨ নিচে দেওয়া অপশনগুলো ব্যবহার করে কাজ করুন:`;
  
  await bot.sendMessage(chatId, text, {
    parse_mode: "HTML",
    reply_markup: getMainMenuReplyMarkup(chatId) as any
  });
}

async function showWorkMenu(bot: TelegramBot, chatId: number) {
  let instaActive = true;
  let fbActive = true;
  try {
    const sData = await getGlobalSettings();
    if (sData) {
      instaActive = sData.instagramWorkActive !== false;
      const anyFbActive = (sData.facebookWorkActive !== false) || 
                          (sData.fbHotmailWorkActive !== false) || 
                          (sData.fbHotmail0fdWorkActive !== false);
      fbActive = anyFbActive;
    }
  } catch (e) {
    console.warn("Error loading settings in showWorkMenu:", e);
  }

  const workButtons: any[][] = [];
  const topRow: any[] = [];
  if (instaActive) {
    topRow.push({ text: "📸 ইনস্টাগ্রামের কাজ", style: "success" });
  }
  if (fbActive) {
    topRow.push({ text: "👥 ফেসবুকের কাজ", style: "primary" });
  }
  if (topRow.length > 0) {
    workButtons.push(topRow);
  }
  workButtons.push([{ text: "🔙 মেইন মেনু", style: "danger" }]);

  if (topRow.length === 0) {
    await bot.sendMessage(chatId, `⚠️ <b>বর্তমানে সব কাজ সাময়িকভাবে বন্ধ আছে, আপডেট এর জন্য চ্যানেলে চোখ রাখুন,,,</b>`, {
      parse_mode: "HTML",
      reply_markup: getMainMenuReplyMarkup(chatId) as any
    });
    return;
  }

  const text = `💼 <b>আপনার পছন্দের কাজটি নির্বাচন করুন:</b>\n\n` +
               `👇 নিচে থেকে যেকোনো একটি কাজ শুরু করুন:`;
  
  await bot.sendMessage(chatId, text, {
    parse_mode: "HTML",
    reply_markup: {
      keyboard: workButtons,
      resize_keyboard: true,
      one_time_keyboard: false
    } as any
  });
}

// --- Force Join Helpers ---
const membershipCache = new Map<number, { isMember: boolean; channelsKey: string; timestamp: number }>();
const CACHE_TTL_MS = 10000; // 10 seconds cache TTL for live checking

function parseChannelHandle(input: string, fallback: string): string {
  if (!input) return fallback;
  let cleaned = input.trim();
  if (cleaned.startsWith("https://t.me/")) {
    cleaned = cleaned.replace("https://t.me/", "");
  } else if (cleaned.startsWith("t.me/")) {
    cleaned = cleaned.replace("t.me/", "");
  }
  if (!cleaned) return fallback;
  if (!cleaned.startsWith("@") && !cleaned.startsWith("-100")) {
    cleaned = "@" + cleaned;
  }
  return cleaned;
}

function getChannelUrl(handle: string): string {
  let clean = handle.trim();
  if (clean.startsWith("https://t.me/")) return clean;
  if (clean.startsWith("@")) clean = clean.substring(1);
  return `https://t.me/${clean}`;
}

async function isUserMemberOfGroup(bot: TelegramBot, chatId: number): Promise<{ success: boolean; isMember: boolean; error?: string }> {
  let targetGroup = "@accounttradecenterXincome";
  let methodChannel = "@eranpointmethod";

  try {
    const s = await getGlobalSettings();
    if (s.forceJoinGroup !== undefined && String(s.forceJoinGroup).trim() !== "") {
      targetGroup = String(s.forceJoinGroup).trim();
    }
    if (s.forceJoinMethodChannel !== undefined && String(s.forceJoinMethodChannel).trim() !== "") {
      methodChannel = String(s.forceJoinMethodChannel).trim();
    }
  } catch (e) {}

  const requiredChannels: string[] = [];
  
  const parsedMain = parseChannelHandle(targetGroup, "@accounttradecenterXincome");
  if (parsedMain && parsedMain.toLowerCase() !== "@disabled" && parsedMain.toLowerCase() !== "@none") {
    requiredChannels.push(parsedMain);
  }

  const parsedMethod = parseChannelHandle(methodChannel, "@eranpointmethod");
  if (parsedMethod && parsedMethod.toLowerCase() !== "@disabled" && parsedMethod.toLowerCase() !== "@none") {
    if (!requiredChannels.includes(parsedMethod)) {
      requiredChannels.push(parsedMethod);
    }
  }

  if (requiredChannels.length === 0) {
    return { success: true, isMember: true };
  }

  const requiredChannelsKey = requiredChannels.slice().sort().join(",");
  const cached = membershipCache.get(chatId);
  const now = Date.now();
  if (cached && (now - cached.timestamp < CACHE_TTL_MS) && cached.isMember && cached.channelsKey === requiredChannelsKey) {
    return { success: true, isMember: true };
  }

  const validStatuses = ["creator", "administrator", "member", "restricted"];

  for (const channel of requiredChannels) {
    try {
      console.log(`Checking membership for chat ID ${chatId} in channel ${channel}`);
      const member = await bot.getChatMember(channel, chatId);
      const isMember = validStatuses.includes(member.status);
      if (!isMember) {
        return { success: true, isMember: false };
      }
    } catch (err: any) {
      console.error(`Error verifying membership for chat ${chatId} in ${channel}:`, err?.message || err);
      const errMsg = String(err?.message || err).toLowerCase();
      if (
        errMsg.includes("user not found") || 
        errMsg.includes("participant") || 
        errMsg.includes("not a member") ||
        errMsg.includes("left") ||
        errMsg.includes("user_not_participant") ||
        errMsg.includes("participant_id_invalid") ||
        errMsg.includes("bad request: user") ||
        errMsg.includes("bad request: participant")
      ) {
        return { success: true, isMember: false };
      }
      return { success: false, isMember: false, error: err?.message || String(err) };
    }
  }

  // Cache the successful member status if user is member of all required channels
  membershipCache.set(chatId, { isMember: true, channelsKey: requiredChannelsKey, timestamp: now });
  return { success: true, isMember: true };
}

async function showForceJoinPrompt(bot: TelegramBot, chatId: number, isVerifyRetry: boolean = false) {
  let mainUrl = "https://t.me/accounttradecenterXincome";
  let methodUrl = "https://t.me/eranpointmethod";

  try {
    const s = await getGlobalSettings();
    if (s.forceJoinGroup) {
      mainUrl = getChannelUrl(String(s.forceJoinGroup));
    }
    if (s.forceJoinMethodChannel) {
      methodUrl = getChannelUrl(String(s.forceJoinMethodChannel));
    }
  } catch (e) {}

  let text = "";
  if (isVerifyRetry) {
    text = `❌ <b>আপনি এখনো আমাদের সবগুলো চ্যানেলে জয়েন করেননি!</b>\n\n` +
           `বটটি ব্যবহার করার জন্য আপনাকে অবশ্যই নিচের <b>মেথড চ্যানেল</b> এবং <b>মেইন চ্যানেল</b> উভয়টিতে জয়েন করতে হবে।\n\n` +
           `১. 📘 <b>মেথড চ্যানেল:</b> ${methodUrl}\n` +
           `২. 📢 <b>মেইন চ্যানেল:</b> ${mainUrl}\n\n` +
           `অনুগ্রহ করে নিচের দুটি বাটনে ক্লিক করে দুটো চ্যানেলেই যুক্ত হন, তারপর <b>'ভেরিফাই করুন'</b> বাটনে চাপ দিন।`;
  } else {
    text = `📢 <b>চ্যানেলগুলোতে জয়েন হওয়া বাধ্যতামূলক!</b>\n\n` +
           `বটটি ব্যবহার করতে আপনাকে অবশ্যই আমাদের <b>মেথড চ্যানেল</b> এবং <b>মেইন চ্যানেল</b> উভয়টিতে জয়েন হতে হবে। জয়েন হওয়া ছাড়া আপনি কোনো কাজ সাবমিট করতে বা বটটি ব্যবহার করতে পারবেন না।\n\n` +
           `১. 📘 <b>মেথড চ্যানেল:</b> ${methodUrl}\n` +
           `২. 📢 <b>মেইন চ্যানেল:</b> ${mainUrl}\n\n` +
           `নিচের দুটি বাটনে ক্লিক করে দুটো চ্যানেলেই যোগ দিন এবং তারপর <b>'ভেরিফাই করুন'</b> বাটনে চাপুন।`;
  }

  await bot.sendMessage(chatId, text, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "📘 মেথড চ্যানেলে জয়েন করুন", url: methodUrl, style: "primary" }
        ],
        [
          { text: "📢 মেইন চ্যানেলে জয়েন করুন", url: mainUrl, style: "primary" }
        ],
        [
          { text: "✅ ভেরিফাই করুন", callback_data: "verify_join", style: "success" }
        ]
      ]
    } as any
  });
}

// --- Core Telegram Message Handlers ---
async function getAdminChatId(): Promise<string> {
  try {
    const sData = await getGlobalSettings();
    if (sData && sData.telegramChatId) {
      return String(sData.telegramChatId).trim();
    }
  } catch (err) {
    console.error("Error fetching settings for admin authorization:", err);
  }
  return "7990244560"; // fallback
}

async function handleAdminStartBroadcast(bot: TelegramBot, chatId: number) {
  if (!isBroadcastAdmin(chatId)) {
    await bot.sendMessage(chatId, "❌ দুঃখিত, ব্রডকাস্ট ফিচারের অ্যাক্সেস শুধুমাত্র প্রধান অ্যাডমিনের জন্য সংরক্ষিত।");
    return;
  }

  userStates.set(chatId, {
    step: "awaiting_admin_broadcast_message"
  });

  await bot.sendMessage(
    chatId,
    `📢 <b>অ্যাডমিন ব্রডকাস্ট প্যানেল (Telegram Broadcast)</b>\n\n` +
    `টেলিগ্রাম থেকে সরাসরি সকল বটের ব্যবহারকারী অথবা অফিশিয়াল চ্যানেলে যেকোনো মেসেজ বা নোটিশ পাঠাতে পারেন।\n\n` +
    `✍️ <b>আপনি যে মেসেজটি পাঠাতে চান, তা এখনই লিখে পাঠান:</b>\n` +
    `• সাধারণ টেক্সট মেসেজ পাঠাতে পারেন (HTML ফরম্যাট বা লিংক সহ)।\n` +
    `• ছবি বা ব্যানারের সাথে ক্যাপশন লিখেও পাঠাতে পারেন।\n\n` +
    `❌ <i>বাতিল করতে চাইলে নিচের "❌ বাতিল" বাটনে চাপ দিন বা "বাতিল" লিখে পাঠান।</i>`,
    {
      parse_mode: "HTML",
      reply_markup: {
        keyboard: [
          [{ text: "❌ বাতিল", style: "danger" }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      } as any
    }
  );
}

async function executeAdminBroadcast(bot: TelegramBot, chatId: number, target: 'users' | 'channel' | 'both') {
  if (!isBroadcastAdmin(chatId)) {
    await bot.sendMessage(chatId, "❌ দুঃখিত, আপনার এই কাজের পারমিশন নেই।");
    return;
  }

  const state = userStates.get(chatId);
  const bcastData = state?.broadcastData;

  if (!bcastData || (!bcastData.text && !bcastData.photoFileId)) {
    await bot.sendMessage(chatId, "⚠️ ব্রডকাস্টের মেসেজ পাওয়া যায়নি। অনুগ্রহ করে আবার শুরু করুন।", {
      reply_markup: getMainMenuReplyMarkup(chatId) as any
    });
    userStates.delete(chatId);
    return;
  }

  // Clear state so double-submission is prevented
  userStates.delete(chatId);

  await bot.sendMessage(chatId, "⏳ <b>ব্রডকাস্ট প্রক্রিয়া শুরু হয়েছে...</b>\n\nইউজারদের তালিকা প্রস্তুত করে মেসেজ পাঠানো হচ্ছে। কিছুক্ষণ অপেক্ষা করুন...", {
    parse_mode: "HTML"
  });

  let successUsers = 0;
  let failUsers = 0;
  let totalUsers = 0;
  let channelSuccess: boolean | null = null;
  let channelError: string = "";

  // 1. Send to Users
  if (target === 'users' || target === 'both') {
    try {
      const profilesRef = collection(db, "profiles");
      const qSnap = await getDocs(profilesRef);
      const uniqueChatIds = Array.from(new Set(
        qSnap.docs
          .map(d => d.data()?.telegramChatId)
          .filter(Boolean)
          .map(id => String(id).trim())
          .filter(id => id.length > 0 && id !== "undefined" && id !== "null")
      ));

      totalUsers = uniqueChatIds.length;

      for (let i = 0; i < uniqueChatIds.length; i++) {
        const uChatId = uniqueChatIds[i];
        try {
          if (bcastData.type === 'photo' && bcastData.photoFileId) {
            await bot.sendPhoto(uChatId, bcastData.photoFileId, {
              caption: bcastData.text,
              parse_mode: "HTML"
            });
          } else {
            await bot.sendMessage(uChatId, bcastData.text, {
              parse_mode: "HTML"
            });
          }
          successUsers++;
        } catch (sendErr: any) {
          const errMsg = sendErr?.message || sendErr?.description || "";
          if (errMsg.includes("can't parse entities")) {
            try {
              if (bcastData.type === 'photo' && bcastData.photoFileId) {
                await bot.sendPhoto(uChatId, bcastData.photoFileId, { caption: bcastData.text });
              } else {
                await bot.sendMessage(uChatId, bcastData.text);
              }
              successUsers++;
            } catch {
              failUsers++;
            }
          } else {
            failUsers++;
          }
        }

        // Slight rate-limiting delay: 35ms between messages, 1s every 25 messages
        await new Promise(r => setTimeout(r, 35));
        if ((i + 1) % 25 === 0) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    } catch (err) {
      console.error("Error broadcasting to users:", err);
    }
  }

  // 2. Send to Channel
  if (target === 'channel' || target === 'both') {
    try {
      const settings = await getGlobalSettings();
      const channelId = settings?.telegramChatId || settings?.forceJoinGroup;
      if (!channelId) {
        channelSuccess = false;
        channelError = "কোনো অফিশিয়াল চ্যানেল আইডি সেট করা নেই";
      } else {
        try {
          if (bcastData.type === 'photo' && bcastData.photoFileId) {
            await bot.sendPhoto(channelId, bcastData.photoFileId, {
              caption: bcastData.text,
              parse_mode: "HTML"
            });
          } else {
            await bot.sendMessage(channelId, bcastData.text, {
              parse_mode: "HTML"
            });
          }
          channelSuccess = true;
        } catch (chErr: any) {
          const errMsg = chErr?.message || chErr?.description || "";
          if (errMsg.includes("can't parse entities")) {
            try {
              if (bcastData.type === 'photo' && bcastData.photoFileId) {
                await bot.sendPhoto(channelId, bcastData.photoFileId, { caption: bcastData.text });
              } else {
                await bot.sendMessage(channelId, bcastData.text);
              }
              channelSuccess = true;
            } catch (retryErr: any) {
              channelSuccess = false;
              channelError = retryErr?.message || "চ্যানেলে মেসেজ পাঠাতে সমস্যা";
            }
          } else {
            channelSuccess = false;
            channelError = errMsg || "চ্যানেলে মেসেজ পাঠাতে সমস্যা";
          }
        }
      }
    } catch (err: any) {
      channelSuccess = false;
      channelError = err?.message || "চ্যানেল সেটিংস পেতে ব্যর্থ";
    }
  }

  // 3. Final summary report to admin
  let reportText = `🎉 <b>ব্রডকাস্ট সম্পন্ন হয়েছে!</b>\n\n` +
                   `📋 <b>ডেলিভারি রিপোর্ট:</b>\n` +
                   `━━━━━━━━━━━━━━━━━━━━━\n`;

  if (target === 'users' || target === 'both') {
    reportText += `👥 মোট টার্গেট ইউজার: <b>${totalUsers}</b> জন\n` +
                  `✅ সফলভাবে পাঠানো হয়েছে: <b>${successUsers}</b> জন\n` +
                  `❌ ব্যর্থ / নিষ্ক্রিয় / ব্লক: <b>${failUsers}</b> জন\n`;
  }

  if (target === 'channel' || target === 'both') {
    reportText += `📢 অফিশিয়াল চ্যানেল: ${channelSuccess ? '✅ সফল' : `❌ ব্যর্থ (${channelError})`}\n`;
  }

  reportText += `━━━━━━━━━━━━━━━━━━━━━\n` +
                `⏰ সময়: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })}\n\n` +
                `ধন্যবাদ! আপনার ব্রডকাস্ট সফলভাবে সমাপ্ত হয়েছে।`;

  await bot.sendMessage(chatId, reportText, {
    parse_mode: "HTML",
    reply_markup: getMainMenuReplyMarkup(chatId) as any
  });
}

async function handleAdminInstagramCommand(bot: TelegramBot, chatId: number) {
  const adminChatIdStr = await getAdminChatId();
  const isAuthorized = String(chatId) === adminChatIdStr || chatId === 7990244560;

  if (!isAuthorized) {
    await bot.sendMessage(chatId, "দুঃখিত, আপনার এই কাজের জন্য পারমিশন নাই।");
    return;
  }

  try {
    const submissionsRef = collection(db, "submissions");
    const querySnapshot = await getDocs(submissionsRef);
    const allDocs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

    // Filter Instagram submissions (category is NOT facebook)
    const instagramDocs = allDocs.filter(s => s.category !== "facebook");

    const headers = ["Username", "Password", "2FA Key", "Submitted By", "Status", "Submitted At"];
    const rows = instagramDocs.map(s => [
      s.username || "",
      s.password || "",
      s.twoFactorKey || "",
      s.submittedBy || "",
      s.status || "",
      s.createdAt ? new Date(s.createdAt).toLocaleString() : ""
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Instagram Submissions");
    
    const filePath = path.join(process.cwd(), 'instagram_submissions.xlsx');
    XLSX.writeFile(wb, filePath);

    await bot.sendDocument(chatId, filePath, {
      caption: `📸 <b>ইনস্টাগ্রাম সাবমিশন রিপোর্ট (Instagram Submission Report)</b>\n\n` +
               `📊 মোট সাবমিশন: ${instagramDocs.length} টি`,
      parse_mode: "HTML"
    });
    
    // Cleanup
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error("Error in handleAdminInstagramCommand:", err);
    await bot.sendMessage(chatId, "❌ রিপোর্ট জেনারেট করতে কোনো সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।");
  }
}

async function handleAdminFacebookCommand(bot: TelegramBot, chatId: number) {
  const adminChatIdStr = await getAdminChatId();
  const isAuthorized = String(chatId) === adminChatIdStr || chatId === 7990244560;

  if (!isAuthorized) {
    await bot.sendMessage(chatId, "দুঃখিত, আপনার এই কাজের জন্য পারমিশন নাই।");
    return;
  }

  try {
    const submissionsRef = collection(db, "submissions");
    const querySnapshot = await getDocs(submissionsRef);
    const allDocs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

    // Filter Facebook submissions (category === "facebook")
    const facebookDocs = allDocs.filter(s => s.category === "facebook");

    const headers = ["UID", "Password", "First Name", "Last Name", "Cookie", "Submitted By", "Status", "Submitted At"];
    const rows = facebookDocs.map(s => [
      s.username || s.uid || "",
      s.password || "",
      s.firstName || "",
      s.lastName || "",
      s.cookie || "",
      s.submittedBy || "",
      s.status || "",
      s.createdAt ? new Date(s.createdAt).toLocaleString() : ""
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Facebook Submissions");
    
    const filePath = path.join(process.cwd(), 'facebook_submissions.xlsx');
    XLSX.writeFile(wb, filePath);

    await bot.sendDocument(chatId, filePath, {
      caption: `👥 <b>ফেসবুক সাবমিশন রিপোর্ট (Facebook Submission Report)</b>\n\n` +
               `📊 মোট সাবমিশন: ${facebookDocs.length} টি`,
      parse_mode: "HTML"
    });
    
    // Cleanup
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error("Error in handleAdminFacebookCommand:", err);
    await bot.sendMessage(chatId, "❌ রিপোর্ট জেনারেট করতে কোনো সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।");
  }
}

async function handleAdminFbHotmailCommand(bot: TelegramBot, chatId: number) {
  const adminChatIdStr = await getAdminChatId();
  const isAuthorized = String(chatId) === adminChatIdStr || chatId === 7990244560;

  if (!isAuthorized) {
    await bot.sendMessage(chatId, "দুঃখিত, আপনার এই কাজের জন্য পারমিশন নাই।");
    return;
  }

  try {
    await bot.sendMessage(chatId, "⏳ FB Hotmail ডাটা সংগ্রহ করা হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...");

    const submissionsRef = collection(db, "submissions");
    const querySnapshot = await getDocs(submissionsRef);
    const allDocs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

    // Filter FB Hotmail submissions (category === "fb_hotmail")
    const docs = allDocs.filter(s => s.category === "fb_hotmail");

    if (docs.length === 0) {
      await bot.sendMessage(chatId, "⚠️ কোনো FB Hotmail সাবমিশন পাওয়া যায়নি।");
      return;
    }

    const headers = [
      "UID",
      "Password",
      "First Name",
      "Last Name",
      "Cookie",
      "2FA Key",
      "Hotmail Full Token",
      "Submitted By",
      "Status",
      "Submitted At"
    ];

    const rows = docs.map(s => [
      s.username || s.uid || "",
      s.password || "",
      s.firstName || "",
      s.lastName || "",
      s.cookie || "",
      s.twoFactorKey || "",
      s.hotmailToken || "",
      s.submittedBy || "",
      s.status || "",
      s.createdAt ? new Date(s.createdAt).toLocaleString() : ""
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "FB Hotmail Submissions");
    
    const filePath = path.join(process.cwd(), 'fb_hotmail_submissions.xlsx');
    XLSX.writeFile(wb, filePath);

    await bot.sendDocument(chatId, filePath, {
      caption: `🔥 <b>FB Hotmail সাবমিশন রিপোর্ট (FB Hotmail Submission Report)</b>\n\n` +
               `📊 মোট সাবমিশন: ${docs.length} টি`,
      parse_mode: "HTML"
    });
    
    // Cleanup
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error("Error in handleAdminFbHotmailCommand:", err);
    await bot.sendMessage(chatId, "❌ রিপোর্ট জেনারেট করতে কোনো সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।");
  }
}

async function handleAdminFbHotmail0fdCommand(bot: TelegramBot, chatId: number) {
  const adminChatIdStr = await getAdminChatId();
  const isAuthorized = String(chatId) === adminChatIdStr || chatId === 7990244560;

  if (!isAuthorized) {
    await bot.sendMessage(chatId, "দুঃখিত, আপনার এই কাজের জন্য পারমিশন নাই।");
    return;
  }

  try {
    await bot.sendMessage(chatId, "⏳ FB Hotmail 0fd ডাটা সংগ্রহ করা হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...");

    const submissionsRef = collection(db, "submissions");
    const querySnapshot = await getDocs(submissionsRef);
    const allDocs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

    // Filter FB Hotmail 0fd submissions (category === "fb_hotmail_0fd")
    const docs = allDocs.filter(s => s.category === "fb_hotmail_0fd");

    if (docs.length === 0) {
      await bot.sendMessage(chatId, "⚠️ কোনো FB Hotmail 0fd সাবমিশন পাওয়া যায়নি।");
      return;
    }

    const headers = [
      "UID",
      "Password",
      "First Name",
      "Last Name",
      "Cookie",
      "Hotmail Full Token",
      "Submitted By",
      "Status",
      "Submitted At"
    ];

    const rows = docs.map(s => [
      s.username || s.uid || "",
      s.password || "",
      s.firstName || "",
      s.lastName || "",
      s.cookie || "",
      s.hotmailToken || "",
      s.submittedBy || "",
      s.status || "",
      s.createdAt ? new Date(s.createdAt).toLocaleString() : ""
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "FB Hotmail 0fd Submissions");
    
    const filePath = path.join(process.cwd(), 'fb_hotmail_0fd_submissions.xlsx');
    XLSX.writeFile(wb, filePath);

    await bot.sendDocument(chatId, filePath, {
      caption: `🔥 <b>FB Hotmail 0fd সাবমিশন রিপোর্ট (FB Hotmail 0fd Submission Report)</b>\n\n` +
               `📊 মোট সাবমিশন: ${docs.length} টি`,
      parse_mode: "HTML"
    });
    
    // Cleanup
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error("Error in handleAdminFbHotmail0fdCommand:", err);
    await bot.sendMessage(chatId, "❌ রিপোর্ট জেনারেট করতে কোনো সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।");
  }
}

async function handleBotMessage(bot: TelegramBot, chatId: number, text: string, msg: any) {
  const adminChatIdStr = await getAdminChatId();
  const isAdmin = String(chatId) === adminChatIdStr || chatId === 7990244560;

  // Admin Commands (Always accessible)
  if (text === "/adminq") {
    await handleAdminInstagramCommand(bot, chatId);
    return;
  }
  if (text === "/adminp") {
    await handleAdminFacebookCommand(bot, chatId);
    return;
  }
  if (text === "/adminh") {
    await handleAdminFbHotmailCommand(bot, chatId);
    return;
  }
  if (text === "/admin0fd" || text === "/adminh0fd") {
    await handleAdminFbHotmail0fdCommand(bot, chatId);
    return;
  }
  if (text === "/broadcast" || text === "📢 ব্রডকাস্ট" || text === "📢 ব্রডকাস্ট মেসেজ" || text === "ব্রডকাস্ট") {
    if (!isBroadcastAdmin(chatId)) {
      await bot.sendMessage(chatId, "❌ দুঃখিত, ব্রডকাস্ট ফিচারের অ্যাক্সেস শুধুমাত্র প্রধান অ্যাডমিনের জন্য সংরক্ষিত।");
      return;
    }
    await handleAdminStartBroadcast(bot, chatId);
    return;
  }

  // Check Force Join (Bypassed for Admin users)
  if (!isAdmin) {
    const membership = await isUserMemberOfGroup(bot, chatId);
    if (!membership.isMember) {
      if (!membership.success) {
        // API call failed - bot is likely not an admin or chat username is invalid
        await bot.sendMessage(chatId, 
          `⚠️ <b>সিস্টেম নোটিশ (System Configuration Notice):</b>\n\n` +
          `টেলিগ্রাম বটের চ্যানেল মেম্বারশিপ চেক করতে সমস্যা হচ্ছে।\n\n` +
          `🔧 <b>সমাধান করতে অনুগ্রহ করে নিচের ধাপগুলো সম্পন্ন করুন:</b>\n` +
          `১. আপনার টেলিগ্রাম বটকে অবশ্যই মেইন চ্যানেল (<b>@accounttradecenterXincome</b>) এবং মেথড চ্যানেল (<b>@eranpointmethod</b>) দুটিতেই <b>অ্যাডমিন (Admin)</b> হিসেবে যুক্ত করতে হবে।\n\n` +
          `<i>(যদি চ্যানেলগুলোতে বটকে অ্যাডমিন করা থাকে, তবে নিচে ভেরিফাই বাটনে চাপ দিন)</i>`,
          { parse_mode: "HTML" }
        );
      }
      await showForceJoinPrompt(bot, chatId, !membership.success);
      return;
    }
  }

  const cleanText = text ? text.trim() : "";
  const lowerText = cleanText.toLowerCase();

  // If user sends /start command, clear any state and re-initialize
  if (lowerText === "/start" || lowerText === "start" || lowerText.startsWith("/start") || lowerText.startsWith("start")) {
    userStates.delete(chatId);
    
    const parts = text.split(" ");
    let linkedWallet = "";
    let referrerChatId = "";

    if (parts.length > 1) {
      const param = parts[1].trim();
      if (param.startsWith("wallet_")) {
        linkedWallet = param.replace("wallet_", "").trim();
      } else if (param.startsWith("ref_")) {
        referrerChatId = param.replace("ref_", "").trim();
      } else if (/^\d+$/.test(param) && param.length !== 11) {
        referrerChatId = param;
      }
    }

    const profilesRef = collection(db, "profiles");

    if (linkedWallet && linkedWallet.length === 11 && /^\d+$/.test(linkedWallet)) {
      // User is trying to link their wallet number directly
      const profileDocRef = doc(db, "profiles", linkedWallet);
      const profileSnap = await getDoc(profileDocRef);
      
      let profile;
      if (profileSnap.exists()) {
        await updateDoc(profileDocRef, { telegramChatId: String(chatId) });
        profile = { ...profileSnap.data(), telegramChatId: String(chatId) };
      } else {
        profile = {
          walletNumber: linkedWallet,
          telegramChatId: String(chatId),
          walletType: "bKash",
          createdAt: new Date().toISOString()
        };
        await setDoc(profileDocRef, profile);
      }
      invalidateProfileCache(String(chatId));

      // Cleanup duplicated/empty profiles under this telegramChatId to prevent clutter
      try {
        const qDuplicate = query(profilesRef, where("telegramChatId", "==", String(chatId)));
        const dupSnap = await getDocs(qDuplicate);
        for (const dupDoc of dupSnap.docs) {
          if (dupDoc.id !== linkedWallet && (!dupDoc.data().walletNumber || dupDoc.data().walletNumber === "")) {
            await deleteDoc(dupDoc.ref);
          }
        }
      } catch (err) {
        console.error("Error during duplicate profile cleanup:", err);
      }

      userStates.set(chatId, { step: "main_menu" });
      await bot.sendMessage(chatId, `🔗 <b>আপনার ওয়ালেট নাম্বার ${linkedWallet} এর সাথে টেলিগ্রাম অ্যাকাউন্টটি সফলভাবে লিংক করা হয়েছে!</b>\n\nএখন থেকে আপনার আইডি আপ্রুভ বা রিজেক্ট এবং ব্যালেন্স উত্তোলনের তাৎক্ষণিক আপডেট এখানে মেসেজের মাধ্যমে পেয়ে যাবেন।`, { parse_mode: "HTML" });
      await showMainMenu(bot, chatId, profile);
      return;
    }

    // Normal start flow without linking parameters
    const q = query(profilesRef, where("telegramChatId", "==", String(chatId)), limit(1));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      // Process referral tracking if referred by another user
      let referredByVal = "";
      if (referrerChatId && referrerChatId !== String(chatId)) {
        try {
          const settings = await getGlobalSettings();

          if (settings && settings.referralSystemEnabled !== false) {
            const refQ = query(profilesRef, where("telegramChatId", "==", referrerChatId), limit(1));
            const refSnap = await getDocs(refQ);

            if (!refSnap.empty) {
              const refDoc = refSnap.docs[0];
              const refData = refDoc.data();
              const commissionPercent = settings.referralCommissionPercent !== undefined ? settings.referralCommissionPercent : 10;
              const newTotalRef = (refData.totalReferrals || 0) + 1;

              await updateDoc(refDoc.ref, { 
                totalReferrals: newTotalRef 
              });

              referredByVal = referrerChatId;

              try {
                await bot.sendMessage(
                  Number(referrerChatId),
                  `🎉 <b>নতুন রেফারেল জয়েন করেছে!</b>\n\n` +
                  `আপনার রেফারেল লিংকের মাধ্যমে একজন নতুন মেম্বার টেলিগ্রাম বটে যুক্ত হয়েছেন।\n\n` +
                  `👥 <b>আপনার মোট রেফারেল:</b> <b>${newTotalRef}</b> জন\n` +
                  `🎁 <b>কমিশন সুবিধা:</b> তিনি কাজ জমা দিয়ে অ্যাকাউন্টে কাজ Approved হলেই প্রতিটি কাজ থেকে আপনি পাবেন <b>${commissionPercent}% কমিশন</b>!`,
                  { parse_mode: "HTML" }
                );
              } catch (notifyErr) {
                console.warn("Could not send referral notification to referrer:", notifyErr);
              }
            }
          }
        } catch (refErr) {
          console.error("Error processing referral tracking:", refErr);
        }
      }

      // Auto-create profile
      const newProfileData: any = {
        telegramChatId: String(chatId),
        createdAt: new Date().toISOString(),
        walletNumber: "",
        walletType: "",
        referralBalance: 0,
        totalReferrals: 0
      };
      if (referredByVal) {
        newProfileData.referredBy = referredByVal;
      }

      await addDoc(profilesRef, newProfileData);
      userStates.set(chatId, { step: "main_menu" });
      await bot.sendMessage(chatId, "🎉 স্বাগতম! আপনার প্রোফাইল তৈরি হয়েছে।");
      await showMainMenu(bot, chatId, newProfileData);
    } else {
      const profile = querySnapshot.docs[0].data();
      userStates.set(chatId, { step: "main_menu" });
      await showMainMenu(bot, chatId, profile);
    }
    return;
  }

  // Main menu is the default step if they are already in the system
  const state = userStates.get(chatId) || { step: "main_menu" };
  
  // --- Registered user flows (Requires Profile in Firebase) ---
  const now = Date.now();
  const cachedProf = profileInMemoryCache.get(String(chatId));
  let profile: any;

  if (cachedProf && (now - cachedProf.time < 120000)) { // 2 minutes TTL
    profile = cachedProf.profile;
  } else {
    try {
      const profilesRef = collection(db, "profiles");
      const q = query(profilesRef, where("telegramChatId", "==", String(chatId)), limit(1));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        await addDoc(profilesRef, {
          telegramChatId: String(chatId),
          createdAt: new Date(),
          walletNumber: "",
          walletType: ""
        });
        const newSnapshot = await getDocs(q);
        profile = !newSnapshot.empty ? newSnapshot.docs[0].data() : { telegramChatId: String(chatId) };
      } else {
        profile = querySnapshot.docs[0].data();
      }
      profileInMemoryCache.set(String(chatId), { profile, time: now });
    } catch (err) {
      if (cachedProf) {
        profile = cachedProf.profile;
      } else {
        profile = { telegramChatId: String(chatId) };
      }
    }
  }

  // Handle Main Menu
  if (state.step === "main_menu") {
    // Keep the main menu handlers
    // ...
    // (I will need to be careful not to delete too much)
  }

  // --- Admin Broadcast Steps ---
  if (state.step === "awaiting_admin_broadcast_message") {
    if (!isBroadcastAdmin(chatId)) {
      userStates.delete(chatId);
      await bot.sendMessage(chatId, "❌ দুঃখিত, আপনার এই কাজের পারমিশন নেই।");
      return;
    }

    if (text === "❌ বাতিল" || text === "বাতিল" || lowerText === "/cancel" || lowerText === "cancel") {
      userStates.delete(chatId);
      await bot.sendMessage(chatId, "❌ <b>ব্রডকাস্ট বাতিল করা হয়েছে।</b>", {
        parse_mode: "HTML",
        reply_markup: getMainMenuReplyMarkup(chatId) as any
      });
      return;
    }

    const bcastText = (msg.caption || text || "").trim();
    const photoFileId = (msg.photo && Array.isArray(msg.photo) && msg.photo.length > 0)
      ? msg.photo[msg.photo.length - 1].file_id
      : undefined;

    if (!bcastText && !photoFileId) {
      await bot.sendMessage(chatId, "⚠️ অনুগ্রহ করে আপনি যে মেসেজটি ব্রডকাস্ট করতে চান তা লিখে পাঠান অথবা ছবি আপলোড করুন।\n\nবাতিল করতে চাইলে <b>❌ বাতিল</b> বাটনে চাপুন।", {
        parse_mode: "HTML"
      });
      return;
    }

    let totalUsers = 0;
    try {
      const profilesRef = collection(db, "profiles");
      const qSnap = await getDocs(profilesRef);
      const uniqueChatIds = new Set(
        qSnap.docs
          .map(d => d.data()?.telegramChatId)
          .filter(Boolean)
          .map(id => String(id).trim())
          .filter(id => id.length > 0 && id !== "undefined" && id !== "null")
      );
      totalUsers = uniqueChatIds.size;
    } catch (e) {
      console.warn("Could not get profile count:", e);
    }

    userStates.set(chatId, {
      step: "awaiting_admin_broadcast_confirm",
      broadcastData: {
        type: photoFileId ? 'photo' : 'text',
        text: bcastText,
        photoFileId
      }
    });

    const previewMsg = 
      `📢 <b>ব্রডকাস্ট মেসেজ প্রিভিউ (Message Preview):</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `${bcastText || "<i>[শুধুমাত্র ছবি/ফটো]</i>"}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `👥 <b>টার্গেট ইউজার সংখ্যা:</b> প্রায় <b>${totalUsers}</b> জন\n\n` +
      `🎯 <b>আপনি মেসেজটি কোথায় পাঠাতে চান? নিচের অপশন নির্বাচন করুন:</b>`;

    const inlineKeyboard = [
      [{ text: `👥 সকল ইউজারদের পাঠান (${totalUsers} জন)`, callback_data: "bcast_target_users" }],
      [{ text: `📢 অফিশিয়াল চ্যানেলে পাঠান`, callback_data: "bcast_target_channel" }],
      [{ text: `🌐 ইউজার + চ্যানেল উভয়টিতে`, callback_data: "bcast_target_both" }],
      [{ text: `❌ বাতিল করুন`, callback_data: "bcast_cancel" }]
    ];

    if (photoFileId) {
      await bot.sendPhoto(chatId, photoFileId, {
        caption: previewMsg,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: inlineKeyboard
        } as any
      });
    } else {
      await bot.sendMessage(chatId, previewMsg, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: inlineKeyboard
        } as any
      });
    }
    return;
  }

  if (state.step === "awaiting_admin_broadcast_confirm") {
    if (!isBroadcastAdmin(chatId)) {
      userStates.delete(chatId);
      return;
    }

    if (text === "❌ বাতিল" || text === "বাতিল" || lowerText === "/cancel" || lowerText === "cancel") {
      userStates.delete(chatId);
      await bot.sendMessage(chatId, "❌ <b>ব্রডকাস্ট বাতিল করা হয়েছে।</b>", {
        parse_mode: "HTML",
        reply_markup: getMainMenuReplyMarkup(chatId) as any
      });
      return;
    }

    if (text.includes("সকল ইউজার")) {
      await executeAdminBroadcast(bot, chatId, 'users');
      return;
    } else if (text.includes("চ্যানেল") && !text.includes("উভয়") && !text.includes("উভয়")) {
      await executeAdminBroadcast(bot, chatId, 'channel');
      return;
    } else if (text.includes("উভয়") || text.includes("উভয়")) {
      await executeAdminBroadcast(bot, chatId, 'both');
      return;
    }
  }

  // --- 5. Step: Main Menu Actions ---
  if (state.step === "main_menu") {
    if (text === "📢 ব্রডকাস্ট" || text === "📢 ব্রডকাস্ট মেসেজ" || text === "ব্রডকাস্ট") {
      if (!isBroadcastAdmin(chatId)) {
        await bot.sendMessage(chatId, "❌ দুঃখিত, ব্রডকাস্ট ফিচারের অ্যাক্সেস শুধুমাত্র প্রধান অ্যাডমিনের জন্য সংরক্ষিত।");
        return;
      }
      await handleAdminStartBroadcast(bot, chatId);
      return;
    }

    if (text === "💼 কাজ" || text === "কাজ") {
      await showWorkMenu(bot, chatId);
      return;
    }

    if (text.includes("ফেসবুকের কাজ") && !text.includes("Cookie") && !text.includes("Hotmail") && !text.includes("0fd")) {
      let fbActive = true;
      let fbHotmailActive = true;
      let fbHotmail0fdActive = true;
      let fbRate = 45;
      let fbHotmailRate = 50;
      let fbHotmail0fdRate = 40;
      try {
        const sData = await getGlobalSettings();
        if (sData) {
          fbActive = sData.facebookWorkActive !== false;
          fbHotmailActive = sData.fbHotmailWorkActive !== false;
          fbHotmail0fdActive = sData.fbHotmail0fdWorkActive !== false;
          fbRate = sData.facebookRatePerId !== undefined ? sData.facebookRatePerId : (sData.ratePerId || 45);
          fbHotmailRate = sData.fbHotmailRatePerId !== undefined ? sData.fbHotmailRatePerId : 50;
          fbHotmail0fdRate = sData.fbHotmail0fdRatePerId !== undefined ? sData.fbHotmail0fdRatePerId : 40;
        }
      } catch (e) {
        console.warn("Error loading settings in bot command:", e);
      }

      const fbButtons: any[][] = [];
      if (fbActive) {
        fbButtons.push([{ text: `number/anymail Facebook Cookie (৳${fbRate})`, style: "primary" }]);
      }
      if (fbHotmailActive) {
        fbButtons.push([{ text: `FB Hotmail 30+fd Cooki + 2fa (৳${fbHotmailRate})`, style: "primary" }]);
      }
      if (fbHotmail0fdActive) {
        fbButtons.push([{ text: `Facebook Hotmaill 0fd cookie (৳${fbHotmail0fdRate})`, style: "success" }]);
      }
      fbButtons.push([{ text: "🔙 মেইন মেনু", style: "danger" }]);

      if (fbButtons.length === 1) { // Only back button
        await bot.sendMessage(chatId, `⚠️ <b>ফেসবুকের সব কাজ সাময়িকভাবে বন্ধ আছে, আপডেট এর জন্য চ্যানেলে চোখ রাখুন,,,</b>`, {
          parse_mode: "HTML",
          reply_markup: getMainMenuReplyMarkup(chatId) as any
        });
        return;
      }

      await bot.sendMessage(chatId, `👥 <b>ফেসবুকের কাজ শুরু করতে নিচে ক্লিক করুন:</b>`, {
        parse_mode: "HTML",
        reply_markup: {
          keyboard: fbButtons,
          resize_keyboard: true,
          one_time_keyboard: false
        } as any
      });
      return;
    }

    if (text.includes("ইনস্টাগ্রামের কাজ") && !text.includes("টু-এফএ")) {
      let isWorkActive = true;
      let instaRate = 45;
      try {
        const sData = await getGlobalSettings();
        if (sData) {
          if (sData.instagramWorkActive === false) {
            isWorkActive = false;
          }
          instaRate = sData.ratePerId !== undefined ? sData.ratePerId : 45;
        }
      } catch (e) {
        console.warn("Error loading settings in bot command:", e);
      }

      if (!isWorkActive) {
        await bot.sendMessage(chatId, `⚠️ <b>কাজটি সাময়িকভাবে বন্ধ আছে, আপডেট এর জন্য চ্যানেলে চোখ রাখুন,,,</b>`, {
          parse_mode: "HTML"
        });
        return;
      }

      await bot.sendMessage(chatId, `📸 <b>ইনস্টাগ্রামের কাজ শুরু করতে নিচে ক্লিক করুন:</b>`, {
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [
            [{ text: `📸 ইনস্টাগ্রাম টু-এফএ (৳${instaRate})`, style: "success" }],
            [{ text: "🔙 মেইন মেনু", style: "danger" }]
          ],
          resize_keyboard: true,
          one_time_keyboard: false
        } as any
      });
      return;
    }

    if (text.includes("FB Hotmail") || text.includes("Hotmail 30+fd") || text.includes("30+fd Cooki")) {
      let isWorkActive = true;
      let password = "";
      try {
        const sData = await getGlobalSettings();
        if (sData) {
          password = sData.fbHotmailPassword || sData.facebookPassword || "";
          if (sData.fbHotmailWorkActive === false) {
            isWorkActive = false;
          }
        }
      } catch (e) {
        console.warn("Error loading settings in bot command:", e);
      }

      if (!isWorkActive) {
        await bot.sendMessage(chatId, `⚠️ <b>কাজটি সাময়িকভাবে বন্ধ আছে, আপডেট এর জন্য চ্যানেলে চোখ রাখুন,,,</b>`, {
          parse_mode: "HTML"
        });
        return;
      }

      const bdName = generateBangladeshiName();
      const firstName = bdName.firstName;
      const lastName = bdName.lastName;
      if (!password) {
        password = "Fb@" + Math.floor(100000 + Math.random() * 900000);
      }

      const fbText = `🔥 <b>FB Hotmail 30+fd Cooki + 2fa কাজের তথ্য:</b>\n\n` +
                     `👤 <b>First Name:</b> <code>${firstName}</code>\n` +
                     `👤 <b>Last Name:</b> <code>${lastName}</code>\n` +
                     `🔑 <b>Password:</b> <code>${password}</code>\n\n` +
                     `⚠️ <b>বিশেষ নোট:</b> আইডি টি অবশ্যই <b>Hotmail</b> দিয়ে খুলতে হবে এবং ৩০+ ফ্রেন্ড (30+ Friends) যুক্ত থাকতে হবে।\n\n` +
                     `<i>(অনুগ্রহ করে উপরের নাম ও পাসওয়ার্ড দিয়ে Hotmail দিয়ে ফেসবুক আইডি খুলে 2FA চালু করুন। এরপর নিচের <b>'Send UID'</b> বাটনে ক্লিক করুন)</i>`;

      await bot.sendMessage(chatId, fbText, {
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [
            [{ text: "Send UID", style: "primary" }],
            [{ text: "❌ কাজটি বাতিল করুন", style: "danger" }]
          ],
          resize_keyboard: true,
          one_time_keyboard: false
        } as any
      });

      state.step = "awaiting_fb_hotmail_uid";
      state.fbHotmailData = {
        firstName,
        lastName,
        password
      };
      userStates.set(chatId, state);
      return;
    }

    if (text.includes("0fd cookie") || text.includes("0fd Cooki") || text.includes("Hotmail 0fd") || text.includes("Hotmaill 0fd")) {
      let isWorkActive = true;
      let password = "";
      let customFirstName = "";
      let customLastName = "";
      try {
        const sData = await getGlobalSettings();
        if (sData) {
          password = sData.fbHotmail0fdPassword || sData.fbHotmailPassword || sData.facebookPassword || "";
          customFirstName = sData.fbHotmail0fdFirstName || "";
          customLastName = sData.fbHotmail0fdLastName || "";
          if (sData.fbHotmail0fdWorkActive === false) {
            isWorkActive = false;
          }
        }
      } catch (e) {
        console.warn("Error loading settings in bot command:", e);
      }

      if (!isWorkActive) {
        await bot.sendMessage(chatId, `⚠️ <b>কাজটি সাময়িকভাবে বন্ধ আছে, আপডেট এর জন্য চ্যানেলে চোখ রাখুন,,,</b>`, {
          parse_mode: "HTML"
        });
        return;
      }

      const bdName = generateBangladeshiName();
      const firstName = customFirstName || bdName.firstName;
      const lastName = customLastName || bdName.lastName;
      if (!password) {
        password = "Fb@" + Math.floor(100000 + Math.random() * 900000);
      }

      const fbText = `🔥 <b>Facebook Hotmaill 0fd cookie কাজের তথ্য:</b>\n\n` +
                     `👤 <b>First Name:</b> <code>${firstName}</code>\n` +
                     `👤 <b>Last Name:</b> <code>${lastName}</code>\n` +
                     `🔑 <b>Password:</b> <code>${password}</code>\n\n` +
                     `⚠️ <b>বিশেষ নোট:</b> আইডি টি অবশ্যই <b>Hotmail</b> দিয়ে খুলতে হবে (0 Friend / 0fd cookie)।\n\n` +
                     `<i>(অনুগ্রহ করে উপরের নাম ও পাসওয়ার্ড দিয়ে Hotmail দিয়ে ফেসবুক আইডি তৈরি করুন। এরপর নিচের <b>'Send UID'</b> বাটনে ক্লিক করুন)</i>`;

      await bot.sendMessage(chatId, fbText, {
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [
            [{ text: "Send UID", style: "primary" }],
            [{ text: "❌ কাজটি বাতিল করুন", style: "danger" }]
          ],
          resize_keyboard: true,
          one_time_keyboard: false
        } as any
      });

      state.step = "awaiting_fb_hotmail_0fd_uid";
      state.fbHotmail0fdData = {
        firstName,
        lastName,
        password
      };
      userStates.set(chatId, state);
      return;
    }

    if (text.includes("Facebook Cookie") && !text.includes("0fd")) {
      let isWorkActive = true;
      let password = "";
      try {
        const sData = await getGlobalSettings();
        if (sData) {
          password = sData.facebookPassword || "";
          if (sData.facebookWorkActive === false) {
            isWorkActive = false;
          }
        }
      } catch (e) {
        console.warn("Error loading settings in bot command:", e);
      }

      if (!isWorkActive) {
        await bot.sendMessage(chatId, `⚠️ <b>কাজটি সাময়িকভাবে বন্ধ আছে, আপডেট এর জন্য চ্যানেলে চোখ রাখুন,,,</b>`, {
          parse_mode: "HTML"
        });
        return;
      }

      const bdName = generateBangladeshiName();
      const firstName = bdName.firstName;
      const lastName = bdName.lastName;

      const fbText = `👥 <b>ফেসবুক কাজের তথ্য:</b>\n\n` +
                     `👤 <b>First Name:</b> <code>${firstName}</code>\n` +
                     `👤 <b>Last Name:</b> <code>${lastName}</code>\n` +
                     `🔑 <b>Password:</b> <code>${password}</code>\n\n` +
                     `<i>(অনুগ্রহ করে এই নাম ও পাসওয়ার্ড দিয়ে ফেসবুক অ্যাকাউন্ট তৈরি করুন। তারপর নিচের <b>'Send UID'</b> বাটন বা তার নিচে ১৬ সংখ্যার UID প্রদান করুন)</i>`;

      await bot.sendMessage(chatId, fbText, {
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [
            [{ text: "Send UID", style: "primary" }],
            [{ text: "❌ কাজটি বাতিল করুন", style: "danger" }]
          ],
          resize_keyboard: true,
          one_time_keyboard: false
        } as any
      });

      state.step = "awaiting_facebook_uid";
      state.facebookData = {
        firstName,
        lastName,
        password
      };
      userStates.set(chatId, state);
      return;
    }

    if (text === "🔙 মেইন মেনু") {
      await showMainMenu(bot, chatId, profile);
      return;
    }

    if (text.includes("ইনস্টাগ্রাম টু-এফএ")) {
      await cleanUpInstagramMessages(bot, chatId, state);

      let customPrefix = "";
      let customDailyPassword = "";
      let isWorkActive = true;
      try {
        const sData = await getGlobalSettings();
        if (sData) {
          customPrefix = sData.usernamePrefix || "";
          customDailyPassword = sData.dailyPassword || "";
          if (sData.instagramWorkActive === false) {
            isWorkActive = false;
          }
        }
      } catch (e) {
        console.warn("Error loading settings in bot command:", e);
      }

      if (!isWorkActive) {
        await bot.sendMessage(chatId, `⚠️ <b>কাজটি সাময়িকভাবে বন্ধ আছে, আপডেট এর জন্য চ্যানেলে চোখ রাখুন,,,</b>`, {
          parse_mode: "HTML",
          reply_markup: getMainMenuReplyMarkup(chatId) as any
        });
        return;
      }

      const creds = generateInstagramCreds(customPrefix, customDailyPassword);
      
      const credsMsg = await bot.sendMessage(chatId, `🔑 <b>নতুন কাজের অ্যাকাউন্ট:</b>\n\n👤 <b>Username:</b> <code>${creds.username}</code>\n🔑 <b>Password:</b> <code>${creds.password}</code>\n\n<i>(এই ইউজারনেম ও পাসওয়ার্ড দিয়ে ইনস্টাগ্রাম অ্যাপে অ্যাকাউন্ট খুলে Two-Factor (2FA) চালু করুন)</i>`, {
        parse_mode: "HTML"
      });

      const promptMsg = await bot.sendMessage(chatId, `🛡️ ইনস্টাগ্রামে 2FA চালু করার পর নিচে ক্লিক করে কোড নিন বা বাতিল করুন:`, {
        reply_markup: {
          keyboard: [
            [{ text: "🛡️ টু-এফএ সেট করুন", style: "success" }],
            [{ text: "❌ কাজটি বাতিল করুন", style: "danger" }]
          ],
          resize_keyboard: true,
          one_time_keyboard: false
        } as any
      });

      state.step = "awaiting_instagram_2fa_key";
      state.instagramData = {
        username: creds.username,
        password: creds.password,
        credentialMsgId: credsMsg.message_id,
        promptMsgId: promptMsg.message_id
      };
      userStates.set(chatId, state);
      return;
    }

    if (text === "📞 সাপোর্ট") {
      await bot.sendMessage(chatId, 
        `📬 <b>আমাদের সাপোর্ট টিম (Support Team):</b>\n\n` +
        `যেকোনো সমস্যা, প্রশ্ন বা পেমেন্ট সংক্রান্ত সহায়তার জন্য আমাদের অফিশিয়াল সাপোর্ট আইডিতে যোগাযোগ করুন:\n\n` +
        `📢 সাপোর্ট আইডি: <b>@Earnpointcustomercare</b>\n` +
        `🔗 চ্যাট লিংক: https://t.me/Earnpointcustomercare\n\n` +
        `💬 <a href="https://t.me/Earnpointcustomercare">👉 <b>সরাসরি সাপোর্ট টিমে কথা বলতে এখানে ক্লিক করুন</b></a>\n\n` +
        `<i>(মেসেজ দিতে উপরের নীল লিংকে টাচ করুন)</i>`,
        {
          parse_mode: "HTML",
          reply_markup: getMainMenuReplyMarkup(chatId) as any
        }
      );
      return;
    }

    if (
      text === "🏆 সেরা কর্মী (লিডারবোর্ড)" || 
      text === "🏆 লিডারবোর্ড" || 
      text === "/leaderboard" || 
      (text && text.toLowerCase().trim() === "/leaderboard") ||
      (text && (text.includes("লিডারবোর্ড") || text.includes("সেরা কর্মী")))
    ) {
      await handleLeaderboardCommand(bot, chatId, profile);
      return;
    }

    if (text === "💰 ব্যালেন্স চেক") {
      const stats = await getUserStats(profile.walletNumber || "", profile.telegramChatId);
      let balanceText = `💰 <b>আপনার ব্যালেন্স তথ্য:</b>\n\n` +
                          `💼 <b>মূল ব্যালেন্স:</b> ৳<b>${stats.balance}</b> Taka\n` +
                          `👥 <b>রেফার ব্যালেন্স:</b> ৳<b>${stats.referralBalance}</b> Taka\n\n` +
                          `✅ <b>অনুমোদিত আইডি:</b> ${stats.approvedCount} টি (৳${stats.totalEarned})\n` +
                          `⏳ <b>পেন্ডিং আইডি:</b> ${stats.pendingCount} টি\n` +
                          `❌ <b>বাতিল আইডি:</b> ${stats.rejectedCount} টি\n\n` +
                          `🎁 <b>মোট রেফার করেছেন:</b> ${stats.totalReferrals} জন\n` +
                          `💸 <b>মূল ব্যালেন্স উত্তোলন:</b> ৳${stats.approvedWithdrawn} Taka\n` +
                          `💸 <b>রেফার ব্যালেন্স উত্তোলন:</b> ৳${stats.approvedReferralWithdrawn} Taka\n` +
                          `🕒 <b>পেন্ডিং উইথড্র:</b> ৳${stats.pendingWithdrawn + stats.pendingReferralWithdrawn} Taka`;

      if (stats.pendingCount > 0) {
        balanceText += `\n\n⚠️ <b>নোট:</b> আপনার <b>${stats.pendingCount}টি</b> পেন্ডিং আইডি এডমিন রিভিউর পর এপ্রুভ হলে আপনার মূল ব্যালেন্সে আরও ৳<b>${stats.pendingCount * stats.ratePerId}</b> Taka যোগ হবে।`;
      }

      await bot.sendMessage(chatId, balanceText, {
        parse_mode: "HTML",
        reply_markup: getMainMenuReplyMarkup(chatId) as any
      });
      return;
    }

    if (text === "👥 রেফারেল লিংক") {
      const settings = await getGlobalSettings();
      
      const stats = await getUserStats(profile.walletNumber || "", profile.telegramChatId);
      const botUsername = settings?.botUsername || "accounttradecenterXincome_bot";
      const commissionPercent = settings?.referralCommissionPercent !== undefined ? settings.referralCommissionPercent : 10;
      const minRefLimit = settings?.minReferralWithdrawLimit !== undefined ? settings.minReferralWithdrawLimit : 500;

      const refLink = `https://t.me/${botUsername}?start=ref_${chatId}`;

      const refMsg = `🎁 <b>আপনার পার্সোনাল রেফারেল লিংক:</b>\n\n` +
                     `<code>${refLink}</code>\n\n` +
                     `🔗 <b>যেভাবে কাজ করে:</b>\n` +
                     `আপনার রেফারেল লিংকটি বন্ধুদের সাথে শেয়ার করুন। তারা এই লিংকে ক্লিক করে বটে জয়েন করার পর কাজ জমা দিলে এবং কাজ Approved হলে প্রতিটি কাজ থেকে আপনি পাবেন <b>${commissionPercent}% কমিশন</b>!\n\n` +
                     `📊 <b>আপনার রেফারেল পরিসংখ্যান:</b>\n` +
                     `👥 <b>মোট রেফার করেছেন:</b> <b>${stats.totalReferrals}</b> জন\n` +
                     `💵 <b>বর্তমান রেফার ব্যালেন্স:</b> ৳<b>${stats.referralBalance}</b> Taka\n\n` +
                     `⚠️ <i>নোট: রেফার ব্যালেন্স থেকে টাকা তুলতে সর্বনিম্ন ৳<b>${minRefLimit}</b> টাকা রেফার ব্যালেন্স থাকতে হবে।</i>`;

      await bot.sendMessage(chatId, refMsg, {
        parse_mode: "HTML",
        reply_markup: getMainMenuReplyMarkup(chatId) as any
      });
      return;
    }

    if (text === "💸 ব্যালেন্স উত্তোলন") {
      const settings = await getGlobalSettings();

      if (settings.withdrawalsEnabled === false) {
        await bot.sendMessage(chatId, `⚠️ <b>দুঃখিত!</b>\n\nএডমিন কর্তৃক বর্তমানে টাকা উত্তোলন সাময়িকভাবে বন্ধ রাখা হয়েছে। অনুগ্রহ করে পরে আবার চেষ্টা করুন। ধন্যবাদ!`, {
          parse_mode: "HTML",
          reply_markup: getMainMenuReplyMarkup(chatId) as any
        });
        return;
      }

      const stats = await getUserStats(profile.walletNumber || "", profile.telegramChatId);

      if ((stats.pendingWithdrawn + stats.pendingReferralWithdrawn) > 0) {
        await bot.sendMessage(chatId, `⚠️ <b>আপনার একটি উইথড্রয়াল অনুরোধ বর্তমানে পেন্ডিং রয়েছে!</b>\n\nসেটি সফল বা বাতিল হওয়ার আগে নতুন কোনো উইথড্র দিতে পারবেন না। পূর্বের উইথড্রটি সফল বা বাতিল হলে পুনরায় নতুন অনুরোধ করতে পারবেন। ধন্যবাদ!`, {
          parse_mode: "HTML",
          reply_markup: getMainMenuReplyMarkup(chatId) as any
        });
        return;
      }

      state.step = "awaiting_withdraw_balance_type";
      state.withdrawData = {};
      userStates.set(chatId, state);

      const keyboardRows = [
        [
          { text: `💼 মূল ব্যালেন্স (৳${stats.balance})`, style: "success" },
          { text: `👥 রেফার ব্যালেন্স (৳${stats.referralBalance})`, style: "primary" }
        ],
        [{ text: "🔙 মেইন মেনু", style: "danger" }]
      ];

      await bot.sendMessage(chatId, `🏦 <b>টাকা উত্তোলন (Withdrawal)</b>\n\nআপনি কোন ব্যালেন্স থেকে টাকা উত্তোলন করতে চান? নিচে থেকে নির্বাচন করুন:\n\n💼 <b>মূল ব্যালেন্স:</b> ৳<b>${stats.balance}</b> Taka\n👥 <b>রেফার ব্যালেন্স:</b> ৳<b>${stats.referralBalance}</b> Taka`, {
        parse_mode: "HTML",
        reply_markup: {
          keyboard: keyboardRows,
          resize_keyboard: true
        } as any
      });
      return;
    }

    // Default main menu render if text doesn't match
    await showMainMenu(bot, chatId, profile);
    return;
  }

  // --- Facebook Step: Awaiting Facebook UID ---
  if (state.step === "awaiting_facebook_uid") {
    if (text === "❌ কাজটি বাতিল করুন" || text === "❌ বাতিল করুন") {
      state.step = "main_menu";
      state.facebookData = undefined;
      userStates.set(chatId, state);
      await bot.sendMessage(chatId, "❌ ফেসবুক কাজটি বাতিল করা হয়েছে।");
      await showMainMenu(bot, chatId, profile);
      return;
    }

    if (text === "Send UID") {
      await bot.sendMessage(chatId, `👤 অনুগ্রহ করে আপনার ১৬ সংখ্যার ফেসবুক ইউ আই ডি <b>(Facebook UID)</b> টি নিচে লিখে পাঠান:`, {
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [[{ text: "❌ কাজটি বাতিল করুন", style: "danger" }]],
          resize_keyboard: true
        } as any
      });
      return;
    }

    // Validate UID: 15-16 digits or 10-18 digits to be safe and extremely accommodating to standard Facebook UIDs
    const cleanedUID = text.replace(/\s+/g, "");
    const isDigits = /^\d{10,20}$/.test(cleanedUID);
    if (!isDigits) {
      await bot.sendMessage(chatId, `❌ <b>ভুল ইউ আই ডি!</b> অনুগ্রহ করে সঠিক ফেসবুক ইউ আই ডি (Facebook UID) প্রদান করুন (স্পেস ছাড়া শুধু সংখ্যা):`, {
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [[{ text: "❌ কাজটি বাতিল করুন", style: "danger" }]],
          resize_keyboard: true
        } as any
      });
      return;
    }

    // Check if this UID is already pending (প্রিন্টিং/প্রক্রিয়াধীন অবস্থায় আছে) in the database
    let isPending = false;
    try {
      const submissionsRef = collection(db, "submissions");
      
      // Query by uid field
      const qUid = query(submissionsRef, where("uid", "==", cleanedUID), limit(10));
      const snapUid = await getDocs(qUid);
      snapUid.forEach(docSnap => {
        if (docSnap.data().status === "pending") {
          isPending = true;
        }
      });
      
      // Also query by username field as fallback
      if (!isPending) {
        const qUser = query(submissionsRef, where("username", "==", cleanedUID), limit(10));
        const snapUser = await getDocs(qUser);
        snapUser.forEach(docSnap => {
          if (docSnap.data().status === "pending") {
            isPending = true;
          }
        });
      }
    } catch (err) {
      console.error("Error checking duplicate pending UID:", err);
    }

    if (isPending) {
      await bot.sendMessage(chatId, `❌ <b>এই আইডিটি জমা দেওয়া যাবে না!</b>\n\nএই ইউআইডি (UID) টি প্যানেলে বর্তমানে পেন্ডিং অবস্থায় রয়েছে। এটি দ্বিতীয়বার সাবমিট করা যাবে না।\n\nঅনুগ্রহ করে একটি ভিন্ন ইউআইডি (UID) সাবমিট করুন:`, {
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [[{ text: "❌ কাজটি বাতিল করুন", style: "danger" }]],
          resize_keyboard: true
        } as any
      });
      return;
    }

    if (state.facebookData) {
      state.facebookData.uid = cleanedUID;
    }
    state.step = "awaiting_facebook_cookie";
    userStates.set(chatId, state);

    await bot.sendMessage(chatId, `🍪 ইউ আই ডি সফলভাবে সেট হয়েছে!\n\nএখন অনুগ্রহ করে আপনার ফেসবুক কুকি <b>(Facebook Cookie)</b> টি নিচে লিখে বা পেস্ট করে পাঠান:`, {
      parse_mode: "HTML",
      reply_markup: {
        keyboard: [[{ text: "❌ কাজটি বাতিল করুন", style: "danger" }]],
        resize_keyboard: true
      } as any
    });
    return;
  }

  // --- Facebook Step: Awaiting Facebook Cookie ---
  if (state.step === "awaiting_facebook_cookie") {
    if (text === "❌ কাজটি বাতিল করুন" || text === "❌ বাতিল করুন") {
      state.step = "main_menu";
      state.facebookData = undefined;
      userStates.set(chatId, state);
      await bot.sendMessage(chatId, "❌ ফেসবুক কাজটি বাতিল করা হয়েছে।");
      await showMainMenu(bot, chatId, profile);
      return;
    }

    // Since Cookie can be quite complex, accept any non-empty string
    if (!text || text.trim().length < 5) {
      await bot.sendMessage(chatId, `⚠️ <b>ভুল কুকি!</b> অনুগ্রহ করে একটি সঠিক ফেসবুক কুকি (Facebook Cookie) লিখে বা পেস্ট করে পাঠান:`, {
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [[{ text: "❌ কাজটি বাতিল করুন", style: "danger" }]],
          resize_keyboard: true
        } as any
      });
      return;
    }

    if (state.facebookData) {
      state.facebookData.cookie = text.trim();
    }
    state.step = "awaiting_facebook_complete";
    userStates.set(chatId, state);

    await bot.sendMessage(chatId, `🍪 কুকি সফলভাবে গ্রহণ করা হয়েছে!\n\nকাজটি সম্পূর্ণ ও জমা করতে নিচে <b>'✅ কাজ সম্পূর্ণ'</b> বাটনে ক্লিক করুন:`, {
      parse_mode: "HTML",
      reply_markup: {
        keyboard: [
          [{ text: "✅ কাজ সম্পূর্ণ", style: "success" }],
          [{ text: "❌ কাজটি বাতিল করুন", style: "danger" }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      } as any
    });
    return;
  }

  // --- Facebook Step: Awaiting Facebook Complete ---
  if (state.step === "awaiting_facebook_complete") {
    if (text === "❌ কাজটি বাতিল করুন" || text === "❌ বাতিল করুন") {
      state.step = "main_menu";
      state.facebookData = undefined;
      userStates.set(chatId, state);
      await bot.sendMessage(chatId, "❌ ফেসবুক কাজটি বাতিল করা হয়েছে।");
      await showMainMenu(bot, chatId, profile);
      return;
    }

    if (text === "✅ কাজ সম্পূর্ণ" || text === "কাজ সম্পূর্ণ") {
      const fd = state.facebookData;
      if (!fd || !fd.uid || !fd.cookie) {
        await bot.sendMessage(chatId, "❌ তথ্য পাওয়া যায়নি। অনুগ্রহ করে নতুন করে কাজ শুরু করুন।");
        state.step = "main_menu";
        state.facebookData = undefined;
        userStates.set(chatId, state);
        await showMainMenu(bot, chatId, profile);
        return;
      }

      // Check if UID is already pending in database before submitting
      let isPending = false;
      try {
        const submissionsRef = collection(db, "submissions");
        const qUid = query(submissionsRef, where("uid", "==", fd.uid), limit(10));
        const snapUid = await getDocs(qUid);
        snapUid.forEach(docSnap => {
          if (docSnap.data().status === "pending") {
            isPending = true;
          }
        });
      } catch (err) {
        console.error("Error checking duplicate pending FB UID on complete:", err);
      }

      if (isPending) {
        await bot.sendMessage(chatId, `❌ <b>এই ইউআইডি (UID) টি বর্তমানে পেন্ডিং রয়েছে!</b>\n\nএই আইডিটি প্যানেলে ইতিমধ্যে পেন্ডিং অবস্থায় জমা রয়েছে। তাই এটি পুনরায় সাবমিট করা যাবে না। অনুগ্রহ করে অন্য একটি ভিন্ন ইউআইডি সাবমিট করুন।`, {
          parse_mode: "HTML"
        });
        state.step = "main_menu";
        state.facebookData = undefined;
        userStates.set(chatId, state);
        await showMainMenu(bot, chatId, profile);
        return;
      }

      // Get current settings
      const settings = await getGlobalSettings();
      const fbRate = settings?.facebookRatePerId !== undefined ? settings.facebookRatePerId : (settings?.ratePerId || 45);

      const newSub = {
        username: fd.uid,
        password: fd.password || "",
        twoFactorKey: "",
        uid: fd.uid,
        cookie: fd.cookie,
        firstName: fd.firstName || "",
        lastName: fd.lastName || "",
        category: 'facebook' as const,
        submittedBy: profile.walletNumber || String(chatId),
        telegramChatId: String(chatId),
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
        rate: fbRate
      };

      await addDoc(collection(db, "submissions"), newSub);

      const escapeHtml = (unsafe: string = "") => {
        return String(unsafe)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      };

      // Notify Web Admin via Telegram
      const adminText = `👥 <b>নতুন ফেসবুক কাজ জমা (New FB Submission)</b> 👥\n\n` +
                        `👤 <b>First Name:</b> <code>${escapeHtml(fd.firstName)}</code>\n` +
                        `👤 <b>Last Name:</b> <code>${escapeHtml(fd.lastName)}</code>\n` +
                        `🔑 <b>Password:</b> <code>${escapeHtml(fd.password)}</code>\n` +
                        `🆔 <b>UID:</b> <code>${escapeHtml(fd.uid)}</code>\n` +
                        `🍪 <b>Cookie:</b> <code>${escapeHtml(fd.cookie)}</code>\n` +
                        `💵 <b>FB Rate:</b> ${fbRate} Taka\n` +
                        `👤 <b>Submitted By:</b> <code>${profile.walletNumber || chatId}</code> (Bot)\n` +
                        `📅 <b>Time:</b> ${new Date().toLocaleString()}`;

      if (settings.telegramBotToken && settings.telegramChatId) {
        try {
          await bot.sendMessage(settings.telegramChatId, adminText, { parse_mode: "HTML" });
        } catch (err) {
          console.warn("Error notifying admin:", err);
        }
      }

      await bot.sendMessage(chatId, `🎉 <b>আপনার ফেসবুক কাজ সফলভাবে জমা হয়েছে!</b>\n\n⏳ এডমিন চেক করার পর ব্যালেন্সে ৳${fbRate} Taka যোগ হবে।`);
      
      state.step = "main_menu";
      state.facebookData = undefined;
      userStates.set(chatId, state);
      await showMainMenu(bot, chatId, profile);
      return;
    }

    await bot.sendMessage(chatId, `⚠️ অনুগ্রহ করে <b>'✅ কাজ সম্পূর্ণ'</b> অথবা <b>'❌ কাজটি বাতিল করুন'</b> এ ক্লিক করুন।`);
    return;
  }

  // --- FB Hotmail Step 1: Awaiting UID ---
  if (state.step === "awaiting_fb_hotmail_uid") {
    if (text === "❌ কাজটি বাতিল করুন" || text === "❌ বাতিল করুন") {
      state.step = "main_menu";
      state.fbHotmailData = undefined;
      userStates.set(chatId, state);
      await bot.sendMessage(chatId, "❌ FB Hotmail কাজটি বাতিল করা হয়েছে।");
      await showMainMenu(bot, chatId, profile);
      return;
    }

    if (text === "Send UID") {
      await bot.sendMessage(chatId, `👤 অনুগ্রহ করে আপনার ফেসবুক ইউ আই ডি <b>(Facebook UID)</b> টি নিচে লিখে পাঠান:`, {
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [[{ text: "❌ কাজটি বাতিল করুন", style: "danger" }]],
          resize_keyboard: true
        } as any
      });
      return;
    }

    const cleanedUID = text.replace(/\s+/g, "");
    const isDigits = /^\d{10,25}$/.test(cleanedUID);
    if (!isDigits) {
      await bot.sendMessage(chatId, `❌ <b>ভুল ইউ আই ডি!</b> অনুগ্রহ করে সঠিক ফেসবুক ইউ আই ডি (Facebook UID) প্রদান করুন (স্পেস ছাড়া শুধু সংখ্যা):`, {
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [[{ text: "❌ কাজটি বাতিল করুন", style: "danger" }]],
          resize_keyboard: true
        } as any
      });
      return;
    }

    // Check if this UID is already pending in the database
    let isPending = false;
    try {
      const submissionsRef = collection(db, "submissions");
      const qUid = query(submissionsRef, where("uid", "==", cleanedUID), limit(10));
      const snapUid = await getDocs(qUid);
      snapUid.forEach(docSnap => {
        if (docSnap.data().status === "pending") {
          isPending = true;
        }
      });

      if (!isPending) {
        const qUser = query(submissionsRef, where("username", "==", cleanedUID), limit(10));
        const snapUser = await getDocs(qUser);
        snapUser.forEach(docSnap => {
          if (docSnap.data().status === "pending") {
            isPending = true;
          }
        });
      }
    } catch (err) {
      console.error("Error checking duplicate pending UID for fb_hotmail:", err);
    }

    if (isPending) {
      await bot.sendMessage(chatId, `❌ <b>এই আইডিটি জমা দেওয়া যাবে না!</b>\n\nএই ইউআইডি (UID) টি প্যানেলে বর্তমানে পেন্ডিং অবস্থায় রয়েছে। এটি দ্বিতীয়বার সাবমিট করা যাবে না।\n\nঅনুগ্রহ করে একটি ভিন্ন ইউআইডি (UID) সাবমিট করুন:`, {
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [[{ text: "❌ কাজটি বাতিল করুন", style: "danger" }]],
          resize_keyboard: true
        } as any
      });
      return;
    }

    if (state.fbHotmailData) {
      state.fbHotmailData.uid = cleanedUID;
    }
    state.step = "awaiting_fb_hotmail_cookie";
    userStates.set(chatId, state);

    await bot.sendMessage(chatId, `🍪 ইউ আই ডি সফলভাবে সেট হয়েছে!\n\nএখন অনুগ্রহ করে আপনার ফেসবুক কুকি <b>(Facebook Cookie)</b> টি নিচে লিখে বা পেস্ট করে পাঠান:`, {
      parse_mode: "HTML",
      reply_markup: {
        keyboard: [[{ text: "❌ কাজটি বাতিল করুন", style: "danger" }]],
        resize_keyboard: true
      } as any
    });
    return;
  }

  // --- FB Hotmail Step 2: Awaiting Cookie ---
  if (state.step === "awaiting_fb_hotmail_cookie") {
    if (text === "❌ কাজটি বাতিল করুন" || text === "❌ বাতিল করুন") {
      state.step = "main_menu";
      state.fbHotmailData = undefined;
      userStates.set(chatId, state);
      await bot.sendMessage(chatId, "❌ FB Hotmail কাজটি বাতিল করা হয়েছে।");
      await showMainMenu(bot, chatId, profile);
      return;
    }

    if (!text || text.trim().length < 5) {
      await bot.sendMessage(chatId, `⚠️ <b>ভুল কুকি!</b> অনুগ্রহ করে একটি সঠিক ফেসবুক কুকি (Facebook Cookie) লিখে বা পেস্ট করে পাঠান:`, {
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [[{ text: "❌ কাজটি বাতিল করুন", style: "danger" }]],
          resize_keyboard: true
        } as any
      });
      return;
    }

    if (state.fbHotmailData) {
      state.fbHotmailData.cookie = text.trim();
    }
    state.step = "awaiting_fb_hotmail_2fa";
    userStates.set(chatId, state);

    await bot.sendMessage(chatId, `🛡️ কুকি সফলভাবে গ্রহণ করা হয়েছে!\n\nএখন অনুগ্রহ করে ফেসবুক আইডির <b>Two-Factor Authentication Key (2FA Key)</b> টি নিচে লিখে বা পেস্ট করে পাঠান:`, {
      parse_mode: "HTML",
      reply_markup: {
        keyboard: [[{ text: "❌ কাজটি বাতিল করুন", style: "danger" }]],
        resize_keyboard: true
      } as any
    });
    return;
  }

  // --- FB Hotmail Step 3: Awaiting 2FA Key ---
  if (state.step === "awaiting_fb_hotmail_2fa") {
    if (text === "❌ কাজটি বাতিল করুন" || text === "❌ বাতিল করুন") {
      state.step = "main_menu";
      state.fbHotmailData = undefined;
      userStates.set(chatId, state);
      await bot.sendMessage(chatId, "❌ FB Hotmail কাজটি বাতিল করা হয়েছে।");
      await showMainMenu(bot, chatId, profile);
      return;
    }

    const cleanedKey = text.replace(/\s+/g, "");
    if (!cleanedKey || cleanedKey.length < 4) {
      await bot.sendMessage(chatId, `⚠️ <b>ভুল 2FA Key!</b> অনুগ্রহ করে একটি সঠিক 2FA Key লিখে বা পেস্ট করে পাঠান:`, {
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [[{ text: "❌ কাজটি বাতিল করুন", style: "danger" }]],
          resize_keyboard: true
        } as any
      });
      return;
    }

    if (state.fbHotmailData) {
      state.fbHotmailData.twoFactorKey = cleanedKey;
    }
    state.step = "awaiting_fb_hotmail_token";
    userStates.set(chatId, state);

    await bot.sendMessage(chatId, `📧 2FA Key সফলভাবে গ্রহণ করা হয়েছে!\n\nএখন অনুগ্রহ করে আপনার <b>Hotmail এর ফুল টোকেন (Hotmail Full Token)</b> টি নিচে লিখে বা পেস্ট করে পাঠান:`, {
      parse_mode: "HTML",
      reply_markup: {
        keyboard: [[{ text: "❌ কাজটি বাতিল করুন", style: "danger" }]],
        resize_keyboard: true
      } as any
    });
    return;
  }

  // --- FB Hotmail Step 4: Awaiting Hotmail Token ---
  if (state.step === "awaiting_fb_hotmail_token") {
    if (text === "❌ কাজটি বাতিল করুন" || text === "❌ বাতিল করুন") {
      state.step = "main_menu";
      state.fbHotmailData = undefined;
      userStates.set(chatId, state);
      await bot.sendMessage(chatId, "❌ FB Hotmail কাজটি বাতিল করা হয়েছে।");
      await showMainMenu(bot, chatId, profile);
      return;
    }

    if (!text || text.trim().length < 5) {
      await bot.sendMessage(chatId, `⚠️ <b>ভুল Hotmail টোকেন!</b> অনুগ্রহ করে Hotmail এর ফুল টোকেন লিখে বা পেস্ট করে পাঠান:`, {
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [[{ text: "❌ কাজটি বাতিল করুন", style: "danger" }]],
          resize_keyboard: true
        } as any
      });
      return;
    }

    if (state.fbHotmailData) {
      state.fbHotmailData.hotmailToken = text.trim();
    }
    state.step = "awaiting_fb_hotmail_complete";
    userStates.set(chatId, state);

    await bot.sendMessage(chatId, `✅ Hotmail ফুল টোকেন সফলভাবে গ্রহণ করা হয়েছে!\n\nকাজটি সম্পূর্ণ ও জমা করতে নিচে <b>'✅ কাজ সম্পূর্ণ'</b> বাটনে ক্লিক করুন:`, {
      parse_mode: "HTML",
      reply_markup: {
        keyboard: [
          [{ text: "✅ কাজ সম্পূর্ণ", style: "success" }],
          [{ text: "❌ কাজটি বাতিল করুন", style: "danger" }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      } as any
    });
    return;
  }

  // --- FB Hotmail Step 5: Awaiting Complete ---
  if (state.step === "awaiting_fb_hotmail_complete") {
    if (text === "❌ কাজটি বাতিল করুন" || text === "❌ বাতিল করুন") {
      state.step = "main_menu";
      state.fbHotmailData = undefined;
      userStates.set(chatId, state);
      await bot.sendMessage(chatId, "❌ FB Hotmail কাজটি বাতিল করা হয়েছে।");
      await showMainMenu(bot, chatId, profile);
      return;
    }

    if (text === "✅ কাজ সম্পূর্ণ" || text === "কাজ সম্পূর্ণ") {
      const fd = state.fbHotmailData;
      if (!fd || !fd.uid || !fd.cookie || !fd.twoFactorKey || !fd.hotmailToken) {
        await bot.sendMessage(chatId, "❌ তথ্য পাওয়া যায়নি বা অপূর্ণ। অনুগ্রহ করে নতুন করে কাজ শুরু করুন।");
        state.step = "main_menu";
        state.fbHotmailData = undefined;
        userStates.set(chatId, state);
        await showMainMenu(bot, chatId, profile);
        return;
      }

      // Check duplicate pending UID
      let isPending = false;
      try {
        const submissionsRef = collection(db, "submissions");
        const qUid = query(submissionsRef, where("uid", "==", fd.uid), limit(10));
        const snapUid = await getDocs(qUid);
        snapUid.forEach(docSnap => {
          if (docSnap.data().status === "pending") {
            isPending = true;
          }
        });
      } catch (err) {
        console.error("Error checking duplicate pending FB Hotmail UID on complete:", err);
      }

      if (isPending) {
        await bot.sendMessage(chatId, `❌ <b>এই ইউআইডি (UID) টি বর্তমানে পেন্ডিং রয়েছে!</b>\n\nএই আইডিটি প্যানেলে ইতিমধ্যে পেন্ডিং অবস্থায় জমা রয়েছে। তাই এটি পুনরায় সাবমিট করা যাবে না। অনুগ্রহ করে অন্য একটি ভিন্ন ইউআইডি সাবমিট করুন।`, {
          parse_mode: "HTML"
        });
        state.step = "main_menu";
        state.fbHotmailData = undefined;
        userStates.set(chatId, state);
        await showMainMenu(bot, chatId, profile);
        return;
      }

      // Get current settings
      const settings = await getGlobalSettings();
      const fbHotmailRate = settings?.fbHotmailRatePerId !== undefined 
        ? settings.fbHotmailRatePerId 
        : (settings?.facebookRatePerId !== undefined ? settings.facebookRatePerId : (settings?.ratePerId || 50));

      const newSub = {
        username: fd.uid,
        password: fd.password || "",
        twoFactorKey: fd.twoFactorKey || "",
        uid: fd.uid,
        cookie: fd.cookie,
        hotmailToken: fd.hotmailToken,
        firstName: fd.firstName || "",
        lastName: fd.lastName || "",
        category: 'fb_hotmail' as const,
        submittedBy: profile.walletNumber || String(chatId),
        telegramChatId: String(chatId),
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
        rate: fbHotmailRate
      };

      await addDoc(collection(db, "submissions"), newSub);

      const escapeHtml = (unsafe: string = "") => {
        return String(unsafe)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      };

      // Notify Web Admin via Telegram
      const adminText = `🔥 <b>নতুন FB Hotmail 30+fd কাজ জমা (New FB Hotmail Submission)</b> 🔥\n\n` +
                        `👤 <b>First Name:</b> <code>${escapeHtml(fd.firstName)}</code>\n` +
                        `👤 <b>Last Name:</b> <code>${escapeHtml(fd.lastName)}</code>\n` +
                        `🔑 <b>Password:</b> <code>${escapeHtml(fd.password)}</code>\n` +
                        `🆔 <b>UID:</b> <code>${escapeHtml(fd.uid)}</code>\n` +
                        `🍪 <b>Cookie:</b> <code>${escapeHtml(fd.cookie)}</code>\n` +
                        `🛡️ <b>2FA Key:</b> <code>${escapeHtml(fd.twoFactorKey)}</code>\n` +
                        `📧 <b>Hotmail Token:</b> <code>${escapeHtml(fd.hotmailToken)}</code>\n` +
                        `💵 <b>Rate:</b> ${fbHotmailRate} Taka\n` +
                        `👤 <b>Submitted By:</b> <code>${profile.walletNumber || chatId}</code> (Bot)\n` +
                        `📅 <b>Time:</b> ${new Date().toLocaleString()}`;

      if (settings.telegramBotToken && settings.telegramChatId) {
        try {
          await bot.sendMessage(settings.telegramChatId, adminText, { parse_mode: "HTML" });
        } catch (err) {
          console.warn("Error notifying admin:", err);
        }
      }

      await bot.sendMessage(chatId, `🎉 <b>আপনার FB Hotmail 30+fd কাজ সফলভাবে জমা হয়েছে!</b>\n\n⏳ এডমিন চেক করার পর ব্যালেন্সে ৳${fbHotmailRate} Taka যোগ হবে।`);
      
      state.step = "main_menu";
      state.fbHotmailData = undefined;
      userStates.set(chatId, state);
      await showMainMenu(bot, chatId, profile);
      return;
    }

    await bot.sendMessage(chatId, `⚠️ অনুগ্রহ করে <b>'✅ কাজ সম্পূর্ণ'</b> অথবা <b>'❌ কাজটি বাতিল করুন'</b> এ ক্লিক করুন।`);
    return;
  }

  // ====================================================
  // --- Facebook Hotmaill 0fd cookie Workflow Steps ---
  // ====================================================

  // --- FB Hotmail 0fd Step 1: Awaiting UID ---
  if (state.step === "awaiting_fb_hotmail_0fd_uid") {
    if (text === "❌ কাজটি বাতিল করুন" || text === "❌ বাতিল করুন") {
      state.step = "main_menu";
      state.fbHotmail0fdData = undefined;
      userStates.set(chatId, state);
      await bot.sendMessage(chatId, "❌ Facebook Hotmaill 0fd cookie কাজটি বাতিল করা হয়েছে।");
      await showMainMenu(bot, chatId, profile);
      return;
    }

    if (text === "Send UID") {
      await bot.sendMessage(chatId, `👤 অনুগ্রহ করে আপনার ফেসবুক ইউ আই ডি <b>(Facebook UID)</b> টি নিচে লিখে পাঠান:`, {
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [[{ text: "❌ কাজটি বাতিল করুন", style: "danger" }]],
          resize_keyboard: true
        } as any
      });
      return;
    }

    const cleanedUID = text.replace(/\s+/g, "");
    const isDigits = /^\d{10,25}$/.test(cleanedUID);
    if (!isDigits) {
      await bot.sendMessage(chatId, `❌ <b>ভুল ইউ আই ডি!</b> অনুগ্রহ করে সঠিক ফেসবুক ইউ আই ডি (Facebook UID) প্রদান করুন (স্পেস ছাড়া শুধু সংখ্যা):`, {
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [[{ text: "❌ কাজটি বাতিল করুন", style: "danger" }]],
          resize_keyboard: true
        } as any
      });
      return;
    }

    // Check if this UID is already pending in the database
    let isPending = false;
    try {
      const submissionsRef = collection(db, "submissions");
      const qUid = query(submissionsRef, where("uid", "==", cleanedUID), limit(10));
      const snapUid = await getDocs(qUid);
      snapUid.forEach(docSnap => {
        if (docSnap.data().status === "pending") {
          isPending = true;
        }
      });

      if (!isPending) {
        const qUser = query(submissionsRef, where("username", "==", cleanedUID), limit(10));
        const snapUser = await getDocs(qUser);
        snapUser.forEach(docSnap => {
          if (docSnap.data().status === "pending") {
            isPending = true;
          }
        });
      }
    } catch (err) {
      console.error("Error checking duplicate pending UID for fb_hotmail_0fd:", err);
    }

    if (isPending) {
      await bot.sendMessage(chatId, `❌ <b>এই আইডিটি জমা দেওয়া যাবে না!</b>\n\nএই ইউআইডি (UID) টি প্যানেলে বর্তমানে পেন্ডিং অবস্থায় রয়েছে। এটি দ্বিতীয়বার সাবমিট করা যাবে না।\n\nঅনুগ্রহ করে একটি ভিন্ন ইউআইডি (UID) সাবমিট করুন:`, {
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [[{ text: "❌ কাজটি বাতিল করুন", style: "danger" }]],
          resize_keyboard: true
        } as any
      });
      return;
    }

    if (state.fbHotmail0fdData) {
      state.fbHotmail0fdData.uid = cleanedUID;
    }
    state.step = "awaiting_fb_hotmail_0fd_cookie";
    userStates.set(chatId, state);

    await bot.sendMessage(chatId, `🍪 ইউ আই ডি সফলভাবে সেট হয়েছে!\n\nএখন অনুগ্রহ করে আপনার ফেসবুক কুকি <b>(Facebook Cookie)</b> টি নিচে লিখে বা পেস্ট করে পাঠান:`, {
      parse_mode: "HTML",
      reply_markup: {
        keyboard: [[{ text: "❌ কাজটি বাতিল করুন", style: "danger" }]],
        resize_keyboard: true
      } as any
    });
    return;
  }

  // --- FB Hotmail 0fd Step 2: Awaiting Cookie ---
  if (state.step === "awaiting_fb_hotmail_0fd_cookie") {
    if (text === "❌ কাজটি বাতিল করুন" || text === "❌ বাতিল করুন") {
      state.step = "main_menu";
      state.fbHotmail0fdData = undefined;
      userStates.set(chatId, state);
      await bot.sendMessage(chatId, "❌ Facebook Hotmaill 0fd cookie কাজটি বাতিল করা হয়েছে।");
      await showMainMenu(bot, chatId, profile);
      return;
    }

    if (!text || text.trim().length < 5) {
      await bot.sendMessage(chatId, `⚠️ <b>ভুল কুকি!</b> অনুগ্রহ করে একটি সঠিক ফেসবুক কুকি (Facebook Cookie) লিখে বা পেস্ট করে পাঠান:`, {
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [[{ text: "❌ কাজটি বাতিল করুন", style: "danger" }]],
          resize_keyboard: true
        } as any
      });
      return;
    }

    if (state.fbHotmail0fdData) {
      state.fbHotmail0fdData.cookie = text.trim();
    }
    state.step = "awaiting_fb_hotmail_0fd_token";
    userStates.set(chatId, state);

    await bot.sendMessage(chatId, `📧 কুকি সফলভাবে গ্রহণ করা হয়েছে!\n\nএখন অনুগ্রহ করে আপনার <b>Hotmail এর ফুল টোকেন (Hotmail Full Token)</b> টি নিচে লিখে বা পেস্ট করে পাঠান:`, {
      parse_mode: "HTML",
      reply_markup: {
        keyboard: [[{ text: "❌ কাজটি বাতিল করুন", style: "danger" }]],
        resize_keyboard: true
      } as any
    });
    return;
  }

  // --- FB Hotmail 0fd Step 3: Awaiting Hotmail Full Token ---
  if (state.step === "awaiting_fb_hotmail_0fd_token") {
    if (text === "❌ কাজটি বাতিল করুন" || text === "❌ বাতিল করুন") {
      state.step = "main_menu";
      state.fbHotmail0fdData = undefined;
      userStates.set(chatId, state);
      await bot.sendMessage(chatId, "❌ Facebook Hotmaill 0fd cookie কাজটি বাতিল করা হয়েছে।");
      await showMainMenu(bot, chatId, profile);
      return;
    }

    if (!text || text.trim().length < 5) {
      await bot.sendMessage(chatId, `⚠️ <b>ভুল Hotmail টোকেন!</b> অনুগ্রহ করে Hotmail এর ফুল টোকেন লিখে বা পেস্ট করে পাঠান:`, {
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [[{ text: "❌ কাজটি বাতিল করুন", style: "danger" }]],
          resize_keyboard: true
        } as any
      });
      return;
    }

    if (state.fbHotmail0fdData) {
      state.fbHotmail0fdData.hotmailToken = text.trim();
    }
    state.step = "awaiting_fb_hotmail_0fd_complete";
    userStates.set(chatId, state);

    await bot.sendMessage(chatId, `✅ Hotmail ফুল টোকেন সফলভাবে গ্রহণ করা হয়েছে!\n\nকাজটি সম্পূর্ণ ও জমা করতে নিচে <b>'✅ কাজ সম্পূর্ণ'</b> বাটনে ক্লিক করুন:`, {
      parse_mode: "HTML",
      reply_markup: {
        keyboard: [
          [{ text: "✅ কাজ সম্পূর্ণ", style: "success" }],
          [{ text: "❌ কাজটি বাতিল করুন", style: "danger" }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      } as any
    });
    return;
  }

  // --- FB Hotmail 0fd Step 4: Awaiting Complete ---
  if (state.step === "awaiting_fb_hotmail_0fd_complete") {
    if (text === "❌ কাজটি বাতিল করুন" || text === "❌ বাতিল করুন") {
      state.step = "main_menu";
      state.fbHotmail0fdData = undefined;
      userStates.set(chatId, state);
      await bot.sendMessage(chatId, "❌ Facebook Hotmaill 0fd cookie কাজটি বাতিল করা হয়েছে।");
      await showMainMenu(bot, chatId, profile);
      return;
    }

    if (text === "✅ কাজ সম্পূর্ণ" || text === "কাজ সম্পূর্ণ") {
      const fd = state.fbHotmail0fdData;
      if (!fd || !fd.uid || !fd.cookie || !fd.hotmailToken) {
        await bot.sendMessage(chatId, "❌ তথ্য পাওয়া যায়নি বা অপূর্ণ। অনুগ্রহ করে নতুন করে কাজ শুরু করুন।");
        state.step = "main_menu";
        state.fbHotmail0fdData = undefined;
        userStates.set(chatId, state);
        await showMainMenu(bot, chatId, profile);
        return;
      }

      // Check duplicate pending UID
      let isPending = false;
      try {
        const submissionsRef = collection(db, "submissions");
        const qUid = query(submissionsRef, where("uid", "==", fd.uid), limit(10));
        const snapUid = await getDocs(qUid);
        snapUid.forEach(docSnap => {
          if (docSnap.data().status === "pending") {
            isPending = true;
          }
        });
      } catch (err) {
        console.error("Error checking duplicate pending FB Hotmail 0fd UID on complete:", err);
      }

      if (isPending) {
        await bot.sendMessage(chatId, `❌ <b>এই ইউআইডি (UID) টি বর্তমানে পেন্ডিং রয়েছে!</b>\n\nএই আইডিটি প্যানেলে ইতিমধ্যে পেন্ডিং অবস্থায় জমা রয়েছে। তাই এটি পুনরায় সাবমিট করা যাবে না। অনুগ্রহ করে অন্য একটি ভিন্ন ইউআইডি সাবমিট করুন।`, {
          parse_mode: "HTML"
        });
        state.step = "main_menu";
        state.fbHotmail0fdData = undefined;
        userStates.set(chatId, state);
        await showMainMenu(bot, chatId, profile);
        return;
      }

      // Get current settings
      const settings = await getGlobalSettings();
      const fbHotmail0fdRate = settings?.fbHotmail0fdRatePerId !== undefined 
        ? settings.fbHotmail0fdRatePerId 
        : (settings?.fbHotmailRatePerId !== undefined ? settings.fbHotmailRatePerId : (settings?.facebookRatePerId !== undefined ? settings.facebookRatePerId : (settings?.ratePerId || 40)));

      const newSub = {
        username: fd.uid,
        password: fd.password || "",
        twoFactorKey: "",
        uid: fd.uid,
        cookie: fd.cookie,
        hotmailToken: fd.hotmailToken,
        firstName: fd.firstName || "",
        lastName: fd.lastName || "",
        category: 'fb_hotmail_0fd' as const,
        submittedBy: profile.walletNumber || String(chatId),
        telegramChatId: String(chatId),
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
        rate: fbHotmail0fdRate
      };

      await addDoc(collection(db, "submissions"), newSub);

      const escapeHtml = (unsafe: string = "") => {
        return String(unsafe)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      };

      // Notify Web Admin via Telegram
      const adminText = `🔥 <b>নতুন Facebook Hotmaill 0fd কাজ জমা (New FB Hotmail 0fd Submission)</b> 🔥\n\n` +
                        `👤 <b>First Name:</b> <code>${escapeHtml(fd.firstName)}</code>\n` +
                        `👤 <b>Last Name:</b> <code>${escapeHtml(fd.lastName)}</code>\n` +
                        `🔑 <b>Password:</b> <code>${escapeHtml(fd.password)}</code>\n` +
                        `🆔 <b>UID:</b> <code>${escapeHtml(fd.uid)}</code>\n` +
                        `🍪 <b>Cookie:</b> <code>${escapeHtml(fd.cookie)}</code>\n` +
                        `📧 <b>Hotmail Token:</b> <code>${escapeHtml(fd.hotmailToken)}</code>\n` +
                        `💵 <b>Rate:</b> ${fbHotmail0fdRate} Taka\n` +
                        `👤 <b>Submitted By:</b> <code>${profile.walletNumber || chatId}</code> (Bot)\n` +
                        `📅 <b>Time:</b> ${new Date().toLocaleString()}`;

      if (settings.telegramBotToken && settings.telegramChatId) {
        try {
          await bot.sendMessage(settings.telegramChatId, adminText, { parse_mode: "HTML" });
        } catch (err) {
          console.warn("Error notifying admin:", err);
        }
      }

      await bot.sendMessage(chatId, `🎉 <b>আপনার Facebook Hotmaill 0fd cookie কাজ সফলভাবে জমা হয়েছে!</b>\n\n⏳ এডমিন চেক করার পর ব্যালেন্সে ৳${fbHotmail0fdRate} Taka যোগ হবে।`);
      
      state.step = "main_menu";
      state.fbHotmail0fdData = undefined;
      userStates.set(chatId, state);
      await showMainMenu(bot, chatId, profile);
      return;
    }

    await bot.sendMessage(chatId, `⚠️ অনুগ্রহ করে <b>'✅ কাজ সম্পূর্ণ'</b> অথবা <b>'❌ কাজটি বাতিল করুন'</b> এ ক্লিক করুন।`);
    return;
  }

  // --- 6. Step: Awaiting Instagram 2FA Secret Key / Setup ---
  if (state.step === "awaiting_instagram_2fa_key") {
    if (text === "❌ কাজটি বাতিল করুন" || text === "❌ বাতিল করুন") {
      await cleanUpInstagramMessages(bot, chatId, state);
      await bot.sendMessage(chatId, "❌ ইনস্টাগ্রাম কাজটি বাতিল করা হয়েছে এবং পাসওয়ার্ড মেসেজ মুছে দেওয়া হয়েছে।");

      state.step = "main_menu";
      state.instagramData = undefined;
      userStates.set(chatId, state);
      await showMainMenu(bot, chatId, profile);
      return;
    }

    if (text === "✅ অ্যাকাউন্ট খোলা শেষ") {
      const username = state.instagramData?.username;
      const password = state.instagramData?.password;
      const twoFactorKey = state.instagramData?.twoFactorKey;

      if (!username || !password || !twoFactorKey) {
        await bot.sendMessage(chatId, "❌ তথ্য পাওয়া যায়নি। অনুগ্রহ করে নতুন করে কাজ শুরু করুন।");
        await cleanUpInstagramMessages(bot, chatId, state);
        state.step = "main_menu";
        state.instagramData = undefined;
        userStates.set(chatId, state);
        await showMainMenu(bot, chatId, profile);
        return;
      }

      // Check if this Instagram username is already pending in the database
      let isPending = false;
      try {
        const submissionsRef = collection(db, "submissions");
        const qUser = query(submissionsRef, where("username", "==", username), limit(10));
        const snapUser = await getDocs(qUser);
        snapUser.forEach(docSnap => {
          if (docSnap.data().status === "pending") {
            isPending = true;
          }
        });
      } catch (err) {
        console.error("Error checking duplicate pending Instagram account:", err);
      }

      if (isPending) {
        await bot.sendMessage(chatId, `❌ <b>এই ইনস্টাগ্রাম আইডিটি বর্তমানে পেন্ডিং রয়েছে!</b>\n\nএই আইডিটি (<code>${username}</code>) প্যানেলে ইতিমধ্যে পেন্ডিং অবস্থায় জমা রয়েছে। এটি দ্বিতীয়বার সাবমিট করা যাবে না। অনুগ্রহ করে অন্য একটি নতুন আইডি তৈরি করে সাবমিট করুন।`, {
          parse_mode: "HTML"
        });
        await cleanUpInstagramMessages(bot, chatId, state);
        state.step = "main_menu";
        state.instagramData = undefined;
        userStates.set(chatId, state);
        await showMainMenu(bot, chatId, profile);
        return;
      }

      // Get current rate
      const settings = await getGlobalSettings();
      const ratePerId = settings.ratePerId || 45;

      const newSub = {
        username,
        password,
        twoFactorKey,
        submittedBy: profile.walletNumber || String(chatId),
        telegramChatId: String(chatId),
        status: 'pending',
        createdAt: new Date().toISOString(),
        category: 'instagram' as const,
        rate: ratePerId
      };

      await addDoc(collection(db, "submissions"), newSub);

      const escapeHtml = (unsafe: string = "") => {
        return String(unsafe)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      };

      // Notify Web Admin via Telegram
      const adminText = `🎉 <b>নতুন আইডি জমা (Bot)</b> 🎉\n\n` +
                        `👤 <b>Username:</b> <code>${escapeHtml(username)}</code>\n` +
                        `🔑 <b>Password:</b> <code>${escapeHtml(password)}</code>\n` +
                        `🛡️ <b>2FA Secret:</b> <code>${escapeHtml(twoFactorKey)}</code>\n` +
                        `💵 <b>Rate:</b> ${ratePerId} Taka\n` +
                        `👤 <b>Submitted By:</b> <code>${profile.walletNumber || chatId}</code> (Bot)\n` +
                        `📅 <b>Time:</b> ${new Date().toLocaleString()}\n\n` +
                        ` can check in admin dashboard!`;

      if (settings.telegramBotToken && settings.telegramChatId) {
        try {
          await bot.sendMessage(settings.telegramChatId, adminText, { parse_mode: "HTML" });
        } catch (err) {
          console.warn("Error notifying admin:", err);
        }
      }

      // Cleanup generated credentials & TOTP codes to keep it secure as requested!
      await cleanUpInstagramMessages(bot, chatId, state);

      await bot.sendMessage(chatId, `🎉 <b>অ্যাকাউন্ট সফলভাবে জমা হয়েছে!</b>\n\n⏳ এডমিন চেক করার পর ব্যালেন্সে ৳${ratePerId} Taka যোগ হবে।`);
      
      state.step = "main_menu";
      state.instagramData = undefined;
      userStates.set(chatId, state);
      await showMainMenu(bot, chatId, profile);
      return;
    }

    if (text === "🛡️ টু-এফএ সেট করুন") {
      const promptMsg = await bot.sendMessage(chatId, `🔑 অনুগ্রহ করে আপনার ইনস্টাগ্রামের <b>২-ফ্যাক্টর কি (2FA Secret Key)</b> টি নিচে লিখে বা পেস্ট করে পাঠান:`, {
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [[{ text: "❌ কাজটি বাতিল করুন", style: "danger" }]],
          resize_keyboard: true
        } as any
      });

      if (state.instagramData) {
        state.instagramData.promptMsgId = promptMsg.message_id;
      }
      userStates.set(chatId, state);
      return;
    }

    // Treat as inputting 2FA key
    const cleanedKey = text.replace(/\s+/g, "");
    const totpCode = generateTOTP(cleanedKey);

    if (totpCode === "INVALID_KEY") {
      const errorPrompt = await bot.sendMessage(chatId, `❌ <b>ভুল ২-ফ্যাক্টর সিক্রেট কি!</b> অনুগ্রহ করে একটি সঠিক ও সচল 2FA Secret Key দিন (স্পেস ছাড়া):`, {
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [[{ text: "❌ কাজটি বাতিল করুন", style: "danger" }]],
          resize_keyboard: true
        } as any
      });
      if (state.instagramData) {
        state.instagramData.promptMsgId = errorPrompt.message_id;
      }
      userStates.set(chatId, state);
      return;
    }

    // Key is valid, show TOTP and offer completion keyboard
    const codeMsg = await bot.sendMessage(chatId, `🛡️ <b>আপনার ২-ফ্যাক্টর সিকিউরিটি ভেরিফিকেশন কোড:</b>\n\n🔑 <code>${totpCode}</code>\n\n<i>(কোডটি কপি করে ইনস্টাগ্রাম অ্যাপে ভেরিফিকেশন সম্পন্ন করুন। কোডটি প্রতি ৩০ সেকেন্ড পর পর পরিবর্তন হয়)</i>`, {
      parse_mode: "HTML",
      reply_markup: {
        keyboard: [
          [{ text: "✅ অ্যাকাউন্ট খোলা শেষ", style: "success" }],
          [{ text: "❌ কাজটি বাতিল করুন", style: "danger" }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      } as any
    });

    state.instagramData = {
      ...state.instagramData,
      twoFactorKey: cleanedKey,
      promptMsgId: codeMsg.message_id
    };
    userStates.set(chatId, state);
    return;
  }

  // --- Step: Awaiting Independent 2FA Secret Key ---
  if (state.step === "awaiting_independent_2fa_key") {
    if (text === "🔙 মেইন মেনু" || text === "❌ কাজটি বাতিল করুন" || text === "❌ বাতিল করুন") {
      state.step = "main_menu";
      userStates.set(chatId, state);
      await showMainMenu(bot, chatId, profile);
      return;
    }

    const cleanedKey = text.replace(/\s+/g, "");
    const totpCode = generateTOTP(cleanedKey);

    if (totpCode === "INVALID_KEY") {
      await bot.sendMessage(chatId, 
        `❌ <b>ভুল ২-ফ্যাক্টর সিক্রেট কি!</b> অনুগ্রহ করে একটি সঠিক ও সচল 2FA Secret Key দিন (স্পেস ছাড়া):`, 
        {
          parse_mode: "HTML",
          reply_markup: {
            keyboard: [[{ text: "🔙 মেইন মেনু", style: "danger" }]],
            resize_keyboard: true
          } as any
        }
      );
      return;
    }

    // Key is valid, show TOTP and stay in same state so they can generate codes again or go back
    await bot.sendMessage(chatId, 
      `🛡️ <b>আপনার ২-ফ্যাক্টর সিকিউরিটি ভেরিফিকেশন কোড:</b>\n\n🔑 <code>${totpCode}</code>\n\n<i>(কোডটি কপি করতে কোডের ওপর ক্লিক করুন। এটি প্রতি ৩০ সেকেন্ড পর পর পরিবর্তন হয়)</i>`, 
      {
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [
            [{ text: "🔙 মেইন মেনু", style: "danger" }],
            [{ text: "📞 সাপোর্ট", style: "primary" }]
          ],
          resize_keyboard: true
        } as any
      }
    );
    return;
  }

  // --- Step: Awaiting Withdraw Balance Type ---
  if (state.step === "awaiting_withdraw_balance_type") {
    if (text === "🔙 মেইন মেনু" || text === "❌ বাতিল করুন") {
      state.step = "main_menu";
      state.withdrawData = undefined;
      userStates.set(chatId, state);
      await showMainMenu(bot, chatId, profile);
      return;
    }

    const settings = await getGlobalSettings();
    const stats = await getUserStats(profile.walletNumber || "", profile.telegramChatId);

    let chosenType: 'main' | 'referral' | null = null;
    if (text.includes("মূল ব্যালেন্স") || text.toLowerCase().includes("main")) {
      chosenType = 'main';
    } else if (text.includes("রেফার ব্যালেন্স") || text.toLowerCase().includes("referral")) {
      chosenType = 'referral';
    }

    if (!chosenType) {
      await bot.sendMessage(chatId, `❌ অনুগ্রহ করে নিচের কীবোর্ড থেকে কোনো একটি ব্যালেন্স বেছে নিন:`, {
        reply_markup: {
          keyboard: [
            [
              { text: `💼 মূল ব্যালেন্স (৳${stats.balance})`, style: "success" },
              { text: `👥 রেফার ব্যালেন্স (৳${stats.referralBalance})`, style: "primary" }
            ],
            [{ text: "🔙 মেইন মেনু", style: "danger" }]
          ],
          resize_keyboard: true
        } as any
      });
      return;
    }

    if (chosenType === 'main') {
      const minW = settings.minWithdraw !== undefined ? settings.minWithdraw : 50;
      if (stats.balance < minW) {
        await bot.sendMessage(chatId, `❌ <b>দুঃখিত! মূল ব্যালেন্স উত্তোলনের সীমা পূরণ হয়নি।</b>\n\nমূল ব্যালেন্স থেকে টাকা তুলতে সর্বনিম্ন ৳<b>${minW}</b> Taka থাকতে হবে।\nবর্তমানে আপনার মূল ব্যালেন্স: ৳<b>${stats.balance}</b> Taka।`, {
          parse_mode: "HTML",
          reply_markup: getMainMenuReplyMarkup(chatId) as any
        });
        state.step = "main_menu";
        state.withdrawData = undefined;
        userStates.set(chatId, state);
        return;
      }
    } else if (chosenType === 'referral') {
      const minRefW = settings.minReferralWithdrawLimit !== undefined ? settings.minReferralWithdrawLimit : 500;
      if (stats.referralBalance < minRefW) {
        await bot.sendMessage(chatId, `❌ <b>দুঃখিত! রেফার ব্যালেন্স উত্তোলনের সীমা পূরণ হয়নি।</b>\n\nরেফার ব্যালেন্স থেকে টাকা তুলতে সর্বনিম্ন ৳<b>${minRefW}</b> Taka থাকতে হবে।\nবর্তমানে আপনার রেফার ব্যালেন্স: ৳<b>${stats.referralBalance}</b> Taka।\n\n💡 আপনার বন্ধুরা বটে জয়েন করলে পাবেন আকর্ষণীয় রেফার বোনাস!`, {
          parse_mode: "HTML",
          reply_markup: getMainMenuReplyMarkup(chatId) as any
        });
        state.step = "main_menu";
        state.withdrawData = undefined;
        userStates.set(chatId, state);
        return;
      }
    }

    state.withdrawData = { balanceType: chosenType };
    state.step = "awaiting_withdraw_method";
    userStates.set(chatId, state);

    const bkashActive = settings.bkashEnabled !== false;
    const nagadActive = settings.nagadEnabled !== false;
    const rocketActive = settings.rocketEnabled !== false;

    const keyboardRows = [
      [
        { text: bkashActive ? "বিকাশ (bKash)" : "বিকাশ (bKash) ❌ (বন্ধ)", style: "primary" },
        { text: nagadActive ? "নগদ (Nagad)" : "নগদ (Nagad) ❌ (বন্ধ)", style: "primary" }
      ],
      [
        { text: rocketActive ? "রকেট (Rocket)" : "রকেট (Rocket) ❌ (বন্ধ)", style: "primary" }
      ],
      [{ text: "🔙 মেইন মেনু", style: "danger" }]
    ];

    const typeTitle = chosenType === 'referral' ? '👥 রেফার ব্যালেন্স' : '💼 মূল ব্যালেন্স';
    await bot.sendMessage(chatId, `🏦 <b>টাকা উত্তোলন (${typeTitle})</b>\n\nকোন মাধ্যমে টাকা উত্তোলন করতে চান? অনুগ্রহ করে নিচে থেকে একটি মাধ্যমে ক্লিক করুন:`, {
      parse_mode: "HTML",
      reply_markup: {
        keyboard: keyboardRows,
        resize_keyboard: true,
        one_time_keyboard: true
      } as any
    });
    return;
  }

  // --- Step: Awaiting Withdraw Method ---
  if (state.step === "awaiting_withdraw_method") {
    if (text === "🔙 মেইন মেনু" || text === "❌ বাতিল করুন") {
      state.step = "main_menu";
      state.withdrawData = undefined;
      userStates.set(chatId, state);
      await showMainMenu(bot, chatId, profile);
      return;
    }

    let selectedMethod: 'bKash' | 'Nagad' | 'Rocket' | null = null;
    if (text.includes("bKash") || text.includes("বিকাশ")) {
      selectedMethod = 'bKash';
    } else if (text.includes("Nagad") || text.includes("নগদ")) {
      selectedMethod = 'Nagad';
    } else if (text.includes("Rocket") || text.includes("রকেট")) {
      selectedMethod = 'Rocket';
    }

    const settings = await getGlobalSettings();
    const bkashActive = settings?.bkashEnabled !== false;
    const nagadActive = settings?.nagadEnabled !== false;
    const rocketActive = settings?.rocketEnabled !== false;

    if (!selectedMethod) {
      await bot.sendMessage(chatId, `❌ অনুগ্রহ করে নিচের কীবোর্ড থেকে সঠিক ওয়ালেট ধরণটি বেছে নিন:`, {
        reply_markup: {
          keyboard: [
            [
              { text: bkashActive ? "বিকাশ (bKash)" : "বিকাশ (bKash) ❌ (বন্ধ)", style: "primary" },
              { text: nagadActive ? "নগদ (Nagad)" : "নগদ (Nagad) ❌ (বন্ধ)", style: "primary" }
            ],
            [
              { text: rocketActive ? "রকেট (Rocket)" : "রকেট (Rocket) ❌ (বন্ধ)", style: "primary" }
            ],
            [{ text: "🔙 মেইন মেনু", style: "danger" }]
          ],
          resize_keyboard: true
        } as any
      });
      return;
    }

    // Active method list
    const activeMethods: string[] = [];
    if (bkashActive) activeMethods.push("বিকাশ (bKash)");
    if (nagadActive) activeMethods.push("নগদ (Nagad)");
    if (rocketActive) activeMethods.push("রকেট (Rocket)");

    // Check if selected method is disabled
    let isMethodDisabled = false;
    let disabledMethodName = "";
    if (selectedMethod === 'bKash' && !bkashActive) {
      isMethodDisabled = true;
      disabledMethodName = "বিকাশ (bKash)";
    } else if (selectedMethod === 'Nagad' && !nagadActive) {
      isMethodDisabled = true;
      disabledMethodName = "নগদ (Nagad)";
    } else if (selectedMethod === 'Rocket' && !rocketActive) {
      isMethodDisabled = true;
      disabledMethodName = "রকেট (Rocket)";
    }

    if (isMethodDisabled) {
      let activeText = "";
      if (activeMethods.length === 0) {
        activeText = "বর্তমানে সব ধরণের পেমেন্ট মাধ্যমে উত্তোলন বন্ধ রয়েছে।";
      } else if (activeMethods.length === 1) {
        activeText = `বর্তমানে শুধুমাত্র <b>${activeMethods[0]}</b> এর মাধ্যমে টাকা উত্তোলন চালু আছে।`;
      } else {
        activeText = `বর্তমানে <b>${activeMethods.join(" এবং ")}</b> এর মাধ্যমে টাকা উত্তোলন চালু আছে।`;
      }

      await bot.sendMessage(chatId, `⚠️ <b>দুঃখিত! ${disabledMethodName} উইথড্র বর্তমানে বন্ধ রয়েছে।</b>\n\n${activeText}\n\nঅনুগ্রহ করে চালু থাকা অন্য কোনো মাধ্যম বেছে নিন:`, {
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [
            [
              { text: bkashActive ? "বিকাশ (bKash)" : "বিকাশ (bKash) ❌ (বন্ধ)", style: "primary" },
              { text: nagadActive ? "নগদ (Nagad)" : "নগদ (Nagad) ❌ (বন্ধ)", style: "primary" }
            ],
            [
              { text: rocketActive ? "রকেট (Rocket)" : "রকেট (Rocket) ❌ (বন্ধ)", style: "primary" }
            ],
            [{ text: "🔙 মেইন মেনু", style: "danger" }]
          ],
          resize_keyboard: true
        } as any
      });
      return;
    }

    state.withdrawData = { ...state.withdrawData, method: selectedMethod };
    state.step = "awaiting_withdraw_number";
    userStates.set(chatId, state);

    await bot.sendMessage(chatId, `🏦 আপনি <b>${selectedMethod}</b> সিলেক্ট করেছেন।\n\n📱 অনুগ্রহ করে আপনার সচল ১১-ডিজিটের <b>${selectedMethod}</b> অ্যাকাউন্ট নাম্বারটি লিখে পাঠান:`, {
      parse_mode: "HTML",
      reply_markup: {
        keyboard: [[{ text: "🔙 মেইন মেনু", style: "danger" }]],
        resize_keyboard: true,
        one_time_keyboard: true
      } as any
    });
    return;
  }

  // --- Step: Awaiting Withdraw Number ---
  if (state.step === "awaiting_withdraw_number") {
    if (text === "🔙 মেইন মেনু" || text === "❌ বাতিল করুন") {
      state.step = "main_menu";
      state.withdrawData = undefined;
      userStates.set(chatId, state);
      await showMainMenu(bot, chatId, profile);
      return;
    }

    const walletNum = text.replace(/\D/g, "");
    if (walletNum.length !== 11 || !walletNum.startsWith("01")) {
      await bot.sendMessage(chatId, `❌ <b>ভুল নাম্বার!</b> সঠিক ১১ ডিজিটের মোবাইল ব্যাংকিং নাম্বারটি লিখে পাঠান (যেমন: 017XXXXXXXX):`, {
        reply_markup: {
          keyboard: [[{ text: "🔙 মেইন মেনু", style: "danger" }]],
          resize_keyboard: true
        } as any
      });
      return;
    }

    state.withdrawData = { ...state.withdrawData, number: walletNum };
    state.step = "awaiting_withdraw_amount";
    userStates.set(chatId, state);

    // Update user payout details in Firestore without overwriting existing walletNumber / user ID
    try {
      const profilesRef = collection(db, "profiles");
      const q = query(profilesRef, where("telegramChatId", "==", String(chatId)), limit(1));
      const qSnap = await getDocs(q);
      if (!qSnap.empty) {
        const pDocData = qSnap.docs[0].data();
        const existingWalletNumber = pDocData.walletNumber;

        const updateData: any = {
          payoutNumber: walletNum,
          walletType: state.withdrawData?.method || "bKash"
        };

        // Only set walletNumber if the user didn't have one set before
        if (!existingWalletNumber || existingWalletNumber.trim() === "") {
          updateData.walletNumber = walletNum;
          profile.walletNumber = walletNum;
        }

        await updateDoc(qSnap.docs[0].ref, updateData);
        profile.payoutNumber = walletNum;
        profile.walletType = state.withdrawData?.method || "bKash";
        console.log(`Updated payout info for chatId ${chatId}. Preserved walletNumber: ${profile.walletNumber || walletNum}`);
        invalidateProfileCache(String(chatId));
      }
    } catch (err) {
      console.error("Error updating profile payout info:", err);
    }

    const stats = await getUserStats(profile.walletNumber || "", profile.telegramChatId);
    const isReferral = state.withdrawData?.balanceType === 'referral';
    const currentBal = isReferral ? stats.referralBalance : stats.balance;
    const typeLabel = isReferral ? 'রেফার ব্যালেন্স' : 'উত্তোলনের মূল ব্যালেন্স';

    await bot.sendMessage(chatId, `📱 <b>নাম্বার সেট হয়েছে:</b> <code>${walletNum}</code> (${state.withdrawData.method})\n` +
                                 `💵 <b>আপনার ${typeLabel}:</b> ৳<b>${currentBal}</b> Taka\n\n` +
                                 `💰 আপনি কত টাকা উত্তোলন করতে চান? অনুগ্রহ করে শুধুমাত্র সংখ্যায় পরিমাণটি লিখে পাঠান (যেমন: ৫০০):`, {
      parse_mode: "HTML",
      reply_markup: {
        keyboard: [[{ text: "🔙 মেইন মেনু", style: "danger" }]],
        resize_keyboard: true,
        one_time_keyboard: true
      } as any
    });
    return;
  }

  // --- Step: Awaiting Withdraw Amount ---
  if (state.step === "awaiting_withdraw_amount") {
    const settings = await getGlobalSettings();

    if (settings.withdrawalsEnabled === false) {
      state.step = "main_menu";
      state.withdrawData = undefined;
      userStates.set(chatId, state);
      await bot.sendMessage(chatId, `⚠️ <b>দুঃখিত!</b>\n\nএডমিন কর্তৃক বর্তমানে টাকা উত্তোলন সাময়িকভাবে বন্ধ রাখা হয়েছে। আপনার উইথড্র প্রক্রিয়াটি বাতিল করা হলো। অনুগ্রহ করে পরে আবার চেষ্টা করুন। ধন্যবাদ!`, { parse_mode: "HTML" });
      await showMainMenu(bot, chatId, profile);
      return;
    }

    if (text === "🔙 মেইন মেনু" || text === "❌ বাতিল করুন") {
      state.step = "main_menu";
      state.withdrawData = undefined;
      userStates.set(chatId, state);
      await showMainMenu(bot, chatId, profile);
      return;
    }

    const amount = parseFloat(text.replace(/\D/g, ""));
    if (isNaN(amount) || amount <= 0) {
      await bot.sendMessage(chatId, `❌ <b>ভুল পরিমাণ!</b> শুধুমাত্র সংখ্যায় পরিমাণটি লিখুন (যেমন: ৫০০):`, {
        reply_markup: {
          keyboard: [[{ text: "🔙 মেইন মেনু", style: "danger" }]],
          resize_keyboard: true
        } as any
      });
      return;
    }

    const isReferral = state.withdrawData?.balanceType === 'referral';
    const minWithdrawLimit = isReferral 
      ? (settings.minReferralWithdrawLimit !== undefined ? settings.minReferralWithdrawLimit : 500)
      : (settings.minWithdraw !== undefined ? settings.minWithdraw : 50);

    if (amount < minWithdrawLimit) {
      await bot.sendMessage(chatId, `❌ <b>কম পরিমাণের উইথড্র!</b>\n\n${isReferral ? 'রেফার' : 'মূল'} ব্যালেন্স থেকে সর্বনিম্ন উইথড্র পরিমাণ হলো ৳<b>${minWithdrawLimit}</b> Taka। আপনার প্রদানকৃত পরিমাণ: ৳<b>${amount}</b> Taka।\n\nঅনুগ্রহ করে ৳<b>${minWithdrawLimit}</b> Taka বা তার বেশি পরিমাণ লিখে পাঠান:`, {
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [[{ text: "🔙 মেইন মেনু", style: "danger" }]],
          resize_keyboard: true
        } as any
      });
      return;
    }

    const stats = await getUserStats(profile.walletNumber || "", profile.telegramChatId);
    const availableBal = isReferral ? stats.referralBalance : stats.balance;

    if (amount > availableBal) {
      await bot.sendMessage(chatId, `❌ <b>পর্যাপ্ত ব্যালেন্স নেই!</b>\n\nআপনার সর্বোচ্চ উইথড্রযোগ্য ${isReferral ? 'রেফার' : 'মূল'} ব্যালেন্স: ৳${availableBal} Taka`, {
        reply_markup: {
          keyboard: [[{ text: "🔙 মেইন মেনু", style: "danger" }]],
          resize_keyboard: true
        } as any
      });
      return;
    }

    // Save withdrawal
    const method = state.withdrawData?.method || 'bKash';
    const num = state.withdrawData?.number || '';
    const balanceType = state.withdrawData?.balanceType || 'main';
    const userIdOrWallet = profile.walletNumber || String(chatId);
    const newW = {
      method: method,
      number: num,
      amount: amount,
      balanceType: balanceType,
      status: 'pending',
      createdAt: new Date().toISOString(),
      submittedBy: userIdOrWallet,
      telegramChatId: String(chatId)
    };

    await addDoc(collection(db, "withdrawals"), newW);

    // Notify Admin via Telegram
    const adminText = `💸 <b>নতুন পেমেন্ট উইথড্র অনুরোধ (Bot)</b> 💸\n\n` +
                      `👤 <b>ইউজার চ্যাট আইডি:</b> <code>${chatId}</code>\n` +
                      `🏷️ <b>উৎস:</b> ${balanceType === 'referral' ? '🎁 রেফার ব্যালেন্স' : '💼 মূল ব্যালেন্স'}\n` +
                      `🏦 <b>মাধ্যম:</b> ${method}\n` +
                      `📱 <b>অ্যাকাউন্ট:</b> <code>${num}</code>\n` +
                      `💵 <b>পরিমাণ:</b> ৳${amount} Taka\n` +
                      `📅 <b>সময়:</b> ${new Date().toLocaleString()}\n\n` +
                      `চেক করুন এবং অনুমোদন করুন!`;

    if (settings && settings.telegramBotToken && settings.telegramChatId) {
      try {
        await bot.sendMessage(settings.telegramChatId, adminText, { parse_mode: "HTML" });
      } catch (err) {
        console.warn("Error notifying admin:", err);
      }
    }

    await bot.sendMessage(
      chatId,
      `✅ <b>উত্তোলন অনুরোধ সফলভাবে জমা হয়েছে!</b>\n\n` +
      `🏷️ <b>উৎস:</b> ${balanceType === 'referral' ? '🎁 রেফার ব্যালেন্স' : '💼 মূল ব্যালেন্স'}\n` +
      `💵 <b>পরিমাণ:</b> ৳<b>${amount}</b> Taka\n` +
      `🏦 <b>ওয়ালেট:</b> <code>${num}</code> (${method})\n\n` +
      `⚡ <b>চার্জের বিবরণ:</b>\n` +
      `• বিকাশ (bKash): ৳৫ চার্জ\n` +
      `• নগদ (Nagad): ৳৫ চার্জ\n` +
      `• রকেট (Rocket): সম্পূর্ণ ফ্রি (কোনো চার্জ নেই)\n\n` +
      `⏳ এডমিন কিছুক্ষণের মধ্যে চেক করে পেমেন্ট সম্পূর্ণ করে দেবেন। ধন্যবাদ!`,
      { parse_mode: "HTML" }
    );
    
    state.step = "main_menu";
    state.withdrawData = undefined;
    userStates.set(chatId, state);
    await showMainMenu(bot, chatId, profile);
    return;
  }

  // Catch-all: Send back to main menu
  state.step = "main_menu";
  userStates.set(chatId, state);
  await showMainMenu(bot, chatId, profile);
}

// --- Callback Query Handlers (Kept as fallback for old/inline requests) ---
async function handleCallbackQuery(bot: TelegramBot, callbackQuery: any) {
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;

  if (!chatId || !data) return;

  // Handle Broadcast Callbacks first
  if (data === "bcast_cancel") {
    if (!isBroadcastAdmin(chatId)) {
      try { await bot.answerCallbackQuery(callbackQuery.id, { text: "পারমিশন নেই", show_alert: true }); } catch {}
      return;
    }
    userStates.delete(chatId);
    try { await bot.answerCallbackQuery(callbackQuery.id, { text: "ব্রডকাস্ট বাতিল করা হয়েছে" }); } catch {}
    await bot.sendMessage(chatId, "❌ <b>ব্রডকাস্ট বাতিল করা হয়েছে।</b>", {
      parse_mode: "HTML",
      reply_markup: getMainMenuReplyMarkup(chatId) as any
    });
    return;
  }

  if (data === "bcast_target_users" || data === "bcast_target_channel" || data === "bcast_target_both") {
    if (!isBroadcastAdmin(chatId)) {
      try { await bot.answerCallbackQuery(callbackQuery.id, { text: "পারমিশন নেই", show_alert: true }); } catch {}
      return;
    }
    try { await bot.answerCallbackQuery(callbackQuery.id); } catch {}
    const target = data === "bcast_target_users" ? "users" : data === "bcast_target_channel" ? "channel" : "both";
    await executeAdminBroadcast(bot, chatId, target);
    return;
  }

  // Handle Force Join Verification
  if (data === "verify_join") {
    // Clear cache entry to ensure a fresh live verification check
    membershipCache.delete(chatId);
    const membership = await isUserMemberOfGroup(bot, chatId);
    if (membership.isMember) {
      await bot.sendMessage(chatId, `🎉 <b>ধন্যবাদ! ভেরিফিকেশন সফল হয়েছে।</b>\n\nএখন আপনি বটটি ব্যবহার করতে পারবেন।`);
      userStates.delete(chatId);
      
      const profilesRef = collection(db, "profiles");
      const q = query(profilesRef, where("telegramChatId", "==", String(chatId)), limit(1));
      const querySnapshot = await getDocs(q);
      
      let profile;
      if (querySnapshot.empty) {
        await addDoc(profilesRef, {
          telegramChatId: String(chatId),
          createdAt: new Date(),
          walletNumber: "",
          walletType: ""
        });
        const newSnapshot = await getDocs(q);
        profile = newSnapshot.docs[0].data();
        await bot.sendMessage(chatId, "🎉 স্বাগতম! আপনার প্রোফাইল তৈরি হয়েছে।");
      } else {
        profile = querySnapshot.docs[0].data();
      }
      
      userStates.set(chatId, { step: "main_menu" });
      await showMainMenu(bot, chatId, profile);
    } else {
      if (!membership.success) {
        await bot.sendMessage(chatId, 
          `⚠️ <b>গ্রুপ ভেরিফিকেশন ত্রুটি (Bot Configuration Error):</b>\n\n` +
          `টেলিগ্রাম বটটি মেম্বারশিপ চেক করতে পারছে না।\n\n` +
          `<b>সম্ভাবনা ও সমাধান:</b>\n` +
          `১. আপনার বটটিকে অবশ্যই মেইন চ্যানেল (<b>@accounttradecenterXincome</b>) এবং মেথড চ্যানেল (<b>@eranpointmethod</b>) দুটিতেই <b>অ্যাডমিন (Admin)</b> করা হয়েছে কি না নিশ্চিত করুন।\n` +
          `২. চ্যানেলগুলোতে বটকে অ্যাডমিন হিসেবে যুক্ত করে মেম্বার দেখার পারমিশন দিন, অন্যথায় টেলিগ্রাম এপিআই মেম্বারশিপ ভেরিফাই করতে দেয় না।\n\n` +
          `<i>(বটকে দুটি চ্যানেলেই অ্যাডমিন করার পর আবার ভেরিফাই বাটনে ক্লিক করে চেষ্টা করুন)</i>`,
          { parse_mode: "HTML" }
        );
      }
      await showForceJoinPrompt(bot, chatId, true);
    }
    try {
      await bot.answerCallbackQuery(callbackQuery.id);
    } catch (err) {}
    return;
  }

  // Ensure user is member for any other callback actions (bypassed for admin)
  const adminChatIdStr = await getAdminChatId();
  const isAdmin = String(chatId) === adminChatIdStr || chatId === 7990244560 || isBroadcastAdmin(chatId);
  if (!isAdmin) {
    const membership = await isUserMemberOfGroup(bot, chatId);
    if (!membership.isMember) {
      if (!membership.success) {
        await bot.sendMessage(chatId, 
          `⚠️ <b>সিস্টেম নোটিশ (System Configuration Notice):</b>\n\n` +
          `টেলিগ্রাম বটের চ্যানেল মেম্বারশিপ চেক করতে সমস্যা হচ্ছে।\n\n` +
          `🔧 <b>সমাধান করতে অনুগ্রহ করে নিচের ধাপগুলো সম্পন্ন করুন:</b>\n` +
          `১. আপনার টেলিগ্রাম বটকে অবশ্যই মেইন চ্যানেল (<b>@accounttradecenterXincome</b>) এবং মেথড চ্যানেল (<b>@eranpointmethod</b>) দুটিতেই <b>অ্যাডমিন (Admin)</b> হিসেবে যুক্ত করতে হবে।\n` +
          `২. বটকে অ্যাডমিন না বানালে টেলিগ্রাম সিকিউরিটি নিয়মানুযায়ী বট কোনো মেম্বারের তথ্য অ্যাক্সেস করতে পারে না।\n\n` +
          `<i>(আপনি যদি এই বটের মালিক হন, তবে এখনই বটটিকে চ্যানেল দুটিতে অ্যাডমিন হিসেবে যুক্ত করুন)</i>`,
          { parse_mode: "HTML" }
        );
      }
      await showForceJoinPrompt(bot, chatId, !membership.success);
      try {
        await bot.answerCallbackQuery(callbackQuery.id);
      } catch (err) {}
      return;
    }
  }

  // Let's redirect standard callback commands to match text inputs
  if (data === "cmd_work") {
    await handleBotMessage(bot, chatId, "💼 কাজ", callbackQuery.message);
  } else if (data === "cmd_balance" || data === "check_balance") {
    await handleBotMessage(bot, chatId, "💰 ব্যালেন্স চেক", callbackQuery.message);
  } else if (data === "cmd_withdraw" || data === "withdraw_balance") {
    await handleBotMessage(bot, chatId, "💸 ব্যালেন্স উত্তোলন", callbackQuery.message);
  } else if (data === "cmd_referral") {
    await handleBotMessage(bot, chatId, "👥 রেফারেল লিংক", callbackQuery.message);
  } else if (data === "cmd_support") {
    await handleBotMessage(bot, chatId, "📞 সাপোর্ট", callbackQuery.message);
  } else if (data === "cmd_insta_work") {
    await handleBotMessage(bot, chatId, "📸 ইনস্টাগ্রামের কাজ", callbackQuery.message);
  } else if (data === "cmd_fb_work") {
    await handleBotMessage(bot, chatId, "👥 ফেসবুকের কাজ", callbackQuery.message);
  } else if (data === "cmd_main_menu" || data === "back_to_main_menu") {
    await handleBotMessage(bot, chatId, "🔙 মেইন মেনু", callbackQuery.message);
  } else if (data === "start_registration") {
    await handleBotMessage(bot, chatId, "📝 রেজিস্ট্রেশন করুন", callbackQuery.message);
  } else if (data === "cancel_registration") {
    await handleBotMessage(bot, chatId, "❌ বাতিল করুন", callbackQuery.message);
  } else if (data === "insta_work") {
    await handleBotMessage(bot, chatId, "📸 ইনস্টাগ্রাম টু-এফএ কাজ", callbackQuery.message);
  } else if (data === "check_balance") {
    await handleBotMessage(bot, chatId, "💰 ব্যালেন্স চেক", callbackQuery.message);
  } else if (data === "withdraw_balance") {
    await handleBotMessage(bot, chatId, "💸 ব্যালেন্স উত্তোলন", callbackQuery.message);
  } else if (data === "insta_set_2fa") {
    await handleBotMessage(bot, chatId, "🛡️ টু-এফএ সেট করুন", callbackQuery.message);
  } else if (data === "insta_complete") {
    await handleBotMessage(bot, chatId, "✅ অ্যাকাউন্ট খোলা শেষ", callbackQuery.message);
  } else if (data === "insta_cancel") {
    await handleBotMessage(bot, chatId, "❌ কাজটি বাতিল করুন", callbackQuery.message);
  } else if (data === "back_to_main_menu") {
    await handleBotMessage(bot, chatId, "🔙 মেইন মেনু", callbackQuery.message);
  } else if (data === "cmd_leaderboard" || data === "leaderboard") {
    await handleBotMessage(bot, chatId, "🏆 সেরা কর্মী (লিডারবোর্ড)", callbackQuery.message);
  }

  try {
    const alertText = (data === "cmd_leaderboard" || data === "leaderboard")
      ? "🎁 বোনাস পেতে হলে কমপক্ষে ৬০টি আইডি জমা করতে হবে"
      : undefined;
    await bot.answerCallbackQuery(callbackQuery.id, alertText ? { text: alertText, show_alert: false } : undefined);
  } catch (err) {
    // Ignore harmless callback errors
  }
}

let currentBot: TelegramBot | null = null;
let currentBotToken: string | null = null;
let currentWebhookUrl: string | null = null;
let loggedDevWarning = false;

export async function broadcastLeaderboardToChannel(round: LeaderboardRound): Promise<{ success: boolean; message: string }> {
  if (!currentBot) {
    await syncTelegramBot(true);
  }
  if (!currentBot) {
    return { success: false, message: "টেলিগ্রাম বট সক্রিয় নেই বা বট টোকেন সংযুক্ত নেই।" };
  }
  const settings = await getGlobalSettings();
  const targetChatId = settings?.telegramChatId || settings?.forceJoinGroup;
  if (!targetChatId) {
    return { success: false, message: "কোনো টেলিগ্রাম চ্যানেল বা গ্রুপ আইডি সেট করা নেই।" };
  }

  const text = formatLeaderboardMessage(round, settings);
  try {
    await currentBot.sendMessage(targetChatId, `📢 <b>অফিশিয়াল ফলাফল ও লিডারবোর্ড ঘোষণা:</b>\n\n` + text, { parse_mode: "HTML" });
    return { success: true, message: "টেলিগ্রাম চ্যানেলে সফলভাবে ফলাফল প্রকাশ করা হয়েছে!" };
  } catch (err: any) {
    console.error("Error broadcasting leaderboard:", err);
    return { success: false, message: `টেলিগ্রাম চ্যানেলে পাঠাতে ত্রুটি: ${err?.message || err}` };
  }
}

export async function handleWebhookUpdate(update: any) {
  console.log("Received Webhook Update:", JSON.stringify(update));
  if (!currentBot) {
    console.log("Webhook received but bot is not initialized. Syncing bot first...");
    await syncTelegramBot(true);
  }

  if (!currentBot) {
    console.error("currentBot is null when receiving webhook update");
    return;
  }

  // Handle message updates directly and await completion so serverless environments like Vercel don't freeze before sending replies
  if (update.message) {
    const msg = update.message;
    const chatId = msg.chat.id;
    const text = msg.text ? msg.text.trim() : "";
    try {
      await handleBotMessage(currentBot, chatId, text, msg);
    } catch (err: any) {
      console.error("Error handling telegram bot message in webhook:", err?.message || err);
      try {
        await currentBot.sendMessage(chatId, `❌ একটি ভুল হয়েছে: ${err?.message || 'অনুগ্রহ করে আবার চেষ্টা করুন।'}`);
      } catch (sendErr) {
        console.error("Error sending error message:", sendErr);
      }
    }
  } else if (update.callback_query) {
    try {
      await handleCallbackQuery(currentBot, update.callback_query);
    } catch (err: any) {
      console.error("Error processing callback query in webhook:", err?.message || err);
      try {
        const chatId = update.callback_query.message?.chat?.id;
        if (chatId) {
          await currentBot.sendMessage(chatId, `❌ একটি ভুল হয়েছে: ${err?.message || 'অনুগ্রহ করে আবার চেষ্টা করুন।'}`);
        }
      } catch (sendErr) {}
    }
  } else {
    // Fallback for other update types (e.g., edited_message, etc.)
    currentBot.processUpdate(update);
  }
}

export async function syncTelegramBot(isFromWebhook = false) {
  try {
    let settings: any = null;

    // Fast fetch settings via REST API first to prevent cold-start delay on Vercel
    try {
      const projectId = "mahmudul-instagram-bazar";
      const databaseId = "ai-studio-accountmanager-ec6eda59-6fd3-4a88-b03d-16ce0e0e9a3c";
      const apiKey = "AIzaSyBEO8S2XRSMTxwcMU2JyiIr-O7ddrHNb9Y";
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/settings/global?key=${apiKey}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.fields) {
          settings = {
            telegramBotToken: data.fields.telegramBotToken?.stringValue || "",
            webhookUrl: data.fields.webhookUrl?.stringValue || "",
            telegramChatId: data.fields.telegramChatId?.stringValue || "",
            ratePerId: data.fields.ratePerId?.doubleValue !== undefined 
              ? parseFloat(data.fields.ratePerId.doubleValue) 
              : (data.fields.ratePerId?.integerValue !== undefined ? parseFloat(data.fields.ratePerId.integerValue) : 45),
            facebookRatePerId: data.fields.facebookRatePerId?.doubleValue !== undefined 
              ? parseFloat(data.fields.facebookRatePerId.doubleValue) 
              : (data.fields.facebookRatePerId?.integerValue !== undefined ? parseFloat(data.fields.facebookRatePerId.integerValue) : 45),
            fbHotmailRatePerId: data.fields.fbHotmailRatePerId?.doubleValue !== undefined 
              ? parseFloat(data.fields.fbHotmailRatePerId.doubleValue) 
              : (data.fields.fbHotmailRatePerId?.integerValue !== undefined ? parseFloat(data.fields.fbHotmailRatePerId.integerValue) : 50),
          };
        }
      }
    } catch (e: any) {
      console.warn("Notice: Fast REST fetch settings error:", e?.message || e);
    }

    if (!settings) {
      const settings = await getGlobalSettings();
    }

    if (!settings) return;

    const token = settings.telegramBotToken ? String(settings.telegramBotToken).trim() : null;
    const webhookUrl = settings.webhookUrl ? String(settings.webhookUrl).trim().replace(/\/$/, "") : null;

    if (currentBot && token === currentBotToken && webhookUrl === currentWebhookUrl) {
      // If we are in polling mode and not currently polling (due to temporary conflict), let's attempt to restart polling!
      if (!webhookUrl && currentBot && !currentBot.isPolling() && !process.env.VERCEL) {
        console.log("[Telegram Bot] Polling was inactive. Retrying startPolling...");
        try {
          await currentBot.startPolling();
        } catch (pollErr) {
          console.error("[Telegram Bot] Failed to resume polling:", pollErr);
        }
      }
      return; // Token and webhook url haven't changed, skip rebuild
    }

    // Token or Webhook changed, or bot is not started yet
    if (currentBot) {
      console.log("Stopping previous Telegram Bot instance...");
      try {
        if (currentBot.isPolling()) {
          await currentBot.stopPolling();
        }
      } catch (err) {
        console.error("Error stopping polling:", err);
      }
      currentBot = null;
    }

    currentBotToken = token;
    currentWebhookUrl = webhookUrl;

    if (!token) {
      console.log("No Telegram Bot token configured in Firebase settings.");
      return;
    }

    console.log(`Starting Telegram Bot with token: ${token.substring(0, 6)}...`);
    
    // Initialize bot with polling: false
    const bot = new TelegramBot(token, { polling: false });
    currentBot = bot;

    // Handle incoming messages
    bot.on("message", async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text ? msg.text.trim() : "";
      
      try {
        await handleBotMessage(bot, chatId, text, msg);
      } catch (err: any) {
        console.error("Error handling telegram bot message:", err?.message || err);
        try {
          await bot.sendMessage(chatId, `❌ একটি ভুল হয়েছে: ${err?.message || 'অনুগ্রহ করে আবার চেষ্টা করুন।'}`);
        } catch (sendErr) {
          console.error("Error sending error message:", sendErr);
        }
      }
    });

    // Handle callback queries (Inline Keyboards)
    bot.on("callback_query", async (callbackQuery) => {
      try {
        await handleCallbackQuery(bot, callbackQuery);
      } catch (err: any) {
        console.error("Error processing callback query:", err?.message || err);
        try {
          const chatId = callbackQuery.message?.chat?.id;
          if (chatId) {
            await bot.sendMessage(chatId, `❌ একটি ভুল হয়েছে: ${err?.message || 'অনুগ্রহ করে আবার চেষ্টা করুন।'}`);
          }
        } catch (sendErr) {}
      }
    });

    // CRITICAL: On Vercel / serverless or when receiving a webhook request, DO NOT call setWebHook on every cold start!
    // /api/telegram-set-webhook handles registering the webhook explicitly.
    if (webhookUrl && !isFromWebhook && !process.env.VERCEL) {
      const fullWebhookUrl = `${webhookUrl}/api/telegram-webhook`;
      console.log(`[Telegram Bot] Setting up Webhook mode pointing to: ${fullWebhookUrl}`);
      try {
        await bot.setWebHook(fullWebhookUrl);
        console.log("[Telegram Bot] Webhook registered successfully.");
      } catch (whErr) {
        console.error("[Telegram Bot] Error setting Webhook:", whErr);
      }
    } else if (webhookUrl || process.env.VERCEL) {
      console.log("[Telegram Bot] Webhook mode initialized for incoming updates.");
    } else {
      console.log("[Telegram Bot] Setting up Polling mode...");
      
      // Handle polling errors gracefully (especially 409 Conflict)
      bot.on("polling_error", async (err: any) => {
        const errMsg = err?.message || err?.code || "";
        if (errMsg.includes("409 Conflict")) {
          console.warn("⚠️ [Telegram Bot] Polling conflict (409) detected: Another bot instance is currently active.");
          console.warn("🛑 Pausing polling temporarily and retrying in 10 seconds...");
          try {
            if (bot.isPolling()) {
              await bot.stopPolling();
            }
          } catch (stopErr) {
            // Ignore
          }
          // Retry polling after 10s delay (useful during container redeployments on Render)
          setTimeout(async () => {
            try {
              if (currentBot === bot && !bot.isPolling()) {
                console.log("🔄 Retrying Telegram Bot startPolling after conflict pause...");
                await bot.deleteWebHook();
                await bot.startPolling();
                console.log("✅ Telegram Bot polling resumed successfully.");
              }
            } catch (retryErr) {
              console.error("Failed to resume polling after 409 conflict:", retryErr);
            }
          }, 10000);
        } else {
          console.error("Telegram Bot Polling Error:", err);
        }
      });
      
      try {
        console.log("Deleting any active Telegram Webhook to enable fast polling mode...");
        await bot.deleteWebHook();
      } catch (whErr) {
        console.error("Error deleting webhook:", whErr);
      }

      // Start polling cleanly
      await bot.startPolling();
      console.log("⚡ Telegram Bot successfully initialized in Polling Mode and polling started!");
    }

  } catch (error: any) {
    if (error?.message?.includes("Quota limit exceeded") || error?.message?.includes("quota")) {
      console.warn("[Quota Limit] Notice in syncTelegramBot: Quota limit reached.");
    } else {
      console.warn("Notice in syncTelegramBot:", error?.message || error);
    }
  }
}

// Automatically sync periodically
export async function initTelegramBot() {
  if (process.env.VERCEL) {
    console.log("[Telegram Bot] Vercel Serverless environment: Skipping polling and background timers.");
    return;
  }
  // Sync immediately
  await syncTelegramBot();
  // Sync every 30 seconds
  setInterval(syncTelegramBot, 30000);
}
