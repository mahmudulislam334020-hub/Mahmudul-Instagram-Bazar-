import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { initTelegramBot, handleWebhookUpdate } from "./src/telegramBot";

// Load configuration dynamically
let projectId = "mahmudul-instagram-bazar";
let databaseId = "ai-studio-accountmanager-ec6eda59-6fd3-4a88-b03d-16ce0e0e9a3c";

try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    if (firebaseConfig.projectId) {
      projectId = firebaseConfig.projectId;
    }
    if (firebaseConfig.firestoreDatabaseId) {
      databaseId = firebaseConfig.firestoreDatabaseId;
    }
  }
} catch (err) {
  console.error("Error reading firebase-applet-config.json inside server.ts:", err);
}

async function getGlobalSettings() {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/settings/global`;
    const res = await fetch(url);
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    if (!data.fields) return null;
    
    const fields = data.fields;
    return {
      adminPassword: fields.adminPassword?.stringValue || "admin123",
      telegramBotToken: fields.telegramBotToken?.stringValue || "",
      telegramChatId: fields.telegramChatId?.stringValue || "",
      usernamePrefix: fields.usernamePrefix?.stringValue || "",
      dailyPassword: fields.dailyPassword?.stringValue || "",
      minWithdraw: fields.minWithdraw?.integerValue ? parseInt(fields.minWithdraw.integerValue) : (fields.minWithdraw?.doubleValue ? parseFloat(fields.minWithdraw.doubleValue) : 50),
      ratePerId: fields.ratePerId?.integerValue ? parseInt(fields.ratePerId.integerValue) : (fields.ratePerId?.doubleValue ? parseFloat(fields.ratePerId.doubleValue) : 45),
      facebookFirstName: fields.facebookFirstName?.stringValue || "",
      facebookLastName: fields.facebookLastName?.stringValue || "",
      facebookPassword: fields.facebookPassword?.stringValue || "",
      facebookWorkActive: fields.facebookWorkActive?.booleanValue !== false,
      facebookRatePerId: fields.facebookRatePerId?.integerValue ? parseInt(fields.facebookRatePerId.integerValue) : (fields.facebookRatePerId?.doubleValue ? parseFloat(fields.facebookRatePerId.doubleValue) : 45),
      webhookUrl: fields.webhookUrl?.stringValue || ""
    };
  } catch (err) {
    console.error("Error reading global settings from REST API:", err);
    return null;
  }
}

export const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Initialize the Telegram Bot
initTelegramBot().then(() => {
  console.log("Telegram Bot initialization triggered successfully.");
}).catch((err) => {
  console.error("Failed to trigger Telegram Bot initialization:", err);
});

// Middleware to parse JSON
app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Telegram webhook route to process incoming bot updates
  app.post("/api/telegram-webhook", async (req, res) => {
    try {
      await handleWebhookUpdate(req.body);
      res.status(200).json({ ok: true });
    } catch (err: any) {
      console.error("Webhook route error:", err);
      res.status(500).json({ error: err?.message || "Internal Webhook Error" });
    }
  });

  // Verify Admin Password safely on the server side
  app.post("/api/admin/verify-password", async (req, res) => {
    const { password } = req.body;
    try {
      const settings = await getGlobalSettings();
      const adminPass = settings?.adminPassword || "admin123";
      if (password === adminPass) {
        res.json({ success: true });
      } else {
        res.json({ success: false });
      }
    } catch (err) {
      console.error("Error verifying password:", err);
      res.status(500).json({ success: false, error: "Authentication failed" });
    }
  });

  // Direct notification to user about approval or rejection
  app.post("/api/telegram-direct-notify", async (req, res) => {
    const { targetWalletNumber, telegramChatId, type, details, items } = req.body;
    try {
      const settings = await getGlobalSettings();
      if (!settings || !settings.telegramBotToken) {
        return res.json({ status: "skipped", message: "Telegram bot token is not configured." });
      }

      // Fetch profile from Firestore REST API
      let chatId = telegramChatId;

      if (!chatId) {
        const profileUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/profiles/${targetWalletNumber}`;
        const profileRes = await fetch(profileUrl);
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          chatId = profileData.fields?.telegramChatId?.stringValue;
        }
      }

      // If not found or chat ID is missing, fall back to searching by walletNumber field using a structured query
      if (!chatId) {
        console.log(`Profile document not found directly by ID for user ${targetWalletNumber}, attempting structured query search...`);
        const queryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:runQuery`;
        const queryRes = await fetch(queryUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            structuredQuery: {
              from: [{ collectionId: "profiles" }],
              where: {
                fieldFilter: {
                  field: { fieldPath: "walletNumber" },
                  op: "EQUAL",
                  value: { stringValue: targetWalletNumber }
                }
              },
              limit: 1
            }
          })
        });

        if (queryRes.ok) {
          const queryResults = await queryRes.json();
          if (Array.isArray(queryResults) && queryResults.length > 0 && queryResults[0].document) {
            const docData = queryResults[0].document;
            chatId = docData.fields?.telegramChatId?.stringValue;
            console.log(`Successfully found chat ID ${chatId} using structured query search.`);
          }
        }
      }

      // If still not found, check if targetWalletNumber is actually a numeric telegramChatId itself
      if (!chatId && /^\d+$/.test(targetWalletNumber) && !targetWalletNumber.startsWith("01")) {
        chatId = targetWalletNumber;
        console.log(`Using target identifier ${targetWalletNumber} directly as the telegramChatId.`);
      }

      if (!chatId) {
        console.warn(`Profile for user ${targetWalletNumber} does not have a registered telegramChatId.`);
        return res.json({ status: "skipped", message: "User profile has no Telegram Chat ID linked yet." });
      }

      let text = "";
      if (type === "id_approved") {
        const isFacebook = details?.category === "facebook";
        const rate = isFacebook 
          ? (settings.facebookRatePerId !== undefined ? settings.facebookRatePerId : settings.ratePerId)
          : settings.ratePerId;
        const workName = isFacebook ? "ফেসবুক কাজ" : "ইনস্টাগ্রাম আইডি কাজ";
        const idLabel = isFacebook ? "UID" : "ইউজারনেম";
        
        text = `✅ <b>আপনার ${workName} অনুমোদিত হয়েছে! (ID Approved)</b>\n\n` +
               `👤 <b>${idLabel}:</b> <code>${details.username}</code>\n` +
               `💵 <b>রেট:</b> ৳${rate} Taka\n\n` +
               `🎉 আপনার ব্যালেন্সে টাকা যোগ করে দেওয়া হয়েছে। আরও কাজ করতে চাইলে আবার শুরু করুন!`;
      } else if (type === "id_rejected") {
        const isFacebook = details?.category === "facebook";
        const workName = isFacebook ? "ফেসবুক কাজ" : "ইনস্টাগ্রাম আইডি কাজ";
        const idLabel = isFacebook ? "UID" : "ইউজারনেম";

        text = `❌ <b>আপনার ${workName} বাতিল করা হয়েছে! (ID Rejected)</b>\n\n` +
               `👤 <b>${idLabel}:</b> <code>${details.username}</code>\n\n` +
               `⚠️ সঠিক তথ্য বা সক্রিয় কুকি/টু-এফএ সেট না করায় আপনার আইডিটি বাতিল করা হয়েছে। অনুগ্রহ করে নিয়ম মেনে আবার চেষ্টা করুন।`;
      } else if (type === "id_bulk_approved") {
        const totalCount = items?.length || 0;
        let itemsListText = "";
        let totalAmount = 0;
        
        if (Array.isArray(items)) {
          items.forEach((item: any) => {
            const isFacebook = item.category === "facebook";
            const rate = isFacebook 
              ? (settings.facebookRatePerId !== undefined ? settings.facebookRatePerId : settings.ratePerId)
              : settings.ratePerId;
            totalAmount += rate;
            const idLabel = isFacebook ? "UID" : "ইউজারনেম";
            itemsListText += `• <b>${idLabel}:</b> <code>${item.username}</code> (৳${rate} Taka)\n`;
          });
        }

        text = `✅ <b>আপনার ${totalCount} টি কাজ অনুমোদিত হয়েছে! (IDs Approved)</b>\n\n` +
               itemsListText + `\n` +
               `💵 <b>মোট জমা:</b> ৳<b>${totalAmount}</b> Taka\n` +
               `🎉 আপনার ব্যালেন্সে টাকা যোগ করে দেওয়া হয়েছে। আরও কাজ করতে চাইলে আবার শুরু করুন!`;
      } else if (type === "id_bulk_rejected") {
        const totalCount = items?.length || 0;
        let itemsListText = "";
        
        if (Array.isArray(items)) {
          items.forEach((item: any) => {
            const isFacebook = item.category === "facebook";
            const idLabel = isFacebook ? "UID" : "ইউজারনেম";
            itemsListText += `• <b>${idLabel}:</b> <code>${item.username}</code> (${isFacebook ? "ফেসবুক" : "ইনস্টাগ্রাম"})\n`;
          });
        }

        text = `❌ <b>আপনার ${totalCount} টি কাজ বাতিল করা হয়েছে! (IDs Rejected)</b>\n\n` +
               itemsListText + `\n` +
               `⚠️ সঠিক তথ্য বা সক্রিয় কুকি/টু-এফএ সেট না করায় আপনার আইডিগুলো বাতিল করা হয়েছে। অনুগ্রহ করে নিয়ম মেনে আবার চেষ্টা করুন।`;
      } else if (type === "withdraw_approved") {
        text = `💸 <b>আপনার টাকা উত্তোলনের অনুরোধটি সফলভাবে পেইড হয়েছে! (Withdraw Approved)</b>\n\n` +
               `💵 <b>পরিমাণ:</b> ৳<b>${details.amount}</b> Taka\n` +
               `🏦 <b>ওয়ালেট:</b> <b>${details.method}</b> (${details.number})\n\n` +
               `🎉 আপনার মোবাইল ব্যাংকিং অ্যাকাউন্টে টাকা পাঠিয়ে দেওয়া হয়েছে। আমাদের সাথে কাজ করার জন্য ধন্যবাদ!`;
      } else if (type === "withdraw_rejected") {
        text = `❌ <b>আপনার টাকা উত্তোলনের অনুরোধটি বাতিল করা হয়েছে! (Withdraw Rejected)</b>\n\n` +
               `💵 <b>পরিমাণ:</b> ৳<b>${details.amount}</b> Taka\n` +
               `🏦 <b>ওয়ালেট:</b> <b>${details.method}</b> (${details.number})\n\n` +
               `⚠️ কোনো ত্রুটির কারণে আপনার উত্তোলন অনুরোধ বাতিল করা হয়েছে। টাকাটি আপনার ওয়ালেট ব্যালেন্সে ফেরত দেওয়া হয়েছে। অনুগ্রহ করে এডমিনের সাথে যোগাযোগ করুন।`;
      }

      const url = `https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: String(chatId).trim(),
          text: text,
          parse_mode: "HTML"
        })
      });

      const data = await response.json();
      res.status(200).json({ status: "success", telegramResponse: data });
    } catch (error: any) {
      console.error("Error sending user direct notification:", error);
      res.status(500).json({ error: error?.message || "Failed to trigger user notification" });
    }
  });

  // Proxy route for Telegram notifications
  app.post("/api/telegram-notify", async (req, res) => {
    const { submission, botToken, chatId, rate } = req.body;
    
    if (!botToken || !chatId) {
      console.log("Telegram Token or Chat ID not configured. Skipping notification.");
      return res.status(200).json({ status: "skipped", message: "Telegram not configured" });
    }

    const escapeHtml = (unsafe: string = "") => {
      return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

    try {
      const formattedRate = rate || 45;
      const submittedByStr = submission.submittedBy || 'Guest';
      const localTimeStr = submission.createdAt ? new Date(submission.createdAt).toLocaleString() : new Date().toLocaleString();

      const text = `🎉 <b>নতুন আইডি জমা (New Submission)</b> 🎉\n\n` +
                   `👤 <b>Username:</b> <code>${escapeHtml(submission.username)}</code>\n` +
                   `🔑 <b>Password:</b> <code>${escapeHtml(submission.password)}</code>\n` +
                   `🛡️ <b>2FA Secret:</b> <code>${escapeHtml(submission.twoFactorKey)}</code>\n` +
                   `💵 <b>Rate:</b> ${formattedRate} Taka\n` +
                   `👤 <b>Submitted By:</b> ${escapeHtml(submittedByStr)}\n` +
                   `📅 <b>Time:</b> ${localTimeStr}\n\n` +
                   `Check the Admin Panel to approve or reject!`;

      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: String(chatId).trim(),
          text: text,
          parse_mode: "HTML"
        })
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.description || `Telegram API error: ${response.status}`);
      }

      res.status(200).json({ status: "success", telegramResponse: data });
    } catch (error: any) {
      console.error("Error sending Telegram message:", error?.message || error);
      res.status(500).json({ status: "error", error: error?.message || "Failed to send notification" });
    }
  });

  // Proxy route to fetch latest chat updates from Telegram Bot to auto-detect Chat ID
  app.post("/api/telegram-updates", async (req, res) => {
    const { botToken } = req.body;
    if (!botToken) {
      return res.status(400).json({ error: "Telegram Bot Token is required" });
    }
    try {
      const url = `https://api.telegram.org/bot${botToken}/getUpdates`;
      const response = await fetch(url);
      const data = await response.json();
      res.status(200).json(data);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to fetch updates from Telegram" });
    }
  });

  // Broadcast route to send messages to all users in Telegram
  app.post("/api/telegram-broadcast", async (req, res) => {
    const { chatIds, message } = req.body;
    
    if (!chatIds || !Array.isArray(chatIds) || chatIds.length === 0) {
      return res.status(400).json({ error: "কোনো ব্যবহারকারী খুঁজে পাওয়া যায়নি!" });
    }
    if (!message) {
      return res.status(400).json({ error: "ব্রডকাস্ট মেসেজ খালি হতে পারবে না।" });
    }

    try {
      const settings = await getGlobalSettings();
      if (!settings || !settings.telegramBotToken) {
        return res.status(400).json({ error: "টেলিগ্রাম বট টোকেন সেটআপ করা নেই।" });
      }

      let successCount = 0;
      let failCount = 0;

      for (const chatId of chatIds) {
        if (!chatId) continue;
        try {
          const url = `https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`;
          const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: String(chatId).trim(),
              text: message,
              parse_mode: "HTML"
            })
          });
          const data = await response.json();
          if (response.ok && data.ok) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (err) {
          console.error(`Error broadcasting to ${chatId}:`, err);
          failCount++;
        }
      }

      res.status(200).json({ success: true, total: chatIds.length, successCount, failCount });
    } catch (error: any) {
      console.error("Error in broadcast api:", error);
      res.status(500).json({ error: error?.message || "Failed to send broadcast message" });
    }
  });

async function setupStaticAndListen() {
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

setupStaticAndListen();

export default app;
