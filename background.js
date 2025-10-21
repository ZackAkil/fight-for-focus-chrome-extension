// Optimized background script - just block or no block

// Cache for better performance
let blockedSitesCache = new Set();
let isPausedCache = false;

// Initialize cache function
function initializeCache() {
  chrome.storage.local.get(['blockedSites', 'isPaused'], (result) => {
    if (!result.blockedSites) {
      chrome.storage.local.set({ blockedSites: [] });
      blockedSitesCache = new Set();
    } else {
      blockedSitesCache = new Set(result.blockedSites);
    }

    if (result.isPaused === undefined) {
      chrome.storage.local.set({ isPaused: false });
      isPausedCache = false;
    } else {
      isPausedCache = result.isPaused;
    }
  });
}

// Initialize on install/update
chrome.runtime.onInstalled.addListener(() => {
  initializeCache();
});

// IMPORTANT: Also initialize on startup (when Chrome starts)
chrome.runtime.onStartup.addListener(() => {
  initializeCache();
});

// Also initialize immediately when script loads (covers all cases)
initializeCache();

// Update cache when storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.blockedSites) {
      blockedSitesCache = new Set(changes.blockedSites.newValue || []);
    }
    if (changes.isPaused !== undefined) {
      isPausedCache = changes.isPaused.newValue;
    }
  }
});

// Check every tab update
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  // Only check when URL changes and it's a real URL
  if (changeInfo.url &&
      !changeInfo.url.startsWith('chrome://') &&
      !changeInfo.url.startsWith('chrome-extension://') &&
      !changeInfo.url.includes('/blocked.html')) {
    checkAndBlockTab(tabId, changeInfo.url);
  }
});

// Also check when tabs are activated
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url &&
        !tab.url.startsWith('chrome://') &&
        !tab.url.startsWith('chrome-extension://') &&
        !tab.url.includes('/blocked.html')) {
      checkAndBlockTab(activeInfo.tabId, tab.url);
    }
  } catch (e) {
    // Tab might have been closed
  }
});

// Optimized blocking check
function checkAndBlockTab(tabId, url) {
  // Quick pause check using cache
  if (isPausedCache) return;

  try {
    // Extract hostname
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace('www.', '');

    // Quick check using Set (O(1) average)
    if (blockedSitesCache.has(hostname)) {
      redirectToBlockedPage(tabId, url);
      return;
    }

    // Check parent domains only if needed
    const parts = hostname.split('.');
    if (parts.length > 2) {
      for (let i = 1; i < parts.length - 1; i++) {
        const parentDomain = parts.slice(i).join('.');
        if (blockedSitesCache.has(parentDomain)) {
          redirectToBlockedPage(tabId, url);
          return;
        }
      }
    }

    // Special YouTube handling - all YouTube domains
    if (blockedSitesCache.has('youtube.com') &&
        (hostname.includes('youtube.com') || hostname === 'youtu.be')) {
      redirectToBlockedPage(tabId, url);
    }
  } catch (e) {
    // Invalid URL, ignore
  }
}

// Redirect to blocked page
function redirectToBlockedPage(tabId, originalUrl) {
  const blockedUrl = chrome.runtime.getURL(`blocked.html?url=${encodeURIComponent(originalUrl)}`);
  chrome.tabs.update(tabId, { url: blockedUrl });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, _, sendResponse) => {
  if (request.action === 'getCurrentTab') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        sendResponse({ url: tabs[0].url });
      }
    });
    return true;
  }

  if (request.action === 'togglePause') {
    isPausedCache = !isPausedCache;
    chrome.storage.local.set({ isPaused: isPausedCache }, () => {
      sendResponse({ success: true, isPaused: isPausedCache });
    });
    return true;
  }
});