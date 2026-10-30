/* Lecsum – giao diện trang tài liệu của nhóm. Không dùng thư viện ngoài. */
(function () {
  "use strict";
  const C = window.LecsumCrypto;
  const $ = (id) => document.getElementById(id);
  const STORE_KEY = "lecsum.key";
  const KIND = { deadline: "⏰ Hạn nộp", exam: "📝 Kiểm tra/Thi", schedule: "📅 Lịch học", attendance: "✅ Điểm danh", material: "📚 Tài liệu", other: "📌 Khác" };
  let key = null, manifest = null, current = null;

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtDate = (iso) => { if (!iso) return ""; const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };
  const today = () => new Date().toISOString().slice(0, 10);

  function storage(remember) { return remember ? window.localStorage : window.sessionStorage; }
  function savedKey() {
    try { return localStorage.getItem(STORE_KEY) || sessionStorage.getItem(STORE_KEY); } catch (e) { return null; }
  }
  function clearKey() {
    try { localStorage.removeItem(STORE_KEY); sessionStorage.removeItem(STORE_KEY); } catch (e) { /* bỏ qua */ }
  }

  async function fetchBytes(path) {
    const r = await fetch(path, { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status} – ${path}`);
    return r.arrayBuffer();
  }
  const openBlob = async (id) => C.openBlob(key, id, await fetchBytes(`data/${id}.bin`));

  // ------------------------------------------------------------------ đăng nhập
  async function tryResume() {
    const raw = savedKey();
    if (!raw) return false;
    try {
      key = await C.importSiteKey(C.unb64(raw));
      manifest = await openBlob("manifest");
      return true;
    } catch (e) {
      clearKey(); // khoá đã đổi (thành viên bị xoá / đặt lại mật khẩu) -> đăng nhập lại
      key = null;
      return false;
    }
  }

  async function onLogin(ev) {
    ev.preventDefault();
    const btn = $("login-btn"), err = $("login-error");
    btn.disabled = true; btn.textContent = "Đang mở khoá…"; err.hidden = true;
    try {
      const keys = await (await fetch("keys.json", { cache: "no-store" })).json();
      const raw = await C.unlock(keys, $("user").value, $("pass").value);
      key = await C.importSiteKey(raw);
      manifest = await openBlob("manifest");
      try { storage($("remember").checked).setItem(STORE_KEY, C.tob64(raw)); } catch (e) { /* trình duyệt chặn lưu trữ */ }
      $("pass").value = "";
      showApp();
    } catch (e) {
      err.textContent = e.message === "auth" ? "Sai tên hoặc mật khẩu." : `Không mở được tài liệu: ${e.message}`;
      err.hidden = false;
    } finally {
      btn.disabled = false; btn.textContent = "Đăng nhập";
    }
  }

  function logout() {
    clearKey(); key = null; manifest = null; current = null;
    location.hash = "";
    $("app").hidden = true; $("login").hidden = false; $("user").focus();
  }

  // ------------------------------------------------------------------ danh sách + tài liệu
  function renderList(filter = "") {
    const q = filter.trim().toLowerCase();
    const box = $("course-list");
    box.innerHTML = "";
    for (const c of manifest.courses) {
      const sessions = c.sessions.filter((s) => !q || `${c.code} ${c.name} ${s.title} buổi ${s.n}`.toLowerCase().includes(q));
      if (!sessions.length) continue;
      const g = document.createElement("section");
      g.className = "course";
      g.innerHTML = `<h3><span class="code">${esc(c.code)}</span> ${esc(c.name)}</h3>` +
        (c.semester ? `<p class="fineprint">${esc(c.semester)}</p>` : "");
      const ul = document.createElement("ul");
      for (const s of sessions) {
        const li = document.createElement("li");
        li.innerHTML = `<a href="#doc/${s.id}" data-id="${s.id}"><span class="sess">Buổi ${String(s.n).padStart(2, "0")}</span>` +
          `<span class="date">${fmtDate(s.date)}</span><span class="title">${esc(s.title || "")}</span></a>`;
        ul.appendChild(li);
      }
      g.appendChild(ul);
      box.appendChild(g);
    }
    if (!box.children.length) box.innerHTML = `<p class="muted">Không tìm thấy buổi học phù hợp.</p>`;
    markActive();
  }

  function markActive() {
    document.querySelectorAll("#course-list a").forEach((a) => a.classList.toggle("active", current && a.dataset.id === current.id));
  }

  async function showDoc(id) {
    const art = $("doc");
    art.innerHTML = `<div class="empty"><p>Đang giải mã…</p></div>`;
    try {
      current = await openBlob(id);
    } catch (e) {
      art.innerHTML = `<div class="empty error"><p>Không mở được tài liệu này (${esc(e.message)}).</p></div>`;
      return;
    }
    art.innerHTML = `<div class="doc-actions">
        <button class="link-btn only-mobile" id="back">← Danh sách</button>
        <span class="spacer"></span>
        <button class="btn" id="dl-md">⬇ Markdown</button>
        <button class="btn" id="print">🖨 In / PDF</button>
      </div><div class="prose">${current.html}</div>`;
    $("dl-md").onclick = () => download(`${current.course}_Buoi${String(current.session).padStart(2, "0")}.md`, current.md, "text/markdown");
    $("print").onclick = () => window.print();
    $("back").onclick = () => { document.body.classList.add("show-list"); };
    document.body.classList.remove("show-list");
    art.scrollTop = 0; window.scrollTo(0, 0);
    markActive();
  }

  // ------------------------------------------------------------------ deadline
  function renderDeadlines() {
    const t = today();
    const list = $("deadline-list");
    const upcoming = manifest.deadlines.filter((d) => d.date >= t);
    const past = manifest.deadlines.filter((d) => d.date < t).reverse();
    const item = (d) => `<li class="${d.date < t ? "past" : ""}">
        <div class="when"><b>${fmtDate(d.date)}</b><span>${esc(KIND[d.kind] || d.kind)}</span></div>
        <div class="what"><p>${esc(d.content)}</p>${d.quote ? `<p class="quote">“${esc(d.quote)}”</p>` : ""}
        <a href="#doc/${d.doc}">${esc(d.course)} · Buổi ${d.session}</a></div></li>`;
    list.innerHTML = (upcoming.length ? `<ul class="dl">${upcoming.map(item).join("")}</ul>` : `<p class="muted">Không có deadline sắp tới 🎉</p>`) +
      (past.length ? `<details><summary>Đã qua (${past.length})</summary><ul class="dl">${past.map(item).join("")}</ul></details>` : "");
    const badge = $("due-count");
    badge.textContent = upcoming.length; badge.hidden = !upcoming.length;
    $("ics-all").disabled = !upcoming.length;
  }

  function icsFor(items) {
    const pad = (n) => String(n).padStart(2, "0");
    const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
    const escI = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//lecsum//site//VI", "CALSCALE:GREGORIAN"];
    items.forEach((d, i) => {
      const day = d.date.replace(/-/g, "");
      const next = new Date(d.date + "T00:00:00Z"); next.setUTCDate(next.getUTCDate() + 1);
      const end = `${next.getUTCFullYear()}${pad(next.getUTCMonth() + 1)}${pad(next.getUTCDate())}`;
      lines.push("BEGIN:VEVENT", `UID:${day}-${i}-${d.doc}@lecsum`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${end}`,
        `SUMMARY:${escI(`[${d.course}] ${d.content}`)}`, `DESCRIPTION:${escI(d.quote || "")}`,
        "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escI(d.content)}`, "TRIGGER:-PT15H", "END:VALARM", "END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    return lines.join("\r\n") + "\r\n";
  }

  function download(name, text, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ------------------------------------------------------------------ điều hướng
  function setView(view) {
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
    $("view-docs").hidden = view !== "docs";
    $("view-deadlines").hidden = view !== "deadlines";
  }

  function route() {
    const m = location.hash.match(/^#doc\/([0-9a-f]+)$/);
    if (m) { setView("docs"); showDoc(m[1]); }
    else if (location.hash === "#deadlines") setView("deadlines");
  }

  function showApp() {
    $("login").hidden = true; $("app").hidden = false;
    $("site-title").textContent = manifest.title;
    document.title = manifest.title;
    $("built").textContent = `Cập nhật ${manifest.built.replace("T", " ")} · ${manifest.generator}`;
    renderList(); renderDeadlines();
    if (location.hash) route(); else document.body.classList.add("show-list");
  }

  document.addEventListener("DOMContentLoaded", async () => {
    $("login-form").addEventListener("submit", onLogin);
    $("logout").addEventListener("click", logout);
    $("search").addEventListener("input", (e) => renderList(e.target.value));
    $("menu-btn").addEventListener("click", () => document.body.classList.toggle("show-list"));
    $("ics-all").addEventListener("click", () => download("deadlines.ics", icsFor(manifest.deadlines.filter((d) => d.date >= today())), "text/calendar"));
    document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => {
      setView(b.dataset.view);
      if (b.dataset.view === "deadlines") history.replaceState(null, "", "#deadlines");
    }));
    window.addEventListener("hashchange", route);
    if (!window.isSecureContext || !window.crypto?.subtle) {
      $("login").hidden = false;
      $("login-error").textContent = "Trình duyệt cần HTTPS (hoặc localhost) để giải mã tài liệu.";
      $("login-error").hidden = false;
      return;
    }
    if (await tryResume()) showApp(); else { $("login").hidden = false; $("user").focus(); }
  });
})();
