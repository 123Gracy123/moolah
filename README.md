BudgetGuard

BudgetGuard is a personal finance companion Chrome Extension built using the
Manifest V3 API. It acts as an interactive budget manager and behavioral
intervention tool, dynamically restricting access to configured shopping
platforms and disabling checkout actions when category allocations are exceeded.

Architecture and File Structure

budgetguard/
├── manifest.json              # Extension configuration & MV3 API declarations
├── background.js              # Service worker handling navigation tracking, blocks, and overrides
├── popup/
│   ├── popup.html             # Compact, three-tab navigation UI
│   ├── popup.js               # Controls tab switching, age calculation, and profile sync
│   └── popup.css              # Dark-mode styling for the popup container
├── content/
│   └── content.js             # Purchase button detection, banners, and confirmation detection
├── pages/
│   ├── dashboard.html         # Full-screen spreadsheet, analytics panel, and settings UI
│   ├── dashboard.js           # Drives dashboard interactivity, graph rendering, and data tables
│   ├── dashboard.css          # Responsive styling layout for the full-screen view
│   ├── block.html             # Landing page shown when navigation to blocked sites occurs
│   └── block.js               # Resolves emergency override validation checks
└── utils/
    ├── storage.js             # Local/sync data abstraction driver
    ├── budgetEngine.js        # Mathematical forecasting, alert validation, and report modeling
    └── siteBlocker.js         # Domain parsing helper utilities

Core Capabilities

1.  Spreadsheet-Style Budget Manager: Supports real-time adjustments across four
    categories (Home Expenses, Leisure, Savings, Transportation) via the popup
    or full-screen dashboard. Updates remaining balances and visual status bars
    immediately upon adjustment.
2.  Behavioral Filter Interventions: Temporarily blocks user-specified domain
    names (using chrome.tabs.onUpdated in the service worker) if the Leisure
    budget is depleted. The interception template provides a pathway to unlock
    access using a pre-configured emergency password.
3.  Purchase Lock Controls: Employs a script that disables elements containing
    typical transactional phrases (e.g., "Add to Cart", "Buy Now", "Checkout")
    when leisure balances are exhausted, visually greying out elements and
    warning users on hover.
4.  Automated Order Receipt Parsing: Watches for typical checkout confirmations
    to dynamically scrape total pricing values. If pricing is identified, it
    deducts the value automatically; if extraction is unclear, it requests
    manual category assignment.
5.  Interactive Analytics Engine: Tracks browser site traffic trends, compiling
    visits into hourly activity grids rendered inside the dashboard using HTML5
    Canvas alongside list indicators showing behavioral tags.
6.  Alert Dispatch Verification: Monitors allocation levels and logs warning
    timestamps to local history once category spending exceeds 50% and 80%
    benchmarks.

Installation Guide

To install and run this extension locally in your Google Chrome browser:

1.  Download the Code: Ensure all files are saved in a single folder named
    budgetguard, preserving the subfolder structure exactly as shown.
2.  Access Extension Controls: Open Google Chrome and enter chrome://extensions
    in the address bar.
3.  Enable Developer Mode: Turn on the Developer mode toggle switch located in
    the upper-right corner of the Extensions page.
4.  Load the Unpacked Directory: Click the Load unpacked button in the
    upper-left area of the page.
5.  Select Folder: In the directory browser window, navigate to and select the
    budgetguard folder containing manifest.json.
6.  Verify Startup: The BudgetGuard shield emoji icon should appear in your
    browser extensions bar. Click on it to run the initial configuration wizard
    and load the dashboard.

Data Schema Definition

The extension stores configurations using the following structured layout in
chrome.storage.sync:

{
  "profile": {
    "firstName": "John",
    "lastName": "Doe",
    "birthday": "1995-05-15",
    "avatar": "😊",
    "overridePassword": "BypassPassword",
    "monthlyIncome": 5000
  },
  "budget": {
    "month": "2026-05",
    "categories": {
      "home": { "allocated": 1500, "spent": 120 },
      "leisure": { "allocated": 500, "spent": 0 },
      "savings": { "allocated": 1000, "spent": 0 },
      "transportation": { "allocated": 300, "spent": 15 }
    }
  },
  "transactions": [
    {
      "id": "tx_1716500000000",
      "date": "2026-05-24T10:15:30.000Z",
      "merchant": "Amazon",
      "amount": 42.50,
      "category": "leisure"
    }
  ],
  "blockedSites": [
    "adidas.com", "nike.com", "amazon.com", "shein.com", "etsy.com", "ebay.com"
  ],
  "settings": {
    "blockingEnabled": true,
    "warningsEnabled": true
  },
  "initialized": true
}

Technical Constraints and Limitations

  - Host Scopes: Content scripts run inside standard web protocols (http:// and
    https://). Blocking interventions do not operate on internal settings pages
    (chrome://).
  - Data Limits: The profile parameters, active budgets, block lists, and main
    transaction history are saved via chrome.storage.sync to ensure cross-device
    consistency within normal Chrome storage quota limits. Extensive session
    visit logs and hourly tracking matrices are isolated to
    chrome.storage.local.
  - Bypass Expiry: Password-validated bypass parameters are kept in active
    memory inside the background service worker lifecycle. These overrides apply
    only to the specific tab instance where validated and are deleted upon tab
    termination.
