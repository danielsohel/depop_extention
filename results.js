// Results page script

let scrapeData = null;
let currentDisplayedImages = [];
let currentRemixImage = null;
let currentRemixIndex = null;

// Track metadata per image: view selection, card text, AI description
let imageMetadata = {}; // { index: { view: 'front'|'back'|null, cardText: '', aiDescription: '' } }

// Depop categories (same list as in background.js)
const DEPOP_CATEGORIES = [
  "Men - Tops",
  "Men - Bottoms",
  "Women - Tops",
  "Women - Bottoms"
];

// Depop subcategory mapping (limited to specific options only)
const DEPOP_SUBCATEGORIES = {
  "Men - Tops": [
    "T-shirts",
    "Hoodies",
    "Sweatshirts"
  ],
  "Men - Bottoms": [
    "Jeans",
    "Sweatpants",
    "Trousers",
    "Shorts",
    "Leggings",
    "Skirts"
  ],
  "Women - Tops": [
    "T-shirts",
    "Hoodies",
    "Sweatshirts",
    "Jumpers"
  ],
  "Women - Bottoms": [
    "Jeans",
    "Sweatpants",
    "Trousers",
    "Shorts",
    "Leggings",
    "Skirts"
  ]
};

// Track selected category and subcategory
let selectedCategory = null;
let selectedSubcategory = null;

// Default preset prompts
const PRESET_PROMPTS = {
  bed: "Keep the clothing item exactly as it is without any changes. Place it on a soft, unmade white bed with natural wrinkles in the sheets. Add natural warm daylight from a window, realistic shadows and folds. Casual phone photo aesthetic. Only change the background and staging, preserve the clothing completely.",
  marble: "Keep the clothing item exactly as it is without any changes. Place it on a clean marble countertop or surface with natural stone veining and texture visible. Include realistic natural lighting that creates soft shadows beneath and around the garment. The scene should look effortless and unposed, maintaining the feel of a quick, authentic photo captured on a smartphone.",
  remove_bed: "Remove the person from this image and extract just the clothing item they're wearing, then lay it out flat in a natural, relaxed position on a soft white bed with gentle fabric folds and wrinkles. Maintain realistic proportions and ensure the garment looks naturally arranged rather than perfectly styled, with appropriate shadows and natural lighting that matches a casual, everyday photograph taken on a phone.",
  remove_marble: "Remove the person from this image and extract just the clothing item they're wearing, then lay it out flat in a natural position on a marble countertop or surface with visible stone texture and veining. The garment should appear casually arranged with realistic shadows and natural ambient lighting, creating an authentic, unposed look as if captured quickly on a smartphone.",
  custom: ""
};

// Load data when page loads
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Get data from chrome storage (passed from background script)
    const result = await chrome.storage.local.get(['latestScrapeResults', 'defaultCardText']);

    if (!result.latestScrapeResults) {
      showError('No scrape data found. Please try scraping again.');
      return;
    }

    scrapeData = result.latestScrapeResults;

    // Initialize image metadata with default card text
    const defaultCardText = result.defaultCardText || '@yourshop on depop';
    const totalImages = (scrapeData.images || []).length;
    for (let i = 0; i < totalImages; i++) {
      imageMetadata[i] = {
        view: null, // Will be set by user clicking Front/Back
        cardText: defaultCardText,
        aiDescription: null
      };
    }

    displayResults(scrapeData);

    // Populate category dropdown and get AI suggestion
    await initializeCategory(scrapeData);

    hideLoading();
  } catch (error) {
    console.error('Error loading results:', error);
    showError('Error loading results: ' + error.message);
  }
});

function displayResults(data) {
  // Display product name
  document.getElementById('product-name').textContent = data.productName || 'Unknown Product';

  // Display scrape time
  const scrapeTime = new Date(data.scrapedAt);
  document.getElementById('scrape-time').textContent =
    `Scraped: ${scrapeTime.toLocaleString()}`;

  // Check if AI enhancement is available
  const hasAI = data.aiEnhanced && !data.aiError;

  // Display AI warning if failed
  if (data.aiError) {
    const warningDiv = document.getElementById('ai-warning');
    const messageSpan = document.getElementById('ai-warning-message');
    warningDiv.style.display = 'block';
    messageSpan.textContent = `(${data.aiError})`;
    document.getElementById('ai-badge').style.display = 'none';
  }

  // Display AI description or fallback
  displayAIDescription(data);

  // Display transformation status
  displayTransformationStatus(data);

  // Display pricing calculator
  displayPricingCalculator(data);

  // Display product images - show all original images (no auto-transformation)
  const originalImages = data.images || [];
  const imagesToDisplay = originalImages.slice(0, 10); // Show first 10 original images

  console.log('Displaying images:', imagesToDisplay.length);
  console.log('All images are originals (no auto-transformation)');

  // Hide "Transform Remaining Images" button (removed feature)
  const transformRemainingBtn = document.getElementById('transform-remaining-btn');
  if (transformRemainingBtn) {
    transformRemainingBtn.style.display = 'none';
  }

  displayImages(imagesToDisplay, data);

  // Display formatted data
  displayFormattedData(data);

  // Display raw JSON
  document.getElementById('json-code').textContent = JSON.stringify(data, null, 2);

  // OCR no longer used (data extracted from DOM instead)
  const ocrSection = document.querySelector('.ocr-section');
  if (ocrSection) {
    ocrSection.style.display = 'none'; // Hide OCR section
  }

  // Setup event listeners
  setupEventListeners(data, imagesToDisplay);
}

/**
 * Initialize category dropdown and get AI suggestion
 */
async function initializeCategory(data) {
  const categorySelect = document.getElementById('category-select');
  const subcategoryGroup = document.getElementById('subcategory-group');
  const subcategorySelect = document.getElementById('subcategory-select');

  // Populate category dropdown (4 options only)
  categorySelect.innerHTML = DEPOP_CATEGORIES.map(cat =>
    `<option value="${cat}">${cat}</option>`
  ).join('');

  // Get AI suggestion
  try {
    const { openRouterApiKey } = await chrome.storage.sync.get('openRouterApiKey');

    if (!openRouterApiKey) {
      console.warn('No OpenRouter API key found, defaulting to Women - Tops / T-shirts');
      selectedCategory = 'Women - Tops';
      selectedSubcategory = 'T-shirts';
      categorySelect.value = selectedCategory;
      updateSubcategoryDropdown(selectedCategory, selectedSubcategory);
      return;
    }

    const productName = data.productName || 'Unknown Product';
    const description = data.aiEnhanced?.description || data.rawProductData?.description || '';

    console.log('Requesting AI category and subcategory suggestion...');

    const response = await chrome.runtime.sendMessage({
      action: 'suggestCategory',
      productName: productName,
      description: description,
      apiKey: openRouterApiKey
    });

    if (response && response.success && response.category && response.subcategory) {
      selectedCategory = response.category;
      selectedSubcategory = response.subcategory;
      categorySelect.value = selectedCategory;
      updateSubcategoryDropdown(selectedCategory, selectedSubcategory);
      console.log(`✓ Category set to: ${selectedCategory}`);
      console.log(`✓ Subcategory set to: ${selectedSubcategory}`);
    } else {
      console.warn('AI suggestion failed, using defaults');
      selectedCategory = 'Women - Tops';
      selectedSubcategory = 'T-shirts';
      categorySelect.value = selectedCategory;
      updateSubcategoryDropdown(selectedCategory, selectedSubcategory);
    }

  } catch (error) {
    console.error('Error getting category suggestion:', error);
    selectedCategory = 'Women - Tops';
    selectedSubcategory = 'T-shirts';
    categorySelect.value = selectedCategory;
    updateSubcategoryDropdown(selectedCategory, selectedSubcategory);
  }

  // Category change listener
  categorySelect.addEventListener('change', (e) => {
    selectedCategory = e.target.value;
    console.log('Category manually changed to:', selectedCategory);
    // Update subcategory dropdown when category changes
    updateSubcategoryDropdown(selectedCategory);
  });

  // Subcategory change listener
  if (subcategorySelect) {
    subcategorySelect.addEventListener('change', (e) => {
      selectedSubcategory = e.target.value;
      console.log('Subcategory manually changed to:', selectedSubcategory);
    });
  }
}

/**
 * Update subcategory dropdown based on selected category
 * @param {string} category - Selected category
 * @param {string} defaultSubcategory - Optional default subcategory to select
 */
function updateSubcategoryDropdown(category, defaultSubcategory = null) {
  const subcategoryGroup = document.getElementById('subcategory-group');
  const subcategorySelect = document.getElementById('subcategory-select');

  if (!subcategoryGroup || !subcategorySelect) {
    return;
  }

  const subcategories = DEPOP_SUBCATEGORIES[category] || [];

  if (subcategories.length === 0) {
    subcategoryGroup.style.display = 'none';
    selectedSubcategory = null;
    return;
  }

  // Show subcategory dropdown
  subcategoryGroup.style.display = 'block';

  // Populate options
  subcategorySelect.innerHTML = '<option value="">Select subcategory...</option>' +
    subcategories.map(sub =>
      `<option value="${sub}">${sub}</option>`
    ).join('');

  // Set default value if provided
  if (defaultSubcategory && subcategories.includes(defaultSubcategory)) {
    subcategorySelect.value = defaultSubcategory;
    selectedSubcategory = defaultSubcategory;
  } else {
    // Default to first option
    subcategorySelect.value = subcategories[0];
    selectedSubcategory = subcategories[0];
  }
}

async function displayAIDescription(data) {
  const descTextarea = document.getElementById('ai-description');
  const premadeTextarea = document.getElementById('premade-description');
  const hashtagsDiv = document.getElementById('ai-hashtags');
  const keywordsDiv = document.getElementById('ai-keywords');

  if (data.aiEnhanced && data.aiEnhanced.description) {
    // AI-enhanced description (now editable in textarea)
    descTextarea.value = data.aiEnhanced.description;

    // Hide hashtags div since they're in the description
    hashtagsDiv.style.display = 'none';

    // Display keywords
    if (data.aiEnhanced.keywords) {
      keywordsDiv.innerHTML = `<p class="keywords-label">Keywords:</p><p class="keywords-text">${data.aiEnhanced.keywords}</p>`;
    }
  } else {
    // Fallback to original description
    descTextarea.value = data.description || 'No description available.';
    hashtagsDiv.innerHTML = '';
    keywordsDiv.innerHTML = '';
  }

  // Load premade text (default from settings or product-specific override)
  const settings = await chrome.storage.local.get('defaultPremadeDescription');
  const premadeText = data.premadeDescription || settings.defaultPremadeDescription || '';
  premadeTextarea.value = premadeText;

  // Add save description button listener
  const saveBtn = document.getElementById('save-description-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      try {
        const newDescription = descTextarea.value.trim();

        if (!newDescription) {
          showToast('Description cannot be empty');
          return;
        }

        // Update in storage
        const result = await chrome.storage.local.get('latestScrapeResults');
        const scrapeData = result.latestScrapeResults;

        if (scrapeData.aiEnhanced) {
          scrapeData.aiEnhanced.description = newDescription;
        } else {
          scrapeData.description = newDescription;
        }

        await chrome.storage.local.set({ latestScrapeResults: scrapeData });

        showToast('✓ Description saved!');
      } catch (error) {
        console.error('Error saving description:', error);
        showToast('Failed to save description');
      }
    });
  }

  // Add save premade text button listener
  const savePremadeBtn = document.getElementById('save-premade-btn');
  if (savePremadeBtn) {
    savePremadeBtn.addEventListener('click', async () => {
      try {
        const newPremadeText = premadeTextarea.value.trim();

        // Update in storage
        const result = await chrome.storage.local.get('latestScrapeResults');
        const scrapeData = result.latestScrapeResults;

        scrapeData.premadeDescription = newPremadeText;

        await chrome.storage.local.set({ latestScrapeResults: scrapeData });

        showToast('✓ Premade text saved!');
      } catch (error) {
        console.error('Error saving premade text:', error);
        showToast('Failed to save premade text');
      }
    });
  }

  // Add auto-save on price input change (for manual edits)
  const priceInput = document.getElementById('calculated-price-input');
  if (priceInput) {
    priceInput.addEventListener('change', async () => {
      try {
        const newPrice = parseFloat(priceInput.value);

        if (!newPrice || newPrice <= 0) {
          showToast('Please enter a valid price (greater than 0)');
          return;
        }

        // Update in storage
        const result = await chrome.storage.local.get('latestScrapeResults');
        const scrapeData = result.latestScrapeResults;

        // Store the manually edited price
        scrapeData.calculatedPrice = newPrice;

        await chrome.storage.local.set({ latestScrapeResults: scrapeData });

        showToast(`✓ Price updated: $${newPrice.toFixed(2)}`);
      } catch (error) {
        console.error('Error saving price:', error);
        showToast('Failed to save price');
      }
    });
  }
}

function displayTransformationStatus(data) {
  const statusDiv = document.getElementById('transformation-status');
  const infoDiv = document.getElementById('transformation-info');
  const togglesDiv = document.getElementById('transformation-toggles');

  // Only show if transformation was enabled
  if (!data.transformationSettings || !data.transformationSettings.enabled) {
    statusDiv.style.display = 'none';
    return;
  }

  statusDiv.style.display = 'block';

  // Build status message
  let statusHTML = '<div class="status-badges">';

  if (data.transformedImages && data.transformedImages.length > 0) {
    // Success - show which transformations were applied
    statusHTML += '<span class="badge success">✅ Transformation Successful</span>';
    statusHTML += `<span class="badge info">📸 ${data.transformedImages.length} images transformed</span>`;

    if (data.transformationSettings.convertFlatLay) {
      statusHTML += '<span class="badge info">🔄 Flat-lay Conversion</span>';
    }

    if (data.transformationSettings.addBedScene) {
      statusHTML += '<span class="badge info">🛏️ Bed Scene Staging</span>';
    }
  } else if (data.transformationError) {
    // Failed - show error
    statusHTML += `<span class="badge error">❌ Transformation Failed</span>`;
    statusHTML += '</div>';
    statusHTML += `<p class="error-note">Error: ${data.transformationError}</p>`;
    statusHTML += '<p class="error-note">Showing original images instead.</p>';
  } else {
    // Transformation enabled but no transformed images (shouldn't happen)
    statusHTML += '<span class="badge warning">⚠️ Transformation Pending</span>';
  }

  if (!data.transformationError) {
    statusHTML += '</div>';
  }

  infoDiv.innerHTML = statusHTML;

  // Add toggle button if we have both original and transformed images
  if (data.transformedImages && data.transformedImages.length > 0 && data.images && data.images.length > 0) {
    togglesDiv.innerHTML = `
      <button id="toggle-image-version" class="btn btn-small" style="margin-top: 10px;">
        👁️ View Original Images
      </button>
    `;

    // Add click handler
    let showingTransformed = true;
    document.getElementById('toggle-image-version').addEventListener('click', function() {
      showingTransformed = !showingTransformed;
      const imagesToShow = showingTransformed ? data.transformedImages : data.images;
      this.textContent = showingTransformed ? '👁️ View Original Images' : '✨ View Transformed Images';
      displayImages(imagesToShow, showingTransformed ? data.transformationSettings : {});
    });
  }
}

/**
 * Calculate tiered price based on original cost
 * < $5: 10x
 * $5-$10: 6x
 * > $10: 5x
 */
function calculateTieredPrice(originalPrice) {
  if (originalPrice < 5) {
    return { price: originalPrice * 10, multiplier: 10 };
  } else if (originalPrice >= 5 && originalPrice <= 10) {
    return { price: originalPrice * 6, multiplier: 6 };
  } else {
    return { price: originalPrice * 5, multiplier: 5 };
  }
}

async function displayPricingCalculator(data) {
  const originalPriceSpan = document.getElementById('original-price');
  const calculatedPriceInput = document.getElementById('calculated-price-input');
  const multiplierSpan = document.getElementById('price-multiplier');

  // Extract numeric price from string like "$19.99" or "US $19.99"
  const priceMatch = data.price?.match(/[\d.]+/);
  const originalPrice = priceMatch ? parseFloat(priceMatch[0]) : null;

  if (originalPrice) {
    originalPriceSpan.textContent = `$${originalPrice.toFixed(2)}`;

    // Calculate price with tiered multiplier
    const { price: calculatedPrice, multiplier } = calculateTieredPrice(originalPrice);

    // Set calculated price in editable input
    calculatedPriceInput.value = calculatedPrice.toFixed(2);

    // Show which multiplier was applied
    multiplierSpan.textContent = `${multiplier}x applied`;

    // AUTO-SAVE: Immediately save the calculated price to storage
    data.calculatedPrice = calculatedPrice;
    await chrome.storage.local.set({ latestScrapeResults: data });
    console.log(`Auto-saved tiered price: $${calculatedPrice.toFixed(2)} (${multiplier}x)`);
  } else {
    originalPriceSpan.textContent = 'N/A';
    calculatedPriceInput.value = '';
    calculatedPriceInput.disabled = true;
    multiplierSpan.textContent = '';
  }
}

function displayImages(imageUrls, transformationSettings = {}, isTransformedView = true) {
  const grid = document.getElementById('images-grid');
  const count = document.getElementById('image-count');

  // Store currently displayed images for delete/remix operations
  currentDisplayedImages = [...imageUrls];

  count.textContent = imageUrls.length;

  if (imageUrls.length === 0) {
    grid.innerHTML = '<p style="color: #999;">No images found</p>';
    return;
  }

  grid.innerHTML = '';

  imageUrls.forEach((url, index) => {
    const card = document.createElement('div');
    card.className = 'image-card';
    card.dataset.index = index;
    card.dataset.url = url;

    // Simple image display
    const img = document.createElement('img');
    img.src = url;
    img.alt = `Product Image ${index + 1}`;
    img.loading = 'lazy';

    // Add error handling for image loading
    img.onerror = function() {
      console.error('Failed to load image:', url);
      this.style.background = '#f5f5f5';
      this.alt = 'Failed to load image';
      this.style.display = 'flex';
      this.style.alignItems = 'center';
      this.style.justifyContent = 'center';
      this.style.color = '#999';
      this.style.fontSize = '12px';
      this.style.textAlign = 'center';
      this.style.padding = '20px';
    };

    img.onload = function() {
      console.log('Successfully loaded image:', url);
    };

    card.appendChild(img);

    const footer = document.createElement('div');
    footer.className = 'image-card-footer';

    // Determine if this is a transformed image (data URL) or original (http URL)
    const isTransformed = url.startsWith('data:');

    // Get metadata for this image
    const metadata = imageMetadata[index] || { view: null, cardText: '', aiDescription: null };

    footer.innerHTML = `
      <span class="image-number">Image ${index + 1}</span>
      ${!isTransformed ? `
        <!-- View selection buttons for original images -->
        <div class="view-selection">
          <button class="view-btn ${metadata.view === 'front' ? 'selected' : ''}" data-index="${index}" data-view="front">
            Front
          </button>
          <button class="view-btn ${metadata.view === 'back' ? 'selected' : ''}" data-index="${index}" data-view="back">
            Back
          </button>
        </div>
        <!-- Card text input -->
        <input
          type="text"
          class="card-text-input"
          placeholder="@yourshop on depop"
          value="${metadata.cardText}"
          data-index="${index}"
        />
      ` : ''}
      ${metadata.aiDescription ? `
        <!-- Show AI description if available -->
        <div style="font-size: 11px; color: #666; margin-bottom: 8px; font-style: italic;">
          ${metadata.aiDescription}
        </div>
      ` : ''}
      <div class="image-actions">
        <button class="btn-image download-single" data-url="${url}" data-index="${index + 1}">
          📥 Download
        </button>
        ${!isTransformed ? `
          <button class="btn-image transform-single" data-url="${url}" data-index="${index}">
            ⚡ Transform
          </button>
        ` : ''}
        ${isTransformed ? `
          <button class="btn-image remix-single" data-url="${url}" data-index="${index}">
            ✨ Remix
          </button>
        ` : ''}
        <button class="btn-image delete-single" data-index="${index}">
          🗑️ Delete
        </button>
      </div>
    `;

    card.appendChild(footer);
    grid.appendChild(card);
  });

  // Add event listeners for new buttons
  setupImageActionListeners();
}

function setupImageActionListeners() {
  // View button listeners (Front/Back selection)
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      const view = e.target.dataset.view;

      // Update metadata
      imageMetadata[index].view = view;

      // Update UI - remove 'selected' from siblings, add to clicked
      const siblings = e.target.parentElement.querySelectorAll('.view-btn');
      siblings.forEach(s => s.classList.remove('selected'));
      e.target.classList.add('selected');

      console.log(`Image ${index} view set to: ${view}`);
    });
  });

  // Card text input listeners
  document.querySelectorAll('.card-text-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const index = parseInt(e.target.dataset.index);
      const cardText = e.target.value;

      // Update metadata
      imageMetadata[index].cardText = cardText;

      console.log(`Image ${index} card text set to: ${cardText}`);
    });
  });

  // Transform button listeners (for original images)
  document.querySelectorAll('.transform-single').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const button = e.target;
      const originalImageUrl = button.dataset.url;
      const index = parseInt(button.dataset.index);
      await transformSingleImage(originalImageUrl, index, button);
    });
  });

  // Delete button listeners
  document.querySelectorAll('.delete-single').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const index = parseInt(e.target.dataset.index);
      await deleteImage(index);
    });
  });

  // Remix button listeners
  document.querySelectorAll('.remix-single').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      const url = e.target.dataset.url;
      openRemixDialog(url, index);
    });
  });
}

async function deleteImage(index) {
  if (!confirm('Are you sure you want to delete this image?')) {
    return;
  }

  console.log(`Deleting image at index ${index}`);

  // Remove from current display array
  currentDisplayedImages.splice(index, 1);

  // Update storage
  try {
    const result = await chrome.storage.local.get('latestScrapeResults');
    const data = result.latestScrapeResults;

    // Determine if we're viewing transformed or original images
    const hasTransformedImages = data.transformedImages && data.transformedImages.length > 0;

    if (hasTransformedImages) {
      // If showing transformed images, remove from transformedImages
      if (index < data.transformedImages.length) {
        data.transformedImages.splice(index, 1);
      } else {
        // If index is beyond transformed images, adjust and remove from original images
        const originalIndex = index - data.transformedImages.length;
        if (data.images && originalIndex >= 0 && originalIndex < data.images.length) {
          data.images.splice(originalIndex, 1);
        }
      }
    } else {
      // If showing original images, remove from images array
      if (data.images && index >= 0 && index < data.images.length) {
        data.images.splice(index, 1);
      }
    }

    // Save updated data
    await chrome.storage.local.set({ latestScrapeResults: data });

    // Re-render gallery
    displayImages(currentDisplayedImages);

    showToast('Image deleted successfully');
  } catch (error) {
    console.error('Error deleting image:', error);
    showToast('Failed to delete image');
  }
}

/**
 * Transform a single original image using vision.js 3-stage process
 * Stage 1: Analyze clothing (Front/Back view)
 * Stage 2: Generate AI description
 * Stage 3: Transform with FLUX using AI description + card text
 */
async function transformSingleImage(originalImageUrl, imageIndex, buttonElement) {
  console.log(`Transforming image ${imageIndex + 1} with vision.js process...`);

  // Get metadata for this image
  const metadata = imageMetadata[imageIndex];

  // Validate: Must have view selection
  if (!metadata || !metadata.view) {
    showToast('⚠️ Please select Front or Back view first!');
    return;
  }

  // Validate: Must have card text
  if (!metadata.cardText || !metadata.cardText.trim()) {
    showToast('⚠️ Please enter card text!');
    return;
  }

  // Disable button and show loading state
  buttonElement.disabled = true;
  const originalText = buttonElement.textContent;
  buttonElement.textContent = '⏳ Analyzing...';

  try {
    // Get API keys from sync storage
    const syncData = await chrome.storage.sync.get(['openRouterApiKey', 'replicateApiKey']);
    const { openRouterApiKey, replicateApiKey } = syncData;

    if (!openRouterApiKey) {
      throw new Error('OpenRouter API key not configured. Please add it in the extension popup.');
    }

    if (!replicateApiKey) {
      throw new Error('Replicate API key not configured. Please add it in the extension popup.');
    }

    // Get scrape data for context
    const result = await chrome.storage.local.get('latestScrapeResults');
    const data = result.latestScrapeResults;

    // Generate unique random seed for THIS transformation (different for each image)
    const imageSeed = Math.floor(Math.random() * 1000000);

    showToast('🔍 Stage 1: Analyzing clothing...');
    buttonElement.textContent = '🔍 Analyzing...';

    // Call background script with vision.js transform
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'transformWithVision',
        imageUrl: originalImageUrl,
        view: metadata.view,
        cardText: metadata.cardText,
        productName: data.productName,
        productLink: data.url,
        productSeed: imageSeed,
        openRouterApiKey: openRouterApiKey,
        replicateApiKey: replicateApiKey
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });

    if (!response.success) {
      throw new Error(response.error);
    }

    const transformedDataUrl = response.dataUrl;
    const aiDescription = response.aiDescription;
    console.log('Transformation successful!');
    console.log('AI Description:', aiDescription);

    // Store AI description in metadata
    imageMetadata[imageIndex].aiDescription = aiDescription;

    // Add transformed image to gallery (don't replace original)
    currentDisplayedImages.push(transformedDataUrl);

    // Update storage - add to images array
    data.images.push(transformedDataUrl);
    await chrome.storage.local.set({ latestScrapeResults: data });

    // Re-render gallery to show AI description
    displayImages(currentDisplayedImages, data);

    showToast(`✓ Transformed! "${aiDescription}"`);

  } catch (error) {
    console.error('Transform error:', error);
    showToast(`Failed to transform: ${error.message}`);

    // Re-enable button on error
    buttonElement.disabled = false;
    buttonElement.textContent = originalText;
  }
}

function openRemixDialog(imageUrl, index) {
  console.log(`Opening remix dialog for image ${index}`);

  currentRemixImage = imageUrl;
  currentRemixIndex = index;

  // Show modal
  const modal = document.getElementById('remix-modal');
  modal.style.display = 'flex';

  // Set preview image
  document.getElementById('remix-preview-image').src = imageUrl;

  // Reset form
  document.getElementById('preset-selector').value = '';
  document.getElementById('remix-prompt').value = '';

  // Setup event listeners (only once)
  setupRemixModalListeners();
}

function setupRemixModalListeners() {
  // Remove existing listeners to avoid duplicates
  const closeBtn = document.getElementById('close-remix-modal');
  const cancelBtn = document.getElementById('cancel-remix');
  const executeBtn = document.getElementById('execute-remix');
  const presetSelector = document.getElementById('preset-selector');

  // Clone and replace to remove all event listeners
  closeBtn.replaceWith(closeBtn.cloneNode(true));
  cancelBtn.replaceWith(cancelBtn.cloneNode(true));
  executeBtn.replaceWith(executeBtn.cloneNode(true));
  presetSelector.replaceWith(presetSelector.cloneNode(true));

  // Get fresh references
  const newCloseBtn = document.getElementById('close-remix-modal');
  const newCancelBtn = document.getElementById('cancel-remix');
  const newExecuteBtn = document.getElementById('execute-remix');
  const newPresetSelector = document.getElementById('preset-selector');

  // Close modal
  newCloseBtn.addEventListener('click', closeRemixDialog);
  newCancelBtn.addEventListener('click', closeRemixDialog);

  // Preset selector change
  newPresetSelector.addEventListener('change', (e) => {
    const presetValue = e.target.value;
    if (presetValue && PRESET_PROMPTS[presetValue]) {
      document.getElementById('remix-prompt').value = PRESET_PROMPTS[presetValue];
    }
  });

  // Execute remix
  newExecuteBtn.addEventListener('click', executeRemix);

  // Close on background click
  document.getElementById('remix-modal').addEventListener('click', (e) => {
    if (e.target.id === 'remix-modal') {
      closeRemixDialog();
    }
  });
}

function closeRemixDialog() {
  document.getElementById('remix-modal').style.display = 'none';
  document.getElementById('remix-progress').style.display = 'none';
  currentRemixImage = null;
  currentRemixIndex = null;
}

async function executeRemix() {
  const prompt = document.getElementById('remix-prompt').value.trim();

  if (!prompt) {
    showToast('Please enter a prompt or select a preset');
    return;
  }

  console.log('Executing remix with prompt:', prompt);

  // Show progress
  document.getElementById('remix-progress').style.display = 'block';
  document.getElementById('remix-status-text').textContent = 'Remixing image with FLUX...';

  try {
    // Get Replicate API key
    const { replicateApiKey } = await chrome.storage.sync.get('replicateApiKey');

    if (!replicateApiKey) {
      throw new Error('Replicate API key not configured. Please add it in the extension popup.');
    }

    // Use message passing to call background.js (fixes CORS issue)
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'remixImage',
        imageUrl: currentRemixImage,
        prompt: prompt,
        apiKey: replicateApiKey
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });

    if (!response.success) {
      throw new Error(response.error);
    }

    const remixedImageUrl = response.dataUrl;
    console.log('Remix successful!');

    // Add remixed image to gallery
    currentDisplayedImages.push(remixedImageUrl);

    // Update storage
    const result = await chrome.storage.local.get('latestScrapeResults');
    const data = result.latestScrapeResults;

    if (!data.transformedImages) {
      data.transformedImages = [];
    }
    data.transformedImages.push(remixedImageUrl);

    await chrome.storage.local.set({ latestScrapeResults: data });

    // Re-render gallery
    displayImages(currentDisplayedImages);

    showToast('✓ Image remixed successfully!');
    closeRemixDialog();

  } catch (error) {
    console.error('Error remixing image:', error);
    document.getElementById('remix-status-text').textContent = `Error: ${error.message}`;
    showToast(`Failed to remix image: ${error.message}`);
  }
}

/**
 * Transform all non-deleted, untransformed images using vision.js 3-stage process
 */
async function transformAllImages() {
  console.log('Transform All Images clicked');

  try {
    // Filter to get only untransformed original images (HTTP URLs, not data URLs)
    const untransformedImages = [];
    currentDisplayedImages.forEach((imageUrl, index) => {
      // Only include original images (not data URLs which are already transformed)
      if (!imageUrl.startsWith('data:')) {
        untransformedImages.push({ url: imageUrl, index: index });
      }
    });

    if (untransformedImages.length === 0) {
      showToast('No untransformed images to transform. All images are already transformed!');
      return;
    }

    // Validate: Check that all untransformed images have required metadata
    const invalidImages = [];
    untransformedImages.forEach(({ index }) => {
      const metadata = imageMetadata[index];
      if (!metadata || !metadata.view) {
        invalidImages.push(`Image ${index + 1}: Missing Front/Back view selection`);
      }
      if (!metadata || !metadata.cardText || !metadata.cardText.trim()) {
        invalidImages.push(`Image ${index + 1}: Missing card text`);
      }
    });

    if (invalidImages.length > 0) {
      showToast(`⚠️ Please complete all images before transforming:\n${invalidImages.join('\n')}`);
      alert(`Please complete the following before transforming:\n\n${invalidImages.join('\n')}`);
      return;
    }

    // Confirm with user
    if (!confirm(`Transform ${untransformedImages.length} image(s)? This will use your API credits.`)) {
      return;
    }

    // Get API keys
    const syncData = await chrome.storage.sync.get(['openRouterApiKey', 'replicateApiKey']);
    const { openRouterApiKey, replicateApiKey } = syncData;

    if (!openRouterApiKey) {
      throw new Error('OpenRouter API key not configured. Please add it in the extension popup.');
    }

    if (!replicateApiKey) {
      throw new Error('Replicate API key not configured. Please add it in the extension popup.');
    }

    // Get scrape data for context
    const result = await chrome.storage.local.get('latestScrapeResults');
    const data = result.latestScrapeResults;

    // Disable button during transformation
    const transformAllBtn = document.getElementById('transform-all-images-btn');
    transformAllBtn.disabled = true;

    // Transform each image sequentially
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < untransformedImages.length; i++) {
      const { url: imageUrl, index: imageIndex } = untransformedImages[i];
      const metadata = imageMetadata[imageIndex];

      // Generate unique random seed for EACH image transformation
      const imageSeed = Math.floor(Math.random() * 1000000);

      try {
        // Update button text with progress
        transformAllBtn.textContent = `⏳ Transforming ${i + 1}/${untransformedImages.length}...`;
        showToast(`🎨 Transforming image ${i + 1} of ${untransformedImages.length}...`);

        // Call background script with vision.js transform
        const response = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({
            action: 'transformWithVision',
            imageUrl: imageUrl,
            view: metadata.view,
            cardText: metadata.cardText,
            productName: data.productName,
            productLink: data.url,
            productSeed: imageSeed,
            openRouterApiKey: openRouterApiKey,
            replicateApiKey: replicateApiKey
          }, (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
        });

        if (!response.success) {
          throw new Error(response.error);
        }

        const transformedDataUrl = response.dataUrl;
        const aiDescription = response.aiDescription;

        // Store AI description in metadata
        imageMetadata[imageIndex].aiDescription = aiDescription;

        // Add transformed image to gallery
        currentDisplayedImages.push(transformedDataUrl);

        // Update storage - add to images array
        data.images.push(transformedDataUrl);

        successCount++;
        console.log(`✓ Transformed image ${i + 1}/${untransformedImages.length}: ${aiDescription}`);

      } catch (error) {
        console.error(`Error transforming image ${i + 1}:`, error);
        showToast(`⚠️ Failed to transform image ${i + 1}: ${error.message}`);
        failCount++;
        // Continue to next image instead of stopping
      }
    }

    // Save updated data to storage
    await chrome.storage.local.set({ latestScrapeResults: data });

    // Re-render gallery to show all new transformed images
    displayImages(currentDisplayedImages, data);

    // Show completion message
    const message = `✓ Transformation complete! Success: ${successCount}, Failed: ${failCount}`;
    showToast(message);
    alert(message);

  } catch (error) {
    console.error('Error in transformAllImages:', error);
    showToast(`Failed to transform images: ${error.message}`);
  } finally {
    // Re-enable button
    const transformAllBtn = document.getElementById('transform-all-images-btn');
    transformAllBtn.disabled = false;
    transformAllBtn.textContent = '🎨 Transform All Images';
  }
}

async function transformRemainingImages(data) {
  if (!confirm('Transform the remaining untransformed images with FLUX? This will use your Replicate API credits.')) {
    return;
  }

  try {
    // Get Replicate API key
    const { replicateApiKey, fluxPrompt } = await chrome.storage.sync.get(['replicateApiKey', 'fluxPrompt']);

    if (!replicateApiKey) {
      throw new Error('Replicate API key not configured. Please add it in the extension popup.');
    }

    // Get default or custom FLUX prompt
    const prompt = fluxPrompt || PRESET_PROMPTS.bed;

    const transformedImages = data.transformedImages || [];
    const originalImages = data.images || [];

    // Get remaining untransformed images
    const remainingImages = originalImages.slice(transformedImages.length, 10);

    if (remainingImages.length === 0) {
      showToast('No remaining images to transform');
      return;
    }

    console.log(`Transforming ${remainingImages.length} remaining images...`);
    showToast(`Starting transformation of ${remainingImages.length} images...`);

    // Disable button during transformation
    const transformBtn = document.getElementById('transform-remaining-btn');
    transformBtn.disabled = true;
    transformBtn.textContent = '⏳ Transforming...';

    // Use message passing to call background.js (fixes CORS issue)
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'transformRemainingImages',
        imageUrls: remainingImages,
        prompt: prompt,
        apiKey: replicateApiKey
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });

    if (!response.success) {
      throw new Error(response.error);
    }

    const newTransformedImages = response.dataUrls;
    console.log(`✓ Successfully transformed ${newTransformedImages.length} images!`);

    // Update storage
    data.transformedImages = [...transformedImages, ...newTransformedImages];
    await chrome.storage.local.set({ latestScrapeResults: data });

    // Update global scrapeData
    scrapeData = data;

    // Re-render the page
    displayResults(data);

    showToast(`✓ Successfully transformed ${newTransformedImages.length} images!`);

  } catch (error) {
    console.error('Error transforming remaining images:', error);
    showToast(`Failed to transform images: ${error.message}`);

    // Re-enable button
    const transformBtn = document.getElementById('transform-remaining-btn');
    transformBtn.disabled = false;
    transformBtn.textContent = '✨ Transform Remaining Images';
  }
}

function displayFormattedData(data) {
  const container = document.getElementById('formatted-data');

  const fields = [
    { label: 'Product Name', value: data.productName },
    { label: 'SKU', value: data.sku },
    { label: 'Price', value: data.price },
    { label: 'Original Price', value: data.originalPrice },
    { label: 'Discount', value: data.discount },
    { label: 'Rating', value: data.rating ? `${data.rating} ⭐` : null },
    { label: 'Reviews', value: data.reviews ? `${data.reviews}+ reviews` : null },
    { label: 'In Stock', value: data.inStock ? 'Yes ✓' : 'No ✗' },
    { label: 'Colors', value: Array.isArray(data.colors) ? data.colors.join(', ') : data.colors },
    { label: 'Sizes', value: Array.isArray(data.sizes) ? data.sizes.join(', ') : data.sizes },
    { label: 'Description', value: data.description },
    { label: 'URL', value: data.url },
    { label: 'Scraped At', value: new Date(data.scrapedAt).toLocaleString() }
  ];

  container.innerHTML = '';

  fields.forEach(field => {
    const row = document.createElement('div');
    row.className = 'data-row';

    const label = document.createElement('div');
    label.className = 'data-label';
    label.textContent = field.label + ':';

    const value = document.createElement('div');
    value.className = 'data-value' + (field.value === null || field.value === undefined ? ' null' : '');

    if (field.label === 'URL' && field.value) {
      value.innerHTML = `<a href="${field.value}" target="_blank">${field.value}</a>`;
    } else {
      value.textContent = field.value || 'N/A';
    }

    row.appendChild(label);
    row.appendChild(value);
    container.appendChild(row);
  });
}

function setupEventListeners(data, imagesToDisplay) {
  // Download complete product as ZIP
  document.getElementById('download-product-complete').addEventListener('click', () => {
    downloadCompleteProduct(data);
  });

  // Download all images (uses currentDisplayedImages to respect deletions)
  document.getElementById('download-all-images').addEventListener('click', () => {
    downloadAllImages(currentDisplayedImages || []);
  });

  // Download transformed images (show button only if transformed images exist)
  const downloadTransformedBtn = document.getElementById('download-transformed-images');
  if (data.transformedImages && data.transformedImages.length > 0) {
    downloadTransformedBtn.style.display = 'inline-block';
    downloadTransformedBtn.addEventListener('click', () => {
      downloadTransformedImages(data);
    });
  } else {
    downloadTransformedBtn.style.display = 'none';
  }

  // Download JSON
  document.getElementById('download-json').addEventListener('click', () => {
    downloadJSON(data);
  });

  // Order Management button
  document.getElementById('order-management-btn').addEventListener('click', () => {
    const orderManagementUrl = chrome.runtime.getURL('order-management.html');
    window.open(orderManagementUrl, '_blank');
  });

  // Add custom image button
  document.getElementById('add-image-btn').addEventListener('click', async () => {
    const urlInput = document.getElementById('custom-image-url');
    const imageUrl = urlInput.value.trim();

    if (!imageUrl) {
      showToast('Please enter an image URL');
      return;
    }

    // Validate URL format
    try {
      new URL(imageUrl);
    } catch (error) {
      showToast('Invalid URL format');
      return;
    }

    try {
      // Test if image loads
      const img = new Image();
      img.onload = async () => {
        // Image loaded successfully, add to gallery
        currentDisplayedImages.push(imageUrl);

        // Update storage
        const result = await chrome.storage.local.get('latestScrapeResults');
        const scrapeData = result.latestScrapeResults;
        scrapeData.images.push(imageUrl);
        await chrome.storage.local.set({ latestScrapeResults: scrapeData });

        // Re-render gallery
        displayImages(currentDisplayedImages, scrapeData);

        // Clear input
        urlInput.value = '';

        showToast('✓ Image added to gallery!');
      };

      img.onerror = () => {
        showToast('Failed to load image from URL');
      };

      img.src = imageUrl;
    } catch (error) {
      console.error('Error adding image:', error);
      showToast('Failed to add image');
    }
  });

  // Transform All Images button
  document.getElementById('transform-all-images-btn').addEventListener('click', () => {
    transformAllImages();
  });

  // Publish to Depop button
  document.getElementById('publish-to-depop-btn').addEventListener('click', async () => {
    await publishToDepop(data);
  });

  // Note: Screenshot download removed - replaced with prompts section

  // Toggle JSON view
  document.getElementById('toggle-json').addEventListener('click', () => {
    const rawJson = document.getElementById('raw-json');
    const formattedData = document.getElementById('formatted-data');

    if (rawJson.style.display === 'none') {
      rawJson.style.display = 'block';
      formattedData.style.display = 'none';
    } else {
      rawJson.style.display = 'none';
      formattedData.style.display = 'block';
    }
  });

  // Copy JSON
  document.getElementById('copy-json').addEventListener('click', () => {
    const jsonText = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(jsonText).then(() => {
      showToast('JSON copied to clipboard!');
    });
  });

  // OCR functionality removed (data now extracted directly from DOM)

  // Individual image downloads
  document.querySelectorAll('.download-single').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const url = e.target.dataset.url;
      const index = e.target.dataset.index;
      downloadFile(url, `${sanitizeFilename(data.productName)}_image_${index}.jpg`);
    });
  });
}

function downloadAllImages(imageUrls) {
  if (imageUrls.length === 0) {
    showToast('No images to download');
    return;
  }

  imageUrls.forEach((url, index) => {
    setTimeout(() => {
      downloadFile(url, `${sanitizeFilename(scrapeData.productName)}_image_${index + 1}.jpg`);
    }, index * 500); // Stagger downloads to avoid browser blocking
  });

  showToast(`Downloading ${imageUrls.length} images...`);
}

function downloadJSON(data) {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const filename = `${sanitizeFilename(data.productName)}_data.json`;

  downloadFile(url, filename);
}

async function downloadTransformedImages(data) {
  const transformedImages = data.transformedImages || [];

  if (transformedImages.length === 0) {
    showToast('No transformed images to download');
    return;
  }

  console.log(`Downloading ${transformedImages.length} transformed images...`);
  showToast(`Downloading ${transformedImages.length} transformed images...`);

  // Convert data URLs to blobs and download using Chrome downloads API
  for (let i = 0; i < transformedImages.length; i++) {
    try {
      const dataUrl = transformedImages[i];
      const filename = `${sanitizeFilename(data.productName)}_transformed_${i + 1}.jpg`;

      // For data URLs, use chrome.downloads.download
      if (dataUrl.startsWith('data:')) {
        // Convert data URL to blob
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        // Download using Chrome downloads API
        chrome.downloads.download({
          url: blobUrl,
          filename: filename,
          saveAs: false  // Auto-download without showing save dialog
        }, (downloadId) => {
          if (chrome.runtime.lastError) {
            console.error(`Failed to download image ${i + 1}:`, chrome.runtime.lastError);
          } else {
            console.log(`Downloaded image ${i + 1} with ID:`, downloadId);
          }

          // Cleanup blob URL after a short delay
          setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        });

        // Stagger downloads to avoid overwhelming the browser
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    } catch (error) {
      console.error(`Error downloading image ${i + 1}:`, error);
    }
  }

  showToast(`✓ Downloaded ${transformedImages.length} transformed images!`);
}

function downloadFile(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Cleanup blob URLs
  if (url.startsWith('blob:')) {
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }
}

/**
 * Download complete product as organized ZIP file
 * Includes: all images, product data, descriptions, metadata
 */
async function downloadCompleteProduct(data) {
  try {
    showToast('📦 Preparing product download...');

    const zip = new JSZip();
    const productName = sanitizeFilename(data.productName || 'product');

    // Create folder structure
    const imagesFolder = zip.folder("images");
    const originalImagesFolder = imagesFolder.folder("original");
    const transformedImagesFolder = imagesFolder.folder("transformed");
    const dataFolder = zip.folder("data");

    // Download original images
    const originalImages = currentDisplayedImages.filter(url => !url.startsWith('data:')) || [];
    for (let i = 0; i < originalImages.length; i++) {
      showToast(`📥 Adding image ${i + 1}/${originalImages.length}...`);

      try {
        const imageBlob = await fetch(originalImages[i]).then(r => r.blob());
        originalImagesFolder.file(`image_${i + 1}.jpg`, imageBlob);
      } catch (error) {
        console.error(`Failed to fetch image ${i + 1}:`, error);
      }
    }

    // Download transformed images (data URLs)
    const transformedImages = currentDisplayedImages.filter(url => url.startsWith('data:')) || [];
    for (let i = 0; i < transformedImages.length; i++) {
      showToast(`✨ Adding transformed image ${i + 1}/${transformedImages.length}...`);

      try {
        const imageBlob = await fetch(transformedImages[i]).then(r => r.blob());
        transformedImagesFolder.file(`transformed_${i + 1}.jpg`, imageBlob);
      } catch (error) {
        console.error(`Failed to fetch transformed image ${i + 1}:`, error);
      }
    }

    // Add product data JSON
    const productData = {
      productName: data.productName,
      sku: data.sku,
      price: data.price,
      originalPrice: data.originalPrice,
      calculatedPrice: data.calculatedPrice,
      discount: data.discount,
      rating: data.rating,
      reviews: data.reviews,
      inStock: data.inStock,
      colors: data.colors,
      sizes: data.sizes,
      category: selectedCategory || data.category,
      subcategory: selectedSubcategory || data.subcategory,
      url: data.url,
      scrapedAt: data.scrapedAt
    };
    dataFolder.file("product_info.json", JSON.stringify(productData, null, 2));

    // Add descriptions
    const descriptionTextarea = document.getElementById('ai-description');
    const description = descriptionTextarea ? descriptionTextarea.value.trim() : (data.aiEnhanced?.description || data.description || '');
    dataFolder.file("description.txt", description);

    if (data.aiEnhanced) {
      dataFolder.file("ai_enhanced.json", JSON.stringify(data.aiEnhanced, null, 2));
    }

    // Add image metadata
    if (imageMetadata && Object.keys(imageMetadata).length > 0) {
      dataFolder.file("image_metadata.json", JSON.stringify(imageMetadata, null, 2));
    }

    // Add README with product summary
    const readme = `Product: ${data.productName || 'Untitled'}
Price: ${data.price || 'N/A'}
Calculated Price: $${data.calculatedPrice?.toFixed(2) || 'N/A'}
Category: ${selectedCategory || data.category || 'N/A'}
Subcategory: ${selectedSubcategory || data.subcategory || 'N/A'}
URL: ${data.url || 'N/A'}
Downloaded: ${new Date().toLocaleString()}

This archive contains:
- images/original/ - Original product images (${originalImages.length} images)
- images/transformed/ - AI-transformed images (${transformedImages.length} images)
- data/product_info.json - Complete product data
- data/description.txt - Product description
- data/ai_enhanced.json - AI-generated content (if available)
- data/image_metadata.json - Image metadata (view, card text, AI descriptions)

🖤 All sizes available on request
Generated by Shein Product Scraper Extension`;

    zip.file("README.txt", readme);

    // Generate ZIP
    showToast('🗜️ Compressing ZIP file...');
    const zipBlob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: {
        level: 6
      }
    }, function updateCallback(metadata) {
      // Show progress
      const percent = metadata.percent.toFixed(0);
      showToast(`🗜️ Compressing: ${percent}%`);
    });

    // Download ZIP
    const url = URL.createObjectURL(zipBlob);
    downloadFile(url, `${productName}_complete.zip`);

    const sizeMB = (zipBlob.size / 1024 / 1024).toFixed(2);
    showToast(`✓ Downloaded complete product! (${sizeMB} MB)`);

  } catch (error) {
    console.error('Error creating product download:', error);
    showToast(`❌ Failed to create download: ${error.message}`);
  }
}

function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 50);
}

function hideLoading() {
  document.getElementById('loading').classList.add('hidden');
}

function showError(message) {
  hideLoading();
  document.querySelector('.container').innerHTML = `
    <div style="text-align: center; padding: 50px;">
      <h2 style="color: #f44336;">Error</h2>
      <p style="color: #666; margin-top: 20px;">${message}</p>
      <button onclick="window.close()" style="margin-top: 30px; padding: 10px 20px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Close Tab
      </button>
    </div>
  `;
}

/**
 * Publish product to Depop - saves images, description, and price
 */
async function publishToDepop(data) {
  try {
    // Get current AI description from textarea (edited version)
    const descriptionTextarea = document.getElementById('ai-description');
    const aiDescription = descriptionTextarea ? descriptionTextarea.value.trim() : (data.aiEnhanced?.description || data.description || '');

    // Get premade text from textarea
    const premadeTextarea = document.getElementById('premade-description');
    const premadeText = premadeTextarea ? premadeTextarea.value.trim() : '';

    // Combine: AI description + premade text
    // Format: "[AI description]. [Premade text]. 🖤 All sizes available on request #hashtags"
    let description = aiDescription;
    if (premadeText) {
      // Extract hashtags from AI description (they're at the end)
      const hashtagMatch = aiDescription.match(/(#\S+(\s+#\S+)*)\s*$/);
      const hashtags = hashtagMatch ? hashtagMatch[1] : '';
      const aiDescWithoutHashtags = hashtags ? aiDescription.replace(hashtags, '').trim() : aiDescription;

      // Reconstruct: AI desc + premade + hashtags
      description = `${aiDescWithoutHashtags}. ${premadeText}. ${hashtags}`.trim();
    }

    // Get calculated tiered price from input (user can manually edit this)
    const calculatedPriceInput = document.getElementById('calculated-price-input');
    const price = calculatedPriceInput ? parseFloat(calculatedPriceInput.value) : 0;

    // Get all currently displayed images (including transformed ones)
    const images = currentDisplayedImages || [];

    if (images.length === 0) {
      showToast('No images to publish');
      return;
    }

    if (!description) {
      showToast('No description available');
      return;
    }

    if (price === 0) {
      showToast('Price not calculated');
      return;
    }

    // Create published product object
    const publishedProduct = {
      id: Date.now().toString(),
      productName: data.productName || 'Untitled Product',
      description: description,
      price: price,
      category: selectedCategory || 'Women - Tops', // Include selected category
      subcategory: selectedSubcategory || 'T-shirts', // Include selected subcategory
      images: images, // Store as data URLs
      publishedAt: new Date().toISOString(),
      sourceUrl: data.url || window.location.href
    };

    // Get existing published products
    const result = await chrome.storage.local.get('publishedProducts');
    const publishedProducts = result.publishedProducts || [];

    // Add new product
    publishedProducts.push(publishedProduct);

    // Save to storage
    await chrome.storage.local.set({ publishedProducts: publishedProducts });

    showToast(`✓ Published to Depop! (${images.length} images, $${price.toFixed(2)})`);
    console.log('Published product:', publishedProduct);

  } catch (error) {
    console.error('Error publishing to Depop:', error);
    showToast('Failed to publish: ' + error.message);
  }
}

function showToast(message) {
  // Create toast element
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #323232;
    color: white;
    padding: 16px 24px;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
    font-size: 14px;
    animation: slideIn 0.3s ease;
  `;
  toast.textContent = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Add animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(400px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(400px); opacity: 0; }
  }
`;
document.head.appendChild(style);
