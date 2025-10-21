document.addEventListener("DOMContentLoaded", () => {
  loadCurrentSite();
  loadSitesList();
  setupEventListeners();
  updatePauseButton();
});

// Load current site
async function loadCurrentSite() {
  chrome.runtime.sendMessage({ action: "getCurrentTab" }, (response) => {
    if (response && response.url) {
      try {
        const url = new URL(response.url);
        const domain = url.hostname.replace("www.", "");
        document.getElementById("currentSite").textContent = domain;

        // Check if already blocked
        chrome.storage.local.get(["blockedSites"], (result) => {
          const blockedSites = result.blockedSites || [];
          if (blockedSites.includes(domain)) {
            document.getElementById("blockCurrentSite").textContent =
              "Already Blocked";
            document.getElementById("blockCurrentSite").disabled = true;
          }
        });
      } catch {
        document.getElementById("currentSite").textContent = "N/A";
        document.getElementById("blockCurrentSite").disabled = true;
      }
    }
  });
}

// Load sites list
function loadSitesList() {
  chrome.storage.local.get(["blockedSites"], (result) => {
    const blockedSites = result.blockedSites || [];
    const sitesList = document.getElementById("sitesList");

    if (blockedSites.length === 0) {
      sitesList.innerHTML = '<p class="empty-message">No sites blocked yet</p>';
      return;
    }

    sitesList.innerHTML = "";
    blockedSites.forEach((domain) => {
      const siteEl = createSiteElement(domain);
      sitesList.appendChild(siteEl);
    });
  });
}

// Create site element
function createSiteElement(domain) {
  const div = document.createElement("div");
  div.className = "site-item";

  div.innerHTML = `
    <span class="site-domain">${domain}</span>
    <button class="btn-remove" data-domain="${domain}">Remove</button>
  `;

  // Add remove handler
  div.querySelector(".btn-remove").addEventListener("click", (e) => {
    removeSite(e.target.dataset.domain);
  });

  return div;
}

// Remove site
function removeSite(domain) {
  chrome.storage.local.get(["blockedSites"], (result) => {
    const blockedSites = result.blockedSites || [];
    const index = blockedSites.indexOf(domain);
    if (index > -1) {
      blockedSites.splice(index, 1);
      chrome.storage.local.set({ blockedSites }, () => {
        loadSitesList();
        loadCurrentSite();
      });
    }
  });
}

// Update pause button
function updatePauseButton() {
  chrome.storage.local.get(["isPaused"], (result) => {
    const btn = document.getElementById("pauseExtension");
    if (result.isPaused) {
      btn.textContent = "Resume Blocking";
      btn.classList.remove("btn-warning");
      btn.classList.add("btn-success");
    } else {
      btn.textContent = "Pause Blocking";
      btn.classList.remove("btn-success");
      btn.classList.add("btn-warning");
    }
  });
}

// Setup event listeners
function setupEventListeners() {
  // Add site
  document.getElementById("addSite").addEventListener("click", () => {
    const siteInput = document.getElementById("siteInput");
    let domain = siteInput.value.trim().toLowerCase();

    if (!domain) return;

    // Clean up domain
    domain = domain.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0];

    chrome.storage.local.get(["blockedSites"], (result) => {
      const blockedSites = result.blockedSites || [];

      if (!blockedSites.includes(domain)) {
        blockedSites.push(domain);
        chrome.storage.local.set({ blockedSites }, () => {
          siteInput.value = "";
          loadSitesList();
          loadCurrentSite();
        });
      }
    });
  });

  // Block current site
  document.getElementById("blockCurrentSite").addEventListener("click", () => {
    const domain = document.getElementById("currentSite").textContent;
    if (domain && domain !== "N/A") {
      chrome.storage.local.get(["blockedSites"], (result) => {
        const blockedSites = result.blockedSites || [];
        if (!blockedSites.includes(domain)) {
          blockedSites.push(domain);
          chrome.storage.local.set({ blockedSites }, () => {
            loadSitesList();
            loadCurrentSite();
          });
        }
      });
    }
  });

  // Toggle pause
  document.getElementById("pauseExtension").addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "togglePause" }, (response) => {
      if (response.success) {
        updatePauseButton();
      }
    });
  });

  // Enter key on input
  document.getElementById("siteInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      document.getElementById("addSite").click();
    }
  });
}
