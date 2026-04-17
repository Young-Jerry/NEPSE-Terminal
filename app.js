/**
 * NEPSE Terminal v4 — App Shell
 * SPA router, sidebar nav, market clock, LTP handler, Update Data system
 */
(() => {
  // ── ROUTE CONFIG ─────────────────────────────────────────────────
  const ROUTES = {
    dashboard:  { title: 'Dashboard',      render: c => window._renderDashboard(c) },
    earnings:   { title: 'Earnings',       render: c => window._renderEarnings(c) },
    trades:     { title: 'Trades',         render: c => window._renderTrades(c) },
    longterm:   { title: 'Long-Term',      render: c => window._renderLongTerm(c) },
    sip:        { title: 'SIP System',     render: c => window._renderSip(c) },
    pasttrades: { title: 'Past Trades',    render: c => window._renderPastTrades(c) },
    cashledger: { title: 'Cash Ledger',    render: c => window._renderCashLedger(c) },
    calculator: { title: 'Calculator',     render: c => window._renderCalculator(c) },
    settings:   { title: 'Settings',       render: c => window._renderSettings(c) },
  };

  // Track which views have been rendered so Update Data can reset them
  const renderedViews = new Set();

  // ── DOM REFS ──────────────────────────────────────────────────────
  const sidebar          = document.getElementById('sidebar');
  const hamburger        = document.getElementById('hamburger');
  const pageTitle        = document.getElementById('pageTitle');
  const statusDot        = document.getElementById('statusDot');
  const statusLabel      = document.getElementById('statusLabel');
  const statusTime       = document.getElementById('statusTime');
  const headerCash       = document.getElementById('headerCash');
  const headerTargetValue = document.getElementById('headerTargetValue');
  const headerTargetFill = document.getElementById('headerTargetFill');
  const alertBar         = document.getElementById('alertBar');
  const alertText        = document.getElementById('alertText');
  const alertClose       = document.getElementById('alertClose');
  const ltpBtn           = document.getElementById('updateLtpBtn');
  const ltpInput         = document.getElementById('ltpFileInput');
  const downloadDataBtn  = document.getElementById('downloadDataBtn');
  const uploadDataBtn    = document.getElementById('uploadDataBtn');
  const dataFileInput    = document.getElementById('dataFileInput');
  const ltpStatus        = document.getElementById('ltpStatus');
  const privacyToggleBtn = document.getElementById('privacyToggleBtn');
  const rsToggleBtn      = document.getElementById('rsToggleBtn');
  const calcPopupBtn     = document.getElementById('calcPopupBtn');
  const calcFloat        = document.getElementById('calcFloat');

  // ── SIDEBAR OVERLAY ────────────────────────────────────────────────
  const backdrop = document.getElementById('sidebarBackdrop');
  function openSidebar(showBackdrop = true) {
    sidebar.classList.add('open');
    document.body.classList.add('sidebar-open');
    if (backdrop && showBackdrop && window.innerWidth < 900) backdrop.classList.add('visible');
  }

  if (hamburger) hamburger.style.display = 'none';
  if (backdrop) backdrop.style.display = 'none';
  openSidebar(false);


  // ── PRIVACY MODE ────────────────────────────────────────────────
  const PRIVACY_KEY = 'pms_privacy_mode_v1';
  const RS_PREFIX_KEY = 'pms_show_rs_prefix_v1';
  const THEME_KEY = 'pms_theme_v1';
  const SIP_DUE_DAY_KEY = 'pms_sip_due_day_v1';
  let privacyEnabled = localStorage.getItem(PRIVACY_KEY) === '1';
  let rsPrefixEnabled = localStorage.getItem(RS_PREFIX_KEY) !== '0';
  let currentTheme = 'dark';

  function maskDigits(text) {
    return String(text || '').replace(/\d/g, 'X');
  }

  function maskValue() {
    return 'XXX';
  }

  function maskStaticValues(root, enabled) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent) continue;
      const tag = parent.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEXTAREA') continue;
      if (parent.closest('input, textarea, [contenteditable="true"]')) continue;
      const text = (node.nodeValue || '').trim();
      if (!text) continue;
      if (enabled) {
        const shouldMask = /\d/.test(text);
        if (!shouldMask) continue;
        if (!parent.dataset.privateOriginal) parent.dataset.privateOriginal = node.nodeValue;
        node.nodeValue = 'XXX';
      } else if (parent.dataset.privateOriginal) {
        node.nodeValue = parent.dataset.privateOriginal;
        delete parent.dataset.privateOriginal;
      }
    }
  }

  function maskInlineInputs(root, enabled) {
    root.querySelectorAll('input.inline-edit, input.ltp-input').forEach((input) => {
      if (enabled) {
        input.dataset.realValue = input.value;
        input.value = maskValue();
        input.type = 'text';
        input.readOnly = true;
        input.classList.add('privacy-masked-input');
      } else if (input.dataset.realValue != null) {
        input.value = input.dataset.realValue;
        delete input.dataset.realValue;
        input.readOnly = false;
        input.classList.remove('privacy-masked-input');
      }
    });
  }

  function applyPrivacyMode() {
    document.body.classList.toggle('privacy-on', privacyEnabled);
    if (privacyToggleBtn) {
      privacyToggleBtn.textContent = privacyEnabled ? 'HIDDEN' : 'VISIBLE';
      privacyToggleBtn.classList.toggle('active', !privacyEnabled);
    }
    if (rsToggleBtn) {
      rsToggleBtn.textContent = rsPrefixEnabled ? '₹ ON' : '₹ OFF';
      rsToggleBtn.classList.toggle('active', rsPrefixEnabled);
    }
    maskInlineInputs(document, privacyEnabled);
    maskStaticValues(document.body, privacyEnabled);
  }

  function setPrivacyMode(next) {
    privacyEnabled = Boolean(next);
    localStorage.setItem(PRIVACY_KEY, privacyEnabled ? '1' : '0');
    applyPrivacyMode();
    updateCashDisplay();
    updateHeaderTargetProgress();
    window.dispatchEvent(new CustomEvent('pms-privacy-changed', { detail: { enabled: privacyEnabled } }));
    if (currentView && ROUTES[currentView]) {
      const container = document.getElementById(`view-${currentView}`);
      if (container) ROUTES[currentView].render(container);
    }
    applyPrivacyMode();
  }

  window.PmsPrivacy = {
    isEnabled: () => privacyEnabled,
    maskDigits,
    maskValue,
    apply: applyPrivacyMode,
    setEnabled: setPrivacyMode,
  };

  function setRsPrefixMode(next) {
    rsPrefixEnabled = Boolean(next);
    localStorage.setItem(RS_PREFIX_KEY, rsPrefixEnabled ? '1' : '0');
    applyPrivacyMode();
    updateCashDisplay();
    if (currentView && ROUTES[currentView]) {
      const container = document.getElementById(`view-${currentView}`);
      if (container) ROUTES[currentView].render(container);
    }
    applyPrivacyMode();
    updateHeaderTargetProgress();
    window.dispatchEvent(new CustomEvent('pms-rs-prefix-changed', { detail: { enabled: rsPrefixEnabled } }));
  }

  window.PmsDisplay = {
    showRsPrefix: () => rsPrefixEnabled,
    setRsPrefixEnabled: setRsPrefixMode,
  };

  window.PmsSettings = {
    getSipDueDay: () => {
      const day = Number(localStorage.getItem(SIP_DUE_DAY_KEY));
      return Number.isInteger(day) && day >= 1 && day <= 28 ? day : null;
    },
    setSipDueDay: (day) => {
      if (day == null || day === '') {
        localStorage.removeItem(SIP_DUE_DAY_KEY);
      } else {
        const parsed = Math.floor(Number(day));
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > 28) throw new Error('Due day must be between 1 and 28.');
        localStorage.setItem(SIP_DUE_DAY_KEY, String(parsed));
      }
      window.dispatchEvent(new CustomEvent('pms-sip-due-day-changed'));
    },
  };

  if (privacyToggleBtn) privacyToggleBtn.addEventListener('click', () => setPrivacyMode(!privacyEnabled));
  if (rsToggleBtn) rsToggleBtn.addEventListener('click', () => setRsPrefixMode(!rsPrefixEnabled));

  function applyTheme(theme) {
    currentTheme = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem(THEME_KEY, currentTheme);
  }
  localStorage.setItem(THEME_KEY, 'dark');
  applyTheme(currentTheme);

  // ── FLOATING CALCULATOR ─────────────────────────────────────────
  const QUICK_CALC_HISTORY_KEY = 'pms_quick_calc_history_v1';

  function readQuickCalcHistory() {
    try {
      const parsed = JSON.parse(localStorage.getItem(QUICK_CALC_HISTORY_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeQuickCalcHistory(entries) {
    localStorage.setItem(QUICK_CALC_HISTORY_KEY, JSON.stringify(entries.slice(0, 3)));
  }

  function mountQuickCalculator() {
    if (!calcFloat) return;
    calcFloat.innerHTML = `
      <div class="calc-float-header" id="calcFloatHeader">
        <span>Quick Calculator</span>
        <button class="calc-float-close" id="calcFloatClose" aria-label="Close calculator">✕</button>
      </div>
      <div class="calc-float-body" id="calcFloatBody">
        <div class="quick-calc-wrap">
          <input class="form-input quick-calc-input mono" id="quickCalcInput" placeholder="Type or paste expression e.g. (1200+345)/3" />
          <div class="quick-calc-actions">
            <button class="btn-primary" id="quickCalcEvalBtn" type="button">= Evaluate</button>
            <button class="btn-secondary" id="quickCalcClearBtn" type="button">Clear</button>
          </div>
          <div class="quick-calc-result mono" id="quickCalcResult">Result: -</div>
          <div class="quick-calc-pad" id="quickCalcPad">
            <button type="button" data-token="7">7</button><button type="button" data-token="8">8</button><button type="button" data-token="9">9</button><button type="button" data-token="/">÷</button><button type="button" data-token="%">%</button>
            <button type="button" data-token="4">4</button><button type="button" data-token="5">5</button><button type="button" data-token="6">6</button><button type="button" data-token="*">×</button><button type="button" data-token="(">(</button>
            <button type="button" data-token="1">1</button><button type="button" data-token="2">2</button><button type="button" data-token="3">3</button><button type="button" data-token="-">−</button><button type="button" data-token=")">)</button>
            <button type="button" data-token="0">0</button><button type="button" data-token=".">.</button><button type="button" data-token="+">+</button><button type="button" data-token="Backspace">⌫</button><button type="button" data-token="Enter">=</button>
          </div>
          <div class="quick-calc-history">
            <div class="quick-calc-history-title">Last 3 history</div>
            <ul id="quickCalcHistoryList"></ul>
          </div>
        </div>
      </div>
    `;

    const header = calcFloat.querySelector('#calcFloatHeader');
    const closeBtn = calcFloat.querySelector('#calcFloatClose');
    const input = calcFloat.querySelector('#quickCalcInput');
    const resultEl = calcFloat.querySelector('#quickCalcResult');
    const historyEl = calcFloat.querySelector('#quickCalcHistoryList');
    const pad = calcFloat.querySelector('#quickCalcPad');
    const evalBtn = calcFloat.querySelector('#quickCalcEvalBtn');
    const clearBtn = calcFloat.querySelector('#quickCalcClearBtn');
    function normalizeCalcInput(raw) {
      return String(raw || '').replace(/,/g, '');
    }

    function formatCalcInput(raw) {
      const clean = normalizeCalcInput(raw);
      if (!clean || /[+\-*/()%]/.test(clean)) return clean;
      if (!/^-?\d*\.?\d*$/.test(clean)) return clean;
      const [intPart, decPart] = clean.split('.');
      const sign = intPart.startsWith('-') ? '-' : '';
      const absInt = sign ? intPart.slice(1) : intPart;
      const grouped = absInt ? new Intl.NumberFormat('en-IN').format(Number(absInt)) : '0';
      return decPart != null ? `${sign}${grouped}.${decPart}` : `${sign}${grouped}`;
    }

    function renderHistory() {
      const history = readQuickCalcHistory();
      historyEl.innerHTML = history.length
        ? history.map(item => `<li><button type="button" class="quick-calc-history-item" data-expr="${escHtml(item.expr)}">${escHtml(item.expr)} = <strong>${escHtml(String(item.result))}</strong></button></li>`).join('')
        : '<li class="quick-calc-history-empty">No history yet.</li>';
      historyEl.querySelectorAll('.quick-calc-history-item').forEach((btn) => {
        btn.addEventListener('click', () => {
          input.value = btn.dataset.expr || '';
          input.focus();
        });
      });
    }

    function evaluateExpression(raw) {
      const normalized = normalizeCalcInput(String(raw || '').replace(/[×x]/g, '*').replace(/[÷]/g, '/')).trim();
      if (!normalized) return { ok: false, message: 'Result: -' };
      if (!/^[\d+\-*/%().\s]+$/.test(normalized)) return { ok: false, message: 'Result: Invalid expression' };
      try {
        const result = Function(`"use strict"; return (${normalized})`)();
        if (!Number.isFinite(result)) return { ok: false, message: 'Result: Invalid expression' };
        return { ok: true, result };
      } catch {
        return { ok: false, message: 'Result: Invalid expression' };
      }
    }

    function applyEvaluate() {
      const outcome = evaluateExpression(input.value);
      if (!outcome.ok) {
        resultEl.textContent = outcome.message;
        return;
      }
      const result = Number(outcome.result.toFixed(10));
      resultEl.textContent = `Result: ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 10 }).format(result)}`;
      const history = readQuickCalcHistory();
      history.unshift({ expr: normalizeCalcInput(input.value.trim()), result: new Intl.NumberFormat('en-IN', { maximumFractionDigits: 10 }).format(result) });
      writeQuickCalcHistory(history);
      renderHistory();
    }

    evalBtn.addEventListener('click', applyEvaluate);
    clearBtn.addEventListener('click', () => {
      input.value = '';
      resultEl.textContent = 'Result: -';
      input.focus();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyEvaluate();
      }
    });
    input.addEventListener('input', () => {
      const pos = input.selectionStart;
      input.value = formatCalcInput(input.value);
      if (typeof pos === 'number') input.setSelectionRange(Math.min(pos, input.value.length), Math.min(pos, input.value.length));
    });

    if (pad) {
      pad.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-token]');
        if (!btn) return;
        const token = btn.dataset.token;
        if (token === 'Enter') return applyEvaluate();
        if (token === 'Backspace') {
          input.value = input.value.slice(0, -1);
          input.focus();
          return;
        }
        input.value = formatCalcInput(input.value + token);
        input.focus();
      });
    }

    if (closeBtn) closeBtn.addEventListener('click', closeCalcFloat);
    renderHistory();
    makeFloatDraggable(calcFloat, header, closeBtn);
    setTimeout(() => { if (input) input.focus(); }, 40);
  }

  function makeFloatDraggable(floatEl, handleEl, closeBtnEl) {
    if (!floatEl || !handleEl) return;
    let dragActive = false;
    let startX = 0, startY = 0;
    let startLeft = 0, startTop = 0;
    handleEl.addEventListener('mousedown', (e) => {
      if (e.target === closeBtnEl) return;
      dragActive = true;
      const rect = floatEl.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      floatEl.style.left = `${rect.left}px`;
      floatEl.style.top = `${rect.top}px`;
      floatEl.style.right = 'auto';
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragActive) return;
      const nextLeft = Math.min(Math.max(8, startLeft + (e.clientX - startX)), window.innerWidth - floatEl.offsetWidth - 8);
      const nextTop = Math.min(Math.max(50, startTop + (e.clientY - startY)), window.innerHeight - floatEl.offsetHeight - 8);
      floatEl.style.left = `${nextLeft}px`;
      floatEl.style.top = `${nextTop}px`;
    });
    window.addEventListener('mouseup', () => { dragActive = false; });
  }

  function openCalcFloat() {
    if (!calcFloat) return;
    if (!calcFloat.innerHTML.trim()) mountQuickCalculator();
    syncQuickCalcHeight();
    calcFloat.classList.remove('hidden');
  }
  function closeCalcFloat() {
    if (!calcFloat) return;
    calcFloat.classList.add('hidden');
    calcFloat.innerHTML = '';
  }
  if (calcPopupBtn) calcPopupBtn.addEventListener('click', openCalcFloat);

  function syncQuickCalcHeight() {
    if (!calcFloat) return;
    const txCard = document.querySelector('#view-calculator .calc-transaction-card');
    const fallbackHeight = 430;
    const headerHeight = 42;
    const bodyHeight = txCard ? Math.round(txCard.getBoundingClientRect().height) : fallbackHeight;
    calcFloat.style.width = '336px';
    calcFloat.style.height = `${Math.max(280, bodyHeight + headerHeight)}px`;
  }

  // ── ROUTER ────────────────────────────────────────────────────────
  let currentView = null;

  function navigate(viewId) {
    const route = ROUTES[viewId];
    if (!route) return;

    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    const container = document.getElementById(`view-${viewId}`);
    if (!container) return;
    container.classList.remove('hidden');

    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewId);
    });

    pageTitle.textContent = route.title.toUpperCase();

    // Only render if not rendered yet (or if marked dirty by updateData)
    if (!renderedViews.has(viewId) || container._dirty) {
      route.render(container);
      renderedViews.add(viewId);
      container._dirty = false;
    }
    applyPrivacyMode();
    updateHeaderTargetProgress();

    currentView = viewId;

    if (window.AppState) window.AppState.dispatch({ type: 'NAVIGATE', payload: viewId });
  }

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.view));
  });

  // ── MARKET CLOCK ──────────────────────────────────────────────────
  window.startMarketClock(({ status, time, label }) => {
    statusDot.className       = `status-dot ${status}`;
    statusLabel.textContent   = label;
    statusTime.textContent    = time;
  });

  // ── CASH DISPLAY ──────────────────────────────────────────────────
  function updateCashDisplay() {
    if (window.PmsCapital) {
      const cash = window.PmsCapital.readCash();
      if (headerCash) {
        if (window.PmsPrivacy && window.PmsPrivacy.isEnabled && window.PmsPrivacy.isEnabled()) {
          headerCash.textContent = window.PmsPrivacy.maskValue();
          return;
        }
        headerCash.textContent = `Rs ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(cash)}`;
        if (window.PmsDisplay && !window.PmsDisplay.showRsPrefix()) {
          headerCash.textContent = `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(cash)}`;
        }
      }
    }
  }

  function updateHeaderTargetProgress() {
    if (!headerTargetValue || !headerTargetFill) return;
    const totals = window.Analytics ? window.Analytics.getPortfolioTotals() : { total: 0 };
    const targetWorth = 15000000;
    const cash = window.PmsCapital ? window.PmsCapital.readCash() : 0;
    const currentWorth = Number(totals.total || 0) + Math.max(0, Number(cash || 0));
    const completion = Math.max(0, Math.min(100, (currentWorth / targetWorth) * 100));
    headerTargetValue.textContent = (window.PmsPrivacy && window.PmsPrivacy.isEnabled && window.PmsPrivacy.isEnabled())
      ? maskValue()
      : `${completion.toFixed(2)}%`;
    headerTargetFill.style.width = `${completion.toFixed(2)}%`;
  }

  window.addEventListener('pms-cash-updated', updateCashDisplay);
  window.addEventListener('pms-cash-updated', updateHeaderTargetProgress);
  updateCashDisplay();
  updateHeaderTargetProgress();

  if (window.PmsProfitBook) window.PmsProfitBook.syncWithLedger();

  // ── ALERT SYSTEM ──────────────────────────────────────────────────
  let alertTimer = null;

  function showAlert(message, isSuccess) {
    alertText.textContent = message;
    alertBar.classList.remove('hidden');
    alertBar.style.borderColor = isSuccess ? 'var(--green)' : 'var(--red)';
    alertBar.style.color = isSuccess ? 'var(--green)' : 'var(--red)';
    clearTimeout(alertTimer);
    alertTimer = setTimeout(() => alertBar.classList.add('hidden'), 4000);
  }

  alertClose.addEventListener('click', () => alertBar.classList.add('hidden'));
  window.PmsCapital.showCashAlert = showAlert;

  // ── UPDATE LTP ────────────────────────────────────────────────────
  ltpBtn.addEventListener('click', () => ltpInput.click());
  ltpInput.addEventListener('change', async e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    ltpStatus.textContent = '⟳ …';
    try {
      const text  = await file.text();
      const count = window.LtpUpdater.processCSVText(text);
      ltpStatus.textContent = `✓ ${count}`;
      showAlert(`LTP updated: ${count} stocks`, true);
      setTimeout(() => { ltpStatus.textContent = ''; }, 4000);
    } catch (err) {
      ltpStatus.textContent = `✕`;
      showAlert(`LTP error: ${err.message}`, false);
      setTimeout(() => { ltpStatus.textContent = ''; }, 5000);
    } finally { e.target.value = ''; }
  });

  // ── DOWNLOAD / UPLOAD ─────────────────────────────────────────────
  downloadDataBtn.addEventListener('click', async () => {
    try {
      const password = await Modal.prompt({
        title: 'Export Encrypted CSV',
        subtitle: 'Create a backup password',
        label: 'Password',
        inputType: 'password',
        placeholder: 'Enter password',
        confirmText: 'Continue',
      });
      if (!password) return;
      const confirmPassword = await Modal.prompt({
        title: 'Confirm Password',
        subtitle: 'Re-enter backup password',
        label: 'Confirm password',
        inputType: 'password',
        placeholder: 'Enter password again',
        confirmText: 'Export',
      });
      if (password !== confirmPassword) {
        showAlert('Passwords do not match.', false);
        return;
      }
      const csvData = await window.PmsBackup.createEncryptedBackupCSV(password);
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `NEPSE-Backup-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      showAlert('Encrypted CSV backup exported.', true);
    } catch { showAlert('Export failed.', false); }
  });

  uploadDataBtn.addEventListener('click', () => dataFileInput.click());
  dataFileInput.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const password = await Modal.prompt({
        title: 'Import Encrypted CSV',
        subtitle: 'Enter backup password',
        label: 'Password',
        inputType: 'password',
        placeholder: 'Enter password',
        confirmText: 'Import',
      });
      if (!password) return;
      const text = await file.text();
      await window.PmsBackup.restoreEncryptedBackupCSV(text, password);
      showAlert('Data restored. Reloading…', true);
      setTimeout(() => location.reload(), 600);
    } catch (err) {
      showAlert(err && err.message === 'Access Denied' ? 'Access Denied' : 'Invalid backup file.', false);
    }
    finally { e.target.value = ''; }
  });

  // ── MIDDLE-MOUSE SCROLL ───────────────────────────────────────────
  function enableMiddleMouseScroll(scroller) {
    if (!scroller) return;
    let active = false, anchorY = 0, velocity = 0, frame = null;
    const tick = () => {
      if (!active) return;
      if (Math.abs(velocity) > 0.1) scroller.scrollBy({ top: velocity, behavior: 'auto' });
      frame = requestAnimationFrame(tick);
    };
    scroller.addEventListener('mousedown', e => {
      if (e.button !== 1) return;
      e.preventDefault();
      active = true; anchorY = e.clientY; velocity = 0;
      scroller.style.cursor = 'ns-resize';
      if (!frame) frame = requestAnimationFrame(tick);
    });
    window.addEventListener('mousemove', e => {
      if (!active) return;
      velocity = (e.clientY - anchorY) * 0.18;
    });
    const stop = () => {
      if (!active) return;
      active = false; velocity = 0; scroller.style.cursor = '';
      if (frame) cancelAnimationFrame(frame); frame = null;
    };
    window.addEventListener('mouseup', e => { if (e.button === 1) stop(); });
    window.addEventListener('keydown', e => { if (e.key === 'Escape') stop(); });
  }

  enableMiddleMouseScroll(document.querySelector('.view-container'));
  enableMiddleMouseScroll(document.getElementById('sidebar'));

  // ── LTP-updated: only refresh current view if it's dashboard ─────
  window.addEventListener('pms-ltp-updated', () => {
    updateCashDisplay();
    updateHeaderTargetProgress();
    // Mark non-current views dirty; re-render current immediately
    document.querySelectorAll('.view').forEach(v => { v._dirty = true; });
    renderedViews.clear();
    if (currentView && ROUTES[currentView]) {
      const container = document.getElementById(`view-${currentView}`);
      if (container) {
        ROUTES[currentView].render(container);
        renderedViews.add(currentView);
        container._dirty = false;
        applyPrivacyMode();
        updateHeaderTargetProgress();
      }
    }
  });

  // ── GLOBAL NAVIGATION ─────────────────────────────────────────────
  window.navigateTo = function(viewId) {
    history.pushState(null, '', `#${viewId}`);
    navigate(viewId);
  };

  window.addEventListener('hashchange', () => {
    const hash = location.hash.replace('#', '');
    if (ROUTES[hash]) navigate(hash);
  });

  // ── INIT ──────────────────────────────────────────────────────────
  const initHash = location.hash.replace('#', '');
  navigate(ROUTES[initHash] ? initHash : 'dashboard');
  applyPrivacyMode();
})();
