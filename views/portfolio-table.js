/**
 * Portfolio Table — reusable component for Trades and Long-Term views
 * Preserves all original WACC/P&L/quantity logic exactly.
 */

function createPortfolioView({ storageKey, showRanges = false, showInvested = true, title, subtitle }) {
  const generateId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  };

  const finiteNumber = (value, fallback = 0) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  // State
  let rows = readRows();
  let sortKey = 'script', sortDir = 1;
  let filterText = '';
  let saveTimer = null;

  // Root element
  const root = document.createElement('div');

  // Build HTML
  root.innerHTML = `
    <div class="section-header mb16">
      <div>
        <div class="section-title">${escHtml(title)}</div>
        <div class="section-sub">${escHtml(subtitle)}</div>
      </div>
      <div class="toolbar">
        <input type="text" class="search-input" id="pf-filter-${storageKey}" placeholder="Filter scripts…" />
        <button class="btn-secondary" id="pf-mass-${storageKey}">Mass Edit</button>
        <span class="save-indicator" id="pf-save-${storageKey}">Saved ✓</span>
      </div>
    </div>

    <!-- Summary -->
    <div class="summary-row" id="pf-summary-${storageKey}"></div>

    <!-- Table -->
    <div class="table-wrapper mt16">
      <table>
        <thead>
          <tr id="pf-thead-${storageKey}"></tr>
        </thead>
        <tbody id="pf-tbody-${storageKey}"></tbody>
      </table>
    </div>
  `;

  const tbody    = root.querySelector(`#pf-tbody-${storageKey}`);
  const thead    = root.querySelector(`#pf-thead-${storageKey}`);
  const saveInd  = root.querySelector(`#pf-save-${storageKey}`);
  const filterEl = root.querySelector(`#pf-filter-${storageKey}`);
  const massBtn  = root.querySelector(`#pf-mass-${storageKey}`);


  const addClasses = (el, classes) => {
    if (!classes) return;
    const tokens = Array.isArray(classes)
      ? classes.flatMap(cls => String(cls).split(/\s+/))
      : String(classes).split(/\s+/);
    const valid = tokens.filter(Boolean);
    if (valid.length) el.classList.add(...valid);
  };

  // Build thead
  const cols = [
    { key: 'script',   label: 'Script', colClass: 'pf-col-script' },
    { key: 'qty',      label: 'Qty', colClass: 'pf-col-qty' },
    { key: 'ltp',      label: 'LTP', colClass: 'pf-col-ltp' },
    ...(showRanges ? [{ key: 'stoploss', label: 'Stoploss', colClass: 'pf-col-stoploss' }, { key: 'sell1', label: 'L.Target', colClass: 'pf-col-ltarget' }] : []),
    ...(showInvested ? [{ key: 'invested', label: 'Invested' }] : []),
    { key: 'current',  label: 'Current' },
    { key: 'sell',     label: 'Sell', colClass: 'pf-col-sell' },
    { key: 'pl',       label: 'P/L' },
    { key: 'actions',  label: '', colClass: 'pf-col-actions' },
  ];

  cols.forEach(col => {
    const th = document.createElement('th');
    th.textContent = col.label;
    addClasses(th, col.colClass);
    if (col.key !== 'actions') {
      th.dataset.sort = col.key;
      th.addEventListener('click', () => {
        if (sortKey === col.key) sortDir *= -1;
        else { sortKey = col.key; sortDir = 1; }
        updateSortHeaders();
        render();
      });
    }
    thead.appendChild(th);
  });

  // Events
  filterEl.addEventListener('input', () => { filterText = filterEl.value.trim().toLowerCase(); render(); });
  massBtn.addEventListener('click', openMassEdit);

  window.addEventListener('pms-ltp-updated', () => { rows = readRows(); render(); });
  window.addEventListener('storage', (e) => {
    if (!e.key || e.key === storageKey) { rows = readRows(); render(); }
  });

  render();

  // ── FUNCTIONS ──────────────────────────────────────────────

  function addPositionFromFields(fields) {
    const record = {
      id: generateId(),
      script: String(fields.script || '').trim().toUpperCase(),
      ltp:  finiteNumber(fields.ltp),
      qty:  Math.floor(finiteNumber(fields.qty)),
      wacc: finiteNumber(fields.wacc),
      sell1: showRanges ? finiteNumber(fields.sell1 || '0') : 0,
      stoploss: showRanges ? (finiteNumber(fields.stoploss) || (finiteNumber(fields.wacc) * 0.95)) : 0,
    };
    if (!record.script || !Number.isFinite(record.ltp) || !Number.isFinite(record.wacc) || record.qty <= 0) return;

    const investedAmount = record.wacc * record.qty;
    if (window.PmsCapital && window.PmsCapital.readCash() < investedAmount) {
      window.PmsCapital.showCashAlert('Not enough cash balance.');
      return;
    }
    rows.push(record);
    if (window.PmsCapital) window.PmsCapital.adjustCash(-investedAmount);
    persist();
  }

  function render() {
    const list = [...rows]
      .filter(r => !filterText || r.script.toLowerCase().includes(filterText))
      .sort(sorter);

    tbody.innerHTML = '';
    list.forEach(row => {
      const invested = row.wacc * row.qty;
      const current  = row.ltp  * row.qty;
      const pl       = (row.ltp - row.wacc) * row.qty;
      const sellNow  = window.PmsTradeMath
        ? Number(window.PmsTradeMath.calculateRoundTrip({
          buyPrice: Number(row.wacc || 0),
          soldPrice: Number(row.ltp || 0),
          qty: Number(row.qty || 0),
          buyIsWacc: true,
          holdingDays: 0,
        }).netRealizedAmount || 0)
        : current;

      const tr = document.createElement('tr');

      // Script
      tr.appendChild(editableCell(row, 'script', row.script, 'text', { upper: true, textClass: 'text-col pf-col-script' }));
      // Qty
      tr.appendChild(editableCell(row, 'qty', row.qty, 'number', { tdClass: 'pf-col-qty' }));
      // LTP
      tr.appendChild(ltpCell(row));
      // Ranges
      if (showRanges) {
        tr.appendChild(stoplossCell(row));
        tr.appendChild(lTargetCell(row));
      }
      // Invested
      if (showInvested) tr.appendChild(textCell(currency(invested), 'pf-col-invested', `WACC: ${currency2(row.wacc)}`));
      // Current
      tr.appendChild(textCell(currency(current), 'pf-col-current'));
      // Sell Now (short-term tax slab)
      tr.appendChild(textCell(currency(sellNow), 'pf-col-sell', 'Net receivable after short-term capital gains tax.'));
      // P/L
      tr.appendChild(textCell(currency(pl), `pf-col-pl ${plClass(pl)}`));
      // Actions
      tr.appendChild(actionsCell(row));
      tbody.appendChild(tr);
    });

    renderSummary(list);
    updateSortHeaders();
  }

  function editableCell(row, key, value, type, opts = {}) {
    const td = document.createElement('td');
    addClasses(td, opts.textClass);
    addClasses(td, opts.tdClass);
    const input = document.createElement('input');
    input.className = 'inline-edit';
    input.value = type === 'number' ? (key === 'qty' ? Math.floor(value) : Number(value).toFixed(2)) : value;
    input.type = type === 'number' ? 'number' : 'text';
    if (type === 'number') { input.min = '0'; input.step = key === 'qty' ? '1' : '0.01'; }
    input.addEventListener('blur', () => {
      const newVal = type === 'number'
        ? (key === 'qty' ? Math.floor(num(input.value)) : num(input.value))
        : input.value.trim();
      if (type === 'number' && !Number.isFinite(newVal)) return;
      row[key] = opts.upper ? String(newVal).toUpperCase() : newVal;
      persist();
    });
    td.appendChild(input);
    return td;
  }

  function ltpCell(row) {
    const td = document.createElement('td');
    td.className = 'pf-col-ltp';
    const input = document.createElement('input');
    input.type = 'number';
    input.className = `inline-edit ltp-input ${ltpClass(row)}`;
    input.value = Number(row.ltp).toFixed(2);
    input.min = '0'; input.step = '0.01';
    input.addEventListener('blur', () => {
      const value = num(input.value);
      if (!Number.isFinite(value)) return;
      row.ltp = value;
      persist();
    });
    td.appendChild(input);
    return td;
  }

  function lTargetCell(row) {
    const td = document.createElement('td');
    td.className = 'pf-col-ltarget';
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'inline-edit ltarget-input';
    input.value = Number(row.sell1).toFixed(2);
    input.step = '0.01'; input.min = '0';
    input.addEventListener('blur', () => {
      const value = num(input.value);
      if (!Number.isFinite(value)) return;
      row.sell1 = value;
      persist();
    });
    td.appendChild(input);
    return td;
  }

  function stoplossCell(row) {
    const td = document.createElement('td');
    td.className = 'pf-col-stoploss';
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'inline-edit stoploss-input';
    input.value = Number(row.stoploss).toFixed(2);
    input.step = '0.01'; input.min = '0';
    input.addEventListener('blur', () => {
      const value = num(input.value);
      if (!Number.isFinite(value)) return;
      row.stoploss = value;
      persist();
    });
    td.appendChild(input);
    return td;
  }

  function actionsCell(row) {
    const td = document.createElement('td');
    td.className = 'actions-td pf-col-actions';
    const wrap = document.createElement('div');
    wrap.className = 'actions-cell';

    const editBtn = makeBtn('✏️', 'btn-ghost', () => openQuickEdit(row));
    const exitBtn = makeBtn('🧾', 'btn-ghost', () => openExitDialog(row));
    exitBtn.title = 'Exit to Past Trades';
    const delBtn = makeBtn('🗑️', 'btn-ghost', () => {
      Modal.confirm({
        title: 'Delete Position',
        message: `Remove ${row.script} (${row.qty} shares)?`,
        confirmText: 'Delete',
        onConfirm: () => {
          const refund = row.wacc * row.qty;
          if (window.PmsCapital) window.PmsCapital.adjustCash(refund);
          rows = rows.filter(r => r.id !== row.id);
          persist('Deleted ✓');
        },
      });
    });

    wrap.append(editBtn, exitBtn, delBtn);
    td.appendChild(wrap);
    return td;
  }

  function makeBtn(text, cls, onClick) {
    const b = document.createElement('button');
    b.className = cls;
    b.textContent = text;
    b.addEventListener('click', onClick);
    return b;
  }

  function textCell(text, className = '', title = '') {
    const td = document.createElement('td');
    td.textContent = text;
    if (className) td.className = className;
    if (title) td.title = title;
    return td;
  }

  function ltpClass(row) {
    const ltp = Number(row.ltp || 0);
    const wacc = Number(row.wacc || 0);
    if (!Number.isFinite(ltp) || !Number.isFinite(wacc)) return 'ltp-neutral';
    if (ltp > wacc) return 'ltp-profit';
    if (ltp < wacc) return 'ltp-loss';
    return 'ltp-neutral';
  }

  function openQuickEdit(row) {
    const prevCost = row.wacc * row.qty;
    Modal.open({
      title: `Edit ${row.script}`,
      subtitle: 'Update quantity and WACC',
      body: `
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Quantity</label>
            <input type="number" class="form-input" id="eq-qty" min="0" step="1" value="${Math.floor(row.qty)}" />
          </div>
          <div class="form-group">
            <label class="form-label">WACC</label>
            <input type="number" class="form-input" id="eq-wacc" min="0" step="0.01" value="${Number(row.wacc).toFixed(2)}" />
          </div>
          ${showRanges ? `
          <div class="form-group">
            <label class="form-label">L.Target</label>
            <input type="number" class="form-input" id="eq-sell1" min="0" step="0.01" value="${Number(row.sell1).toFixed(2)}" />
          </div>
          <div class="form-group">
            <label class="form-label">Stoploss</label>
            <input type="number" class="form-input" id="eq-stoploss" min="0" step="0.01" value="${Number(row.stoploss).toFixed(2)}" />
          </div>` : ''}
        </div>
      `,
      footer: `<button class="btn-secondary" id="eq-cancel">Cancel</button><button class="btn-primary" id="eq-save">Save</button>`,
    });
    const box = document.getElementById('modalBox');
    box.querySelector('#eq-cancel').addEventListener('click', Modal.close);
    box.querySelector('#eq-save').addEventListener('click', () => {
      const qty  = Math.max(0, Math.floor(num(box.querySelector('#eq-qty').value) || 0));
      const wacc = Math.max(0, num(box.querySelector('#eq-wacc').value) || 0);
      row.qty = qty; row.wacc = wacc;
      if (showRanges) {
        const lTarget = Math.max(0, num(box.querySelector('#eq-sell1').value) || 0);
        const stoploss = Math.max(0, num(box.querySelector('#eq-stoploss').value) || 0);
        row.sell1 = lTarget;
        row.stoploss = stoploss || (wacc * 0.95);
      }
      const newCost = row.wacc * row.qty;
      if (window.PmsCapital) window.PmsCapital.adjustCash(prevCost - newCost);
      persist();
      Modal.close();
    });
  }

  function openExitDialog(row) {
    Modal.open({
      title: `Exit ${row.script}`,
      subtitle: 'Record sell and move to Past Trades',
      body: `
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Sell Price</label>
            <input type="number" class="form-input" id="ex-price" min="0.01" step="0.01" placeholder="${Number(row.ltp).toFixed(2)}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Holding Days</label>
            <input type="number" class="form-input" id="ex-days" min="0" step="1" placeholder="30" required />
          </div>
        </div>
        <div style="margin-top:10px;padding:10px;background:var(--bg-elevated);border-radius:var(--radius-sm);font-size:11px;color:var(--text-muted);">
          WACC: <strong style="color:var(--text-primary);">${currency2(row.wacc)}</strong> &nbsp;|&nbsp;
          Qty: <strong style="color:var(--text-primary);">${row.qty}</strong> &nbsp;|&nbsp;
          LTP: <strong style="color:var(--text-primary);">${currency2(row.ltp)}</strong>
        </div>
      `,
      footer: `<button class="btn-secondary" id="ex-cancel">Cancel</button><button class="btn-primary" id="ex-confirm">Exit Trade</button>`,
    });
    const box = document.getElementById('modalBox');
    box.querySelector('#ex-cancel').addEventListener('click', Modal.close);
    box.querySelector('#ex-confirm').addEventListener('click', () => {
      const soldPrice  = num(box.querySelector('#ex-price').value);
      const holdingDays = Math.floor(num(box.querySelector('#ex-days').value));
      if (!Number.isFinite(soldPrice) || soldPrice <= 0 || !Number.isFinite(holdingDays) || holdingDays < 0) return;
      exitToPastTrades(row, soldPrice, holdingDays);
      Modal.close();
    });
  }

  function exitToPastTrades(row, soldPrice, holdingDays) {
    const calc = window.PmsTradeMath.calculateRoundTrip({ buyPrice: row.wacc, soldPrice, qty: row.qty, holdingDays });
    const exited = readJsonArr('exitedTradesV2');
    exited.push({
      id: generateId(),
      exitedAt: new Date().toISOString(),
      type: storageKey === 'longterm' ? 'Long Term' : 'Trade',
      name: row.script,
      qty: row.qty,
      buyPrice: row.wacc,
      soldPrice,
      total: soldPrice * row.qty,
      buyTotal: calc.invested,
      soldTotal: calc.realizedAmount,
      netSoldTotal: Number(calc.netRealizedAmount || calc.realizedAmount || 0),
      grossProfit: Number(calc.grossProfit || 0),
      capitalGainTax: Number(calc.capitalGainTax || 0),
      profit: Number(calc.netProfit || 0),
      perDayProfit: holdingDays > 0 ? Number(calc.netProfit || 0) / holdingDays : Number(calc.netProfit || 0),
      holdingDays,
    });
    localStorage.setItem('exitedTradesV2', JSON.stringify(exited));
    if (window.PmsCapital) window.PmsCapital.adjustCash(Number(calc.netRealizedAmount || calc.realizedAmount || 0));
    rows = rows.filter(r => r.id !== row.id);
    persist('Exited ✓');
  }

  function openMassEdit() {
    const colDef = ['Script','Qty','LTP','WACC', ...(showRanges ? ['L.Target', 'Stoploss'] : [])];
    const rowHtml = rows.map(row => `
      <tr>
        <td><input class="form-input" data-key="script" data-id="${row.id}" value="${escHtml(row.script)}" style="min-width:70px;" /></td>
        <td><input type="number" class="form-input" data-key="qty" data-id="${row.id}" value="${Math.floor(row.qty)}" step="1" min="0" style="min-width:60px;" /></td>
        <td><input type="number" class="form-input" data-key="ltp" data-id="${row.id}" value="${Number(row.ltp).toFixed(2)}" step="0.01" min="0" style="min-width:70px;" /></td>
        <td><input type="number" class="form-input" data-key="wacc" data-id="${row.id}" value="${Number(row.wacc).toFixed(2)}" step="0.01" min="0" style="min-width:70px;" /></td>
        ${showRanges ? `<td><input type="number" class="form-input" data-key="sell1" data-id="${row.id}" value="${Number(row.sell1).toFixed(2)}" step="0.01" min="0" style="min-width:70px;" /></td><td><input type="number" class="form-input" data-key="stoploss" data-id="${row.id}" value="${Number(row.stoploss).toFixed(2)}" step="0.01" min="0" style="min-width:70px;" /></td>` : ''}
      </tr>`).join('');

    Modal.open({
      title: `Mass Edit — ${title}`,
      subtitle: 'Batch update all positions at once',
      wide: true,
      body: `
        <div class="table-wrapper" style="max-height:400px;overflow-y:auto;">
          <table>
            <thead><tr>${colDef.map(l => `<th>${l}</th>`).join('')}</tr></thead>
            <tbody>${rowHtml}</tbody>
          </table>
        </div>`,
      footer: `<button class="btn-secondary" id="me-cancel">Cancel</button><button class="btn-primary" id="me-save">Save All</button>`,
    });
    const box = document.getElementById('modalBox');
    box.querySelector('#me-cancel').addEventListener('click', Modal.close);
    box.querySelector('#me-save').addEventListener('click', () => {
      const costBefore = rows.reduce((s, r) => s + r.wacc * r.qty, 0);
      box.querySelectorAll('input[data-id]').forEach(input => {
        const row = rows.find(r => r.id === input.dataset.id);
        if (!row) return;
        const key = input.dataset.key;
        if (key === 'script') row.script = String(input.value).trim().toUpperCase();
        else if (key === 'qty')   row.qty   = Math.max(0, Math.floor(num(input.value) || 0));
        else if (key === 'ltp')   row.ltp   = Math.max(0, num(input.value) || 0);
        else if (key === 'wacc')  row.wacc  = Math.max(0, num(input.value) || 0);
        else if (key === 'sell1' && showRanges) row.sell1 = Math.max(0, num(input.value) || 0);
        else if (key === 'stoploss' && showRanges) row.stoploss = Math.max(0, num(input.value) || 0);
      });
      const costAfter = rows.reduce((s, r) => s + r.wacc * r.qty, 0);
      if (window.PmsCapital) window.PmsCapital.adjustCash(costBefore - costAfter);
      persist('Mass update saved ✓');
      Modal.close();
    });
  }

  function renderSummary(list) {
    const invested = list.reduce((s, r) => s + r.wacc * r.qty, 0);
    const current  = list.reduce((s, r) => s + r.ltp  * r.qty, 0);
    const pl       = current - invested;
    const roi      = invested > 0 ? (pl / invested) * 100 : 0;
    const positions = list.length;

    const summaryEl = root.querySelector(`#pf-summary-${storageKey}`);
    summaryEl.classList.toggle('summary-row-split', true);
    summaryEl.innerHTML = `
      <div class="summary-box summary-item">
        <div class="summary-label">Total Invested</div>
        <div class="summary-value">${currency(invested)}</div>
      </div>
      <div class="summary-box summary-item">
        <div class="summary-label">Current Value</div>
        <div class="summary-value">${currency(current)}</div>
      </div>
      <div class="summary-box summary-item">
        <div class="summary-label">Unrealized P/L</div>
        <div class="summary-value ${plClass(pl)}">${currency(pl)}</div>
      </div>
      <div class="summary-box summary-item">
        <div class="summary-label">ROI / Positions</div>
        <div class="summary-value ${plClass(roi)}">${pct(roi)} · ${positions}</div>
      </div>
      <button class="summary-box summary-add-btn" id="pf-add-${storageKey}" type="button">+ Add Position</button>
    `;

    const addBtn = summaryEl.querySelector(`#pf-add-${storageKey}`);
    if (addBtn) addBtn.addEventListener('click', openAddPositionModal);
  }

  function openAddPositionModal() {
    Modal.open({
      title: `Add Position — ${title}`,
      subtitle: 'Enter script, qty, ltp and wacc',
      body: `
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Script</label>
            <input type="text" class="form-input" id="ap-script" placeholder="e.g. NABIL" />
          </div>
          <div class="form-group">
            <label class="form-label">Qty</label>
            <input type="number" class="form-input" id="ap-qty" min="1" step="1" placeholder="100" />
          </div>
          <div class="form-group">
            <label class="form-label">LTP</label>
            <input type="number" class="form-input" id="ap-ltp" min="0.01" step="0.01" placeholder="450.00" />
          </div>
          <div class="form-group">
            <label class="form-label">WACC</label>
            <input type="number" class="form-input" id="ap-wacc" min="0.01" step="0.01" placeholder="420.00" />
          </div>
          ${showRanges ? `
          <div class="form-group">
            <label class="form-label">Sell Target (L)</label>
            <input type="number" class="form-input" id="ap-sell1" min="0.01" step="0.01" placeholder="480.00" />
          </div>
          <div class="form-group">
            <label class="form-label">Stoploss</label>
            <input type="number" class="form-input" id="ap-stoploss" min="0.01" step="0.01" placeholder="399.00" />
          </div>` : ''}
        </div>
      `,
      footer: `<button class="btn-secondary" id="ap-cancel">Cancel</button><button class="btn-primary" id="ap-save">Add</button>`,
    });

    const box = document.getElementById('modalBox');
    if (showRanges) {
      const waccEl = box.querySelector('#ap-wacc');
      const stoplossEl = box.querySelector('#ap-stoploss');
      waccEl?.addEventListener('blur', () => {
        const wacc = num(waccEl.value);
        if (!Number.isFinite(wacc) || wacc <= 0) return;
        if (!stoplossEl.value || !Number.isFinite(num(stoplossEl.value))) stoplossEl.value = (wacc * 0.95).toFixed(2);
      });
    }
    box.querySelector('#ap-cancel').addEventListener('click', Modal.close);
    box.querySelector('#ap-save').addEventListener('click', () => {
      addPositionFromFields({
        script: box.querySelector('#ap-script').value,
        qty: box.querySelector('#ap-qty').value,
        ltp: box.querySelector('#ap-ltp').value,
        wacc: box.querySelector('#ap-wacc').value,
        sell1: showRanges ? box.querySelector('#ap-sell1')?.value : 0,
        stoploss: showRanges ? box.querySelector('#ap-stoploss')?.value : 0,
      });
      Modal.close();
    });
  }

  function updateSortHeaders() {
    thead.querySelectorAll('th[data-sort]').forEach(th => {
      th.classList.remove('sort-asc', 'sort-desc');
      if (th.dataset.sort === sortKey) addClasses(th, sortDir > 0 ? 'sort-asc' : 'sort-desc');
    });
  }

  function sorter(a, b) {
    const val = obj => {
      switch (sortKey) {
        case 'script':   return obj.script.toLowerCase();
        case 'ltp':      return obj.ltp;
        case 'qty':      return obj.qty;
        case 'wacc':     return obj.wacc;
        case 'sell1':    return obj.sell1;
        case 'stoploss': return obj.stoploss;
        case 'invested': return obj.wacc * obj.qty;
        case 'current':  return obj.ltp  * obj.qty;
        case 'pl':       return (obj.ltp - obj.wacc) * obj.qty;
        default:         return obj.script.toLowerCase();
      }
    };
    const av = val(a), bv = val(b);
    return typeof av === 'string' ? av.localeCompare(bv) * sortDir : (av - bv) * sortDir;
  }

  function persist(msg = 'Saved ✓') {
    localStorage.setItem(storageKey, JSON.stringify(rows));
    flashSave(msg);
    render();
    window.dispatchEvent(new CustomEvent('pms-portfolio-updated', { detail: { key: storageKey } }));
  }

  function flashSave(msg) {
    saveInd.textContent = msg;
    saveInd.classList.add('visible');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveInd.classList.remove('visible'), 2200);
  }

  function readRows() {
    return readJsonArr(storageKey)
      .filter(r => r && typeof r === 'object')
      .map(r => {
        const wacc = finiteNumber(r.wacc);
        return {
          id: r.id || generateId(),
          script: String(r.script || '').trim().toUpperCase(),
          ltp: finiteNumber(r.ltp),
          qty: Math.floor(Math.max(0, finiteNumber(r.qty))),
          wacc,
          sell1: finiteNumber(r.sell1),
          stoploss: finiteNumber(r.stoploss, wacc * 0.95),
        };
      });
  }

  return root;
}

window.createPortfolioView = createPortfolioView;
