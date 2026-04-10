/**
 * Long-Term View
 */
function renderLongTerm(container) {
  const view = createPortfolioView({
    storageKey: 'longterm',
    showRanges: false,
    showInvested: true,
    title: 'Long-Term Holdings',
    subtitle: 'Long-term investment positions',
  });
  container.innerHTML = '';
  container.appendChild(view);
}

window._renderLongTerm = renderLongTerm;
