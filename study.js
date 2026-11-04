/* Lecsum – bài học chuyên sâu: bài học chi tiết, sơ đồ tư duy (SVG), trắc nghiệm, thẻ ghi nhớ, tự luận.
   Không dùng thư viện ngoài; mọi chữ do AI sinh đều được escape (HTML bài học đã được làm sạch phía máy dựng trang). */
(function () {
  "use strict";
  const SVGNS = "http://www.w3.org/2000/svg";
  const LEVEL = { easy: "Dễ", medium: "Trung bình", hard: "Khó" };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* trình duyệt chặn lưu trữ */ } },
  };
  const list = (items, cls = "") => items && items.length ? `<ul class="${cls}">${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "";

  // ------------------------------------------------------------------ bài học
  function lessonView(s) {
    const toc = s.lesson.map((x, i) => `<li><a href="#" data-jump="sec-${i}">${esc(x.heading)}</a></li>`).join("");
    const sec = s.lesson.map((x, i) => `
      <section class="lesson-sec" id="sec-${i}">
        <h2><span class="num">${i + 1}</span>${esc(x.heading)}${x.ts ? ` <code class="ts">${esc(x.ts)}</code>` : ""}</h2>
        <div class="prose">${x.html}</div>
        ${x.key.length ? `<div class="callout key"><b>Cần nhớ</b>${list(x.key)}</div>` : ""}
        ${x.examples.length ? `<div class="callout ex"><b>Ví dụ</b>${list(x.examples)}</div>` : ""}
        ${x.pitfalls.length ? `<div class="callout warn"><b>Dễ nhầm</b>${list(x.pitfalls)}</div>` : ""}
      </section>`).join("");
    return `<div class="lesson">
      <h1 class="lesson-title">${esc(s.title)}</h1>
      <div class="lesson-meta">${s.objectives.length ? `<div class="card-box"><h3>🎯 Mục tiêu</h3>${list(s.objectives)}</div>` : ""}
        ${s.prerequisites.length ? `<div class="card-box"><h3>📚 Cần biết trước</h3>${list(s.prerequisites)}</div>` : ""}
        ${toc ? `<div class="card-box"><h3>🧭 Nội dung</h3><ol class="toc">${toc}</ol></div>` : ""}</div>
      ${s.analysis ? `<section class="lesson-sec"><h2>Phân tích chuyên sâu</h2><div class="prose">${s.analysis}</div>
        ${s.links.length ? `<div class="callout link"><b>Liên hệ giữa các khái niệm</b>${list(s.links)}</div>` : ""}</section>` : ""}
      ${sec}
      ${s.extensions.length ? `<section class="lesson-sec ext"><h2>Mở rộng <small>(ngoài bài giảng)</small></h2>${s.extensions.map((e) =>
        `<h3>${esc(e.topic)}</h3><div class="prose">${e.html}</div>`).join("")}</section>` : ""}
      <p class="fineprint">Biên soạn tự động bằng ${esc(s.model || "AI")} từ bản chép lời – đối chiếu bài giảng khi ôn thi.</p>
    </div>`;
  }

  // ------------------------------------------------------------------ sơ đồ tư duy
  const ctx = document.createElement("canvas").getContext("2d");
  function wrap(text, maxPx, bold) {
    const font = getComputedStyle(document.body).fontFamily || "sans-serif";
    ctx.font = `${bold ? "700 " : ""}13.5px ${font}`;   // đo dư một chút cho an toàn
    const words = String(text).split(/\s+/).filter(Boolean), lines = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? cur + " " + w : w;
      if (cur && ctx.measureText(next).width > maxPx) { lines.push(cur); cur = w; } else cur = next;
    }
    if (cur) lines.push(cur);
    if (lines.length > 4) { lines.length = 4; lines[3] += "…"; }
    return lines;
  }

  function mindmapView(root, box) {
    if (!root) { box.innerHTML = `<p class="muted">Chưa có sơ đồ.</p>`; return; }
    let id = 0;
    (function tag(n, depth) {
      n._id = id++; n._d = depth; n._open = depth < 2;   // mở sẵn 2 tầng đầu
      n.children.forEach((c) => tag(c, depth + 1));
    })(root, 0);
    root.children.forEach((c, i) => { (function mark(n) { n._c = i % 8; n.children.forEach(mark); })(c); });
    let scale = 1;
    box.innerHTML = `<div class="mm-tools">
        <button class="btn" data-mm="open">Mở hết</button><button class="btn" data-mm="close">Thu gọn</button>
        <span class="spacer"></span><button class="btn" data-mm="-">−</button><button class="btn" data-mm="+">+</button>
        <button class="btn" data-mm="svg">⬇ SVG</button></div>
      <p class="fineprint">Bấm vào một nhánh để mở / thu gọn · kéo để di chuyển.</p><div class="mm-wrap"></div>`;
    const wrapEl = box.querySelector(".mm-wrap");

    function draw() {
      const COLW = [200, 220, 210, 200, 190], LINE = 17, PADY = 10, GAP = 12;
      const boxW = (n) => (COLW[n._d] || 190) - 30;
      let y = PADY;
      const nodes = [];
      (function layout(n, x) {
        n._lines = wrap(n.label, boxW(n) - (n.children.length ? 42 : 20), n._d <= 1);
        n._h = n._lines.length * LINE + 14;
        n._x = x;
        const kids = n._open ? n.children : [];
        if (!kids.length) { n._y = y + n._h / 2; y += n._h + GAP; }
        else {
          kids.forEach((c) => layout(c, x + (COLW[n._d] || 180)));
          n._y = (kids[0]._y + kids[kids.length - 1]._y) / 2;
        }
        nodes.push(n);
      })(root, 10);
      const W = Math.max(...nodes.map((n) => n._x + (COLW[n._d] || 180))) + 10, H = y + PADY;
      const svg = document.createElementNS(SVGNS, "svg");
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      svg.setAttribute("width", W * scale); svg.setAttribute("height", H * scale);
      svg.setAttribute("class", "mindmap");
      const mk = (tag, attrs, parent = svg) => {
        const el = document.createElementNS(SVGNS, tag);
        for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
        parent.appendChild(el); return el;
      };
      for (const n of nodes) {
        if (!n._open) continue;
        for (const c of n.children) {
          const x1 = n._x + boxW(n), x2 = c._x, mx = (x1 + x2) / 2;
          mk("path", { d: `M${x1},${n._y} C${mx},${n._y} ${mx},${c._y} ${x2},${c._y}`, class: `mm-edge c${c._c ?? 0}` });
        }
      }
      for (const n of nodes) {
        const g = mk("g", { class: `mm-node d${Math.min(n._d, 3)} c${n._c ?? 0}${n.children.length ? " has-kids" : ""}`, tabindex: n.children.length ? 0 : -1 });
        mk("rect", { x: n._x, y: n._y - n._h / 2, width: boxW(n), height: n._h, rx: 9 }, g);
        n._lines.forEach((l, i) => {
          const t = mk("text", { x: n._x + 10, y: n._y - (n._lines.length - 1) * LINE / 2 + i * LINE + 5 }, g);
          t.textContent = l;
        });
        if (n.children.length) {
          const t = mk("text", { x: n._x + boxW(n) - 14, y: n._y + 5, class: "mm-toggle" }, g);
          t.textContent = n._open ? "−" : `+${n.children.length}`;
          if (!n._open) t.setAttribute("x", n._x + boxW(n) - 22);
          const toggle = () => { n._open = !n._open; draw(); };
          g.addEventListener("click", toggle);
          g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
        }
        if (n.note) { const tt = mk("title", {}, g); tt.textContent = n.note; }
      }
      wrapEl.replaceChildren(svg);
    }
    const setAll = (open) => (function f(n) { if (n._d > 0) n._open = open; n.children.forEach(f); })(root);
    box.querySelector(".mm-tools").addEventListener("click", (e) => {
      const a = e.target.dataset.mm;
      if (!a) return;
      if (a === "open") setAll(true);
      if (a === "close") { setAll(false); root.children.forEach((c) => { c._open = false; }); }
      if (a === "+") scale = Math.min(2, scale + 0.15);
      if (a === "-") scale = Math.max(0.4, scale - 0.15);
      if (a === "svg") {
        const svg = wrapEl.querySelector("svg").cloneNode(true);
        svg.insertBefore(Object.assign(document.createElementNS(SVGNS, "style"), { textContent: MM_CSS }), svg.firstChild);
        window.LecsumDownload("so-do-tu-duy.svg", new XMLSerializer().serializeToString(svg), "image/svg+xml");
        return;
      }
      draw();
    });
    // kéo để di chuyển
    let drag = null;
    wrapEl.addEventListener("pointerdown", (e) => { if (e.target.closest(".has-kids")) return; drag = { x: e.clientX, y: e.clientY, l: wrapEl.scrollLeft, t: wrapEl.scrollTop }; wrapEl.classList.add("dragging"); });
    window.addEventListener("pointermove", (e) => { if (drag) { wrapEl.scrollLeft = drag.l - (e.clientX - drag.x); wrapEl.scrollTop = drag.t - (e.clientY - drag.y); } });
    window.addEventListener("pointerup", () => { drag = null; wrapEl.classList.remove("dragging"); });
    draw();
  }
  const MM_CSS = "text{font:13px sans-serif;fill:#1b1f2a}rect{fill:#eef0fb;stroke:#7b8cff}path{fill:none;stroke:#9aa3c7;stroke-width:1.6}";

  // ------------------------------------------------------------------ trắc nghiệm
  function quizView(doc, box) {
    const qs = doc.study.quiz, KEY = `lecsum.quiz.${doc.id}`;
    let st = store.get(KEY) || { ans: {}, exam: false, submitted: false, order: null, level: "" };
    const save = () => store.set(KEY, st);
    function order() {
      if (!st.order || st.order.length !== qs.length) st.order = qs.map((_, i) => i);
      return st.order.filter((i) => !st.level || qs[i].d === st.level);
    }
    function render() {
      const ids = order();
      const answered = ids.filter((i) => i in st.ans), right = answered.filter((i) => st.ans[i] === qs[i].a).length;
      const reveal = (i) => i in st.ans && (!st.exam || st.submitted);
      box.innerHTML = `<div class="quiz-bar">
          <div class="score"><b>${answered.length}</b>/${ids.length} câu đã làm${!st.exam || st.submitted ? ` · <b class="ok">${right}</b> đúng` : ""}</div>
          <select data-q="level" aria-label="Độ khó"><option value="">Mọi mức</option>${Object.entries(LEVEL).map(([k, v]) =>
            `<option value="${k}"${st.level === k ? " selected" : ""}>${v}</option>`).join("")}</select>
          <label class="check"><input type="checkbox" data-q="exam"${st.exam ? " checked" : ""}> Chấm khi nộp bài</label>
          <span class="spacer"></span>
          <button class="btn" data-q="shuffle">🔀 Xáo câu</button><button class="btn" data-q="reset">↺ Làm lại</button>
        <button class="btn" data-q="anki" title="Tệp nhập vào Anki (File → Import)">⬇ Anki</button>
        </div>
        <div class="progress"><span style-w="${ids.length ? (answered.length * 100 / ids.length).toFixed(1) : 0}"></span></div>
        <ol class="quiz">${ids.map((i, k) => {
          const q = qs[i], picked = st.ans[i];
          return `<li class="q${reveal(i) ? (picked === q.a ? " right" : " wrong") : ""}" data-i="${i}">
            <div class="q-head"><span class="q-num">Câu ${k + 1}</span><span class="tag ${q.d}">${LEVEL[q.d] || q.d}</span>${q.t ? `<span class="tag">${esc(q.t)}</span>` : ""}</div>
            <p class="q-text">${esc(q.q)}</p>
            <div class="opts">${q.o.map((o, j) => `<button class="opt${picked === j ? " picked" : ""}${reveal(i) && j === q.a ? " correct" : ""}${reveal(i) && picked === j && j !== q.a ? " incorrect" : ""}"
              data-j="${j}"${reveal(i) ? " disabled" : ""}><b>${"ABCD"[j]}</b><span>${esc(o)}</span></button>`).join("")}</div>
            ${reveal(i) ? `<div class="expl">${picked === q.a ? "✓ Chính xác." : `✕ Đáp án đúng: <b>${"ABCD"[q.a]}</b>.`} ${esc(q.e)}${q.ts ? ` <code class="ts">${esc(q.ts)}</code>` : ""}</div>` : ""}
          </li>`;
        }).join("")}</ol>
        ${st.exam && !st.submitted ? `<div class="quiz-submit"><button class="btn primary" data-q="submit">Nộp bài (${answered.length}/${ids.length})</button></div>` : ""}
        ${(st.exam && st.submitted) || (!st.exam && answered.length === ids.length && ids.length) ? `<div class="quiz-result">Kết quả: <b>${right}/${ids.length}</b> (${Math.round(right * 100 / Math.max(1, ids.length))}%)
          ${right === ids.length ? " – xuất sắc 🎉" : right >= ids.length * 0.8 ? " – rất tốt 👍" : right >= ids.length * 0.5 ? " – ôn lại các câu sai nhé" : " – nên đọc lại bài học chi tiết"}</div>` : ""}`;
      const bar = box.querySelector(".progress span");
      bar.style.width = bar.getAttribute("style-w") + "%"; // CSSOM: không vi phạm CSP style-src
    }
    box.addEventListener("click", (e) => {
      const opt = e.target.closest(".opt");
      if (opt && !opt.disabled) {
        const i = +opt.closest(".q").dataset.i;
        if (st.exam && st.submitted) return;
        st.ans[i] = +opt.dataset.j; save();
        if (!st.exam && st.ans[i] !== qs[i].a) SRS.addQuiz(doc.course, { ...qs[i], s: doc.session });
        render();
        return;
      }
      const a = e.target.dataset.q;
      if (a === "shuffle") { st.order = qs.map((_, i) => i).sort(() => Math.random() - 0.5); save(); render(); }
      if (a === "reset") { st.ans = {}; st.submitted = false; save(); render(); box.scrollIntoView({ block: "start" }); }
      if (a === "anki") window.LecsumDownload(`${doc.course}_Buoi${String(doc.session).padStart(2, "0")}_anki.txt`,
        ankiText(doc.study.cards.map((c) => ({ ...c, s: doc.session })), qs.map((q) => ({ ...q, s: doc.session })), doc.course), "text/plain");
      if (a === "submit") {
        st.submitted = true; save();
        order().filter((i) => i in st.ans && st.ans[i] !== qs[i].a).forEach((i) => SRS.addQuiz(doc.course, { ...qs[i], s: doc.session }));
        render(); box.querySelector(".quiz-result")?.scrollIntoView({ block: "center" });
      }
    });
    box.addEventListener("change", (e) => {
      const a = e.target.dataset.q;
      if (a === "exam") { st.exam = e.target.checked; st.submitted = false; st.ans = {}; }
      if (a === "level") st.level = e.target.value;
      save(); render();
    });
    render();
  }

  // ------------------------------------------------------------------ thẻ ghi nhớ + tự luận
  function cardsView(s, box) {
    let cards = s.cards.slice();
    function render() {
      box.innerHTML = `<div class="quiz-bar"><div class="score">${cards.length} thẻ · bấm để lật</div><span class="spacer"></span>
        <button class="btn" data-c="shuffle">🔀 Xáo</button><button class="btn" data-c="flip">Lật hết</button></div>
        <div class="cards">${cards.map((c) => `<button class="flash"><span class="front">${esc(c.f)}</span><span class="back">${esc(c.b)}</span></button>`).join("")}</div>`;
    }
    box.addEventListener("click", (e) => {
      const card = e.target.closest(".flash");
      if (card) { card.classList.toggle("flipped"); return; }
      if (e.target.dataset.c === "shuffle") { cards = cards.sort(() => Math.random() - 0.5); render(); }
      if (e.target.dataset.c === "flip") box.querySelectorAll(".flash").forEach((c) => c.classList.toggle("flipped"));
    });
    render();
  }

  function reviewView(s) {
    return `<ol class="review">${s.review.map((r) => `<li><p class="q-text">${esc(r.q)}</p>
      <details><summary>Xem dàn ý đáp án</summary><div class="prose">${r.a}</div></details></li>`).join("")}</ol>`;
  }

  // ------------------------------------------------------------------ Anki
  function ankiText(cards, quiz, tag) {
    const c = (x) => String(x ?? "").replace(/\t/g, " ").replace(/\n/g, "<br>");
    const t = String(tag || "lecsum").replace(/\s+/g, "_");
    const rows = ["#separator:tab", "#html:true", "#tags column:3"];
    cards.forEach((k) => rows.push(`${c(k.f)}\t${c(k.b)}\t${t} buoi${k.s ?? ""}`));
    quiz.forEach((q) => rows.push(`${c(q.q)}<br><br>${q.o.map((o, i) => `${"ABCD"[i]}. ${c(o)}`).join("<br>")}\t` +
      `<b>${"ABCD"[q.a]}. ${c(q.o[q.a])}</b><br>${c(q.e)}\t${t} trac-nghiem buoi${q.s ?? ""}`));
    return rows.join("\n") + "\n";
  }

  // ------------------------------------------------------------------ ôn tập ngắt quãng (Leitner, lưu trên thiết bị)
  const DAY = 86400000;
  const today = () => new Date(new Date().toDateString()).getTime();
  const hash = (s) => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h.toString(36); };
  const SRS = {
    STEPS: [0, 1, 3, 7, 14, 30],         // hộp -> số ngày tới lần ôn sau
    NEW_PER_DAY: 20,
    key: (course) => `lecsum.srs.${course}`,
    load(course) { return store.get(SRS.key(course)) || { items: {}, newDay: 0, newCount: 0 }; },
    save(course, d) { store.set(SRS.key(course), d); },
    addQuiz(course, q) {
      if (!course) return;
      const d = SRS.load(course), id = "q" + hash(q.q);
      d.items[id] = { kind: "quiz", box: 1, due: today() + DAY, p: { q: q.q, o: q.o, a: q.a, e: q.e, s: q.s } };
      SRS.save(course, d);
    },
    deck(course, cards) {
      // thẻ đã vào hộp và đến hạn + thẻ mới (tối đa NEW_PER_DAY mỗi ngày)
      const d = SRS.load(course), t = today();
      if (d.newDay !== t) { d.newDay = t; d.newCount = 0; }
      const due = Object.entries(d.items).filter(([, it]) => it.due <= t).map(([id, it]) => ({ id, ...it }));
      const fresh = [];
      for (const c of cards) {
        const id = "c" + hash(c.f);
        if (d.items[id] || fresh.length + d.newCount >= SRS.NEW_PER_DAY) continue;
        fresh.push({ id, kind: "card", box: 0, due: t, p: c, isNew: true });
      }
      return { d, items: [...due, ...fresh] };
    },
    grade(course, item, ok) {
      const d = SRS.load(course);
      if (item.isNew && d.newDay === today()) d.newCount += 1;
      const box = ok ? Math.min((item.box || 0) + 1, SRS.STEPS.length - 1) : 1;
      d.items[item.id] = { kind: item.kind, box, due: today() + SRS.STEPS[box] * DAY, p: item.p };
      SRS.save(course, d);
    },
    stats(course) {
      const d = SRS.load(course), t = today(), it = Object.values(d.items);
      return { total: it.length, due: it.filter((x) => x.due <= t).length, learned: it.filter((x) => x.box >= 4).length };
    },
  };

  function srsView(pack, box) {
    let queue = null, cur = 0, flipped = false, done = 0, right = 0;
    function start() { queue = SRS.deck(pack.code, pack.cards).items.sort(() => Math.random() - 0.5); cur = 0; done = 0; right = 0; flipped = false; }
    function render() {
      const st = SRS.stats(pack.code);
      if (!queue) start();
      const item = queue[cur];
      const head = `<div class="quiz-bar"><div class="score"><b>${queue.length - cur}</b> thẻ cần ôn hôm nay · đã thuộc <b>${st.learned}</b>/${Math.max(st.total, 0)} thẻ đang theo dõi</div>
        <span class="spacer"></span><button class="btn" data-r="restart">↺ Bắt đầu lại</button></div>
        <p class="fineprint">Ôn ngắt quãng: trả lời đúng thì thẻ quay lại sau 1 → 3 → 7 → 14 → 30 ngày; sai thì gặp lại ngày mai. Câu trắc nghiệm làm sai ở các buổi tự được thêm vào đây. Mỗi ngày thêm tối đa ${SRS.NEW_PER_DAY} thẻ mới.</p>`;
      if (!item) {
        box.innerHTML = head + `<div class="quiz-result">Hết thẻ cần ôn hôm nay 🎉${done ? ` – ${right}/${done} nhớ đúng` : ""}. Quay lại vào ngày mai nhé.</div>`;
        return;
      }
      const p = item.p, isQuiz = item.kind === "quiz";
      const front = isQuiz ? `<p class="q-text">${esc(p.q)}</p><ol class="srs-opts" type="A">${p.o.map((o) => `<li>${esc(o)}</li>`).join("")}</ol>` : `<p class="srs-front">${esc(p.f)}</p>`;
      const back = isQuiz ? `<p><b>${"ABCD"[p.a]}. ${esc(p.o[p.a])}</b></p><p class="muted">${esc(p.e)}</p>` : `<p>${esc(p.b)}</p>`;
      box.innerHTML = head + `<div class="srs-card">
          <div class="q-head"><span class="tag">${isQuiz ? "Câu đã làm sai" : item.isNew ? "Thẻ mới" : `Hộp ${item.box}`}</span>${p.s ? `<span class="tag">Buổi ${p.s}</span>` : ""}</div>
          ${front}${flipped ? `<div class="srs-back">${back}</div>` : ""}
          <div class="srs-actions">${flipped
            ? `<button class="btn" data-r="no">✕ Chưa nhớ</button><button class="btn primary" data-r="yes">✓ Nhớ rồi</button>`
            : `<button class="btn primary" data-r="flip">Xem đáp án</button>`}</div></div>`;
    }
    box.addEventListener("click", (e) => {
      const a = e.target.dataset.r;
      if (a === "flip") { flipped = true; render(); }
      if (a === "yes" || a === "no") {
        SRS.grade(pack.code, queue[cur], a === "yes");
        done += 1; right += a === "yes"; cur += 1; flipped = false; render();
      }
      if (a === "restart") { start(); render(); }
    });
    render();
  }

  // ------------------------------------------------------------------ đề thi thử cả học phần
  function examView(pack, box) {
    const KEY = `lecsum.exam.${pack.code}`, qs = pack.quiz;
    const sessions = [...new Set(qs.map((q) => q.s))].sort((a, b) => a - b);
    let st = store.get(KEY) || null, timer = null;
    const save = () => store.set(KEY, st);
    function setup() {
      clearInterval(timer);
      if (!qs.length) { box.innerHTML = `<p class="muted">Chưa có câu trắc nghiệm nào – tạo bài học chuyên sâu cho các buổi trước.</p>`; return; }
      box.innerHTML = `<div class="exam-setup card-box">
        <h3>📝 Tạo đề thi thử</h3>
        <p class="fineprint">Trộn câu hỏi từ ngân hàng ${qs.length} câu của ${sessions.length} buổi.</p>
        <div class="exam-row"><b>Buổi</b><div class="chips">${sessions.map((n) => `<label class="chip"><input type="checkbox" data-s="${n}" checked> ${n}</label>`).join("")}</div></div>
        <div class="exam-row"><b>Số câu</b><select data-x="count">${[10, 20, 30, 40, 50].map((n) => `<option${n === 30 ? " selected" : ""}>${n}</option>`).join("")}</select>
          <b>Độ khó</b><select data-x="level"><option value="">Trộn đều</option>${Object.entries(LEVEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
          <b>Thời gian</b><select data-x="time"><option value="0">Không giới hạn</option>${[15, 30, 45, 60, 90].map((m) => `<option value="${m}"${m === 45 ? " selected" : ""}>${m} phút</option>`).join("")}</select></div>
        <button class="btn primary" data-x="start">Bắt đầu làm bài</button></div>`;
    }
    function startExam() {
      const pick = new Set([...box.querySelectorAll("[data-s]:checked")].map((x) => +x.dataset.s));
      const level = box.querySelector('[data-x="level"]').value;
      let pool = qs.map((q, i) => i).filter((i) => pick.has(qs[i].s) && (!level || qs[i].d === level));
      if (!pool.length) { alertBox("Không có câu nào khớp lựa chọn."); return; }
      pool = pool.sort(() => Math.random() - 0.5).slice(0, +box.querySelector('[data-x="count"]').value);
      const mins = +box.querySelector('[data-x="time"]').value;
      st = { ids: pool, ans: {}, start: Date.now(), end: mins ? Date.now() + mins * 60000 : 0, submitted: false };
      save(); render();
    }
    function alertBox(msg) { const p = document.createElement("p"); p.className = "error"; p.textContent = msg; box.querySelector(".exam-setup").appendChild(p); }
    function submit() {
      st.submitted = true; st.finished = Date.now(); save();
      st.ids.filter((i) => st.ans[i] !== qs[i].a).forEach((i) => SRS.addQuiz(pack.code, qs[i]));
      render(); window.scrollTo(0, 0); document.getElementById("doc")?.scrollTo?.(0, 0);
    }
    function clock() {
      const el = box.querySelector(".exam-clock");
      if (!el || !st || st.submitted) return;
      if (st.end) {
        const left = Math.max(0, st.end - Date.now());
        el.textContent = `⏱ còn ${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, "0")}`;
        el.classList.toggle("warn", left < 120000);
        if (!left) submit();
      } else {
        const used = Date.now() - st.start;
        el.textContent = `⏱ ${Math.floor(used / 60000)}:${String(Math.floor(used / 1000) % 60).padStart(2, "0")}`;
      }
    }
    function result() {
      const right = st.ids.filter((i) => st.ans[i] === qs[i].a).length, n = st.ids.length;
      const by = {};
      st.ids.forEach((i) => { const k = qs[i].s; by[k] = by[k] || { n: 0, ok: 0 }; by[k].n += 1; by[k].ok += st.ans[i] === qs[i].a; });
      const weak = Object.entries(by).filter(([, v]) => v.ok / v.n < 0.7).sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n);
      const mins = Math.round(((st.finished || Date.now()) - st.start) / 60000);
      return `<div class="quiz-result exam-result"><div class="big">${right}/${n}</div><div>${(right * 10 / Math.max(1, n)).toFixed(1)} điểm · ${mins} phút</div>
        <table class="exam-table"><tr><th>Buổi</th><th>Đúng</th></tr>${Object.entries(by).map(([k, v]) => `<tr class="${v.ok / v.n < 0.7 ? "weak" : ""}"><td>Buổi ${k}</td><td>${v.ok}/${v.n}</td></tr>`).join("")}</table>
        ${weak.length ? `<p>Cần ôn lại: ${weak.map(([k]) => `<b>Buổi ${k}</b>`).join(", ")} · các câu sai đã được thêm vào <i>Ôn tập</i>.</p>` : "<p>Rất tốt – không có buổi nào dưới 70% 👍</p>"}
        <button class="btn primary" data-x="new">Làm đề mới</button></div>`;
    }
    function render() {
      clearInterval(timer);
      if (!st) { setup(); return; }
      const reveal = st.submitted, answered = st.ids.filter((i) => i in st.ans).length;
      box.innerHTML = `<div class="quiz-bar"><div class="score"><b>${answered}</b>/${st.ids.length} câu</div>
          <span class="exam-clock"></span><span class="spacer"></span>
          ${reveal ? "" : `<button class="btn primary" data-x="submit">Nộp bài</button>`}<button class="btn" data-x="quit">${reveal ? "Đề mới" : "Huỷ đề"}</button></div>
        ${reveal ? result() : ""}
        <ol class="quiz">${st.ids.map((i, k) => {
          const q = qs[i], picked = st.ans[i];
          return `<li class="q${reveal ? (picked === q.a ? " right" : " wrong") : ""}" data-i="${i}">
            <div class="q-head"><span class="q-num">Câu ${k + 1}</span><span class="tag">Buổi ${q.s}</span><span class="tag ${q.d}">${LEVEL[q.d] || q.d}</span></div>
            <p class="q-text">${esc(q.q)}</p>
            <div class="opts">${q.o.map((o, j) => `<button class="opt${picked === j ? " picked" : ""}${reveal && j === q.a ? " correct" : ""}${reveal && picked === j && j !== q.a ? " incorrect" : ""}"
              data-j="${j}"${reveal ? " disabled" : ""}><b>${"ABCD"[j]}</b><span>${esc(o)}</span></button>`).join("")}</div>
            ${reveal ? `<div class="expl">${picked === q.a ? "✓" : picked === undefined ? "— Bỏ trống." : "✕"} Đáp án: <b>${"ABCD"[q.a]}</b>. ${esc(q.e)}</div>` : ""}
          </li>`;
        }).join("")}</ol>`;
      if (!reveal) { clock(); timer = setInterval(clock, 1000); }
    }
    box.addEventListener("click", (e) => {
      const opt = e.target.closest(".opt");
      if (opt && !opt.disabled && st && !st.submitted) {
        st.ans[+opt.closest(".q").dataset.i] = +opt.dataset.j; save();
        opt.closest(".opts").querySelectorAll(".opt").forEach((b) => b.classList.toggle("picked", b === opt));
        box.querySelector(".score b").textContent = st.ids.filter((i) => i in st.ans).length;
        return;
      }
      const a = e.target.dataset.x;
      if (a === "start") startExam();
      if (a === "submit") submit();
      if (a === "quit" || a === "new") { st = null; save(); render(); }
    });
    render();
  }

  // ------------------------------------------------------------------ trang học phần
  const COURSE_TABS = [["outline", "Đề cương"], ["map", "Sơ đồ toàn môn"], ["exam", "Đề thi thử"], ["srs", "Ôn tập"], ["export", "Tải về"]];

  function renderCourse(body, pack, tab) {
    if (!COURSE_TABS.some(([k]) => k === tab)) tab = "outline";
    const st = SRS.stats(pack.code);
    const badge = { exam: pack.quiz.length, srs: st.due || "" };
    body.innerHTML = `<h1 class="lesson-title">${esc(pack.code)} · ${esc(pack.name || "")}</h1>
      <nav class="subtabs">${COURSE_TABS.map(([k, v]) => `<a href="#course/${pack.id}/${k}" class="subtab${k === tab ? " active" : ""}">${v}${badge[k] ? ` <small>${badge[k]}</small>` : ""}</a>`).join("")}</nav>
      <div class="subview"></div>`;
    const view = body.querySelector(".subview");
    if (tab === "outline") view.innerHTML = `<div class="prose">${pack.outline}</div>`;
    if (tab === "map") mindmapView(JSON.parse(JSON.stringify(pack.mindmap)), view);
    if (tab === "exam") examView(pack, view);
    if (tab === "srs") srsView(pack, view);
    if (tab === "export") {
      view.innerHTML = `<div class="card-box export"><h3>Tải về</h3>
        <p><button class="btn" data-e="anki">⬇ Bộ thẻ Anki (${pack.cards.length} thẻ + ${pack.quiz.length} câu)</button>
        <span class="fineprint">Anki → File → Import → chọn tệp .txt</span></p>
        <p><button class="btn" data-e="md">⬇ Đề cương (Markdown)</button> <button class="btn" data-e="print">🖨 In đề cương / PDF</button></p></div>`;
      view.addEventListener("click", (e) => {
        const a = e.target.dataset.e;
        if (a === "anki") window.LecsumDownload(`${pack.code}_anki.txt`, pack.anki, "text/plain");
        if (a === "md") window.LecsumDownload(`${pack.code}_de-cuong.md`, pack.md, "text/markdown");
        if (a === "print") { location.hash = `#course/${pack.id}/outline`; setTimeout(() => window.print(), 400); }
      });
    }
    return tab;
  }

  // ------------------------------------------------------------------ khung tab
  const TABS = [
    ["summary", "Tóm tắt"], ["lesson", "Bài học"], ["mindmap", "Sơ đồ tư duy"], ["quiz", "Trắc nghiệm"],
    ["cards", "Thẻ ghi nhớ"], ["review", "Tự luận"],
  ];

  function render(body, doc, tab) {
    const s = doc.study;
    const counts = { quiz: s.quiz.length, cards: s.cards.length, review: s.review.length };
    const avail = TABS.filter(([k]) => k === "summary" || k === "lesson" || (k === "mindmap" ? s.mindmap : counts[k]));
    if (!avail.some(([k]) => k === tab)) tab = "summary";
    body.innerHTML = `<nav class="subtabs">${avail.map(([k, v]) =>
      `<a href="#doc/${doc.id}/${k}" class="subtab${k === tab ? " active" : ""}">${v}${counts[k] ? ` <small>${counts[k]}</small>` : ""}</a>`).join("")}</nav>
      <div class="subview"></div>`;
    const view = body.querySelector(".subview");
    if (tab === "summary") view.innerHTML = `<div class="prose">${doc.html}</div>`;
    if (tab === "lesson") {
      view.innerHTML = lessonView(s);
      view.addEventListener("click", (e) => {
        const j = e.target.closest("[data-jump]");
        if (j) { e.preventDefault(); document.getElementById(j.dataset.jump)?.scrollIntoView({ behavior: "smooth", block: "start" }); }
      });
    }
    if (tab === "mindmap") mindmapView(JSON.parse(JSON.stringify(s.mindmap)), view);
    if (tab === "quiz") quizView(doc, view);
    if (tab === "cards") cardsView(s, view);
    if (tab === "review") view.innerHTML = reviewView(s);
    return tab;
  }

  window.LecsumStudy = { render, TABS, renderCourse, SRS };
})();
