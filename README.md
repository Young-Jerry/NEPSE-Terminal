# NEPSE Terminal v4

Dense, data-heavy trading terminal for NEPSE investors.

## What's New in v4

### Dashboard (fully redesigned)
- **Row 1 — KPI Strip**: Realized ROI % | Net Worth | Unrealized P/L | Cash %
- **Row 2 — Info Strip**: Latest Position details | SIP countdown (days until 15th)
- **Row 3 — Best Stock**: Full-width card showing highest ROI% holding
- **Row 4 — Portfolio Tables**: Top 3 Trades + Top 3 Long-Term side by side
- All KPI cards are clickable → open detailed stat modal

### Update System
- **UPDATE DATA** (topbar blue button): Recalculates everything, resets all views, re-renders current view
- **UPD LTP** (topbar): Updates LTP prices only from CSV, triggers immediate re-render
- Views are lazy-rendered (only on first visit or after Update Data)

### UI
- Dense terminal aesthetic — JetBrains Mono + IBM Plex Sans
- Only red/green for P/L coloring
- No decorative elements, no mock data, no placeholder charts
- Analytics view removed (data available in Past Trades)

## All Features Preserved
- Upload/Download data (Import/Export in topbar)
- Update LTP (CSV upload)
- Trades view with full portfolio table
- Long-Term view
- SIP System
- Past Trades with exit recording
- Cash Ledger
- Calculator
- Settings

## Usage
Open `index.html` directly in browser. All data stored in localStorage.
