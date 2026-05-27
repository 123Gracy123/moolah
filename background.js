// background.js
//importScripts('utils/storage.js', 'utils/budgetEngine.js', 'utils/siteBlocker.js');
// background.js
import './utils/storage.js';
import './utils/budgetEngine.js';
import './utils/siteBlocker.js';

const tabOverrides = new Map();

chrome.runtime.onInstalled.addListener(async () => {
  await BudgetGuardStorage.initialize();
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabOverrides.delete(tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url) {
    await handleTabUrlCheck(tabId, tab.url);
  }
});

async function handleTabUrlCheck(tabId, url) {
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return;
  }

  const syncData = await BudgetGuardStorage.getSync();
  if (!syncData.initialized || !syncData.settings.blockingEnabled) {
    return;
  }

  const leisureBudget = syncData.budget.categories.leisure;
  const isLeisureDepleted = (leisureBudget.allocated - leisureBudget.spent) <= 0;

  const domain = SiteBlocker.extractHostname(url);
  const isBlockedSite = SiteBlocker.isBlocked(url, syncData.blockedSites);

  if (isBlockedSite) {
    await logShoppingVisit(domain);

    if (isLeisureDepleted) {
      const overrides = tabOverrides.get(tabId);
      if (overrides && overrides.has(domain)) {
        return;
      }

      await logBlockAction(domain);

      const blockPageUrl = chrome.runtime.getURL(`pages/block.html?target=${encodeURIComponent(url)}&domain=${encodeURIComponent(domain)}`);
      chrome.tabs.update(tabId, { url: blockPageUrl });
    }
  }
}

async function logShoppingVisit(domain) {
  const localData = await BudgetGuardStorage.getLocal();
  const visits = localData.visits || [];
  visits.push({
    timestamp: Date.now(),
    domain: domain
  });
  await BudgetGuardStorage.setLocal({ ...localData, visits });
}

async function logBlockAction(domain) {
  const localData = await BudgetGuardStorage.getLocal();
  const blocks = localData.blocks || [];
  blocks.push({
    timestamp: Date.now(),
    domain: domain
  });
  await BudgetGuardStorage.setLocal({ ...localData, blocks });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_BUDGET_STATE") {
    BudgetGuardStorage.getSync().then(syncData => {
      sendResponse({ syncData });
    });
    return true; 
  }

  if (request.type === "BYPASS_SITE") {
    const { domain, targetUrl, tabId } = request;
    
    if (!tabOverrides.has(tabId)) {
      tabOverrides.set(tabId, new Set());
    }
    tabOverrides.get(tabId).add(domain);

    BudgetGuardStorage.getLocal().then(localData => {
      const overrides = localData.overrides || [];
      overrides.push({
        timestamp: Date.now(),
        domain: domain
      });
      BudgetGuardStorage.setLocal({ ...localData, overrides }).then(() => {
        chrome.tabs.update(tabId, { url: targetUrl });
        sendResponse({ success: true });
      });
    });
    return true;
  }

  if (request.type === "SHOW_NOTIFICATION") {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "popup/icon.png", 
      title: request.title,
      message: request.message,
      priority: 2
    });
    sendResponse({ success: true });
  }

  if (request.type === "LOG_PURCHASE") {
    const { amount, merchant, category } = request;
    BudgetGuardStorage.getSync().then(async (syncData) => {
      const cat = syncData.budget.categories[category];
      const oldSpent = cat.spent;
      cat.spent += amount;
      
      const transactions = syncData.transactions || [];
      transactions.unshift({
        id: 'tx_' + Date.now(),
        date: new Date().toISOString(),
        merchant,
        amount,
        category
      });
      
      syncData.transactions = transactions;
      await BudgetGuardStorage.setSync(syncData);

      await BudgetEngine.checkThresholdAlerts(syncData, category, oldSpent, cat.spent);

      chrome.runtime.sendMessage({ type: "DATA_UPDATED" });
      sendResponse({ success: true, newSpent: cat.spent });
    });
    return true;
  }
});