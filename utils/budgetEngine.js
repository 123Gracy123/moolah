// utils/budgetEngine.js
(function (global) {
    const BudgetEngine = {
      calculateAge: function (birthdayStr) {
        if (!birthdayStr) return null;
        const birthDate = new Date(birthdayStr);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        return age;
      },
  
      getDaysInCurrentMonth: function () {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      },
  
      getDaysElapsed: function () {
        return new Date().getDate();
      },
  
      getDailySpendingRate: function (spent, daysElapsed) {
        if (daysElapsed <= 0) return 0;
        return spent / daysElapsed;
      },
  
      projectExhaustionDays: function (allocated, spent) {
        const remaining = allocated - spent;
        if (remaining <= 0) return 0;
        const daysElapsed = this.getDaysElapsed();
        const rate = this.getDailySpendingRate(spent, daysElapsed);
        if (rate <= 0) return Infinity;
        return remaining / rate;
      },
  
      checkThresholdAlerts: async function (syncData, category, oldSpent, newSpent) {
        const catData = syncData.budget.categories[category];
        if (!catData || catData.allocated <= 0) return null;
  
        const oldPercent = (oldSpent / catData.allocated) * 100;
        const newPercent = (newSpent / catData.allocated) * 100;
  
        let alertMessage = null;
        let severity = null; // "warning", "critical", "depleted"
  
        if (newPercent >= 100 && oldPercent < 100) {
          alertMessage = `🔴 ${category.toUpperCase()} budget depleted. Purchases and sites now blocked.`;
          severity = "depleted";
        } else if (newPercent >= 80 && oldPercent < 80) {
          alertMessage = `🚨 Critical: Only 20% of your ${category} budget remains!`;
          severity = "critical";
        } else if (newPercent >= 50 && oldPercent < 50) {
          const daysElapsed = this.getDaysElapsed();
          alertMessage = `⚠️ You've used half your ${category} budget in ${daysElapsed} days!`;
          severity = "warning";
        }
  
        if (alertMessage && syncData.settings.warningsEnabled) {
          const localData = await global.BudgetGuardStorage.getLocal();
          const alerts = localData.alerts || [];
          alerts.unshift({
            timestamp: Date.now(),
            message: alertMessage,
            category,
            severity
          });
          await global.BudgetGuardStorage.setLocal({ ...localData, alerts });
  
          chrome.runtime.sendMessage({
            type: "SHOW_NOTIFICATION",
            title: "Moolah Status Update",
            message: alertMessage
          });
        }
  
        return alertMessage;
      },
  
      generateBehaviorReport: async function () {
        const localData = await global.BudgetGuardStorage.getLocal();
        const syncData = await global.BudgetGuardStorage.getSync();
  
        const visits = localData.visits || [];
        const overrides = localData.overrides || [];
  
        // Top 5 visited shopping sites
        const siteCounts = {};
        visits.forEach(v => {
          siteCounts[v.domain] = (siteCounts[v.domain] || 0) + 1;
        });
        const topSites = Object.entries(siteCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([domain, count]) => ({ domain, count }));
  
        // Peak shopping hours (0-23)
        const hourCounts = Array(24).fill(0);
        visits.forEach(v => {
          const date = new Date(v.timestamp);
          hourCounts[date.getHours()]++;
        });
  
        // Recency tracking (last 7 days)
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const blockedAttempts = (localData.blocks || []).filter(b => b.timestamp > oneWeekAgo).length;
        const recentOverrides = overrides.filter(o => o.timestamp > oneWeekAgo).length;
        const recentVisits = visits.filter(v => v.timestamp > oneWeekAgo).length;
  
        // Behavioral tag evaluation
        let score = 0;
        if (recentVisits > 50) score += 3;
        else if (recentVisits > 20) score += 1;
  
        if (blockedAttempts > 10) score += 3;
        else if (blockedAttempts > 3) score += 2;
  
        if (recentOverrides > 5) score += 4;
        else if (recentOverrides > 1) score += 2;
  
        let tag = "Controlled Spender 🟢";
        let alertColor = "green";
        if (score >= 7) {
          tag = "Spending Alert 🔴";
          alertColor = "red";
        } else if (score >= 3) {
          tag = "Watch Out 🟡";
          alertColor = "yellow";
        }
  
        return {
          topSites,
          hourCounts,
          blockedAttempts,
          recentOverrides,
          tag,
          alertColor
        };
      }
    };
  
    global.BudgetEngine = BudgetEngine;
  })(typeof self !== 'undefined' ? self : this);