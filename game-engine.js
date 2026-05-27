(function () {
  /* ── State ─────────────────────────────────── */
  const LS_KEY_ROLE = 'aeg-role';
  const LS_KEY_SCORES = 'aeg-scores';
  const LS_KEY_COMPLETED = 'aeg-completed';
  const LS_KEY_REFLECTIONS = 'aeg-reflections';
  const defaultScores = { ethics: 0, law: 0, judgment: 0, empathy: 0 };

  const GF_FORM_ID = '1FAIpQLScOx88fV2wGgoe5UmoRLenL40FbaSuur-zY4BMDIFp-6beDVg';
  const GF_ENTRIES = {
    scenario: 'entry.715082397',
    role: 'entry.664643676',
    ethics: 'entry.1599333729',
    law: 'entry.1103992364',
    judgment: 'entry.366727594',
    empathy: 'entry.1657153655',
    reflection: 'entry.169908853'
  };

  const State = {
    getRole() { return localStorage.getItem('aeg-role') || ''; },
    setRole(r) { localStorage.setItem('aeg-role', r); },
    getScores() {
      try { return JSON.parse(localStorage.getItem('aeg-scores')) || { ...defaultScores }; }
      catch { return { ...defaultScores }; }
    },
    setScores(s) { localStorage.setItem('aeg-scores', JSON.stringify(s)); },
    updateScores(delta) {
      const cur = this.getScores();
      for (const k of Object.keys(defaultScores)) {
        cur[k] = Math.max(-100, Math.min(100, (cur[k] || 0) + (delta[k] || 0)));
      }
      this.setScores(cur);
      return cur;
    },
    getCompleted() {
      try { return JSON.parse(localStorage.getItem('aeg-completed')) || []; }
      catch { return []; }
    },
    addCompleted(id) {
      const list = this.getCompleted();
      if (!list.includes(id)) { list.push(id); }
      localStorage.setItem('aeg-completed', JSON.stringify(list));
    },
    getReflections() {
      try { return JSON.parse(localStorage.getItem('aeg-reflections')) || {}; }
      catch { return {}; }
    },
    saveReflection(scenarioId, text) {
      const all = this.getReflections();
      all[scenarioId] = { text, timestamp: new Date().toISOString() };
      localStorage.setItem('aeg-reflections', JSON.stringify(all));
    }
  };

  /* ── Helper: build score display string ────── */
  function scoreStr(scores) {
    return `倫理 ${scores.ethics}  法規 ${scores.law}  判斷 ${scores.judgment}  同理心 ${scores.empathy}`;
  }

  /* ── Helper: animate score change ─────────── */
  function animateScore(delta) {
    const el = document.getElementById('score-display');
    if (!el) return;
    const s = State.getScores();
    el.textContent = scoreStr(s);
    let parts = [];
    const labelMap = { ethics: '倫理', law: '法規', judgment: '判斷', empathy: '同理心' };
    for (const k of Object.keys(delta)) {
      const v = delta[k];
      if (v !== 0) { parts.push(`${labelMap[k]} ${v > 0 ? '+' : ''}${v}`); }
    }
    if (parts.length === 0) return;
    const flash = document.createElement('span');
    flash.className = 'score-flash';
    flash.textContent = parts.join('  ');
    el.appendChild(flash);
    setTimeout(() => flash.remove(), 2000);
  }

  /* ── Dialogue System ───────────────────────── */
  let dialogueIdx = 0;
  let dialogueQueue = [];
  let dialogueCallback = null;

  function renderDialogue() {
    const box = document.getElementById('dialogue-box');
    if (!box) return;
    if (dialogueIdx >= dialogueQueue.length) {
      box.innerHTML = '';
      if (dialogueCallback) dialogueCallback();
      return;
    }
    const d = dialogueQueue[dialogueIdx];
    box.innerHTML = `
      <div class="dialogue-entry" style="animation: fadeIn 0.3s ease">
        <span class="speaker-label ${d.speaker === '旁白' ? 'narrator' : ''}">${d.speaker}</span>
        <p class="speaker-text">${d.text}</p>
      </div>
      <button class="btn-continue" onclick="window.__nextDialogue()">繼續 ▸</button>
    `;
  }

  window.__nextDialogue = function () {
    dialogueIdx++;
    renderDialogue();
  };

  function startDialogue(dialogues, cb) {
    dialogueIdx = 0;
    dialogueQueue = dialogues;
    dialogueCallback = cb || null;
    renderDialogue();
    // hide choices & other sections
    document.getElementById('choice-stage1')?.classList.add('hidden');
    document.getElementById('choice-stage2')?.classList.add('hidden');
    document.getElementById('result-area')?.classList.add('hidden');
    document.getElementById('reflection-area')?.classList.add('hidden');
    document.getElementById('real-world')?.classList.add('hidden');
    document.getElementById('next-area')?.classList.add('hidden');
  }

  /* ── Choice System ─────────────────────────── */
  let choiceData = [];
  let currentStage1 = null;

  function renderStage1() {
    const container = document.getElementById('choice-stage1');
    if (!container) return;
    container.classList.remove('hidden');
    document.getElementById('choice-stage2')?.classList.add('hidden');
    let html = '<h3 class="section-title">你怎麼回應？</h3><div class="choices-grid">';
    choiceData.forEach((c, i) => {
      html += `<button class="choice-btn stage1-btn" data-idx="${i}">${c.stage1}</button>`;
    });
    html += '</div>';
    container.innerHTML = html;
    container.querySelectorAll('.stage1-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        currentStage1 = parseInt(this.dataset.idx);
        renderStage2(currentStage1);
      });
    });
  }

  function renderStage2(idx) {
    const container = document.getElementById('choice-stage2');
    if (!container) return;
    container.classList.remove('hidden');
    const items = choiceData[idx].stage2;
    let html = `<h3 class="section-title">詳細選擇</h3><div class="choices-grid">`;
    items.forEach((item, i) => {
      html += `<button class="choice-btn stage2-btn" data-parent="${idx}" data-idx="${i}">${item.label}</button>`;
    });
    html += '</div>';
    container.innerHTML = html;
    container.querySelectorAll('.stage2-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const p = parseInt(this.dataset.parent);
        const i = parseInt(this.dataset.idx);
        const chosen = choiceData[p].stage2[i];
        showResult(chosen, p, i);
      });
    });
  }

  function showResult(chosen, parentIdx, childIdx) {
    // Update scores
    const scores = State.updateScores(chosen.scores);
    animateScore(chosen.scores);
    State.addCompleted(document.getElementById('app').dataset.scenario);

    // Show result
    document.getElementById('choice-stage1')?.classList.add('hidden');
    document.getElementById('choice-stage2')?.classList.add('hidden');
    const resultEl = document.getElementById('result-area');
    if (resultEl) {
      resultEl.classList.remove('hidden');
      resultEl.innerHTML = `
        <h3 class="section-title">選擇結果</h3>
        <div class="result-card" style="animation: fadeIn 0.4s ease">
          <p class="result-text">${chosen.result}</p>
          <div class="score-delta">
            ${Object.entries(chosen.scores).filter(([,v]) => v !== 0).map(([k, v]) => {
              const label = { ethics: '倫理', law: '法規', judgment: '判斷', empathy: '同理心' }[k];
              return `<span class="delta ${v > 0 ? 'positive' : 'negative'}">${label} ${v > 0 ? '+' : ''}${v}</span>`;
            }).join('')}
          </div>
        </div>
        <button class="btn-primary" onclick="window.__showRealWorld()">繼續 ▸</button>
      `;
    }
  }

  window.__showRealWorld = function () {
    document.getElementById('result-area')?.classList.add('hidden');
    const rw = document.getElementById('real-world');
    if (rw) {
      rw.classList.remove('hidden');
      rw.scrollIntoView({ behavior: 'smooth' });
    }
    // also show reflection
    document.getElementById('reflection-area')?.classList.remove('hidden');
    document.getElementById('next-area')?.classList.remove('hidden');
  };

  /* ── Submit to Google Form via hidden POST ── */
  function submitToGoogleForm(scenarioId, reflectionText) {
    const scores = State.getScores();
    const role = State.getRole();
    const entries = [
      GF_ENTRIES.scenario, GF_ENTRIES.role, GF_ENTRIES.ethics,
      GF_ENTRIES.law, GF_ENTRIES.judgment, GF_ENTRIES.empathy, GF_ENTRIES.reflection
    ];
    const values = [
      scenarioId, role, String(scores.ethics),
      String(scores.law), String(scores.judgment), String(scores.empathy),
      reflectionText
    ];
    const form = document.createElement('form');
    form.action = `https://docs.google.com/forms/d/e/${GF_FORM_ID}/formResponse`;
    form.method = 'POST';
    form.target = 'gform-hidden-frame';
    form.style.display = 'none';
    [0,1,2,3,4,5,6].forEach(i => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = entries[i];
      input.value = values[i];
      form.appendChild(input);
    });
    let iframe = document.getElementById('gform-hidden-frame');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'gform-hidden-frame';
      iframe.name = 'gform-hidden-frame';
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
    }
    document.body.appendChild(form);
    form.submit();
    setTimeout(() => form.remove(), 1000);
    return true;
  }

  /* ── Reflection System ─────────────────────── */
  function initReflection(scenarioId) {
    const refArea = document.getElementById('reflection-area');
    if (!refArea) return;
    refArea.innerHTML = `
      <h3 class="section-title">你的反省</h3>
      <p class="reflection-prompt">這個情境讓你學到了什麼？你未來會如何面對類似的倫理抉擇？</p>
      <textarea id="reflection-input" rows="4" placeholder="寫下你的想法⋯⋯"></textarea>
      <button id="btn-submit-reflection" class="btn-primary">📤 提交反省</button>
      <span id="reflection-status" class="reflection-status"></span>
    `;
    document.getElementById('btn-submit-reflection')?.addEventListener('click', function () {
      const text = document.getElementById('reflection-input')?.value?.trim();
      if (!text) { showReflectionStatus('請先寫下你的反省', 'error'); return; }
      State.saveReflection(scenarioId, text);
      submitToGoogleForm(scenarioId, text);
      showReflectionStatus('已提交到 Google 表單 ✅（同時已存於本機）', 'success');
    });
  }

  function showReflectionStatus(msg, type) {
    const el = document.getElementById('reflection-status');
    if (el) { el.textContent = msg; el.className = 'reflection-status ' + type; }
  }

  /* ── Initialize Scenario ───────────────────── */
  function initScenario(data) {
    const app = document.getElementById('app');
    if (!app) return;
    app.dataset.scenario = data.id;

    // Set role (from index or override)
    const role = State.getRole();
    if (!role && data.role) { State.setRole(data.role); }

    // Build header
    document.getElementById('scenario-id').textContent = data.id;
    document.getElementById('difficulty').textContent = data.difficulty;
    const roleNames = { student: '學生', teacher: '老師', admin: '行政' };
    document.getElementById('role-badge').textContent = roleNames[data.role] || data.role;
    updateScoreDisplay();

    // News sources
    const newsEl = document.getElementById('news-sources');
    if (newsEl && data.newsSource) {
      newsEl.innerHTML = '📰 新聞來源：' + data.newsSource.map(s =>
        `<a href="${s.url}" target="_blank" rel="noopener">${s.name}</a>`
      ).join(' | ');
    }

    // Setting
    const settingEl = document.getElementById('scene-setting');
    if (settingEl) {
      settingEl.innerHTML = `<p>${data.setting}</p>`;
    }

    // Navigation: back link
    const homeLink = document.getElementById('home-link');
    if (homeLink) { homeLink.href = '../../index.html'; }

    // Real world outcome
    const rw = document.getElementById('real-world-content');
    if (rw && data.realWorldOutcome) {
      rw.textContent = data.realWorldOutcome;
    }

    // Choices
    choiceData = data.choices;

    // Start dialogue
    startDialogue(data.dialogues, function () {
      renderStage1();
    });

    // Init reflection
    initReflection(data.id);
  }

  function updateScoreDisplay() {
    const el = document.getElementById('score-display');
    if (el) { el.textContent = scoreStr(State.getScores()); }
  }

  /* ── Expose ────────────────────────────────── */
  window.AEG = {
    State,
    initScenario,
    startDialogue,
    updateScoreDisplay,
    scoreStr
  };
})();
