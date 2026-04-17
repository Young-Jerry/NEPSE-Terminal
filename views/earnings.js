/**
 * Earnings View
 */
function renderEarnings(container) {
  const engine = window.PmsEarnings;
  if (!engine) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-title">Earnings engine unavailable.</div></div>';
    return;
  }

  container.innerHTML = `
    <div class="section-header mb16">
      <div>
        <div class="section-title">Earnings</div>
        <div class="section-sub">Track passive + one-time monthly income and daily earning power.</div>
      </div>
    </div>

    <div class="metrics-grid mb16" id="earnings-kpi-grid"></div>

    <div class="dashboard-row" style="grid-template-columns:1fr 1fr;">
      <div class="add-panel">
        <div class="add-panel-title">Passive Income (Monthly)</div>
        <form id="earnings-passive-form" autocomplete="off">
          <div class="form-grid" style="grid-template-columns:1fr auto;">
            <div class="form-group">
              <label class="form-label">Amount (Rs per month)</label>
              <input type="number" class="form-input" id="earnings-passive-input" min="0" step="1" placeholder="500" />
            </div>
            <div class="form-group" style="align-self:end;">
              <button class="btn-primary" type="submit">Save</button>
            </div>
          </div>
        </form>
      </div>

      <div class="add-panel">
        <div class="add-panel-title">Add One-Time Monthly Income</div>
        <form id="earnings-onetime-form" autocomplete="off">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Month</label>
              <input type="month" class="form-input" name="month" required />
            </div>
            <div class="form-group">
              <label class="form-label">Amount (Rs)</label>
              <input type="number" class="form-input" name="amount" min="1" step="1" placeholder="1000" required />
            </div>
            <div class="form-group">
              <label class="form-label">Note</label>
              <input type="text" class="form-input" name="note" placeholder="Optional" />
            </div>
            <div class="form-group" style="align-self:end;">
              <button class="btn-primary" type="submit" style="width:100%;">Add Income</button>
            </div>
          </div>
        </form>
      </div>
    </div>

    <div class="section-header mt16 mb8">
      <div class="section-title">One-Time Income Entries</div>
    </div>
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Month</th>
            <th>Amount</th>
            <th>Note</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="earnings-tbody"></tbody>
      </table>
    </div>
  `;

  const passiveForm = container.querySelector('#earnings-passive-form');
  const oneTimeForm = container.querySelector('#earnings-onetime-form');

  passiveForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const state = engine.readState();
    const val = Math.max(0, Math.round(Number(container.querySelector('#earnings-passive-input').value || 0)));
    state.passiveIncome = val;
    engine.saveState(state);
    draw();
  });

  oneTimeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(oneTimeForm);
    const month = String(fd.get('month') || '');
    const amount = Math.max(0, Math.round(Number(fd.get('amount') || 0)));
    const note = String(fd.get('note') || '').trim();
    if (!/^\d{4}-\d{2}$/.test(month) || amount <= 0) return;
    const state = engine.readState();
    state.oneTimeIncomes.push({ id: crypto.randomUUID(), month, amount, note, createdAt: new Date().toISOString() });
    engine.saveState(state);
    oneTimeForm.reset();
    draw();
  });

  function draw() {
    const summary = engine.computeSummary();
    const state = engine.readState();
    const kpi = container.querySelector('#earnings-kpi-grid');
    container.querySelector('#earnings-passive-input').value = String(Math.round(Number(state.passiveIncome || 0)));

    kpi.innerHTML = `
      <div class="metric-card"><div class="metric-label">Per Day Income</div><div class="metric-value mono">${currency(summary.epd)}</div></div>
      <div class="metric-card"><div class="metric-label">Per Month Income</div><div class="metric-value mono">${currency(summary.monthIncome)}</div></div>
      <div class="metric-card"><div class="metric-label">Per Year Income</div><div class="metric-value mono">${currency(summary.yearIncome)}</div></div>
      <div class="metric-card"><div class="metric-label">Largest Exit Day Profit (Base)</div><div class="metric-value mono">${currency(summary.largestTradeDayProfit)}</div></div>
      <div class="metric-card"><div class="metric-label">Trade Contribution / Day</div><div class="metric-value mono">${currency(summary.realizedDaily)}</div></div>
    `;

    const tbody = container.querySelector('#earnings-tbody');
    const rows = [...(state.oneTimeIncomes || [])].sort((a, b) => String(b.month).localeCompare(String(a.month)) || String(b.createdAt).localeCompare(String(a.createdAt)));
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state" style="padding:16px;"><div class="empty-state-sub">No one-time income added yet.</div></div></td></tr>';
      return;
    }
    tbody.innerHTML = rows.map((row) => `
      <tr>
        <td>${escHtml(row.month)}</td>
        <td class="mono">${currency(row.amount)}</td>
        <td>${escHtml(row.note || '—')}</td>
        <td class="mono">${new Date(row.createdAt).toLocaleDateString()}</td>
        <td>
          <button class="btn-ghost" data-del-income="${row.id}" title="Delete income">🗑️</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-del-income]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-del-income');
        const next = engine.readState();
        next.oneTimeIncomes = (next.oneTimeIncomes || []).filter((row) => row.id !== id);
        engine.saveState(next);
        draw();
      });
    });
  }

  draw();
}

window._renderEarnings = renderEarnings;
