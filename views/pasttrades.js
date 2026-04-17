/**
 * Past Trades View
 * Preserves all original pasttrades.js financial logic exactly.
 */
function renderPastTrades(container) {
  const EXITED_KEY = 'exitedTradesV2';
  let sortKey = 'profit', sortDir = -1;
  let filterText = '';

  container.innerHTML = `
    <div class="section-header mb16">
      <div>
        <div class="section-title">Past Trades</div>
        <div class="section-sub">Closed positions and realized profit &amp; loss</div>
      </div>
    </div>

    <!-- Exit Form -->
    <div class="add-panel mb20">
      <div class="add-panel-title">Exit a Position</div>
      <form id="pt-exit-form" autocomplete="off">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Asset Type</label>
            <select class="form-select" name="type" id="pt-type">
              <option value="trades">Trades</option>
              <option value="longterm">Long-Term</option>
              <option value="sip">SIP</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Record</label>
            <select class="form-select" name="record" id="pt-record"></select>
          </div>
          <div class="form-group">
            <label class="form-label">Qty Available</label>
            <input type="text" class="form-input" id="pt-avail-qty" readonly />
          </div>
          <div class="form-group">
            <label class="form-label">Sell Qty</label>
            <input type="number" class="form-input" name="sellQty" id="pt-sell-qty" min="1" step="1" />
          </div>
          <div class="form-group">
            <label class="form-label">Sell Price</label>
            <input type="number" class="form-input" name="soldPrice" id="pt-sold-price" min="0.01" step="0.01" required />
          </div>
          <div class="form-group">
            <label class="form-label">Holding Days</label>
            <input type="number" class="form-input" name="holdingDays" id="pt-holding-days" min="0" step="1" required />
          </div>
          <div class="form-group" style="align-self:end;">
            <button type="submit" class="btn-primary" style="width:100%;">Exit &amp; Record</button>
          </div>
        </div>
      </form>
    </div>

    <!-- Metrics -->
    <div class="metrics-grid" id="pt-metrics"></div>

    <!-- Filter & Table -->
    <div class="section-header mt16 mb8">
      <div class="section-title">Closed Trades History</div>
      <div class="toolbar">
        <input type="text" class="search-input" id="pt-filter" placeholder="Filter by name…" />
        
      </div>
    </div>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th data-sort="name">Name</th>
            <th data-sort="type">Type</th>
            <th data-sort="qty">Qty</th>
            <th data-sort="buyPrice">Buy</th>
            <th data-sort="soldPrice">Sell</th>
            <th data-sort="buyTotal">Invested</th>
            <th data-sort="capitalGainTax">Total Tax Paid</th>
            <th data-sort="profit">Net P/L</th>
            <th data-sort="netSoldTotal">Receivable After Tax</th>
            <th data-sort="holdingDays">Days</th>
            <th data-sort="perDayProfit">Per Day Profit</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="pt-tbody"></tbody>
      </table>
    </div>
  `;

  const exitForm  = container.querySelector('#pt-exit-form');
  const typeEl    = container.querySelector('#pt-type');
  const recordEl  = container.querySelector('#pt-record');
  const filterEl  = container.querySelector('#pt-filter');

  typeEl.addEventListener('change', renderRecordOptions);
  recordEl.addEventListener('change', updateSelectedInfo);
  filterEl.addEventListener('input', () => { filterText = filterEl.value.trim().toLowerCase(); renderExited(); });

  container.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (sortKey === key) sortDir *= -1;
      else { sortKey = key; sortDir = key === 'name' || key === 'type' ? 1 : -1; }
      renderExited();
    });
  });

  exitForm.addEventListener('submit', onExit);

  renderRecordOptions();
  renderExited();
  renderMetrics();

  // ── FUNCTIONS ──────────────────────────────────────────────

  function onExit(e) {
    e.preventDefault();
    const fd = new FormData(exitForm);
    const type        = typeEl.value;
    const recordId    = recordEl.value;
    const soldPrice   = Number(fd.get('soldPrice'));
    const holdingDays = Math.floor(Number(fd.get('holdingDays')));
    const sellQty     = Math.floor(Number(fd.get('sellQty')));
    if (!recordId || !isFinite(soldPrice) || soldPrice <= 0 || !isFinite(holdingDays) || holdingDays < 0) return;

    const active = getActiveRecords(type);
    const record = active.find(r => r.id === recordId);
    if (!record) return;

    const maxSell = Math.floor(record.qty || 0);
    const minSell = record.ref === 'sip' ? 1 : 10;
    if (!isFinite(sellQty) || sellQty < minSell || sellQty > maxSell) {
      return Modal.open({ title: 'Invalid Quantity', body: `<p style="color:var(--text-secondary);">Qty must be between ${minSell} and ${maxSell}.</p>`, footer: `<button class="btn-primary" onclick="Modal.close()">OK</button>` });
    }

    const roundTrip = window.PmsTradeMath.calculateRoundTrip({ buyPrice: record.buyPrice, soldPrice, qty: sellQty, holdingDays });
    const grossProfit    = Number(roundTrip.grossProfit || roundTrip.profit || 0);
    const capitalGainTax = Number(roundTrip.capitalGainTax || 0);
    const profit         = Number(roundTrip.netProfit || roundTrip.profit || 0);

    const exited = readJsonArr(EXITED_KEY);
    exited.push({
      id: crypto.randomUUID(),
      exitedAt: new Date().toISOString(),
      type: record.source,
      name: record.name,
      qty: sellQty,
      buyPrice: record.buyPrice,
      soldPrice,
      total: soldPrice * sellQty,
      buyTotal: roundTrip.invested,
      soldTotal: roundTrip.realizedAmount,
      netSoldTotal: Number(roundTrip.netRealizedAmount || roundTrip.realizedAmount || 0),
      grossProfit, capitalGainTax, profit,
      perDayProfit: holdingDays > 0 ? profit / holdingDays : profit,
      holdingDays,
    });

    localStorage.setItem(EXITED_KEY, JSON.stringify(exited));
    if (window.PmsCapital) window.PmsCapital.adjustCash(Number(roundTrip.netRealizedAmount || roundTrip.realizedAmount || 0));
    removeRecord(record, sellQty);
    exitForm.reset();
    renderRecordOptions();
    renderExited();
    renderMetrics();
  }

  function renderRecordOptions() {
    const type = typeEl.value;
    const records = getActiveRecords(type);
    recordEl.innerHTML = records.length
      ? records.map(r => `<option value="${r.id}">${escHtml(r.name)}</option>`).join('')
      : '<option value="">No records available</option>';
    updateSelectedInfo();
  }

  function updateSelectedInfo() {
    const type = typeEl.value;
    const records = getActiveRecords(type);
    const row = records.find(r => r.id === recordEl.value);
    const availEl  = container.querySelector('#pt-avail-qty');
    const sellQtyEl = container.querySelector('#pt-sell-qty');
    if (row) {
      const available = Math.floor(Number(row.qty || 0));
      if (availEl)  availEl.value = available;
      if (sellQtyEl) {
        sellQtyEl.min   = String(row.ref === 'sip' ? 1 : 10);
        sellQtyEl.max   = String(available);
        sellQtyEl.value = String(available);
        sellQtyEl.readOnly = row.ref === 'sip';
      }
    } else {
      if (availEl)  availEl.value = '';
      if (sellQtyEl) sellQtyEl.value = '';
    }
  }

  function renderExited() {
    const tbody = container.querySelector('#pt-tbody');
    const exited = readJsonArr(EXITED_KEY)
      .filter(r => !filterText || String(r.name || '').toLowerCase().includes(filterText))
      .map(normalizeExited)
      .sort(sortExited);

    tbody.innerHTML = exited.length ? '' : `
      <tr><td colspan="12">
        <div class="empty-state"><div class="empty-state-icon">📜</div><div class="empty-state-title">No closed trades</div><div class="empty-state-sub">Exit positions using the form above.</div></div>
      </td></tr>`;

    exited.forEach(row => {
      const tr = document.createElement('tr');
      const cells = [
        { val: row.name || '—',          cls: 'text-col' },
        { val: row.type || '—' },
        { val: row.qty },
        { val: currency2(row.buyPrice) },
        { val: currency2(row.soldPrice) },
        { val: currency(row.buyTotal) },
        { val: currency(row.capitalGainTax), cls: row.capitalGainTax > 0 ? 'value-amber' : '' },
        { val: currency(row.profit),       cls: plClass(row.profit) },
        { val: currency(row.netSoldTotal), cls: row.netSoldTotal >= row.buyTotal ? 'value-profit' : 'value-loss' },
        { val: row.holdingDays },
        { val: currency(row.perDayProfit), cls: plClass(row.perDayProfit) },
      ];
      cells.forEach(({ val, cls }) => {
        const td = document.createElement('td');
        td.textContent = val;
        if (cls) td.className = cls;
        tr.appendChild(td);
      });
      const actionTd = document.createElement('td');
      actionTd.className = 'actions-td';
      actionTd.innerHTML = `
        <div class="actions-cell">
          <button class="btn-ghost" data-edit="${row.id}">✏️</button>
          <button class="btn-ghost" data-del="${row.id}">🗑️</button>
        </div>
      `;
      tr.appendChild(actionTd);
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-del');
        const rows = readJsonArr(EXITED_KEY).filter((row) => row.id !== id);
        localStorage.setItem(EXITED_KEY, JSON.stringify(rows));
        renderExited();
        renderMetrics();
      });
    });
    tbody.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => openEditClosedTrade(btn.getAttribute('data-edit')));
    });
  }

  function openEditClosedTrade(id) {
    const rows = readJsonArr(EXITED_KEY);
    const idx = rows.findIndex((row) => row.id === id);
    if (idx < 0) return;
    const row = rows[idx];
    Modal.open({
      title: 'Edit Closed Trade',
      body: `
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Sell Price</label>
            <input type="number" class="form-input" id="pt-edit-sell" min="0.01" step="0.01" value="${Number(row.soldPrice || 0)}" />
          </div>
          <div class="form-group">
            <label class="form-label">Holding Days</label>
            <input type="number" class="form-input" id="pt-edit-days" min="0" step="1" value="${Math.floor(Number(row.holdingDays || 0))}" />
          </div>
        </div>
      `,
      footer: `<button class="btn-secondary" id="pt-edit-cancel">Cancel</button><button class="btn-primary" id="pt-edit-save">Save</button>`,
    });
    const box = document.getElementById('modalBox');
    box.querySelector('#pt-edit-cancel')?.addEventListener('click', Modal.close);
    box.querySelector('#pt-edit-save')?.addEventListener('click', () => {
      const sellPrice = Number(box.querySelector('#pt-edit-sell')?.value || 0);
      const holdingDays = Math.floor(Number(box.querySelector('#pt-edit-days')?.value || 0));
      if (!isFinite(sellPrice) || sellPrice <= 0 || !isFinite(holdingDays) || holdingDays < 0) return;
      const prevShort = Math.floor(Number(row.holdingDays || 0)) <= 365;
      const nextShort = holdingDays <= 365;
      if (prevShort !== nextShort) {
        Modal.open({
          title: 'Holding Period Rule',
          body: '<p style="color:var(--text-secondary);">Short-term and long-term categories cannot be switched. Keep the holding days within the same category.</p>',
          footer: `<button class="btn-primary" onclick="Modal.close()">OK</button>`,
        });
        return;
      }
      const calc = window.PmsTradeMath.calculateRoundTrip({
        buyPrice: Number(row.buyPrice || 0),
        soldPrice: sellPrice,
        qty: Number(row.qty || 0),
        holdingDays,
      });
      rows[idx] = {
        ...row,
        soldPrice,
        holdingDays,
        total: sellPrice * Number(row.qty || 0),
        soldTotal: Number(calc.realizedAmount || 0),
        netSoldTotal: Number(calc.netRealizedAmount || calc.realizedAmount || 0),
        grossProfit: Number(calc.grossProfit || 0),
        capitalGainTax: Number(calc.capitalGainTax || 0),
        profit: Number(calc.netProfit || calc.profit || 0),
        perDayProfit: holdingDays > 0 ? Number(calc.netProfit || calc.profit || 0) / holdingDays : Number(calc.netProfit || calc.profit || 0),
      };
      localStorage.setItem(EXITED_KEY, JSON.stringify(rows));
      Modal.close();
      renderExited();
      renderMetrics();
    });
  }

  function renderMetrics() {
    const el = container.querySelector('#pt-metrics');
    const summary = Analytics.getSummary();
    el.innerHTML = `
      <div class="metric-card"><div class="metric-label">Total Invested</div><div class="metric-value">${currency(summary.totalInvested)}</div></div>
      <div class="metric-card"><div class="metric-label">Net Profit</div><div class="metric-value ${plClass(summary.totalProfit)}">${currency(summary.totalProfit)}</div></div>
      <div class="metric-card"><div class="metric-label">Total Tax Paid</div><div class="metric-value value-amber">${currency(summary.totalTax)}</div></div>
      <div class="metric-card"><div class="metric-label">ROI</div><div class="metric-value ${plClass(summary.roi)}">${pct(summary.roi)}</div></div>
      <div class="metric-card"><div class="metric-label">Win Rate</div><div class="metric-value">${pct(summary.winRate)}</div></div>
      <div class="metric-card"><div class="metric-label">Total Trades</div><div class="metric-value">${summary.count}</div></div>
      <div class="metric-card"><div class="metric-label">Avg Hold Days</div><div class="metric-value">${Math.round(summary.avgHolding)}</div></div>
    `;
  }

  function normalizeExited(row) {
    const calc = window.PmsTradeMath.calculateRoundTrip({ buyPrice: row.buyPrice, soldPrice: row.soldPrice || 0, qty: row.qty, holdingDays: row.holdingDays });
    const profit = Number(calc.netProfit || calc.profit || row.profit || 0);
    const capitalGainTax = Number(calc.capitalGainTax || row.capitalGainTax || 0);
    const holdingDays = Math.floor(Number(row.holdingDays || 0));
    const buy = calc.buy || {}, sell = calc.sell || {};
    return {
      ...row, capitalGainTax, profit, holdingDays,
      soldTotal: Number(calc.realizedAmount || row.soldTotal || 0),
      total: Number(row.total || (Number(row.soldPrice || 0) * Number(row.qty || 0))),
      buyTotal: Number(calc.invested || row.buyTotal || 0),
      netSoldTotal: Number(calc.netRealizedAmount || row.netSoldTotal || 0),
      grossProfit: Number(calc.grossProfit || row.grossProfit || 0),
      perDayProfit: holdingDays > 0 ? profit / holdingDays : profit,
    };
  }

  function sortExited(a, b) {
    const val = obj => {
      switch (sortKey) {
        case 'name':         return String(obj.name || '').toLowerCase();
        case 'type':         return String(obj.type || '').toLowerCase();
        case 'buyPrice':     return Number(obj.buyPrice || 0);
        case 'soldPrice':    return Number(obj.soldPrice || 0);
        case 'qty':          return Number(obj.qty || 0);
        case 'buyTotal':     return Number(obj.buyTotal || 0);
        case 'soldTotal':    return Number(obj.soldTotal || 0);
        case 'netSoldTotal': return Number(obj.netSoldTotal || 0);
        case 'capitalGainTax': return Number(obj.capitalGainTax || 0);
        case 'profit':       return Number(obj.profit || 0);
        case 'holdingDays':  return Number(obj.holdingDays || 0);
        case 'perDayProfit': return Number(obj.perDayProfit || 0);
        default:             return Number(obj.profit || 0);
      }
    };
    const av = val(a), bv = val(b);
    return typeof av === 'string' ? av.localeCompare(bv) * sortDir : (av - bv) * sortDir;
  }

  function getActiveRecords(type) {
    const builders = {
      trades: () => readJsonArr('trades').map(r => ({
        id: `t-${r.id}`, rawId: r.id, source: 'Trade', name: r.script || 'Trade',
        qty: Number(r.qty || 0), buyPrice: Number(r.wacc || 0), currentPrice: Number(r.ltp || 0), ref: 'trades',
      })),
      longterm: () => readJsonArr('longterm').map(r => ({
        id: `l-${r.id}`, rawId: r.id, source: 'Long Term', name: r.script || 'Holding',
        qty: Number(r.qty || 0), buyPrice: Number(r.wacc || 0), currentPrice: Number(r.ltp || 0), ref: 'longterm',
      })),
      sip: () => {
        const sipState = readSipState();
        return sipState.sips.map(sipName => {
          const rows = Array.isArray(sipState.records[sipName]) ? sipState.records[sipName] : [];
          const qty = rows.reduce((s, r) => s + Number(r.units || 0), 0);
          const amount = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
          const wacc = qty > 0 ? amount / qty : 0;
          return {
            id: `s-${sipName}`, rawId: sipName, source: 'SIP', name: sipName,
            qty, buyPrice: wacc, currentPrice: Number(sipState.currentNav[sipName] || 0), ref: 'sip',
          };
        }).filter(r => Number(r.qty || 0) > 0);
      },
    };
    return ((builders[type] || (() => []))()).sort((a, b) => String(b.name).localeCompare(String(a.name)));
  }

  function removeRecord(record, soldQty) {
    if (record.ref === 'trades' || record.ref === 'longterm') {
      const key = record.ref === 'trades' ? 'trades' : 'longterm';
      const rows = readJsonArr(key);
      const idx = rows.findIndex(r => r.id === record.rawId);
      if (idx < 0) return;
      const next = Math.floor(Number(rows[idx].qty || 0)) - Math.floor(Number(soldQty || 0));
      if (next <= 0) rows.splice(idx, 1);
      else rows[idx].qty = next;
      localStorage.setItem(key, JSON.stringify(rows));
    } else if (record.ref === 'sip') {
      const state = readSipState();
      state.records[record.rawId] = [];
      state.currentNav[record.rawId] = 0;
      localStorage.setItem('sipStateV4', JSON.stringify(state));
    }
    window.dispatchEvent(new CustomEvent('pms-portfolio-updated'));
  }

  function readSipState() {
    const fallback = { sips: [], records: {}, currentNav: {} };
    try {
      const s = JSON.parse(localStorage.getItem('sipStateV4') || 'null');
      if (!s || !Array.isArray(s.sips)) return fallback;
      return { sips: s.sips, records: s.records || {}, currentNav: s.currentNav || {} };
    } catch { return fallback; }
  }
}

window._renderPastTrades = renderPastTrades;
