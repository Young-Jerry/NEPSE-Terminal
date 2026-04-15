/**
 * SIP / Mutual Fund View
 * Fully preserves all original mf.js financial logic
 */
function renderSip(container) {
  const SIP_KEY = 'sipStateV4';

  let state = readState();
  let activeSip = (state.activeSip && (state.activeSip === 'ALL_SIP' || state.sips.includes(state.activeSip)))
    ? state.activeSip : 'ALL_SIP';

  container.innerHTML = `
    <div class="section-header mb16">
      <div>
        <div class="section-title">SIP / Mutual Funds</div>
        <div class="section-sub">Systematic Investment Plan tracker · click a history row to view details</div>
      </div>
      <span class="save-indicator" id="sip-save-ind">Saved ✓</span>
    </div>

    <!-- SIP Tabs -->
    <div class="sip-tabs" id="sipTabs"></div>

    <!-- Summary -->
    <div class="metrics-grid" id="sip-metrics"></div>

    <!-- Controls Row -->
    <div class="dashboard-row" style="grid-template-columns:1.35fr 1fr;" id="sipControlRow">
      <!-- NAV + SIP Setup -->
      <div class="add-panel">
        <div class="add-panel-title">Update Current NAV</div>
        <form id="sip-nav-form" autocomplete="off">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">SIP</label>
              <select class="form-select" name="sipName" id="sip-nav-select"></select>
            </div>
            <div class="form-group">
              <label class="form-label">Current NAV</label>
              <input type="number" class="form-input" name="nav" min="0.01" step="0.01" placeholder="15.00" />
            </div>
            <div class="form-group" style="align-self:end;">
              <button type="submit" class="btn-primary" style="width:100%;">Update</button>
            </div>
          </div>
        </form>

        <div style="height:1px;background:var(--border);margin:14px 0;"></div>

        <div class="add-panel-title" style="margin-bottom:10px;">Add SIP</div>
        <form id="sip-add-form" autocomplete="off">
          <div class="form-grid" style="grid-template-columns:1fr auto;">
            <div class="form-group">
              <label class="form-label">SIP Name</label>
              <input type="text" class="form-input" name="newSipName" placeholder="e.g. NIFRA" />
            </div>
            <div class="form-group" style="align-self:end;">
              <button type="submit" class="btn-primary">Add</button>
            </div>
          </div>
        </form>

        <button class="btn-danger mt16" id="sip-delete-btn" style="font-size:11px;">Delete Selected SIP</button>
      </div>

      <!-- Add Installment -->
      <div class="add-panel">
        <div class="add-panel-title">Add Installment</div>
        <form id="sip-inst-form" autocomplete="off">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">SIP</label>
              <select class="form-select" name="sipName" id="sip-inst-select"></select>
            </div>
            <div class="form-group">
              <label class="form-label">Date</label>
              <input type="date" class="form-input" name="date" id="sip-inst-date" />
            </div>
            <div class="form-group">
              <label class="form-label">Units</label>
              <input type="number" class="form-input" name="units" min="1" step="1" placeholder="50" />
            </div>
            <div class="form-group">
              <label class="form-label">NAV</label>
              <input type="number" class="form-input" name="nav" min="0.01" step="0.01" placeholder="12.00" />
            </div>
            <div class="form-group" style="align-self:end;">
              <button type="submit" class="btn-primary" style="width:100%;">Add</button>
            </div>
          </div>
        </form>
      </div>
    </div>

    <!-- Table -->
    <div class="table-wrapper mt8" id="sip-table-wrap">
      <table>
        <thead id="sip-thead">
          <tr></tr>
        </thead>
        <tbody id="sip-tbody"></tbody>
      </table>
    </div>
    <div id="sip-msg" style="font-size:12px;color:var(--amber);margin-top:8px;"></div>
  `;

  const addForm  = container.querySelector('#sip-add-form');
  const instForm = container.querySelector('#sip-inst-form');
  const navForm  = container.querySelector('#sip-nav-form');
  const delBtn   = container.querySelector('#sip-delete-btn');
  const tabsEl   = container.querySelector('#sipTabs');
  const msgEl    = container.querySelector('#sip-msg');
  const saveInd  = container.querySelector('#sip-save-ind');

  addForm.addEventListener('submit', e => {
    e.preventDefault();
    const name = addForm.elements.newSipName.value.trim().toUpperCase();
    if (!name) return show('Enter a SIP name.');
    if (state.sips.includes(name)) return show('SIP already exists.');
    state.sips.push(name);
    state.records[name] = state.records[name] || [];
    state.currentNav[name] = 0;
    state.registeredAt = state.registeredAt || {};
    state.registeredAt[name] = month15(todayMonth());
    activeSip = name;
    addForm.reset();
    persist('SIP added.');
  });

  instForm.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(instForm);
    const sipName = String(fd.get('sipName'));
    const date    = String(fd.get('date'));
    const month   = monthFromDate(date);
    const units   = Math.floor(num(fd.get('units')));
    const nav     = num(fd.get('nav'));
    if (!sipName || !isValidDate(date)) return show('Select a valid date.');
    if (!isFinite(units) || !isFinite(nav) || units <= 0 || nav <= 0) return show('Invalid QTY/NAV.');
    if (!isMonthAllowed(sipName, month)) return show(`Month must be on/after ${minimumMonthForSip(sipName)}.`);
    if (monthExists(sipName, month)) return show('Month already paid for this SIP.');
    const amount = units * nav;
    pickFundingSource(amount, (source) => {
      addEntry(sipName, { id: crypto.randomUUID(), date, units, nav }, source);
      instForm.reset();
      persist('Installment added.');
    });
  });

  navForm.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(navForm);
    const sipName = String(fd.get('sipName'));
    const nav = num(fd.get('nav'));
    if (!isFinite(nav) || nav <= 0) return;
    state.currentNav[sipName] = nav;
    persist('NAV updated.');
  });

  const navSelectEl = container.querySelector('#sip-nav-select');
  if (navSelectEl) {
    navSelectEl.addEventListener('change', () => {
      if (navForm?.elements?.nav) navForm.elements.nav.value = '';
    });
  }

  delBtn.addEventListener('click', () => {
    if (!activeSip || activeSip === 'ALL_SIP') return show('Select a SIP to delete.');
    Modal.confirm({
      title: `Delete ${activeSip}`,
      message: `This will refund the invested amount and remove all installment records.`,
      confirmText: 'Delete SIP',
      onConfirm: () => {
        const refund = (state.records[activeSip] || []).reduce((s, r) => s + Number(r.amount || 0), 0);
        if (window.PmsCapital && refund) window.PmsCapital.adjustCash(refund);
        state.sips = state.sips.filter(s => s !== activeSip);
        delete state.records[activeSip];
        delete state.currentNav[activeSip];
        activeSip = 'ALL_SIP';
        persist('SIP deleted.');
      },
    });
  });

  render();

  function render() {
    renderTabs();
    renderSelects();
    renderMetrics();
    renderTable();
    updateSaveInd();
  }

  function renderTabs() {
    tabsEl.innerHTML = '';
    const allBtn = makeTabBtn('ALL_SIP', 'All SIPs');
    tabsEl.appendChild(allBtn);
    state.sips.forEach(name => tabsEl.appendChild(makeTabBtn(name, name)));
  }

  function makeTabBtn(value, label) {
    const btn = document.createElement('button');
    btn.className = 'sip-tab-btn' + (activeSip === value ? ' active' : '');
    btn.textContent = label;
    btn.addEventListener('click', () => {
      activeSip = value;
      if (navForm) navForm.reset();
      render();
    });
    return btn;
  }

  function renderSelects() {
    const opts = state.sips.map(n => `<option value="${escHtml(n)}">${escHtml(n)}</option>`).join('');
    const instSelect = container.querySelector('#sip-inst-select');
    const navSelect = container.querySelector('#sip-nav-select');
    instSelect.innerHTML = opts;
    navSelect.innerHTML = opts;
    if (activeSip !== 'ALL_SIP' && state.sips.includes(activeSip)) {
      instSelect.value = activeSip;
      navSelect.value = activeSip;
    }
    const navInput = navForm?.elements?.nav;
    if (navInput) navInput.value = '';
    // Set today in date input if empty
    const dateInput = container.querySelector('#sip-inst-date');
    if (dateInput && !dateInput.value) dateInput.value = todayDate();
  }

  function renderMetrics() {
    const el = container.querySelector('#sip-metrics');
    const sips = activeSip === 'ALL_SIP' ? state.sips : [activeSip];

    let totalUnits = 0, totalInvested = 0, totalValue = 0;
    sips.forEach(name => {
      const rows = state.records[name] || [];
      const u = rows.reduce((s, r) => s + Number(r.units || 0), 0);
      const inv = rows.reduce((s, r) => s + Number(r.amount || (Number(r.units || 0) * Number(r.nav || 0))), 0);
      const nav = Number(state.currentNav[name] || 0);
      totalUnits    += u;
      totalInvested += inv;
      totalValue    += u * nav;
    });

    const pl = totalValue - totalInvested;
    const roi = totalInvested > 0 ? (pl / totalInvested) * 100 : 0;

    const selectedSipNavCard = activeSip !== 'ALL_SIP'
      ? `
      <div class="metric-card">
        <div class="metric-label">Selected SIP NAV</div>
        <div class="metric-value mono">Rs ${fmtNav(Number(state.currentNav[activeSip] || 0))}</div>
      </div>`
      : '';

    el.innerHTML = `
      ${selectedSipNavCard}
      <div class="metric-card">
        <div class="metric-label">Total Units</div>
        <div class="metric-value">${new Intl.NumberFormat('en-IN').format(Math.floor(totalUnits))}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Total Invested</div>
        <div class="metric-value">${currency(totalInvested)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Current Value</div>
        <div class="metric-value">${currency(totalValue)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Unrealized P/L</div>
        <div class="metric-value ${plClass(pl)}">${currency(pl)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">ROI</div>
        <div class="metric-value ${plClass(roi)}">${pct(roi)}</div>
      </div>
    `;
  }

  function renderTable() {
    const thead = container.querySelector('#sip-thead tr');
    const tbody = container.querySelector('#sip-tbody');
    thead.innerHTML = '';
    tbody.innerHTML = '';

    const sips = activeSip === 'ALL_SIP' ? state.sips : [activeSip];
    const cols = activeSip === 'ALL_SIP'
      ? ['SIP', 'Units', 'WACC', 'Amt', 'CurrentNAV', 'CurrentValue', 'P/L']
      : ['Date','Units','NAV','Amount','Current NAV','Current Value','P/L'];

    cols.forEach(c => { const th = document.createElement('th'); th.textContent = c; thead.appendChild(th); });

    sips.forEach(sipName => {
      const rows = [...(state.records[sipName] || [])].sort((a, b) => a.date.localeCompare(b.date));
      const currentNav = Number(state.currentNav[sipName] || 0);

      if (activeSip === 'ALL_SIP') {
        const units = rows.reduce((s, r) => s + Math.floor(Number(r.units || 0)), 0);
        const amount = rows.reduce((s, r) => s + (Math.floor(Number(r.units || 0)) * Number(r.nav || 0)), 0);
        const wacc = units > 0 ? amount / units : 0;
        const currentValue = units * currentNav;
        const pl = currentValue - amount;
        const tr = document.createElement('tr');
        [sipName, fmtQty(units), fmtNav(wacc), currency(amount), fmtNav(currentNav), currency(currentValue)].forEach((val, i) => {
          const td = document.createElement('td');
          td.textContent = val;
          if (i === 0) td.classList.add('text-col');
          tr.appendChild(td);
        });
        const plTd = document.createElement('td');
        plTd.textContent = currency(pl);
        plTd.className = plClass(pl);
        tr.appendChild(plTd);
        tbody.appendChild(tr);
        return;
      }

      rows.forEach(row => {
        const amount = Math.floor(Number(row.units || 0)) * Number(row.nav || 0);
        const currentValue = Math.floor(Number(row.units || 0)) * currentNav;
        const pl = currentValue - amount;
        const tr = document.createElement('tr');

        const cells = activeSip === 'ALL_SIP'
          ? [sipName, row.date, Math.floor(row.units), fmtNav(row.nav), currency(amount), fmtNav(currentNav), currency(currentValue), null]
          : [row.date, Math.floor(row.units), fmtNav(row.nav), currency(amount), fmtNav(currentNav), currency(currentValue), null];

        cells.forEach((val, i) => {
          const td = document.createElement('td');
          if (val === null) {
            td.textContent = currency(pl);
            td.className = plClass(pl);
          } else {
            td.textContent = val;
            if (val === sipName) td.classList.add('text-col');
          }
          tr.appendChild(td);
        });

        tr.style.cursor = 'pointer';
        tr.title = 'View installment details';
        tr.addEventListener('click', () => showInstallmentDetail(sipName, row, currentNav));
        tbody.appendChild(tr);
      });
    });

    if (!tbody.children.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = cols.length;
      td.innerHTML = `<div class="empty-state" style="padding:24px;"><div class="empty-state-icon" style="font-size:24px;">💸</div><div class="empty-state-title">No installments yet</div><div class="empty-state-sub">Add your first installment above.</div></div>`;
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
  }

  function showInstallmentDetail(sipName, row, currentNav) {
    if (!window.Modal) return;
    const amount = Math.floor(Number(row.units || 0)) * Number(row.nav || 0);
    const currentValue = Math.floor(Number(row.units || 0)) * currentNav;
    const pl = currentValue - amount;
    Modal.open({
      title: `${sipName} Installment`,
      body: `<div style="display:grid;gap:8px;font-family:var(--font-mono);font-size:12px;">
        <div>Date: <strong>${row.date}</strong></div>
        <div>Units: <strong>${Math.floor(row.units)}</strong></div>
        <div>NAV Paid: <strong>${fmtNav(row.nav)}</strong></div>
        <div>Amount Paid: <strong>${currency(amount)}</strong></div>
        <div>Current NAV: <strong>${fmtNav(currentNav)}</strong></div>
        <div>Current Value: <strong>${currency(currentValue)}</strong></div>
        <div>P/L: <strong class="${plClass(pl)}">${currency(pl)}</strong></div>
      </div>`,
      footer: `<button class="btn-danger" id="sip-row-del">Delete Entry</button><button class="btn-secondary" onclick="Modal.close()">Close</button>`,
    });
    const btn = document.getElementById('sip-row-del');
    if (btn) btn.addEventListener('click', () => {
      Modal.confirm({
        title: 'Delete SIP installment',
        message: `Delete installment dated ${row.date} from ${sipName}?`,
        confirmText: 'Delete',
        onConfirm: () => {
          state.records[sipName] = (state.records[sipName] || []).filter(r => r.id !== row.id);
          if (window.PmsCapital) {
            if (row.fundingSource === 'profit') {
              window.PmsCapital.adjustProfitCashed(amount, {
                note: `${sipName} installment deleted`,
                type: 'profit_refund',
                kind: 'system',
                editable: false,
              });
            } else {
              window.PmsCapital.adjustCash(amount);
            }
          }
          Modal.close();
          persist('Installment deleted.');
        },
      });
    });
  }

  function addEntry(sipName, entry, fundingSource = 'cash') {
    state.records[sipName] = state.records[sipName] || [];
    const nav = Number(entry.nav || 0);
    const units = Math.floor(Number(entry.units || 0));
    const amount = units * nav;
    state.records[sipName].push({ ...entry, units, nav, amount, fundingSource });
    if (window.PmsCapital) {
      if (fundingSource === 'profit') window.PmsCapital.adjustProfitCashed(-amount, {
        note: `${sipName} installment added`,
        type: 'profit_used',
        kind: 'system',
        editable: false,
      });
      else window.PmsCapital.adjustCash(-amount);
    }
  }

  function pickFundingSource(amount, onConfirm) {
    if (!window.PmsCapital || !window.Modal) { onConfirm('cash'); return; }
    const cashBalance = Number(window.PmsCapital.readCash() || 0);
    const profitBalance = Number(window.PmsCapital.readProfitCashedOut() || 0);
    const hasCash = cashBalance >= amount;
    const hasProfit = profitBalance >= amount;
    if (!hasCash && !hasProfit) return show('Not enough cash or profit cashed balance.');
    if (hasCash && !hasProfit) { onConfirm('cash'); return; }
    if (!hasCash && hasProfit) { onConfirm('profit'); return; }

    Modal.open({
      title: 'Choose Balance',
      subtitle: 'Select one balance to fund this SIP entry',
      body: `
        <div style="display:grid;gap:10px;font-family:var(--font-mono);font-size:12px;">
          <div>Required: <strong>${currency(amount)}</strong></div>
          <label style="display:flex;align-items:center;gap:8px;">
            <input type="radio" name="sip-funding-source" value="cash" checked />
            <span>Cash Balance — <strong>${currency(cashBalance)}</strong></span>
          </label>
          <label style="display:flex;align-items:center;gap:8px;">
            <input type="radio" name="sip-funding-source" value="profit" />
            <span>Profit Cashed Balance — <strong>${currency(profitBalance)}</strong></span>
          </label>
        </div>
      `,
      footer: `<button class="btn-secondary" id="sip-fund-cancel">Cancel</button><button class="btn-primary" id="sip-fund-confirm">Use Balance</button>`,
    });
    const box = document.getElementById('modalBox');
    box.querySelector('#sip-fund-cancel')?.addEventListener('click', Modal.close);
    box.querySelector('#sip-fund-confirm')?.addEventListener('click', () => {
      const source = box.querySelector('input[name="sip-funding-source"]:checked')?.value || 'cash';
      Modal.close();
      onConfirm(source);
    });
  }

  function isMonthAllowed(sipName, month) {
    const min = minimumMonthForSip(sipName);
    return month >= min;
  }

  function minimumMonthForSip(sipName) {
    const reg = (state.registeredAt || {})[sipName];
    if (reg) return reg.slice(0, 7);
    return '2000-01';
  }

  function monthExists(sipName, month) {
    return (state.records[sipName] || []).some(r => monthFromDate(r.date) === month);
  }

  function monthFromDate(date) { return String(date || '').slice(0, 7); }
  function isValidDate(date) { return /^\d{4}-\d{2}-\d{2}$/.test(date); }
  function todayMonth() { return new Date().toISOString().slice(0, 7); }
  function todayDate()  { return new Date().toISOString().slice(0, 10); }
  function month15(month) { return `${month}-15`; }
  function fmtNav(v) { return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0); }
  function fmtQty(v) { return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(v || 0); }

  function persist(msg = 'Saved ✓') {
    state.activeSip = activeSip;
    localStorage.setItem(SIP_KEY, JSON.stringify(state));
    show(msg);
    render();
    window.dispatchEvent(new CustomEvent('pms-portfolio-updated'));
  }

  function show(text) { msgEl.textContent = text; setTimeout(() => { if (msgEl.textContent === text) msgEl.textContent = ''; }, 3000); }

  function updateSaveInd() {
    saveInd.classList.add('visible');
    setTimeout(() => saveInd.classList.remove('visible'), 1500);
  }

  function readState() {
    const LEGACY_KEYS = ['sipStateV3', 'sipStateV2', 'sipData'];
    try {
      const raw = localStorage.getItem(SIP_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.sips)) return normalizeState(parsed);
      }
    } catch {}
    // Try legacy
    for (const key of LEGACY_KEYS) {
      try {
        const legacy = JSON.parse(localStorage.getItem(key) || 'null');
        if (!legacy) continue;
        if ((key === 'sipStateV3' || key === 'sipStateV2') && Array.isArray(legacy.sips)) return normalizeState(legacy);
        if (key === 'sipData' && Array.isArray(legacy)) {
          return normalizeState({ sips: ['SIP'], records: { SIP: legacy }, currentNav: {} });
        }
      } catch {}
    }
    return normalizeState({ sips: [], records: {}, currentNav: {} });
  }

  function normalizeState(input) {
    const sips = Array.from(new Set((input.sips || []).map(s => String(s || '').trim().toUpperCase()).filter(Boolean)));
    const records = {}, currentNav = { ...(input.currentNav || {}) };
    const registeredAt = { ...(input.registeredAt || {}) };
    sips.forEach(sip => {
      records[sip] = Array.isArray((input.records || {})[sip])
        ? input.records[sip].map(r => ({
          id: r.id || crypto.randomUUID(),
          date: String(r.date || month15(todayMonth())),
          units: Math.floor(Number(r.units || (Number(r.amount || 0) / Number(r.nav || 1)))),
          nav: Number(r.nav || 0),
          amount: Math.floor(Number(r.units || (Number(r.amount || 0) / Number(r.nav || 1)))) * Number(r.nav || 0),
        }))
        : [];
      records[sip].sort((a, b) => a.date.localeCompare(b.date));
      if (!registeredAt[sip]) {
        registeredAt[sip] = records[sip][0]?.date || month15(todayMonth());
      }
      if (!isFinite(currentNav[sip])) {
        currentNav[sip] = records[sip].length ? records[sip][records[sip].length - 1].nav : 0;
      }
    });
    return { sips, records, currentNav, registeredAt, activeSip: input.activeSip || 'ALL_SIP' };
  }
}

window._renderSip = renderSip;
