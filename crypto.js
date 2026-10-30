/* Lecsum – giải mã tài liệu ngay trong trình duyệt (Web Crypto). Định dạng khớp lecsum/publish/crypto.py.
   Dùng được cả trong trình duyệt và Node ≥ 19 (để kiểm thử). */
(function (g) {
  "use strict";
  const te = new TextEncoder();
  const td = new TextDecoder();
  const subtle = g.crypto.subtle;

  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const tob64 = (buf) => {
    const b = new Uint8Array(buf);
    let s = "";
    for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s);
  };

  async function userId(name) {
    const h = await subtle.digest("SHA-256", te.encode(name.trim().toLowerCase()));
    return Array.from(new Uint8Array(h), (x) => x.toString(16).padStart(2, "0")).join("");
  }

  /** Mở khoá trang bằng tên + mật khẩu. Sai -> Error("auth"). Trả về 32 byte khoá trang. */
  async function unlock(keys, name, password) {
    const u = await userId(name);
    const rec = (keys.users || []).find((r) => r.u === u);
    if (!rec) throw new Error("auth");
    const base = await subtle.importKey("raw", te.encode(password), "PBKDF2", false, ["deriveKey"]);
    const kek = await subtle.deriveKey(
      { name: "PBKDF2", salt: unb64(rec.salt), iterations: rec.iter, hash: "SHA-256" },
      base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    try {
      const raw = await subtle.decrypt({ name: "AES-GCM", iv: unb64(rec.iv), additionalData: te.encode(u) }, kek, unb64(rec.wk));
      return new Uint8Array(raw);
    } catch (e) {
      throw new Error("auth");
    }
  }

  const importSiteKey = (raw) => subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["decrypt"]);

  /** bytes = iv(12) || ciphertext; id dùng làm dữ liệu xác thực (AAD). */
  async function openBlob(key, id, bytes) {
    const b = new Uint8Array(bytes);
    const pt = await subtle.decrypt({ name: "AES-GCM", iv: b.slice(0, 12), additionalData: te.encode(id) }, key, b.slice(12));
    return JSON.parse(td.decode(pt));
  }

  g.LecsumCrypto = { userId, unlock, importSiteKey, openBlob, tob64, unb64 };
})(globalThis);
