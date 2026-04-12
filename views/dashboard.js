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
  function plSign(v) { return Number(v) > 0 ? '+' : ''; }
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

  function daysUntil15th() {
    const now = new Date();
    const d = now.getDate();
    if (d === 15) return 0;
    const target = d < 15 ? new Date(now.getFullYear(), now.getMonth(), 15) : new Date(now.getFullYear(), now.getMonth() + 1, 15);
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
    const records = sipState.records || {};
    return {
      SSIS: Array.isArray(records.SSIS) ? records.SSIS.length : 0,
      KSLY: Array.isArray(records.KSLY) ? records.KSLY.length : 0,
    };
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
    const realized = getRealizedRoi();
    const longTermGain = Math.abs(Number(totals.longterm.value || 0) - Number(totals.longterm.invested || 0));
    const tradeSort = container._tradeSort || { key: 'script', dir: 'asc' };
    const longSort = container._longSort || { key: 'script', dir: 'asc' };
    const tradeFilter = container._tradeFilter || '';
    const longFilter = container._longFilter || '';
    const topTrades = getTopNBySort('trades', tradeSort, 3, tradeFilter, 'trade');
    const topLong = getTopNBySort('longterm', longSort, 3, longFilter, 'long');

    const sipDays = daysUntil15th();
    const sipProg = Math.max(0, Math.min(100, ((30 - sipDays) / 30) * 100));
    const sipRoiCards = buildSipRoiCards();
    const sipEntryMonths = getSipEntryMonths();

    container.innerHTML = `
      <div class="kpi-strip dash-row">
        <div class="kpi-card kpi-roi" id="dash-kpi-roi">
          <div class="kpi-label">EXITED TRADES ROI</div>
          <div class="kpi-value ${plCls(realized.roi)}">${plSign(realized.roi)}${fmtPct(realized.roi, 2)}</div>
        </div>

        <div class="kpi-card kpi-nw" id="dash-kpi-nw">
          <div class="kpi-label">NET WORTH</div>
          <div class="kpi-value neutral mono">${fmtRs(Number(totals.total || 0), 0)}</div>
        </div>

        <div class="kpi-card kpi-pl" id="dash-kpi-ltg">
          <div class="kpi-label">LONG TERM GAIN</div>
          <div class="kpi-value mono profit">${fmtRs(longTermGain, 0)}</div>
        </div>

        <div class="kpi-card kpi-cash" id="dash-kpi-cash">
          <div class="kpi-label">CASH BALANCE</div>
          <div class="kpi-value cash-color mono">${fmtRs(Math.abs(cash), 0)}</div>
        </div>

      </div>

      <div class="info-strip dash-row">
        <div class="info-card" id="dash-watchlist-panel" style="padding:0;overflow:hidden;"></div>
        <div class="info-card" id="dash-sip-card">
          <div class="info-card-title" style="margin-bottom:0;">SIP DUE SUMMARY</div>
          <div class="sip-countdown">
            <div class="sip-days">${window.PmsPrivacy && window.PmsPrivacy.isEnabled && window.PmsPrivacy.isEnabled() ? maskValue() : (sipDays === 0 ? 'TODAY' : sipDays)}</div>
            <div class="sip-label">${window.PmsPrivacy && window.PmsPrivacy.isEnabled && window.PmsPrivacy.isEnabled() ? maskValue() : (sipDays === 0 ? 'INVEST NOW' : `DAY${sipDays !== 1 ? 'S' : ''} UNTIL 15TH`)}</div>
            <div class="sip-bar"><div class="sip-bar-fill" style="width:${sipProg}%;"></div></div>
          </div>
          <div class="sip-meta-row">
            <div class="sip-meta-chip"><span>SSIS ENTRIES</span><strong>${sipEntryMonths.SSIS} Months</strong></div>
            <div class="sip-meta-chip"><span>KSLY ENTRIES</span><strong>${sipEntryMonths.KSLY} Months</strong></div>
          </div>
          <div class="dash-sip-roi-grid">${sipRoiCards}</div>
        </div>
      </div>

      <div class="portfolio-grid dash-row">
        <div class="pf-table-card">
          <div class="pf-table-header"><div class="pf-table-title">ACTIVE TRADES</div><input type="text" class="search-input dash-filter" id="dash-trade-filter" placeholder="Search stock…" value="${tradeFilter}" /><button class="pf-table-nav" onclick="window.navigateTo('trades')">VIEW ALL →</button></div>
          ${renderTopTable(topTrades, tradeSort, 'trade')}
        </div>

        <div class="pf-table-card">
          <div class="pf-table-header"><div class="pf-table-title">LONG-TERM</div><input type="text" class="search-input dash-filter" id="dash-long-filter" placeholder="Search stock…" value="${longFilter}" /><button class="pf-table-nav" onclick="window.navigateTo('longterm')">VIEW ALL →</button></div>
          ${renderTopTable(topLong, longSort, 'long')}
        </div>
      </div>
    `;

    const wlPanel = container.querySelector('#dash-watchlist-panel');
    if (wlPanel && window.Watchlist) window.Watchlist.renderPanel(wlPanel, () => renderDashboard(container));

    bindSortClicks(container, 'trade', key => {
      container._tradeSort = nextSort(container._tradeSort || { key: 'script', dir: 'asc' }, key);
      renderDashboard(container);
    });
    bindSortClicks(container, 'long', key => {
      container._longSort = nextSort(container._longSort || { key: 'script', dir: 'asc' }, key);
      renderDashboard(container);
    });

    const tradeFilterEl = container.querySelector('#dash-trade-filter');
    const longFilterEl = container.querySelector('#dash-long-filter');
    const bindLiveFilter = (inputEl, key) => {
      if (!inputEl) return;
      inputEl.addEventListener('input', () => {
        const scroller = document.querySelector('.view-container');
        const scrollTop = scroller ? scroller.scrollTop : window.scrollY;
        container[key] = inputEl.value.trim();
        renderDashboard(container);
        if (scroller) scroller.scrollTop = scrollTop;
        else window.scrollTo({ top: scrollTop });
        const fresh = container.querySelector(`#${inputEl.id}`);
        if (fresh) {
          fresh.focus();
          fresh.selectionStart = fresh.selectionEnd = fresh.value.length;
        }
      });
    };
    bindLiveFilter(tradeFilterEl, '_tradeFilter');
    bindLiveFilter(longFilterEl, '_longFilter');

    const kpiRoi = container.querySelector('#dash-kpi-roi');
    if (kpiRoi) kpiRoi.addEventListener('click', () => showRoiModal(realized));
    const kpiNw = container.querySelector('#dash-kpi-nw');
    if (kpiNw) kpiNw.addEventListener('click', () => showNetWorthModal(totals));
  }

  function buildSipRoiCards() {
    const sipState = readSipState();
    const defaultNames = ['SSIS', 'KSLY'];
    return defaultNames.map(name => {
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
    window.Modal && Modal.open({
      title: 'Net Worth Breakdown',
      body: `<div style="font-family:var(--font-mono);font-size:12px;display:grid;gap:8px;"><div>Active Trades: <strong>${fmtRs(totals.trades.value || 0, 0)}</strong></div><div>Long-Term: <strong>${fmtRs(totals.longterm.value || 0, 0)}</strong></div><div>SIP / MF: <strong>${fmtRs(totals.sip.value || 0, 0)}</strong></div><div>NET WORTH: <strong style="color:var(--blue);">${fmtRs(nw, 0)}</strong></div></div>`,
      footer: `<button class="btn-secondary" onclick="Modal.close()">Close</button>`,
    });
  }

  window._renderDashboard = renderDashboard;
})();
