// Content script for auto-filling Depop listing form
// Runs on depop.com/products/create

console.log('Depop filler content script loaded');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fillDepopForm') {
    fillForm(request.product)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
});

/**
 * Click the "Other" shipping option to enable manual shipping price entry
 */
async function clickOtherShippingOption() {
  const shippingRadio = document.querySelector('input[data-testid="manual__shipping__input"]');

  if (!shippingRadio) {
    throw new Error('Other shipping radio button not found');
  }

  // Click the radio button
  shippingRadio.click();

  // Wait for UI to update
  await new Promise(resolve => setTimeout(resolve, 300));

  console.log('Clicked "Other" shipping option');
}

/**
 * Fill the Depop form with product data
 */
async function fillForm(product) {
  console.log('Filling Depop form with product:', product);

  try {
    // 0. Click "Other" shipping option FIRST
    await clickOtherShippingOption();

    // 1. Fill Description
    await fillDescription(product.description);

    // 2. Fill Price
    await fillPrice(product.price);

    // 3. Fill Shipping Price
    await fillShippingPrice(product.shippingPrice || '2.00');

    // 4. Fill Brand
    await fillBrand(product.brand || 'Other');

    // 5. Fill Condition (set to "Brand new")
    await fillCondition();

    // 6. Fill Category (AI-suggested category)
    if (product.category) {
      await fillCategory(product.category);
    }

    // 7. Fill Subcategory (AFTER category is filled)
    if (product.subcategory) {
      await fillSubcategory(product.subcategory);
    }

    // 8. Fill Size (AFTER subcategory, based on category)
    if (product.category) {
      await fillSize(product.category);
    }

    // 9. Fill Quantity (AFTER size)
    await fillQuantity();

    // 10. Upload Images
    await uploadImages(product.images);

    // 11. Toggle "Boost your listing" checkbox
    await toggleBoostListing();

    // 12. Click "Save as draft" button (FINAL STEP)
    await clickSaveAsDraft();

    console.log('Form filled successfully and saved as draft!');
  } catch (error) {
    console.error('Error filling form:', error);
    throw error;
  }
}

/**
 * Fill the description textarea
 */
async function fillDescription(description) {
  const descriptionTextarea = document.getElementById('description');

  if (!descriptionTextarea) {
    throw new Error('Description textarea not found');
  }

  // Set value
  descriptionTextarea.value = description;

  // Trigger events to notify React/Vue
  descriptionTextarea.dispatchEvent(new Event('input', { bubbles: true }));
  descriptionTextarea.dispatchEvent(new Event('change', { bubbles: true }));

  console.log('Description filled');
}

/**
 * Fill the price input
 */
async function fillPrice(price) {
  const priceInput = document.getElementById('priceAmount__input');

  if (!priceInput) {
    throw new Error('Price input not found');
  }

  // Set value
  priceInput.value = price.toFixed(2);

  // Trigger events
  priceInput.dispatchEvent(new Event('input', { bubbles: true }));
  priceInput.dispatchEvent(new Event('change', { bubbles: true }));

  console.log('Price filled:', price);
}

/**
 * Fill the shipping price input
 * @param {string} price - Shipping price (e.g., "2.00")
 */
async function fillShippingPrice(price = '2.00') {
  const shippingInput = document.getElementById('nationalShippingCost__input');

  if (!shippingInput) {
    throw new Error('Shipping price input not found');
  }

  // Set value
  shippingInput.value = price;

  // Trigger events
  shippingInput.dispatchEvent(new Event('input', { bubbles: true }));
  shippingInput.dispatchEvent(new Event('change', { bubbles: true }));

  console.log('Shipping price filled: $' + price);
}

/**
 * Fill the brand combobox
 * Types brand name to filter dropdown, then clicks the 3rd option
 * @param {string} brand - Brand name (e.g., "Other", "Nike")
 */
async function fillBrand(brand = 'Other') {
  const brandInput = document.getElementById('brand-input');

  if (!brandInput) {
    console.warn('Brand input not found, skipping...');
    return; // Don't throw error, just skip
  }

  // Step 1: Focus the input
  brandInput.focus();

  // Step 2: Type brand name to filter the dropdown
  brandInput.value = brand;

  // Step 3: Trigger input event to activate autocomplete filtering
  const inputEvent = new Event('input', { bubbles: true });
  brandInput.dispatchEvent(inputEvent);

  // Step 4: Wait for dropdown to populate with filtered results
  await new Promise(resolve => setTimeout(resolve, 800));

  // Step 5: Find the brand menu
  const brandMenu = document.getElementById('brand-menu');

  if (!brandMenu) {
    console.warn('Brand menu not found');
    return;
  }

  // Step 6: Get all options and select the 3rd one (index 2)
  const allOptions = brandMenu.querySelectorAll('[role="option"]');

  if (allOptions.length < 3) {
    console.warn('Not enough options found. Expected at least 3, found:', allOptions.length);
    brandInput.blur();
    return;
  }

  // Select the 3rd option (index 2) - this is "Other" after filtering
  const otherOption = allOptions[2];
  console.log('Selecting 3rd option:', otherOption.textContent.trim());

  // Scroll into view to ensure visibility
  otherOption.scrollIntoView({ behavior: 'instant', block: 'nearest' });
  await new Promise(resolve => setTimeout(resolve, 100));

  // Create and dispatch proper mouse events (MUI Autocomplete requires this)
  const mouseDownEvent = new MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
    view: window
  });

  const clickEvent = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    view: window
  });

  const mouseUpEvent = new MouseEvent('mouseup', {
    bubbles: true,
    cancelable: true,
    view: window
  });

  otherOption.dispatchEvent(mouseDownEvent);
  await new Promise(resolve => setTimeout(resolve, 50));

  otherOption.dispatchEvent(clickEvent);
  await new Promise(resolve => setTimeout(resolve, 50));

  otherOption.dispatchEvent(mouseUpEvent);

  // Additional delay for MUI to process the selection
  await new Promise(resolve => setTimeout(resolve, 200));

  console.log(`Brand filled: ${brand} (selected 3rd option)`);
}

/**
 * Fill the condition combobox with "Brand new"
 * Types "Brand new" to filter dropdown, then clicks the first option
 */
async function fillCondition() {
  const conditionInput = document.getElementById('condition-input');

  if (!conditionInput) {
    throw new Error('Condition input not found');
  }

  // Step 1: Focus the input
  conditionInput.focus();

  // Step 2: Type "Brand new" to filter
  conditionInput.value = 'Brand new';

  // Step 3: Trigger input event
  const inputEvent = new Event('input', { bubbles: true });
  conditionInput.dispatchEvent(inputEvent);

  // Step 4: Wait for dropdown to populate
  await new Promise(resolve => setTimeout(resolve, 800));

  // Step 5: Find the condition menu
  const conditionMenu = document.getElementById('condition-menu');

  if (!conditionMenu) {
    console.warn('Condition menu not found');
    return;
  }

  // Step 6: Find the option that contains "Brand new" (case-insensitive)
  const allOptions = conditionMenu.querySelectorAll('[role="option"]');
  let brandNewOption = null;

  for (const option of allOptions) {
    const text = option.textContent.trim().toLowerCase();
    if (text === 'brand new') {
      brandNewOption = option;
      console.log('Found "Brand new" option:', option.textContent.trim());
      break;
    }
  }

  if (brandNewOption) {
    // Scroll into view to ensure visibility
    brandNewOption.scrollIntoView({ behavior: 'instant', block: 'nearest' });
    await new Promise(resolve => setTimeout(resolve, 100));

    // Create and dispatch proper mouse events (MUI Autocomplete requires this)
    const mouseDownEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      view: window
    });

    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    });

    const mouseUpEvent = new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      view: window
    });

    brandNewOption.dispatchEvent(mouseDownEvent);
    await new Promise(resolve => setTimeout(resolve, 50));

    brandNewOption.dispatchEvent(clickEvent);
    await new Promise(resolve => setTimeout(resolve, 50));

    brandNewOption.dispatchEvent(mouseUpEvent);

    // Additional delay for MUI to process the selection
    await new Promise(resolve => setTimeout(resolve, 200));

    console.log('Condition filled: Brand new (clicked matching option)');
  } else {
    console.warn('Could not find "Brand new" in dropdown. Found options:',
      Array.from(allOptions).map(o => o.textContent.trim()).slice(0, 5));

    // Fallback: Just blur the input (sometimes accepts typed value)
    conditionInput.blur();
    console.log('Condition filled: Brand new (fallback - blur)');
  }
}

/**
 * Fill the category combobox
 * Types the category name to filter dropdown, then clicks the top option
 */
async function fillCategory(category) {
  const categoryInput = document.getElementById('group-input');

  if (!categoryInput) {
    console.warn('Category input not found, skipping...');
    return; // Don't throw error, just skip
  }

  // Step 1: Click the toggle button to open the dropdown
  const toggleButton = document.getElementById('group-toggle-button');

  if (toggleButton) {
    toggleButton.click();
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // Step 2: Focus the input
  categoryInput.focus();

  // Step 3: Type the category to filter
  categoryInput.value = category;

  // Step 4: Trigger input event to activate autocomplete filtering
  const inputEvent = new Event('input', { bubbles: true });
  categoryInput.dispatchEvent(inputEvent);

  // Step 5: Wait for dropdown to populate with filtered results
  await new Promise(resolve => setTimeout(resolve, 800));

  // Step 6: Find the category menu
  const categoryMenu = document.getElementById('group-menu');

  if (!categoryMenu) {
    console.warn('Category menu not found');
    return;
  }

  // Step 7: Get all options and select the top one (first option)
  const allOptions = categoryMenu.querySelectorAll('[role="option"]');

  if (allOptions.length === 0) {
    console.warn('No category options found');
    categoryInput.blur();
    return;
  }

  // Select the first option (top option after filtering)
  const topOption = allOptions[0];
  console.log('Selecting top option:', topOption.textContent.trim());

  // Scroll into view to ensure visibility
  topOption.scrollIntoView({ behavior: 'instant', block: 'nearest' });
  await new Promise(resolve => setTimeout(resolve, 100));

  // Create and dispatch proper mouse events (MUI Autocomplete requires this)
  const mouseDownEvent = new MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
    view: window
  });

  const clickEvent = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    view: window
  });

  const mouseUpEvent = new MouseEvent('mouseup', {
    bubbles: true,
    cancelable: true,
    view: window
  });

  topOption.dispatchEvent(mouseDownEvent);
  await new Promise(resolve => setTimeout(resolve, 50));

  topOption.dispatchEvent(clickEvent);
  await new Promise(resolve => setTimeout(resolve, 50));

  topOption.dispatchEvent(mouseUpEvent);

  // Additional delay for MUI to process the selection
  await new Promise(resolve => setTimeout(resolve, 200));

  console.log('Category filled:', category);
}

/**
 * Fill the subcategory/product type combobox
 * This field appears AFTER category is selected
 * @param {string} subcategory - Subcategory name (e.g., "T-shirts", "Jeans")
 */
async function fillSubcategory(subcategory) {
  const subcategoryInput = document.getElementById('productType-input');

  if (!subcategoryInput) {
    console.warn('Subcategory input not found, skipping...');
    return; // Don't throw error, just skip
  }

  // Step 1: Click the toggle button to open the dropdown
  const toggleButton = document.getElementById('productType-toggle-button');

  if (toggleButton) {
    toggleButton.click();
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // Step 2: Focus the input
  subcategoryInput.focus();

  // Step 3: Type the subcategory to filter
  subcategoryInput.value = subcategory;

  // Step 4: Trigger input event to activate autocomplete filtering
  const inputEvent = new Event('input', { bubbles: true });
  subcategoryInput.dispatchEvent(inputEvent);

  // Step 5: Wait for dropdown to populate with filtered results
  await new Promise(resolve => setTimeout(resolve, 800));

  // Step 6: Find the subcategory menu
  const subcategoryMenu = document.getElementById('productType-menu');

  if (!subcategoryMenu) {
    console.warn('Subcategory menu not found');
    return;
  }

  // Step 7: Get all options and select the top one (first option)
  const allOptions = subcategoryMenu.querySelectorAll('[role="option"]');

  if (allOptions.length === 0) {
    console.warn('No subcategory options found');
    subcategoryInput.blur();
    return;
  }

  // Select the first option (top option after filtering)
  const topOption = allOptions[0];
  console.log('Selecting top subcategory option:', topOption.textContent.trim());

  // Scroll into view to ensure visibility
  topOption.scrollIntoView({ behavior: 'instant', block: 'nearest' });
  await new Promise(resolve => setTimeout(resolve, 100));

  // Create and dispatch proper mouse events (MUI Autocomplete requires this)
  const mouseDownEvent = new MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
    view: window
  });

  const clickEvent = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    view: window
  });

  const mouseUpEvent = new MouseEvent('mouseup', {
    bubbles: true,
    cancelable: true,
    view: window
  });

  topOption.dispatchEvent(mouseDownEvent);
  await new Promise(resolve => setTimeout(resolve, 50));

  topOption.dispatchEvent(clickEvent);
  await new Promise(resolve => setTimeout(resolve, 50));

  topOption.dispatchEvent(mouseUpEvent);

  // Additional delay for MUI to process the selection
  await new Promise(resolve => setTimeout(resolve, 200));

  console.log('Subcategory filled:', subcategory);
}

/**
 * Fill the size dropdown
 * Types "M" for Men's categories or "S" for Women's categories,
 * then selects the top option
 * @param {string} category - The category name (e.g., "Men - Tops", "Women - Tops")
 */
async function fillSize(category) {
  const sizeInput = document.getElementById('variants-input');

  if (!sizeInput) {
    console.warn('Size input not found, skipping...');
    return;
  }

  // Determine size to type based on category
  const sizeToType = category.toLowerCase().startsWith('men') ? 'M' : 'S';

  // Step 1: Click the toggle button to open the dropdown
  const toggleButton = document.getElementById('variants-toggle-button');

  if (toggleButton) {
    toggleButton.click();
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // Step 2: Focus the input
  sizeInput.focus();

  // Step 3: Type the size to filter
  sizeInput.value = sizeToType;

  // Step 4: Trigger input event to activate autocomplete filtering
  const inputEvent = new Event('input', { bubbles: true });
  sizeInput.dispatchEvent(inputEvent);

  // Step 5: Wait for dropdown to populate with filtered results
  await new Promise(resolve => setTimeout(resolve, 800));

  // Step 6: Find the size menu
  const sizeMenu = document.getElementById('variants-menu');

  if (!sizeMenu) {
    console.warn('Size menu not found');
    return;
  }

  // Step 7: Get all options and select the appropriate one
  const allOptions = sizeMenu.querySelectorAll('[role="option"]');

  if (allOptions.length === 0) {
    console.warn('No size options found');
    sizeInput.blur();
    return;
  }

  // Select the appropriate option based on size
  // M (Men's): select 1st option (index 0)
  // S (Women's): select 4th option (index 3)
  const optionIndex = sizeToType === 'M' ? 0 : 3;

  if (allOptions.length <= optionIndex) {
    console.warn(`Not enough size options. Expected at least ${optionIndex + 1}, found: ${allOptions.length}`);
    sizeInput.blur();
    return;
  }

  const selectedOption = allOptions[optionIndex];
  console.log(`Selecting size option #${optionIndex + 1}:`, selectedOption.textContent.trim());

  // Scroll into view to ensure visibility
  selectedOption.scrollIntoView({ behavior: 'instant', block: 'nearest' });
  await new Promise(resolve => setTimeout(resolve, 100));

  // Create and dispatch proper mouse events
  const mouseDownEvent = new MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
    view: window
  });

  const clickEvent = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    view: window
  });

  const mouseUpEvent = new MouseEvent('mouseup', {
    bubbles: true,
    cancelable: true,
    view: window
  });

  selectedOption.dispatchEvent(mouseDownEvent);
  await new Promise(resolve => setTimeout(resolve, 50));

  selectedOption.dispatchEvent(clickEvent);
  await new Promise(resolve => setTimeout(resolve, 50));

  selectedOption.dispatchEvent(mouseUpEvent);

  // Additional delay for MUI to process the selection
  await new Promise(resolve => setTimeout(resolve, 200));

  console.log(`Size filled: ${sizeToType} (selected: ${selectedOption.textContent.trim()})`);
}

/**
 * Fill the quantity input with a random number between 10-20
 */
async function fillQuantity() {
  const quantityInput = document.getElementById('quantity__input');

  if (!quantityInput) {
    console.warn('Quantity input not found, skipping...');
    return;
  }

  // Generate random number between 10 and 20 (inclusive)
  const randomQuantity = Math.floor(Math.random() * 11) + 10;

  // Set value
  quantityInput.value = randomQuantity.toString();

  // Trigger events
  quantityInput.dispatchEvent(new Event('input', { bubbles: true }));
  quantityInput.dispatchEvent(new Event('change', { bubbles: true }));

  console.log('Quantity filled:', randomQuantity);
}

/**
 * Toggle the "Boost your listing" checkbox to promote the item
 */
async function toggleBoostListing() {
  // Find the boost listing checkbox
  const boostCheckbox = document.querySelector('input[data-testid="switch"][type="checkbox"]');

  if (!boostCheckbox) {
    console.warn('Boost listing checkbox not found, skipping...');
    return;
  }

  // Check if already checked
  if (boostCheckbox.checked) {
    console.log('Boost listing already enabled, skipping...');
    return;
  }

  // Scroll into view
  boostCheckbox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await new Promise(resolve => setTimeout(resolve, 300));

  // Click the checkbox to enable boost
  boostCheckbox.click();

  // Wait for toggle animation
  await new Promise(resolve => setTimeout(resolve, 300));

  console.log('Boost listing enabled');
}

/**
 * Click the "Save as draft" button to save the listing
 */
async function clickSaveAsDraft() {
  // Wait for all previous operations to complete
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Find the "Save as draft" button
  const saveButton = Array.from(document.querySelectorAll('button[type="submit"]'))
    .find(btn => btn.textContent.includes('Save as a draft'));

  if (!saveButton) {
    throw new Error('Save as draft button not found');
  }

  // Scroll into view to ensure visibility
  saveButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await new Promise(resolve => setTimeout(resolve, 500));

  // Click the button
  saveButton.click();

  console.log('Clicked "Save as draft" button');
}

/**
 * Upload images to the file input
 */
async function uploadImages(imageDataUrls) {
  const fileInput = document.getElementById('upload-input__input');

  if (!fileInput) {
    throw new Error('File input not found');
  }

  // Limit to 8 images (Depop max)
  const imagesToUpload = imageDataUrls.slice(0, 8);

  // Convert data URLs to File objects
  const files = await Promise.all(
    imagesToUpload.map((dataUrl, index) => dataURLtoFile(dataUrl, `image-${index + 1}.jpg`))
  );

  // Create DataTransfer to set files
  const dataTransfer = new DataTransfer();
  files.forEach(file => dataTransfer.items.add(file));

  // Set files to input
  fileInput.files = dataTransfer.files;

  // Trigger change event
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));

  console.log(`Uploaded ${files.length} images`);

  // Wait for images to load and process (important: prevents saving before images are ready)
  // Depop needs time to process and display the uploaded images
  await new Promise(resolve => setTimeout(resolve, 3000));
  console.log('Images loaded and ready');
}

/**
 * Convert data URL to File object
 */
async function dataURLtoFile(dataUrl, filename) {
  // Fetch the data URL as a blob
  const res = await fetch(dataUrl);
  const blob = await res.blob();

  // Create File from blob
  return new File([blob], filename, { type: blob.type || 'image/jpeg' });
}
