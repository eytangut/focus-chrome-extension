# Focus - AI-Powered Website Blocker

Focus is a Chrome extension that uses artificial intelligence to help you maintain productivity by intelligently managing access to distracting websites.

## Features

### 🛡️ Smart Website Blocking
- Blocks websites by default with a intelligent whitelist system
- Domain-level blocking (`example.com` blocks all subpages)
- Page-level blocking (`example.com/page` blocks only that specific page and subpages)
- Essential browser pages (new tab, chrome://, etc.) are automatically whitelisted

### 🤖 AI-Powered Access Control
- When a blocked site is accessed, users can request access through an AI chat interface
- Uses Google's Gemini API for intelligent conversation
- AI considers:
  - Current whitelist
  - Blocked website information (title, URL)
  - User's reasoning and conversation history
  - Context and urgency of the request

### 📋 Four Decision Types
The AI can make four types of access decisions:

1. **Permanent Whitelist** - Add to permanent whitelist (domain or page level)
2. **Allow Once** - Allow access until the tab is closed (domain or page level)
3. **Allow Temporarily** - Allow for a specified time period (domain or page level)
4. **Deny Request** - Block access and prevent AI chat for 45 minutes (anti-negotiation)

### ⚙️ Comprehensive Settings
- Configure Gemini API key
- Toggle extension on/off
- Manual whitelist management
- Statistics dashboard
- Data import/export functionality
- Reset options

## Installation

### Prerequisites
- Google Chrome browser
- Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

### Steps
1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory
5. Click on the Focus extension icon in your toolbar
6. Open Settings and configure your Gemini API key

## Configuration

### API Key Setup
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the API key
4. Open Focus extension settings
5. Paste the API key and click "Save API Key"
6. Test the API key to ensure it's working

### Basic Settings
- **Enable/Disable Blocking**: Toggle the main blocking functionality
- **Whitelist Management**: Add or remove permanently allowed sites
- **Statistics**: View usage statistics and current permissions

## How It Works

### Blocking Logic
1. When you navigate to a website, the extension checks if it should be blocked
2. The URL is compared against:
   - Permanent whitelist entries
   - Temporary permissions (once or timed)
   - Recent denial cooldowns

### AI Decision Process
1. User clicks "Request Access with AI" on blocked page
2. AI chat interface opens with initial greeting
3. User explains why they need access to the site
4. AI analyzes the request considering:
   - User's explanation and reasoning
   - Current whitelist context
   - Site information (URL, title)
   - Conversation flow
5. AI makes one of four decisions based on understanding

### Permission Types
- **Permanent**: Added to whitelist forever
- **Once**: Allowed until tab/browser closes
- **Temporary**: Allowed for specific duration (AI chooses)
- **Denied**: Blocked with 45-minute AI chat cooldown

## File Structure

```
focus-chrome-extension/
├── manifest.json          # Extension configuration
├── background.js          # Service worker for core logic
├── content.js            # Content script for blocking UI
├── popup.html/js         # Extension popup interface
├── settings.html/js      # Settings/options page
├── styles.css           # Styling for blocked pages
├── blocked.js           # Standalone blocked page script
├── ai-chat.js          # AI chat functionality
└── README.md           # This file
```

## Privacy & Security

- **API Key Storage**: Gemini API key is stored locally in Chrome's storage
- **Data Privacy**: No browsing data is sent to external servers except for AI conversations
- **Local Processing**: All blocking logic runs locally in your browser
- **No Tracking**: Extension doesn't track or collect personal data

## Troubleshooting

### Common Issues

**Extension not blocking sites:**
- Check if blocking is enabled in popup
- Verify the site isn't already whitelisted
- Check browser console for errors

**AI chat not working:**
- Ensure Gemini API key is configured correctly
- Test API key in settings
- Check internet connection
- Verify API key has proper permissions

**Sites loading slowly:**
- This is normal as the extension checks each navigation
- Consider whitelisting frequently used sites

### Reset Extension
If you encounter persistent issues:
1. Open extension settings
2. Scroll to "Data Management" section
3. Click "Reset All Data"
4. Reconfigure your API key and settings

## Development

### Building from Source
1. Clone the repository
2. No build process required - it's ready to load as unpacked extension
3. Make modifications to source files
4. Reload extension in Chrome extensions page

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly with different scenarios
5. Submit a pull request

## License

This project is open source. Please see the license file for details.

## Support

For issues, feature requests, or questions:
1. Check the troubleshooting section above
2. Review existing GitHub issues
3. Create a new issue with detailed information

---

**Made with ❤️ to help you stay focused and productive!**