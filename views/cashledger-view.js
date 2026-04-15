/**
 * Cash Ledger View
 * Preserves all original cash_ledger.js logic exactly.
 */
function renderCashLedger(container) {
  container.innerHTML = `
    <div class="section-header mb16">
      <div>
        <div class="section-title">Cash Ledger</div>
        <div class="section-sub">Track deposits, withdrawals, and profit cash-outs</div>
      </div>
    </div>

    <!-- Balance Banner -->
    <div class="add-panel mb20">
      <div class="add-panel-title">Cash Overview</div>
      <div class="ledger-breakdown-grid">
        <div class="ledger-breakdown-card"><div class="ledger-breakdown-label">Cash Balance</div><div class="ledger-breakdown-val mono" id="ledger-cash-bal">Rs 0</div></div>
        <div class="ledger-breakdown-card"><div class="ledger-breakdown-label">Profit Cashed</div><div class="ledger-breakdown-val mono" id="ledger-profit-out">Rs 0</div></div>
      </div>
    </div>
    <!-- Entry Forms Row -->
    <div class="dashboard-row mb20">
      <!-- Manual Transaction -->
      <div class="add-panel">
        <div class="add-panel-title">Add Transaction</div>
        <form id="ledger-txn-form" autocomplete="off">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Type</label>
              <select class="form-select" name="type">
                <option value="credit">Cash In</option>
                <option value="debit">Cash Out</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Amount (Rs)</label>
              <input type="number" class="form-input" name="amount" min="1" step="1" placeholder="10000" required />
            </div>
            <div class="form-group">
              <label class="form-label">Note</label>
              <input type="text" class="form-input" name="note" placeholder="Description…" />
            </div>
            <div class="form-group" style="align-self:end;">
              <button type="submit" class="btn-primary" style="width:100%;">Add Entry</button>
            </div>
          </div>
        </form>
      </div>

      <!-- Profit Cash Out -->
      <div class="add-panel">
        <div class="add-panel-title">Profit Cash Out</div>
        <form id="ledger-profit-form" autocomplete="off">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Type</label>
              <select class="form-select" name="profitType">
                <option value="in">Profit Cashed In</option>
                <option value="out" selected>Profit Cashed Out</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Amount (Rs)</label>
              <input type="number" class="form-input" name="amount" min="1" step="1" placeholder="5000" required />
            </div>
            <div class="form-group">
              <label class="form-label">Note</label>
              <input type="text" class="form-input" name="note" value="Profit Cashed Out" />
            </div>
            <div class="form-group" style="align-self:end;">
              <button type="submit" class="btn-primary" style="width:100%;">Save</button>
            </div>
          </div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:8px;">
            * Profit Cashed In includes Rs 2 fee, Profit Cashed Out includes Rs 8 fee.
          </div>
        </form>
      </div>
    </div>

    <!-- History -->
    <div class="section-header mb8">
      <div class="section-title">Ledger History</div>
      <div class="toolbar">
        <button class="btn-danger" id="ledger-clear-btn" style="font-size:11px;">Empty History</button>
      </div>
    </div>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Date &amp; Time</th>
            <th>Category</th>
            <th>Type</th>
            <th>Note</th>
            <th>Amount</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="ledger-tbody"></tbody>
      </table>
    </div>
  `;

  const txnForm    = container.querySelector('#ledger-txn-form');
  const profitForm = container.querySelector('#ledger-profit-form');
  const clearBtn   = container.querySelector('#ledger-clear-btn');

  const profitTypeEl = container.querySelector('#ledger-profit-form select[name="profitType"]');
  if (profitTypeEl) {
    profitTypeEl.addEventListener('change', () => {
      const noteInput = container.querySelector('#ledger-profit-form input[name="note"]');
      if (noteInput) noteInput.value = profitTypeEl.value === 'in' ? 'Profit Cashed In' : 'Profit Cashed Out';
    });
  }

  txnForm.addEventListener('submit', e => {
    e.preventDefault();
    const fd     = new FormData(txnForm);
    const type   = String(fd.get('type'));
    const amount = Math.round(Number(fd.get('amount')));
    const note   = String(fd.get('note') || '').trim();
    if (!isFinite(amount) || amount <= 0) return;
    const delta = type === 'credit' ? amount : -amount;
    window.PmsCapital.adjustCash(delta, { note, kind: 'manual', type, entryCategory: 'transaction', editable: true });
    txnForm.reset();
    render();
  });

  profitForm.addEventListener('submit', e => {
    e.preventDefault();
    const fd     = new FormData(profitForm);
    const direction = String(fd.get('profitType') || 'out');
    const amount = Math.round(Number(fd.get('amount')));
    const note   = String(fd.get('note') || '').trim();
    if (!isFinite(amount) || amount <= 0) return;
    window.PmsCapital.addProfitCashEntry(direction, amount, note);
    profitForm.reset();
    const typeEl = profitForm.querySelector('select[name="profitType"]');
    if (typeEl) typeEl.value = 'out';
    profitForm.querySelector('input[name="note"]').value = 'Profit Cashed Out';
    render();
  });

  clearBtn.addEventListener('click', () => {
    Modal.confirm({
      title: 'Empty Ledger History',
      message: 'Remove all ledger history entries while keeping the current cash balance?',
      confirmText: 'Empty History',
      onConfirm: () => {
        window.PmsCapital.clearLedgerHistory();
        render();
      },
    });
  });

  window.addEventListener('pms-cash-updated', render);

  render();

  function render() {
    const cash        = window.PmsCapital.readCash();
    const profitOut   = window.PmsCapital.readProfitCashedOut();
    const ledger      = window.PmsCapital.readLedger();

    container.querySelector('#ledger-cash-bal').textContent    = currencyInt(cash);
    container.querySelector('#ledger-profit-out').textContent  = currencyInt(profitOut);

    const tbody = container.querySelector('#ledger-tbody');
    const sorted = [...ledger].sort((a, b) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    tbody.innerHTML = '';

    if (!sorted.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state" style="padding:32px;"><div class="empty-state-icon">📒</div><div class="empty-state-title">No ledger entries</div><div class="empty-state-sub">Transactions will appear here.</div></div></td></tr>`;
      return;
    }

    sorted.forEach(entry => {
      const isCredit    = Number(entry.delta) >= 0;
      const isProfit    = String(entry.entryCategory || '') === 'profit';
      const isProfitFee = String(entry.entryCategory || '') === 'profit_fee';
      const typeLabel   = entry.type === 'profit_in' ? 'Profit Cashed In' : isProfit ? 'Profit Cashed Out' : isProfitFee ? 'Profit Cash Fee' : (isCredit ? 'Cash In' : 'Cash Out');
      const category    = isProfit || isProfitFee ? 'Profit Entry' : 'Transaction';
      const signedAmt = isProfit ? (entry.type === 'profit_in' ? -Math.abs(Number(entry.baseAmount || 0)) : Math.abs(Number(entry.baseAmount || 0))) : Number(entry.delta || 0);
      const amtClass = (isProfit ? signedAmt > 0 : isCredit) ? 'ledger-type-credit' : 'ledger-type-debit';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="mono" style="font-size:11px;">${new Date(entry.createdAt).toLocaleString()}</td>
        <td>${escHtml(category)}</td>
        <td><span class="badge ${isCredit ? 'badge-green' : 'badge-red'}">${escHtml(typeLabel)}</span></td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;">${escHtml(entry.note || '—')}</td>
        <td class="mono ${amtClass}" style="font-weight:700;">${isProfit ? currencyInt(signedAmt) : currencyInt(entry.delta)}</td>
        <td class="actions-td"></td>
      `;

      // Edit / Delete buttons (only for editable entries)
      if (entry.editable) {
        const actionsTd = tr.querySelector('.actions-td');
        const wrap = document.createElement('div');
        wrap.className = 'actions-cell';

        const editBtn = document.createElement('button');
        editBtn.className = 'btn-ghost';
        editBtn.textContent = '✏️';
        editBtn.addEventListener('click', () => openEditEntry(entry, render));

        const delBtn = document.createElement('button');
        delBtn.className = 'btn-ghost';
        delBtn.textContent = '🗑️';
        delBtn.addEventListener('click', () => {
          Modal.confirm({
            title: 'Delete Entry',
            message: `Remove this ${typeLabel} entry of ${isProfit ? currencyInt(signedAmt) : currencyInt(entry.delta)}?`,
            confirmText: 'Delete',
            onConfirm: () => { window.PmsCapital.deleteLedgerEntry(entry.id); render(); },
          });
        });

        wrap.append(editBtn, delBtn);
        actionsTd.appendChild(wrap);
      }

      tbody.appendChild(tr);
    });
  }

  function openEditEntry(entry, onSave) {
    const currentAmt = Math.abs(entry.baseAmount || entry.delta);
    Modal.open({
      title: 'Edit Ledger Entry',
      body: `
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Amount (Rs)</label>
            <input type="number" class="form-input" id="le-amount" min="1" step="1" value="${currentAmt}" />
          </div>
          <div class="form-group">
            <label class="form-label">Note</label>
            <input type="text" class="form-input" id="le-note" value="${escHtml(entry.note || '')}" />
          </div>
        </div>
      `,
      footer: `<button class="btn-secondary" id="le-cancel">Cancel</button><button class="btn-primary" id="le-save">Save</button>`,
    });
    const box = document.getElementById('modalBox');
    box.querySelector('#le-cancel').addEventListener('click', Modal.close);
    box.querySelector('#le-save').addEventListener('click', () => {
      const parsed  = Math.round(Number(box.querySelector('#le-amount').value));
      const note    = box.querySelector('#le-note').value.trim();
      if (!isFinite(parsed) || parsed <= 0) return;

      let nextDelta  = parsed;
      let patchType  = entry.type;
      if (entry.entryCategory === 'profit') {
        const direction = entry.type === 'profit_in' ? 'in' : 'out';
        patchType  = entry.type;
        nextDelta  = window.PmsCapital.computeProfitDelta(direction, parsed);
      } else {
        nextDelta = entry.delta >= 0 ? parsed : -parsed;
      }

      window.PmsCapital.updateLedgerEntry(entry.id, {
        delta: nextDelta, baseAmount: parsed, note, editable: true, type: patchType,
      });
      Modal.close();
      onSave();
    });
  }
}

window._renderCashLedger = renderCashLedger;
