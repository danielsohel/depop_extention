# Shein Product Scraper Chrome Extension

A Manifest V3 Chrome extension that scrapes Shein product pages using AI-powered data extraction.

## Features

- 📸 Download all product images from Shein pages
- 🖼️ Capture page screenshots
- 🔍 Extract text using Google Cloud Vision OCR
- 🤖 Extract structured product data using OpenRouter AI (Claude 3.5 Sonnet)
- 💾 Save everything to organized folders: `Downloads/shein_products/[product_name_timestamp]/`

## Installation

### Step 1: Install the Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `shein_extention` folder
5. The extension icon should appear in your Chrome toolbar

### Step 2: Get Your API Keys

#### OpenRouter API Key

1. Go to [https://openrouter.ai/](https://openrouter.ai/)
2. Sign up or log in
3. Navigate to the **Keys** section
4. Click **Create new key**
5. Copy the key (starts with `sk-or-v1-`)

#### Google Cloud Vision API Key

**IMPORTANT:** Your `ai-assistant-472608-64b86970360a.json` file is a service account key. For Chrome extensions, you need a simpler API key instead.

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project or create a new one
3. Enable the **Cloud Vision API**:
   - Go to **APIs & Services** → **Library**
   - Search for "Cloud Vision API"
   - Click **Enable**
4. Create an API Key:
   - Go to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **API Key**
   - Copy the key (starts with `AIza...`)
5. (Optional) Restrict the key:
   - Click **Edit** on your new API key
   - Under **API restrictions**, select "Restrict key"
   - Choose "Cloud Vision API" from the dropdown

### Step 3: Configure the Extension

1. Click the extension icon in Chrome toolbar
2. Enter your **OpenRouter API Key**
3. Enter your **Google Cloud Vision API Key**
4. Click **Save Settings**
5. You should see "Settings saved successfully!"

## Usage

1. Navigate to any Shein product page (e.g., `https://us.shein.com/...`)
2. Click the extension icon
3. Click **Scrape Product** button
4. Wait 10-30 seconds for the process to complete
5. Check your `Downloads/shein_products/` folder

### Output Structure

Each scrape creates a folder: `shein_products/[product_name]_[timestamp]/`

Contents:
- `image_1.jpg`, `image_2.jpg`, etc. - All product images
- `screenshot.png` - Page screenshot
- `product_data.json` - Structured data

### Example JSON Output

```json
{
  "price": "$19.99",
  "originalPrice": "$24.99",
  "discount": "20% OFF",
  "description": "Women's casual t-shirt...",
  "inStock": true,
  "color": "Black",
  "size": ["S", "M", "L", "XL"],
  "productName": "SHEIN Casual Tee",
  "url": "https://us.shein.com/...",
  "scrapedAt": "2025-11-07T10:30:00.000Z",
  "ocrText": "Full text extracted from page...",
  "imageUrls": ["https://...", "https://..."]
}
```

## Troubleshooting

### Extension won't load
- Check for errors at `chrome://extensions/`
- Make sure all files are present
- Try reloading the extension

### "API keys not configured" error
- Open the extension popup
- Re-enter and save your API keys
- Verify keys are correct (no extra spaces)

### No images found
- Make sure you're on a Shein product page (not search results)
- Shein's DOM structure may have changed - check browser console for errors

### CORS errors
- APIs must be listed in `host_permissions` in manifest.json (already configured)
- Check if your Google API key has proper restrictions

### OCR returns empty string
- Verify Google Vision API is enabled in Cloud Console
- Check API key is correct
- Ensure you have billing enabled (Google requires it even for free tier)

### AI returns malformed JSON
- Check browser console for detailed errors
- Verify OpenRouter API key is valid
- The extension will still save data with error fields if AI fails

## Testing Individual Components

### Test Content Script
1. Navigate to a Shein product page
2. Open DevTools Console (F12)
3. Run: `chrome.runtime.sendMessage({action: 'extractProductData'}, console.log)`
4. Should see product data with image URLs

### Test Screenshot
1. On any page, open DevTools Console
2. Run: `chrome.tabs.captureVisibleTab(null, {format: 'png'}, (data) => console.log(data.substring(0, 50)))`
3. Should see a data URL

### Check Stored API Keys
1. Open DevTools Console on any page
2. Run: `chrome.storage.local.get(console.log)`
3. Should see your stored keys

## Technical Details

- **Manifest Version:** V3 (latest Chrome extension standard)
- **No Build Step:** Pure JavaScript, no npm packages
- **APIs Used:**
  - Chrome Extension APIs (storage, tabs, downloads)
  - Google Cloud Vision REST API
  - OpenRouter REST API
- **Dependencies:** None (all native browser APIs)

## File Structure

```
shein_extention/
├── manifest.json          # Extension configuration
├── background.js          # Service worker (main orchestrator)
├── content.js             # DOM scraper for Shein pages
├── popup.html             # Settings UI
├── popup.css              # Styling
├── popup.js               # UI logic
├── icons/                 # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md              # This file
```

## Privacy & Security

- API keys are stored locally in Chrome's storage (not sent anywhere except to the respective APIs)
- No data is collected or transmitted to third parties
- All scraping happens locally in your browser
- API calls go directly to Google Cloud Vision and OpenRouter

## Limitations

- Only works on Shein product pages (not search results, category pages, etc.)
- Requires active internet connection for API calls
- API usage costs apply (OpenRouter and Google Cloud Vision have free tiers)
- Download speed depends on number of product images

## Support

If you encounter issues:

1. Check the Troubleshooting section above
2. Open browser DevTools Console (F12) to see detailed errors
3. Check background service worker logs:
   - Go to `chrome://extensions/`
   - Click "service worker" under the extension
4. Verify your API keys are valid and have proper permissions

## Future Enhancements

Potential improvements:
- Batch scraping multiple products
- Custom data extraction templates
- Export to CSV/Excel
- Price tracking over time
- Automatic size/color variant scraping

---

**Note:** This extension is for educational purposes. Please respect Shein's Terms of Service and robots.txt when scraping.
