// utils/siteBlocker.js
(function (global) {
    const SiteBlocker = {
      extractHostname: function (url) {
        try {
          const parsedUrl = new URL(url);
          let hostname = parsedUrl.hostname;
          if (hostname.startsWith("www.")) {
            hostname = hostname.substring(4);
          }
          return hostname.toLowerCase();
        } catch (e) {
          return "";
        }
      },
  
      isBlocked: function (url, blockedSites) {
        const domain = this.extractHostname(url);
        if (!domain) return false;
        return blockedSites.some(site => {
          const cleanSite = site.toLowerCase().replace(/^www\./, "");
          return domain === cleanSite || domain.endsWith("." + cleanSite);
        });
      }
    };
  
    global.SiteBlocker = SiteBlocker;
  })(typeof self !== 'undefined' ? self : this);