// content/content.js

let budgetState = null;
let purchaseBlockEnabled = false;
let activeTooltip = null;
let tooltipTimeout = null;

// Initialize content script and cache budget state immediately
initContentScript();

function initContentScript() {
  chrome.runtime.sendMessage({ type: "GET_BUDGET_STATE" }, (response) => {
    if (response && response.syncData) {
      budgetState = response.syncData;
      if (budgetState.initialized) {
        checkAndApplyControls();
        detectPurchaseConfirmation();
        setupSimulationListeners();
      }
    }
  });
}

function checkAndApplyControls() {
  const leisure = budgetState.budget.categories.leisure;
  const remaining = leisure.allocated - leisure.spent;

  if (remaining <= 0 && budgetState.settings.blockingEnabled) {
    purchaseBlockEnabled = true;
    applyPurchaseBlocking();
    showTopBanner();

    // Listen for additions to DOM (dynamic SPAs like Amazon, Shopify)
    const observer = new MutationObserver(() => {
      applyPurchaseBlocking();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

function showTopBanner() {
  if (document.getElementById('budgetguard-block-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'budgetguard-block-banner';
  banner.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
      <span>🔒 <strong>Moolah:</strong> Leisure budget depleted ($${(budgetState.budget.categories.leisure.allocated - budgetState.budget.categories.leisure.spent).toFixed(2)} remaining). Purchases have been blocked.</span>
      <button id="bg-close-banner" style="background: none; border: none; color: white; cursor: pointer; font-weight: bold; font-size: 14px; margin-left: 10px;">✕</button>
    </div>
  `;

  // Apply Inline CSS directly to protect presentation layers
  Object.assign(banner.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    backgroundColor: '#ef4444',
    color: '#ffffff',
    textAlign: 'center',
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '500',
    zIndex: '2147483647',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    boxSizing: 'border-box'
  });

  document.body.appendChild(banner);
  document.body.style.paddingTop = '40px'; // Shift body down

  document.getElementById('bg-close-banner').addEventListener('click', () => {
    banner.remove();
    document.body.style.paddingTop = '0';
  });
}

const BLOCK_KEYWORDS = ["buy now", "add to cart", "purchase", "checkout", "place order", "buy", "complete purchase", "pay now"];

function applyPurchaseBlocking() {
  if (!purchaseBlockEnabled) return;

  const elements = document.querySelectorAll('button, input[type="submit"], input[type="button"], a, [role="button"]');
  elements.forEach((el) => {
    if (el.hasAttribute('data-budgetguard-blocked')) return;

    const text = (el.textContent || el.value || '').trim().toLowerCase();
    const matchesKeyword = BLOCK_KEYWORDS.some(keyword => text === keyword || text.includes(keyword));

    if (matchesKeyword) {
      el.setAttribute('data-budgetguard-blocked', 'true');
      
      // Gray out purchase triggers
      el.style.backgroundColor = '#94a3b8'; 
      el.style.color = '#f8fafc';
      el.style.cursor = 'not-allowed';
      el.style.opacity = '0.7';
      if (el.tagName === 'A') {
        el.style.pointerEvents = 'none';
      }

      el.setAttribute('title', 'Budget limit reached. Visit Moolah to review.');
      
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        chrome.runtime.sendMessage({
          type: "SHOW_NOTIFICATION",
          title: "Purchase Blocked 🔒",
          message: "Your Moolah Leisure budget has been fully spent. Purchase buttons are locked!"
        });
      }, true);
    }
  });
}

// --- AUTOMATIC PURCHASE DEDUCTION ---
function detectPurchaseConfirmation() {
  const url = window.location.href.toLowerCase();
  const isConfirmationUrl = url.includes('/order-confirm') || 
                            url.includes('/checkout/thank-you') || 
                            url.includes('/order/success') || 
                            url.includes('/thank-you') || 
                            url.includes('/confirmation');

  const bodyText = document.body.innerText;
  const hasConfirmKeywords = bodyText.includes("Thank you for your purchase") || 
                             bodyText.includes("Order Confirmed") || 
                             bodyText.includes("Your order has been placed");

  if (isConfirmationUrl || hasConfirmKeywords) {
    if (sessionStorage.getItem('bg_purchase_logged')) return;
    sessionStorage.setItem('bg_purchase_logged', 'true');

    let amount = extractPrice(bodyText);
    showPurchaseLoggerWidget(amount, window.location.hostname);
  }
}

function extractPrice(text) {
  const regex = /\$\s?(\d{1,5}(?:\.\d{2})?)/g;
  let match;
  let detectedPrices = [];
  while ((match = regex.exec(text)) !== null) {
    detectedPrices.push(parseFloat(match[1]));
  }
  
  if (detectedPrices.length > 0) {
    return Math.max(...detectedPrices);
  }
  return null;
}

function showPurchaseLoggerWidget(detectedAmount, merchant) {
  const widget = document.createElement('div');
  widget.id = 'budgetguard-logger-widget';
  
  const formattedAmount = detectedAmount ? detectedAmount.toFixed(2) : "";

  widget.innerHTML = `
    <div style="background-color: #0f172a; border-radius: 12px; border: 2px solid #3b82f6; padding: 16px; width: 320px; color: white; font-family: system-ui, -apple-system, sans-serif; box-shadow: 0 10px 25px rgba(0,0,0,0.3);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <span style="font-weight: bold; font-size: 16px; display: flex; align-items: center; gap: 6px;">🎉 Moolah Detected!</span>
        <button id="bg-widget-close" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size: 16px;">✕</button>
      </div>
      <p style="margin: 0 0 12px 0; font-size: 13px; color: #94a3b8;">We noticed a purchase on ${merchant}. Let's track it.</p>
      <div style="margin-bottom: 12px;">
        <label style="display:block; font-size: 11px; color:#3b82f6; font-weight:bold; margin-bottom: 4px; text-transform: uppercase;">Amount Spend ($)</label>
        <input type="number" step="0.01" id="bg-widget-amount" value="${formattedAmount}" style="width:100%; padding: 8px; background-color: #1e293b; border: 1px solid #475569; border-radius: 6px; color: white; box-sizing: border-box; font-size: 14px; outline: none;" placeholder="0.00" />
      </div>
      <div style="margin-bottom: 16px;">
        <label style="display:block; font-size: 11px; color:#3b82f6; font-weight:bold; margin-bottom: 4px; text-transform: uppercase;">Deduct Category</label>
        <select id="bg-widget-cat" style="width:100%; padding: 8px; background-color: #1e293b; border: 1px solid #475569; border-radius: 6px; color: white; box-sizing: border-box; font-size: 14px; outline: none;">
          <option value="leisure" selected>🎉 Leisure</option>
          <option value="home">🏠 Home Expenses</option>
          <option value="savings">💰 Savings</option>
          <option value="transportation">🚗 Transportation</option>
        </select>
      </div>
      <button id="bg-widget-save" style="width: 100%; background-color: #22c55e; color: white; border: none; padding: 10px; border-radius: 6px; font-weight: bold; cursor: pointer;">Log Purchase</button>
    </div>
  `;

  Object.assign(widget.style, {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    zIndex: '2147483647',
    animation: 'slideIn 0.3s ease-out'
  });

  const styleSheet = document.createElement("style");
  styleSheet.innerText = `
    @keyframes slideIn {
      from { transform: translateY(100px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `;
  document.head.appendChild(styleSheet);
  document.body.appendChild(widget);

  document.getElementById('bg-widget-close').addEventListener('click', () => {
    widget.remove();
  });

  document.getElementById('bg-widget-save').addEventListener('click', () => {
    const amountVal = parseFloat(document.getElementById('bg-widget-amount').value);
    const categoryVal = document.getElementById('bg-widget-cat').value;

    if (isNaN(amountVal) || amountVal <= 0) {
      alert("Please enter a valid amount greater than zero.");
      return;
    }

    chrome.runtime.sendMessage({
      type: "LOG_PURCHASE",
      amount: amountVal,
      merchant,
      category: categoryVal
    }, (res) => {
      if (res && res.success) {
        widget.innerHTML = `
          <div style="background-color: #0f172a; border-radius: 12px; border: 2px solid #22c55e; padding: 20px; width: 320px; color: white; text-align: center; font-family: system-ui, -apple-system, sans-serif;">
            <span style="font-size: 32px;">✅</span>
            <h4 style="margin: 10px 0 5px 0; color: #22c55e;">Purchase Tracked!</h4>
            <p style="margin: 0; font-size: 13px; color: #94a3b8;">Deducted $${amountVal.toFixed(2)} from your ${categoryVal} budget.</p>
          </div>
        `;
        setTimeout(() => {
          widget.remove();
        }, 3000);
      }
    });
  });
}


// --- FEATURE: SPREADSHEET SIMULATION PREVIEW (TOOLTIP) ---

/**
 * Attaches hover listeners to purchase/checkout elements to render
 * real-time impact simulation tooltips.
 */
function setupSimulationListeners() {
  const selectQuery = 'button, input[type="submit"], input[type="button"], a, [role="button"]';
  
  // Attach listeners using event delegation to handle dynamically loaded content
  document.body.addEventListener('mouseenter', (event) => {
    const target = event.target.closest(selectQuery);
    if (!target) return;

    // Filter elements to only trigger on button/link targets that contain transactional wording
    const text = (target.textContent || target.value || '').trim().toLowerCase();
    const matchesKeyword = BLOCK_KEYWORDS.some(keyword => text === keyword || text.includes(keyword));

    if (matchesKeyword) {
      clearTimeout(tooltipTimeout);
      const estimatedPrice = autoScrapeProductPrice(target);
      createSimulationTooltip(target, estimatedPrice);
    }
  }, true);

  document.body.addEventListener('mouseleave', (event) => {
    const target = event.target.closest(selectQuery);
    if (!target) return;

    // Use a short delay to keep the tooltip alive if the user hovers over the tooltip itself
    tooltipTimeout = setTimeout(() => {
      if (activeTooltip && !activeTooltip.matches(':hover')) {
        destroyActiveTooltip();
      }
    }, 200);
  }, true);
}

/**
 * Scans adjacent DOM nodes upward from the buy button to locate a price string.
 * Defaults to $19.99 if no match is found.
 */
function autoScrapeProductPrice(buttonElement) {
  let parent = buttonElement.parentElement;
  // Climb up to 4 levels of ancestors to look for price text configurations ($X.XX)
  for (let i = 0; i < 4 && parent; i++) {
    const textContent = parent.innerText || "";
    const matches = textContent.match(/\$\s?(\d{1,5}(?:\.\d{2})?)/);
    if (matches) {
      return parseFloat(matches[1]);
    }
    parent = parent.parentElement;
  }
  return 19.99; // Fallback price
}

/**
 * Creates, populates, and appends the simulation preview card to the DOM.
 */
function createSimulationTooltip(buttonElement, estimatedPrice) {
  if (activeTooltip) {
    destroyActiveTooltip();
  }

  const tooltip = document.createElement('div');
  tooltip.id = 'budgetguard-simulation-tooltip';
  
  // Default simulation category
  let simulatedCategory = 'leisure';
  let productPrice = estimatedPrice;

  tooltip.innerHTML = `
    <div class="bg-sim-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #334155; padding-bottom:8px; margin-bottom:10px;">
      <span style="font-weight:bold; font-size:12px; color:#3b82f6; display:flex; align-items:center; gap:4px;">📊 Moolah Simulator</span>
      <span style="font-size:10px; background:#1e293b; padding:2px 6px; border-radius:4px; color:#94a3b8;">Impact Preview</span>
    </div>
    <div style="display:flex; gap:10px; margin-bottom:10px;">
      <div style="flex:1;">
        <label style="display:block; font-size:9px; color:#94a3b8; text-transform:uppercase; margin-bottom:3px; font-weight:bold;">Simulate Price ($)</label>
        <input type="number" step="0.01" id="bg-sim-price-input" value="${productPrice.toFixed(2)}" style="width:100%; padding:6px; background:#0f172a; border:1px solid #334155; border-radius:4px; color:white; font-size:12px; box-sizing:border-box; outline:none;" />
      </div>
      <div style="flex:1;">
        <label style="display:block; font-size:9px; color:#94a3b8; text-transform:uppercase; margin-bottom:3px; font-weight:bold;">Category</label>
        <select id="bg-sim-cat-select" style="width:100%; padding:6px; background:#0f172a; border:1px solid #334155; border-radius:4px; color:white; font-size:12px; box-sizing:border-box; outline:none;">
          <option value="leisure" ${simulatedCategory === 'leisure' ? 'selected' : ''}>🎉 Leisure</option>
          <option value="home" ${simulatedCategory === 'home' ? 'selected' : ''}>🏠 Home</option>
          <option value="savings" ${simulatedCategory === 'savings' ? 'selected' : ''}>💰 Savings</option>
          <option value="transportation" ${simulatedCategory === 'transportation' ? 'selected' : ''}>🚗 Transport</option>
        </select>
      </div>
    </div>
    <div id="bg-sim-metrics-panel"></div>
  `;

  // Apply visual layer style properties to guarantee styling isolation
  Object.assign(tooltip.style, {
    position: 'absolute',
    width: '280px',
    backgroundColor: '#1e293b',
    border: '1px solid #475569',
    borderRadius: '8px',
    padding: '12px',
    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
    zIndex: '2147483646',
    color: 'white',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    boxSizing: 'border-box',
    opacity: '0',
    transition: 'opacity 0.2s ease-in-out'
  });

  document.body.appendChild(tooltip);
  activeTooltip = tooltip;

  // Prevent immediate dismissal when cursor enters the simulation tooltip card
  tooltip.addEventListener('mouseleave', () => {
    destroyActiveTooltip();
  });

  // Attach internal controls and real-time triggers
  const priceInput = tooltip.querySelector('#bg-sim-price-input');
  const catSelect = tooltip.querySelector('#bg-sim-cat-select');

  const updateSimulationView = () => {
    productPrice = parseFloat(priceInput.value) || 0;
    simulatedCategory = catSelect.value;
    renderSimulationMetrics(tooltip, simulatedCategory, productPrice);
  };

  priceInput.addEventListener('input', updateSimulationView);
  catSelect.addEventListener('change', updateSimulationView);

  // Render original preview output and position the container
  updateSimulationView();
  positionTooltipRelativeToButton(buttonElement, tooltip);
  tooltip.style.opacity = '1';
}

/**
 * Calculates and plots the spreadsheet row comparisons inside the active simulation card.
 */
function renderSimulationMetrics(tooltipElement, category, projectedDeduction) {
  const container = tooltipElement.querySelector('#bg-sim-metrics-panel');
  if (!container || !budgetState) return;

  const originalDetails = budgetState.budget.categories[category];
  const allocated = originalDetails.allocated || 0;
  const spent = originalDetails.spent || 0;

  const remainingBefore = allocated - spent;
  const spentAfter = spent + projectedDeduction;
  const remainingAfter = allocated - spentAfter;

  const originalPercent = allocated > 0 ? (spent / allocated) * 100 : 0;
  const projectedPercent = allocated > 0 ? (spentAfter / allocated) * 100 : 0;

  // Visual status indicators
  let beforeFillColor = '#22c55e'; // Green
  if (originalPercent >= 80) beforeFillColor = '#ef4444'; // Red
  else if (originalPercent >= 50) beforeFillColor = '#f59e0b'; // Amber

  let afterFillColor = '#22c55e';
  if (projectedPercent >= 80) afterFillColor = '#ef4444';
  else if (projectedPercent >= 50) afterFillColor = '#f59e0b';

  container.innerHTML = `
    <div style="background-color:#0f172a; border-radius:6px; padding:8px; font-size:11px; margin-bottom:8px;">
      <table style="width:100%; border-collapse:collapse; text-align:left;">
        <thead>
          <tr style="border-bottom:1px solid #1e293b; color:#94a3b8; font-size:9px;">
            <th style="padding-bottom:4px;">METRIC</th>
            <th style="padding-bottom:4px; text-align:right;">CURRENT</th>
            <th style="padding-bottom:4px; text-align:right; color:#60a5fa;">PROJECTED</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:4px 0;">Spent</td>
            <td style="text-align:right; padding:4px 0;">$${spent.toFixed(2)}</td>
            <td style="text-align:right; font-weight:bold; color:#f87171; padding:4px 0;">$${spentAfter.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;">Remaining</td>
            <td style="text-align:right; padding:4px 0; color:${remainingBefore >= 0 ? '#4ade80' : '#f87171'}">$${remainingBefore.toFixed(2)}</td>
            <td style="text-align:right; font-weight:bold; color:${remainingAfter >= 0 ? '#34d399' : '#f87171'}; padding:4px 0;">$${remainingAfter.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Dual Comparison Progress Bar visualizer -->
    <div>
      <div style="display:flex; justify-content:space-between; font-size:9px; color:#94a3b8; margin-bottom:3px;">
        <span>Current: ${originalPercent.toFixed(0)}%</span>
        <span style="color:#60a5fa;">Projected: ${projectedPercent.toFixed(0)}%</span>
      </div>
      <div class="progress-bar-container" style="background-color:#334155; height:6px; border-radius:3px; overflow:hidden; position:relative;">
        <!-- Base Spent Fill -->
        <div style="width: ${Math.min(originalPercent, 100)}%; background-color: ${beforeFillColor}; height: 100%; border-radius:3px;"></div>
        <!-- Projected spent delta indicator -->
        <div style="width: ${Math.min(Math.max(projectedPercent - originalPercent, 0), 100)}%; background-color: #3b82f6; opacity:0.6; height: 100%; position:absolute; top:0; left:${Math.min(originalPercent, 100)}%;"></div>
      </div>
    </div>

    <!-- Warnings system indicator inside tooltip context -->
    ${remainingAfter < 0 ? `
      <div style="margin-top:10px; padding:6px; background-color:#451a03; border:1px solid #f59e0b; border-radius:4px; color:#fcd34d; font-size:10px; display:flex; align-items:center; gap:6px;">
        <span>🚨 Warning: This simulated purchase will exceed your allocated budget limits.</span>
      </div>
    ` : ''}
  `;
}

/**
 * POSITIONING LOGIC:
 * Calculates target coordinates relative to parent element context dimensions
 * and shifts location bounds horizontally and vertically to prevent off-screen clipping.
 */
function positionTooltipRelativeToButton(buttonElement, tooltipElement) {
  const rect = buttonElement.getBoundingClientRect();
  const scrollY = window.scrollY || window.pageYOffset;
  const scrollX = window.scrollX || window.pageXOffset;

  const tooltipWidth = tooltipElement.offsetWidth || 280;
  const tooltipHeight = tooltipElement.offsetHeight || 180;
  const offsetSpacing = 8; // Margin buffer in pixels

  // Default coordinate path: Center-aligned directly above the button
  let topPosition = rect.top + scrollY - tooltipHeight - offsetSpacing;
  let leftPosition = rect.left + scrollX + (rect.width / 2) - (tooltipWidth / 2);

  // Vertical bound constraint check (Top overflow)
  // If placing the card above the element causes it to overflow beyond the top boundary 
  // of the viewport, position the card below the target button instead.
  if (rect.top - tooltipHeight - offsetSpacing < 0) {
    topPosition = rect.top + scrollY + rect.height + offsetSpacing;
  }

  // Horizontal bound constraint check (Left overflow)
  // If the left edge of the tooltip goes off-screen, pin it to the left edge with a margin.
  if (leftPosition < offsetSpacing) {
    leftPosition = offsetSpacing;
  } 
  // Horizontal bound constraint check (Right overflow)
  // If the right edge of the tooltip exceeds viewport bounds, shift it to stay visible.
  else if (leftPosition + tooltipWidth > window.innerWidth) {
    leftPosition = window.innerWidth - tooltipWidth - offsetSpacing;
  }

  // Apply calculated pixel positions directly to absolute styles
  tooltipElement.style.top = `${topPosition}px`;
  tooltipElement.style.left = `${leftPosition}px`;
}

/**
 * Safely unbinds and deletes the active simulation preview tooltip from the document body.
 */
function destroyActiveTooltip() {
  if (activeTooltip) {
    activeTooltip.remove();
    activeTooltip = null;
  }
}