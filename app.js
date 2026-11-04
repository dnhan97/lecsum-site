/* Lecsum – giao diện trang tài liệu của nhóm. Không dùng thư viện ngoài. */
(function () {
  "use strict";
  const C = window.LecsumCrypto;
  const $ = (id) => document.getElementById(id);
  const STORE_KEY = "lecsum.key";
  const KIND = { deadline: "⏰ Hạn nộp", exam: "📝 Kiểm tra/Thi", schedule: "📅 Lịch học", attendance: "✅ Điểm danh", material: "📚 Tài liệu", other: "📌 Khác" };
  let key = null, manifest = null, current = null, currentTab = "summary", searchIndex = null, coursePack = null;
  const USER_KEY = "lecsum.user";

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
      try { localStorage.setItem(USER_KEY, $("user").value.trim()); } catch (e) { /* bỏ qua */ }
      showApp();
    } catch (e) {
      err.textContent = e.message === "auth" ? "Sai tên hoặc mật khẩu." : `Không mở được tài liệu: ${e.message}`;
      err.hidden = false;
    } finally {
      btn.disabled = false; btn.textContent = "Đăng nhập";
    }
  }

  function logout() {
    clearKey(); key = null; manifest = null; current = null; searchIndex = null; coursePack = null;
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
        (c.semester ? `<p class="fineprint">${esc(c.semester)}</p>` : "") +
        (c.pack ? `<a class="course-link" href="#course/${c.pack.id}" data-pack="${c.pack.id}">📘 Đề cương · đề thi thử` +
          (c.pack.quiz ? ` <small>${c.pack.quiz} câu</small>` : "") + `</a>` : "");
      const ul = document.createElement("ul");
      for (const s of sessions) {
        const li = document.createElement("li");
        li.innerHTML = `<a href="#doc/${s.id}" data-id="${s.id}"><span class="sess">Buổi ${String(s.n).padStart(2, "0")}</span>` +
          `<span class="date">${fmtDate(s.date)}${s.study ? ' <span class="star" title="Có bài học chuyên sâu, sơ đồ tư duy, trắc nghiệm">★</span>' : ""}</span>` +
          `<span class="title">${esc(s.title || "")}</span></a>`;
        ul.appendChild(li);
      }
      g.appendChild(ul);
      box.appendChild(g);
    }
    if (!box.children.length && !q) box.innerHTML = `<p class="muted">Chưa có tài liệu.</p>`;
    markActive();
    fullText(q);
  }

  // ------------------------------------------------------------------ tìm trong toàn bộ nội dung
  let searchSeq = 0;
  async function fullText(q) {
    const out = $("search-results"), seq = ++searchSeq;
    if (q.length < 2 || !manifest.search) { out.innerHTML = ""; return; }
    if (!searchIndex) {
      out.innerHTML = `<p class="fineprint">Đang tải chỉ mục tìm kiếm…</p>`;
      try { searchIndex = await openBlob(manifest.search); } catch (e) { out.innerHTML = ""; return; }
    }
    if (seq !== searchSeq) return;
    const fold = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
    const fq = fold(q), hits = [];
    for (const d of searchIndex) {
      const ft = fold(d.x), at = ft.indexOf(fq);
      if (at < 0) continue;
      let count = 0;
      for (let i = at; i >= 0 && count < 99; i = ft.indexOf(fq, i + fq.length)) count += 1;
      const a = Math.max(0, at - 60), b = Math.min(d.x.length, at + fq.length + 90);
      hits.push({ d, count, snip: (a ? "…" : "") + esc(d.x.slice(a, at)) + `<mark>${esc(d.x.slice(at, at + fq.length))}</mark>` + esc(d.x.slice(at + fq.length, b)) + "…" });
    }
    hits.sort((x, y) => y.count - x.count);
    out.innerHTML = hits.length ? `<h4>Trong nội dung (${hits.length} buổi)</h4><ul class="hits">${hits.slice(0, 30).map((h) =>
      `<li><a href="#doc/${h.d.id}"><b>${esc(h.d.c)} · Buổi ${String(h.d.n).padStart(2, "0")}</b> <small>${h.count} chỗ</small><span>${h.snip}</span></a></li>`).join("")}</ul>`
      : `<p class="fineprint">Không thấy “${esc(q)}” trong nội dung.</p>`;
  }

  function markActive() {
    document.querySelectorAll("#course-list a").forEach((a) => a.classList.toggle("active",
      (current && a.dataset.id === current.id) || (coursePack && a.dataset.pack === coursePack.id)));
  }

  async function showDoc(id, tab) {
    const art = $("doc");
    if (!current || current.id !== id) {
      art.innerHTML = `<div class="empty"><p>Đang giải mã…</p></div>`;
      try {
        current = await openBlob(id);
      } catch (e) {
        current = null;
        art.innerHTML = `<div class="empty error"><p>Không mở được tài liệu này (${esc(e.message)}).</p></div>`;
        return;
      }
    }
    art.innerHTML = `<div class="doc-actions">
        <button class="link-btn only-mobile" id="back">← Danh sách</button>
        <span class="spacer"></span>
        ${manifest.report ? `<button class="btn" id="report" title="Báo cho nhóm chỗ sai / thiếu trong tài liệu">⚑ Báo lỗi</button>` : ""}
        <button class="btn" id="dl-md">⬇ Markdown</button>
        <button class="btn" id="print">🖨 In / PDF</button>
      </div><div id="report-box"></div><div id="media-slot"></div><div id="doc-body"></div>`;
    coursePack = null;
    mountMedia($("media-slot"), current);
    const body = $("doc-body");
    if (current.study && window.LecsumStudy) currentTab = window.LecsumStudy.render(body, current, tab || "summary");
    else { currentTab = "summary"; body.innerHTML = `<div class="prose">${current.html}</div>`; }
    linkTimestamps(body);
    const base = `${current.course}_Buoi${String(current.session).padStart(2, "0")}`;
    $("dl-md").onclick = () => currentTab === "summary" || !current.study
      ? download(`${base}.md`, current.md, "text/markdown")
      : download(`${base}_chuyen-sau.md`, current.study.md, "text/markdown");
    $("print").onclick = () => window.print();
    $("back").onclick = () => { document.body.classList.add("show-list"); };
    if ($("report")) $("report").onclick = () => reportForm(`${current.course} · Buổi ${current.session}${currentTab !== "summary" ? ` · ${currentTab}` : ""}`);
    document.body.classList.remove("show-list");
    art.scrollTop = 0; window.scrollTo(0, 0);
    markActive();
  }

  // ------------------------------------------------------------------ nghe / xem bài giảng từ Google Drive
  const TS_RE = /^\[?(?:▶\s*)?(\d{1,2}):(\d{2})(?::(\d{2}))?\]?$/;
  const MARK = { exam: "⭐", remind: "⏰", exercise: "📝", theory: "📘", qa: "❓", lesson: "§", mine: "📍" };
  let media = null;   // {doc, panel, el, kind}

  const fmtT = (sec) => { sec = Math.max(0, Math.floor(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
    return (h ? `${h}:${String(m).padStart(2, "0")}` : String(m).padStart(2, "0")) + `:${String(s).padStart(2, "0")}`; };
  const driveUrl = (id) => `https://www.googleapis.com/drive/v3/files/${id}?alt=media&key=${encodeURIComponent(manifest.media_key)}`;
  const myMarksKey = (id) => `lecsum.marks.${id}`;
  function myMarks(id) { try { return JSON.parse(localStorage.getItem(myMarksKey(id)) || "[]"); } catch (e) { return []; } }
  function saveMyMarks(id, list) { try { localStorage.setItem(myMarksKey(id), JSON.stringify(list)); } catch (e) { /* bỏ qua */ } }

  function linkTimestamps(root) {
    const deco = () => root.querySelectorAll("code:not(.ts-link)").forEach((c) => {
      const m = c.textContent.trim().match(TS_RE);
      if (!m) return;
      c.classList.add("ts-link");
      c.dataset.t = (+(m[3] !== undefined ? m[1] : 0)) * 3600 + (+(m[3] !== undefined ? m[2] : m[1])) * 60 + (+(m[3] !== undefined ? m[3] : m[2]));
      c.title = current?.media && Object.keys(current.media).length ? "Bấm để nghe / xem đoạn này" : "Buổi này chưa có audio / video trên Drive";
    });
    deco();
    new MutationObserver(deco).observe(root, { childList: true, subtree: true });
  }

  function mountMedia(slot, doc) {
    const ids = doc.media || {};
    if (!manifest.media_key || (!ids.audio && !ids.video)) { media = null; return; }
    if (media && media.doc === doc.id) { slot.replaceWith(media.panel); media.panel.id = "media-slot"; return; }
    const panel = document.createElement("section");
    panel.className = "media";
    panel.id = "media-slot";
    media = { doc: doc.id, panel, el: null, kind: ids.video ? "video" : "audio" };
    panel.innerHTML = `<div class="media-head">
        ${ids.video && ids.audio ? `<div class="seg"><button class="seg-btn" data-m="video">🎬 Video</button><button class="seg-btn" data-m="audio">🎧 Audio</button></div>`
          : `<b>${ids.video ? "🎬 Video bài giảng" : "🎧 Audio bài giảng"}</b>`}
        <span class="spacer"></span>
        <button class="btn" data-m="marks">📍 Mốc <small class="mk-count"></small></button>
        <button class="btn" data-m="add" title="Lưu mốc tại thời điểm đang phát (chỉ trên thiết bị này)">＋ Đánh dấu</button>
        <button class="btn" data-m="fold" title="Thu gọn / mở trình phát">▾</button></div>
      <div class="media-body"><div class="media-player"></div>
        <p class="fineprint media-err" hidden></p>
        <div class="marks" hidden></div></div>`;
    slot.replaceWith(panel);
    const setKind = (kind) => {
      const t = media.el ? media.el.currentTime : 0, playing = media.el && !media.el.paused;
      media.kind = kind;
      const el = document.createElement(kind);
      el.controls = true; el.preload = "metadata"; el.setAttribute("playsinline", "");
      el.src = driveUrl(ids[kind]);
      el.addEventListener("error", () => {
        const err = panel.querySelector(".media-err");
        err.hidden = false;
        err.innerHTML = `Không phát được trực tiếp (Drive giới hạn lượt tải hoặc API key chưa cho phép tên miền này). ` +
          `<a href="https://drive.google.com/file/d/${ids[kind]}/view" target="_blank" rel="noopener">Mở trên Google Drive</a>`;
      });
      if (t) el.addEventListener("loadedmetadata", () => { el.currentTime = t; if (playing) el.play(); }, { once: true });
      panel.querySelector(".media-player").replaceChildren(el);
      media.el = el;
      panel.querySelectorAll(".seg-btn").forEach((b) => b.classList.toggle("active", b.dataset.m === kind));
    };
    const renderMarks = () => {
      const mine = myMarks(doc.id).map((m) => ({ ...m, k: "mine" }));
      const all = [...(doc.marks || []), ...mine].sort((a, b) => a.t - b.t);
      panel.querySelector(".mk-count").textContent = all.length || "";
      panel.querySelector(".marks").innerHTML = all.length ? `<ul>${all.map((m) => `<li class="mk-${m.k}">
          <button class="ts-link mk-time" data-t="${m.t}">${fmtT(m.t)}</button><span class="mk-icon">${MARK[m.k] || "•"}</span>
          <span class="mk-label">${esc(m.l)}</span>${m.k === "mine" ? `<button class="link-btn mk-del" data-del="${m.t}" title="Xoá mốc">✕</button>` : ""}</li>`).join("")}</ul>`
        : `<p class="fineprint">Chưa có mốc nào – bấm “＋ Đánh dấu” khi đang nghe để lưu đoạn quan trọng.</p>`;
    };
    panel.addEventListener("click", (e) => {
      const a = e.target.closest("[data-m]")?.dataset.m;
      if (a === "video" || a === "audio") setKind(a);
      if (a === "marks") { const m = panel.querySelector(".marks"); m.hidden = !m.hidden; }
      if (a === "fold") { panel.classList.toggle("folded"); e.target.textContent = panel.classList.contains("folded") ? "▸" : "▾"; }
      if (a === "add") {
        const t = Math.floor(media.el?.currentTime || 0);
        const box = panel.querySelector(".marks");
        box.hidden = false;
        box.insertAdjacentHTML("afterbegin", `<form class="mk-form"><b>${fmtT(t)}</b><input placeholder="Ghi chú cho đoạn này…" maxlength="140" required>
          <button class="btn primary">Lưu</button></form>`);
        const f = box.querySelector(".mk-form");
        f.querySelector("input").focus();
        f.onsubmit = (ev) => { ev.preventDefault(); saveMyMarks(doc.id, [...myMarks(doc.id), { t, l: f.querySelector("input").value.trim() }]); renderMarks(); };
      }
      const del = e.target.closest("[data-del]");
      if (del) { saveMyMarks(doc.id, myMarks(doc.id).filter((m) => m.t !== +del.dataset.del)); renderMarks(); }
    });
    setKind(media.kind);
    renderMarks();
  }

  function seek(sec) {
    if (!media || !media.el) {
      if (current) alertMedia();
      return;
    }
    media.panel.classList.remove("folded");
    media.el.currentTime = Math.max(0, sec - 2);   // lùi 2 giây để nghe trọn câu
    media.el.play().catch(() => { /* trình duyệt chặn tự phát – người dùng bấm ▶ */ });
    if (media.kind === "video") media.panel.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function alertMedia() {
    const box = $("report-box");
    if (!box) return;
    box.innerHTML = `<p class="fineprint">Buổi này chưa có audio / video trên Google Drive.</p>`;
    setTimeout(() => { if (box.textContent.includes("Google Drive")) box.innerHTML = ""; }, 3500);
  }

  async function showCourse(id, tab) {
    const art = $("doc");
    if (!coursePack || coursePack.id !== id) {
      art.innerHTML = `<div class="empty"><p>Đang giải mã…</p></div>`;
      try { coursePack = await openBlob(id); } catch (e) {
        coursePack = null;
        art.innerHTML = `<div class="empty error"><p>Không mở được học phần này (${esc(e.message)}).</p></div>`;
        return;
      }
    }
    current = null;
    art.innerHTML = `<div class="doc-actions"><button class="link-btn only-mobile" id="back">← Danh sách</button><span class="spacer"></span>
      <button class="btn" id="print">🖨 In / PDF</button></div><div id="doc-body"></div>`;
    window.LecsumStudy.renderCourse($("doc-body"), coursePack, tab);
    $("print").onclick = () => window.print();
    $("back").onclick = () => { document.body.classList.add("show-list"); };
    document.body.classList.remove("show-list");
    art.scrollTop = 0; window.scrollTo(0, 0);
    markActive();
  }

  // ------------------------------------------------------------------ báo lỗi nội dung (ntfy / Discord của nhóm)
  function reportForm(where) {
    const box = $("report-box");
    if (box.innerHTML) { box.innerHTML = ""; return; }
    box.innerHTML = `<form class="report card-box"><b>⚑ Báo lỗi: ${esc(where)}</b>
      <textarea id="report-text" rows="3" placeholder="Sai ở đâu? Nên sửa thế nào? (có thể ghi mốc thời gian, vd 45:10)" required></textarea>
      <div class="report-row"><span class="fineprint">Gửi tới kênh thông báo của nhóm, kèm tên đăng nhập của bạn.</span><span class="spacer"></span>
      <button type="button" class="btn" id="report-cancel">Huỷ</button><button class="btn primary">Gửi</button></div><p id="report-msg" class="fineprint"></p></form>`;
    $("report-cancel").onclick = () => { box.innerHTML = ""; };
    $("report-text").focus();
    box.querySelector("form").onsubmit = async (ev) => {
      ev.preventDefault();
      const text = $("report-text").value.trim();
      if (!text) return;
      let who = "";
      try { who = localStorage.getItem(USER_KEY) || ""; } catch (e) { /* bỏ qua */ }
      const msg = `${where}${who ? ` – ${who}` : ""}:\n${text}`;
      const r = manifest.report || {};
      const sent = [];
      try {
        if (r.ntfy) {
          await fetch(`${r.ntfy}?title=${encodeURIComponent("⚑ Báo lỗi tài liệu")}&tags=warning`, { method: "POST", body: msg });
          sent.push("ntfy");
        }
        if (r.discord) {
          const fd = new FormData();
          fd.append("payload_json", JSON.stringify({ content: `⚑ **Báo lỗi tài liệu** · ${msg}`.slice(0, 1900) }));
          await fetch(r.discord, { method: "POST", mode: "no-cors", body: fd });
          sent.push("Discord");
        }
        box.innerHTML = `<p class="report-ok">✓ Đã gửi qua ${sent.join(", ")} – cảm ơn bạn!</p>`;
        setTimeout(() => { box.innerHTML = ""; }, 4000);
      } catch (e) {
        $("report-msg").textContent = `Không gửi được (${e.message}) – kiểm tra mạng rồi thử lại.`;
      }
    };
  }

  // ------------------------------------------------------------------ dùng offline
  function registerOffline() {
    if (!("serviceWorker" in navigator)) { $("offline").hidden = true; return; }
    navigator.serviceWorker.register("sw.js").catch(() => { $("offline").hidden = true; });
    navigator.serviceWorker.addEventListener("message", (e) => {
      if (e.data?.type === "prefetched") $("offline").textContent = `✓ Đã lưu ${e.data.count} tệp để đọc offline`;
    });
  }

  async function saveOffline() {
    const reg = await navigator.serviceWorker?.ready;
    if (!reg?.active) return;
    const ids = ["manifest", manifest.search];
    manifest.courses.forEach((c) => { c.sessions.forEach((s) => ids.push(s.id)); if (c.pack) ids.push(c.pack.id); });
    const urls = ["keys.json", ...ids.filter(Boolean).map((id) => `data/${id}.bin`)];
    $("offline").textContent = `Đang lưu ${urls.length} tệp…`;
    reg.active.postMessage({ type: "prefetch", urls: urls.map((u) => new URL(u, location.href).href) });
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

  window.LecsumDownload = (...a) => download(...a);
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
    const m = location.hash.match(/^#doc\/([0-9a-f]+)(?:\/(\w+))?$/);
    const cm = location.hash.match(/^#course\/([0-9a-f]+)(?:\/(\w+))?$/);
    if (m) { setView("docs"); showDoc(m[1], m[2]); }
    else if (cm) { setView("docs"); showCourse(cm[1], cm[2]); }
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
    $("offline").addEventListener("click", saveOffline);
    $("doc").addEventListener("click", (e) => {
      const ts = e.target.closest(".ts-link");
      if (ts && ts.dataset.t !== undefined) { e.preventDefault(); seek(+ts.dataset.t); }
    });
    registerOffline();
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
