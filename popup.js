// Job Application Tracker - Popup Script
// Handles UI interactions, CRUD operations, search, and filtering

'use strict';

// ============================================
// DOM Elements
// ============================================
const elements = {
  // Buttons
  captureBtn: document.getElementById('captureBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  closeModal: document.getElementById('closeModal'),
  closeSettings: document.getElementById('closeSettings'),
  cancelBtn: document.getElementById('cancelBtn'),
  exportBtn: document.getElementById('exportBtn'),
  importBtn: document.getElementById('importBtn'),
  importFile: document.getElementById('importFile'),
  clearAllBtn: document.getElementById('clearAllBtn'),

  // Inputs
  searchInput: document.getElementById('searchInput'),
  statusFilter: document.getElementById('statusFilter'),

  // Form
  applicationForm: document.getElementById('applicationForm'),
  appId: document.getElementById('appId'),
  company: document.getElementById('company'),
  position: document.getElementById('position'),
  status: document.getElementById('status'),
  dateApplied: document.getElementById('dateApplied'),
  url: document.getElementById('url'),
  skills: document.getElementById('skills'),
  notes: document.getElementById('notes'),

  // Settings
  autoCapture: document.getElementById('autoCapture'),
  notifications: document.getElementById('notifications'),

  // Display
  applicationsList: document.getElementById('applicationsList'),
  emptyState: document.getElementById('emptyState'),
  modal: document.getElementById('modal'),
  modalTitle: document.getElementById('modalTitle'),
  settingsModal: document.getElementById('settingsModal'),
  toast: document.getElementById('toast'),

  // Stats
  totalCount: document.getElementById('totalCount'),
  appliedCount: document.getElementById('appliedCount'),
  interviewCount: document.getElementById('interviewCount'),
  offerCount: document.getElementById('offerCount')
};

// ============================================
// State
// ============================================
let applications = [];
let settings = {
  autoCapture: false,
  notifications: true
};

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', init);

async function init() {
  await loadData();
  await loadSettings();
  renderApplications();
  updateStats();
  bindEvents();
}

// ============================================
// Data Management (chrome.storage.local)
// ============================================
async function loadData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['applications'], (result) => {
      applications = result.applications || [];
      resolve();
    });
  });
}

async function saveData() {
  return new Promise((resolve) => {
    chrome.storage.local.set({ applications }, resolve);
  });
}

async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['settings'], (result) => {
      settings = result.settings || { autoCapture: false, notifications: true };
      elements.autoCapture.checked = settings.autoCapture;
      elements.notifications.checked = settings.notifications;
      resolve();
    });
  });
}

async function saveSettings() {
  settings.autoCapture = elements.autoCapture.checked;
  settings.notifications = elements.notifications.checked;
  return new Promise((resolve) => {
    chrome.storage.local.set({ settings }, resolve);
  });
}

// ============================================
// CRUD Operations
// ============================================
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

async function addApplication(appData) {
  const newApp = {
    id: generateId(),
    company: appData.company.trim(),
    position: appData.position.trim(),
    status: appData.status || 'applied',
    dateApplied: appData.dateApplied || new Date().toISOString().split('T')[0],
    url: appData.url || '',
    skills: appData.skills || [],
    notes: appData.notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  applications.unshift(newApp);
  await saveData();
  renderApplications();
  updateStats();
  showToast('Application added successfully!');
  return newApp;
}

async function updateApplication(id, appData) {
  const index = applications.findIndex(app => app.id === id);
  if (index === -1) return null;

  applications[index] = {
    ...applications[index],
    company: appData.company.trim(),
    position: appData.position.trim(),
    status: appData.status,
    dateApplied: appData.dateApplied,
    url: appData.url || '',
    skills: appData.skills || [],
    notes: appData.notes || '',
    updatedAt: new Date().toISOString()
  };

  await saveData();
  renderApplications();
  updateStats();
  showToast('Application updated successfully!');
  return applications[index];
}

async function deleteApplication(id) {
  const index = applications.findIndex(app => app.id === id);
  if (index === -1) return false;

  applications.splice(index, 1);
  await saveData();
  renderApplications();
  updateStats();
  showToast('Application deleted.');
  return true;
}

async function clearAllApplications() {
  applications = [];
  await saveData();
  renderApplications();
  updateStats();
  showToast('All data cleared.');
}

// ============================================
// Rendering
// ============================================
function renderApplications() {
  const searchTerm = elements.searchInput.value.toLowerCase();
  const statusFilter = elements.statusFilter.value;

  let filtered = applications.filter(app => {
    const matchesSearch = 
      app.company.toLowerCase().includes(searchTerm) ||
      app.position.toLowerCase().includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (filtered.length === 0) {
    elements.applicationsList.innerHTML = '';
    elements.emptyState.style.display = 'block';
    elements.applicationsList.appendChild(elements.emptyState);
    return;
  }

  elements.emptyState.style.display = 'none';
  elements.applicationsList.innerHTML = filtered.map(app => createApplicationCard(app)).join('');

  // Bind card events
  elements.applicationsList.querySelectorAll('.app-card').forEach(card => {
    const id = card.dataset.id;
    
    card.querySelector('.btn-edit')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditModal(id);
    });

    card.querySelector('.btn-delete')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Delete this application?')) {
        deleteApplication(id);
      }
    });

    card.querySelector('.status-badge')?.addEventListener('click', (e) => {
      e.stopPropagation();
      cycleStatus(id);
    });

    card.addEventListener('click', () => {
      const app = applications.find(a => a.id === id);
      if (app && app.url) {
        chrome.tabs.create({ url: app.url });
      }
    });
  });
}

function createApplicationCard(app) {
  const statusColors = {
    pending: 'status-pending',
    applied: 'status-applied',
    interview: 'status-interview',
    offer: 'status-offer',
    rejected: 'status-rejected'
  };

  const skillsHtml = app.skills.length > 0 
    ? `<div class="app-skills">${app.skills.slice(0, 3).map(s => `<span class="skill-tag">${escapeHtml(s)}</span>`).join('')}${app.skills.length > 3 ? `<span class="skill-more">+${app.skills.length - 3}</span>` : ''}</div>`
    : '';

  return `
    <div class="app-card" data-id="${app.id}">
      <div class="app-header">
        <div class="app-info">
          <h3 class="app-company">${escapeHtml(app.company)}</h3>
          <p class="app-position">${escapeHtml(app.position)}</p>
        </div>
        <span class="status-badge ${statusColors[app.status]}" title="Click to change status">
          ${app.status.charAt(0).toUpperCase() + app.status.slice(1)}
        </span>
      </div>
      ${skillsHtml}
      <div class="app-footer">
        <span class="app-date">${formatDate(app.dateApplied)}</span>
        <div class="app-actions">
          <button class="btn-edit" title="Edit">✏️</button>
          <button class="btn-delete" title="Delete">🗑️</button>
        </div>
      </div>
    </div>
  `;
}

function updateStats() {
  const stats = {
    total: applications.length,
    applied: applications.filter(a => a.status === 'applied').length,
    interview: applications.filter(a => a.status === 'interview').length,
    offer: applications.filter(a => a.status === 'offer').length
  };

  elements.totalCount.textContent = stats.total;
  elements.appliedCount.textContent = stats.applied;
  elements.interviewCount.textContent = stats.interview;
  elements.offerCount.textContent = stats.offer;
}

// ============================================
// Modal Handling
// ============================================
function openAddModal() {
  elements.modalTitle.textContent = 'Add Application';
  elements.applicationForm.reset();
  elements.appId.value = '';
  elements.dateApplied.value = new Date().toISOString().split('T')[0];
  elements.modal.classList.add('active');
}

function openEditModal(id) {
  const app = applications.find(a => a.id === id);
  if (!app) return;

  elements.modalTitle.textContent = 'Edit Application';
  elements.appId.value = app.id;
  elements.company.value = app.company;
  elements.position.value = app.position;
  elements.status.value = app.status;
  elements.dateApplied.value = app.dateApplied;
  elements.url.value = app.url;
  elements.skills.value = app.skills.join(', ');
  elements.notes.value = app.notes;
  elements.modal.classList.add('active');
}

function closeModal() {
  elements.modal.classList.remove('active');
  elements.applicationForm.reset();
}

function openSettingsModal() {
  elements.settingsModal.classList.add('active');
}

function closeSettingsModal() {
  elements.settingsModal.classList.remove('active');
  saveSettings();
}

// ============================================
// Job Capture
// ============================================
async function captureFromPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.id) {
      showToast('Unable to access current tab.', 'error');
      return;
    }

    // Inject and execute content script
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapeJobDetails
    });

    if (results && results[0] && results[0].result) {
      const jobData = results[0].result;
      
      // Check for duplicates
      const isDuplicate = applications.some(
        app => app.url === jobData.url || 
              (app.company === jobData.company && app.position === jobData.position)
      );

      if (isDuplicate) {
        showToast('This job is already in your tracker!', 'warning');
        return;
      }

      // Populate form and open modal
      elements.company.value = jobData.company || '';
      elements.position.value = jobData.position || '';
      elements.url.value = jobData.url || tab.url;
      elements.skills.value = (jobData.skills || []).join(', ');
      elements.dateApplied.value = new Date().toISOString().split('T')[0];
      elements.modalTitle.textContent = 'Add Application';
      elements.appId.value = '';
      elements.modal.classList.add('active');

      showToast('Job details captured! Review and save.');
    } else {
      showToast('Could not extract job details. Try adding manually.', 'warning');
      openAddModal();
    }
  } catch (error) {
    console.error('Capture error:', error);
    showToast('Error capturing job. Try adding manually.', 'error');
    openAddModal();
  }
}

// This function runs in the page context
function scrapeJobDetails() {
  const url = window.location.href;
  let company = '';
  let position = '';
  let skills = [];

  // LinkedIn
  if (url.includes('linkedin.com')) {
    // Updated selectors for LinkedIn's current DOM (2024)
    company = document.querySelector('.job-details-jobs-unified-top-card__company-name a')?.textContent?.trim() ||
              document.querySelector('.job-details-jobs-unified-top-card__company-name')?.textContent?.trim() ||
              document.querySelector('.jobs-unified-top-card__company-name a')?.textContent?.trim() ||
              document.querySelector('.jobs-unified-top-card__company-name')?.textContent?.trim() ||
              document.querySelector('.job-details-jobs-unified-top-card__primary-description-container a')?.textContent?.trim() ||
              document.querySelector('.topcard__org-name-link')?.textContent?.trim() ||
              document.querySelector('a[data-tracking-control-name="public_jobs_topcard-org-name"]')?.textContent?.trim() ||
              document.querySelector('a[href*="/company/"]')?.textContent?.trim() ||
              '';
    
    // Try from title if not found
    if (!company) {
      const titleMatch = document.title.match(/at\s+(.+?)\s*[|\-–]/i);
      if (titleMatch) company = titleMatch[1];
    }
    
    position = document.querySelector('.job-details-jobs-unified-top-card__job-title h1')?.textContent?.trim() ||
               document.querySelector('.job-details-jobs-unified-top-card__job-title')?.textContent?.trim() ||
               document.querySelector('.jobs-unified-top-card__job-title h1')?.textContent?.trim() ||
               document.querySelector('.jobs-unified-top-card__job-title')?.textContent?.trim() ||
               document.querySelector('.top-card-layout__title')?.textContent?.trim() ||
               document.querySelector('.topcard__title')?.textContent?.trim() ||
               document.querySelector('h1')?.textContent?.trim() ||
               '';

    // Extract skills from job description
    const description = document.querySelector('.jobs-description-content__text')?.textContent || 
                       document.querySelector('.jobs-description__content')?.textContent ||
                       document.querySelector('.jobs-box__html-content')?.textContent ||
                       document.querySelector('#job-details')?.textContent ||
                       document.querySelector('.description__text')?.textContent || '';
    skills = extractSkills(description);
  }
  
  // Naukri.com
  else if (url.includes('naukri.com')) {
    company = document.querySelector('a.comp-name')?.textContent?.trim() ||
              document.querySelector('.comp-name')?.textContent?.trim() ||
              document.querySelector('.jd-header-comp-name a')?.textContent?.trim() ||
              document.querySelector('.jd-header-comp-name')?.textContent?.trim() ||
              document.querySelector('[class*="comp-name"]')?.textContent?.trim() ||
              document.querySelector('[class*="companyName"]')?.textContent?.trim() ||
              '';
    
    // Try JSON-LD
    if (!company) {
      try {
        const ldScript = document.querySelector('script[type="application/ld+json"]');
        if (ldScript) {
          const ldData = JSON.parse(ldScript.textContent);
          if (ldData.hiringOrganization) {
            company = ldData.hiringOrganization.name || '';
          }
        }
      } catch (e) {}
    }
    
    // Try from title "Job Title - Company | Naukri.com"
    if (!company) {
      const titleParts = document.title.split(/[|\-–]/);
      if (titleParts.length >= 2) {
        const companyPart = titleParts[1]?.trim();
        if (companyPart && !companyPart.toLowerCase().includes('naukri')) {
          company = companyPart;
        }
      }
    }
    
    position = document.querySelector('h1.jd-header-title')?.textContent?.trim() ||
               document.querySelector('.jd-header-title')?.textContent?.trim() ||
               document.querySelector('h1[class*="title"]')?.textContent?.trim() ||
               document.querySelector('h1')?.textContent?.trim() ||
               '';

    const description = document.querySelector('.job-desc')?.textContent ||
                       document.querySelector('.jd-desc')?.textContent ||
                       document.querySelector('[class*="job-desc"]')?.textContent || '';
    skills = extractSkills(description);
    
    // Also get skills from skill tags
    const skillTags = document.querySelectorAll('.chip-wrap a, .key-skill a, [class*="skill"] a');
    skillTags.forEach(tag => {
      const skill = tag.textContent?.trim();
      if (skill && !skills.includes(skill)) {
        skills.push(skill);
      }
    });
  }
  
  // Indeed
  else if (url.includes('indeed.com')) {
    company = document.querySelector('[data-testid="inlineHeader-companyName"]')?.textContent?.trim() ||
              document.querySelector('.jobsearch-InlineCompanyRating-companyHeader')?.textContent?.trim() ||
              document.querySelector('.icl-u-lg-mr--sm')?.textContent?.trim() ||
              document.querySelector('.companyName')?.textContent?.trim() ||
              '';
    
    position = document.querySelector('[data-testid="jobsearch-JobInfoHeader-title"]')?.textContent?.trim() ||
               document.querySelector('.jobsearch-JobInfoHeader-title')?.textContent?.trim() ||
               document.querySelector('.jobTitle')?.textContent?.trim() ||
               document.querySelector('h1')?.textContent?.trim() ||
               '';

    const description = document.querySelector('#jobDescriptionText')?.textContent || '';
    skills = extractSkills(description);
  }
  
  // Glassdoor
  else if (url.includes('glassdoor.com')) {
    company = document.querySelector('[data-test="employerName"]')?.textContent?.trim() ||
              document.querySelector('.employer-name')?.textContent?.trim() ||
              '';
    
    position = document.querySelector('[data-test="jobTitle"]')?.textContent?.trim() ||
               document.querySelector('.job-title')?.textContent?.trim() ||
               document.querySelector('h1')?.textContent?.trim() ||
               '';

    const description = document.querySelector('.jobDescriptionContent')?.textContent || '';
    skills = extractSkills(description);
  }
  
  // Generic fallback
  else {
    position = document.querySelector('h1')?.textContent?.trim() || document.title.split(/[|\-–]/)[0]?.trim() || '';
    company = document.querySelector('[class*="company"]')?.textContent?.trim() || 
              document.querySelector('[class*="employer"]')?.textContent?.trim() || '';
    
    // Try JSON-LD
    try {
      const ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
      ldScripts.forEach(script => {
        const data = JSON.parse(script.textContent);
        if (data['@type'] === 'JobPosting') {
          if (!position) position = data.title || '';
          if (!company && data.hiringOrganization) {
            company = data.hiringOrganization.name || '';
          }
        }
      });
    } catch (e) {}
  }

  return { company, position, url, skills: skills.slice(0, 10) };

  function extractSkills(text) {
    const commonSkills = [
      'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust', 'Ruby', 'PHP',
      'React', 'Vue', 'Angular', 'Node.js', 'Express', 'Django', 'Flask', 'Spring',
      'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'CI/CD', 'Git',
      'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'GraphQL', 'REST',
      'HTML', 'CSS', 'Sass', 'Tailwind', 'Bootstrap',
      'Agile', 'Scrum', 'Jira', 'Linux', 'Machine Learning', 'AI'
    ];
    
    const found = [];
    const lowerText = text.toLowerCase();
    
    commonSkills.forEach(skill => {
      if (lowerText.includes(skill.toLowerCase())) {
        found.push(skill);
      }
    });
    
    return [...new Set(found)].slice(0, 10);
  }
}

// ============================================
// Status Cycling
// ============================================
async function cycleStatus(id) {
  const statusOrder = ['applied', 'pending', 'interview', 'offer', 'rejected'];
  const app = applications.find(a => a.id === id);
  if (!app) return;

  const currentIndex = statusOrder.indexOf(app.status);
  const nextIndex = (currentIndex + 1) % statusOrder.length;
  app.status = statusOrder[nextIndex];
  app.updatedAt = new Date().toISOString();

  await saveData();
  renderApplications();
  updateStats();
}

// ============================================
// Import/Export
// ============================================
function exportData() {
  const data = {
    applications,
    settings,
    exportedAt: new Date().toISOString(),
    version: '1.0.0'
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `job-tracker-export-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Data exported successfully!');
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      
      if (data.applications && Array.isArray(data.applications)) {
        applications = data.applications;
        await saveData();
        
        if (data.settings) {
          settings = data.settings;
          await saveSettings();
          elements.autoCapture.checked = settings.autoCapture;
          elements.notifications.checked = settings.notifications;
        }
        
        renderApplications();
        updateStats();
        showToast(`Imported ${applications.length} applications!`);
      } else {
        throw new Error('Invalid file format');
      }
    } catch (error) {
      showToast('Error importing file. Check the format.', 'error');
    }
  };
  reader.readAsText(file);
}

// ============================================
// Utilities
// ============================================
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function showToast(message, type = 'success') {
  elements.toast.textContent = message;
  elements.toast.className = `toast ${type} show`;
  setTimeout(() => {
    elements.toast.classList.remove('show');
  }, 3000);
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ============================================
// Event Bindings
// ============================================
function bindEvents() {
  // Capture button
  elements.captureBtn.addEventListener('click', captureFromPage);

  // Settings
  elements.settingsBtn.addEventListener('click', openSettingsModal);
  elements.closeSettings.addEventListener('click', closeSettingsModal);
  elements.autoCapture.addEventListener('change', saveSettings);
  elements.notifications.addEventListener('change', saveSettings);

  // Modal
  elements.closeModal.addEventListener('click', closeModal);
  elements.cancelBtn.addEventListener('click', closeModal);
  elements.modal.addEventListener('click', (e) => {
    if (e.target === elements.modal) closeModal();
  });
  elements.settingsModal.addEventListener('click', (e) => {
    if (e.target === elements.settingsModal) closeSettingsModal();
  });

  // Form submission
  elements.applicationForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const appData = {
      company: elements.company.value,
      position: elements.position.value,
      status: elements.status.value,
      dateApplied: elements.dateApplied.value,
      url: elements.url.value,
      skills: elements.skills.value
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0),
      notes: elements.notes.value
    };

    if (elements.appId.value) {
      await updateApplication(elements.appId.value, appData);
    } else {
      await addApplication(appData);
    }

    closeModal();
  });

  // Search and filter
  elements.searchInput.addEventListener('input', debounce(renderApplications, 300));
  elements.statusFilter.addEventListener('change', renderApplications);

  // Import/Export
  elements.exportBtn.addEventListener('click', exportData);
  elements.importBtn.addEventListener('click', () => elements.importFile.click());
  elements.importFile.addEventListener('change', (e) => {
    if (e.target.files[0]) {
      importData(e.target.files[0]);
      e.target.value = '';
    }
  });

  // Clear all
  elements.clearAllBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to delete ALL applications? This cannot be undone.')) {
      clearAllApplications();
      closeSettingsModal();
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeSettingsModal();
    }
  });
}
