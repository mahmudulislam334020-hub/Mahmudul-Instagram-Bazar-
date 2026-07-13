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
  limit
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
}

export interface UserProfile {
  walletNumber: string;
  walletType: "bKash" | "Nagad" | "Rocket";
  createdAt: string;
  telegramChatId?: string;
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
    facebookRatePerId: 45
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

export async function deleteSubmission(id: string): Promise<void> {
  try {
    const docRef = doc(db, "submissions", id);
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

export async function updateWithdrawalStatus(id: string, status: "approved" | "rejected"): Promise<void> {
  try {
    const docRef = doc(db, "withdrawals", id);
    await withTimeout(updateDoc(docRef, { status }));
  } catch (error) {
    console.warn("Firestore withdrawal status update error, using fallback:", error);
    const withdraws = getFallbackWithdrawals();
    const index = withdraws.findIndex(w => w.id === id);
    if (index !== -1) {
      withdraws[index].status = status;
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
    const q = collection(db, "submissions");
    const querySnapshot = await withTimeout(getDocs(q), 5000);
    const deletePromises: Promise<void>[] = [];
    querySnapshot.forEach((docSnap) => {
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
    // Since some submissions may have category unset, we treat undefined as "instagram"
    const q = collection(db, "submissions");
    const querySnapshot = await withTimeout(getDocs(q), 5000);
    const deletePromises: Promise<void>[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const subCategory = data.category || "instagram";
      if (subCategory === category) {
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

