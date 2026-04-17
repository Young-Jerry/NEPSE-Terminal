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
        <div class="section-sub">Track passive monthly income and EPD using realized profits and factored days.</div>
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
        <div class="add-panel-title">Factored Days</div>
        <form id="earnings-factor-form" autocomplete="off">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Days (30 based: 30, 60, 90...)</label>
              <input type="number" class="form-input" id="earnings-factor-days" min="30" step="30" placeholder="30" />
            </div>
            <div class="form-group">
              <label class="form-label">Source</label>
              <div class="form-input mono" id="earnings-factor-source" style="display:flex;align-items:center;">Auto</div>
            </div>
            <div class="form-group" style="align-self:end;">
              <button class="btn-primary" type="submit" style="width:100%;">Save Days</button>
            </div>
          </div>
        </form>
      </div>
    </div>

    <div class="section-header mt16 mb8">
      <div class="section-title">Passive Income Entries</div>
    </div>
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Amount</th>
            <th>Saved On</th>
          </tr>
        </thead>
        <tbody id="earnings-tbody"></tbody>
      </table>
    </div>
  `;

  const passiveForm = container.querySelector('#earnings-passive-form');
  const factorForm = container.querySelector('#earnings-factor-form');

  passiveForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const state = engine.readState();
    const val = Math.max(0, Math.round(Number(container.querySelector('#earnings-passive-input').value || 0)));
    state.passiveIncome = val;
    state.passiveHistory = [{ id: crypto.randomUUID(), amount: val, createdAt: new Date().toISOString() }, ...(state.passiveHistory || [])].slice(0, 50);
    engine.saveState(state);
    draw();
  });

  factorForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = Math.floor(Number(container.querySelector('#earnings-factor-days')?.value || 0));
    if (!Number.isFinite(val) || val < 30 || val % 30 !== 0) return;
    const state = engine.readState();
    state.factoredDays = val;
    state.factoredDaysUpdatedAt = new Date().toISOString();
    engine.saveState(state);
    draw();
  });

  function draw() {
    const summary = engine.computeSummary();
    const state = engine.readState();
    const kpi = container.querySelector('#earnings-kpi-grid');
    container.querySelector('#earnings-passive-input').value = String(Math.round(Number(state.passiveIncome || 0)));
    const factorInput = container.querySelector('#earnings-factor-days');
    const factorSource = container.querySelector('#earnings-factor-source');
    if (factorInput) factorInput.value = String(Math.round(Number(state.factoredDays || summary.factoredDaysBase || 30)));
    if (factorSource) {
      factorSource.textContent = summary.usedAutoFactoredDays
        ? `Auto from largest holding: ${summary.defaultFactoredDays} days`
        : 'Manual (30-based input)';
    }

    kpi.innerHTML = `
      <div class="metric-card"><div class="metric-label">EPD</div><div class="metric-value mono">${currency(summary.epd)}</div></div>
      <div class="metric-card"><div class="metric-label">Factored Days (Live)</div><div class="metric-value mono">${Math.round(Number(summary.factoredDays || 0))}</div></div>
      <div class="metric-card"><div class="metric-label">Total Realized Profit</div><div class="metric-value mono">${currency(summary.totalRealizedProfit)}</div></div>
      <div class="metric-card"><div class="metric-label">Realized Profit / Day</div><div class="metric-value mono">${currency(summary.realizedDaily)}</div></div>
      <div class="metric-card"><div class="metric-label">Per Month Income</div><div class="metric-value mono">${currency(summary.monthIncome)}</div></div>
      <div class="metric-card"><div class="metric-label">Per Year Income</div><div class="metric-value mono">${currency(summary.yearIncome)}</div></div>
    `;

    const tbody = container.querySelector('#earnings-tbody');
    const rows = [...(state.passiveHistory || [])].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="2"><div class="empty-state" style="padding:16px;"><div class="empty-state-sub">No passive income entries yet.</div></div></td></tr>';
      return;
    }
    tbody.innerHTML = rows.map((row) => `
      <tr>
        <td class="mono">${currency(row.amount)}</td>
        <td class="mono">${new Date(row.createdAt).toLocaleDateString()}</td>
      </tr>
    `).join('');
  }

  draw();
}

window._renderEarnings = renderEarnings;
