import * as OTPAuth from 'otpauth';

export function generateCredentials(prefix?: string, dailyPassword?: string) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let username = "";
  for (let i = 0; i < 10; i++) {
    username += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  let password = "";
  if (dailyPassword) {
    password = dailyPassword;
  } else {
    password = Math.random().toString(36).substring(2, 10) + "@" + Math.floor(Math.random() * 90 + 10);
  }
  return { username, password };
}

export function getTotpCode(secretKey: string): string {
  if (!secretKey) return "------";
  try {
    // Clean spaces, convert to upper case
    const cleanedSecret = secretKey.replace(/\s+/g, "").toUpperCase();
    const totp = new OTPAuth.TOTP({
      issuer: "Instagram",
      label: "User",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: cleanedSecret
    });
    return totp.generate();
  } catch (error) {
    return "INVALID";
  }
}

export function getTotpRemainingSeconds(): number {
  const epoch = Math.round(new Date().getTime() / 1000);
  return 30 - (epoch % 30);
}
