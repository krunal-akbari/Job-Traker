# Job Application Tracker

A Chrome Extension (Manifest V3) to track your job applications from LinkedIn, Indeed, Glassdoor, and other job sites.

## Features

- **Auto-Capture**: Automatically extract job details (company, position, skills) from job posting pages
- **Status Tracking**: Track application status (Pending → Applied → Interview → Offer/Rejected)
- **Search & Filter**: Quickly find applications by company, position, or status
- **Local Storage**: All data stored locally in your browser—no external servers
- **Import/Export**: Backup and restore your data as JSON files
- **Notifications**: Optional notifications for new job detections
- **Statistics**: Dashboard showing application counts by status

## Supported Job Sites

- LinkedIn Jobs
- Indeed
- Glassdoor
- Generic fallback for other sites

## Installation

### From Source (Developer Mode)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked**
5. Select the `job-db` folder
6. The extension icon will appear in your toolbar

### Pinning the Extension

1. Click the puzzle piece icon in Chrome toolbar
2. Find "Job Application Tracker"
3. Click the pin icon to keep it visible

## Usage

### Capturing Jobs

1. Navigate to a job posting on LinkedIn, Indeed, or Glassdoor
2. Click the extension icon
3. Click **+ Capture** button
4. Review the extracted details and click **Save**

### Managing Applications

- **View Details**: Click on any application card to open the job URL
- **Change Status**: Click the status badge to cycle through statuses
- **Edit**: Click the ✏️ button to modify details
- **Delete**: Click the 🗑️ button to remove an application
- **Search**: Use the search bar to filter by company or position
- **Filter**: Use the dropdown to filter by status

### Settings

Click the ⚙️ button to access settings:

- **Auto-capture**: Automatically detect jobs when visiting job pages
- **Notifications**: Enable/disable desktop notifications
- **Export Data**: Download all applications as JSON
- **Import Data**: Restore applications from a JSON backup
- **Clear All Data**: Remove all tracked applications

## Data Structure

Applications are stored with the following fields:

```javascript
{
  id: string,           // Unique identifier
  company: string,      // Company name
  position: string,     // Job title
  status: string,       // pending | applied | interview | offer | rejected
  dateApplied: string,  // ISO date (YYYY-MM-DD)
  url: string,          // Job posting URL
  skills: string[],     // Extracted skills
  notes: string,        // User notes
  createdAt: string,    // ISO timestamp
  updatedAt: string     // ISO timestamp
}
```

## File Structure

```
job-db/
├── manifest.json     # Extension configuration
├── popup.html        # Main UI
├── popup.js          # UI logic & CRUD operations
├── content.js        # Page scraping scripts
├── background.js     # Service worker
├── styles.css        # Styling
├── icons/            # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md         # This file
```

## Development

### Code Style

- 2-space indentation
- Single quotes for strings
- Semicolons required
- lowerCamelCase for variables and functions

### Testing Changes

1. Make your changes to the source files
2. Go to `chrome://extensions`
3. Click the refresh icon on the extension card
4. Test your changes

### Adding New Job Sites

To add support for a new job site:

1. Add the URL pattern to `manifest.json` under `host_permissions` and `content_scripts.matches`
2. Add a new scraper function in `content.js` (e.g., `scrapeNewSite()`)
3. Update the `scrapeCurrentPage()` function to detect and use the new scraper

## Privacy

- All data is stored locally using `chrome.storage.local`
- No data is sent to external servers
- No analytics or tracking
- You own your data completely

## License

MIT License - Feel free to modify and distribute.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Troubleshooting

### Extension Not Capturing Jobs

- Ensure you're on a supported job site
- Try refreshing the page
- Check that the extension has permission for the site

### Data Not Saving

- Check Chrome's storage limits (usually 5MB for local storage)
- Export your data regularly as backup

### Icons Not Showing

- Ensure all icon files exist in the `icons/` folder
- Reload the extension from `chrome://extensions`
