// Content script - runs on Shein and AliExpress product pages

/**
 * Convert shekel (ILS/NIS) prices to USD
 * Conversion rate: 1 ILS ≈ 0.27 USD (as of 2025)
 */
function convertShekelToUSD(priceString) {
  // Check if price is in shekels
  const isShekel = priceString.includes('₪') ||
                   priceString.includes('ILS') ||
                   priceString.includes('NIS') ||
                   priceString.includes('שח'); // Hebrew shekel symbol

  if (!isShekel) {
    return priceString; // Return as-is if not shekel
  }

  // Extract numeric value
  const numericMatch = priceString.match(/[\d,]+\.?\d*/);
  if (!numericMatch) {
    return priceString; // Can't parse, return original
  }

  const shekelAmount = parseFloat(numericMatch[0].replace(/,/g, ''));

  // Convert to USD (1 ILS ≈ 0.27 USD)
  const usdAmount = shekelAmount * 0.27;

  console.log(`💱 Converted ${shekelAmount} ILS to $${usdAmount.toFixed(2)} USD`);

  return `$${usdAmount.toFixed(2)}`;
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractProductData') {
    extractProductData()
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
});

// Site detection
function isSheinSite() {
  return window.location.href.includes('shein.com');
}

function isAliExpressSite() {
  return window.location.href.includes('aliexpress.com') || window.location.href.includes('aliexpress.us');
}

function isGrailedSite() {
  return window.location.href.includes('grailed.com');
}

// Main extraction router
async function extractProductData() {
  console.log('Detecting site...');

  if (isSheinSite()) {
    console.log('Detected: Shein');
    return await extractSheinData();
  } else if (isAliExpressSite()) {
    console.log('Detected: AliExpress');
    return await extractAliExpressData();
  } else if (isGrailedSite()) {
    console.log('Detected: Grailed');
    return await extractGrailedData();
  } else {
    throw new Error('Unsupported site. Please use this extension on Shein, AliExpress, or Grailed product pages.');
  }
}

// Shein extraction function
async function extractSheinData() {
  const data = {
    images: [],
    productName: '',
    url: window.location.href,
    price: null,
    originalPrice: null,
    discount: null,
    sku: null,
    rating: null,
    reviews: null,
    sizes: [],
    colors: [],
    description: null,
    inStock: true
  };

  // Extract product name from fsp-element span
  const titleElement = document.querySelector('h1.product-intro__head-name .fsp-element') ||
                       document.querySelector('h1.product-intro__head-name') ||
                       document.querySelector('h1');
  data.productName = titleElement ? titleElement.textContent.trim() : 'unknown_product';

  // Extract price
  const priceElement = document.querySelector('#productMainPriceId .productPrice__main, .productPrice__main');
  if (priceElement) {
    const rawPrice = priceElement.textContent.trim().replace(/\s+/g, '');
    data.price = convertShekelToUSD(rawPrice);
  }

  // Extract original price (before discount)
  const originalPriceElement = document.querySelector('.productEstimatedTagNewRetail__retail');
  if (originalPriceElement) {
    const rawOriginalPrice = originalPriceElement.textContent.trim();
    data.originalPrice = convertShekelToUSD(rawOriginalPrice);
  }

  // Extract discount percentage
  const discountElement = document.querySelector('.productEstimatedTagNew__percent');
  if (discountElement) {
    data.discount = discountElement.textContent.trim();
  }

  // Extract SKU
  const skuElement = document.querySelector('.product-intro__head-sku-text');
  if (skuElement) {
    data.sku = skuElement.textContent.replace('SKU:', '').trim();
  }

  // Extract rating
  const ratingContainer = document.querySelector('.common-rate');
  if (ratingContainer) {
    const ratingText = ratingContainer.getAttribute('aria-label') || '';
    const ratingMatch = ratingText.match(/(\d+\.\d+)/);
    if (ratingMatch) {
      data.rating = ratingMatch[1];
    }
  }

  // Extract review count
  const reviewsElement = document.querySelector('.product-intro__head-reviews-text');
  if (reviewsElement) {
    const reviewsText = reviewsElement.textContent;
    const reviewsMatch = reviewsText.match(/(\d+[\d,]*)\+?\s*Reviews?/i);
    if (reviewsMatch) {
      data.reviews = reviewsMatch[1].replace(/,/g, '');
    }
  }

  // Extract available sizes
  const sizeElements = document.querySelectorAll('.product-intro__size-radio');
  sizeElements.forEach(sizeEl => {
    const sizeName = sizeEl.getAttribute('data-attr_value_name') || sizeEl.textContent.trim();
    if (sizeName && !sizeEl.classList.contains('disabled')) {
      data.sizes.push(sizeName);
    }
  });

  // Extract colors
  const colorElements = document.querySelectorAll('.main-sales-attr__color .radio-container');
  colorElements.forEach(colorEl => {
    const colorImg = colorEl.querySelector('img');
    if (colorImg) {
      const colorName = colorImg.getAttribute('alt') || '';
      if (colorName) {
        data.colors.push(colorName);
      }
    }
  });

  // Extract description
  const descElement = document.querySelector('.out-points__container, .product-intro__description');
  if (descElement) {
    data.description = descElement.textContent.trim();
  }

  // Check if in stock (look for disabled add to cart button)
  const addToCartBtn = document.querySelector('#ProductDetailAddBtn, .add-cart-basebtn');
  if (addToCartBtn) {
    data.inStock = !addToCartBtn.disabled && !addToCartBtn.classList.contains('disabled');
  }

  // Enhanced image extraction with multiple fallback methods
  const uniqueImages = new Set();

  console.log('Starting image extraction...');

  // Method 1: Original selector - crop-image-container with data-before-crop-src
  const imageContainers = document.querySelectorAll('.main-picture .crop-image-container');
  console.log(`Method 1: Found ${imageContainers.length} crop-image-container elements`);

  imageContainers.forEach(container => {
    const imageUrl = container.getAttribute('data-before-crop-src');
    if (imageUrl) {
      let fullUrl = imageUrl.startsWith('//') ? 'https:' + imageUrl : imageUrl;
      fullUrl = fullUrl.replace(/_thumbnail_\d+x\d+/g, '').replace(/_\d+x\d+/g, '');
      uniqueImages.add(fullUrl);
      console.log('Method 1 - Added image:', fullUrl.substring(0, 80) + '...');
    }
  });

  // Method 2: Look for img tags in product image containers
  const productImages = document.querySelectorAll('.main-picture img, .product-intro__main-img img, .goods-img-container img');
  console.log(`Method 2: Found ${productImages.length} img elements in product containers`);

  productImages.forEach(img => {
    const sources = [
      img.src,
      img.getAttribute('data-src'),
      img.getAttribute('data-original'),
      img.getAttribute('data-lazy-src')
    ].filter(Boolean);

    sources.forEach(src => {
      if (src && (src.includes('img.ltwebstatic.com') || src.includes('images'))) {
        let fullUrl = src.startsWith('//') ? 'https:' + src : src;
        fullUrl = fullUrl.replace(/_thumbnail_\d+x\d+/g, '').replace(/_\d+x\d+/g, '');
        uniqueImages.add(fullUrl);
        console.log('Method 2 - Added image:', fullUrl.substring(0, 80) + '...');
      }
    });
  });

  // Method 3: Look for picture elements with source tags (for webp)
  const pictureElements = document.querySelectorAll('.main-picture picture, .product-intro__main-img picture');
  console.log(`Method 3: Found ${pictureElements.length} picture elements`);

  pictureElements.forEach(picture => {
    const sources = picture.querySelectorAll('source');
    sources.forEach(source => {
      const srcset = source.getAttribute('srcset');
      if (srcset) {
        // Extract URLs from srcset (can contain multiple URLs with sizes)
        const urls = srcset.split(',').map(s => s.trim().split(' ')[0]);
        urls.forEach(url => {
          if (url && (url.includes('img.ltwebstatic.com') || url.includes('images'))) {
            let fullUrl = url.startsWith('//') ? 'https:' + url : url;
            fullUrl = fullUrl.replace(/_thumbnail_\d+x\d+/g, '').replace(/_\d+x\d+/g, '');
            uniqueImages.add(fullUrl);
            console.log('Method 3 - Added image:', fullUrl.substring(0, 80) + '...');
          }
        });
      }
    });
  });

  // Method 4: Look for any large product images by class name patterns
  const allProductImgs = document.querySelectorAll('[class*="product"][class*="img"] img, [class*="goods-img"] img');
  console.log(`Method 4: Found ${allProductImgs.length} images with product/goods class patterns`);

  allProductImgs.forEach(img => {
    if (img.src && (img.src.includes('img.ltwebstatic.com') || img.src.includes('images3_pi'))) {
      let fullUrl = img.src.startsWith('//') ? 'https:' + img.src : img.src;
      fullUrl = fullUrl.replace(/_thumbnail_\d+x\d+/g, '').replace(/_\d+x\d+/g, '');
      uniqueImages.add(fullUrl);
      console.log('Method 4 - Added image:', fullUrl.substring(0, 80) + '...');
    }
  });

  data.images = Array.from(uniqueImages);

  console.log(`Total unique images found: ${data.images.length}`);
  console.log('All image URLs:', data.images);

  if (data.images.length === 0) {
    throw new Error('No product images found on this page. Please check console logs for details.');
  }

  console.log(`Successfully extracted ${data.images.length} product images from Shein`);
  return data;
}

// AliExpress extraction function
async function extractAliExpressData() {
  const data = {
    images: [],
    productName: '',
    url: window.location.href,
    price: null,
    originalPrice: null,
    discount: null,
    sku: null,
    rating: null,
    reviews: null,
    sizes: [],
    colors: [],
    description: null,
    inStock: true
  };

  // Extract product name
  const titleElement = document.querySelector('.title--wrap--UUHae_g h1');
  data.productName = titleElement ? titleElement.textContent.trim() : 'unknown_product';

  // Extract price
  const priceElement = document.querySelector('.price-default--current--F8OlYIo');
  if (priceElement) {
    const rawPrice = priceElement.textContent.trim();
    data.price = convertShekelToUSD(rawPrice);
  }

  // Extract original price
  const originalPriceElement = document.querySelector('.price-default--original--CWcHOit bdi');
  if (originalPriceElement) {
    const rawOriginalPrice = originalPriceElement.textContent.trim();
    data.originalPrice = convertShekelToUSD(rawOriginalPrice);
  }

  // Calculate discount if both prices exist
  if (data.price && data.originalPrice) {
    const priceNum = parseFloat(data.price.replace(/[^0-9.]/g, ''));
    const originalNum = parseFloat(data.originalPrice.replace(/[^0-9.]/g, ''));
    if (priceNum && originalNum) {
      const discountPercent = Math.round(((originalNum - priceNum) / originalNum) * 100);
      data.discount = `-${discountPercent}%`;
    }
  }

  // Extract rating
  const ratingElement = document.querySelector('.reviewer--rating--xrWWFzx strong');
  if (ratingElement) {
    data.rating = ratingElement.textContent.trim();
  }

  // Extract review count
  const reviewsElement = document.querySelector('.reviewer--reviews--cx7Zs_V');
  if (reviewsElement) {
    const reviewsText = reviewsElement.textContent;
    const reviewsMatch = reviewsText.match(/(\d+)/);
    if (reviewsMatch) {
      data.reviews = reviewsMatch[1];
    }
  }

  // Extract colors from SKU section
  const colorElements = document.querySelectorAll('.sku-item--skus--StEhULs[data-sku-row="14"] img[alt]');
  colorElements.forEach(img => {
    const colorName = img.getAttribute('alt');
    if (colorName && !data.colors.includes(colorName)) {
      data.colors.push(colorName);
    }
  });

  // Extract sizes from SKU section
  const sizeElements = document.querySelectorAll('.sku-item--skus--StEhULs[data-sku-row="5"] .sku-item--text--hYfAukP span');
  sizeElements.forEach(sizeEl => {
    const sizeName = sizeEl.textContent.trim();
    if (sizeName) {
      data.sizes.push(sizeName);
    }
  });

  // Extract images
  console.log('Starting AliExpress image extraction...');
  const uniqueImages = new Set();

  // Method 1: Get images from slider
  const sliderImages = document.querySelectorAll('.slider--img--kD4mIg7 img[src]');
  console.log(`Method 1: Found ${sliderImages.length} slider images`);

  sliderImages.forEach(img => {
    let imageUrl = img.src;
    if (imageUrl) {
      // AliExpress URLs are like: filename.jpg_220x220q75.jpg_.avif
      // We need to remove EVERYTHING after the first extension

      // Remove size suffixes like _220x220q75.jpg_.avif or _220x220.jpg_ or .avif or .webp
      imageUrl = imageUrl.replace(/_\d+x\d+q\d+\.(jpg|png|jpeg)_\.(avif|webp)$/i, '');
      imageUrl = imageUrl.replace(/_\d+x\d+\.(jpg|png|jpeg)_$/i, '');
      imageUrl = imageUrl.replace(/\.(avif|webp)$/i, '');

      // Remove trailing underscores
      imageUrl = imageUrl.replace(/_+$/i, '');

      // Ensure https
      if (imageUrl.startsWith('//')) {
        imageUrl = 'https:' + imageUrl;
      }

      uniqueImages.add(imageUrl);
      console.log('Method 1 - Added image:', imageUrl.substring(0, 80) + '...');
    }
  });

  // Method 2: Get main preview image (higher resolution)
  const previewImage = document.querySelector('.magnifier--image--RM17RL2[src]');
  if (previewImage) {
    let imageUrl = previewImage.src;

    // Clean the URL the same way
    imageUrl = imageUrl.replace(/_\d+x\d+q\d+\.(jpg|png|jpeg)_\.(avif|webp)$/i, '');
    imageUrl = imageUrl.replace(/_\d+x\d+\.(jpg|png|jpeg)_$/i, '');
    imageUrl = imageUrl.replace(/\.(avif|webp)$/i, '');
    imageUrl = imageUrl.replace(/_+$/i, '');

    if (imageUrl.startsWith('//')) {
      imageUrl = 'https:' + imageUrl;
    }
    uniqueImages.add(imageUrl);
    console.log('Method 2 - Added main preview image:', imageUrl.substring(0, 80) + '...');
  }

  data.images = Array.from(uniqueImages);

  console.log(`Total unique images found: ${data.images.length}`);
  console.log('All image URLs:', data.images);

  if (data.images.length === 0) {
    throw new Error('No product images found on this AliExpress page. Please check console logs for details.');
  }

  console.log(`Successfully extracted ${data.images.length} product images from AliExpress`);
  return data;
}

// Grailed extraction function
async function extractGrailedData() {
  const data = {
    images: [],
    productName: '',
    url: window.location.href,
    price: null,
    originalPrice: null,
    discount: null,
    sku: null,
    rating: null,
    reviews: null,
    sizes: [],
    colors: [],
    description: null,
    inStock: true,
    // Grailed-specific fields
    designers: [],
    condition: null,
    location: null,
    category: null
  };

  console.log('Starting Grailed product data extraction...');

  // Extract product name/title
  const titleElement = document.querySelector('.Details_title__8rdLK, .Callout_callout__Fv1vZ.Details_detail__7xjgu');
  if (titleElement) {
    data.productName = titleElement.textContent.trim();
    console.log('Product name:', data.productName);
  }

  // Extract designers/brands
  const designerLinks = document.querySelectorAll('.Details_designers__AG6hs a, .Designers_designer__Mbyk_');
  if (designerLinks.length > 0) {
    data.designers = Array.from(designerLinks).map(link => link.textContent.trim()).filter(d => d);
    console.log('Designers:', data.designers);
  }

  // Extract price - use specific selector to avoid grabbing from similar listings
  const priceElement = document.querySelector('.MainContent_sidebar__sxv7j .Sidebar_price__bHp8z .Money_root__uOwWV[data-testid="Current"], .Sidebar_sidebar__U94dz .Sidebar_price__bHp8z .Money_root__uOwWV');
  if (priceElement) {
    const rawPrice = priceElement.textContent.trim();
    data.price = convertShekelToUSD(rawPrice);
    console.log('Price:', data.price);
  }

  // Extract size and condition (combined in one element)
  const sizeConditionElement = document.querySelector('.Details_sizeAndCondition__6fZlO');
  if (sizeConditionElement) {
    const text = sizeConditionElement.textContent.trim();
    // Split by the bullet separator (•)
    const parts = text.split('•').map(p => p.trim());
    if (parts.length > 0) {
      data.sizes = [parts[0]]; // Size is the first part
      console.log('Size:', data.sizes[0]);
    }
    if (parts.length > 1) {
      data.condition = parts[1]; // Condition is the second part
      console.log('Condition:', data.condition);
    }
  }

  // Extract location
  const locationElement = document.querySelector('.Details_location__l5MTo .Details_value__XcEpo');
  if (locationElement) {
    data.location = locationElement.textContent.trim();
    console.log('Location:', data.location);
  }

  // Extract color - use specific selector to avoid grabbing from similar listings
  const colorElement = document.querySelector('.MainContent_sidebar__sxv7j .ColorAndStyle_colorBlock__XxLD6 img, .Sidebar_sidebar__U94dz .ColorAndStyle_colorBlock__XxLD6 img');
  if (colorElement) {
    const colorName = colorElement.getAttribute('alt');
    if (colorName) {
      data.colors = [colorName];
      console.log('Color:', colorName);
    }
  } else {
    // Try alternative selector for color name
    const colorNameElement = document.querySelector('.MainContent_sidebar__sxv7j .ColorAndStyle_colorName__SLY3t, .Sidebar_sidebar__U94dz .ColorAndStyle_colorName__SLY3t');
    if (colorNameElement) {
      data.colors = [colorNameElement.textContent.trim()];
      console.log('Color:', data.colors[0]);
    }
  }

  // Extract category/style - use specific selector to avoid grabbing from similar listings
  const styleElement = document.querySelector('.MainContent_sidebar__sxv7j .ColorAndStyle_displayStyles__A_Bu_[data-testid="Style"], .Sidebar_sidebar__U94dz .ColorAndStyle_displayStyles__A_Bu_[data-testid="Style"]');
  if (styleElement) {
    data.category = styleElement.textContent.trim();
    console.log('Category/Style:', data.category);
  }

  // Extract description - use specific selector to avoid grabbing from similar listings
  const descriptionParagraphs = document.querySelectorAll('.MainContent_sidebar__sxv7j .Description_paragraph___3KJY, .Sidebar_sidebar__U94dz .Description_paragraph___3KJY, .ListingDetails_collapsibleDetails__dU_dH .Description_paragraph___3KJY');
  if (descriptionParagraphs.length > 0) {
    data.description = Array.from(descriptionParagraphs)
      .map(p => p.textContent.trim())
      .filter(text => text)
      .join('\n\n');
    console.log('Description:', data.description);
  }

  // Extract stock status
  const purchaseButton = document.querySelector('[data-cy="purchase_button"], .ListingActions_action__qncH0');
  if (purchaseButton) {
    const buttonText = purchaseButton.textContent.trim().toLowerCase();
    data.inStock = !buttonText.includes('sold') && !purchaseButton.hasAttribute('disabled');
    console.log('In stock:', data.inStock);
  }

  // Extract seller rating (optional)
  const ratingElement = document.querySelector('.SellerScore_sellerScore__993Kl');
  if (ratingElement) {
    const ratingText = ratingElement.textContent.trim();
    const ratingMatch = ratingText.match(/(\d+)\s*Reviews?/i);
    if (ratingMatch) {
      data.reviews = ratingMatch[1];
      console.log('Reviews count:', data.reviews);
    }
  }

  // Extract images
  console.log('Extracting product images...');
  const uniqueImages = new Set();

  // Method 1: Extract from thumbnail buttons
  const thumbnails = document.querySelectorAll('.Thumbnails_thumbnail__HR2PM');
  console.log(`Found ${thumbnails.length} thumbnail images`);

  thumbnails.forEach((thumbnail, index) => {
    const srcset = thumbnail.getAttribute('srcset');
    if (srcset) {
      // Get the highest quality image from srcset
      const srcsetParts = srcset.split(',').map(s => s.trim());
      if (srcsetParts.length > 0) {
        // Get the 2x version (second item) for better quality, or fallback to first
        const highQualityPart = srcsetParts[srcsetParts.length > 1 ? 1 : 0];
        let imageUrl = highQualityPart.split(' ')[0];

        // Remove query parameters to get base URL, then add high quality parameter
        const baseUrl = imageUrl.split('?')[0];
        imageUrl = `${baseUrl}?w=3500`; // Request highest quality

        uniqueImages.add(imageUrl);
        console.log(`Method 1 - Added thumbnail ${index + 1}:`, imageUrl.substring(0, 80) + '...');
      }
    }

    // Fallback: try src attribute
    const src = thumbnail.getAttribute('src');
    if (src && !srcset) {
      const baseUrl = src.split('?')[0];
      const imageUrl = `${baseUrl}?w=3500`;
      uniqueImages.add(imageUrl);
      console.log(`Method 1 (fallback) - Added thumbnail ${index + 1}:`, imageUrl.substring(0, 80) + '...');
    }
  });

  // Method 2: Extract from main photo gallery
  const mainPhotos = document.querySelectorAll('.Photo_picture__S6EfC, .PhotoGallery_photoGallery__FVCc6 img');
  console.log(`Found ${mainPhotos.length} main photo elements`);

  mainPhotos.forEach((photo, index) => {
    const srcset = photo.getAttribute('srcset');
    if (srcset) {
      // Get the highest quality image from srcset
      const srcsetParts = srcset.split(',').map(s => s.trim());
      // Get the last (highest resolution) image
      const highestQuality = srcsetParts[srcsetParts.length - 1];
      let imageUrl = highestQuality.split(' ')[0];

      // Remove query parameters and request highest quality
      const baseUrl = imageUrl.split('?')[0];
      imageUrl = `${baseUrl}?w=3500`;

      uniqueImages.add(imageUrl);
      console.log(`Method 2 - Added main photo ${index + 1}:`, imageUrl.substring(0, 80) + '...');
    }

    // Fallback: try src attribute
    const src = photo.getAttribute('src');
    if (src && !srcset) {
      const baseUrl = src.split('?')[0];
      const imageUrl = `${baseUrl}?w=3500`;
      uniqueImages.add(imageUrl);
      console.log(`Method 2 (fallback) - Added main photo ${index + 1}:`, imageUrl.substring(0, 80) + '...');
    }
  });

  // Method 3: Fallback - generic image search
  if (uniqueImages.size === 0) {
    console.log('No images found with specific selectors, trying generic search...');
    const allImages = document.querySelectorAll('img[src*="media-assets.grailed.com"], img[srcset*="media-assets.grailed.com"]');
    console.log(`Found ${allImages.length} images via generic search`);

    allImages.forEach((img, index) => {
      const srcset = img.getAttribute('srcset');
      const src = img.getAttribute('src');

      if (srcset) {
        const srcsetParts = srcset.split(',').map(s => s.trim());
        const highestQuality = srcsetParts[srcsetParts.length - 1];
        let imageUrl = highestQuality.split(' ')[0];
        const baseUrl = imageUrl.split('?')[0];
        imageUrl = `${baseUrl}?w=3500`;
        uniqueImages.add(imageUrl);
        console.log(`Method 3 - Added generic image ${index + 1}:`, imageUrl.substring(0, 80) + '...');
      } else if (src && src.includes('media-assets.grailed.com')) {
        const baseUrl = src.split('?')[0];
        const imageUrl = `${baseUrl}?w=3500`;
        uniqueImages.add(imageUrl);
        console.log(`Method 3 (fallback) - Added generic image ${index + 1}:`, imageUrl.substring(0, 80) + '...');
      }
    });
  }

  data.images = Array.from(uniqueImages);

  console.log(`Total unique images found: ${data.images.length}`);
  console.log('All image URLs:', data.images);

  if (data.images.length === 0) {
    throw new Error('No product images found on this Grailed page. Please check console logs for details.');
  }

  console.log(`Successfully extracted ${data.images.length} product images from Grailed`);
  return data;
}
