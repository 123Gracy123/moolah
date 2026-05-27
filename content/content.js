// content/content.js

let budgetState = null;
let purchaseBlockEnabled = false;

initContentScript();

function initContentScript() {
  chrome.runtime.sendMessage({ type: "GET_BUDGET_STATE" }, (response) => {
    if (response && response.syncData) {
      budgetState = response.syncData;
      if (budgetState.initialized) {
        checkAndApplyControls();
        detectPurchaseConfirmation();
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
      <span>🔒 <strong>Moolah🐄:</strong> Leisure budget depleted ($${(budgetState.budget.categories.leisure.allocated - budgetState.budget.categories.leisure.spent).toFixed(2)} remaining). Purchases blocked.</span>
      <button id="bg-close-banner" style="background: none; border: none; color: white; cursor: pointer; font-weight: bold; font-size: 14px; margin-left: 10px;">✕</button>
    </div>
  `;

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
  document.body.style.paddingTop = '40px';

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