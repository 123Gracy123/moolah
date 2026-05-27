// utils/storage.js
(function (global) {
    const DEFAULT_BLOCKED_SITES = [
      "adidas.com", "nike.com", "amazon.com", "shein.com", "etsy.com", "ebay.com", 
      "bestbuy.com", "target.com", "walmart.com", "asos.com", "zara.com", 
      "fashionnova.com", "stockx.com", "goat.com", "footlocker.com"
    ];
  
    const DEFAULT_DATA = {
      profile: {
        firstName: "",
        lastName: "",
        birthday: "",
        avatar: "😊",
        overridePassword: "",
        monthlyIncome: 0
      },
      budget: {
        month: "", 
        categories: {
          home: { allocated: 0, spent: 0 },
          leisure: { allocated: 0, spent: 0 },
          savings: { allocated: 0, spent: 0 },
          transportation: { allocated: 0, spent: 0 }
        }
      },
      transactions: [],
      blockedSites: DEFAULT_BLOCKED_SITES,
      settings: {
        blockingEnabled: true,
        warningsEnabled: true
      },
      initialized: false
    };
  
    const Storage = {
      getSync: function () {
        return new Promise((resolve) => {
          chrome.storage.sync.get(null, (items) => {
            if (Object.keys(items).length === 0) {
              resolve(JSON.parse(JSON.stringify(DEFAULT_DATA)));
            } else {
              resolve(items);
            }
          });
        });
      },
      setSync: function (data) {
        return new Promise((resolve) => {
          chrome.storage.sync.set(data, () => {
            resolve();
          });
        });
      },
      getLocal: function () {
        return new Promise((resolve) => {
          chrome.storage.local.get(null, (items) => {
            resolve(items || {});
          });
        });
      },
      setLocal: function (data) {
        return new Promise((resolve) => {
          chrome.storage.local.set(data, () => {
            resolve();
          });
        });
      },
      initialize: async function () {
        const syncData = await this.getSync();
        if (!syncData.initialized) {
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          syncData.budget.month = `${year}-${month}`;
          await this.setSync(syncData);
        }
        
        const localData = await this.getLocal();
        if (!localData.visits) {
          await this.setLocal({ visits: [], overrides: [], blocks: [], alerts: [] });
        }
      }
    };
  
    global.BudgetGuardStorage = Storage;
  })(typeof self !== 'undefined' ? self : this);