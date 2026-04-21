/* =========================================================
   JSE Lern-App — Shared Logic
   (Fortschritt, Flashcards, Quiz, Code-Playground, Prüfung)
   ========================================================= */
(function () {
  "use strict";

  // ---- Progress (localStorage) ---------------------------
  const STORAGE_KEY = "jse_progress_v1";
  const defaultProgress = {
    modules: {}, // { "1": { theoryDone, flashcardsDone, quizScore, quizMax } }
    examBest: null,
    examAttempts: []
  };
  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...defaultProgress };
      const p = JSON.parse(raw);
      return { ...defaultProgress, ...p, modules: p.modules || {} };
    } catch { return { ...defaultProgress }; }
  }
  function saveProgress(p) { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); }
  function updateModule(id, patch) {
    const p = loadProgress();
    p.modules[id] = { ...(p.modules[id] || {}), ...patch };
    saveProgress(p);
    return p;
  }
  window.JSE_PROGRESS = { load: loadProgress, save: saveProgress, update: updateModule };

  // ---- Simple syntax highlighter -------------------------
  // Applied to <pre><code class="js">...</code></pre> on DOMContentLoaded.
  const KEYWORDS = [
    "var","let","const","function","return","if","else","for","while","do",
    "switch","case","default","break","continue","new","this","typeof","instanceof",
    "in","of","delete","void","try","catch","finally","throw","class","extends",
    "super","import","export","from","as","null","undefined","true","false","NaN","Infinity"
  ];
  const KW_RE = new RegExp("\\b(" + KEYWORDS.join("|") + ")\\b", "g");
  function escapeHTML(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function highlight(src) {
    let s = escapeHTML(src);
    // line/block comments (rough, ok for short snippets)
    s = s.replace(/(\/\/[^\n]*)/g, '<span class="hl-com">$1</span>');
    s = s.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="hl-com">$1</span>');
    // strings
    s = s.replace(/("(?:[^"\\\n]|\\.)*")/g, '<span class="hl-str">$1</span>');
    s = s.replace(/('(?:[^'\\\n]|\\.)*')/g, '<span class="hl-str">$1</span>');
    s = s.replace(/(`(?:[^`\\]|\\.)*`)/g, '<span class="hl-str">$1</span>');
    // numbers
    s = s.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="hl-num">$1</span>');
    // keywords (avoid touching spans)
    s = s.replace(KW_RE, function (m) {
      // skip if inside an existing span
      return '<span class="hl-kw">' + m + '</span>';
    });
    return s;
  }
  function highlightAll() {
    document.querySelectorAll("pre code.js, pre code.language-js").forEach(el => {
      if (el.dataset.hl === "1") return;
      el.innerHTML = highlight(el.textContent);
      el.dataset.hl = "1";
    });
  }

  // ---- Tabs ----------------------------------------------
  function initTabs(root) {
    root = root || document;
    root.querySelectorAll("[data-tabs]").forEach(group => {
      const btns = group.querySelectorAll(".tab-btn");
      const panelsWrap = group.nextElementSibling;
      if (!panelsWrap) return;
      btns.forEach(btn => {
        btn.addEventListener("click", () => {
          btns.forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          panelsWrap.querySelectorAll(":scope > .tab-panel").forEach(p => p.classList.remove("active"));
          const target = panelsWrap.querySelector("#" + btn.dataset.target);
          if (target) target.classList.add("active");
        });
      });
    });
  }

  // ---- Flashcards ----------------------------------------
  // Config: container element, array of {front, back}, storageKey, moduleId
  function initFlashcards({ container, cards, storageKey, moduleId }) {
    if (!container || !cards || !cards.length) return;
    let order = shuffle([...cards.keys()]);
    let idx = 0;
    let knownSet = new Set();
    let reviewQueue = []; // indices for "nochmal"

    const card = document.createElement("div");
    card.className = "flashcard";
    card.innerHTML = `
      <div class="flashcard-inner">
        <div class="flashcard-face front">
          <div class="label">Frage</div>
          <div class="content js-front"></div>
        </div>
        <div class="flashcard-face back">
          <div class="label">Antwort</div>
          <div class="content js-back"></div>
        </div>
      </div>`;
    const meta = document.createElement("div");
    meta.className = "flashcard-meta";
    meta.innerHTML = `<span class="js-pos">1 / ${cards.length}</span><span class="js-known">✓ 0</span>`;
    const hint = document.createElement("div");
    hint.className = "flashcard-hint";
    hint.textContent = "Klicke auf die Karte zum Umdrehen · Leertaste: umdrehen · ← → : navigieren";
    const controls = document.createElement("div");
    controls.className = "flashcard-controls";
    controls.innerHTML = `
      <button class="btn ghost js-prev">← Zurück</button>
      <button class="btn danger js-again">↺ Nochmal</button>
      <button class="btn success js-known-btn">✓ Wusste ich</button>
      <button class="btn ghost js-next">Weiter →</button>
      <button class="btn js-reset">Reset</button>
    `;
    const wrap = document.createElement("div");
    wrap.className = "flashcard-wrap";
    wrap.append(meta, card, controls, hint);
    container.innerHTML = "";
    container.appendChild(wrap);

    const frontEl = card.querySelector(".js-front");
    const backEl = card.querySelector(".js-back");
    const posEl = meta.querySelector(".js-pos");
    const knownEl = meta.querySelector(".js-known");

    function render() {
      const currentIdx = order[idx];
      const c = cards[currentIdx];
      frontEl.innerHTML = c.front;
      backEl.innerHTML = c.back;
      card.classList.remove("flipped");
      posEl.textContent = `${idx + 1} / ${order.length}`;
      knownEl.textContent = `✓ ${knownSet.size} / ${cards.length}`;
      highlightAll();
      // persist progress
      if (moduleId) {
        const p = loadProgress();
        p.modules[moduleId] = p.modules[moduleId] || {};
        p.modules[moduleId].flashcardsKnown = knownSet.size;
        p.modules[moduleId].flashcardsTotal = cards.length;
        if (knownSet.size >= cards.length) p.modules[moduleId].flashcardsDone = true;
        saveProgress(p);
      }
    }
    function flip() { card.classList.toggle("flipped"); }
    function next() { idx = (idx + 1) % order.length; render(); }
    function prev() { idx = (idx - 1 + order.length) % order.length; render(); }
    function markKnown() {
      knownSet.add(order[idx]);
      next();
    }
    function again() {
      // push the current card near the end
      const cur = order[idx];
      order.splice(idx, 1);
      order.push(cur);
      if (idx >= order.length) idx = 0;
      render();
    }
    function reset() {
      order = shuffle([...cards.keys()]);
      idx = 0; knownSet = new Set();
      render();
    }

    card.addEventListener("click", flip);
    controls.querySelector(".js-prev").addEventListener("click", prev);
    controls.querySelector(".js-next").addEventListener("click", next);
    controls.querySelector(".js-known-btn").addEventListener("click", markKnown);
    controls.querySelector(".js-again").addEventListener("click", again);
    controls.querySelector(".js-reset").addEventListener("click", reset);

    container.addEventListener("keydown", handleKey);
    document.addEventListener("keydown", (e) => {
      if (!container.offsetParent) return; // hidden
      if (document.activeElement && /input|textarea/i.test(document.activeElement.tagName)) return;
      handleKey(e);
    });
    function handleKey(e) {
      if (e.code === "Space") { e.preventDefault(); flip(); }
      else if (e.code === "ArrowRight") next();
      else if (e.code === "ArrowLeft") prev();
    }
    render();
  }

  // ---- Quiz ----------------------------------------------
  // Config: container, questions [{q, code?, options[], correct, explain}], moduleId
  function initQuiz({ container, questions, moduleId }) {
    if (!container || !questions || !questions.length) return;
    let answers = new Array(questions.length).fill(null);

    function render() {
      container.innerHTML = "";
      const wrap = document.createElement("div");
      wrap.className = "quiz-wrap";
      questions.forEach((q, i) => {
        const card = document.createElement("div");
        card.className = "quiz-question";
        const codeHTML = q.code ? `<pre><code class="js">${escapeHTML(q.code)}</code></pre>` : "";
        card.innerHTML = `
          <div class="q-num">Frage ${i + 1} / ${questions.length}</div>
          <div class="q-text">${q.q}</div>
          ${codeHTML}
          <div class="quiz-options"></div>
          <div class="quiz-explain"><strong>Erklärung:</strong> <span class="js-ex"></span></div>
        `;
        const optsEl = card.querySelector(".quiz-options");
        q.options.forEach((opt, oi) => {
          const btn = document.createElement("button");
          btn.className = "quiz-option";
          btn.innerHTML = `<span class="letter">${String.fromCharCode(65 + oi)}</span><span>${opt}</span>`;
          btn.addEventListener("click", () => selectAnswer(i, oi, card));
          optsEl.appendChild(btn);
        });
        card.querySelector(".js-ex").textContent = q.explain || "";
        wrap.appendChild(card);
      });

      // Footer: submit + summary
      const footer = document.createElement("div");
      footer.className = "mt-lg row";
      footer.innerHTML = `
        <button class="btn primary js-submit">Quiz auswerten</button>
        <button class="btn js-reset">Zurücksetzen</button>
        <span class="pill js-progress">0 / ${questions.length} beantwortet</span>
      `;
      wrap.appendChild(footer);

      const summary = document.createElement("div");
      summary.className = "quiz-summary hidden";
      summary.innerHTML = `<div class="label">Dein Ergebnis</div><div class="score js-score">0</div><div class="label js-sub"></div>`;
      wrap.appendChild(summary);

      container.appendChild(wrap);

      footer.querySelector(".js-submit").addEventListener("click", () => evaluate(wrap, summary));
      footer.querySelector(".js-reset").addEventListener("click", () => { answers.fill(null); render(); });

      highlightAll();
    }
    function selectAnswer(qi, oi, cardEl) {
      if (cardEl.classList.contains("answered")) return;
      answers[qi] = oi;
      cardEl.querySelectorAll(".quiz-option").forEach((o, i) => {
        o.classList.toggle("selected", i === oi);
      });
      const done = answers.filter(a => a !== null).length;
      const el = container.querySelector(".js-progress");
      if (el) el.textContent = `${done} / ${questions.length} beantwortet`;
    }
    function evaluate(wrap, summary) {
      let correct = 0;
      wrap.querySelectorAll(".quiz-question").forEach((card, i) => {
        const q = questions[i];
        const sel = answers[i];
        card.classList.add("answered");
        card.querySelectorAll(".quiz-option").forEach((o, oi) => {
          o.disabled = true;
          o.classList.remove("selected");
          if (oi === q.correct) o.classList.add("correct");
          else if (oi === sel) o.classList.add("wrong");
        });
        if (sel === q.correct) correct++;
        card.querySelector(".quiz-explain").classList.add("show");
      });
      summary.classList.remove("hidden");
      const pct = Math.round((correct / questions.length) * 100);
      summary.querySelector(".js-score").textContent = `${correct} / ${questions.length}`;
      summary.querySelector(".js-sub").textContent = `${pct} % korrekt${pct >= 70 ? " — bestanden 🎉" : " — weiter üben!"}`;
      summary.classList.toggle("pass", pct >= 70);
      if (moduleId) {
        updateModule(moduleId, { quizScore: correct, quizMax: questions.length, quizDone: true });
      }
      summary.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    render();
  }

  // ---- Code Playground -----------------------------------
  // Each playground: {container, task, initialCode}
  function initPlaygrounds(playgrounds) {
    playgrounds.forEach(pg => {
      const root = document.createElement("div");
      root.className = "playground";
      root.innerHTML = `
        ${pg.task ? `<div class="playground-task"><strong>Aufgabe:</strong> ${pg.task}</div>` : ""}
        <textarea spellcheck="false"></textarea>
        <div class="playground-actions">
          <button class="btn primary js-run">▶ Ausführen</button>
          <button class="btn js-reset">Zurücksetzen</button>
          <button class="btn ghost js-clear">Ausgabe löschen</button>
        </div>
        <div class="playground-output">// Ausgabe erscheint hier</div>
      `;
      pg.container.appendChild(root);
      const ta = root.querySelector("textarea");
      const out = root.querySelector(".playground-output");
      ta.value = pg.initialCode || "";
      ta.rows = Math.max(6, (pg.initialCode || "").split("\n").length + 1);

      function run() {
        out.textContent = "";
        const lines = [];
        const mk = (kind) => (...args) => {
          const line = args.map(a => fmt(a)).join(" ");
          lines.push({ kind, line });
        };
        const fakeConsole = {
          log: mk("log"), info: mk("log"), warn: mk("warn"),
          error: mk("err"), debug: mk("log")
        };
        try {
          const fn = new Function("console", `"use strict";\n${ta.value}`);
          const result = fn(fakeConsole);
          if (result !== undefined) lines.push({ kind: "log", line: "=> " + fmt(result) });
        } catch (err) {
          lines.push({ kind: "err", line: err.name + ": " + err.message });
        }
        out.innerHTML = lines.map(l => {
          const cls = l.kind === "err" ? "err" : l.kind === "warn" ? "warn" : "";
          return `<div class="${cls}">${escapeHTML(l.line)}</div>`;
        }).join("") || "// (keine Ausgabe)";
      }
      function fmt(v) {
        if (v === null) return "null";
        if (v === undefined) return "undefined";
        if (typeof v === "string") return v;
        if (typeof v === "function") return v.toString();
        try { return JSON.stringify(v, (k, x) => typeof x === "bigint" ? x.toString()+"n" : x); }
        catch { return String(v); }
      }
      root.querySelector(".js-run").addEventListener("click", run);
      root.querySelector(".js-reset").addEventListener("click", () => { ta.value = pg.initialCode || ""; });
      root.querySelector(".js-clear").addEventListener("click", () => { out.textContent = "// Ausgabe gelöscht"; });
      ta.addEventListener("keydown", (e) => {
        if (e.key === "Tab") { e.preventDefault(); insertAtCursor(ta, "  "); }
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); run(); }
      });
    });
  }
  function insertAtCursor(ta, text) {
    const s = ta.selectionStart, e = ta.selectionEnd;
    ta.value = ta.value.slice(0, s) + text + ta.value.slice(e);
    ta.selectionStart = ta.selectionEnd = s + text.length;
  }

  // ---- Shuffle -------------------------------------------
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ---- Exam engine ---------------------------------------
  // Config: container, pool (array of questions), count, minutes, passPct
  function initExam({ container, pool, count = 40, minutes = 60, passPct = 70 }) {
    if (!container || !pool || !pool.length) return;
    const root = document.createElement("div");
    root.innerHTML = `
      <div class="exam-intro theory-section">
        <h2 style="margin-top:0">Prüfungssimulation — JSE-40-01</h2>
        <p>Diese Simulation entspricht der offiziellen Prüfung:</p>
        <ul>
          <li><strong>${count} Fragen</strong> aus einem Pool von ${pool.length}, zufällig ausgewählt</li>
          <li>Zeitlimit: <strong>${minutes} Minuten</strong></li>
          <li>Bestehensgrenze: <strong>${passPct} %</strong></li>
          <li>Navigation zwischen Fragen möglich · Markieren mit „Flag"</li>
          <li>Nach Ablauf der Zeit wird automatisch ausgewertet</li>
        </ul>
        <div class="btn-row mt">
          <button class="btn primary js-start">▶ Prüfung starten</button>
          <a class="btn" href="index.html">Zurück zum Dashboard</a>
        </div>
      </div>
      <div class="exam-body hidden"></div>
      <div class="exam-review hidden"></div>
    `;
    container.appendChild(root);

    let questions = [];
    let answers = [];
    let flagged = new Set();
    let currentIdx = 0;
    let timerId = null;
    let remainingSec = minutes * 60;

    root.querySelector(".js-start").addEventListener("click", start);

    function start() {
      questions = shuffle([...pool]).slice(0, count);
      answers = new Array(questions.length).fill(null);
      flagged = new Set();
      currentIdx = 0;
      remainingSec = minutes * 60;
      root.querySelector(".exam-intro").classList.add("hidden");
      root.querySelector(".exam-body").classList.remove("hidden");
      renderExam();
      timerId = setInterval(tick, 1000);
    }
    function tick() {
      remainingSec--;
      updateTimer();
      if (remainingSec <= 0) { clearInterval(timerId); finish(true); }
    }
    function updateTimer() {
      const t = root.querySelector(".exam-timer");
      if (!t) return;
      const m = Math.floor(remainingSec / 60), s = remainingSec % 60;
      t.querySelector(".time").textContent = `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
      t.classList.toggle("warn", remainingSec <= 300 && remainingSec > 60);
      t.classList.toggle("danger", remainingSec <= 60);
    }
    function renderExam() {
      const body = root.querySelector(".exam-body");
      body.innerHTML = `
        <div class="exam-timer">
          <div><span class="progress">Frage ${currentIdx + 1} / ${questions.length}</span></div>
          <div class="time">00:00</div>
          <div><button class="btn danger js-finish">Beenden & Auswerten</button></div>
        </div>
        <div class="exam-nav"></div>
        <div class="js-question"></div>
        <div class="btn-row mt">
          <button class="btn js-prev">← Zurück</button>
          <button class="btn ghost js-flag">⚑ Markieren</button>
          <button class="btn primary js-next">Weiter →</button>
        </div>
      `;
      updateTimer();
      renderNav();
      renderQuestion();
      body.querySelector(".js-prev").addEventListener("click", () => { if (currentIdx > 0) { currentIdx--; renderQuestion(); renderNav(); } });
      body.querySelector(".js-next").addEventListener("click", () => { if (currentIdx < questions.length - 1) { currentIdx++; renderQuestion(); renderNav(); } });
      body.querySelector(".js-flag").addEventListener("click", () => { flagged.has(currentIdx) ? flagged.delete(currentIdx) : flagged.add(currentIdx); renderNav(); });
      body.querySelector(".js-finish").addEventListener("click", () => {
        if (confirm("Prüfung wirklich beenden und auswerten?")) { clearInterval(timerId); finish(false); }
      });
    }
    function renderNav() {
      const nav = root.querySelector(".exam-nav");
      nav.innerHTML = "";
      questions.forEach((_, i) => {
        const b = document.createElement("button");
        b.className = "exam-nav-btn";
        if (answers[i] !== null) b.classList.add("answered");
        if (flagged.has(i)) b.classList.add("flagged");
        if (i === currentIdx) b.classList.add("current");
        b.textContent = i + 1;
        b.addEventListener("click", () => { currentIdx = i; renderQuestion(); renderNav(); });
        nav.appendChild(b);
      });
    }
    function renderQuestion() {
      const q = questions[currentIdx];
      const el = root.querySelector(".js-question");
      const codeHTML = q.code ? `<pre><code class="js">${escapeHTML(q.code)}</code></pre>` : "";
      el.innerHTML = `
        <div class="quiz-question">
          <div class="q-num">Frage ${currentIdx + 1} / ${questions.length}${flagged.has(currentIdx) ? " · ⚑ markiert" : ""}</div>
          <div class="q-text">${q.q}</div>
          ${codeHTML}
          <div class="quiz-options"></div>
        </div>
      `;
      const opts = el.querySelector(".quiz-options");
      q.options.forEach((opt, oi) => {
        const b = document.createElement("button");
        b.className = "quiz-option" + (answers[currentIdx] === oi ? " selected" : "");
        b.innerHTML = `<span class="letter">${String.fromCharCode(65 + oi)}</span><span>${opt}</span>`;
        b.addEventListener("click", () => { answers[currentIdx] = oi; renderQuestion(); renderNav(); });
        opts.appendChild(b);
      });
      root.querySelector(".exam-timer .progress").textContent = `Frage ${currentIdx + 1} / ${questions.length}`;
      highlightAll();
    }
    function finish(timedOut) {
      clearInterval(timerId);
      let correct = 0;
      questions.forEach((q, i) => { if (answers[i] === q.correct) correct++; });
      const pct = Math.round((correct / questions.length) * 100);
      const passed = pct >= passPct;
      // persist
      const p = loadProgress();
      p.examAttempts = p.examAttempts || [];
      p.examAttempts.push({ date: new Date().toISOString(), correct, total: questions.length, pct, passed, timedOut });
      if (p.examBest === null || pct > p.examBest) p.examBest = pct;
      saveProgress(p);

      root.querySelector(".exam-body").classList.add("hidden");
      const rev = root.querySelector(".exam-review");
      rev.classList.remove("hidden");
      rev.innerHTML = `
        <div class="exam-result ${passed ? "pass" : "fail"}">
          <div class="verdict">${passed ? "🎉 Bestanden!" : "Noch nicht bestanden"}${timedOut ? " (Zeit abgelaufen)" : ""}</div>
          <div class="big">${pct}%</div>
          <div class="label">${correct} von ${questions.length} richtig · Bestehen ab ${passPct}%</div>
          <div class="exam-result-stats">
            <div class="item"><div class="k">Richtig</div><div class="v success-text">${correct}</div></div>
            <div class="item"><div class="k">Falsch</div><div class="v danger-text">${questions.length - correct - answers.filter(a => a === null).length}</div></div>
            <div class="item"><div class="k">Unbeantwortet</div><div class="v">${answers.filter(a => a === null).length}</div></div>
          </div>
          <div class="btn-row mt-lg" style="justify-content:center">
            <button class="btn primary js-retry">Neue Prüfung</button>
            <a class="btn" href="index.html">Dashboard</a>
          </div>
        </div>
        <h2>Überprüfung</h2>
        <div class="js-reviews"></div>
      `;
      const list = rev.querySelector(".js-reviews");
      questions.forEach((q, i) => {
        const sel = answers[i];
        const ok = sel === q.correct;
        const item = document.createElement("div");
        item.className = "review-item";
        const codeHTML = q.code ? `<pre><code class="js">${escapeHTML(q.code)}</code></pre>` : "";
        item.innerHTML = `
          <div class="q">${i + 1}. ${q.q}</div>
          ${codeHTML}
          <div class="a ${ok ? "correct" : "wrong"}">Deine Antwort: ${sel === null ? "—" : String.fromCharCode(65+sel) + ") " + q.options[sel]} ${ok ? "✓" : "✗"}</div>
          ${!ok ? `<div class="a correct">Richtig: ${String.fromCharCode(65+q.correct)}) ${q.options[q.correct]}</div>` : ""}
          <div class="ex">${q.explain || ""}</div>
        `;
        list.appendChild(item);
      });
      rev.querySelector(".js-retry").addEventListener("click", () => location.reload());
      highlightAll();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // ---- Dashboard helpers ---------------------------------
  function renderDashboard() {
    const p = loadProgress();
    document.querySelectorAll("[data-module-progress]").forEach(el => {
      const id = el.dataset.moduleProgress;
      const m = p.modules[id] || {};
      const total = (m.flashcardsTotal || 0) + 1 /*quiz*/ + 1 /*theory*/;
      let done = 0;
      if (m.theoryDone) done++;
      if (m.quizDone) done++;
      const fcPct = m.flashcardsTotal ? (m.flashcardsKnown || 0) / m.flashcardsTotal : 0;
      const pct = Math.round(((done + fcPct) / 3) * 100);
      const fill = el.querySelector(".progress-fill");
      const lbl = el.querySelector(".progress-label");
      if (fill) fill.style.width = pct + "%";
      if (lbl) lbl.textContent = `${pct}% abgeschlossen${m.quizDone ? ` · Quiz: ${m.quizScore}/${m.quizMax}` : ""}`;
    });
    const overallEl = document.querySelector("[data-overall-progress]");
    if (overallEl) {
      const ids = ["1","2","3","4","5","6","7"];
      let sum = 0;
      ids.forEach(id => {
        const m = p.modules[id] || {};
        const fcPct = m.flashcardsTotal ? (m.flashcardsKnown || 0) / m.flashcardsTotal : 0;
        let d = 0; if (m.theoryDone) d++; if (m.quizDone) d++;
        sum += ((d + fcPct) / 3) * 100;
      });
      overallEl.textContent = Math.round(sum / ids.length) + "%";
    }
    const bestEl = document.querySelector("[data-exam-best]");
    if (bestEl) bestEl.textContent = p.examBest !== null ? p.examBest + "%" : "—";
    const attemptsEl = document.querySelector("[data-exam-attempts]");
    if (attemptsEl) attemptsEl.textContent = (p.examAttempts || []).length;
  }

  // ---- Mark theory as read -------------------------------
  function initTheoryMark() {
    document.querySelectorAll("[data-mark-theory]").forEach(btn => {
      const id = btn.dataset.markTheory;
      const p = loadProgress();
      if (p.modules[id]?.theoryDone) {
        btn.textContent = "✓ Theorie abgeschlossen";
        btn.classList.add("success");
      }
      btn.addEventListener("click", () => {
        updateModule(id, { theoryDone: true });
        btn.textContent = "✓ Theorie abgeschlossen";
        btn.classList.add("success");
      });
    });
  }

  // ---- Sidebar (injected on every page) ------------------
  function injectSidebar() {
    if (document.querySelector(".sidebar")) return;

    // 1) Remove old topbar if present (legacy v1)
    const oldBar = document.querySelector(".topbar");
    if (oldBar) oldBar.remove();

    // 2) Wrap existing <main class="container"> to play nice with flex layout
    const mainEl = document.querySelector("main");
    if (mainEl && mainEl.classList.contains("container")) {
      mainEl.classList.remove("container");
      mainEl.classList.add("main");
      const wrap = document.createElement("div");
      wrap.className = "container";
      while (mainEl.firstChild) wrap.appendChild(mainEl.firstChild);
      mainEl.appendChild(wrap);
    }

    // 3) Detect current page from URL
    const path = (location.pathname.split("/").pop() || "").toLowerCase();
    let current = "home";
    if (path === "pruefung.html") current = "exam";
    else if (path.startsWith("modul-")) {
      const n = (path.match(/modul-(\d+)/) || [])[1];
      if (n) current = "modul-" + n;
    }

    const modules = [
      { id: "1", label: "Einführung" },
      { id: "2", label: "Variablen & Typen" },
      { id: "3", label: "Operatoren" },
      { id: "4", label: "Kontrollfluss" },
      { id: "5", label: "Funktionen" },
      { id: "6", label: "Fehler & Debug" },
      { id: "7", label: "Arrays" }
    ];

    const p = loadProgress();
    function modPct(m) {
      const fcPct = m.flashcardsTotal ? (m.flashcardsKnown || 0) / m.flashcardsTotal : 0;
      let d = 0; if (m.theoryDone) d++; if (m.quizDone) d++;
      return Math.round(((d + fcPct) / 3) * 100);
    }
    let sumPct = 0;
    const modHTML = modules.map(mod => {
      const m = p.modules[mod.id] || {};
      const pct = modPct(m);
      sumPct += pct;
      const active = current === ("modul-" + mod.id) ? " active" : "";
      const done = pct >= 100 ? " done" : "";
      return `
        <a class="sb-link${active}${done}" href="modul-${mod.id}.html">
          <span class="sb-icon">${mod.id}</span>
          <span class="sb-label">${mod.label}</span>
          <span class="sb-pct">${pct}%</span>
        </a>`;
    }).join("");
    const overall = Math.round(sumPct / modules.length);

    const sb = document.createElement("aside");
    sb.className = "sidebar";
    sb.innerHTML = `
      <div class="sb-brand">
        <div class="sb-brand-logo">JS</div>
        <div class="sb-brand-text">
          <div class="t1">JSE Lern-App</div>
          <div class="t2">JavaScript Essentials 1</div>
        </div>
      </div>

      <div class="sb-switcher">
        <a href="index.html" class="active">JavaScript</a>
        <a href="pcep/index.html">Python</a>
      </div>

      <a class="sb-link${current === "home" ? " active" : ""}" href="index.html">
        <span class="sb-icon">⌂</span>
        <span class="sb-label">Dashboard</span>
      </a>

      <div class="sb-section-label">Lernpfad</div>
      ${modHTML}

      <div class="sb-section-label">Prüfen</div>
      <a class="sb-link sb-exam${current === "exam" ? " active" : ""}" href="pruefung.html">
        <span class="sb-icon">★</span>
        <span class="sb-label">Prüfungssimulation</span>
      </a>

      <div class="sb-footer">
        <div class="sb-overall">
          <div class="lbl">Gesamtfortschritt</div>
          <div class="val">${overall}%</div>
          <div class="progress-bar"><div class="progress-fill" style="width:${overall}%"></div></div>
        </div>
        <a href="#" data-action="reset-progress">↺ Fortschritt zurücksetzen</a>
      </div>
    `;

    const backdrop = document.createElement("div");
    backdrop.className = "sb-backdrop";
    backdrop.addEventListener("click", () => document.body.classList.remove("sb-open"));

    const burger = document.createElement("button");
    burger.className = "sb-burger";
    burger.setAttribute("aria-label", "Menü");
    burger.textContent = "☰";
    burger.addEventListener("click", (e) => {
      e.stopPropagation();
      document.body.classList.toggle("sb-open");
    });

    document.body.insertBefore(sb, document.body.firstChild);
    document.body.insertBefore(backdrop, document.body.firstChild);
    document.body.appendChild(burger);

    sb.querySelector('[data-action="reset-progress"]').addEventListener("click", (e) => {
      e.preventDefault();
      if (confirm("JSE-Fortschritt löschen? (Python-Fortschritt bleibt erhalten)")) {
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
      }
    });

    // Close sidebar on link click (mobile)
    sb.querySelectorAll(".sb-link").forEach(a => {
      a.addEventListener("click", () => document.body.classList.remove("sb-open"));
    });
  }

  // ---- Init ----------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    injectSidebar();
    initTabs();
    highlightAll();
    initTheoryMark();
    renderDashboard();
  });

  // ---- Export --------------------------------------------
  window.JSE = {
    initFlashcards,
    initQuiz,
    initPlaygrounds,
    initExam,
    highlight: highlightAll,
    renderDashboard
  };
})();
