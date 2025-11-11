# Quick Start Guide

Your Shein Product Scraper is ready to use with **hardcoded API keys** - no configuration needed!

## Installation (One-Time Setup)

1. **Open Chrome Extensions Page**
   - Type `chrome://extensions/` in the address bar
   - OR: Menu → More Tools → Extensions

2. **Enable Developer Mode**
   - Toggle the switch in the top-right corner

3. **Load the Extension**
   - Click "Load unpacked"
   - Navigate to: `C:\Users\ramez\Documents\projects\dpop\shein_extention`
   - Click "Select Folder"

4. **Verify Installation**
   - You should see "Shein Product Scraper" in your extensions list
   - The extension icon will appear in your Chrome toolbar

## Usage

### Step 1: Navigate to Shein
Go to any Shein product page, for example:
- https://us.shein.com/[any-product-url]

### Step 2: Click Extension Icon
Click the extension icon in your Chrome toolbar (puzzle piece area)

### Step 3: Scrape!
Click the big blue **"Scrape Product"** button

### Step 4: Wait
- Status will show "Scraping in progress..."
- Takes 10-30 seconds depending on:
  - Number of product images
  - API response times
  - Internet speed

### Step 5: Review Results! 🎉
A **new tab** will automatically open with your results viewer showing:
- All product images in a beautiful gallery
- Page screenshot
- Extracted product data (formatted and raw JSON)
- OCR text from the page

### Step 6: Download What You Want
From the results page, you can:
- Click "Download All Images" to get all product images
- Click individual "Download" buttons under each image
- Click "Download JSON Data" to save the structured data
- Click "Download Screenshot" to save the page capture

## What You Get

The results viewer displays everything in a clean, organized interface:

### 📸 Images
- Gallery view of all product images
- Individual download buttons for each image
- "Download All" button to get everything at once

### 📸 Screenshot
- Full page screenshot
- Download button to save it

### 📄 Extracted Data
Formatted view showing:
```json
{
  "price": "$19.99",
  "originalPrice": "$24.99",
  "discount": "20% OFF",
  "description": "Women's casual t-shirt with graphic print",
  "inStock": true,
  "color": "Black",
  "size": ["S", "M", "L", "XL"],
  "productName": "SHEIN Casual Tee",
  "url": "https://us.shein.com/...",
  "scrapedAt": "2025-11-07T10:30:00.000Z",
  "ocrText": "Full OCR text from page...",
  "imageUrls": ["https://...", "https://..."]
}
```

## Troubleshooting

### Extension won't load
- Make sure you selected the `shein_extention` folder (not a parent folder)
- Check for errors in `chrome://extensions/`
- Try clicking the "Reload" button under the extension

### "No product images found"
- You must be on a **product page** (not search results or category pages)
- Look for a page with a single product and "Add to Cart" button

### Scraping fails
1. Open DevTools Console (F12)
2. Click "Scrape Product" again
3. Look for error messages in red
4. Check:
   - Are you on a Shein product page?
   - Is your internet connection working?
   - Try refreshing the Shein page and scraping again

### "Cannot read property" errors
1. Go to `chrome://extensions/`
2. Find "Shein Product Scraper"
3. Click "service worker" to see background logs
4. Share any errors you see

### Downloads not appearing
- Check Chrome's download settings (chrome://settings/downloads)
- Make sure downloads aren't being blocked
- Check if Chrome is asking for download permission at the top of the browser

## API Keys (Already Configured)

✅ **OpenRouter API Key**: Hardcoded in `background.js`
✅ **Google Cloud Vision API Key**: Hardcoded in `background.js`

You don't need to do anything - the keys are already in the code!

## Testing Individual Features

### Test if content script can extract images:
1. Go to a Shein product page
2. Open DevTools Console (F12)
3. Paste and run:
```javascript
chrome.runtime.sendMessage({action: 'extractProductData'}, console.log)
```
4. You should see product data with image URLs

### Test if screenshot works:
1. Open DevTools Console on any page
2. Paste and run:
```javascript
chrome.tabs.captureVisibleTab(null, {format: 'png'}, (data) => console.log(data.substring(0, 50)))
```
3. You should see `data:image/png;base64...`

## Features

✅ Extracts all product images
✅ Takes full page screenshot
✅ Extracts text with Google Cloud Vision OCR
✅ Analyzes page with Claude 3.5 Sonnet (via OpenRouter)
✅ Generates structured JSON data
✅ Beautiful results viewer with download options
✅ No configuration needed - ready to use!

## Example Workflow

1. Open Chrome
2. Go to https://us.shein.com and find a product you like
3. Click extension icon
4. Click "Scrape Product"
5. Wait 10-30 seconds for scraping to complete
6. **New tab opens** with results viewer
7. Review all images and extracted data
8. Download what you want with individual buttons
9. Close the tab when done!

---

**Questions or Issues?**
Check the main README.md or console logs for detailed error information.
