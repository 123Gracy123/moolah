// pages/dashboard.js

document.addEventListener('DOMContentLoaded', async () => {
    await BudgetGuardStorage.initialize();
    const syncData = await BudgetGuardStorage.getSync();
  
    if (!syncData.initialized) {
      showSection('onboarding-section');
      initOnboarding();
    } else {
      showSection('budget-section');
      initDashboard(syncData);
    }
  
    setupNavigation();
  });
  
  function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(sec => {
      sec.classList.add('hidden');
    });
    document.getElementById(sectionId).classList.remove('hidden');
  
    document.querySelectorAll('.nav-item').forEach(btn => {
      if (btn.getAttribute('data-target') === sectionId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }
  
  function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', async () => {
        const target = btn.getAttribute('data-target');
        const syncData = await BudgetGuardStorage.getSync();
        if (!syncData.initialized && target !== 'onboarding-section') {
          alert("Please complete the onboarding wizard first!");
          return;
        }
        showSection(target);
        if (target === 'insights-section') {
          renderInsights();
        } else if (target === 'settings-section') {
          renderSettings(syncData);
        } else if (target === 'budget-section') {
          renderBudgetSheet(syncData);
        }
      });
    });
  }
  
  function initOnboarding() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.style.display = 'none';
    });
  
    document.getElementById('ob-submit-btn').addEventListener('click', async () => {
      const firstName = document.getElementById('ob-first-name').value.trim();
      const lastName = document.getElementById('ob-last-name').value.trim();
      const birthday = document.getElementById('ob-birthday').value;
      const income = parseFloat(document.getElementById('ob-income').value) || 0;
      const avatar = document.getElementById('ob-avatar').value;
      const password = document.getElementById('ob-password').value;
  
      const homeAlloc = parseFloat(document.getElementById('ob-bud-home').value) || 0;
      const leisureAlloc = parseFloat(document.getElementById('ob-bud-leisure').value) || 0;
      const savingsAlloc = parseFloat(document.getElementById('ob-bud-savings').value) || 0;
      const transAlloc = parseFloat(document.getElementById('ob-bud-trans').value) || 0;
  
      if (!firstName || !lastName || !birthday || !password) {
        alert("All setup profile fields and password are required!");
        return;
      }
  
      const syncData = await BudgetGuardStorage.getSync();
      syncData.profile = {
        firstName,
        lastName,
        birthday,
        avatar,
        overridePassword: password,
        monthlyIncome: income
      };
  
      const now = new Date();
      const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      syncData.budget = {
        month: monthStr,
        categories: {
          home: { allocated: homeAlloc, spent: 0 },
          leisure: { allocated: leisureAlloc, spent: 0 },
          savings: { allocated: savingsAlloc, spent: 0 },
          transportation: { allocated: transAlloc, spent: 0 }
        }
      };
  
      syncData.initialized = true;
      await BudgetGuardStorage.setSync(syncData);
  
      document.querySelectorAll('.nav-item').forEach(item => {
        item.style.display = 'block';
      });
  
      initDashboard(syncData);
      showSection('budget-section');
    });
  }
  
  function initDashboard(syncData) {
    document.getElementById('sidebar-name').innerText = `${syncData.profile.firstName} ${syncData.profile.lastName}`;
    document.getElementById('sidebar-avatar').innerText = syncData.profile.avatar;
  
    renderBudgetSheet(syncData);
    renderTransactions(syncData);
  
    document.getElementById('man-save-btn').addEventListener('click', async () => {
      const amount = parseFloat(document.getElementById('man-amount').value);
      const merchant = document.getElementById('man-merchant').value.trim();
      const category = document.getElementById('man-category').value;
  
      if (isNaN(amount) || amount <= 0 || !merchant) {
        alert("Enter a valid amount and merchant name!");
        return;
      }
  
      chrome.runtime.sendMessage({
        type: "LOG_PURCHASE",
        amount,
        merchant,
        category
      }, async () => {
        const updatedSync = await BudgetGuardStorage.getSync();
        renderBudgetSheet(updatedSync);
        renderTransactions(updatedSync);
        
        document.getElementById('man-amount').value = '';
        document.getElementById('man-merchant').value = '';
      });
    });
  }
  
  function renderBudgetSheet(syncData) {
    document.getElementById('current-month-badge').innerText = `📊 Month: ${syncData.budget.month}`;
  
    const categories = [
      { key: 'home', label: '🏠 Home Expenses' },
      { key: 'leisure', label: '🎉 Leisure' },
      { key: 'savings', label: '💰 Savings' },
      { key: 'transportation', label: '🚗 Transportation' }
    ];
  
    const tbody = document.getElementById('sheets-tbody');
    tbody.innerHTML = '';
  
    let totalAllocated = 0;
    let totalSpent = 0;
  
    categories.forEach(cat => {
      const details = syncData.budget.categories[cat.key];
      const allocated = details.allocated || 0;
      const spent = details.spent || 0;
      const remaining = allocated - spent;
      const percent = allocated > 0 ? (spent / allocated) * 100 : 0;
  
      totalAllocated += allocated;
      totalSpent += spent;
  
      let fillColor = '#22c55e'; 
      if (percent >= 80) fillColor = '#ef4444'; 
      else if (percent >= 50) fillColor = '#f59e0b'; 
  
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${cat.label}</strong></td>
        <td><input type="number" class="cat-alloc-input" data-cat="${cat.key}" value="${allocated.toFixed(2)}" /></td>
        <td>$${spent.toFixed(2)}</td>
        <td style="color: ${remaining >= 0 ? '#22c55e' : '#ef4444'}; font-weight: bold;">$${remaining.toFixed(2)}</td>
        <td>
          <div class="progress-bar-container">
            <div class="progress-fill" style="width: ${Math.min(percent, 100)}%; background-color: ${fillColor};"></div>
          </div>
        </td>
        <td style="font-weight: 500;">${percent.toFixed(1)}%</td>
      `;
      tbody.appendChild(tr);
    });
  
    const totalRemaining = totalAllocated - totalSpent;
    const tfoot = document.getElementById('sheets-tfoot');
    tfoot.innerHTML = `
      <td>Total Summary</td>
      <td>$${totalAllocated.toFixed(2)}</td>
      <td>$${totalSpent.toFixed(2)}</td>
      <td style="color: ${totalRemaining >= 0 ? '#22c55e' : '#ef4444'}; font-weight: bold;">$${totalRemaining.toFixed(2)}</td>
      <td>
        <div class="progress-bar-container">
          <div class="progress-fill" style="width: ${Math.min(totalAllocated > 0 ? (totalSpent/totalAllocated)*100 : 0, 100)}%; background-color: #3b82f6;"></div>
        </div>
      </td>
      <td>${totalAllocated > 0 ? ((totalSpent/totalAllocated)*100).toFixed(1) : '0.0'}%</td>
    `;
  
    document.querySelectorAll('.cat-alloc-input').forEach(input => {
      input.addEventListener('change', async (e) => {
        const catKey = e.target.getAttribute('data-cat');
        const newVal = parseFloat(e.target.value) || 0;
  
        const updatedSync = await BudgetGuardStorage.getSync();
        updatedSync.budget.categories[catKey].allocated = newVal;
        await BudgetGuardStorage.setSync(updatedSync);
        
        renderBudgetSheet(updatedSync);
      });
    });
  }
  
  function renderTransactions(syncData) {
    const container = document.getElementById('transaction-list');
    container.innerHTML = '';
  
    const txs = syncData.transactions || [];
    if (txs.length === 0) {
      container.innerHTML = `<p class="empty-state">No transactions yet. Complete a purchase or log one manually!</p>`;
      return;
    }
  
    txs.forEach(tx => {
      const item = document.createElement('div');
      item.className = 'tx-item';
      
      const emojiMap = { home: '🏠', leisure: '🎉', savings: '💰', transportation: '🚗' };
      const emoji = emojiMap[tx.category] || '💸';
  
      const dateStr = new Date(tx.date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  
      item.innerHTML = `
        <div>
          <span class="tx-merchant">${tx.merchant}</span>
          <span class="tx-cat">${emoji} ${tx.category}</span>
          <div class="tx-date">${dateStr}</div>
        </div>
        <span class="tx-amount red">-$${parseFloat(tx.amount).toFixed(2)}</span>
      `;
      container.appendChild(item);
    });
  }
  
  async function renderInsights() {
    const report = await BudgetEngine.generateBehaviorReport();
    const syncData = await BudgetGuardStorage.getSync();
    const localData = await BudgetGuardStorage.getLocal();
  
    const tagEl = document.getElementById('insight-tag');
    tagEl.innerText = report.tag;
    if (report.alertColor === 'red') {
      tagEl.style.color = '#ef4444';
    } else if (report.alertColor === 'yellow') {
      tagEl.style.color = '#f59e0b';
    } else {
      tagEl.style.color = '#22c55e';
    }
  
    document.getElementById('insight-blocked').innerText = report.blockedAttempts;
    document.getElementById('insight-overrides').innerText = report.recentOverrides;
  
    const projEl = document.getElementById('insight-projection');
    const leisure = syncData.budget.categories.leisure;
    const daysProj = BudgetEngine.projectExhaustionDays(leisure.allocated, leisure.spent);
    
    if (daysProj === Infinity) {
      projEl.innerText = "🎉 Your Leisure spending rate is sustainable for the rest of this month.";
      projEl.style.backgroundColor = '#064e3b';
      projEl.style.borderColor = '#10b981';
    } else if (daysProj <= 0) {
      projEl.innerText = "🔴 Leisure budget is depleted. Platform restrictions are active.";
      projEl.style.backgroundColor = '#4c0519';
      projEl.style.borderColor = '#ef4444';
    } else {
      projEl.innerText = `At your current spending rate, you will exhaust your Leisure budget in ${Math.round(daysProj)} days.`;
      projEl.style.backgroundColor = '#451a03';
      projEl.style.borderColor = '#f59e0b';
    }
  
    const topList = document.getElementById('insight-top-sites');
    topList.innerHTML = '';
    if (report.topSites.length === 0) {
      topList.innerHTML = `<li class="empty-state">No shopping sites visited yet.</li>`;
    } else {
      report.topSites.forEach(site => {
        const li = document.createElement('li');
        li.className = 'top-site-item';
        li.innerHTML = `<span>${site.domain}</span> <strong>${site.count} visits</strong>`;
        topList.appendChild(li);
      });
    }
  
    const alertList = document.getElementById('alerts-history-list');
    alertList.innerHTML = '';
    const alerts = localData.alerts || [];
    if (alerts.length === 0) {
      alertList.innerHTML = `<p class="empty-state">No past alerts to show.</p>`;
    } else {
      alerts.forEach(alert => {
        const div = document.createElement('div');
        div.className = `alert-history-item ${alert.severity}`;
        const dateStr = new Date(alert.timestamp).toLocaleDateString();
        div.innerHTML = `<span>${alert.message}</span> <small style="color:#94a3b8; font-size:10px;">${dateStr}</small>`;
        alertList.appendChild(div);
      });
    }
  
    drawPeakHoursChart(report.hourCounts);
  }
  
  function drawPeakHoursChart(hourCounts) {
    const canvas = document.getElementById('hoursChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  
    const padding = 30;
    const chartWidth = canvas.width - padding * 2;
    const chartHeight = canvas.height - padding * 2;
    const maxCount = Math.max(...hourCounts, 1);
  
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(canvas.width - padding, y);
      ctx.stroke();
    }
  
    const barWidth = chartWidth / 24;
    ctx.fillStyle = '#3b82f6';
  
    for (let hour = 0; hour < 24; hour++) {
      const count = hourCounts[hour];
      const barHeight = (count / maxCount) * chartHeight;
      const x = padding + hour * barWidth + 2;
      const y = canvas.height - padding - barHeight;
  
      ctx.fillRect(x, y, barWidth - 4, barHeight);
  
      if (hour % 4 === 0) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px sans-serif';
        ctx.fillText(`${hour}h`, x, canvas.height - 10);
        ctx.fillStyle = '#3b82f6';
      }
    }
  }
  
  function renderSettings(syncData) {
    const grid = document.getElementById('blocked-domains-grid');
    grid.innerHTML = '';
  
    const sites = syncData.blockedSites || [];
    sites.forEach(site => {
      const tag = document.createElement('div');
      tag.className = 'domain-tag';
      tag.innerHTML = `
        <span>${site}</span>
        <button class="remove-site-btn" data-site="${site}">✕</button>
      `;
      grid.appendChild(tag);
    });
  
    document.getElementById('toggle-blocking').checked = syncData.settings.blockingEnabled;
    document.getElementById('toggle-warnings').checked = syncData.settings.warningsEnabled;
  
    setupSettingsListeners();
  }
  
  function setupSettingsListeners() {
    document.querySelectorAll('.remove-site-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const siteToRemove = btn.getAttribute('data-site');
        const syncData = await BudgetGuardStorage.getSync();
        syncData.blockedSites = syncData.blockedSites.filter(s => s !== siteToRemove);
        await BudgetGuardStorage.setSync(syncData);
        renderSettings(syncData);
      });
    });
  
    const addBtn = document.getElementById('add-site-btn');
    addBtn.onclick = async () => {
      const domainInput = document.getElementById('new-site-domain');
      let domain = domainInput.value.trim().toLowerCase();
      
      domain = domain.replace(/^(https?:\/\/)?(www\.)?/, "");
  
      if (!domain) return;
  
      const syncData = await BudgetGuardStorage.getSync();
      if (!syncData.blockedSites.includes(domain)) {
        syncData.blockedSites.push(domain);
        await BudgetGuardStorage.setSync(syncData);
        domainInput.value = '';
        renderSettings(syncData);
      }
    };
  
    document.getElementById('toggle-blocking').onchange = async (e) => {
      const syncData = await BudgetGuardStorage.getSync();
      syncData.settings.blockingEnabled = e.target.checked;
      await BudgetGuardStorage.setSync(syncData);
    };
  
    document.getElementById('toggle-warnings').onchange = async (e) => {
      const syncData = await BudgetGuardStorage.getSync();
      syncData.settings.warningsEnabled = e.target.checked;
      await BudgetGuardStorage.setSync(syncData);
    };
  }