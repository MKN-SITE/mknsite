import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export interface SaveSignatureResult {
  filePath: string;
  sha256: string;
}

export class SignatureStorageError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "SignatureStorageError";
  }
}

/**
 * Menyimpan data tanda tangan base64 (DataURL) ke penyimpanan privat lokal:
 * uploads/signatures/{formId}/{uuid}.png
 */
export async function saveSignature(
  formId: number,
  userId: number,
  imageDataUrl: string
): Promise<SaveSignatureResult> {
  if (!imageDataUrl || typeof imageDataUrl !== "string") {
    throw new SignatureStorageError(400, "Data tanda tangan tidak valid.");
  }

  // Ekstrak base64 dari data URL (format umum: data:image/png;base64,...)
  const matches = imageDataUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
  const base64Data = matches ? matches[2] : imageDataUrl;

  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64Data, "base64");
  } catch {
    throw new SignatureStorageError(400, "Gagal memproses data gambar tanda tangan.");
  }

  if (buffer.length < 100) {
    throw new SignatureStorageError(400, "Tanda tangan tidak boleh kosong atau terlalu kecil.");
  }

  // Hitung SHA256 dari binary file
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

  const dirPath = path.resolve("uploads", "signatures", String(formId));
  await fs.mkdir(dirPath, { recursive: true });

  const fileName = `${userId}_${crypto.randomUUID()}.png`;
  const fullPath = path.join(dirPath, fileName);
  await fs.writeFile(fullPath, buffer);

  // Simpan relative path konsisten: uploads/signatures/{formId}/{fileName}
  const relativePath = `uploads/signatures/${formId}/${fileName}`;

  return {
    filePath: relativePath,
    sha256
  };
}

/**
 * Membaca buffer tanda tangan untuk embed ke dokumen PDF
 */
export async function getSignatureBuffer(filePath: string): Promise<Buffer> {
  if (!filePath || filePath.includes("..")) {
    throw new SignatureStorageError(400, "Path file tanda tangan tidak valid.");
  }

  const normalized = path.normalize(filePath);
  if (!normalized.startsWith("uploads/signatures") && !normalized.startsWith("uploads\\signatures")) {
    throw new SignatureStorageError(403, "Akses ke file di luar direktori tanda tangan ditolak.");
  }

  const resolved = path.resolve(normalized);
  try {
    return await fs.readFile(resolved);
  } catch {
    throw new SignatureStorageError(404, "File tanda tangan tidak ditemukan.");
  }
}
