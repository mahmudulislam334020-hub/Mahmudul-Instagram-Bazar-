import { db } from "./firebase";
import { 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  doc, 
  query, 
  orderBy, 
  setDoc,
  getDoc,
  deleteDoc,
  where,
  limit,
  increment
} from "firebase/firestore";

export interface Submission {
  id?: string;
  username: string;
  password: string;
  twoFactorKey: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  submittedBy: string;
  category?: "instagram" | "facebook";
  uid?: string;
  cookie?: string;
  firstName?: string;
  lastName?: string;
  rate?: number;
}

export interface Withdrawal {
  id?: string;
  method: "bKash" | "Nagad" | "Rocket";
  number: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  submittedBy: string;
  telegramChatId?: string;
  transactionId?: string;
}

export interface AppSettings {
  ratePerId: number;
  telegramBotToken: string;
  telegramChatId: string;
  adminPassword?: string;
  usernamePrefix?: string;
  dailyPassword?: string;
  minWithdraw?: number;
  instagramWorkActive?: boolean;
  facebookFirstName?: string;
  facebookLastName?: string;
  facebookPassword?: string;
  facebookWorkActive?: boolean;
  facebookRatePerId?: number;
  withdrawalsEnabled?: boolean;
  webhookUrl?: string;
  forceJoinGroup?: string;
  forceJoinMethodChannel?: string;
}

export interface UserProfile {
  walletNumber: string;
  walletType: "bKash" | "Nagad" | "Rocket";
  createdAt: string;
  telegramChatId?: string;
  bonusBalance?: number;
  accumulatedApprovedEarnings?: number;
  payoutNumber?: string;
}

// Memory & LocalStorage Fallback database to ensure 100% uptime and testability
const getFallbackSubmissions = (): Submission[] => {
  const data = localStorage.getItem("fallback_submissions");
  return data ? JSON.parse(data) : [];
};

const saveFallbackSubmissions = (subs: Submission[]) => {
  localStorage.setItem("fallback_submissions", JSON.stringify(subs));
};

const getFallbackWithdrawals = (): Withdrawal[] => {
  const data = localStorage.getItem("fallback_withdrawals");
  return data ? JSON.parse(data) : [];
};

const saveFallbackWithdrawals = (withdraws: Withdrawal[]) => {
  localStorage.setItem("fallback_withdrawals", JSON.stringify(withdraws));
};

const getFallbackSettings = (): AppSettings => {
  const data = localStorage.getItem("fallback_settings");
  return data ? JSON.parse(data) : {
    ratePerId: 45, // default 45 Taka per ID
    telegramBotToken: "",
    telegramChatId: "",
    adminPassword: "admin123",
    usernamePrefix: "",
    dailyPassword: "",
    minWithdraw: 50,
    instagramWorkActive: true,
    facebookFirstName: "",
    facebookLastName: "",
    facebookPassword: "",
    facebookWorkActive: true,
    facebookRatePerId: 45,
    withdrawalsEnabled: true
  };
};

const saveFallbackSettings = (settings: AppSettings) => {
  localStorage.setItem("fallback_settings", JSON.stringify(settings));
};

// Helper function to race Firestore calls against a short timeout
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 2000): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("Firestore database connection timeout. Switched to fallback offline storage."));
    }, timeoutMs);
  });
  
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (err) {
    clearTimeout(timeoutId!);
    throw err;
  }
}

// FIREBASE SERVICES WITH ROBUST FALLBACKS
export async function addSubmission(sub: Omit<Submission, "id">): Promise<string> {
  try {
    const docRef = await withTimeout(addDoc(collection(db, "submissions"), sub));
    // Trigger Server side Telegram Notification (asynchronously, non-blocking)
    notifyTelegram(sub).catch(err => console.warn("Failed to notify Telegram:", err));
    return docRef.id;
  } catch (error) {
    console.warn("Firestore error, using fallback storage:", error);
    const subs = getFallbackSubmissions();
    const newId = "sub_" + Math.random().toString(36).substring(2, 9);
    const newSub = { ...sub, id: newId };
    subs.unshift(newSub);
    saveFallbackSubmissions(subs);
    notifyTelegram(sub).catch(err => console.warn("Failed to notify Telegram (fallback):", err));
    return newId;
  }
}

export async function getSubmissions(): Promise<Submission[]> {
  try {
    const q = query(collection(db, "submissions"), orderBy("createdAt", "desc"));
    const querySnapshot = await withTimeout(getDocs(q), 2500);
    const result: Submission[] = [];
    querySnapshot.forEach((doc) => {
      result.push({ id: doc.id, ...doc.data() } as Submission);
    });
    return result;
  } catch (error) {
    console.warn("Firestore error reading submissions, using fallback:", error);
    return getFallbackSubmissions();
  }
}

export async function updateSubmissionStatus(id: string, status: "approved" | "rejected"): Promise<void> {
  try {
    const docRef = doc(db, "submissions", id);
    await withTimeout(updateDoc(docRef, { status }));
  } catch (error) {
    console.warn("Firestore update error, updating fallback:", error);
    const subs = getFallbackSubmissions();
    const index = subs.findIndex(s => s.id === id);
    if (index !== -1) {
      subs[index].status = status;
      saveFallbackSubmissions(subs);
    }
  }
}

export async function updateSubmissionSubmittedBy(id: string, submittedBy: string): Promise<void> {
  try {
    const docRef = doc(db, "submissions", id);
    await withTimeout(updateDoc(docRef, { submittedBy }));
  } catch (error) {
    console.warn("Firestore update submittedBy error, updating fallback:", error);
    const subs = getFallbackSubmissions();
    const index = subs.findIndex(s => s.id === id);
    if (index !== -1) {
      subs[index].submittedBy = submittedBy;
      saveFallbackSubmissions(subs);
    }
  }
}

export async function preserveUserEarnings(walletNumberOrId: string, amount: number): Promise<void> {
  if (!walletNumberOrId || amount <= 0) return;
  try {
    const profilesRef = collection(db, "profiles");
    let targetDocRef: any = doc(db, "profiles", walletNumberOrId);
    let currentDocSnap = await getDoc(targetDocRef);
    let profileData: any = null;

    if (currentDocSnap.exists()) {
      profileData = currentDocSnap.data();
    } else {
      // Query by walletNumber, telegramChatId, or payoutNumber to avoid creating orphan duplicates
      const q1 = query(profilesRef, where("telegramChatId", "==", String(walletNumberOrId)), limit(1));
      let qSnap = await getDocs(q1);
      if (qSnap.empty) {
        const q2 = query(profilesRef, where("walletNumber", "==", String(walletNumberOrId)), limit(1));
        qSnap = await getDocs(q2);
      }
      if (qSnap.empty) {
        const q3 = query(profilesRef, where("payoutNumber", "==", String(walletNumberOrId)), limit(1));
        qSnap = await getDocs(q3);
      }

      if (!qSnap.empty) {
        targetDocRef = qSnap.docs[0].ref;
        profileData = qSnap.docs[0].data();
      }
    }

    if (profileData) {
      await updateDoc(targetDocRef, { accumulatedApprovedEarnings: increment(amount) });
    } else {
      await setDoc(targetDocRef, {
        walletNumber: walletNumberOrId,
        walletType: "bKash",
        createdAt: new Date().toISOString(),
        accumulatedApprovedEarnings: amount,
        bonusBalance: 0
      });
    }
  } catch (err) {
    console.warn(`Failed to preserve earnings for ${walletNumberOrId}:`, err);
  }
}

export async function deleteSubmission(id: string): Promise<void> {
  try {
    const docRef = doc(db, "submissions", id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.status === "approved" && data.submittedBy) {
        const settings = await getSettings();
        const defaultRate = data.category === "facebook" 
          ? (settings.facebookRatePerId || settings.ratePerId || 45)
          : (settings.ratePerId || 45);
        const rate = (data.rate !== undefined && data.rate > 0) ? data.rate : defaultRate;
        await preserveUserEarnings(data.submittedBy, rate);
      }
    }
    await withTimeout(deleteDoc(docRef));
  } catch (error) {
    console.warn("Firestore delete submission error, using fallback:", error);
  }
  const subs = getFallbackSubmissions();
  const filtered = subs.filter(s => s.id !== id);
  saveFallbackSubmissions(filtered);
}

export async function addWithdrawal(w: Omit<Withdrawal, "id">): Promise<string> {
  try {
    const docRef = await withTimeout(addDoc(collection(db, "withdrawals"), w));
    return docRef.id;
  } catch (error) {
    console.warn("Firestore withdrawal write error, using fallback:", error);
    const withdraws = getFallbackWithdrawals();
    const newId = "with_" + Math.random().toString(36).substring(2, 9);
    const newW = { ...w, id: newId };
    withdraws.unshift(newW);
    saveFallbackWithdrawals(withdraws);
    return newId;
  }
}

export async function getWithdrawals(): Promise<Withdrawal[]> {
  try {
    const q = query(collection(db, "withdrawals"), orderBy("createdAt", "desc"));
    const querySnapshot = await withTimeout(getDocs(q), 2500);
    const result: Withdrawal[] = [];
    querySnapshot.forEach((doc) => {
      result.push({ id: doc.id, ...doc.data() } as Withdrawal);
    });
    return result;
  } catch (error) {
    console.warn("Firestore withdrawals read error, using fallback:", error);
    return getFallbackWithdrawals();
  }
}

export async function updateWithdrawalStatus(id: string, status: "approved" | "rejected", transactionId?: string): Promise<void> {
  try {
    const docRef = doc(db, "withdrawals", id);
    const updateData: any = { status };
    if (transactionId !== undefined) {
      updateData.transactionId = transactionId;
    }
    await withTimeout(updateDoc(docRef, updateData));
  } catch (error) {
    console.warn("Firestore withdrawal status update error, using fallback:", error);
    const withdraws = getFallbackWithdrawals();
    const index = withdraws.findIndex(w => w.id === id);
    if (index !== -1) {
      withdraws[index].status = status;
      if (transactionId !== undefined) {
        withdraws[index].transactionId = transactionId;
      }
      saveFallbackWithdrawals(withdraws);
    }
  }
}

export async function getSettings(): Promise<AppSettings> {
  try {
    const docRef = doc(db, "settings", "global");
    const docSnap = await withTimeout(getDoc(docRef), 2000);
    if (docSnap.exists()) {
      return docSnap.data() as AppSettings;
    } else {
      const defaultSettings = getFallbackSettings();
      await withTimeout(setDoc(docRef, defaultSettings));
      return defaultSettings;
    }
  } catch (error) {
    console.warn("Firestore settings read error, using fallback:", error);
    return getFallbackSettings();
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  try {
    const docRef = doc(db, "settings", "global");
    await withTimeout(setDoc(docRef, settings));
  } catch (error) {
    console.warn("Firestore settings write error, using fallback:", error);
    saveFallbackSettings(settings);
  }
}

// User Profile persistence and fallbacks
const getFallbackProfiles = (): UserProfile[] => {
  const data = localStorage.getItem("fallback_profiles");
  return data ? JSON.parse(data) : [];
};

const saveFallbackProfile = (profile: UserProfile) => {
  const profiles = getFallbackProfiles();
  const index = profiles.findIndex(p => p.walletNumber === profile.walletNumber);
  if (index !== -1) {
    profiles[index] = profile;
  } else {
    profiles.push(profile);
  }
  localStorage.setItem("fallback_profiles", JSON.stringify(profiles));
};

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  try {
    const docRef = doc(db, "profiles", profile.walletNumber);
    await withTimeout(setDoc(docRef, profile));
    saveFallbackProfile(profile);
  } catch (error) {
    console.warn("Firestore profiles write error, using fallback:", error);
    saveFallbackProfile(profile);
  }
}

export async function getUserProfile(walletNumber: string): Promise<UserProfile | null> {
  try {
    const docRef = doc(db, "profiles", walletNumber);
    const docSnap = await withTimeout(getDoc(docRef), 2000);
    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }
    
    // Fallback: search by walletNumber field inside profiles collection
    const q = query(collection(db, "profiles"), where("walletNumber", "==", walletNumber), limit(1));
    const querySnapshot = await withTimeout(getDocs(q), 2000);
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data() as UserProfile;
    }

    const fallbacks = getFallbackProfiles();
    return fallbacks.find(p => p.walletNumber === walletNumber) || null;
  } catch (error) {
    console.warn("Firestore profile read error, using fallback:", error);
    const fallbacks = getFallbackProfiles();
    return fallbacks.find(p => p.walletNumber === walletNumber) || null;
  }
}

export async function getAllUserProfiles(): Promise<UserProfile[]> {
  try {
    const q = collection(db, "profiles");
    const querySnapshot = await withTimeout(getDocs(q), 2500);
    const result: UserProfile[] = [];
    querySnapshot.forEach((doc) => {
      result.push(doc.data() as UserProfile);
    });
    return result;
  } catch (error) {
    console.warn("Firestore profiles get error, using fallback:", error);
    return getFallbackProfiles();
  }
}

// Call backend server proxy to send Telegram message
async function notifyTelegram(sub: Omit<Submission, "id">) {
  try {
    const settings = await getSettings();
    await fetch("/api/telegram-notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submission: sub,
        botToken: settings.telegramBotToken,
        chatId: settings.telegramChatId,
        rate: settings.ratePerId
      })
    });
  } catch (e) {
    console.error("Failed to notify telegram:", e);
  }
}

export async function clearAllSubmissions(): Promise<void> {
  try {
    const settings = await getSettings();
    const q = collection(db, "submissions");
    const querySnapshot = await withTimeout(getDocs(q), 5000);
    const deletePromises: Promise<void>[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.status === "approved" && data.submittedBy) {
        const defaultRate = data.category === "facebook" 
          ? (settings.facebookRatePerId || settings.ratePerId || 45)
          : (settings.ratePerId || 45);
        const rate = (data.rate !== undefined && data.rate > 0) ? data.rate : defaultRate;
        preserveUserEarnings(data.submittedBy, rate);
      }
      deletePromises.push(deleteDoc(docSnap.ref));
    });
    await Promise.all(deletePromises);
  } catch (error) {
    console.warn("Firestore clear submissions error, using fallback:", error);
  }
  saveFallbackSubmissions([]);
}

export async function clearSubmissionsByCategory(category: "instagram" | "facebook"): Promise<void> {
  try {
    const settings = await getSettings();
    // Since some submissions may have category unset, we treat undefined as "instagram"
    const q = collection(db, "submissions");
    const querySnapshot = await withTimeout(getDocs(q), 5000);
    const deletePromises: Promise<void>[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const subCategory = data.category || "instagram";
      if (subCategory === category) {
        if (data.status === "approved" && data.submittedBy) {
          const defaultRate = category === "facebook" 
            ? (settings.facebookRatePerId || settings.ratePerId || 45)
            : (settings.ratePerId || 45);
          const rate = (data.rate !== undefined && data.rate > 0) ? data.rate : defaultRate;
          preserveUserEarnings(data.submittedBy, rate);
        }
        deletePromises.push(deleteDoc(docSnap.ref));
      }
    });
    await Promise.all(deletePromises);
  } catch (error) {
    console.warn(`Firestore clear ${category} submissions error, using fallback:`, error);
  }
  const subs = getFallbackSubmissions();
  const filtered = subs.filter(s => (s.category || "instagram") !== category);
  saveFallbackSubmissions(filtered);
}

export async function applyCompensationAndApologyForUsers(): Promise<void> {
  // Compensation already applied and auto-messages stopped.
  return;
}

export async function clearAllWithdrawals(): Promise<void> {
  try {
    const q = collection(db, "withdrawals");
    const querySnapshot = await withTimeout(getDocs(q), 5000);
    const deletePromises: Promise<void>[] = [];
    querySnapshot.forEach((docSnap) => {
      deletePromises.push(deleteDoc(docSnap.ref));
    });
    await Promise.all(deletePromises);
  } catch (error) {
    console.warn("Firestore clear withdrawals error, using fallback:", error);
  }
  saveFallbackWithdrawals([]);
}

export async function clearAllUserProfiles(): Promise<void> {
  try {
    const q = collection(db, "profiles");
    const querySnapshot = await withTimeout(getDocs(q), 5000);
    const deletePromises: Promise<void>[] = [];
    querySnapshot.forEach((docSnap) => {
      deletePromises.push(deleteDoc(docSnap.ref));
    });
    await Promise.all(deletePromises);
  } catch (error) {
    console.warn("Firestore clear profiles error, using fallback:", error);
  }
  localStorage.removeItem("fallback_profiles");
}

export async function fixAndRestoreUserIds(): Promise<{ fixedProfiles: number, fixedSubmissions: number, fixedWithdrawals: number }> {
  let fixedProfiles = 0;
  let fixedSubmissions = 0;
  let fixedWithdrawals = 0;

  try {
    const profilesSnap = await getDocs(collection(db, "profiles"));
    const phoneRegex = /^01[3-9]\d{8}$/;

    // Map from phone numbers to correct user ID (telegramChatId)
    const phoneToUserIdMap: Record<string, string> = {};

    for (const docSnap of profilesSnap.docs) {
      const pData = docSnap.data();
      const currentWallet = pData.walletNumber || "";
      const chatId = pData.telegramChatId || "";

      // Check if walletNumber is an 11-digit phone number
      if (phoneRegex.test(currentWallet) && chatId) {
        const correctUserId = chatId;
        phoneToUserIdMap[currentWallet] = correctUserId;

        await updateDoc(docSnap.ref, {
          walletNumber: correctUserId,
          payoutNumber: currentWallet
        });
        fixedProfiles++;
      } else if (chatId && currentWallet) {
        if (pData.payoutNumber && phoneRegex.test(pData.payoutNumber)) {
          phoneToUserIdMap[pData.payoutNumber] = currentWallet;
        }
      }
    }

    // Fix Submissions where submittedBy is a phone number
    const subsSnap = await getDocs(collection(db, "submissions"));
    for (const docSnap of subsSnap.docs) {
      const sData = docSnap.data();
      const submittedBy = sData.submittedBy || "";
      if (phoneToUserIdMap[submittedBy]) {
        const correctUserId = phoneToUserIdMap[submittedBy];
        await updateDoc(docSnap.ref, { submittedBy: correctUserId });
        fixedSubmissions++;
      }
    }

    // Fix Withdrawals where submittedBy is a phone number
    const withdrawsSnap = await getDocs(collection(db, "withdrawals"));
    for (const docSnap of withdrawsSnap.docs) {
      const wData = docSnap.data();
      const submittedBy = wData.submittedBy || "";
      const wChatId = wData.telegramChatId || "";

      if (phoneToUserIdMap[submittedBy]) {
        const correctUserId = phoneToUserIdMap[submittedBy];
        await updateDoc(docSnap.ref, { submittedBy: correctUserId });
        fixedWithdrawals++;
      } else if (phoneRegex.test(submittedBy) && wChatId) {
        await updateDoc(docSnap.ref, { submittedBy: wChatId });
        fixedWithdrawals++;
      }
    }

    // Fix Fallback data if local
    const fallbackProfiles = getFallbackProfiles();
    fallbackProfiles.forEach(p => {
      if (phoneRegex.test(p.walletNumber) && p.telegramChatId) {
        phoneToUserIdMap[p.walletNumber] = p.telegramChatId;
        p.payoutNumber = p.walletNumber;
        p.walletNumber = p.telegramChatId;
      }
    });
    localStorage.setItem("fallback_profiles", JSON.stringify(fallbackProfiles));

    const fallbackSubs = getFallbackSubmissions();
    fallbackSubs.forEach(s => {
      if (phoneToUserIdMap[s.submittedBy]) {
        s.submittedBy = phoneToUserIdMap[s.submittedBy];
      }
    });
    saveFallbackSubmissions(fallbackSubs);

    const fallbackWs = getFallbackWithdrawals();
    fallbackWs.forEach(w => {
      if (phoneToUserIdMap[w.submittedBy]) {
        w.submittedBy = phoneToUserIdMap[w.submittedBy];
      } else if (phoneRegex.test(w.submittedBy) && w.telegramChatId) {
        w.submittedBy = w.telegramChatId;
      }
    });
    saveFallbackWithdrawals(fallbackWs);

    console.log(`[ID Restoration] Fixed: ${fixedProfiles} profiles, ${fixedSubmissions} submissions, ${fixedWithdrawals} withdrawals`);
  } catch (err) {
    console.error("Error in fixAndRestoreUserIds:", err);
  }

  return { fixedProfiles, fixedSubmissions, fixedWithdrawals };
}

export async function adjustUserBonusBalance(workerNameOrId: string, amount: number): Promise<number> {
  if (!workerNameOrId || amount === 0) return 0;
  
  try {
    const profilesRef = collection(db, "profiles");
    let targetDocRef: any = doc(db, "profiles", workerNameOrId);
    let currentDocSnap = await getDoc(targetDocRef);
    let profileData: any = null;

    if (currentDocSnap.exists()) {
      profileData = currentDocSnap.data();
    } else {
      // Query by walletNumber, telegramChatId, or payoutNumber
      const q1 = query(profilesRef, where("telegramChatId", "==", String(workerNameOrId)), limit(1));
      let qSnap = await getDocs(q1);
      if (qSnap.empty) {
        const q2 = query(profilesRef, where("walletNumber", "==", String(workerNameOrId)), limit(1));
        qSnap = await getDocs(q2);
      }
      if (qSnap.empty) {
        const q3 = query(profilesRef, where("payoutNumber", "==", String(workerNameOrId)), limit(1));
        qSnap = await getDocs(q3);
      }

      if (!qSnap.empty) {
        targetDocRef = qSnap.docs[0].ref;
        profileData = qSnap.docs[0].data();
      }
    }

    if (profileData) {
      await updateDoc(targetDocRef, { bonusBalance: increment(amount) });
      const updatedSnap = await getDoc(targetDocRef);
      return updatedSnap.exists() ? ((updatedSnap.data() as any)?.bonusBalance || 0) : ((profileData.bonusBalance || 0) + amount);
    } else {
      // Create new profile if doc doesn't exist yet
      const newBonus = amount;
      await setDoc(targetDocRef, {
        walletNumber: workerNameOrId,
        walletType: "bKash",
        createdAt: new Date().toISOString(),
        bonusBalance: newBonus
      });
      return newBonus;
    }
  } catch (err) {
    console.warn("Failed to adjust user bonus balance in Firestore:", err);
    // Fallback in localStorage
    const fallbacks = getFallbackProfiles();
    let p = fallbacks.find(f => f.walletNumber === workerNameOrId || f.telegramChatId === workerNameOrId || f.payoutNumber === workerNameOrId);
    if (p) {
      p.bonusBalance = (p.bonusBalance || 0) + amount;
    } else {
      p = {
        walletNumber: workerNameOrId,
        walletType: "bKash",
        createdAt: new Date().toISOString(),
        bonusBalance: amount
      };
      fallbacks.push(p);
    }
    localStorage.setItem("fallback_profiles", JSON.stringify(fallbacks));
    return p.bonusBalance || 0;
  }
}

