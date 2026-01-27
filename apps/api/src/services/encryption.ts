import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";
// In production, this must be essentially pulled from process.env and 32 bytes
const SECRET_KEY =
  process.env.ENCRYPTION_KEY || "12345678901234567890123456789012"; // 32 chars
const IV_LENGTH = 16;

export const encryption = {
  encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
      ALGORITHM,
      Buffer.from(SECRET_KEY),
      iv,
    );
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString("hex") + ":" + encrypted.toString("hex");
  },

  decrypt(text: string): string {
    const textParts = text.split(":");
    const iv = Buffer.from(textParts.shift()!, "hex");
    const encryptedText = Buffer.from(textParts.join(":"), "hex");
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      Buffer.from(SECRET_KEY),
      iv,
    );
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  },
};
