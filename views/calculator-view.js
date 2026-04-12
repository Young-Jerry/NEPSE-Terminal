/**
 * Calculator View
 * Preserves all original share_calculator.js logic exactly.
 */
function renderCalculator(container) {
  container.innerHTML = `
    <div class="section-header mb16">
      <div>
        <div class="section-title">Share Calculator</div>
        <div class="section-sub">NEPSE transaction cost and capital gain calculator</div>
      </div>
    </div>

    <div class="dashboard-row" style="grid-template-columns:1fr 1.2fr;">
      <!-- Input Panel -->
      <div class="card calc-transaction-card">
        <div class="card-title mb16">Transaction Details</div>
        <div class="form-grid" style="grid-template-columns:1fr;">
          <div class="form-group">
            <label class="form-label">Action</label>
            <select class="form-select" id="calc-action">
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Number of Shares</label>
            <input type="number" class="form-input" id="calc-qty" min="1" step="1" placeholder="100" />
          </div>
          <div class="form-group" id="calc-buy-price-wrap">
            <label class="form-label" style="display:flex;align-items:center;justify-content:space-between;gap:10px;">Buy / WACC Price (Rs)
              <span class="toggle-label" style="padding:0;"><input type="checkbox" id="calc-wacc-mode" checked /><span>WACC</span></span>
            </label>
            <input type="number" class="form-input" id="calc-buy-price" min="0.01" step="0.01" placeholder="420.00" />
          </div>
          <div class="form-group hidden" id="calc-sell-price-wrap">
            <label class="form-label">Sell Price (Rs)</label>
            <input type="number" class="form-input" id="calc-sell-price" min="0.01" step="0.01" placeholder="500.00" />
          </div>
          <div class="form-group hidden" id="calc-days-wrap">
            <label class="form-label">Holding Days</label>
            <input type="number" class="form-input" id="calc-days" min="0" step="1" placeholder="30" />
          </div>
        </div>
      </div>

      <!-- Results Panel -->
      <div class="card">
        <div class="card-title mb16">Details:</div>
        <table class="ledger-breakdown-table calc-details-table">
          <tbody>
            <tr><td>Total Amount</td><td class="mono" id="calc-r-total">-</td></tr>
            <tr><td>* Commission</td><td class="mono" id="calc-r-commission">-</td></tr>
            <tr><td>SEBON FEE</td><td class="mono" id="calc-r-sebon">-</td></tr>
            <tr><td>DP Charge</td><td class="mono" id="calc-r-dp">-</td></tr>
            <tr><td id="calc-payable-label">Total Amount Payable (Rs)</td><td class="mono value-blue" id="calc-r-payable">-</td></tr>
            <tr><td>Cost Price Per Share (Rs)</td><td class="mono" id="calc-r-cost-per">-</td></tr>
            <tr class="hidden" id="calc-r-cgt-row"><td>Capital Gain Tax</td><td class="mono value-amber" id="calc-r-cgt">-</td></tr>
            <tr class="hidden" id="calc-r-recv-row"><td>Net Receivable (Rs)</td><td class="mono value-profit" id="calc-r-recv">-</td></tr>
          </tbody>
        </table>

        <div id="calc-note" style="margin-top:12px;font-size:10px;color:var(--text-muted);line-height:1.6;">* Commission Amount includes NEPSE Commission Rs - &amp; SEBON Regularity Fee Rs -</div>

      </div>
    </div>
  `;

  const actionEl    = container.querySelector('#calc-action');
  const qtyEl       = container.querySelector('#calc-qty');
  const buyPriceEl  = container.querySelector('#calc-buy-price');
  const sellPriceEl = container.querySelector('#calc-sell-price');
  const daysEl      = container.querySelector('#calc-days');
  const waccEl      = container.querySelector('#calc-wacc-mode');

  [actionEl, qtyEl, buyPriceEl, sellPriceEl, daysEl, waccEl].forEach(el => {
    el.addEventListener('input',  calculate);
    el.addEventListener('change', calculate);
  });

  calculate();

  function calculate() {
    const side    = actionEl.value;
    const qty     = num(qtyEl.value);
    const buy     = num(buyPriceEl.value);
    const sell    = num(sellPriceEl.value);
    const days    = Math.max(0, Math.floor(num(daysEl.value) || 0));
    const isWacc  = waccEl.checked;
    const isSell  = side === 'sell';

    container.querySelector('#calc-sell-price-wrap').classList.toggle('hidden', !isSell);
    container.querySelector('#calc-days-wrap').classList.toggle('hidden', !isSell);
    container.querySelector('#calc-r-cgt-row').classList.toggle('hidden', !isSell);
    container.querySelector('#calc-r-recv-row').classList.toggle('hidden', !isSell);
    container.querySelector('#calc-payable-label').textContent = isSell ? 'Total Amount Receivable (Rs)' : 'Total Amount Payable (Rs)';

    const math = window.PmsTradeMath;
    if (!math) return;

    const valid = v => isFinite(v) && v > 0;
    if (!valid(qty) || !valid(buy) || (isSell && !valid(sell))) {
      setResults(null, 0, 0, 0, math);
      return;
    }

    const unitPrice = isSell ? sell : buy;
    const tx = math.calculateTransaction(side, unitPrice, qty, { buyIsWacc: isWacc && !isSell });

    let capitalGain = 0, totalReceivable = 0, taxRate = 0;
    if (isSell) {
      const rt = math.calculateRoundTrip({ buyPrice: buy, soldPrice: sell, qty, buyIsWacc: isWacc, holdingDays: days });
      capitalGain    = Number(rt.capitalGainTax || 0);
      totalReceivable = Number(rt.netRealizedAmount || 0);
      taxRate         = Number(rt.capitalGainTaxRate || 0);
    }

    setResults(tx, capitalGain, totalReceivable, taxRate, math);
  }

  function setResults(tx, capitalGain, totalReceivable, taxRate, math) {
    const fmt = v => currency2(v);
    const dp = tx ? tx.dpCharge : (math ? math.DP_CHARGE : 25);

    setText('calc-r-total',       tx ? fmt(tx.totalAmount)   : '-');
    setText('calc-r-commission',  tx ? fmt(tx.commission)    : '-');
    setText('calc-r-sebon',       tx ? fmt(tx.sebonFee)      : '-');
    setText('calc-r-dp',          tx ? fmt(dp)               : '-');
    setText('calc-r-payable',     tx ? fmt(tx.totalPayable)  : '-');
    setText('calc-r-cost-per',    tx ? fmt(tx.costPerShare)  : '-');
    setText('calc-r-cgt',         fmt(capitalGain));
    setText('calc-r-recv',        fmt(totalReceivable));

    const note = container.querySelector('#calc-note');
    if (tx) {
      note.textContent = `* Commission Amount includes NEPSE Commission Rs ${Number(tx.commission).toFixed(2)} & SEBON Regularity Fee Rs ${Number(tx.sebonFee).toFixed(2)}`;
    } else {
      note.textContent = '* Commission Amount includes NEPSE Commission Rs - & SEBON Regularity Fee Rs -';
    }
  }

  function setText(id, val) {
    const el = container.querySelector('#' + id);
    if (el) el.textContent = val;
  }
}

window._renderCalculator = renderCalculator;
