// Load saved API keys and settings on popup open
document.addEventListener('DOMContentLoaded', async () => {
  // Load OpenRouter API key
  const result = await chrome.storage.sync.get('openRouterApiKey');
  if (result.openRouterApiKey) {
    document.getElementById('api-key-input').value = result.openRouterApiKey;
    showStatus('api-status', '✓ API key configured', 'success');
  }

  // Load Replicate API key
  const replicateResult = await chrome.storage.sync.get('replicateApiKey');
  if (replicateResult.replicateApiKey) {
    document.getElementById('replicate-api-key-input').value = replicateResult.replicateApiKey;
    showStatus('replicate-status', '✓ API key configured', 'success');
  }

  // Load transformation settings
  const settings = await chrome.storage.local.get([
    'convertFlatLay',
    'addBedScene',
    'fluxPrompt',
    'defaultCardText',
    'defaultShippingPrice',
    'defaultBrand',
    'defaultPremadeDescription'
  ]);

  document.getElementById('convert-flat-lay').checked = settings.convertFlatLay !== false; // Default true
  document.getElementById('add-bed-scene').checked = settings.addBedScene !== false; // Default true

  // Load FLUX prompt
  if (settings.fluxPrompt) {
    document.getElementById('flux-prompt').value = settings.fluxPrompt;
  }

  // Load default card text
  if (settings.defaultCardText) {
    document.getElementById('default-card-text').value = settings.defaultCardText;
    showStatus('card-text-status', '✓ Card text configured', 'success');
  }

  // Load default shipping price
  if (settings.defaultShippingPrice !== undefined) {
    document.getElementById('default-shipping-price').value = settings.defaultShippingPrice;
    showStatus('shipping-price-status', '✓ Shipping price configured', 'success');
  }

  // Load default brand
  if (settings.defaultBrand) {
    document.getElementById('default-brand').value = settings.defaultBrand;
    showStatus('brand-status', '✓ Brand configured', 'success');
  }

  // Load default premade description
  if (settings.defaultPremadeDescription) {
    document.getElementById('default-premade-description').value = settings.defaultPremadeDescription;
    showStatus('premade-description-status', '✓ Premade description configured', 'success');
  }

  // Detect if we're on Depop listing page
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isDepopPage = tab && tab.url && tab.url.includes('depop.com/products/create');

  if (isDepopPage) {
    // Show Depop section, hide scrape section
    document.getElementById('scrape-section').style.display = 'none';
    document.getElementById('depop-section').style.display = 'block';

    // Load and display published products
    await loadPublishedProducts();
  } else {
    // Show scrape section, hide Depop section
    document.getElementById('scrape-section').style.display = 'block';
    document.getElementById('depop-section').style.display = 'none';
  }
});

// Save OpenRouter API key button handler
document.getElementById('save-api-key').addEventListener('click', async () => {
  const apiKey = document.getElementById('api-key-input').value.trim();

  if (!apiKey) {
    showStatus('api-status', 'Please enter an API key', 'error');
    return;
  }

  try {
    await chrome.storage.sync.set({ openRouterApiKey: apiKey });
    showStatus('api-status', '✓ API key saved successfully!', 'success');
  } catch (error) {
    showStatus('api-status', 'Error saving API key: ' + error.message, 'error');
  }
});

// Save Replicate API key button handler
document.getElementById('save-replicate-key').addEventListener('click', async () => {
  const apiKey = document.getElementById('replicate-api-key-input').value.trim();

  if (!apiKey) {
    showStatus('replicate-status', 'Please enter an API key', 'error');
    return;
  }

  // Basic validation for Replicate API key format (starts with r8_)
  if (!apiKey.startsWith('r8_')) {
    showStatus('replicate-status', 'Invalid API key format. Replicate keys start with r8_', 'error');
    return;
  }

  try {
    await chrome.storage.sync.set({ replicateApiKey: apiKey });
    showStatus('replicate-status', '✓ API key saved successfully!', 'success');
  } catch (error) {
    showStatus('replicate-status', 'Error saving API key: ' + error.message, 'error');
  }
});

// Save transformation sub-options
document.getElementById('convert-flat-lay').addEventListener('change', async (e) => {
  await chrome.storage.local.set({ convertFlatLay: e.target.checked });
});

document.getElementById('add-bed-scene').addEventListener('change', async (e) => {
  await chrome.storage.local.set({ addBedScene: e.target.checked });
});

// Save FLUX prompt button handler
document.getElementById('save-flux-prompt').addEventListener('click', async () => {
  const prompt = document.getElementById('flux-prompt').value.trim();

  if (!prompt) {
    showStatus('flux-prompt-status', 'Prompt cannot be empty', 'error');
    return;
  }

  try {
    await chrome.storage.local.set({ fluxPrompt: prompt });
    showStatus('flux-prompt-status', '✓ Prompt saved successfully!', 'success');
  } catch (error) {
    showStatus('flux-prompt-status', 'Error saving prompt: ' + error.message, 'error');
  }
});

// Save card text button handler
document.getElementById('save-card-text').addEventListener('click', async () => {
  const cardText = document.getElementById('default-card-text').value.trim();

  if (!cardText) {
    showStatus('card-text-status', 'Card text cannot be empty', 'error');
    return;
  }

  try {
    await chrome.storage.local.set({ defaultCardText: cardText });
    showStatus('card-text-status', '✓ Card text saved successfully!', 'success');
  } catch (error) {
    showStatus('card-text-status', 'Error saving card text: ' + error.message, 'error');
  }
});

// Save shipping price button handler
document.getElementById('save-shipping-price').addEventListener('click', async () => {
  const shippingPrice = document.getElementById('default-shipping-price').value.trim();

  if (!shippingPrice) {
    showStatus('shipping-price-status', 'Shipping price cannot be empty', 'error');
    return;
  }

  const price = parseFloat(shippingPrice);
  if (isNaN(price) || price < 0) {
    showStatus('shipping-price-status', 'Please enter a valid price', 'error');
    return;
  }

  try {
    await chrome.storage.local.set({ defaultShippingPrice: price.toFixed(2) });
    showStatus('shipping-price-status', '✓ Shipping price saved successfully!', 'success');
  } catch (error) {
    showStatus('shipping-price-status', 'Error saving shipping price: ' + error.message, 'error');
  }
});

// Save brand button handler
document.getElementById('save-brand').addEventListener('click', async () => {
  const brand = document.getElementById('default-brand').value.trim();

  if (!brand) {
    showStatus('brand-status', 'Brand cannot be empty', 'error');
    return;
  }

  try {
    await chrome.storage.local.set({ defaultBrand: brand });
    showStatus('brand-status', '✓ Brand saved successfully!', 'success');
  } catch (error) {
    showStatus('brand-status', 'Error saving brand: ' + error.message, 'error');
  }
});

// Save premade description button handler
document.getElementById('save-premade-description').addEventListener('click', async () => {
  const premadeDescription = document.getElementById('default-premade-description').value.trim();

  // Allow empty value (user can clear it)
  try {
    await chrome.storage.local.set({ defaultPremadeDescription: premadeDescription });
    showStatus('premade-description-status', '✓ Premade description saved successfully!', 'success');
  } catch (error) {
    showStatus('premade-description-status', 'Error saving premade description: ' + error.message, 'error');
  }
});

// Scrape button handler
document.getElementById('scrape-btn').addEventListener('click', async () => {
  const statusDiv = document.getElementById('scrape-status');
  statusDiv.textContent = 'Scraping in progress...';
  statusDiv.className = 'success';
  statusDiv.style.display = 'block';

  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Check if on supported site (Shein, AliExpress, or Grailed)
    const isShein = tab.url.includes('shein.com');
    const isAliExpress = tab.url.includes('aliexpress.com') || tab.url.includes('aliexpress.us');
    const isGrailed = tab.url.includes('grailed.com');

    if (!isShein && !isAliExpress && !isGrailed) {
      showStatus('scrape-status', 'Please navigate to a Shein, AliExpress, or Grailed product page', 'error');
      return;
    }

    // Get transformation settings
    const settings = await chrome.storage.local.get([
      'convertFlatLay',
      'addBedScene',
      'fluxPrompt'
    ]);

    // Send message to background script to start scraping
    chrome.runtime.sendMessage({
      action: 'startScrape',
      tabId: tab.id,
      transformationSettings: {
        convertFlatLay: settings.convertFlatLay !== false,
        addBedScene: settings.addBedScene !== false,
        fluxPrompt: settings.fluxPrompt || ''
      }
    }, (response) => {
      if (chrome.runtime.lastError) {
        showStatus('scrape-status', 'Error: ' + chrome.runtime.lastError.message, 'error');
        return;
      }

      if (response && response.success) {
        showStatus('scrape-status', 'Scraping completed! Opening results...', 'success');
      } else {
        showStatus('scrape-status', 'Error: ' + (response ? response.error : 'Unknown error'), 'error');
      }
    });
  } catch (error) {
    showStatus('scrape-status', 'Error: ' + error.message, 'error');
  }
});

/**
 * Load and display published products for Depop
 */
async function loadPublishedProducts() {
  const result = await chrome.storage.local.get('publishedProducts');
  const products = result.publishedProducts || [];

  const listContainer = document.getElementById('published-products-list');
  const noProductsMessage = document.getElementById('no-products-message');

  if (products.length === 0) {
    listContainer.innerHTML = '';
    noProductsMessage.style.display = 'block';
    return;
  }

  noProductsMessage.style.display = 'none';

  // Render product cards
  listContainer.innerHTML = products.map((product, index) => `
    <div class="product-card" data-product-id="${product.id}">
      <img src="${product.images[0]}" alt="${product.productName}" class="product-thumbnail">
      <div class="product-info">
        <div class="product-name">${product.productName}</div>
        <div class="product-price">$${product.price.toFixed(2)}</div>
        <div class="product-images-count">${product.images.length} images</div>
      </div>
      <div class="product-actions">
        <button class="btn-fill" data-product-id="${product.id}">Fill Form</button>
        <button class="btn-delete" data-product-id="${product.id}">Delete</button>
      </div>
    </div>
  `).join('');

  // Attach event listeners
  document.querySelectorAll('.btn-fill').forEach(btn => {
    btn.addEventListener('click', () => fillDepopForm(btn.dataset.productId));
  });

  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => deletePublishedProduct(btn.dataset.productId));
  });
}

/**
 * Fill Depop form with product data
 */
async function fillDepopForm(productId) {
  const result = await chrome.storage.local.get('publishedProducts');
  const products = result.publishedProducts || [];
  const product = products.find(p => p.id === productId);

  if (!product) {
    alert('Product not found');
    return;
  }

  // Load default settings for shipping price and brand
  const settings = await chrome.storage.local.get(['defaultShippingPrice', 'defaultBrand']);
  const shippingPrice = settings.defaultShippingPrice || '2.00';
  const brand = settings.defaultBrand || 'Other';

  // Get active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Send message to content script to fill the form
  chrome.tabs.sendMessage(tab.id, {
    action: 'fillDepopForm',
    product: {
      ...product,
      shippingPrice: shippingPrice,
      brand: brand
    }
  }, (response) => {
    if (chrome.runtime.lastError) {
      alert('Error: ' + chrome.runtime.lastError.message);
      return;
    }

    if (response && response.success) {
      alert('Form filled successfully!');
    } else {
      alert('Failed to fill form: ' + (response ? response.error : 'Unknown error'));
    }
  });
}

/**
 * Delete a published product
 */
async function deletePublishedProduct(productId) {
  if (!confirm('Delete this product from the list?')) {
    return;
  }

  const result = await chrome.storage.local.get('publishedProducts');
  let products = result.publishedProducts || [];

  // Remove product
  products = products.filter(p => p.id !== productId);

  // Save back to storage
  await chrome.storage.local.set({ publishedProducts: products });

  // Reload list
  await loadPublishedProducts();
}

function showStatus(elementId, message, type) {
  const statusDiv = document.getElementById(elementId);
  statusDiv.textContent = message;
  statusDiv.className = type;
  statusDiv.style.display = 'block';

  if (type === 'success') {
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }
}
