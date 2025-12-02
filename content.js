// Job Application Tracker - Content Script
// Injected into job posting pages to scrape details and handle auto-capture

'use strict';

// ============================================
// Message Listener
// ============================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scrapeJob') {
    const jobData = scrapeCurrentPage();
    sendResponse(jobData);
  }

  if (request.action === 'ping') {
    sendResponse({ status: 'ok' });
  }

  return true; // Keep message channel open for async response
});

// ============================================
// Auto-capture on Page Load (if enabled)
// ============================================
async function checkAutoCapture() {
  try {
    const result = await chrome.storage.local.get(['settings']);
    const settings = result.settings || {};

    if (settings.autoCapture) {
      const jobData = scrapeCurrentPage();

      if (jobData.company && jobData.position) {
        // Check if already tracked
        const stored = await chrome.storage.local.get(['applications']);
        const applications = stored.applications || [];

        const isDuplicate = applications.some(
          app => app.url === jobData.url ||
                (app.company === jobData.company && app.position === jobData.position)
        );

        if (!isDuplicate) {
          // Send to background for notification
          chrome.runtime.sendMessage({
            action: 'jobDetected',
            data: jobData
          });
        }
      }
    }
  } catch (error) {
    console.log('Auto-capture check failed:', error);
  }
}

// Run auto-capture check after page settles
setTimeout(checkAutoCapture, 2000);

// ============================================
// Page Scraping Functions
// ============================================
function scrapeCurrentPage() {
  const url = window.location.href;
  let company = '';
  let position = '';
  let location = '';
  let salary = '';
  let skills = [];
  let description = '';

  // LinkedIn Jobs
  if (url.includes('linkedin.com')) {
    const result = scrapeLinkedIn();
    company = result.company;
    position = result.position;
    location = result.location;
    skills = result.skills;
    description = result.description;
  }

  // Naukri.com
  else if (url.includes('naukri.com')) {
    const result = scrapeNaukri();
    company = result.company;
    position = result.position;
    location = result.location;
    salary = result.salary;
    skills = result.skills;
    description = result.description;
  }

  // Indeed
  else if (url.includes('indeed.com')) {
    const result = scrapeIndeed();
    company = result.company;
    position = result.position;
    location = result.location;
    salary = result.salary;
    skills = result.skills;
    description = result.description;
  }

  // Glassdoor
  else if (url.includes('glassdoor.com')) {
    const result = scrapeGlassdoor();
    company = result.company;
    position = result.position;
    location = result.location;
    salary = result.salary;
    skills = result.skills;
    description = result.description;
  }

  // Generic fallback
  else {
    const result = scrapeGeneric();
    company = result.company;
    position = result.position;
    description = result.description;
    skills = result.skills;
  }

  return {
    company: cleanText(company),
    position: cleanText(position),
    location: cleanText(location),
    salary: cleanText(salary),
    skills,
    description: cleanText(description).substring(0, 500),
    url
  };
}

// ============================================
// Site-Specific Scrapers
// ============================================
function scrapeLinkedIn() {
  // Updated selectors for LinkedIn's current DOM structure (2024)
  const companySelectors = [
    // New LinkedIn job page layout
    '.job-details-jobs-unified-top-card__company-name a',
    '.job-details-jobs-unified-top-card__company-name',
    '.jobs-unified-top-card__company-name a',
    '.jobs-unified-top-card__company-name',
    // Primary description container (company is often first link)
    '.job-details-jobs-unified-top-card__primary-description-container a',
    '.job-details-jobs-unified-top-card__primary-description a',
    // Alternative layouts
    'a[data-tracking-control-name="public_jobs_topcard-org-name"]',
    '.topcard__org-name-link',
    '.top-card-layout__card a[data-tracking-control-name*="company"]',
    // Span with company class
    'span.job-details-jobs-unified-top-card__company-name',
    // Try data attributes
    '[data-test-id="job-details-company-name"]'
  ];

  const positionSelectors = [
    // New layout
    '.job-details-jobs-unified-top-card__job-title h1',
    '.job-details-jobs-unified-top-card__job-title',
    'h1.job-details-jobs-unified-top-card__job-title',
    '.jobs-unified-top-card__job-title h1',
    '.jobs-unified-top-card__job-title',
    // Public job page
    '.top-card-layout__title',
    '.topcard__title',
    // Generic h1
    'h1.t-24',
    'h1.t-18',
    'h1[class*="title"]',
    'h1'
  ];

  const locationSelectors = [
    '.job-details-jobs-unified-top-card__primary-description-container .tvm__text',
    '.job-details-jobs-unified-top-card__bullet',
    '.jobs-unified-top-card__bullet',
    '.topcard__flavor--bullet',
    '.top-card-layout__second-subline span',
    '[class*="location"]'
  ];

  const descriptionSelectors = [
    '.jobs-description-content__text',
    '.jobs-description__content',
    '.jobs-box__html-content',
    '#job-details',
    '.description__text',
    '.show-more-less-html__markup',
    '[class*="description"]'
  ];

  let company = getFirstMatch(companySelectors);
  let position = getFirstMatch(positionSelectors);

  // Additional fallback: Try to extract company from the page title
  if (!company) {
    const titleMatch = document.title.match(/at\s+(.+?)\s*[|\-–]/i);
    if (titleMatch) {
      company = titleMatch[1];
    }
  }

  // Try to get company from URL if still not found
  if (!company) {
    const companyLink = document.querySelector('a[href*="/company/"]');
    if (companyLink) {
      company = companyLink.textContent.trim() || companyLink.getAttribute('aria-label') || '';
    }
  }

  // Fallback for position from title
  if (!position) {
    const titleParts = document.title.split(/[|\-–]/);
    if (titleParts.length > 0) {
      position = titleParts[0].trim();
    }
  }

  const location = getFirstMatch(locationSelectors);
  const description = getFirstMatch(descriptionSelectors);
  const skills = extractSkillsFromText(description);

  return { company, position, location, skills, description };
}

function scrapeNaukri() {
  // Naukri.com selectors
  const companySelectors = [
    // Main job page selectors
    'a.comp-name',
    '.comp-name',
    'a[data-company-name]',
    '[data-company-name]',
    '.jd-header-comp-name a',
    '.jd-header-comp-name',
    // Company info section
    '.company-info .name',
    '.company-info a',
    '.companyName a',
    '.companyName',
    // Alternate layouts
    '.naukri-jd-header a[href*="company"]',
    'a[href*="/company-jobs"]',
    '.cname a',
    '.cname',
    // Job detail page
    '.styles_jd-header-comp-name__MvqAI a',
    '.styles_jd-header-comp-name__MvqAI',
    '[class*="comp-name"] a',
    '[class*="comp-name"]',
    '[class*="companyName"]'
  ];

  const positionSelectors = [
    // Main title selectors
    'h1.jd-header-title',
    '.jd-header-title',
    'h1[class*="title"]',
    '.styles_jd-header-title__rZwM1',
    '.title',
    '.job-title',
    // Alternate
    'h1',
    '[data-title]'
  ];

  const locationSelectors = [
    '.location a',
    '.location',
    '.loc a',
    '.loc',
    '[class*="location"]',
    '.jd-location span',
    '.jd-location'
  ];

  const salarySelectors = [
    '.salary',
    '.sal',
    '[class*="salary"]',
    '.jd-salary span'
  ];

  const descriptionSelectors = [
    '.job-desc',
    '.jd-desc',
    '.styles_JDC__dang-inner-html__h0K4t',
    '[class*="job-desc"]',
    '[class*="description"]',
    '.dang-inner-html'
  ];

  let company = getFirstMatch(companySelectors);
  let position = getFirstMatch(positionSelectors);

  // Try to extract company from structured data (JSON-LD)
  if (!company) {
    try {
      const ldScript = document.querySelector('script[type="application/ld+json"]');
      if (ldScript) {
        const ldData = JSON.parse(ldScript.textContent);
        if (ldData.hiringOrganization) {
          company = ldData.hiringOrganization.name || '';
        }
        if (!position && ldData.title) {
          position = ldData.title;
        }
      }
    } catch (e) {
      console.log('JSON-LD parsing failed:', e);
    }
  }

  // Fallback: Extract from page title "Job Title - Company Name | Naukri.com"
  if (!company || !position) {
    const titleParts = document.title.split(/[|\-–]/);
    if (titleParts.length >= 2) {
      if (!position) position = titleParts[0].trim();
      if (!company) {
        // Company is usually the second part before "Naukri.com"
        const companyPart = titleParts[1]?.trim();
        if (companyPart && !companyPart.toLowerCase().includes('naukri')) {
          company = companyPart;
        }
      }
    }
  }

  // Try extracting company from URL
  if (!company) {
    const urlMatch = window.location.href.match(/company-([^\/\?]+)/i);
    if (urlMatch) {
      company = urlMatch[1].replace(/-/g, ' ');
    }
  }

  const location = getFirstMatch(locationSelectors);
  const salary = getFirstMatch(salarySelectors);
  const description = getFirstMatch(descriptionSelectors);
  let skills = extractSkillsFromText(description);

  // Also try to get skills from Naukri's skill tags
  const skillTags = document.querySelectorAll('.chip-wrap a, .key-skill a, [class*="skill"] a, .chipWrap a');
  if (skillTags.length > 0) {
    skillTags.forEach(tag => {
      const skill = tag.textContent.trim();
      if (skill && !skills.includes(skill)) {
        skills.push(skill);
      }
    });
  }

  return { company, position, location, salary, skills: skills.slice(0, 15), description };
}

function scrapeIndeed() {
  const companySelectors = [
    '[data-testid="inlineHeader-companyName"] a',
    '[data-testid="inlineHeader-companyName"]',
    '.jobsearch-InlineCompanyRating-companyHeader a',
    '.jobsearch-InlineCompanyRating-companyHeader',
    '.icl-u-lg-mr--sm a',
    '.icl-u-lg-mr--sm',
    '[data-company-name]',
    '.companyName a',
    '.companyName'
  ];

  const positionSelectors = [
    '[data-testid="jobsearch-JobInfoHeader-title"]',
    '.jobsearch-JobInfoHeader-title',
    'h1.jobsearch-JobInfoHeader-title',
    '.jobTitle',
    'h1'
  ];

  const locationSelectors = [
    '[data-testid="inlineHeader-companyLocation"]',
    '[data-testid="job-location"]',
    '.jobsearch-JobInfoHeader-subtitle > div:last-child',
    '.companyLocation'
  ];

  const salarySelectors = [
    '[data-testid="attribute_snippet_testid"]',
    '.jobsearch-JobMetadataHeader-item',
    '#salaryInfoAndJobType',
    '.salary-snippet'
  ];

  const descriptionSelectors = [
    '#jobDescriptionText',
    '.jobsearch-jobDescriptionText',
    '[data-testid="jobDescriptionText"]'
  ];

  const company = getFirstMatch(companySelectors);
  const position = getFirstMatch(positionSelectors);
  const location = getFirstMatch(locationSelectors);
  const salary = getFirstMatch(salarySelectors);
  const description = getFirstMatch(descriptionSelectors);
  const skills = extractSkillsFromText(description);

  return { company, position, location, salary, skills, description };
}

function scrapeGlassdoor() {
  const companySelectors = [
    '[data-test="employerName"]',
    '.employer-name',
    '.e1tk4kwz4',
    'div[data-test="employer-name"]',
    '.EmployerProfile_employerName__0R1C4'
  ];

  const positionSelectors = [
    '[data-test="jobTitle"]',
    '.job-title',
    'h1[data-test="job-title"]',
    '.JobDetails_jobTitle__Rq2LN',
    'h1'
  ];

  const locationSelectors = [
    '[data-test="location"]',
    '.location',
    '[data-test="emp-location"]',
    '.JobDetails_location__mSg5h'
  ];

  const salarySelectors = [
    '[data-test="detailSalary"]',
    '.salary-estimate',
    '.css-1xe2xww',
    '.SalaryEstimate_salaryEstimate__Pnjs5'
  ];

  const descriptionSelectors = [
    '.jobDescriptionContent',
    '[data-test="jobDescriptionContent"]',
    '.desc',
    '.JobDetails_jobDescription__uW_fK'
  ];

  const company = getFirstMatch(companySelectors);
  const position = getFirstMatch(positionSelectors);
  const location = getFirstMatch(locationSelectors);
  const salary = getFirstMatch(salarySelectors);
  const description = getFirstMatch(descriptionSelectors);
  const skills = extractSkillsFromText(description);

  return { company, position, location, salary, skills, description };
}

function scrapeGeneric() {
  // Try common patterns
  let position =
    document.querySelector('h1')?.textContent ||
    document.querySelector('[class*="title"]')?.textContent ||
    '';

  // Clean position from page title if needed
  if (!position) {
    const titleParts = document.title.split(/[|\-–]/);
    position = titleParts[0]?.trim() || '';
  }

  let company =
    document.querySelector('[class*="company"]')?.textContent ||
    document.querySelector('[class*="employer"]')?.textContent ||
    document.querySelector('[class*="organization"]')?.textContent ||
    '';

  // Try JSON-LD
  if (!company || !position) {
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
    } catch (e) {
      // Ignore JSON parsing errors
    }
  }

  const description =
    document.querySelector('[class*="description"]')?.textContent ||
    document.querySelector('[class*="details"]')?.textContent ||
    document.querySelector('main')?.textContent?.substring(0, 2000) ||
    '';

  const skills = extractSkillsFromText(description);

  return { company, position, description, skills };
}

// ============================================
// Utility Functions
// ============================================
function getFirstMatch(selectors) {
  for (const selector of selectors) {
    try {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    } catch (e) {
      // Invalid selector, skip
      continue;
    }
  }
  return '';
}

function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim();
}

function extractSkillsFromText(text) {
  if (!text) return [];

  // Comprehensive list of tech skills to detect
  const skillPatterns = [
    // Programming Languages
    'JavaScript', 'TypeScript', 'Python', 'Java', 'C\\+\\+', 'C#', 'Go', 'Golang',
    'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Scala', 'R', 'MATLAB', 'Perl',

    // Frontend
    'React', 'React\\.js', 'ReactJS', 'Vue', 'Vue\\.js', 'VueJS', 'Angular',
    'Svelte', 'Next\\.js', 'NextJS', 'Nuxt', 'Gatsby', 'Redux', 'MobX',
    'HTML5?', 'CSS3?', 'Sass', 'SCSS', 'Less', 'Tailwind', 'Bootstrap',
    'Material UI', 'Chakra UI', 'jQuery', 'Webpack', 'Vite', 'Babel',

    // Backend
    'Node\\.js', 'NodeJS', 'Express', 'Express\\.js', 'Fastify', 'NestJS',
    'Django', 'Flask', 'FastAPI', 'Spring', 'Spring Boot', 'Laravel',
    'Ruby on Rails', 'Rails', 'ASP\\.NET', '\\.NET', 'Core',

    // Databases
    'SQL', 'PostgreSQL', 'MySQL', 'SQLite', 'Oracle', 'SQL Server',
    'MongoDB', 'Redis', 'Elasticsearch', 'Cassandra', 'DynamoDB',
    'Firebase', 'Supabase', 'Prisma', 'Sequelize', 'TypeORM',

    // Cloud & DevOps
    'AWS', 'Amazon Web Services', 'Azure', 'GCP', 'Google Cloud',
    'Docker', 'Kubernetes', 'K8s', 'Terraform', 'Ansible', 'Jenkins',
    'CI/CD', 'GitHub Actions', 'GitLab CI', 'CircleCI', 'Travis CI',
    'Nginx', 'Apache', 'Linux', 'Unix', 'Bash', 'Shell',

    // APIs & Protocols
    'REST', 'RESTful', 'GraphQL', 'gRPC', 'WebSocket', 'OAuth',
    'JWT', 'API', 'Microservices',

    // Testing
    'Jest', 'Mocha', 'Chai', 'Cypress', 'Playwright', 'Selenium',
    'Pytest', 'JUnit', 'TestNG', 'TDD', 'BDD', 'Unit Testing',

    // Data & ML
    'Machine Learning', 'ML', 'Deep Learning', 'AI', 'Artificial Intelligence',
    'TensorFlow', 'PyTorch', 'Keras', 'Scikit-learn', 'Pandas', 'NumPy',
    'Data Science', 'Data Engineering', 'ETL', 'Spark', 'Hadoop',

    // Mobile
    'React Native', 'Flutter', 'iOS', 'Android', 'Mobile Development',

    // Tools & Practices
    'Git', 'GitHub', 'GitLab', 'Bitbucket', 'Jira', 'Confluence',
    'Agile', 'Scrum', 'Kanban', 'Figma', 'Sketch', 'Adobe XD'
  ];

  const foundSkills = new Set();

  skillPatterns.forEach(pattern => {
    try {
      const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        // Normalize the skill name
        const normalized = normalizeSkillName(matches[0]);
        foundSkills.add(normalized);
      }
    } catch (e) {
      // Invalid regex pattern, skip
    }
  });

  return Array.from(foundSkills).slice(0, 15);
}

function normalizeSkillName(skill) {
  const normalizations = {
    'react.js': 'React',
    'reactjs': 'React',
    'vue.js': 'Vue',
    'vuejs': 'Vue',
    'node.js': 'Node.js',
    'nodejs': 'Node.js',
    'express.js': 'Express',
    'next.js': 'Next.js',
    'nextjs': 'Next.js',
    'c++': 'C++',
    'c#': 'C#',
    'golang': 'Go',
    'k8s': 'Kubernetes',
    'amazon web services': 'AWS',
    'google cloud': 'GCP',
    'restful': 'REST',
    'html5': 'HTML',
    'css3': 'CSS'
  };

  const lower = skill.toLowerCase();
  return normalizations[lower] || skill;
}

// ============================================
// Visual Indicator (Optional)
// ============================================
function showCaptureIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'job-tracker-indicator';
  indicator.innerHTML = `
    <style>
      #job-tracker-indicator {
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        z-index: 999999;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        animation: slideIn 0.3s ease, fadeOut 0.3s ease 2.7s;
      }
      @keyframes slideIn {
        from { transform: translateX(100px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
    </style>
    ✓ Job Tracker: Page detected
  `;

  document.body.appendChild(indicator);
  setTimeout(() => indicator.remove(), 3000);
}
