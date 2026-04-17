/**
 * NEPSE Terminal — Core Financial Engine
 * ALL original financial logic preserved exactly as-is.
 * This file is the single source of truth for all calculations.
 */

// ─── TRADE MATH (preserved from trade-math.js) ────────────────────────────
const NEPSE_MIN_COMMISSION = 10;
const SEBON_RATE = 0.00015;
const DP_CHARGE = 25;
const SHORT_TERM_CAPITAL_GAIN_TAX_RATE = 0.075;
const LONG_TERM_CAPITAL_GAIN_TAX_RATE = 0.05;
const LONG_TERM_HOLDING_DAYS = 365;

function brokerRate(amount) {
  if (amount <= 50000) return 0.0036;
  if (amount <= 500000) return 0.0033;
  if (amount <= 2000000) return 0.0031;
  if (amount <= 10000000) return 0.0027;
  return 0.0024;
}

function calculateCommission(amount) {
  return Math.max(NEPSE_MIN_COMMISSION, amount * brokerRate(amount));
}

function calculateTransaction(side, unitPrice, qty, options = {}) {
  const safeQty = Number(qty || 0);
  const safePrice = Number(unitPrice || 0);
  const totalAmount = safePrice * safeQty;
  const treatBuyAsWacc = side === 'buy' && Boolean(options.buyIsWacc);

  const commission = treatBuyAsWacc ? 0 : calculateCommission(totalAmount);
  const sebonFee = treatBuyAsWacc ? 0 : totalAmount * SEBON_RATE;
  const dpCharge = treatBuyAsWacc ? 0 : DP_CHARGE;

  const totalPayable = side === 'sell'
    ? totalAmount - commission - sebonFee - dpCharge
    : totalAmount + commission + sebonFee + dpCharge;

  return {
    totalAmount,
    commission,
    sebonFee,
    dpCharge,
    totalPayable,
    costPerShare: safeQty > 0 ? totalPayable / safeQty : 0,
  };
}

function capitalGainTaxRate(holdingDays = 0) {
  const days = Math.max(0, Math.floor(Number(holdingDays || 0)));
  return days > LONG_TERM_HOLDING_DAYS
    ? LONG_TERM_CAPITAL_GAIN_TAX_RATE
    : SHORT_TERM_CAPITAL_GAIN_TAX_RATE;
}

function calculateRoundTrip({ buyPrice, soldPrice, qty, buyIsWacc = true, holdingDays = 0 }) {
  const buy = calculateTransaction('buy', buyPrice, qty, { buyIsWacc });
  const sell = calculateTransaction('sell', soldPrice, qty);
  const grossProfit = sell.totalPayable - buy.totalPayable;
  const taxRate = capitalGainTaxRate(holdingDays);
  const capitalGainTax = grossProfit > 0 ? grossProfit * taxRate : 0;
  const netProfit = grossProfit - capitalGainTax;
  const plPerShare = Number(qty || 0) > 0 ? (sell.totalPayable - capitalGainTax) / Number(qty || 0) : 0;
  return {
    buy,
    sell,
    invested: buy.totalPayable,
    realizedAmount: sell.totalPayable,
    netRealizedAmount: sell.totalPayable - capitalGainTax,
    grossProfit,
    capitalGainTax,
    capitalGainTaxRate: taxRate,
    profit: netProfit,
    netProfit,
    plPerShare,
  };
}

window.PmsTradeMath = {
  NEPSE_MIN_COMMISSION, SEBON_RATE, DP_CHARGE,
  brokerRate, calculateCommission, calculateTransaction,
  calculateRoundTrip, capitalGainTaxRate,
};

// ─── CAPITAL MANAGER (preserved from capital-manager.js) ──────────────────
const CASH_KEY = 'cashBalanceV1';
const LEDGER_KEY = 'cashLedgerV1';
const PROFIT_OUT_FEE = 10;
const PROFIT_IN_FEE = 2;
const PROFIT_CASHED_BAL_KEY = 'profitCashedBalanceV1';
const PROFIT_BOOK_SERIES_KEY = 'profitBookedSeriesV1';
const PROFIT_CASHED_BASE_KEY = 'profitCashedBaseV1';
const PROFIT_BOOK_START_DATE = '2026-04-06';
const PROFIT_BOOK_START_VALUE = 5070;

function normalizeMoney(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  const rounded = Math.round(n);
  return Math.abs(rounded) < 1e-9 ? 0 : rounded;
}

function readCash() {
  const value = Number(localStorage.getItem(CASH_KEY) || 0);
  return normalizeMoney(value);
}

function readLedger() {
  try {
    const rows = JSON.parse(localStorage.getItem(LEDGER_KEY) || '[]');
    return Array.isArray(rows) ? rows : [];
  } catch { return []; }
}

function saveLedger(rows) {
  localStorage.setItem(LEDGER_KEY, JSON.stringify(rows));
}

function setCash(value) {
  const safe = normalizeMoney(value);
  localStorage.setItem(CASH_KEY, String(safe));
  window.dispatchEvent(new CustomEvent('pms-cash-updated', { detail: { cash: readCash() } }));
}

function adjustCash(delta, meta = {}) {
  const change = Math.round(Number(delta || 0));
  if (!Number.isFinite(change) || change === 0) return readCash();
  const current = readCash();
  const next = normalizeMoney(current + change);
  if (next < 0) { showCashAlert('Not enough cash balance.'); return current; }
  setCash(next);
  const ledger = readLedger();
  ledger.push({
    id: crypto.randomUUID(), createdAt: new Date().toISOString(),
    delta: change, note: String(meta.note || ''),
    type: String(meta.type || (change >= 0 ? 'credit' : 'debit')),
    kind: String(meta.kind || 'system'),
    entryCategory: String(meta.entryCategory || 'transaction'),
    baseAmount: Math.round(Number(meta.baseAmount || Math.abs(change))),
    charges: Number(meta.charges || 0), editable: Boolean(meta.editable),
    profitDelta: Math.round(Number(meta.profitDelta || 0)),
  });
  saveLedger(ledger);
  return next;
}

function updateLedgerEntry(id, patch = {}) {
  const ledger = readLedger();
  const index = ledger.findIndex((row) => row.id === id);
  if (index < 0) return;
  const current = ledger[index];
  const oldDelta = Math.round(Number(current.delta || 0));
  const nextDelta = Math.round(Number(patch.delta));
  const safeNextDelta = Number.isFinite(nextDelta) ? nextDelta : oldDelta;
  ledger[index] = { ...current, ...patch, delta: safeNextDelta, updatedAt: new Date().toISOString() };
  const nextCash = normalizeMoney(readCash() - oldDelta + safeNextDelta);
  if (nextCash < 0) { showCashAlert('Not enough cash balance.'); return; }
  saveLedger(ledger);
  setCash(nextCash);
  syncProfitBookedWithLedger();
}

function deleteLedgerEntry(id) {
  const ledger = readLedger();
  const index = ledger.findIndex((row) => row.id === id);
  if (index < 0) return;
  const [removed] = ledger.splice(index, 1);
  const nextCash = normalizeMoney(readCash() - Math.round(Number(removed.delta || 0)));
  if (nextCash < 0) { showCashAlert('Not enough cash balance.'); return; }
  saveLedger(ledger);
  setCash(nextCash);
  syncProfitBookedWithLedger();
}

function clearLedgerHistory() {
  setProfitCashedBase(readProfitCashedOut());
  setProfitCashedBalance(readProfitCashedOut());
  saveLedger([]);
  syncProfitBookedWithLedger();
  window.dispatchEvent(new CustomEvent('pms-cash-updated', { detail: { cash: readCash() } }));
}

function investedCapital() {
  const trades = readJsonRows('trades');
  const longterm = readJsonRows('longterm');
  const sip = JSON.parse(localStorage.getItem('sipStateV4') || '{}');
  const sipInvested = Object.values(sip.records || {}).flat()
    .reduce((sum, row) => sum + Number(row.amount || (Number(row.units || 0) * Number(row.nav || 0))), 0);
  const tradeInvested = trades.reduce((sum, row) => sum + (Number(row.wacc || 0) * Number(row.qty || 0)), 0);
  const longInvested = longterm.reduce((sum, row) => sum + (Number(row.wacc || 0) * Number(row.qty || 0)), 0);
  return tradeInvested + longInvested + sipInvested;
}

function computeProfitDelta(direction, amount) {
  const baseAmount = Math.round(Number(amount || 0));
  if (!Number.isFinite(baseAmount) || baseAmount <= 0) return 0;
  if (direction === 'out') return -baseAmount;
  if (direction === 'in') return baseAmount;
  return 0;
}

function readProfitCashedBase() {
  const value = Math.round(Number(localStorage.getItem(PROFIT_CASHED_BASE_KEY) || 0));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function setProfitCashedBase(value) {
  const safe = Math.max(0, Math.round(Number(value || 0)));
  localStorage.setItem(PROFIT_CASHED_BASE_KEY, String(safe));
  return safe;
}

function readProfitCashedOut() {
  const raw = localStorage.getItem(PROFIT_CASHED_BAL_KEY);
  if (raw != null) {
    const parsed = Math.round(Number(raw || 0));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const legacy = readProfitCashedBase() + readLedger().reduce((sum, row) => {
    if (row.entryCategory !== 'profit') return sum;
    const amount = Number(row.baseAmount || Math.abs(Number(row.delta || 0)));
    if (row.type === 'profit_out') return sum + amount;
    if (row.type === 'profit_in') return sum - amount;
    return sum;
  }, 0);
  const seeded = Math.max(0, Math.round(Number(legacy || 0)));
  localStorage.setItem(PROFIT_CASHED_BAL_KEY, String(seeded));
  return seeded;
}

function setProfitCashedBalance(value) {
  const safe = Math.max(0, Math.round(Number(value || 0)));
  localStorage.setItem(PROFIT_CASHED_BAL_KEY, String(safe));
  return safe;
}

function adjustProfitCashed(delta, meta = {}) {
  const change = Math.round(Number(delta || 0));
  if (!Number.isFinite(change) || change === 0) return readProfitCashedOut();
  const current = readProfitCashedOut();
  const next = Math.max(0, current + change);
  if (next === current && change < 0) {
    showCashAlert('Not enough profit cashed balance.');
    return current;
  }
  setProfitCashedBalance(next);
  const ledger = readLedger();
  ledger.push({
    id: crypto.randomUUID(), createdAt: new Date().toISOString(),
    delta: 0, note: String(meta.note || ''),
    type: String(meta.type || (change >= 0 ? 'profit_out' : 'profit_in')),
    kind: String(meta.kind || 'system'),
    entryCategory: 'profit',
    baseAmount: Math.abs(change),
    charges: Number(meta.charges || 0), editable: Boolean(meta.editable),
    profitDelta: change,
  });
  saveLedger(ledger);
  window.dispatchEvent(new CustomEvent('pms-cash-updated', { detail: { cash: readCash() } }));
  syncProfitBookedWithLedger();
  return next;
}

function addProfitCashEntry(direction, amount, note = '') {
  const mode = direction === 'in' ? 'in' : 'out';
  const baseAmount = Math.round(Number(amount || 0));
  if (!Number.isFinite(baseAmount) || baseAmount <= 0) return readCash();
  const feeAmount = Math.min(mode === 'in' ? PROFIT_IN_FEE : PROFIT_OUT_FEE, baseAmount);
  const payoutAmount = Math.max(0, baseAmount - feeAmount);
  const mainNote = String(note || '').trim() || (mode === 'in' ? 'Invest Back' : 'Withdraw');

  if (mode === 'out') {
    const afterPayout = adjustCash(-payoutAmount, {
      note: `${mainNote} · Net ${payoutAmount}`,
      type: 'profit_out', kind: 'manual', entryCategory: 'profit',
      baseAmount: payoutAmount, charges: 0, editable: true,
      profitDelta: payoutAmount,
    });
    if (feeAmount > 0) {
      adjustCash(-feeAmount, {
        note: `${mainNote} · Fee ${feeAmount}`,
        type: 'profit_fee', kind: 'manual', entryCategory: 'profit_fee',
        baseAmount: feeAmount, charges: 0, editable: true,
      });
    }
    setProfitCashedBalance(readProfitCashedOut() + payoutAmount);
    syncProfitBookedWithLedger();
    return afterPayout;
  }

  const currentProfit = readProfitCashedOut();
  if (currentProfit < payoutAmount) {
    showCashAlert('Not enough profit cashed balance.');
    return readCash();
  }
  const afterDeposit = adjustCash(payoutAmount, {
    note: `${mainNote} · Net ${payoutAmount}`,
    type: 'profit_in', kind: 'manual', entryCategory: 'profit',
    baseAmount: payoutAmount, charges: 0, editable: true,
    profitDelta: -payoutAmount,
  });
  if (feeAmount > 0) {
    adjustCash(-feeAmount, {
      note: `${mainNote} · Fee ${feeAmount}`,
      type: 'profit_fee_in', kind: 'manual', entryCategory: 'profit_fee',
      baseAmount: feeAmount, charges: 0, editable: true,
    });
  }
  setProfitCashedBalance(currentProfit - payoutAmount);
  syncProfitBookedWithLedger();
  return afterDeposit;
}

function readProfitSeries() {
  try {
    const rows = JSON.parse(localStorage.getItem(PROFIT_BOOK_SERIES_KEY) || '[]');
    return Array.isArray(rows) ? rows : [];
  } catch { return []; }
}

function saveProfitSeries(rows) {
  localStorage.setItem(PROFIT_BOOK_SERIES_KEY, JSON.stringify(rows));
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function ensureProfitSeries() {
  let rows = readProfitSeries();
  if (!rows.length) {
    rows = [{ date: PROFIT_BOOK_START_DATE, value: PROFIT_BOOK_START_VALUE }];
  }
  rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const today = todayIsoDate();
  let cursor = new Date(rows[rows.length - 1].date);
  const end = new Date(today);
  while (cursor < end) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    rows.push({ date: cursor.toISOString().slice(0, 10), value: Number(rows[rows.length - 1].value || 0) });
  }
  saveProfitSeries(rows);
  return rows;
}

function setTodayProfitValue(value) {
  const rows = ensureProfitSeries();
  const safe = Math.round(Number(value || 0));
  const last = rows[rows.length - 1];
  last.value = Math.max(Number(last.value || 0), safe);
  saveProfitSeries(rows);
  return rows;
}

function syncProfitBookedWithLedger() {
  return setTodayProfitValue(readProfitCashedOut());
}

function showCashAlert(message) {
  AppState.dispatch({ type: 'SHOW_ALERT', payload: String(message || 'Not enough cash balance.') });
}

function readJsonRows(key) {
  try { const p = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(p) ? p : []; }
  catch { return []; }
}

window.PmsCapital = {
  CASH_KEY, LEDGER_KEY, readCash, setCash, adjustCash, readLedger,
  updateLedgerEntry, deleteLedgerEntry, clearLedgerHistory,
  investedCapital, addProfitCashEntry, computeProfitDelta,
  readProfitCashedOut, adjustProfitCashed, setProfitCashedBalance, showCashAlert,
  updateWidgets: () => window.dispatchEvent(new CustomEvent('pms-cash-updated')),
};

window.PmsProfitBook = {
  KEY: PROFIT_BOOK_SERIES_KEY,
  START_DATE: PROFIT_BOOK_START_DATE,
  readSeries: ensureProfitSeries,
  syncWithLedger: syncProfitBookedWithLedger,
};

// ─── EARNINGS ENGINE ─────────────────────────────────────────────────────
const EARNINGS_KEY = 'earningsStateV1';

function readEarningsState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(EARNINGS_KEY) || '{}');
    const passive = Number(parsed.passiveIncome || 0);
    const oneTime = Array.isArray(parsed.oneTimeIncomes) ? parsed.oneTimeIncomes : [];
    return {
      passiveIncome: Number.isFinite(passive) && passive >= 0 ? passive : 0,
      oneTimeIncomes: oneTime.map((row) => ({
        id: row.id || crypto.randomUUID(),
        month: String(row.month || ''),
        amount: Math.max(0, Math.round(Number(row.amount || 0))),
        note: String(row.note || '').trim(),
        createdAt: row.createdAt || new Date().toISOString(),
      })).filter((row) => /^\d{4}-\d{2}$/.test(row.month) && row.amount > 0),
    };
  } catch {
    return { passiveIncome: 0, oneTimeIncomes: [] };
  }
}

function saveEarningsState(nextState) {
  localStorage.setItem(EARNINGS_KEY, JSON.stringify(nextState));
  window.dispatchEvent(new CustomEvent('pms-earnings-updated'));
}

function monthKeyFromDate(isoString) {
  return String(isoString || '').slice(0, 7);
}

function monthlyOneTimeTotal(state, monthKey = monthKeyFromDate(new Date().toISOString())) {
  return (state.oneTimeIncomes || [])
    .filter((row) => row.month === monthKey)
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
}

function daysBetween(startIso, endDate = new Date()) {
  const start = new Date(startIso || endDate.toISOString());
  const end = new Date(endDate);
  const diff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Number.isFinite(diff) && diff > 0 ? diff : 0;
}

function getDailyRealizedContrib(exited) {
  return exited.reduce((sum, row) => {
    const holdingDays = Math.max(1, Math.floor(Number(row.holdingDays || 0)));
    const elapsed = daysBetween(row.exitedAt);
    const perDay = Number(row.profit || 0) / (holdingDays + elapsed);
    return sum + perDay;
  }, 0);
}

function getLargestTradeDayProfit(exited) {
  if (!exited.length) return 0;
  return exited.reduce((best, row) => {
    const holdingDays = Math.max(1, Math.floor(Number(row.holdingDays || 0)));
    const perDay = Number(row.profit || 0) / holdingDays;
    return perDay > best ? perDay : best;
  }, 0);
}

function computeEarningsSummary() {
  const state = readEarningsState();
  const monthKey = monthKeyFromDate(new Date().toISOString());
  const oneTimeMonth = monthlyOneTimeTotal(state, monthKey);
  const passiveMonthly = Number(state.passiveIncome || 0);
  const monthIncome = passiveMonthly + oneTimeMonth;
  const basePerDay = monthIncome / 30;
  const exited = readJsonRows('exitedTradesV2');
  const realizedDaily = getDailyRealizedContrib(exited);
  const defaultLargestDay = getLargestTradeDayProfit(exited);
  const epd = Math.max(defaultLargestDay, basePerDay) + realizedDaily;
  return {
    passiveMonthly,
    oneTimeMonth,
    monthIncome,
    yearIncome: monthIncome * 12,
    basePerDay,
    epd,
    largestTradeDayProfit: defaultLargestDay,
    realizedDaily,
    oneTimeIncomes: state.oneTimeIncomes,
  };
}

window.PmsEarnings = {
  KEY: EARNINGS_KEY,
  readState: readEarningsState,
  saveState: saveEarningsState,
  computeSummary: computeEarningsSummary,
};

// ─── APP STATE (single source of truth) ───────────────────────────────────
const AppState = (() => {
  let state = {
    currentView: 'dashboard',
    alert: null,
    marketStatus: 'closed',
  };
  const listeners = new Set();

  function dispatch(action) {
    switch (action.type) {
      case 'NAVIGATE': state = { ...state, currentView: action.payload }; break;
      case 'SHOW_ALERT': state = { ...state, alert: action.payload }; break;
      case 'DISMISS_ALERT': state = { ...state, alert: null }; break;
      case 'MARKET_STATUS': state = { ...state, marketStatus: action.payload }; break;
    }
    listeners.forEach(fn => fn(state));
  }

  function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  function getState() { return state; }

  return { dispatch, subscribe, getState };
})();

window.AppState = AppState;

// ─── LTP UPDATER (preserved from ltp-updater.js) ──────────────────────────
const LtpUpdater = (() => {
  const TARGET_KEYS = ['trades', 'longterm'];

  function normalizeSymbol(value) {
    return String(value || '').trim().toUpperCase();
  }

  function parseCSV(text) {
    if (!text || !String(text).trim()) throw new Error('CSV file is empty');
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;
    const input = String(text).replace(/\r\n?/g, '\n');

    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      if (ch === '"') {
        if (inQuotes && input[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (ch === ',' && !inQuotes) {
        row.push(cell.trim());
        cell = '';
        continue;
      }
      if (ch === '\n' && !inQuotes) {
        row.push(cell.trim());
        if (row.some(v => v !== '')) rows.push(row);
        row = [];
        cell = '';
        continue;
      }
      cell += ch;
    }

    if (cell.length || row.length) {
      row.push(cell.trim());
      if (row.some(v => v !== '')) rows.push(row);
    }
    if (!rows.length) throw new Error('CSV file is empty');

    const header = rows[0].map(v => String(v || '').trim().replace(/^"|"$/g, ''));
    const headerLen = header.length;
    const securityNameIndex = header.findIndex(h => h.toLowerCase() === 'security name');
    const normalizedRows = [header];

    rows.slice(1).forEach((rawRow) => {
      const cleaned = rawRow.map(v => String(v || '').trim().replace(/^"|"$/g, ''));
      if (cleaned.length === headerLen) {
        normalizedRows.push(cleaned);
        return;
      }
      if (cleaned.length > headerLen && securityNameIndex !== -1) {
        const tailCount = headerLen - securityNameIndex - 1;
        const head = cleaned.slice(0, securityNameIndex);
        const tail = cleaned.slice(cleaned.length - tailCount);
        const nameParts = cleaned.slice(securityNameIndex, cleaned.length - tailCount);
        normalizedRows.push([...head, nameParts.join(','), ...tail]);
        return;
      }
      if (cleaned.length < headerLen) {
        normalizedRows.push([...cleaned, ...Array(headerLen - cleaned.length).fill('')]);
      }
    });

    return normalizedRows;
  }

  function buildLtpMap(rows) {
    if (!Array.isArray(rows) || rows.length < 2) throw new Error('CSV must include header and at least one data row');
    const headers = rows[0].map(h => String(h || '').toLowerCase().trim());
    const symbolIndex = headers.findIndex(h => h.includes('symbol') || h.includes('script') || h.includes('ticker'));
    const ltpIndex = headers.findIndex(h => h === 'ltp' || h.includes('last traded price') || (h.includes('last') && h.includes('price')));
    if (symbolIndex === -1 || ltpIndex === -1) throw new Error('Missing required columns: Symbol and LTP');
    const ltpMap = new Map();
    rows.slice(1).forEach(row => {
      const symbol = normalizeSymbol(row[symbolIndex]);
      if (!symbol) return;
      const ltp = Number(String(row[ltpIndex] || '').replace(/,/g, '').trim());
      if (Number.isFinite(ltp) && ltp > 0) ltpMap.set(symbol, ltp);
    });
    return ltpMap;
  }

  function applyLtpMap(ltpMap) {
    let updated = 0;
    TARGET_KEYS.forEach(key => {
      const rows = readJsonRows(key);
      let changed = false;
      rows.forEach(row => {
        const rawSymbol = String(row.script || row.symbol || row.ticker || '').trim();
        if (!rawSymbol) return;
        const exactKey = normalizeSymbol(rawSymbol);
        if (ltpMap.has(exactKey)) {
          row.ltp = ltpMap.get(exactKey);
          changed = true;
          updated++;
        }
      });
      if (changed) localStorage.setItem(key, JSON.stringify(rows));
    });
    return updated;
  }

  function processCSVText(text) {
    const rows = parseCSV(text);
    const ltpMap = buildLtpMap(rows);
    const updated = applyLtpMap(ltpMap);
    window.dispatchEvent(new CustomEvent('pms-ltp-updated', { detail: { updated } }));
    return updated;
  }

  return { processCSVText, normalizeSymbol };
})();

window.LtpUpdater = LtpUpdater;

// ─── BACKUP / RESTORE ─────────────────────────────────────────────────────
function createPortfolioSnapshot() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) data[key] = localStorage.getItem(key);
  }
  return { version: 2, exportedAt: new Date().toISOString(), data };
}

function restorePortfolioSnapshot(payload) {
  const data = payload.data || payload;
  if (typeof data !== 'object') throw new Error('Invalid backup format');
  Object.entries(data).forEach(([key, value]) => {
    if (typeof value === 'string') localStorage.setItem(key, value);
  });
}

function bytesToBase64(bytes) {
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveBackupKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 180000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function sha256Base64(text) {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(String(text || '')));
  return bytesToBase64(new Uint8Array(digest));
}

async function createEncryptedBackupCSV(password) {
  const snap = createPortfolioSnapshot();
  const payload = JSON.stringify(snap);
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveBackupKey(password, salt);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(payload));
  const cipherBase64 = bytesToBase64(new Uint8Array(encrypted));
  const passwordHash = await sha256Base64(`${password}::${bytesToBase64(salt)}`);
  const obfuscatedCipher = cipherBase64.split('').reverse().join('');
  return ['meta', 'NEPSE-SEALED-V3', new Date().toISOString(), bytesToBase64(salt), bytesToBase64(iv), passwordHash, obfuscatedCipher].join(',');
}

async function restoreEncryptedBackupCSV(csvText, password) {
  const lines = String(csvText || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) throw new Error('Empty backup file');
  const meta = lines[0].split(',');
  if (meta.length < 6 || meta[0] !== 'meta' || !/^NEPSE-(CHAOS-V[12]|SEALED-V3)$/.test(meta[1])) {
    throw new Error('Unsupported backup format');
  }
  const salt = base64ToBytes(meta[3]);
  const iv = base64ToBytes(meta[4]);
  const isV3 = meta[1] === 'NEPSE-SEALED-V3';
  const expectedChunks = isV3 ? 1 : Number(meta[5]);

  if (meta[1] === 'NEPSE-CHAOS-V2' || isV3) {
    const savedHash = isV3 ? (meta[5] || '') : (meta[6] || '');
    const inputHash = await sha256Base64(`${password}::${bytesToBase64(salt)}`);
    if (!savedHash || savedHash !== inputHash) {
      const deniedError = new Error('Access Denied');
      deniedError.code = 'ACCESS_DENIED';
      throw deniedError;
    }
  }

  let cipherBase64 = '';
  if (isV3) {
    cipherBase64 = String(meta.slice(6).join(',') || '').split('').reverse().join('');
    if (!cipherBase64) throw new Error('Backup data is incomplete');
  } else {
    const chunkRows = lines.slice(1).filter(line => /^r\d+,/.test(line));
    if (!Number.isFinite(expectedChunks) || expectedChunks < 1 || chunkRows.length < expectedChunks) {
      throw new Error('Backup data is incomplete');
    }
    const ordered = chunkRows
      .map((line) => {
        const parts = line.split(',');
        return { idx: Number(String(parts[0]).slice(1)), chunk: parts[2] || '' };
      })
      .filter(row => Number.isFinite(row.idx))
      .sort((a, b) => a.idx - b.idx)
      .slice(0, expectedChunks)
      .map(row => row.chunk.split('').reverse().join(''));
    cipherBase64 = ordered.join('');
  }
  const key = await deriveBackupKey(password, salt);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, base64ToBytes(cipherBase64));
  const dec = new TextDecoder();
  const payload = JSON.parse(dec.decode(decrypted));
  restorePortfolioSnapshot(payload);
}

window.PmsBackup = {
  createPortfolioSnapshot,
  restorePortfolioSnapshot,
  createEncryptedBackupCSV,
  restoreEncryptedBackupCSV,
};

// ─── MARKET TIMER ─────────────────────────────────────────────────────────
function startMarketClock(onTick) {
  const tick = () => {
    const now = new Date();
    const h = now.getHours(), m = now.getMinutes(), s = now.getSeconds(), d = now.getDay();
    const isWeekend = d === 0 || d === 6;
    const minutes = h * 60 + m;
    const preOpen = minutes >= (10 * 60 + 30) && minutes < (10 * 60 + 45);
    const closedWindow = minutes >= (10 * 60 + 45) && minutes < (11 * 60);
    const openWindow = minutes >= (11 * 60) && minutes <= (15 * 60);

    let status = 'closed';
    let label = 'NEPSE CLOSED';

    if (isWeekend) {
      status = 'closed';
      label = 'NEPSE CLOSED (WEEKEND)';
    } else if (preOpen) {
      status = 'pre';
      label = 'NEPSE PRE-OPEN';
    } else if (closedWindow) {
      status = 'closed';
      label = 'NEPSE CLOSED';
    } else if (openWindow) {
      status = 'open';
      label = 'NEPSE OPEN';
    } else {
      status = 'closed';
      label = 'NEPSE CLOSED';
    }

    const hh = String(h).padStart(2,'0'), mm = String(m).padStart(2,'0'), ss = String(s).padStart(2,'0');
    onTick({ status, time: `${hh}:${mm}:${ss}`, label });
  };
  tick();
  return setInterval(tick, 1000);
}

window.startMarketClock = startMarketClock;

// ─── ANALYTICS ENGINE ─────────────────────────────────────────────────────
const Analytics = (() => {
  function getExitedTrades() {
    try { return JSON.parse(localStorage.getItem('exitedTradesV2') || '[]'); } catch { return []; }
  }

  function normalizeExited(row) {
    const calc = calculateRoundTrip({
      buyPrice: row.buyPrice, soldPrice: row.soldPrice || row.currentPrice || 0,
      qty: row.qty, holdingDays: row.holdingDays,
    });
    const profit = Number(calc.netProfit || calc.profit || row.profit || 0);
    const capitalGainTax = Number(calc.capitalGainTax || row.capitalGainTax || 0);
    const holdingDays = Math.floor(Number(row.holdingDays || 0));
    const buy = calc.buy || {}, sell = calc.sell || {};
    const totalTaxPaid = capitalGainTax +
      Number(buy.commission || 0) + Number(sell.commission || 0) +
      Number(buy.sebonFee || 0) + Number(sell.sebonFee || 0) +
      Number(buy.dpCharge || 0) + Number(sell.dpCharge || 0);
    return {
      ...row, capitalGainTax, profit,
      soldTotal: Number(calc.realizedAmount || row.soldTotal || 0),
      total: Number(row.total || (Number(row.soldPrice || 0) * Number(row.qty || 0))),
      totalTaxPaid, buyTotal: Number(calc.invested || row.buyTotal || 0),
      netSoldTotal: Number(calc.netRealizedAmount || row.netSoldTotal || row.soldTotal || 0),
      currentPrice: Number(row.currentPrice || row.soldPrice || 0),
      perDayProfit: holdingDays > 0 ? profit / holdingDays : profit,
      moneyReceivable: Number(calc.invested || row.buyTotal || 0) + profit,
      holdingDays,
    };
  }

  function getSummary() {
    const exited = getExitedTrades().map(normalizeExited);
    const totalInvested = exited.reduce((s, r) => s + Number(r.buyTotal || 0), 0);
    const totalProfit = exited.reduce((s, r) => s + Number(r.profit || 0), 0);
    const totalTax = exited.reduce((s, r) => s + Number(r.capitalGainTax || 0), 0);
    const roi = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;
    const wins = exited.filter(r => Number(r.profit || 0) > 0).length;
    const winRate = exited.length > 0 ? (wins / exited.length) * 100 : 0;
    const avgHolding = exited.length > 0
      ? exited.reduce((s, r) => s + Number(r.holdingDays || 0), 0) / exited.length : 0;
    const bestTrade = exited.length ? exited.reduce((best, r) => Number(r.profit) > Number(best.profit) ? r : best, exited[0]) : null;
    const worstTrade = exited.length ? exited.reduce((worst, r) => Number(r.profit) < Number(worst.profit) ? r : worst, exited[0]) : null;
    return { exited, totalInvested, totalProfit, totalTax, roi, winRate, avgHolding, bestTrade, worstTrade, count: exited.length };
  }

  function computeCumulativeSeries(series) {
    let running = 0;
    return series.map(v => { running += Number(v || 0); return Math.round(running * 100) / 100; });
  }

  function computeMovingAverage(series, windowSize) {
    return series.map((_, idx) => {
      if (idx === 0 || idx < windowSize - 1) return idx === 0 ? 0 : null;
      const set = series.slice(idx - windowSize + 1, idx + 1);
      return Math.round((set.reduce((s, n) => s + Number(n || 0), 0) / set.length) * 100) / 100;
    });
  }

  function getPortfolioTotals() {
    const trades = readJsonRows('trades');
    const longterm = readJsonRows('longterm');
    const sip = JSON.parse(localStorage.getItem('sipStateV4') || '{}');

    const tradeLikeTotal = (rows) => rows.reduce((s, r) => s + Number(r.ltp || 0) * Number(r.qty || 0), 0);
    const sipTotal = (() => {
      let t = 0;
      (sip.sips || []).forEach(name => {
        const rows = (sip.records || {})[name] || [];
        const units = rows.reduce((s, r) => s + Number(r.units || 0), 0);
        t += units * Number((sip.currentNav || {})[name] || 0);
      });
      return t;
    })();

    const tradeInvested = trades.reduce((s, r) => s + Number(r.wacc || 0) * Number(r.qty || 0), 0);
    const longInvested = longterm.reduce((s, r) => s + Number(r.wacc || 0) * Number(r.qty || 0), 0);
    const sipInvested = Object.values(sip.records || {}).flat()
      .reduce((s, r) => s + Number(r.amount || (Number(r.units || 0) * Number(r.nav || 0))), 0);

    const tradeValue = tradeLikeTotal(trades);
    const longValue = tradeLikeTotal(longterm);
    const bookedProfit = Number(readProfitCashedOut() || 0);

    return {
      trades: { value: tradeValue, invested: tradeInvested, pl: tradeValue - tradeInvested },
      longterm: { value: longValue, invested: longInvested, pl: longValue - longInvested },
      sip: { value: sipTotal, invested: sipInvested, pl: sipTotal - sipInvested },
      bookedProfit,
      total: tradeValue + longValue + sipTotal + bookedProfit,
      totalInvested: tradeInvested + longInvested + sipInvested,
    };
  }

  return { getExitedTrades, normalizeExited, getSummary, computeCumulativeSeries, computeMovingAverage, getPortfolioTotals };
})();

window.Analytics = Analytics;
