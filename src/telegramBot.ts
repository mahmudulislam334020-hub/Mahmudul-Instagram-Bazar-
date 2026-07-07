import TelegramBot from "node-telegram-bot-api";
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
    | 'awaiting_withdraw_amount'
    | 'awaiting_independent_2fa_key'
    | 'awaiting_wallet_number'
    | 'awaiting_wallet_type';
  instagramData?: {
    username?: string;
    password?: string;
    twoFactorKey?: string;
    credentialMsgId?: number; // Message containing the auto username/password
    promptMsgId?: number;     // Message requesting 2FA or displaying TOTP
  };
  walletData?: {
    number?: string;
    type?: 'bKash' | 'Nagad' | 'Rocket';
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

// --- Helper: Credential Generator ---
function generateInstagramCreds(prefix?: string, dailyPassword?: string) {
  let username = "";
  if (prefix) {
    const num = Math.floor(1000 + Math.random() * 9000);
    username = `${prefix.trim()}${num}`;
  } else {
    const firstNames = ["abir", "siam", "sabbir", "mishu", "arif", "tanvir", "shakib", "fahim", "rakib", "emon", "shakil", "nirob", "russel", "ruman"];
    const lastNames = ["khan", "ahmed", "hossain", "rahman", "chowdhury", "islam", "hasan", "sheikh", "talukder", "bhuiyan"];
    const suffixes = ["insta", "ig", "safe", "work", "verify", "secure"];
    
    const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
    const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
    const suf = suffixes[Math.floor(Math.random() * suffixes.length)];
    const num = Math.floor(1000 + Math.random() * 9000); // 4 digits
    username = `${fn}_${ln}_${suf}${num}`;
  }
  
  let password = "";
  if (dailyPassword) {
    password = dailyPassword;
  } else {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#%*";
    for (let i = 0; i < 10; i++) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  return { username, password };
}

// --- Helper: Fetch user statistics ---
async function getUserStats(walletNumber: string) {
  const settingsRef = doc(db, "settings", "global");
  const settingsSnap = await getDoc(settingsRef);
  const settings = settingsSnap.exists() ? settingsSnap.data() : { ratePerId: 45 };
  const ratePerId = settings.ratePerId || 45;

  const submissionsRef = collection(db, "submissions");
  const subSnap = await getDocs(submissionsRef);
  const submissions: any[] = [];
  subSnap.forEach(d => {
    submissions.push(d.data());
  });

  const withdrawalsRef = collection(db, "withdrawals");
  const withSnap = await getDocs(withdrawalsRef);
  const withdrawals: any[] = [];
  withSnap.forEach(d => {
    withdrawals.push(d.data());
  });

  const userSubmissions = submissions.filter(s => s.submittedBy === walletNumber);
  const approvedCount = userSubmissions.filter(s => s.status === "approved").length;
  const pendingCount = userSubmissions.filter(s => s.status === "pending").length;
  const rejectedCount = userSubmissions.filter(s => s.status === "rejected").length;

  const totalEarned = approvedCount * ratePerId;

  const approvedWithdrawn = withdrawals
    .filter(w => w.submittedBy === walletNumber && w.status === "approved")
    .reduce((sum, current) => sum + current.amount, 0);

  const pendingWithdrawn = withdrawals
    .filter(w => w.submittedBy === walletNumber && w.status === "pending")
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
               `👤 <b>প্রোফাইল:</b> <code>${profile.walletNumber}</code> (${profile.walletType})\n` +
               `✨ নিচে দেওয়া অপশনগুলো ব্যবহার করে কাজ করুন:`;
  
  await bot.sendMessage(chatId, text, {
    parse_mode: "HTML",
    reply_markup: {
      keyboard: [
        [{ text: "📸 ইনস্টাগ্রাম টু-এফএ কাজ" }],
        [
          { text: "✨ New Insta Username Generator" },
          { text: "🔑 Two Factor Authenticator" }
        ],
        [
          { text: "💰 ব্যালেন্স চেক" },
          { text: "💸 ব্যালেন্স উত্তোলন" }
        ],
        [
          { text: "⚙️ ওয়ালেট সেটিংস" }
        ]
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  });
}

// --- Force Join Helpers ---
async function isUserMemberOfGroup(bot: TelegramBot, chatId: number): Promise<{ success: boolean; isMember: boolean; error?: string }> {
  try {
    console.log("Checking membership for chat ID (as user_id):", chatId);
    const member = await bot.getChatMember("@accounttradecenterXincome", chatId);
    const validStatuses = ["creator", "administrator", "member", "restricted"];
    return { success: true, isMember: validStatuses.includes(member.status) };
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
async function handleAdminCommand(bot: TelegramBot, chatId: number) {
  if (chatId !== 7990244560) {
    await bot.sendMessage(chatId, "You do not have permission to use this command.");
    return;
  }

  const submissionsRef = collection(db, "submissions");
  const querySnapshot = await getDocs(submissionsRef);
  const data = querySnapshot.docs.map(doc => doc.data());

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Submissions");
  
  const filePath = path.join(process.cwd(), 'submissions.xlsx');
  XLSX.writeFile(wb, filePath);

  await bot.sendDocument(chatId, filePath);
  
  // Cleanup
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
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

  // Admin Command
  if (text === "/admin") {
    await handleAdminCommand(bot, chatId);
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
    if (text === "📸 ইনস্টাগ্রাম টু-এফএ কাজ") {
      await cleanUpInstagramMessages(bot, chatId, state);

      let customPrefix = "";
      let customDailyPassword = "";
      try {
        const settingsSnap = await getDoc(doc(db, "settings", "global"));
        if (settingsSnap.exists()) {
          const sData = settingsSnap.data();
          customPrefix = sData.usernamePrefix || "";
          customDailyPassword = sData.dailyPassword || "";
        }
      } catch (e) {
        console.warn("Error loading settings in bot command:", e);
      }

      const creds = generateInstagramCreds(customPrefix, customDailyPassword);
      
      const credsMsg = await bot.sendMessage(chatId, `🔑 <b>ইনস্টাগ্রাম টু-এফএ নতুন কাজের অ্যাকাউন্ট:</b>\n\n` +
                                     `👤 <b>Username:</b> <code>${creds.username}</code>\n` +
                                     `🔑 <b>Password:</b> <code>${creds.password}</code>\n\n` +
                                     `<i>১. প্রথমে এই ইউজারনেম ও পাসওয়ার্ড দিয়ে ইনস্টাগ্রাম অ্যাপে গিয়ে সাইন-আপ/নতুন অ্যাকাউন্ট তৈরি করুন।\n` +
                                     `২. অ্যাকাউন্ট তৈরি করার সময় অবশ্যই Two-Factor Authentication (2FA) চালু করবেন।\n` +
                                     `৩. 2FA সিক্রেট কিটি পাওয়ার পর নিচের বাটনটিতে ক্লিক করে কোড নিন।</i>`, {
        parse_mode: "HTML"
      });

      const promptMsg = await bot.sendMessage(chatId, `🛡️ অ্যাকাউন্ট তৈরি শুরু হয়েছে। টু-এফএ সেট করতে নিচের বাটনে ক্লিক করুন অথবা যেকোনো সময় বাতিল করুন:`, {
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

    if (text === "✨ New Insta Username Generator") {
      const generatedUsername = generatePrefixlessUsername();
      await bot.sendMessage(chatId, 
        `✨ <b>নতুন ইনস্টাগ্রাম ইউজারনেম (Insta Username):</b>\n\n` +
        `👤 <code>${generatedUsername}</code>\n\n` +
        `<i>(ইউজারনেমের ওপরে ট্যাপ করলে এটি কপি হয়ে যাবে। এটি কোনো প্রিফিক্স ছাড়া সম্পূর্ণ নতুন একটি নাম)</i>`, 
        {
          parse_mode: "HTML",
          reply_markup: {
            keyboard: [
              [{ text: "📸 ইনস্টাগ্রাম টু-এফএ কাজ" }],
              [
                { text: "✨ New Insta Username Generator" },
                { text: "🔑 Two Factor Authenticator" }
              ],
              [
                { text: "💰 ব্যালেন্স চেক" },
                { text: "💸 ব্যালেন্স উত্তোলন" }
              ]
            ],
            resize_keyboard: true
          }
        }
      );
      return;
    }

    if (text === "🔑 Two Factor Authenticator") {
      await bot.sendMessage(chatId, 
        `🔑 <b>টু-ফ্যাক্টর অথেনটিকেটর (2FA Authenticator)</b>\n\n` +
        `অনুগ্রহ করে আপনার ২-ফ্যাক্টর কি <b>(2FA Secret Key)</b> টি নিচে লিখে বা পেস্ট করে পাঠান:\n\n` +
        `<i>(আমরা আপনাকে ৬ সংখ্যার কোড জেনারেট করে দিব যা প্রতি ৩০ সেকেন্ড পর পর পরিবর্তন হয়)</i>`,
        {
          parse_mode: "HTML",
          reply_markup: {
            keyboard: [[{ text: "🔙 মেইন মেনু" }]],
            resize_keyboard: true
          }
        }
      );
      state.step = "awaiting_independent_2fa_key";
      userStates.set(chatId, state);
      return;
    }

    if (text === "⚙️ ওয়ালেট সেটিংস") {
      state.step = "awaiting_wallet_number";
      state.walletData = {};
      userStates.set(chatId, state);
      await bot.sendMessage(chatId, `📱 অনুগ্রহ করে আপনার সচল ১১-ডিজিটের মোবাইল ব্যাংকিং অ্যাকাউন্ট নাম্বারটি (বিকাশ/নগদ/রকেট) লিখে পাঠান:`, {
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [[{ text: "🔙 মেইন মেনু" }]],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      });
      return;
    }

    if (text === "💰 ব্যালেন্স চেক") {
      const stats = await getUserStats(profile.walletNumber);
      const balanceText = `💰 <b>আপনার ওয়ালেট ব্যালেন্স তথ্য (Balance Stats):</b>\n\n` +
                          `📱 <b>ওয়ালেট:</b> <code>${profile.walletNumber}</code> (${profile.walletType})\n` +
                          `💵 <b>উইথড্রযোগ্য ব্যালেন্স:</b> ৳<b>${stats.balance}</b> Taka\n\n` +
                          `✅ <b>অনুমোদিত আইডি:</b> ${stats.approvedCount} টি (৳${stats.totalEarned})\n` +
                          `⏳ <b>পেন্ডিং আইডি:</b> ${stats.pendingCount} টি\n` +
                          `❌ <b>বাতিল আইডি:</b> ${stats.rejectedCount} টি\n\n` +
                          `💸 <b>মোট উইথড্র করেছেন:</b> ৳${stats.approvedWithdrawn} Taka\n` +
                          `🕒 <b>পেন্ডিং উইথড্র:</b> ৳${stats.pendingWithdrawn} Taka`;

      await bot.sendMessage(chatId, balanceText, {
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [
            [{ text: "📸 ইনস্টাগ্রাম টু-এফএ কাজ" }],
            [
              { text: "✨ New Insta Username Generator" },
              { text: "🔑 Two Factor Authenticator" }
            ],
            [{ text: "💰 ব্যালেন্স চেক" }, { text: "💸 ব্যালেন্স উত্তোলন" }]
          ],
          resize_keyboard: true
        }
      });
      return;
    }

    if (text === "💸 ব্যালেন্স উত্তোলন") {
      if (!profile.walletNumber) {
        await bot.sendMessage(chatId, `❌ <b>আপনার ওয়ালেট সেট করা নেই!</b>\n\nউত্তোলন করার আগে অনুগ্রহ করে <b>'⚙️ ওয়ালেট সেটিংস'</b> এ গিয়ে আপনার ওয়ালেট নাম্বার সেট করুন।`, {
          reply_markup: {
            keyboard: [
              [{ text: "📸 ইনস্টাগ্রাম টু-এফএ কাজ" }],
              [
                { text: "✨ New Insta Username Generator" },
                { text: "🔑 Two Factor Authenticator" }
              ],
              [{ text: "💰 ব্যালেন্স চেক" }, { text: "💸 ব্যালেন্স উত্তোলন" }, { text: "⚙️ ওয়ালেট সেটিংস" }]
            ],
            resize_keyboard: true
          }
        });
        return;
      }
      const stats = await getUserStats(profile.walletNumber);

      if (stats.balance <= 0) {
        await bot.sendMessage(chatId, `❌ <b>দুঃখিত!</b> আপনার পর্যাপ্ত ব্যালেন্স নেই। বর্তমানে আপনার ব্যালেন্স ৳০ Taka।`, {
          reply_markup: {
            keyboard: [
              [{ text: "📸 ইনস্টাগ্রাম টু-এফএ কাজ" }],
              [
                { text: "✨ New Insta Username Generator" },
                { text: "🔑 Two Factor Authenticator" }
              ],
              [{ text: "💰 ব্যালেন্স চেক" }, { text: "💸 ব্যালেন্স উত্তোলন" }]
            ],
            resize_keyboard: true
          }
        });
        return;
      }

      state.step = "awaiting_withdraw_amount";
      userStates.set(chatId, state);

      await bot.sendMessage(chatId, `💸 <b>টাকা উত্তোলন অনুরোধ (Withdraw Cash)</b>\n\n` +
                                   `📱 ওয়ালেট: <code>${profile.walletNumber}</code> (${profile.walletType})\n` +
                                   `💵 উত্তোলনযোগ্য ব্যালেন্স: ৳<b>${stats.balance}</b> Taka\n\n` +
                                   `💰 আপনি কত টাকা তুলতে চান? অনুগ্রহ করে শুধুমাত্র সংখ্যায় পরিমাণটি লিখে পাঠান:`, {
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [[{ text: "🔙 মেইন মেনু" }]],
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
        submittedBy: profile.walletNumber,
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
                        `👤 <b>Submitted By:</b> <code>${profile.walletNumber}</code> (Bot)\n` +
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

      await bot.sendMessage(chatId, `🎉 <b>অ্যাকাউন্ট সফলভাবে এডমিন প্যানেলে জমা হয়েছে!</b>\n\n⏳ এডমিন আইডিটি চেক করার পর আপনার ব্যালেন্সে ৳${ratePerId} Taka যোগ করে দেওয়া হবে।`);
      
      state.step = "main_menu";
      state.instagramData = undefined;
      userStates.set(chatId, state);
      await showMainMenu(bot, chatId, profile);
      return;
    }

    if (text === "🛡️ টু-এফএ সেট করুন") {
      const promptMsg = await bot.sendMessage(chatId, `🔑 অনুগ্রহ করে আপনার ইনস্টাগ্রামের <b>২-ফ্যাক্টর কি (2FA Secret Key)</b> টি নিচে টাইপ বা পেস্ট করে পাঠান:\n\n<i>(আমরা আপনাকে ৬ সংখ্যার কোড জেনারেট করে দিব)</i>`, {
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
      const errorPrompt = await bot.sendMessage(chatId, `❌ <b>ভুল ২-ফ্যাক্টর সিক্রেট কি!</b>\n\nঅনুগ্রহ করে একটি সঠিক ও সচল 2FA Secret Key দিন (স্পেস বা হাইফেন ছাড়া):`, {
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
    const codeMsg = await bot.sendMessage(chatId, `🛡️ <b>আপনার ২-ফ্যাক্টর সিকিউরিটি ভেরিফিকেশন কোড:</b>\n\n🔑 <code>${totpCode}</code>\n\n<i>(এই কোডটি কপি করে ইনস্টাগ্রামে অ্যাকাউন্ট ভেরিফিকেশন সম্পন্ন করুন। কোডটি প্রতি ৩০ সেকেন্ড পর পরিবর্তন হয়)</i>`, {
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
        `❌ <b>ভুল ২-ফ্যাক্টর সিক্রেট কি!</b>\n\n` +
        `অনুগ্রহ করে একটি সঠিক ও সচল 2FA Secret Key দিন (স্পেস বা হাইফেন ছাড়া):\n\n` +
        `<i>(অথবা ফিরে যেতে নিচের '🔙 মেইন মেনু' বাটনে ক্লিক করুন)</i>`, 
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
      `🛡️ <b>আপনার ২-ফ্যাক্টর ভেরিফিকেশন কোড:</b>\n\n` +
      `🔑 <code>${totpCode}</code>\n\n` +
      `<i>(কোডটি কপি করতে কোডের ওপর ক্লিক করুন। এটি প্রতি ৩০ সেকেন্ড পর পর পরিবর্তন হয়)</i>`, 
      {
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [
            [{ text: "🔑 Two Factor Authenticator" }],
            [{ text: "🔙 মেইন মেনু" }]
          ],
          resize_keyboard: true
        }
      }
    );
    return;
  }

  // --- Step: Awaiting Wallet Number ---
  if (state.step === "awaiting_wallet_number") {
    if (text === "🔙 মেইন মেনু" || text === "❌ বাতিল করুন") {
      state.step = "main_menu";
      state.walletData = undefined;
      userStates.set(chatId, state);
      await showMainMenu(bot, chatId, profile);
      return;
    }
    const walletNum = text.replace(/\D/g, "");
    if (walletNum.length !== 11 || !walletNum.startsWith("01")) {
      await bot.sendMessage(chatId, `❌ <b>ভুল নাম্বার!</b> অনুগ্রহ করে একটি সঠিক ১১ ডিজিটের মোবাইল নাম্বার প্রদান করুন (যেমন: 017XXXXXXXX):`, {
        reply_markup: {
          keyboard: [[{ text: "🔙 মেইন মেনু" }]],
          resize_keyboard: true
        }
      });
      return;
    }
    state.walletData = { ...state.walletData, number: walletNum };
    state.step = "awaiting_wallet_type";
    userStates.set(chatId, state);
    await bot.sendMessage(chatId, `📱 <b>নাম্বার সেট হয়েছে:</b> <code>${walletNum}</code>\n\n🏦 এবার আপনার মোবাইল ব্যাংকিং ওয়ালেটের ধরণ সিলেক্ট করুন:`, {
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

  // --- Step: Awaiting Wallet Type ---
  if (state.step === "awaiting_wallet_type") {
    if (text === "🔙 মেইন মেনু" || text === "❌ বাতিল করুন") {
      state.step = "main_menu";
      state.walletData = undefined;
      userStates.set(chatId, state);
      await showMainMenu(bot, chatId, profile);
      return;
    }

    let selectedType: 'bKash' | 'Nagad' | 'Rocket' | null = null;
    if (text.includes("bKash") || text.includes("বিকাশ")) {
      selectedType = 'bKash';
    } else if (text.includes("Nagad") || text.includes("নগদ")) {
      selectedType = 'Nagad';
    } else if (text.includes("Rocket") || text.includes("রকেট")) {
      selectedType = 'Rocket';
    }

    if (!selectedType) {
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

    // Update profile in DB
    const profilesRef = collection(db, "profiles");
    const q = query(profilesRef, where("telegramChatId", "==", String(chatId)), limit(1));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        await updateDoc(querySnapshot.docs[0].ref, {
            walletNumber: state.walletData?.number || "",
            walletType: selectedType
        });
    }

    state.step = "main_menu";
    state.walletData = undefined;
    userStates.set(chatId, state);
    
    // Refresh profile to show new data
    const newSnapshot = await getDocs(q);
    const updatedProfile = newSnapshot.docs[0].data();
    
    await bot.sendMessage(chatId, `✅ <b>ওয়ালেট সেটিংস সফলভাবে সম্পন্ন হয়েছে!</b>`);
    await showMainMenu(bot, chatId, updatedProfile);
    return;
  }

  // --- 8. Step: Awaiting Withdraw Amount ---
  if (state.step === "awaiting_withdraw_amount") {
    if (text === "🔙 মেইন মেনু" || text === "❌ বাতিল করুন") {
      state.step = "main_menu";
      state.instagramData = undefined;
      userStates.set(chatId, state);
      await showMainMenu(bot, chatId, profile);
      return;
    }

    const amount = parseFloat(text.replace(/\D/g, ""));
    if (isNaN(amount) || amount <= 0) {
      await bot.sendMessage(chatId, `❌ <b>ভুল পরিমাণ!</b> অনুগ্রহ করে শুধুমাত্র সংখ্যায় সঠিক পরিমাণটি লিখুন (যেমন: ৫০০):`, {
        reply_markup: {
          keyboard: [[{ text: "🔙 মেইন মেনু" }]],
          resize_keyboard: true
        }
      });
      return;
    }

    const stats = await getUserStats(profile.walletNumber);

    if (amount > stats.balance) {
      await bot.sendMessage(chatId, `❌ <b>পর্যাপ্ত ব্যালেন্স নেই!</b>\n\nআপনার বর্তমান উইথড্রযোগ্য ব্যালেন্স: ৳${stats.balance} Taka। আপনি ৳${amount} উইথড্র করার চেষ্টা করছেন।`, {
        reply_markup: {
          keyboard: [[{ text: "🔙 মেইন মেনু" }]],
          resize_keyboard: true
        }
      });
      return;
    }

    // Save withdrawal
    const newW = {
      method: profile.walletType,
      number: profile.walletNumber,
      amount: amount,
      status: 'pending',
      createdAt: new Date().toISOString(),
      submittedBy: profile.walletNumber
    };

    await addDoc(collection(db, "withdrawals"), newW);

    // Notify Admin via Telegram
    const adminText = `💸 <b>নতুন পেমেন্ট উইথড্র অনুরোধ (Bot)</b> 💸\n\n` +
                      `👤 <b>ইউজার:</b> <code>${profile.walletNumber}</code>\n` +
                      `🏦 <b>মাধ্যম:</b> ${profile.walletType}\n` +
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

    await bot.sendMessage(chatId, `✅ <b>উত্তোলন অনুরোধ সফলভাবে জমা হয়েছে!</b>\n\n💵 পরিমাণ: ৳<b>${amount}</b> Taka\n🏦 ওয়ালেট: <code>${profile.walletNumber}</code> (${profile.walletType})\n\n⏳ এডমিন কিছুক্ষণের মধ্যে চেক করে পেমেন্ট সম্পূর্ণ করে দেবেন। ধন্যবাদ!`);
    
    state.step = "main_menu";
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

export async function syncTelegramBot() {
  try {
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
      console.log("Stopping previous Telegram Bot polling...");
      try {
        await currentBot.stopPolling();
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
    
    // Initialize bot
    const bot = new TelegramBot(token, { polling: true });
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
export function initTelegramBot() {
  // Sync immediately
  syncTelegramBot();
  // Sync every 30 seconds
  setInterval(syncTelegramBot, 30000);
}
