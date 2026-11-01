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
        st.ans[i] = +opt.dataset.j; save(); render();
        return;
      }
      const a = e.target.dataset.q;
      if (a === "shuffle") { st.order = qs.map((_, i) => i).sort(() => Math.random() - 0.5); save(); render(); }
      if (a === "reset") { st.ans = {}; st.submitted = false; save(); render(); box.scrollIntoView({ block: "start" }); }
      if (a === "submit") { st.submitted = true; save(); render(); box.querySelector(".quiz-result")?.scrollIntoView({ block: "center" }); }
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

  window.LecsumStudy = { render, TABS };
})();
