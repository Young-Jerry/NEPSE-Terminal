/**
 * NEPSE Terminal v4 — Dashboard View
 */
(function() {
  function maskDigits(value) {
    return window.PmsPrivacy && window.PmsPrivacy.maskDigits ? window.PmsPrivacy.maskDigits(value) : String(value || '');
  }
  function maskValue() {
    return window.PmsPrivacy && window.PmsPrivacy.maskValue ? window.PmsPrivacy.maskValue() : 'XXX';
  }
  function fmt(n, dec = 0) {
    const out = new Intl.NumberFormat('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(Number(n || 0));
    return window.PmsPrivacy && window.PmsPrivacy.isEnabled && window.PmsPrivacy.isEnabled() ? maskValue() : out;
  }
  function fmtRs(n, dec = 0) {
    if (window.PmsPrivacy && window.PmsPrivacy.isEnabled && window.PmsPrivacy.isEnabled()) return maskValue();
    const prefix = window.PmsDisplay && window.PmsDisplay.showRsPrefix && !window.PmsDisplay.showRsPrefix() ? '' : 'Rs ';
    return `${prefix}${fmt(n, dec)}`;
  }
  function fmtPct(n, dec = 2) {
    const out = `${Number(n || 0).toFixed(dec)}%`;
    return window.PmsPrivacy && window.PmsPrivacy.isEnabled && window.PmsPrivacy.isEnabled() ? maskValue() : out;
  }
  function plCls(v) { return Number(v) > 0 ? 'profit' : Number(v) < 0 ? 'loss' : ''; }
  function plSign() { return ''; }
  function hasFinite(v) { return Number.isFinite(Number(v)); }

  function readArr(key) {
    try {
      const p = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }

  function readSipState() {
    try {
      const p = JSON.parse(localStorage.getItem('sipStateV4') || '{}');
      return p && typeof p === 'object' ? p : {};
    } catch {
      return {};
    }
  }

  function readSipDueDay() {
    return window.PmsSettings && window.PmsSettings.getSipDueDay ? window.PmsSettings.getSipDueDay() : null;
  }

  function daysUntilSipDueDay(dueDay) {
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28) return null;
    const now = new Date();
    const d = now.getDate();
    if (d === dueDay) return 0;
    const target = d < dueDay ? new Date(now.getFullYear(), now.getMonth(), dueDay) : new Date(now.getFullYear(), now.getMonth() + 1, dueDay);
    return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  }

  function getRealizedRoi() {
    const exited = readArr('exitedTradesV2');
    const totalInvested = exited.reduce((s, r) => s + Number(r.buyTotal || 0), 0);
    const totalProfit = exited.reduce((s, r) => s + Number(r.profit || 0), 0);
    const roi = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;
    return { roi, totalProfit, totalInvested, count: exited.length };
  }

  function getSipEntryMonths() {
    const sipState = readSipState();
    const sips = Array.isArray(sipState.sips) ? sipState.sips : [];
    return sips.map((name) => {
      const rows = Array.isArray((sipState.records || {})[name]) ? (sipState.records || {})[name] : [];
      return { name, months: rows.length };
    });
  }

  function calcSellReceivable(row, kind) {
    const holdingDays = kind === 'long' ? 366 : 0;
    const calc = window.PmsTradeMath
      ? window.PmsTradeMath.calculateRoundTrip({ buyPrice: Number(row.wacc || 0), soldPrice: Number(row.ltp || 0), qty: Number(row.qty || 0), holdingDays })
      : { netRealizedAmount: 0 };
    return Number(calc.netRealizedAmount || calc.realizedAmount || 0);
  }

  function toEnrichedRows(key, filter = '', kind = 'trade') {
    return readArr(key).map(r => {
      const qty = Number(r.qty || 0);
      const ltp = Number(r.ltp || 0);
      const wacc = Number(r.wacc || 0);
      const invested = qty * wacc;
      const current = qty * ltp;
      const pl = current - invested;
      const sell = calcSellReceivable({ qty, ltp, wacc }, kind);
      return { ...r, qty, ltp, wacc, invested, current, pl, sell, roi: invested > 0 ? (pl / invested) * 100 : 0 };
    }).filter(r => !filter || String(r.script || '').toLowerCase().includes(filter.toLowerCase()));
  }

  function getTopNBySort(key, sortBy, n = 3, filter = '', kind = 'trade') {
    const rows = toEnrichedRows(key, filter, kind);

    const sorters = {
      script: (a, b) => String(a.script || '').localeCompare(String(b.script || '')),
      qty: (a, b) => a.qty - b.qty,
      ltp: (a, b) => a.ltp - b.ltp,
      invested: (a, b) => a.invested - b.invested,
      pl: (a, b) => a.pl - b.pl,
      sell: (a, b) => a.sell - b.sell,
      roi: (a, b) => a.roi - b.roi,
    };

    const dir = sortBy.dir === 'desc' ? -1 : 1;
    return rows.sort((a, b) => (sorters[sortBy.key] || sorters.script)(a, b) * dir).slice(0, n);
  }

  function renderDashboard(container) {
    const totals = window.Analytics ? window.Analytics.getPortfolioTotals() : { total: 0, trades: { pl: 0, invested: 0, value: 0 }, longterm: { pl: 0, invested: 0, value: 0 }, sip: { pl: 0 } };
    const cash = window.PmsCapital ? window.PmsCapital.readCash() : 0;
    const life = (()=>{try{return JSON.parse(localStorage.getItem('sm_lifeos_daily_v1')||'{}')}catch{return {}}})();
    const d = new Date().toISOString().slice(0,10);
    const today = life[d] || { mood:'focused', notes:'', activities:[] };
    const score = (today.activities||[]).reduce((s,a)=>s+Number(a.hours||0)*Number(a.weight||0),0)+Number(today.noTradeDisciplined?2:0);
    const entries = Object.entries(life).slice(-30);
    const monthProfit = Number(totals.trades.pl || 0) + Number(totals.longterm.pl || 0);
    container.innerHTML = `<div class='md-kpis'>${[
      ['Net Worth',fmtRs(Number(totals.total||0),0)],['Monthly Profitability',fmtRs(monthProfit,0)],['Cashflow',fmtRs(cash,0)],
      ['Discipline Score',score.toFixed(1)],['Current Streak',String(entries.filter(([,v])=>((v.activities||[]).length)).length)],['Current Focus',today.mood||'focused']
    ].map(k=>`<div class='md-kpi'><div>${k[0]}</div><strong>${k[1]}</strong></div>`).join('')}</div>
    <div class='md-grid'><section class='md-panel'><h3>Daily Performance Tracker</h3><div class='md-score ${score>=0?'profit':'loss'}'>${score.toFixed(1)}</div><p>${today.notes||'No notes recorded today.'}</p><button class='btn-secondary' onclick=\"window.navigateTo('discipline')\">Edit Today</button></section>
    <section class='md-panel'><h3>Monthly Performance Calendar</h3><div class='md-calendar'>${entries.map(([date,v])=>{const s=(v.activities||[]).reduce((x,a)=>x+Number(a.hours||0)*Number(a.weight||0),0)+Number(v.noTradeDisciplined?2:0);const cls=s>=8?'good':s>=2?'mixed':s>=0?'neutral':'bad';return `<button class='day ${cls}' title='${date} | ${v.mood||"focused"} | score ${s.toFixed(1)}' data-date='${date}'>${date.slice(-2)}</button>`;}).join('')}</div></section>
    <section class='md-panel'><h3>Recent Journals + Lessons</h3><div class='md-archive'>${entries.slice(-5).reverse().map(([date,v])=>`<div class='arch-row'><span>${date}</span><strong>${v.mood||'focused'}</strong><small>${(v.notes||'').slice(0,64)||'No reflection logged.'}</small></div>`).join('')}</div>
    <h3>Skill Snapshot</h3><button class='btn-secondary' onclick=\"window.navigateTo('skillprogress')\">Open Skill Progress</button></section></div>`;
  }

  function buildSipRoiCards() {
    const sipState = readSipState();
    const sipNames = Array.isArray(sipState.sips) ? sipState.sips : [];
    if (!sipNames.length) {
      return `
        <div class="dash-sip-roi-item">
          <span class="dash-sip-roi-name">No SIP added</span>
          <span class="dash-sip-roi-val">-</span>
        </div>
      `;
    }
    return sipNames.map(name => {
      const rows = Array.isArray((sipState.records || {})[name]) ? sipState.records[name] : [];
      const units = rows.reduce((s, r) => s + Math.floor(Number(r.units || 0)), 0);
      const invested = rows.reduce((s, r) => s + (Math.floor(Number(r.units || 0)) * Number(r.nav || 0)), 0);
      const currentNav = Number((sipState.currentNav || {})[name] || 0);
      const currentValue = units * currentNav;
      const profit = currentValue - invested;
      const roi = invested > 0 ? (profit / invested) * 100 : 0;
      const cls = roi > 0 ? 'profit' : roi < 0 ? 'loss' : '';
      const tip = `Invested: ${fmtRs(invested, 0)} | Profit: ${fmtRs(profit, 0)}`;
      return `
        <div class="dash-sip-roi-item">
          <span class="dash-sip-roi-name">${name} ROI</span>
          <span class="dash-sip-roi-val ${cls}" title="${tip}">${plSign(roi)}${fmtPct(roi, 2)}</span>
        </div>
      `;
    }).join('');
  }

  function bindSortClicks(container, prefix, onClick) {
    container.querySelectorAll(`[data-sort-prefix="${prefix}"]`).forEach(th => {
      th.addEventListener('click', () => onClick(th.dataset.sortKey));
    });
  }

  function nextSort(current, key) {
    if (current.key === key) return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
    return { key, dir: 'asc' };
  }

  function renderTopTable(rows, sort, prefix) {
    const icon = key => sort.key === key ? (sort.dir === 'asc' ? '↑' : '↓') : '';
    if (!rows.length) return `<div style="padding:16px 12px;font-family:var(--font-mono);font-size:11px;color:var(--text-muted);">No holdings</div>`;
    return `
      <table class="pf-mini-table table-sort-click">
        <thead><tr>
          <th data-sort-prefix="${prefix}" data-sort-key="script">SCRIPT ${icon('script')}</th>
          <th data-sort-prefix="${prefix}" data-sort-key="qty">QTY ${icon('qty')}</th>
          <th data-sort-prefix="${prefix}" data-sort-key="ltp">LTP ${icon('ltp')}</th>
          <th data-sort-prefix="${prefix}" data-sort-key="invested">TOTAL INVESTED ${icon('invested')}</th>
          <th data-sort-prefix="${prefix}" data-sort-key="pl">P/L ${icon('pl')}</th>
          <th data-sort-prefix="${prefix}" data-sort-key="sell">SELL ${icon('sell')}</th>
          <th data-sort-prefix="${prefix}" data-sort-key="roi">ROI% ${icon('roi')}</th>
        </tr></thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td style="font-weight:700;color:var(--text-primary);">${window.PmsPrivacy && window.PmsPrivacy.isEnabled && window.PmsPrivacy.isEnabled() ? maskValue() : r.script}</td>
              <td>${fmt(r.qty, 0)}</td>
              <td>${fmtRs(r.ltp, 2)}</td>
              <td><span class="invested-info" title="WACC: ${fmtRs(r.wacc, 2)}">${fmtRs(r.invested, 0)}</span></td>
              <td class="${r.pl >= 0 ? 'profit' : 'loss'}">${plSign(r.pl)}${fmtRs(r.pl, 0)}</td>
              <td class="${r.sell >= r.invested ? 'profit' : 'loss'}">${fmtRs(r.sell, 0)}</td>
              <td class="pf-roi ${r.roi >= 0 ? 'profit' : 'loss'}">${plSign(r.roi)}${fmtPct(r.roi, 1)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  }

  function showRoiModal(r) {
    window.Modal && Modal.open({
      title: 'Realized ROI — Exited Trades',
      body: `<div style="font-family:var(--font-mono);font-size:12px;display:grid;gap:8px;"><div>Exits: <strong>${r.count}</strong></div><div>ROI: <strong class="${r.roi >= 0 ? 'value-profit' : 'value-loss'}">${plSign(r.roi)}${fmtPct(r.roi, 2)}</strong></div><div>Net Profit: <strong class="${r.totalProfit >= 0 ? 'value-profit' : 'value-loss'}">${fmtRs(r.totalProfit, 0)}</strong></div></div>`,
      footer: `<button class="btn-secondary" onclick="Modal.close()">Close</button>`,
    });
  }

  function showNetWorthModal(totals) {
    const nw = totals.total;
    const bookedProfit = Number(totals.bookedProfit || 0);
    window.Modal && Modal.open({
      title: 'Net Worth Breakdown',
      body: `<div style="font-family:var(--font-mono);font-size:12px;display:grid;gap:8px;"><div>Active Trades: <strong>${fmtRs(totals.trades.value || 0, 0)}</strong></div><div>Long-Term: <strong>${fmtRs(totals.longterm.value || 0, 0)}</strong></div><div>SIP / MF: <strong>${fmtRs(totals.sip.value || 0, 0)}</strong></div><div>Booked Profits (Cash Ledger): <strong>${fmtRs(bookedProfit, 0)}</strong></div><div>NET WORTH: <strong style="color:var(--blue);">${fmtRs(nw, 0)}</strong></div></div>`,
      footer: `<button class="btn-secondary" onclick="Modal.close()">Close</button>`,
    });
  }

  window._renderDashboard = renderDashboard;
})();
