Here is the updated **README.md** file for **BudgetGuard**. It has been updated to include the new **Spreadsheet Simulator Tooltip** under the capabilities, architecture, and testing guides.

---

# Moolah

Moolah is a personal finance companion Chrome Extension built using the Manifest V3 API. It acts as an interactive budget manager and behavioral intervention tool, dynamically restricting access to configured shopping platforms, disabling checkout actions, and rendering real-time purchase impact simulations directly next to e-commerce checkout elements.

---

## Architecture and File Structure

```text
budgetguard/
├── manifest.json              # Extension configuration & MV3 API declarations
├── background.js              # Service worker handling navigation tracking, blocks, and overrides
├── popup/
│   ├── popup.html             # Compact, three-tab navigation UI
│   ├── popup.js               # Controls tab switching, age calculation, and profile sync
│   └── popup.css              # Dark-mode styling for the popup container
├── content/
│   └── content.js             # Purchase button detection, banners, confirmation detection, & simulation tooltips
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
```

---

## Core Capabilities

1. **Spreadsheet-Style Budget Manager**: Supports real-time adjustments across four categories (Home Expenses, Leisure, Savings, Transportation) via the popup or full-screen dashboard. Updates remaining balances and visual status bars immediately upon adjustment.
2. **Interactive Spreadsheet Simulator Tooltip**: Detects cursor hovers on transactional elements (e.g., "Add to Cart", "Buy Now") and renders a simulated projection popup [3]. The card automatically estimates the product's price from nearby DOM text, allows manual adjustment, and generates side-by-side current vs. projected budget charts.
3. **Collision Detection Positioning Logic**: Evaluates buy button dimensions via bounding boxes to dynamically offset the simulator tooltip vertically and horizontally, avoiding off-screen clipping or container overflow truncation.
4. **Behavioral Filter Interventions**: Temporarily blocks user-specified domain names (using `chrome.tabs.onUpdated` in the service worker) if the Leisure budget is depleted. The interception template provides a pathway to unlock access using a pre-configured emergency password.
5. **Purchase Lock Controls**: Employs a content script that disables elements containing typical transactional phrases (e.g., "Add to Cart", "Buy Now", "Checkout") when leisure balances are exhausted, visually greying out elements and warning users on hover.
6. **Automated Order Receipt Parsing**: Watches for typical checkout confirmations to scrape total pricing values. If pricing is identified, it deducts the value automatically; if extraction is unclear, it requests manual category assignment.
7. **Interactive Analytics Engine**: Tracks browser site traffic trends, compiling visits into hourly activity grids rendered inside the dashboard using HTML5 Canvas alongside list indicators showing behavioral tags.

---

## Installation Guide

To install and run this extension locally in your Google Chrome browser:

1. **Download the Code**: Ensure all files are saved in a single folder named `budgetguard`, preserving the subfolder structure exactly as shown.
2. **Access Extension Controls**: Open Google Chrome and enter `chrome://extensions` in the address bar.
3. **Enable Developer Mode**: Turn on the **Developer mode** toggle switch located in the upper-right corner of the Extensions page.
4. **Load the Unpacked Directory**: Click the **Load unpacked** button in the upper-left area of the page.
5. **Select Folder**: In the directory browser window, navigate to and select the `budgetguard` folder containing `manifest.json`.
6. **Verify Startup**: Click the puzzle piece icon in your extensions toolbar and pin **Moolah**. Click it to configure the initial settings.

---

## Step-by-Step Testing Guide

Use the following methods to safely evaluate all features on live websites without executing actual monetary transactions.

### Phase 1: Interactive Tooltip Simulations (With an Active Budget)
1. Go to any product listing page on a major e-commerce platform (e.g., [Amazon.com](https://www.amazon.com) or [eBay.com](https://www.ebay.com)).
2. Hover your mouse over the primary **Add to Cart** or **Buy Now** button.
3. Observe that the **Moolah Simulator** tooltip renders, centered above or below the button without clipping outside the browser margins.
4. Modify the value inside the **Simulate Price ($)** text field. Verify that the current vs. projected tables and dual-color progress bar adjust immediately.
5. Set the simulated price to a value larger than your total budget and verify that the inline orange warning banner appears.

### Phase 2: Interception, Password Overrides, & Purchase Blocking (With a Depleted Budget)
1. Open the Moolah dashboard by clicking the `↗` icon in the popup.
2. Set your **🎉 Leisure Spend** allocation to `$0` (or manually log a transaction that exceeds your Leisure limit).
3. Try to visit a restricted website on your block list, such as [etsy.com](https://www.etsy.com) or [nike.com](https://www.nike.com) [5].
4. Verify that you are immediately redirected to `pages/block.html`.
5. Under the **Emergency Password Override**, type an incorrect password to verify error tracking, then type the correct password from your onboarding setup.
6. Once redirected back to the merchant site, verify that:
   - A red restriction banner slides into view at the top of the viewport.
   - All checkout/purchase buttons are visually grayed out with a lock cursor and disabled click events.
   - Attempting to click any blocked button fires a standard system notification.

### Phase 3: Simulated Order Receipt Detections (Local Simulation)
To verify receipt scanning without making real payments:
1. Open a blank page or a non-transactional site (e.g., [example.com](https://www.example.com)).
2. Press `F12` to open your browser Developer Tools, then click the **Console** tab.
3. Copy, paste, and execute the following script:

```javascript
// Simulate an order confirmation page DOM
document.body.innerHTML = `
  <div style="padding: 50px; text-align: center; font-family: sans-serif;">
    <h1>🎉 Order Confirmed!</h1>
    <h2>Thank you for your purchase!</h2>
    <div style="background-color: #f1f5f9; padding: 20px; display: inline-block; border-radius: 8px; margin-top: 20px;">
      <p style="font-size: 24px; font-weight: bold; color: #0f172a;">Total Price: $124.99</p>
    </div>
  </div>
`;

// Run confirmation parser
detectPurchaseConfirmation();
```

4. Confirm that the Moolah confirmation logger slides into view with `$124.99` pre-populated in the entry field. Select a category, save the entry, and verify that the deduction is saved in your dashboard transaction log.

---

## Technical Constraints and Limitations

- **Protocol Scope**: Content scripts run inside standard web protocols (`http://` and `https://`). Blocking interventions do not operate on internal browser settings pages (`chrome://`).
- **Data Limits**: Active budgets, profile structures, block lists, and main transaction history are saved via `chrome.storage.sync` to ensure consistency within normal Chrome sync quota limits. Extensive session visit logs and hourly tracking matrices are isolated to `chrome.storage.local`.
- **Bypass Expiry**: Password-validated bypass parameters are kept in active memory inside the background service worker lifecycle. These overrides apply only to the specific tab instance where validated and are deleted upon tab termination.
