/**
 * Validate file contents against known magic bytes to prevent MIME-type spoofing.
 * Returns true if the buffer matches the expected signature for the given mimeType.
 */
const SIGNATURES: Record<string, (buf: Buffer) => boolean> = {
  "application/pdf": (buf) =>
    buf.length >= 4 && buf.slice(0, 4).toString("ascii") === "%PDF",

  "image/jpeg": (buf) =>
    buf.length >= 3 &&
    buf[0] === 0xff &&
    buf[1] === 0xd8 &&
    buf[2] === 0xff,

  "image/jpg": (buf) =>
    buf.length >= 3 &&
    buf[0] === 0xff &&
    buf[1] === 0xd8 &&
    buf[2] === 0xff,

  "image/png": (buf) =>
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 && // P
    buf[2] === 0x4e && // N
    buf[3] === 0x47 && // G
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a,

  "image/webp": (buf) =>
    buf.length >= 12 &&
    buf.slice(0, 4).toString("ascii") === "RIFF" &&
    buf.slice(8, 12).toString("ascii") === "WEBP",

  // HEIC uses the ftyp box; check for "ftyp" at offset 4 and common HEIC brands
  "image/heic": (buf) => {
    if (buf.length < 12) return false;
    const ftyp = buf.slice(4, 8).toString("ascii");
    if (ftyp !== "ftyp") return false;
    const brand = buf.slice(8, 12).toString("ascii");
    return ["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand);
  },
};

export function validateFileSignature(buffer: Buffer, mimeType: string): boolean {
  const checker = SIGNATURES[mimeType];
  if (!checker) return false; // unknown type — reject
  return checker(buffer);
}
