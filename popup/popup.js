// popup/popup.js

let selectedAvatar = '😊';

document.addEventListener('DOMContentLoaded', async () => {
  await BudgetGuardStorage.initialize();
  const syncData = await BudgetGuardStorage.getSync();

  if (!syncData.initialized) {
    document.getElementById('popup-onboarding-prompt').classList.remove('hidden');
    document.getElementById('popup-summary-card').classList.add('hidden');
    
    document.getElementById('popup-ob-btn').onclick = () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('pages/dashboard.html') });
    };
  } else {
    renderBudgetRows(syncData);
    populateProfile(syncData);
    renderQuickInsights();
  }

  setupTabs();
  setupDashboardShortcut();
});

function setupDashboardShortcut() {
  document.getElementById('full-dashboard-btn').onclick = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('pages/dashboard.html') });
  };
}

function setupTabs() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-tab');

      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.add('hidden');
      });
      document.getElementById(target).classList.remove('hidden');
    });
  });
}

function renderBudgetRows(syncData) {
  const listContainer = document.getElementById('popup-budget-list');
  listContainer.innerHTML = '';

  const categories = [
    { key: 'home', label: '🏠 Home Expenses' },
    { key: 'leisure', label: '🎉 Leisure' },
    { key: 'savings', label: '💰 Savings' },
    { key: 'transportation', label: '🚗 Transportation' }
  ];

  let totalAlloc = 0;
  let totalSpent = 0;

  categories.forEach(cat => {
    const details = syncData.budget.categories[cat.key];
    const allocated = details.allocated || 0;
    const spent = details.spent || 0;
    const remaining = allocated - spent;
    const percent = allocated > 0 ? (spent / allocated) * 100 : 0;

    totalAlloc += allocated;
    totalSpent += spent;

    let fillColor = '#22c55e'; 
    if (percent >= 80) fillColor = '#ef4444'; 
    else if (percent >= 50) fillColor = '#f59e0b'; 

    const row = document.createElement('div');
    row.className = 'pop-row';
    row.innerHTML = `
      <div class="pop-row-meta">
        <span class="pop-row-title">${cat.label}</span>
        <span class="pop-row-math">$${spent.toFixed(0)} of $${allocated.toFixed(0)}</span>
      </div>
      <div class="progress-bar-container" style="margin-bottom:6px;">
        <div class="progress-fill" style="width: ${Math.min(percent, 100)}%; background-color: ${fillColor};"></div>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:10px; color:#94a3b8;">
        <span>Remaining: $${remaining.toFixed(2)}</span>
        <span>${percent.toFixed(0)}% Used</span>
      </div>
    `;
    listContainer.appendChild(row);
  });

  const totalRem = totalAlloc - totalSpent;
  document.getElementById('pop-total-alloc').innerText = `$${totalAlloc.toFixed(2)}`;
  document.getElementById('pop-total-spent').innerText = `$${totalSpent.toFixed(2)}`;
  document.getElementById('pop-total-rem').innerText = `$${totalRem.toFixed(2)}`;
}

function populateProfile(syncData) {
  const prof = syncData.profile;
  document.getElementById('prof-first-name').value = prof.firstName || '';
  document.getElementById('prof-last-name').value = prof.lastName || '';
  document.getElementById('prof-birthday').value = prof.birthday || '';
  document.getElementById('prof-income').value = prof.monthlyIncome || 0;
  document.getElementById('prof-password').value = prof.overridePassword || '';

  selectedAvatar = prof.avatar || '😊';
  document.getElementById('profile-current-avatar').innerText = selectedAvatar;

  updateAgeBadge(prof.birthday);

  document.getElementById('prof-birthday').addEventListener('change', (e) => {
    updateAgeBadge(e.target.value);
  });

  document.querySelectorAll('.avatar-opt').forEach(opt => {
    if (opt.innerText === selectedAvatar) {
      opt.classList.add('active');
    }
    opt.onclick = () => {
      document.querySelectorAll('.avatar-opt').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      selectedAvatar = opt.innerText;
      document.getElementById('profile-current-avatar').innerText = selectedAvatar;
    };
  });

  document.getElementById('prof-save-btn').onclick = async () => {
    const syncData = await BudgetGuardStorage.getSync();
    syncData.profile = {
      firstName: document.getElementById('prof-first-name').value.trim(),
      lastName: document.getElementById('prof-last-name').value.trim(),
      birthday: document.getElementById('prof-birthday').value,
      avatar: selectedAvatar,
      overridePassword: document.getElementById('prof-password').value,
      monthlyIncome: parseFloat(document.getElementById('prof-income').value) || 0
    };

    await BudgetGuardStorage.setSync(syncData);
    alert("Profile data saved successfully!");
  };
}

function updateAgeBadge(birthdayStr) {
  const age = BudgetEngine.calculateAge(birthdayStr);
  const ageBadge = document.getElementById('prof-age-display');
  if (age !== null && !isNaN(age)) {
    ageBadge.innerText = `Age: ${age}`;
  } else {
    ageBadge.innerText = `Age: -`;
  }
}

async function renderQuickInsights() {
  const report = await BudgetEngine.generateBehaviorReport();
  const localData = await BudgetGuardStorage.getLocal();

  const tagEl = document.getElementById('pop-behavior-tag');
  tagEl.innerText = report.tag;
  if (report.alertColor === 'red') tagEl.style.color = '#ef4444';
  else if (report.alertColor === 'yellow') tagEl.style.color = '#f59e0b';
  else tagEl.style.color = '#22c55e';

  document.getElementById('pop-stat-blocked').innerText = report.blockedAttempts;
  document.getElementById('pop-stat-overrides').innerText = report.recentOverrides;

  const alertContainer = document.getElementById('pop-alerts-list');
  alertContainer.innerHTML = '';
  const alerts = localData.alerts || [];

  if (alerts.length === 0) {
    alertContainer.innerHTML = `<p class="empty-state">No alerts triggered yet!</p>`;
    return;
  }

  alerts.slice(0, 3).forEach(alert => {
    const item = document.createElement('div');
    item.className = 'popup-alert-item';
    let bColor = '#ef4444';
    if (alert.severity === 'warning') bColor = '#f59e0b';
    else if (alert.severity === 'depleted') bColor = '#a855f7';

    item.setAttribute('style', `border-left: 3px solid ${bColor}; padding-left: 6px; margin-bottom: 4px;`);
    item.innerText = alert.message;
    alertContainer.appendChild(item);
  });
}

chrome.runtime.onMessage.addListener((request) => {
  if (request.type === "DATA_UPDATED") {
    BudgetGuardStorage.getSync().then(syncData => {
      renderBudgetRows(syncData);
      renderQuickInsights();
    });
  }
});