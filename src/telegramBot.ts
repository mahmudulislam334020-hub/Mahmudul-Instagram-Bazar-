import _TelegramBot from "node-telegram-bot-api";

const TelegramBot = (typeof _TelegramBot === "function"
  ? _TelegramBot
  : (_TelegramBot as any).default) as typeof _TelegramBot;

type TelegramBot = _TelegramBot;
import crypto from "crypto";
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { db } from "./firebase.js";
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  getDocs, 
  addDoc, 
  query, 
  where,
  limit
} from "firebase/firestore";

interface BotState {
  step: 
    | 'main_menu' 
    | 'awaiting_instagram_2fa_key' 
    | 'awaiting_withdraw_method'
    | 'awaiting_withdraw_number'
    | 'awaiting_withdraw_amount'
    | 'awaiting_independent_2fa_key'
    | 'awaiting_facebook_uid'
    | 'awaiting_facebook_cookie'
    | 'awaiting_facebook_complete';
  instagramData?: {
    username?: string;
    password?: string;
    twoFactorKey?: string;
    credentialMsgId?: number; // Message containing the auto username/password
    promptMsgId?: number;     // Message requesting 2FA or displaying TOTP
  };
  withdrawData?: {
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

// --- Helper: Fetch user statistics ---
async function getUserStats(walletNumber?: string, telegramChatId?: string) {
  const settingsRef = doc(db, "settings", "global");
  const settingsSnap = await getDoc(settingsRef);
  const settings = settingsSnap.exists() ? settingsSnap.data() : { ratePerId: 45 };
  const ratePerId = settings.ratePerId || 45;
  const facebookRatePerId = settings.facebookRatePerId !== undefined ? settings.facebookRatePerId : ratePerId;

  const submissionsRef = collection(db, "submissions");
  const uniqueSubmissions = new Map<string, any>();

  // Fetch by walletNumber if provided
  if (walletNumber) {
    const q1 = query(submissionsRef, where("submittedBy", "==", walletNumber));
    const snap1 = await getDocs(q1);
    snap1.forEach(docSnap => {
      uniqueSubmissions.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
    });
  }

  // Fetch by telegramChatId if provided
  if (telegramChatId) {
    const q2 = query(submissionsRef, where("telegramChatId", "==", String(telegramChatId)));
    const snap2 = await getDocs(q2);
    snap2.forEach(docSnap => {
      uniqueSubmissions.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
    });
  }

  const userSubmissions = Array.from(uniqueSubmissions.values());

  // Self-Healing logic:
  // If we have both telegramChatId and walletNumber, and some submissions under this telegramChatId 
  // do not have the current walletNumber set, update them in Firestore.
  if (telegramChatId && walletNumber) {
    for (const sub of userSubmissions) {
      if (sub.telegramChatId === String(telegramChatId) && sub.submittedBy !== walletNumber) {
        try {
          console.log(`Self-healing: Updating submission ${sub.id} submittedBy to ${walletNumber}`);
          const subDocRef = doc(db, "submissions", sub.id);
          await updateDoc(subDocRef, { submittedBy: walletNumber });
          sub.submittedBy = walletNumber; // Update in-memory for immediate correct stat calculation
        } catch (err) {
          console.error(`Error self-healing submission ${sub.id}:`, err);
        }
      }
    }
  }

  const approvedCount = userSubmissions.filter(s => s.status === "approved").length;
  const pendingCount = userSubmissions.filter(s => s.status === "pending").length;
  const rejectedCount = userSubmissions.filter(s => s.status === "rejected").length;

  // Calculate rate based on category
  const totalEarned = userSubmissions
    .filter(s => s.status === "approved")
    .reduce((sum, s) => {
      const isFacebook = s.category === "facebook";
      const rate = isFacebook ? facebookRatePerId : ratePerId;
      return sum + rate;
    }, 0);

  // Fetch withdrawals for this user (by telegramChatId and/or walletNumber)
  const withdrawalsRef = collection(db, "withdrawals");
  const uniqueWithdrawals = new Map<string, any>();

  if (telegramChatId) {
    const wQuery1 = query(withdrawalsRef, where("telegramChatId", "==", String(telegramChatId)));
    const wSnap1 = await getDocs(wQuery1);
    wSnap1.forEach(docSnap => {
      uniqueWithdrawals.set(docSnap.id, docSnap.data());
    });
  }

  if (walletNumber) {
    const wQuery2 = query(withdrawalsRef, where("submittedBy", "==", walletNumber));
    const wSnap2 = await getDocs(wQuery2);
    wSnap2.forEach(docSnap => {
      uniqueWithdrawals.set(docSnap.id, docSnap.data());
    });
  }

  const withdrawals = Array.from(uniqueWithdrawals.values());

  const approvedWithdrawn = withdrawals
    .filter(w => w.status === "approved")
    .reduce((sum, current) => sum + current.amount, 0);

  const pendingWithdrawn = withdrawals
    .filter(w => w.status === "pending")
    .reduce((sum, current) => sum + current.amount, 0);

  const balance = totalEarned - approvedWithdrawn;

  return {
    approvedCount,
    pendingCount,
    rejectedCount,
    totalEarned,
    approvedWithdrawn,
    pendingWithdrawn,
    balance,
    ratePerId
  };
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
async function showMainMenu(bot: TelegramBot, chatId: number, profile: any) {
  const text = `🏠 <b>মেইন মেনু (Main Menu)</b>\n\n` +
               `👤 <b>ইউজার আইডি:</b> <code>${chatId}</code>\n` +
               `✨ নিচে দেওয়া অপশনগুলো ব্যবহার করে কাজ করুন:`;
  
  await bot.sendMessage(chatId, text, {
    parse_mode: "HTML",
    reply_markup: {
      keyboard: [
        [
          { text: "📸 ইনস্টাগ্রাম টু-এফএ কাজ" },
          { text: "👥 ফেসবুকের কাজ" }
        ],
        [
          { text: "💰 ব্যালেন্স চেক" },
          { text: "💸 ব্যালেন্স উত্তোলন" }
        ],
        [
          { text: "📞 সাপোর্ট" }
        ]
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  });
}

// --- Force Join Helpers ---
const membershipCache = new Map<number, { isMember: boolean; timestamp: number }>();
const CACHE_TTL_MS = 120000; // 2 minutes cache TTL

async function isUserMemberOfGroup(bot: TelegramBot, chatId: number): Promise<{ success: boolean; isMember: boolean; error?: string }> {
  const cached = membershipCache.get(chatId);
  const now = Date.now();
  if (cached && (now - cached.timestamp < CACHE_TTL_MS) && cached.isMember) {
    return { success: true, isMember: true };
  }

  try {
    console.log("Checking membership for chat ID (as user_id):", chatId);
    const member = await bot.getChatMember("@accounttradecenterXincome", chatId);
    const validStatuses = ["creator", "administrator", "member", "restricted"];
    const isMember = validStatuses.includes(member.status);
    
    // Cache the successful member status
    membershipCache.set(chatId, { isMember, timestamp: now });
    return { success: true, isMember };
  } catch (err: any) {
    console.error("Error verifying group membership for chat:", chatId, err?.message || err);
    return { success: false, isMember: false, error: err?.message || String(err) };
  }
}

async function showForceJoinPrompt(bot: TelegramBot, chatId: number, isVerifyRetry: boolean = false) {
  let text = "";
  if (isVerifyRetry) {
    text = `❌ <b>আপনি এখনো আমাদের গ্রুপে জয়েন করেননি!</b>\n\n` +
           `অনুগ্রহ করে নিচের বাটনে ক্লিক করে প্রথমে আমাদের গ্রুপে জয়েন করুন, তারপর <b>'ভেরিফাই করুন'</b> বাটনে ক্লিক করুন।\n\n` +
           `📢 গ্রুপ লিংক: https://t.me/accounttradecenterXincome`;
  } else {
    text = `📢 <b>গ্রুপে জয়েন হওয়া আবশ্যক!</b>\n\n` +
           `বটটি ব্যবহার করতে আপনাকে অবশ্যই আমাদের গ্রুপে জয়েন হতে হবে। জয়েন হওয়া ছাড়া আপনি বটটি ব্যবহার করতে পারবেন না।\n\n` +
           `নিচের <b>'জয়েন করুন'</b> বাটনে ক্লিক করে গ্রুপে যোগ দিন এবং তারপর <b>'ভেরিফাই করুন'</b> বাটনে চাপুন।`;
  }

  await bot.sendMessage(chatId, text, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "📢 জয়েন করুন", url: "https://t.me/accounttradecenterXincome" }
        ],
        [
          { text: "✅ ভেরিফাই করুন", callback_data: "verify_join" }
        ]
      ]
    }
  });
}

// --- Core Telegram Message Handlers ---
async function getAdminChatId(): Promise<string> {
  try {
    const settingsSnap = await getDoc(doc(db, "settings", "global"));
    if (settingsSnap.exists()) {
      const sData = settingsSnap.data();
      if (sData.telegramChatId) {
        return String(sData.telegramChatId).trim();
      }
    }
  } catch (err) {
    console.error("Error fetching settings for admin authorization:", err);
  }
  return "7990244560"; // fallback
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

async function handleBotMessage(bot: TelegramBot, chatId: number, text: string, msg: any) {
  // Check Force Join first
  const membership = await isUserMemberOfGroup(bot, chatId);
  if (!membership.isMember) {
    if (!membership.success) {
      // API call failed - bot is likely not an admin or chat username is invalid
      await bot.sendMessage(chatId, 
        `⚠️ <b>সিস্টেম নোটিশ (System Configuration Notice):</b>\n\n` +
        `টেলিগ্রাম বটের গ্রুপ মেম্বারশিপ চেক করতে সমস্যা হচ্ছে।\n\n` +
        `🔧 <b>সমাধান করতে অনুগ্রহ করে নিচের ধাপগুলো সম্পন্ন করুন:</b>\n` +
        `১. আপনার টেলিগ্রাম বটকে অবশ্যই <b>@accounttradecenterXincome</b> গ্রুপ বা চ্যানেলে <b>অ্যাডমিন (Admin)</b> হিসেবে যুক্ত করতে হবে।\n` +
        `২. বটকে অ্যাডমিন না বানালে টেলিগ্রাম সিকিউরিটি নিয়মানুযায়ী বট কোনো মেম্বারের তথ্য অ্যাক্সেস করতে পারে না।\n\n` +
        `<i>(আপনি যদি এই বটের মালিক হন, তবে এখনই বটটিকে গ্রুপে অ্যাডমিন হিসেবে যুক্ত করুন এবং আবার ট্রাই করুন)</i>`,
        { parse_mode: "HTML" }
      );
    }
    await showForceJoinPrompt(bot, chatId, !membership.success);
    return;
  }

  // Admin Commands
  if (text === "/adminq") {
    await handleAdminInstagramCommand(bot, chatId);
    return;
  }
  if (text === "/adminp") {
    await handleAdminFacebookCommand(bot, chatId);
    return;
  }

  // If user sends /start command, clear any state and re-initialize
  if (text.startsWith("/start")) {
    userStates.delete(chatId);
    
    // Check if profile exists
    const profilesRef = collection(db, "profiles");
    const q = query(profilesRef, where("telegramChatId", "==", String(chatId)), limit(1));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      // Auto-create profile
      await addDoc(profilesRef, {
        telegramChatId: String(chatId),
        createdAt: new Date(),
        walletNumber: "",
        walletType: ""
      });
      userStates.set(chatId, { step: "main_menu" });
      await bot.sendMessage(chatId, "🎉 স্বাগতম! আপনার প্রোফাইল তৈরি হয়েছে।");
      
      const newProfile = { telegramChatId: String(chatId), walletNumber: "", walletType: "" };
      await showMainMenu(bot, chatId, newProfile);
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
  const profilesRef = collection(db, "profiles");
  const q = query(profilesRef, where("telegramChatId", "==", String(chatId)), limit(1));
  const querySnapshot = await getDocs(q);

  let profile;
  if (querySnapshot.empty) {
    // If somehow not created, create it now
    await addDoc(profilesRef, {
      telegramChatId: String(chatId),
      createdAt: new Date(),
      walletNumber: "",
      walletType: ""
    });
    const newSnapshot = await getDocs(q);
    profile = newSnapshot.docs[0].data();
  } else {
    profile = querySnapshot.docs[0].data();
  }

  // Handle Main Menu
  if (state.step === "main_menu") {
    // Keep the main menu handlers
    // ...
    // (I will need to be careful not to delete too much)
  }

  // --- 5. Step: Main Menu Actions ---
  if (state.step === "main_menu") {
    if (text === "👥 ফেসবুকের কাজ" || text === "ফেসবুকের কাজ") {
      let isWorkActive = true;
      try {
        const settingsSnap = await getDoc(doc(db, "settings", "global"));
        if (settingsSnap.exists()) {
          const sData = settingsSnap.data();
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

      await bot.sendMessage(chatId, `👥 <b>ফেসবুকের কাজ শুরু করতে নিচে ক্লিক করুন:</b>`, {
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [
            [{ text: "number/anymail Facebook Cookie" }],
            [{ text: "🔙 মেইন মেনু" }]
          ],
          resize_keyboard: true,
          one_time_keyboard: false
        }
      });
      return;
    }

    if (text === "number/anymail Facebook Cookie") {
      let isWorkActive = true;
      let password = "";
      try {
        const settingsSnap = await getDoc(doc(db, "settings", "global"));
        if (settingsSnap.exists()) {
          const sData = settingsSnap.data();
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
            [{ text: "Send UID" }],
            [{ text: "❌ কাজটি বাতিল করুন" }]
          ],
          resize_keyboard: true,
          one_time_keyboard: false
        }
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

    if (text === "📸 ইনস্টাগ্রাম টু-এফএ কাজ") {
      await cleanUpInstagramMessages(bot, chatId, state);

      let customPrefix = "";
      let customDailyPassword = "";
      let isWorkActive = true;
      try {
        const settingsSnap = await getDoc(doc(db, "settings", "global"));
        if (settingsSnap.exists()) {
          const sData = settingsSnap.data();
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
          reply_markup: {
            keyboard: [
              [{ text: "📸 ইনস্টাগ্রাম টু-এফএ কাজ" }],
              [{ text: "💰 ব্যালেন্স চেক" }, { text: "💸 ব্যালেন্স উত্তোলন" }],
              [{ text: "📞 সাপোর্ট" }]
            ],
            resize_keyboard: true
          }
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
            [{ text: "🛡️ টু-এফএ সেট করুন" }],
            [{ text: "❌ কাজটি বাতিল করুন" }]
          ],
          resize_keyboard: true,
          one_time_keyboard: false
        }
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
        `📢 সাপোর্ট আইডি: <b>t.me/Mahmudulinstabazar</b>\n\n` +
        `সাপোর্ট আইডিতে সরাসরি মেসেজ দিতে নিচের বাটনে ক্লিক করুন। ধন্যবাদ!`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "💬 সাপোর্ট এ যোগাযোগ করুন", url: "https://t.me/Mahmudulinstabazar" }
              ]
            ]
          }
        }
      );
      return;
    }

    if (text === "💰 ব্যালেন্স চেক") {
      const stats = await getUserStats(profile.walletNumber || "", profile.telegramChatId);
      let balanceText = `💰 <b>আপনার ব্যালেন্স তথ্য:</b>\n\n` +
                          `💵 <b>উত্তোলনযোগ্য ব্যালেন্স:</b> ৳<b>${stats.balance}</b> Taka\n\n` +
                          `✅ <b>অনুমোদিত আইডি:</b> ${stats.approvedCount} টি (৳${stats.totalEarned})\n` +
                          `⏳ <b>পেন্ডিং আইডি:</b> ${stats.pendingCount} টি\n` +
                          `❌ <b>বাতিল আইডি:</b> ${stats.rejectedCount} টি\n\n` +
                          `💸 <b>মোট উইথড্র করেছেন:</b> ৳${stats.approvedWithdrawn} Taka\n` +
                          `🕒 <b>পেন্ডিং উইথড্র:</b> ৳${stats.pendingWithdrawn} Taka`;

      if (stats.pendingCount > 0) {
        balanceText += `\n\n⚠️ <b>নোট:</b> আপনার <b>${stats.pendingCount}টি</b> পেন্ডিং আইডি এডমিন রিভিউর পর এপ্রুভ হলে আপনার উইথড্রযোগ্য ব্যালেন্সে আরও ৳<b>${stats.pendingCount * stats.ratePerId}</b> Taka যোগ হবে।`;
      }

      await bot.sendMessage(chatId, balanceText, {
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [
            [{ text: "📸 ইনস্টাগ্রাম টু-এফএ কাজ" }],
            [{ text: "💰 ব্যালেন্স চেক" }, { text: "💸 ব্যালেন্স উত্তোলন" }],
            [{ text: "📞 সাপোর্ট" }]
          ],
          resize_keyboard: true
        }
      });
      return;
    }

    if (text === "💸 ব্যালেন্স উত্তোলন") {
      const stats = await getUserStats(profile.walletNumber || "", profile.telegramChatId);

      if (stats.balance <= 0) {
        await bot.sendMessage(chatId, `❌ <b>দুঃখিত!</b> আপনার পর্যাপ্ত ব্যালেন্স নেই। বর্তমানে আপনার ব্যালেন্স ৳০ Taka।`, {
          reply_markup: {
            keyboard: [
              [{ text: "📸 ইনস্টাগ্রাম টু-এফএ কাজ" }],
              [{ text: "💰 ব্যালেন্স চেক" }, { text: "💸 ব্যালেন্স উত্তোলন" }],
              [{ text: "📞 সাপোর্ট" }]
            ],
            resize_keyboard: true
          }
        });
        return;
      }

      state.step = "awaiting_withdraw_method";
      state.withdrawData = {};
      userStates.set(chatId, state);

      await bot.sendMessage(chatId, `🏦 <b>টাকা উত্তোলন (Withdraw)</b>\n\nকোন মাধ্যমে টাকা উত্তোলন করতে চান? অনুগ্রহ করে নিচে থেকে একটি মাধ্যম সিলেক্ট করুন:`, {
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [
            [{ text: "বিকাশ (bKash)" }, { text: "নগদ (Nagad)" }],
            [{ text: "রকেট (Rocket)" }],
            [{ text: "🔙 মেইন মেনু" }]
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        }
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
          keyboard: [[{ text: "❌ কাজটি বাতিল করুন" }]],
          resize_keyboard: true
        }
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
          keyboard: [[{ text: "❌ কাজটি বাতিল করুন" }]],
          resize_keyboard: true
        }
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
      await bot.sendMessage(chatId, `❌ <b>এই আইডিটি সঠিক নয়!</b>\n\nএই ইউ আই ডি (UID) টি বর্তমানে প্রিন্টিং/প্রক্রিয়াধীন অবস্থায় রয়েছে। অনুগ্রহ করে সঠিক আইডি পুনরায় প্রদান করুন:`, {
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [[{ text: "❌ কাজটি বাতিল করুন" }]],
          resize_keyboard: true
        }
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
        keyboard: [[{ text: "❌ কাজটি বাতিল করুন" }]],
        resize_keyboard: true
      }
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
          keyboard: [[{ text: "❌ কাজটি বাতিল করুন" }]],
          resize_keyboard: true
        }
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
          [{ text: "✅ কাজ সম্পূর্ণ" }],
          [{ text: "❌ কাজটি বাতিল করুন" }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      }
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
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, "submissions"), newSub);

      // Get current settings
      const settingsRef = doc(db, "settings", "global");
      const settingsSnap = await getDoc(settingsRef);
      const settings = settingsSnap.exists() ? settingsSnap.data() : {};
      const fbRate = settings.facebookRatePerId !== undefined ? settings.facebookRatePerId : (settings.ratePerId || 45);

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

      const newSub = {
        username,
        password,
        twoFactorKey,
        submittedBy: profile.walletNumber || String(chatId),
        telegramChatId: String(chatId),
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, "submissions"), newSub);

      // Get current rate
      const settingsRef = doc(db, "settings", "global");
      const settingsSnap = await getDoc(settingsRef);
      const settings = settingsSnap.exists() ? settingsSnap.data() : { ratePerId: 45 };
      const ratePerId = settings.ratePerId || 45;

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
          keyboard: [[{ text: "❌ কাজটি বাতিল করুন" }]],
          resize_keyboard: true
        }
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
          keyboard: [[{ text: "❌ কাজটি বাতিল করুন" }]],
          resize_keyboard: true
        }
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
          [{ text: "✅ অ্যাকাউন্ট খোলা শেষ" }],
          [{ text: "❌ কাজটি বাতিল করুন" }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      }
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
            keyboard: [[{ text: "🔙 মেইন মেনু" }]],
            resize_keyboard: true
          }
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
            [{ text: "🔙 মেইন মেনু" }],
            [{ text: "📞 সাপোর্ট" }]
          ],
          resize_keyboard: true
        }
      }
    );
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

    if (!selectedMethod) {
      await bot.sendMessage(chatId, `❌ অনুগ্রহ করে নিচের কীবোর্ড থেকে সঠিক ওয়ালেট ধরণটি বেছে নিন:`, {
        reply_markup: {
          keyboard: [
            [{ text: "বিকাশ (bKash)" }, { text: "নগদ (Nagad)" }],
            [{ text: "রকেট (Rocket)" }],
            [{ text: "🔙 মেইন মেনু" }]
          ],
          resize_keyboard: true
        }
      });
      return;
    }

    state.withdrawData = { method: selectedMethod };
    state.step = "awaiting_withdraw_number";
    userStates.set(chatId, state);

    await bot.sendMessage(chatId, `🏦 আপনি <b>${selectedMethod}</b> সিলেক্ট করেছেন।\n\n📱 অনুগ্রহ করে আপনার সচল ১১-ডিজিটের <b>${selectedMethod}</b> অ্যাকাউন্ট নাম্বারটি লিখে পাঠান:`, {
      parse_mode: "HTML",
      reply_markup: {
        keyboard: [[{ text: "🔙 মেইন মেনু" }]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
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
          keyboard: [[{ text: "🔙 মেইন মেনু" }]],
          resize_keyboard: true
        }
      });
      return;
    }

    state.withdrawData = { ...state.withdrawData, number: walletNum };
    state.step = "awaiting_withdraw_amount";
    userStates.set(chatId, state);

    const stats = await getUserStats(profile.walletNumber || "", profile.telegramChatId);

    await bot.sendMessage(chatId, `📱 <b>নাম্বার সেট হয়েছে:</b> <code>${walletNum}</code> (${state.withdrawData.method})\n` +
                                 `💵 <b>উত্তোলনযোগ্য ব্যালেন্স:</b> ৳<b>${stats.balance}</b> Taka\n\n` +
                                 `💰 আপনি কত টাকা উত্তোলন করতে চান? অনুগ্রহ করে শুধুমাত্র সংখ্যায় পরিমাণটি লিখে পাঠান (যেমন: ৫০০):`, {
      parse_mode: "HTML",
      reply_markup: {
        keyboard: [[{ text: "🔙 মেইন মেনু" }]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
    return;
  }

  // --- Step: Awaiting Withdraw Amount ---
  if (state.step === "awaiting_withdraw_amount") {
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
          keyboard: [[{ text: "🔙 মেইন মেনু" }]],
          resize_keyboard: true
        }
      });
      return;
    }

    const stats = await getUserStats(profile.walletNumber || "", profile.telegramChatId);

    if (amount > stats.balance) {
      await bot.sendMessage(chatId, `❌ <b>পর্যাপ্ত ব্যালেন্স নেই!</b>\n\nউইথড্রযোগ্য ব্যালেন্স: ৳${stats.balance} Taka`, {
        reply_markup: {
          keyboard: [[{ text: "🔙 মেইন মেনু" }]],
          resize_keyboard: true
        }
      });
      return;
    }

    // Save withdrawal
    const method = state.withdrawData?.method || 'bKash';
    const num = state.withdrawData?.number || '';
    const newW = {
      method: method,
      number: num,
      amount: amount,
      status: 'pending',
      createdAt: new Date().toISOString(),
      submittedBy: num,
      telegramChatId: String(chatId)
    };

    await addDoc(collection(db, "withdrawals"), newW);

    // Notify Admin via Telegram
    const adminText = `💸 <b>নতুন পেমেন্ট উইথড্র অনুরোধ (Bot)</b> 💸\n\n` +
                      `👤 <b>ইউজার চ্যাট আইডি:</b> <code>${chatId}</code>\n` +
                      `🏦 <b>মাধ্যম:</b> ${method}\n` +
                      `📱 <b>অ্যাকাউন্ট:</b> <code>${num}</code>\n` +
                      `💵 <b>পরিমাণ:</b> ৳${amount} Taka\n` +
                      `📅 <b>সময়:</b> ${new Date().toLocaleString()}\n\n` +
                      `চেক করুন এবং অনুমোদন করুন!`;

    const settingsRef = doc(db, "settings", "global");
    const settingsSnap = await getDoc(settingsRef);
    if (settingsSnap.exists()) {
      const settings = settingsSnap.data();
      if (settings.telegramBotToken && settings.telegramChatId) {
        try {
          await bot.sendMessage(settings.telegramChatId, adminText, { parse_mode: "HTML" });
        } catch (err) {
          console.warn("Error notifying admin:", err);
        }
      }
    }

    await bot.sendMessage(chatId, `✅ <b>উত্তোলন অনুরোধ সফলভাবে জমা হয়েছে!</b>\n\n💵 পরিমাণ: ৳<b>${amount}</b> Taka\n🏦 ওয়ালেট: <code>${num}</code> (${method})\n\n⏳ এডমিন কিছুক্ষণের মধ্যে চেক করে পেমেন্ট সম্পূর্ণ করে দেবেন। ধন্যবাদ!`);
    
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
          `১. আপনার বটটিকে এখনো <b>@accounttradecenterXincome</b> গ্রুপ বা চ্যানেলে <b>অ্যাডমিন (Admin)</b> করা হয়নি।\n` +
          `২. গ্রুপে বটকে অ্যাডমিন হিসেবে যুক্ত করে মেম্বার দেখার পারমিশন দিন, অন্যথায় টেলিগ্রাম এপিআই মেম্বারশিপ ভেরিফাই করতে দেয় না।\n\n` +
          `<i>(বটকে গ্রুপে অ্যাডমিন করার পর আবার ভেরিফাই বাটনে ক্লিক করে চেষ্টা করুন)</i>`,
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

  // Ensure user is member for any other callback actions
  const membership = await isUserMemberOfGroup(bot, chatId);
  if (!membership.isMember) {
    if (!membership.success) {
      await bot.sendMessage(chatId, 
        `⚠️ <b>সিস্টেম নোটিশ (System Configuration Notice):</b>\n\n` +
        `টেলিগ্রাম বটের গ্রুপ মেম্বারশিপ চেক করতে সমস্যা হচ্ছে।\n\n` +
        `🔧 <b>সমাধান করতে অনুগ্রহ করে নিচের ধাপগুলো সম্পন্ন করুন:</b>\n` +
        `১. আপনার টেলিগ্রাম বটকে অবশ্যই <b>@accounttradecenterXincome</b> গ্রুপ বা চ্যানেলে <b>অ্যাডমিন (Admin)</b> হিসেবে যুক্ত করতে হবে।\n` +
        `২. বটকে অ্যাডমিন না বানালে টেলিগ্রাম সিকিউরিটি নিয়মানুযায়ী বট কোনো মেম্বারের তথ্য অ্যাক্সেস করতে পারে না।\n\n` +
        `<i>(আপনি যদি এই বটের মালিক হন, তবে এখনই বটটিকে গ্রুপে অ্যাডমিন হিসেবে যুক্ত করুন)</i>`,
        { parse_mode: "HTML" }
      );
    }
    await showForceJoinPrompt(bot, chatId, !membership.success);
    try {
      await bot.answerCallbackQuery(callbackQuery.id);
    } catch (err) {}
    return;
  }

  // Let's redirect standard callback commands to match text inputs
  if (data === "start_registration") {
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
  }

  try {
    await bot.answerCallbackQuery(callbackQuery.id);
  } catch (err) {
    // Ignore harmless callback errors
  }
}

let currentBot: TelegramBot | null = null;
let currentBotToken: string | null = null;
let loggedDevWarning = false;

export function handleWebhookUpdate(update: any) {
  console.log("Received Webhook Update:", JSON.stringify(update));
  if (currentBot) {
    currentBot.processUpdate(update);
  } else {
    console.error("currentBot is null when receiving webhook update");
  }
}

export async function syncTelegramBot() {
  try {
    const isAIStudio = process.env.APP_URL && (
      process.env.APP_URL.includes("ais-dev-") || 
      process.env.APP_URL.includes("ais-pre-") || 
      process.env.APP_URL.includes("run.app")
    );
    const enableDevBot = process.env.ENABLE_DEV_BOT === "true";

    if (isAIStudio && !enableDevBot) {
      if (currentBot) {
        console.log("Stopping active Telegram Bot in AI Studio environment to prevent 409 Conflict...");
        try {
          if (currentBot.isPolling()) {
            await currentBot.stopPolling();
          }
        } catch (err) {
          console.error("Error stopping polling:", err);
        }
        currentBot = null;
        currentBotToken = null;
      }
      if (!loggedDevWarning) {
        console.log("⚠️ Running inside AI Studio preview environment. Polling is disabled to prevent 409 Conflict with your Render deployment.");
        console.log("💡 If you want to enable polling in development, set the environment variable ENABLE_DEV_BOT=true.");
        loggedDevWarning = true;
      }
      return;
    }

    const settingsRef = doc(db, "settings", "global");
    const settingsSnap = await getDoc(settingsRef);
    if (!settingsSnap.exists()) return;

    const settings = settingsSnap.data();
    const token = settings.telegramBotToken ? String(settings.telegramBotToken).trim() : null;

    if (token === currentBotToken) {
      return; // Token hasn't changed, do nothing
    }

    // Token changed or bot is not started yet
    if (currentBot) {
      console.log("Stopping previous Telegram Bot...");
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

    if (!token) {
      console.log("No Telegram Bot token configured in Firebase settings.");
      return;
    }

    console.log(`Starting Telegram Bot with token: ${token.substring(0, 6)}...`);
    
    // Initialize bot with polling: false to cleanly delete webhook first
    const bot = new TelegramBot(token, { polling: false });
    
    try {
      console.log("Deleting any active Telegram Webhook to enable fast polling...");
      await bot.deleteWebHook();
    } catch (whErr) {
      console.error("Error deleting webhook:", whErr);
    }

    // Start polling cleanly
    await bot.startPolling();
    currentBot = bot;

    // Handle incoming messages
    bot.on("message", async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text ? msg.text.trim() : "";
      
      try {
        await handleBotMessage(bot, chatId, text, msg);
      } catch (err: any) {
        console.error("Error handling telegram bot message:", err);
        try {
          await bot.sendMessage(chatId, `❌ একটি ভুল হয়েছে: ${err.message || 'অনুগ্রহ করে আবার চেষ্টা করুন।'}`);
        } catch (sendErr) {
          console.error("Error sending error message:", sendErr);
        }
      }
    });

    // Handle callback queries (Inline Keyboards)
    bot.on("callback_query", async (callbackQuery) => {
      try {
        await handleCallbackQuery(bot, callbackQuery);
      } catch (err) {
        console.error("Error processing callback query:", err);
      }
    });

    console.log("Telegram Bot successfully initialized and polling started.");

  } catch (error) {
    console.error("Error syncing Telegram bot settings:", error);
  }
}

// Automatically sync periodically
export async function initTelegramBot() {
  // Sync immediately
  await syncTelegramBot();
  // Sync every 30 seconds
  setInterval(syncTelegramBot, 30000);
}
