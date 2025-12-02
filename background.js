// Job Application Tracker - Background Service Worker
// Handles installation, notifications, and background events

'use strict';

// ============================================
// Installation & Update Handling
// ============================================
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // First time installation
    console.log('Job Application Tracker installed!');

    // Initialize default data structure
    chrome.storage.local.set({
      applications: [],
      settings: {
        autoCapture: false,
        notifications: true
      }
    });

    // Open welcome page or show notification (guarded)
    safeNotify('Job Tracker Installed!', 'Click the extension icon to start tracking your job applications.');
  }

  if (details.reason === 'update') {
    console.log('Job Application Tracker updated to version', chrome.runtime.getManifest().version);

    // Handle any data migrations if needed
    migrateData(details.previousVersion);
  }
});

// ============================================
// Data Migration (for future updates)
// ============================================
async function migrateData(previousVersion) {
  // Add migration logic here when data schema changes
  // Example:
  // if (previousVersion < '2.0.0') {
  //   const data = await chrome.storage.local.get(['applications']);
  //   // Transform data to new format
  //   await chrome.storage.local.set({ applications: transformedData });
  // }
  console.log('Migration check complete');
}

// ============================================
// Message Handling
// ============================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle job detected from content script (auto-capture)
  if (request.action === 'jobDetected') {
    handleJobDetected(request.data, sender.tab);
    sendResponse({ received: true });
  }

  // Handle notification requests
  if (request.action === 'showNotification') {
    showNotification(request.title, request.message);
    sendResponse({ shown: true });
  }

  // Handle badge update
  if (request.action === 'updateBadge') {
    updateBadge();
    sendResponse({ updated: true });
  }

  return true;
});

// ============================================
// Job Detection Handler
// ============================================
async function handleJobDetected(jobData, tab) {
  try {
    const result = await chrome.storage.local.get(['settings', 'applications']);
    const settings = result.settings || {};
    const applications = result.applications || [];

    // Check if already tracked
    const isDuplicate = applications.some(
      app => app.url === jobData.url ||
            (app.company === jobData.company && app.position === jobData.position)
    );

    if (isDuplicate) {
      return; // Already tracked, no notification needed
    }

    // Show notification if enabled
    if (settings.notifications) {
      safeCreateNotification({
        title: 'New Job Detected!',
        message: `${jobData.position} at ${jobData.company}`,
        onCreated: async (notificationId) => {
          // Store notification data for button click handling
          await safeSessionSet(`notification_${notificationId}`, {
            jobData,
            tabId: tab?.id
          });
        }
      });
    }
  } catch (error) {
    console.error('Error handling job detection:', error);
  }
}

// ============================================
// Notification Click Handling
// ============================================
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  if (buttonIndex === 0) { // "Track This Job" button
    try {
      const key = `notification_${notificationId}`;
      const notificationData = await safeSessionGet(key);

      if (notificationData && notificationData.jobData) {
        // Add the job to applications
        const stored = await chrome.storage.local.get(['applications']);
        const applications = stored.applications || [];

        const newApp = {
          id: generateId(),
          company: notificationData.jobData.company,
          position: notificationData.jobData.position,
          status: 'applied',
          dateApplied: new Date().toISOString().split('T')[0],
          url: notificationData.jobData.url,
          skills: notificationData.jobData.skills || [],
          notes: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        applications.unshift(newApp);
        await chrome.storage.local.set({ applications });

        // Show confirmation
        safeNotify('Job Tracked!', `${newApp.position} at ${newApp.company} has been added.`);

        // Update badge
        updateBadge();

        // Clean up session storage
        await safeSessionRemove(key);
      }
    } catch (error) {
      console.error('Error tracking job from notification:', error);
    }
  }

  // Close the notification
  chrome.notifications.clear(notificationId);
});

chrome.notifications.onClicked.addListener((notificationId) => {
  // Open popup when notification is clicked
  chrome.action.openPopup();
  chrome.notifications.clear(notificationId);
});

// ============================================
// Badge Management
// ============================================
async function updateBadge() {
  try {
    const result = await chrome.storage.local.get(['applications']);
    const applications = result.applications || [];

    // Show count of applied/interview applications (active)
    const activeCount = applications.filter(
      app => app.status === 'applied' || app.status === 'interview'
    ).length;

    if (activeCount > 0) {
      chrome.action.setBadgeText({ text: activeCount.toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#3b82f6' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  } catch (error) {
    console.error('Error updating badge:', error);
  }
}

// Update badge on storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.applications) {
    updateBadge();
  }
});

// ============================================
// Context Menu (Right-click menu)
// ============================================
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'trackJob',
    title: 'Track this job with Job Tracker',
    contexts: ['page', 'link'],
    documentUrlPatterns: [
      'https://www.linkedin.com/jobs/*',
      'https://www.indeed.com/*',
      'https://www.glassdoor.com/*'
    ]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'trackJob') {
    // Inject content script and capture job
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    }).then(() => {
      // Send message to content script to scrape
      chrome.tabs.sendMessage(tab.id, { action: 'scrapeJob' }, (response) => {
        if (response) {
          handleJobDetected(response, tab);
        }
      });
    }).catch(err => {
      console.error('Failed to inject content script:', err);
    });
  }
});

// ============================================
// Keyboard Shortcut Handling
// ============================================
chrome.commands.onCommand.addListener((command) => {
  if (command === 'capture-job') {
    // Get active tab and capture job
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'scrapeJob' }, (response) => {
          if (response) {
            handleJobDetected(response, tabs[0]);
          }
        });
      }
    });
  }
});

// ============================================
// Utility Functions
// ============================================
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function showNotification(title, message) {
  safeNotify(title, message);
}

// Initialize badge on startup
updateBadge();

// ============================================
// Safe helpers (permissions and availability guards)
// ============================================
function safeNotify(title, message) {
  try {
    if (!chrome?.notifications?.create) return;
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title,
      message,
      priority: 1
    });
  } catch (e) {
    // swallow
  }
}

function safeCreateNotification({ title, message, onCreated }) {
  try {
    if (!chrome?.notifications?.create) return;
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title,
      message,
      priority: 1,
      buttons: [{ title: 'Track This Job' }]
    }, (notificationId) => {
      try { onCreated && onCreated(notificationId); } catch (e) {}
    });
  } catch (e) {
    // swallow
  }
}

async function safeSessionSet(key, value) {
  try {
    if (chrome?.storage?.session?.set) {
      await chrome.storage.session.set({ [key]: value });
      return;
    }
  } catch (_) {}
  await chrome.storage.local.set({ [key]: value });
}

async function safeSessionGet(key) {
  try {
    if (chrome?.storage?.session?.get) {
      const res = await chrome.storage.session.get([key]);
      return res[key];
    }
  } catch (_) {}
  const res = await chrome.storage.local.get([key]);
  return res[key];
}

async function safeSessionRemove(key) {
  try {
    if (chrome?.storage?.session?.remove) {
      await chrome.storage.session.remove([key]);
      return;
    }
  } catch (_) {}
  await chrome.storage.local.remove([key]);
}
