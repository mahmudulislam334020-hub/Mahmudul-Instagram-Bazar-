import * as OTPAuth from 'otpauth';

export function generateCredentials(prefix?: string, dailyPassword?: string) {
  let username = "";
  if (prefix) {
    username = `${prefix.trim()}${Math.floor(1000 + Math.random() * 9000)}`;
  } else {
    username = `instajob_${Math.random().toString(36).substring(2, 8)}`;
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
