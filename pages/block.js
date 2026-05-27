// pages/block.js

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const targetUrl = urlParams.get('target');
    const domain = urlParams.get('domain');
  
    document.getElementById('view-dashboard-btn').onclick = () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('pages/dashboard.html') });
    };
  
    const syncData = await BudgetGuardStorage.getSync();
    const leisure = syncData.budget.categories.leisure;
    const balance = leisure.allocated - leisure.spent;
    document.getElementById('leisure-balance').innerText = `Leisure Remaining: $${balance.toFixed(2)}`;
  
    document.getElementById('override-toggle-btn').onclick = () => {
      const form = document.getElementById('bypass-form-container');
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
    };
  
    document.getElementById('submit-override-btn').onclick = async () => {
      const enteredPassword = document.getElementById('override-password').value;
      const freshSyncData = await BudgetGuardStorage.getSync();
      const savedPassword = freshSyncData.profile.overridePassword;
  
      if (enteredPassword === savedPassword) {
        chrome.tabs.getCurrent(tab => {
          chrome.runtime.sendMessage({
            type: "BYPASS_SITE",
            domain: domain,
            targetUrl: targetUrl,
            tabId: tab.id
          });
        });
      } else {
        document.getElementById('error-msg').style.display = 'block';
        const localData = await BudgetGuardStorage.getLocal();
        const fails = localData.failedOverrides || [];
        fails.push({ timestamp: Date.now(), domain: domain });
        await BudgetGuardStorage.setLocal({ ...localData, failedOverrides: fails });
      }
    };
  });