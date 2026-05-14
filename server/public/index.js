  // ── State ────────────────────────────────────────────────────────────────────
      let es = null;
      let cfg = {};
      let activeTab = "log";

      const STEP_LABELS = {
        fetchHtml: "🌐 Fetch HTML",
        chapters: "📋 Chapters",
        scrape: "⬇️ Scrape",
        compress: "🗜️ Compress",
        epub: "📚 EPUB",
        "epub:webtoon": "📜 Webtoon",
        cbz: "📦 CBZ",
      };

      // ── Notifications ────────────────────────────────────────────────────────────
      function notify(title, body) {
        if (Notification.permission === "granted") {
          new Notification(title, { body, icon: "/img/background.jpeg" });
        }
      }

      // ── Init ─────────────────────────────────────────────────────────────────────
      (async () => {
        await loadConfig();
        connectSSE();
        loadFiles();
        if (Notification.permission === "default") Notification.requestPermission();
      })();

      // ── Config ───────────────────────────────────────────────────────────────────
      async function loadConfig() {
        const res = await fetch("/api/config");
        cfg = await res.json();
        fillForm(cfg);
      }

      function fillForm(c) {
        set("manga.title", c.manga?.title ?? "");
        set("manga.author", c.manga?.author ?? "");
        set("manga.language", c.manga?.language ?? "vi");
        set("manga.indexUrl", c.manga?.indexUrl ?? "");
        syncUrl(c.manga?.indexUrl ?? "");

        set("scrape.from", c.scrape?.from ?? 1);
        set("scrape.limit", c.scrape?.limit ?? "");
        set("scrape.concurrency", c.scrape?.concurrency ?? 1);
        set("scrape.outputDir", c.scrape?.outputDir ?? "output");
        set("scrape.imgSelector", c.scrape?.imgSelector ?? ".page-chapter img");
        set("scrape.referer", c.scrape?.referer ?? "");
        set("scrape.scroll.distance", c.scrape?.scroll?.distance ?? 400);
        set("scrape.scroll.delay", c.scrape?.scroll?.delay ?? 100);
        set("scrape.waitAfterLoad", c.scrape?.waitAfterLoad ?? 2000);
        set("scrape.waitAfterScroll", c.scrape?.waitAfterScroll ?? 1500);
        set(
          "scrape.waitBetweenChapters",
          c.scrape?.waitBetweenChapters ?? 1000,
        );
        document.getElementById("scrape.headless").checked =
          c.scrape?.headless ?? true;
        const urlCount = (c.scrape?.urls ?? []).length;
        document.querySelector("#urlsBadge span").textContent = urlCount;

        set("epub.outputFile", c.epub?.outputFile ?? "manga.epub");
        set("epub.inputDir", c.epub?.inputDir ?? "");

        set("compress.quality", c.compress?.quality ?? 80);
        set("compress.maxWidth", c.compress?.maxWidth ?? "");
        set("compress.concurrency", c.compress?.concurrency ?? 4);
        set("compress.outputDir", c.compress?.outputDir ?? "output-compress");
        document.getElementById("qualityVal").textContent =
          c.compress?.quality ?? 80;

        renderSections(c.epub?.sections ?? []);
      }

      function collectConfig() {
        const c = JSON.parse(JSON.stringify(cfg)); // deep clone to preserve scrape.urls

        c.manga.title = get("manga.title");
        c.manga.author = get("manga.author");
        c.manga.language = get("manga.language");
        c.manga.indexUrl = get("manga.indexUrl");

        c.scrape.from = int("scrape.from", 1);
        c.scrape.limit = intOrNull("scrape.limit");
        c.scrape.concurrency = int("scrape.concurrency", 1);
        c.scrape.outputDir = get("scrape.outputDir");
        c.scrape.imgSelector = get("scrape.imgSelector");
        c.scrape.referer = get("scrape.referer");
        c.scrape.scroll = {
          distance: int("scrape.scroll.distance", 400),
          delay: int("scrape.scroll.delay", 100),
        };
        c.scrape.waitAfterLoad = int("scrape.waitAfterLoad", 2000);
        c.scrape.waitAfterScroll = int("scrape.waitAfterScroll", 1500);
        c.scrape.waitBetweenChapters = int("scrape.waitBetweenChapters", 1000);
        c.scrape.headless = document.getElementById("scrape.headless").checked;

        c.epub.outputFile = get("epub.outputFile");
        c.epub.inputDir = get("epub.inputDir") || null;
        c.epub.sections = getSections();

        c.compress = c.compress ?? {};
        c.compress.quality = int("compress.quality", 80);
        c.compress.maxWidth = intOrNull("compress.maxWidth");
        c.compress.concurrency = int("compress.concurrency", 4);
        c.compress.outputDir = get("compress.outputDir");

        return c;
      }

      async function saveConfig() {
        cfg = collectConfig();
        await fetch("/api/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cfg),
        });
        flashBtn(event.target, "✓ Saved");
      }

      // ── Sections ─────────────────────────────────────────────────────────────────
      function renderSections(sections) {
        const tbody = document.getElementById("sectionsBody");
        tbody.innerHTML = "";
        (sections ?? []).forEach((s) => addSectionRow(s.name, s.from, s.to));
      }

      function addSection() {
        addSectionRow("", 1, 50);
      }

      function addSectionRow(name = "", from = 1, to = 50) {
        const tbody = document.getElementById("sectionsBody");
        const tr = document.createElement("tr");
        tr.innerHTML = `
    <td><input type="text" value="${esc(name)}" placeholder="Vol 1.epub" /></td>
    <td><input type="number" value="${from}" min="1" /></td>
    <td><input type="number" value="${to}"   min="1" /></td>
    <td><button class="del-btn" onclick="this.closest('tr').remove()">×</button></td>`;
        tbody.appendChild(tr);
      }

      function getSections() {
        const rows = document.querySelectorAll("#sectionsBody tr");
        const sections = [];
        rows.forEach((tr) => {
          const [nameEl, fromEl, toEl] = tr.querySelectorAll("input");
          if (nameEl.value.trim())
            sections.push({
              name: nameEl.value.trim(),
              from: +fromEl.value,
              to: +toEl.value,
            });
        });
        return sections.length ? sections : null;
      }

      // ── Run / Stop ────────────────────────────────────────────────────────────────
      function syncUrl(val) {
        const qi = document.getElementById("quickUrl");
        const ci = document.getElementById("manga.indexUrl");
        if (document.activeElement !== qi) qi.value = val;
        if (document.activeElement !== ci) ci.value = val;
      }

      document.getElementById("quickUrl").addEventListener("input", (e) => {
        document.getElementById("manga.indexUrl").value = e.target.value;
      });
      document
        .getElementById("manga.indexUrl")
        .addEventListener("input", (e) => {
          document.getElementById("quickUrl").value = e.target.value;
        });

      async function quickRun(steps) {
        const url = document.getElementById("quickUrl").value.trim();
        if (!url) {
          alert("Please enter a chapter list URL first.");
          return;
        }
        const c = collectConfig();
        c.manga.indexUrl = url;
        await doRun(steps, c);
      }

      async function run(steps) {
        await doRun(steps, collectConfig());
      }

      async function doRun(steps, config) {
        clearLog();
        setStepPills(steps);
        const res = await fetch("/api/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config, steps }),
        });
        if (!res.ok) {
          const { error } = await res.json();
          alert(error);
        }
      }

      async function stop() {
        await fetch("/api/stop", { method: "POST" });
      }

      // ── SSE ───────────────────────────────────────────────────────────────────────
      function connectSSE() {
        if (es) es.close();
        es = new EventSource("/api/log");
        es.onopen = () => {
          document.getElementById("dot").className = "dot connected";
        };
        es.onerror = () => {
          document.getElementById("dot").className = "dot error";
        };
        es.onmessage = (e) => handleEvent(JSON.parse(e.data));
      }

      function handleEvent(d) {
        if (d.t === "log") {
          appendLog(d.text, d.level);
        } else if (d.t === "progress") {
          setProgress(d.done, d.total);
        } else if (d.t === "step") {
          markStep(d.i, "active");
          appendLog(`\n── ${STEP_LABELS[d.step] ?? d.step} ──\n`, "step");
        } else if (d.t === "status") {
          setStatus(d.status, d.steps, d.step);
        }
      }

      // ── UI helpers ────────────────────────────────────────────────────────────────
      function setStatus(status, steps, stepIdx) {
        const badge = document.getElementById("statusBadge");
        const stopBtn = document.getElementById("stopBtn");
        const running = status === "running";
        stopBtn.disabled = !running;

        const labels = {
          running: "Running",
          done: "Done",
          error: "Error",
          stopped: "Stopped",
          idle: "Idle",
        };
        badge.className = `status-badge ${status}`;
        badge.innerHTML = running
          ? `<div class="spinner"></div> ${labels[status]}`
          : (labels[status] ?? status);

        if (status === "done") {
          markStep(steps?.length - 1, "done");
          loadFiles();
          notify("✅ Done!", "All steps completed successfully.");
        }
        if (status === "error") {
          markStep(stepIdx, "error");
          notify("❌ Error", "Job failed. Check the log for details.");
        }
        if (status === "stopped") markStep(stepIdx, "stopped");
      }

      function setStepPills(steps) {
        const el = document.getElementById("steps");
        el.innerHTML = steps
          .map(
            (s, i) =>
              `<div class="step-pill" id="pill-${i}">${STEP_LABELS[s] ?? s}</div>`,
          )
          .join("");
        setProgress(0, 0);
      }

      function markStep(i, cls) {
        document.querySelectorAll(".step-pill").forEach((el, idx) => {
          if (idx < i) el.className = "step-pill done";
          if (idx === i) el.className = `step-pill ${cls}`;
        });
      }

      function setProgress(done, total) {
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        document.getElementById("progressFill").style.width = pct + "%";
        document.getElementById("progressText").textContent =
          total > 0 ? `${done} / ${total}  (${pct}%)` : "";
      }

      // ── Log ───────────────────────────────────────────────────────────────────────
      const MAX_LINES = 3000;

      function appendLog(text, level) {
        const box = document.getElementById("logBox");
        const empty = box.querySelector(".log-empty");
        if (empty) empty.remove();

        const cls =
          level === "step"
            ? "step"
            : level === "warn"
              ? "warn"
              : /✅/.test(text)
                ? "ok"
                : /❌/.test(text)
                  ? "err"
                  : /⚠️/.test(text)
                    ? "warn"
                    : "info";

        const div = document.createElement("div");
        div.className = `log-line ${cls}`;
        div.textContent = text.replace(/\r/g, "");
        box.appendChild(div);

        while (box.children.length > MAX_LINES) box.removeChild(box.firstChild);

        if (document.getElementById("autoScroll").checked) {
          box.scrollTop = box.scrollHeight;
        }
      }

      function clearLog() {
        const box = document.getElementById("logBox");
        box.innerHTML = '<div class="log-empty">Waiting for output…</div>';
        setProgress(0, 0);
        document.getElementById("steps").innerHTML =
          '<span class="step-pill">—</span>';
      }

      // ── Tabs ─────────────────────────────────────────────────────────────────────
      function switchTab(tab) {
        activeTab = tab;
        document.getElementById("panelLog").style.display =
          tab === "log" ? "flex" : "none";
        document.getElementById("panelFiles").style.display =
          tab === "files" ? "block" : "none";
        document
          .getElementById("tabBtnLog")
          .classList.toggle("active", tab === "log");
        document
          .getElementById("tabBtnFiles")
          .classList.toggle("active", tab === "files");
        if (tab === "files") loadFiles();
      }

      // ── Files ─────────────────────────────────────────────────────────────────────
      async function loadFiles() {
        const el = document.getElementById("filesContent");
        el.innerHTML = '<div class="files-empty">Loading…</div>';
        try {
          const res = await fetch("/api/files");
          const files = await res.json();
          renderFiles(files);
        } catch {
          el.innerHTML = '<div class="files-empty">Failed to load files.</div>';
        }
      }

      function renderFiles(files) {
        const epubs = files.filter((f) => f.type === "epub");
        const cbzs = files.filter((f) => f.type === "cbz");
        const el = document.getElementById("filesContent");

        if (!files.length) {
          el.innerHTML =
            '<div class="files-empty">No output files yet. Run a pipeline first.</div>';
          return;
        }

        let html = "";

        if (epubs.length) {
          html += '<div class="files-group-title">📚 EPUBs</div>';
          html += epubs
            .map(
              (f) => `
      <div class="file-row">
        <span class="file-icon">📗</span>
        <span class="file-name" title="${esc(f.name)}">${esc(f.name)}</span>
        <span class="file-size">${fmtSize(f.size)}</span>
      </div>`,
            )
            .join("");
        }

        if (cbzs.length) {
          html += '<div class="files-group-title">📦 CBZs</div>';
          html += cbzs
            .map(
              (f) => `
      <div class="file-row">
        <span class="file-icon">📦</span>
        <span class="file-name" title="${esc(f.name)}">${esc(f.name)}</span>
        <span class="file-size">${fmtSize(f.size)}</span>
        <a href="/reader.html" target="_blank" class="btn-secondary file-open" title="Open in reader">📖</a>
      </div>`,
            )
            .join("");
        }

        el.innerHTML = html;
      }

      function fmtSize(b) {
        return b > 1e6
          ? (b / 1e6).toFixed(1) + " MB"
          : (b / 1024).toFixed(0) + " KB";
      }

      // ── Util ──────────────────────────────────────────────────────────────────────
      const get = (id) => (document.getElementById(id)?.value ?? "").trim();
      const set = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.value = v ?? "";
      };
      const int = (id, def) => parseInt(get(id)) || def;
      const intOrNull = (id) => {
        const v = parseInt(get(id));
        return isNaN(v) ? null : v;
      };
      const esc = (s) => String(s).replace(/"/g, "&quot;");

      async function flashBtn(btn, msg) {
        const orig = btn.textContent;
        btn.textContent = msg;
        await new Promise((r) => setTimeout(r, 1500));
        btn.textContent = orig;
      }

      // ── URL Modal ─────────────────────────────────────────────────────────────────
      function openUrlModal() {
        const urls = cfg.scrape?.urls ?? [];
        const area = document.getElementById("urlListArea");
        area.value = urls.join("\n");
        document.getElementById("addUrlsArea").value = "";
        updateUrlCount(urls.length);
        document.getElementById("urlModal").classList.remove("hidden");
        area.addEventListener("input", () =>
          updateUrlCount(parseUrls(area.value).length),
        );
      }

      function closeUrlModal() {
        document.getElementById("urlModal").classList.add("hidden");
      }

      function clearAllUrls() {
        document.getElementById("urlListArea").value = "";
        updateUrlCount(0);
      }

      function updateUrlCount(n) {
        document.getElementById("urlModalCount").textContent = `${n} URLs`;
      }

      function parseUrls(text) {
        return text
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.startsWith("http"));
      }

      async function saveUrls() {
        const existing = parseUrls(
          document.getElementById("urlListArea").value,
        );
        const added = parseUrls(document.getElementById("addUrlsArea").value);
        const merged = [...new Set([...existing, ...added])];

        cfg.scrape = cfg.scrape ?? {};
        cfg.scrape.urls = merged;

        await fetch("/api/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cfg),
        });

        document.querySelector("#urlsBadge span").textContent = merged.length;
        closeUrlModal();
      }

      // close modal on overlay click
      document
        .getElementById("urlModal")
        .addEventListener("click", function (e) {
          if (e.target === this) closeUrlModal();
        });

      // close on Escape
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeUrlModal();
      });