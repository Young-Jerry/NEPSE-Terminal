/**
 * Trades View
 */
function renderTrades(container) {
  const view = createPortfolioView({
    storageKey: 'trades',
    showRanges: true,
    showInvested: true,
    title: 'Active Trades',
    subtitle: 'Short-term trading positions with sell targets',
  });
  container.innerHTML = '';
  container.appendChild(view);
}

window._renderTrades = renderTrades;
