/**
 * Settings View
 */
function renderSettings(container) {
  container.innerHTML = `
    <div class="section-header mb16">
      <div>
        <div class="section-title">Settings</div>
        <div class="section-sub">Manage your NEPSE Terminal preferences and data</div>
      </div>
    </div>

    <!-- About -->
    <div class="settings-section">
      <div class="settings-title">
        <svg viewBox="0 0 16 16" width="16"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 7v5M8 5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        About
      </div>
      <div class="settings-row">
        <div>
          <div class="settings-row-label">NEPSE Terminal</div>
          <div class="settings-row-sub">A professional portfolio management system for NEPSE investors.</div>
        </div>
        <span class="badge badge-blue">v2.0</span>
      </div>
      <div class="settings-row">
        <div>
          <div class="settings-row-label">Data Storage</div>
          <div class="settings-row-sub">All data is stored locally in your browser. Nothing is sent to any server.</div>
        </div>
        <span class="badge badge-green">100% Local</span>
      </div>
    </div>

    <!-- Dashboard Data Panel -->
    <div class="settings-section">
      <div class="settings-title">
        <svg viewBox="0 0 16 16" width="16"><rect x="2" y="3" width="12" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5 7h6M5 9h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        Dashboard Display Data
      </div>
      <div class="settings-row">
        <div>
          <div class="settings-row-label">Update Dashboard Metrics</div>
          <div class="settings-row-sub">Regenerate all static mock data (watchlist prices, charts, metrics) and re-render the dashboard once.</div>
        </div>
        <button class="btn-primary" id="settings-update-data-btn">
          <svg viewBox="0 0 16 16" width="13"><path d="M13.6 2.4A7 7 0 1 0 15 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><polyline points="11,1 15,1 15,5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          Update Data
        </button>
      </div>
      <div id="settings-update-status" style="font-size:12px;color:var(--green);margin-top:8px;display:none;"></div>
    </div>

    <!-- Backup & Restore -->
    <div class="settings-section">
      <div class="settings-title">
        <svg viewBox="0 0 16 16" width="16"><rect x="2" y="3" width="12" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 7v5M6 9l2-2 2 2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Backup &amp; Restore
      </div>
      <div class="settings-row">
        <div>
          <div class="settings-row-label">Export Data</div>
          <div class="settings-row-sub">Download an encrypted CSV backup of all portfolio data.</div>
        </div>
        <button class="btn-primary" id="settings-backup-btn">Download Backup</button>
      </div>
      <div class="settings-row">
        <div>
          <div class="settings-row-label">Import Data</div>
          <div class="settings-row-sub">Restore from a previously exported encrypted CSV backup.</div>
        </div>
        <label class="btn-secondary" for="settings-restore-input" style="cursor:pointer;">
          Upload Backup
          <input type="file" id="settings-restore-input" accept=".csv" style="display:none;" />
        </label>
      </div>
      <div id="settings-backup-status" style="font-size:12px;color:var(--green);margin-top:8px;display:none;"></div>
    </div>

    <!-- LTP Update -->
    <div class="settings-section">
      <div class="settings-title">
        <svg viewBox="0 0 16 16" width="16"><polyline points="2,12 5,7 9,10 14,3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        LTP Update
      </div>
      <div class="settings-row">
        <div>
          <div class="settings-row-label">CSV Format</div>
          <div class="settings-row-sub">The CSV file must contain columns: <strong>Symbol</strong> (or Script/Ticker) and <strong>LTP</strong> (or Last Traded Price).</div>
        </div>
      </div>
      <div class="settings-row">
        <div>
          <div class="settings-row-label">Update LTP from CSV</div>
          <div class="settings-row-sub">Upload the NEPSE market data CSV to bulk-update all LTP values.</div>
        </div>
        <button class="btn-outline" id="settings-ltp-btn">Upload CSV</button>
        <input type="file" id="settings-ltp-input" accept=".csv" style="display:none;" />
      </div>
    </div>

    <!-- Cash Management -->
    <div class="settings-section">
      <div class="settings-title">
        <svg viewBox="0 0 16 16" width="16"><rect x="1" y="4" width="14" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M1 7h14" stroke="currentColor" stroke-width="1.5"/><circle cx="5" cy="11" r="1" fill="currentColor"/></svg>
        Cash Balance
      </div>
      <div class="settings-row">
        <div>
          <div class="settings-row-label">Current Balance</div>
          <div class="settings-row-sub">Your available cash balance.</div>
        </div>
        <span class="mono value-blue" id="settings-cash-val" style="font-size:14px;font-weight:700;"></span>
      </div>
      <div class="settings-row">
        <div>
          <div class="settings-row-label">Override Balance</div>
          <div class="settings-row-sub">Manually set the cash balance (use with caution — bypasses ledger).</div>
        </div>
        <div class="toolbar">
          <input type="number" class="form-input" id="settings-cash-input" placeholder="50000" min="0" step="1" style="width:120px;" />
          <button class="btn-danger" id="settings-set-cash-btn">Set</button>
        </div>
      </div>
      <div class="settings-row">
        <div>
          <div class="settings-row-label">Profit Cashed Balance</div>
          <div class="settings-row-sub">Current Profit Cashed balance and overwrite control.</div>
        </div>
        <span class="mono value-blue" id="settings-profit-val" style="font-size:14px;font-weight:700;"></span>
      </div>
      <div class="settings-row">
        <div>
          <div class="settings-row-label">Override Profit Cashed</div>
          <div class="settings-row-sub">Manually set profit cashed balance (bypasses normal flow).</div>
        </div>
        <div class="toolbar">
          <input type="number" class="form-input" id="settings-profit-input" placeholder="5000" min="0" step="1" style="width:120px;" />
          <button class="btn-danger" id="settings-set-profit-btn">Set</button>
        </div>
      </div>
    </div>


    <!-- SIP Due Date -->
    <div class="settings-section">
      <div class="settings-title">
        <svg viewBox="0 0 16 16" width="16"><rect x="2" y="3" width="12" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5 1.5v3M11 1.5v3M2 7h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        SIP Due Date
      </div>
      <div class="settings-row">
        <div>
          <div class="settings-row-label">Monthly Due Day</div>
          <div class="settings-row-sub">Set which day of month SIP is due (1-28). Dashboard countdown uses this value.</div>
        </div>
        <div class="toolbar">
          <input type="number" class="form-input" id="settings-sip-due-day-input" placeholder="15" min="1" max="28" step="1" style="width:84px;" />
          <button class="btn-primary" id="settings-sip-due-save-btn">Save</button>
          <button class="btn-secondary" id="settings-sip-due-clear-btn">Clear</button>
        </div>
      </div>
      <div class="settings-row">
        <div>
          <div class="settings-row-label">Current Due Day</div>
          <div class="settings-row-sub">Shown in dashboard SIP Due Summary.</div>
        </div>
        <span class="mono" id="settings-sip-due-current" style="font-size:13px;font-weight:700;color:var(--text-primary);"></span>
      </div>
    </div>

    <!-- Danger Zone -->
    <div class="settings-section" style="border-color:rgba(244,63,94,0.3);">
      <div class="settings-title" style="color:var(--red);">
        <svg viewBox="0 0 16 16" width="16"><path d="M8 2L14 13H2L8 2z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 7v3M8 11.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        Danger Zone
      </div>
      <div class="settings-row">
        <div>
          <div class="settings-row-label">Clear Trades Portfolio</div>
          <div class="settings-row-sub">Permanently removes all active trade positions.</div>
        </div>
        <button class="btn-danger" id="settings-clear-trades">Clear Trades</button>
      </div>
      <div class="settings-row">
        <div>
          <div class="settings-row-label">Clear Long-Term Portfolio</div>
          <div class="settings-row-sub">Permanently removes all long-term positions.</div>
        </div>
        <button class="btn-danger" id="settings-clear-lt">Clear Long-Term</button>
      </div>
      <div class="settings-row">
        <div>
          <div class="settings-row-label">Clear Past Trades History</div>
          <div class="settings-row-sub">Removes all closed trade records.</div>
        </div>
        <button class="btn-danger" id="settings-clear-history">Clear History</button>
      </div>
      <div class="settings-row">
        <div>
          <div class="settings-row-label">Reset Entire Portfolio</div>
          <div class="settings-row-sub">⚠️ Wipes ALL data — positions, history, cash, SIPs. Irreversible.</div>
        </div>
        <button class="btn-danger" id="settings-nuke-btn">Reset Everything</button>
      </div>
    </div>
  `;

  // Cash display
  const updateCashDisplay = () => {
    const el = container.querySelector('#settings-cash-val');
    if (el && window.PmsCapital) el.textContent = currencyInt(window.PmsCapital.readCash());
    const profitEl = container.querySelector('#settings-profit-val');
    if (profitEl && window.PmsCapital) profitEl.textContent = currencyInt(window.PmsCapital.readProfitCashedOut());
  };
  const updateSipDueDisplay = () => {
    const current = container.querySelector('#settings-sip-due-current');
    const input = container.querySelector('#settings-sip-due-day-input');
    if (!current || !input || !window.PmsSettings) return;
    const dueDay = window.PmsSettings.getSipDueDay();
    current.textContent = dueDay ? `${dueDay}th` : 'NOT GIVEN';
    input.value = dueDay || '';
  };
  updateCashDisplay();
  updateSipDueDisplay();
  window.addEventListener('pms-cash-updated', updateCashDisplay);

  // Backup
  container.querySelector('#settings-backup-btn').addEventListener('click', async () => {
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
        showStatus('Passwords do not match.');
        return;
      }
      const csvData = await window.PmsBackup.createEncryptedBackupCSV(password);
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `NEPSE-Backup-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      showStatus('Encrypted CSV backup downloaded ✓');
    } catch {
      showStatus('Backup export failed.');
    }
  });

  container.querySelector('#settings-restore-input').addEventListener('change', async e => {
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
      showStatus('Data restored ✓ Reloading…');
      setTimeout(() => location.reload(), 700);
    } catch (err) { showStatus(err && err.message === 'Access Denied' ? 'Access Denied' : 'Invalid backup file.'); }
    finally { e.target.value = ''; }
  });

  // LTP
  container.querySelector('#settings-ltp-btn').addEventListener('click', () => {
    container.querySelector('#settings-ltp-input').click();
  });
  container.querySelector('#settings-ltp-input').addEventListener('change', async e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const updated = window.LtpUpdater.processCSVText(text);
      showStatus(`LTP updated: ${updated} scripts ✓`);
    } catch (err) { showStatus('CSV error: ' + err.message); }
    finally { e.target.value = ''; }
  });

  // Set cash
  container.querySelector('#settings-set-cash-btn').addEventListener('click', () => {
    const val = Math.round(Number(container.querySelector('#settings-cash-input').value));
    if (!isFinite(val) || val < 0) return;
    Modal.confirm({
      title: 'Override Cash Balance',
      message: `Set cash balance to ${currencyInt(val)}? This bypasses the ledger.`,
      confirmText: 'Override',
      onConfirm: () => { window.PmsCapital.setCash(val); updateCashDisplay(); showStatus('Cash balance updated ✓'); },
    });
  });

  container.querySelector('#settings-set-profit-btn').addEventListener('click', () => {
    const val = Math.round(Number(container.querySelector('#settings-profit-input').value));
    if (!isFinite(val) || val < 0) return;
    Modal.confirm({
      title: 'Override Profit Cashed',
      message: `Set Profit Cashed balance to ${currencyInt(val)}? This bypasses normal ledger math.`,
      confirmText: 'Override',
      onConfirm: () => {
        window.PmsCapital.setProfitCashedBalance(val);
        updateCashDisplay();
        showStatus('Profit Cashed balance updated ✓');
      },
    });
  });

  // SIP due day
  container.querySelector('#settings-sip-due-save-btn').addEventListener('click', () => {
    if (!window.PmsSettings) return;
    const val = container.querySelector('#settings-sip-due-day-input').value.trim();
    const parsed = Math.floor(Number(val));
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 28) return showStatus('Due day must be 1-28.');
    window.PmsSettings.setSipDueDay(parsed);
    updateSipDueDisplay();
    showStatus('SIP due day saved ✓');
  });

  container.querySelector('#settings-sip-due-clear-btn').addEventListener('click', () => {
    if (!window.PmsSettings) return;
    window.PmsSettings.setSipDueDay('');
    updateSipDueDisplay();
    showStatus('SIP due day cleared ✓');
  });

  // Danger zone
  const clearAction = (key, label) => Modal.confirm({
    title: `Clear ${label}`,
    message: `Permanently remove all ${label.toLowerCase()} data?`,
    confirmText: 'Clear',
    onConfirm: () => { localStorage.removeItem(key); showStatus(`${label} cleared ✓`); window.dispatchEvent(new CustomEvent('pms-portfolio-updated')); },
  });

  container.querySelector('#settings-clear-trades').addEventListener('click', () => clearAction('trades', 'Trades'));
  container.querySelector('#settings-clear-lt').addEventListener('click', () => clearAction('longterm', 'Long-Term'));
  container.querySelector('#settings-clear-history').addEventListener('click', () => clearAction('exitedTradesV2', 'Trade History'));

  container.querySelector('#settings-nuke-btn').addEventListener('click', () => {
    Modal.confirm({
      title: '⚠️ Reset Everything',
      message: 'This will permanently erase ALL portfolio data, cash, trades, SIPs, and history. There is no undo.',
      confirmText: 'DELETE EVERYTHING',
      onConfirm: () => { localStorage.clear(); showStatus('All data cleared. Reloading…'); setTimeout(() => location.reload(), 800); },
    });
  });

  function showStatus(msg) {
    const el = container.querySelector('#settings-backup-status');
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 4000);
  }
}

window._renderSettings = renderSettings;

// ── UPDATE DATA button hook ────────────────────────────────────
(function patchSettingsUpdateData() {
  const orig = window._renderSettings;
  window._renderSettings = function(container) {
    orig(container);
    const btn = document.getElementById('settings-update-data-btn');
    const status = document.getElementById('settings-update-status');
    if (!btn) return;
    btn.addEventListener('click', () => {
      // Delegate to the main Update Data button in topbar
      const mainBtn = document.getElementById('updateDataBtn');
      if (mainBtn) mainBtn.click();
      if (status) {
        status.textContent = '✓ All views recalculated!';
        status.style.display = 'block';
        setTimeout(() => { status.style.display = 'none'; }, 3000);
      }
    });
  };
})();
