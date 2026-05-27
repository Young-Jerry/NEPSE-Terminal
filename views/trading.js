(() => {
  window._renderTrading = function renderTrading(container) {
    container.innerHTML = `
      <section class="card">
        <div class="section-title">Trading Desk (Base Setup)</div>
        <p class="subtext">Execution workspace placeholder for upcoming order entry, positions, and strategy controls.</p>
      </section>
    `;
  };
})();
