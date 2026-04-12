/**
 * Modal Manager — reusable modal system
 */
const Modal = (() => {
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  let onCloseCallback = null;

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  function open({ title, subtitle = '', body = '', footer = '', wide = false, onClose }) {
    onCloseCallback = onClose || null;
    box.className = 'modal-box' + (wide ? ' modal-wide' : '');
    box.innerHTML = `
      <div class="flex justify-between items-center mb16">
        <div>
          <div class="modal-title">${escHtml(title)}</div>
          ${subtitle ? `<div class="modal-sub">${escHtml(subtitle)}</div>` : ''}
        </div>
        <button class="btn-ghost" id="modalCloseBtn" style="font-size:18px;line-height:1;">✕</button>
      </div>
      <div id="modalBody">${body}</div>
      ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
    `;
    box.querySelector('#modalCloseBtn').addEventListener('click', close);
    overlay.classList.remove('hidden');
    // Focus first input if any
    setTimeout(() => { const inp = box.querySelector('input'); if (inp) inp.focus(); }, 50);
  }

  function setBody(html) {
    const b = box.querySelector('#modalBody');
    if (b) b.innerHTML = html;
  }

  function close() {
    overlay.classList.add('hidden');
    box.innerHTML = '';
    if (onCloseCallback) { onCloseCallback(); onCloseCallback = null; }
  }

  function confirm({ title, message, confirmText = 'Confirm', danger = true, onConfirm }) {
    open({
      title,
      body: `<p style="color:var(--text-secondary);font-size:13px;">${escHtml(message)}</p>`,
      footer: `
        <button class="btn-secondary" id="modal-cancel-btn">Cancel</button>
        <button class="${danger ? 'btn-danger' : 'btn-primary'}" id="modal-confirm-btn">${escHtml(confirmText)}</button>
      `,
    });
    box.querySelector('#modal-cancel-btn').addEventListener('click', close);
    box.querySelector('#modal-confirm-btn').addEventListener('click', () => {
      close();
      if (onConfirm) onConfirm();
    });
  }

  function prompt({
    title,
    subtitle = '',
    label = 'Value',
    placeholder = '',
    confirmText = 'Submit',
    inputType = 'text',
    onSubmit,
  }) {
    let resolved = false;
    const finish = (value, shouldClose = true) => {
      if (resolved) return;
      resolved = true;
      if (shouldClose) close();
      resolver(value);
    };
    let resolver = () => {};
    open({
      title,
      subtitle,
      onClose: () => finish(null, false),
      body: `
        <div class="form-group">
          <label class="form-label">${escHtml(label)}</label>
          <input class="form-input" id="modalPromptInput" type="${escHtml(inputType)}" placeholder="${escHtml(placeholder)}" />
        </div>
      `,
      footer: `
        <button class="btn-secondary" id="modalPromptCancel">Cancel</button>
        <button class="btn-primary" id="modalPromptSubmit">${escHtml(confirmText)}</button>
      `,
    });

    return new Promise((resolve) => {
      resolver = resolve;
      const input = box.querySelector('#modalPromptInput');
      const cancelBtn = box.querySelector('#modalPromptCancel');
      const submitBtn = box.querySelector('#modalPromptSubmit');
      if (cancelBtn) cancelBtn.addEventListener('click', () => finish(null));
      if (submitBtn) submitBtn.addEventListener('click', () => {
        const value = input ? String(input.value || '') : '';
        if (onSubmit) {
          const out = onSubmit(value);
          if (out === false) return;
        }
        finish(value);
      });
      if (input) {
        input.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          if (submitBtn) submitBtn.click();
        });
      }
    });
  }

  function escHtml(v) {
    return String(v || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  return { open, close, confirm, prompt, setBody, escHtml };
})();

window.Modal = Modal;

function isPrivacyMode() {
  return Boolean(window.PmsPrivacy && window.PmsPrivacy.isEnabled && window.PmsPrivacy.isEnabled());
}

function maskDigits(value) {
  return window.PmsPrivacy && window.PmsPrivacy.maskValue ? window.PmsPrivacy.maskValue() : 'XXX';
}

function showRsPrefix() {
  return !(window.PmsDisplay && window.PmsDisplay.showRsPrefix && !window.PmsDisplay.showRsPrefix());
}

// Helpers for all views
function currency(value) {
  const valueText = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Number(value || 0));
  const out = showRsPrefix() ? `Rs ${valueText}` : valueText;
  return isPrivacyMode() ? maskDigits(out) : out;
}

function currencyInt(value) {
  const valueText = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(Number(value || 0)));
  const out = showRsPrefix() ? `Rs ${valueText}` : valueText;
  return isPrivacyMode() ? maskDigits(out) : out;
}

function currency2(value) {
  const valueText = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));
  const out = showRsPrefix() ? `Rs ${valueText}` : valueText;
  return isPrivacyMode() ? maskDigits(out) : out;
}

function pct(value, decimals = 1) {
  const out = `${Number(value || 0).toFixed(decimals)}%`;
  return isPrivacyMode() ? maskDigits(out) : out;
}

function plClass(value) {
  if (isPrivacyMode()) return 'value-neutral';
  return Number(value) >= 0 ? 'value-profit' : 'value-loss';
}

function num(v) { return Number.parseFloat(v); }

function readJsonArr(key) {
  try { const p = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(p) ? p : []; }
  catch { return []; }
}

function escHtml(v) {
  return String(v || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

window._helpers = { currency, currencyInt, currency2, pct, plClass, num, readJsonArr, escHtml };
