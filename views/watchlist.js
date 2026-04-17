/**
 * Dashboard Watchlist (6 trade slots + 2 long-term slots)
 */
(function () {
  const WL_KEY = 'nepse_watchlist_v1';
  const REGULAR_SLOTS = 6;
  const LONG_SLOTS = 2;

  function load() {
    try {
      const p = JSON.parse(localStorage.getItem(WL_KEY) || 'null');
      if (p && Array.isArray(p.regular) && Array.isArray(p.long)) {
        while (p.regular.length < REGULAR_SLOTS) p.regular.push(null);
        while (p.long.length < LONG_SLOTS) p.long.push(null);
        return { regular: p.regular.slice(0, REGULAR_SLOTS), long: p.long.slice(0, LONG_SLOTS) };
      }
    } catch {}
    return { regular: Array(REGULAR_SLOTS).fill(null), long: Array(LONG_SLOTS).fill(null) };
  }

  function save(state) { localStorage.setItem(WL_KEY, JSON.stringify(state)); }
  function readArr(key) { try { const p = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(p) ? p : []; } catch { return []; } }

  function getRows(type) {
    return readArr(type === 'long' ? 'longterm' : 'trades').map(r => ({
      symbol: String(r.script || r.symbol || '').toUpperCase().trim(), qty: Number(r.qty || 0), wacc: Number(r.wacc || 0), ltp: Number(r.ltp || 0), type,
    })).filter(r => r.symbol);
  }

  function buildStockMap() {
    const map = {};
    getRows('regular').forEach(r => { map[`regular-${r.symbol}`] = r; });
    getRows('long').forEach(r => { map[`long-${r.symbol}`] = r; });
    return map;
  }

  function describeStock(row) {
    if (!row) return 'No data available.';
    const spread = Number(row.ltp || 0) - Number(row.wacc || 0);
    if (spread > 0) return 'Price is trading above average cost and is currently in profit zone.';
    if (spread < 0) return 'Price is below average cost, so this script is currently under pressure.';
    return 'Price is near the average cost and currently flat.';
  }

  function maskDigits(value) {
    if (!(window.PmsPrivacy && window.PmsPrivacy.isEnabled && window.PmsPrivacy.isEnabled())) return String(value);
    return window.PmsPrivacy.maskValue ? window.PmsPrivacy.maskValue() : 'XXX';
  }
  function maskScript(value) {
    if (!(window.PmsPrivacy && window.PmsPrivacy.isEnabled && window.PmsPrivacy.isEnabled())) return String(value || '');
    return window.PmsPrivacy.maskValue ? window.PmsPrivacy.maskValue() : 'XXX';
  }

  function pct(ltp, wacc) {
    if (!ltp || !wacc) return { text: '—', cls: 'wl-flat' };
    const v = ((ltp - wacc) / wacc) * 100;
    const text = `${v.toFixed(2)}%`;
    return { text: maskDigits(text), cls: v > 0 ? 'wl-up' : v < 0 ? 'wl-down' : 'wl-flat' };
  }

  function renderPanel(container, onUpdate) {
    const state = load();
    const map = buildStockMap();
    const pinned = [...state.regular, ...state.long].filter(Boolean).length;

    container.innerHTML = `
      <div class="wl-panel compact">
        <div class="wl-header"><span class="wl-title">WATCHLIST</span><span class="wl-meta">${pinned}/8 pinned</span></div>
        <div class="wl-grid-wrap">
          <div class="wl-grid-mix" data-section-wrap="combined">
            ${boxHtml('regular', state.regular[0], map, 0)}
            ${boxHtml('regular', state.regular[1], map, 1)}
            ${boxHtml('regular', state.regular[2], map, 2)}
            ${boxHtml('long', state.long[0], map, 0)}
            ${boxHtml('regular', state.regular[3], map, 3)}
            ${boxHtml('regular', state.regular[4], map, 4)}
            ${boxHtml('regular', state.regular[5], map, 5)}
            ${boxHtml('long', state.long[1], map, 1)}
          </div>
        </div>
      </div>`;

    container.querySelectorAll('.wl-unpin-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const sym = btn.dataset.symbol;
        if (!window.confirm(`Delete ${sym} from watchlist?`)) return;
        const s = load();
        s.regular = s.regular.map(x => (x === sym ? null : x));
        s.long = s.long.map(x => (x === sym ? null : x));
        save(s);
        if (onUpdate) onUpdate();
      });
    });

    container.querySelectorAll('.wl-box-empty').forEach(box => {
      box.addEventListener('click', () => showPinModal(box.dataset.section, Number(box.dataset.slot), onUpdate));
    });

    container.querySelectorAll('.wl-box-draggable').forEach((box) => {
      box.addEventListener('click', () => {
        const key = `${box.dataset.section}-${box.dataset.symbol}`;
        const row = map[key];
        showScriptModal(row);
      });
    });

    bindDragDrop(container, onUpdate);
  }

  function bindDragDrop(container, onUpdate) {
    let drag = null;

    container.querySelectorAll('.wl-box-draggable').forEach(box => {
      box.setAttribute('draggable', 'true');
      box.addEventListener('dragstart', () => {
        drag = {
          section: box.dataset.section,
          from: Number(box.dataset.slot),
        };
        box.classList.add('wl-dragging');
      });
      box.addEventListener('dragend', () => {
        box.classList.remove('wl-dragging');
      });
    });

    container.querySelectorAll('.wl-box').forEach(box => {
      box.addEventListener('dragover', (e) => {
        if (!drag) return;
        if (drag.section !== box.dataset.section) return;
        e.preventDefault();
        box.classList.add('wl-drop-target');
      });
      box.addEventListener('dragleave', () => box.classList.remove('wl-drop-target'));
      box.addEventListener('drop', (e) => {
        e.preventDefault();
        box.classList.remove('wl-drop-target');
        if (!drag) return;
        const targetSection = box.dataset.section;
        const to = Number(box.dataset.slot);
        if (drag.section !== targetSection || drag.from === to) {
          drag = null;
          return;
        }
        const s = load();
        const arr = s[targetSection];
        const tmp = arr[drag.from];
        arr[drag.from] = arr[to] || null;
        arr[to] = tmp || null;
        save(s);
        drag = null;
        if (onUpdate) onUpdate();
      });
    });
  }

  function boxHtml(section, sym, map, slot) {
    if (!sym) {
      return `<div class="wl-box wl-box-empty ${section === 'long' ? 'wl-box-long' : ''}" data-section="${section}" data-slot="${slot}">
        <div class="wl-box-top"><span class="wl-box-id">SCRIPT</span><span class="wl-pin-btn">+ PIN</span></div>
        <div class="wl-box-sym">QTY: 0</div>
        <div class="wl-box-ltp">LTP: —</div>
        <div class="wl-box-chg wl-flat">ROI%: —</div>
      </div>`;
    }
    const d = map[`${section}-${sym}`];
    const chg = d ? pct(d.ltp, d.wacc) : { text: '—', cls: 'wl-flat' };
    return `<div class="wl-box wl-box-draggable ${section === 'long' ? 'wl-box-long' : 'wl-box-trade'}" data-section="${section}" data-slot="${slot}" data-symbol="${sym}">
      <div class="wl-box-top"><span class="wl-box-id">${maskScript(sym)}</span><button class="wl-unpin-btn" data-symbol="${sym}" title="Delete from watchlist">✕</button></div>
      <div class="wl-box-sym">QTY: ${maskDigits(d ? d.qty : 0)}</div>
      <div class="wl-box-ltp">LTP: ${d ? maskDigits(Number(d.ltp).toFixed(2)) : '—'}</div>
      <div class="wl-box-chg ${chg.cls}">ROI%: ${chg.text}</div>
    </div>`;
  }

  function showScriptModal(row) {
    if (!window.Modal || !row) return;
    const invested = Number(row.qty || 0) * Number(row.wacc || 0);
    const current = Number(row.qty || 0) * Number(row.ltp || 0);
    const pl = current - invested;
    const roi = invested > 0 ? (pl / invested) * 100 : 0;
    const sell = row.type === 'long'
      ? current
      : (window.PmsTradeMath
        ? Number(window.PmsTradeMath.calculateRoundTrip({
          buyPrice: Number(row.wacc || 0),
          soldPrice: Number(row.ltp || 0),
          qty: Number(row.qty || 0),
          holdingDays: 0,
        }).netRealizedAmount || 0)
        : current);
    Modal.open({
      title: 'SNAPSHOT',
      body: `<div class="snapshot-card">
        <div class="snapshot-symbol">${row.symbol}</div>
        <div class="snapshot-item">ROI %: <span class="${roi >= 0 ? 'value-profit' : 'value-loss'}">${roi.toFixed(2)}%</span></div>
        <div class="snapshot-item">QTY : <span>${row.qty}</span></div>
        <div class="snapshot-item">LTP : <span>${row.ltp.toFixed(2)}</span></div>
        <div class="snapshot-item">PROFIT : <span class="${pl >= 0 ? 'value-profit' : 'value-loss'}">${pl.toFixed(2)}</span></div>
        <div class="snapshot-item">SELL : <span>${sell.toFixed(2)}</span></div>
      </div>`,
      footer: `<button class="btn-secondary" onclick="Modal.close()">Close</button>`,
    });
  }

  function showPinModal(section, slotIdx, onUpdate) {
    if (!window.Modal) return;
    const state = load();
    const pinned = new Set([...state.regular, ...state.long].filter(Boolean));
    const available = getRows(section).filter(x => !pinned.has(x.symbol)).sort((a, b) => a.symbol.localeCompare(b.symbol));

    Modal.open({
      title: `Pin ${section === 'long' ? 'Long-Term' : 'Trade'} Stock`,
      body: available.length ? `<div class="wl-pick-grid">${available.map(s => `<button class="wl-pick-item" data-symbol="${s.symbol}"><span class="wl-pick-sym">${s.symbol}</span><span class="wl-pick-badge">${section === 'long' ? 'LONG TERM' : 'TRADE'}</span></button>`).join('')}</div>` : `<div style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);padding:10px 0;">No available ${section === 'long' ? 'long-term' : 'trade'} stock to pin.</div>`,
      footer: `<button class="btn-secondary" onclick="Modal.close()">Cancel</button>`,
    });

    setTimeout(() => {
      document.querySelectorAll('.wl-pick-item').forEach(btn => {
        btn.addEventListener('click', () => {
          const s = load();
          const arr = s[section];
          let idx = slotIdx;
          if (idx < 0 || idx >= arr.length) idx = arr.findIndex(x => !x);
          if (idx < 0) idx = 0;
          s[section][idx] = btn.dataset.symbol;
          save(s);
          Modal.close();
          if (onUpdate) onUpdate();
        });
      });
    }, 20);
  }

  window.Watchlist = { renderPanel, load, save };
})();
