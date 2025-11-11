// Background service worker with OpenRouter AI integration

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startScrape') {
    handleScrape(request.tabId, request.transformationSettings)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }

  if (request.action === 'remixImage') {
    remixImageWithFlux(request.imageUrl, request.prompt, request.apiKey)
      .then(dataUrl => sendResponse({ success: true, dataUrl }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }

  if (request.action === 'transformSingleImage') {
    transformSingleImageWithAI(
      request.imageUrl,
      request.imageIndex,
      request.allImages,
      request.productData,
      request.productSeed,
      request.userPrompt,
      request.replicateApiKey
    )
      .then(dataUrl => sendResponse({ success: true, dataUrl }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }

  if (request.action === 'transformWithVision') {
    transformWithVision(
      request.imageUrl,
      request.view,
      request.cardText,
      request.productName,
      request.productLink,
      request.productSeed,
      request.openRouterApiKey,
      request.replicateApiKey
    )
      .then(result => sendResponse({
        success: true,
        dataUrl: result.dataUrl,
        aiDescription: result.aiDescription
      }))
      .catch(error => sendResponse({
        success: false,
        error: error.message
      }));
    return true; // Keep channel open for async response
  }

  if (request.action === 'transformRemainingImages') {
    transformRemainingImagesWithFlux(request.imageUrls, request.prompt, request.apiKey)
      .then(dataUrls => sendResponse({ success: true, dataUrls }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }

  if (request.action === 'suggestCategory') {
    suggestCategoryWithAI(request.productName, request.description, request.apiKey)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message, category: 'Women - Tops' }));
    return true; // Keep channel open for async response
  }
});

async function handleScrape(tabId, transformationSettings = {}) {
  try {
    // Step 1: Extract product data from page
    const productDataResponse = await chrome.tabs.sendMessage(tabId, {
      action: 'extractProductData'
    });

    if (!productDataResponse.success) {
      throw new Error(productDataResponse.error);
    }

    const productData = productDataResponse.data;

    // Step 2: Take screenshot
    const screenshotDataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: 'png'
    });

    // Step 3: Generate AI-enhanced description with OpenRouter (if API key configured)
    let aiEnhanced = null;
    let aiError = null;

    try {
      const { openRouterApiKey } = await chrome.storage.sync.get('openRouterApiKey');
      if (openRouterApiKey) {
        console.log('OpenRouter API key found, generating AI description...');
        aiEnhanced = await analyzeProductWithOpenRouter(productData, screenshotDataUrl, openRouterApiKey);
        console.log('✓ AI enhancement complete');
      } else {
        console.log('No OpenRouter API key configured, skipping AI enhancement');
      }
    } catch (error) {
      console.error('AI enhancement error:', error);
      aiError = error.message;
    }

    // Step 4: Generate product-level seed for consistent transformations
    // All transformations for this product will use the same seed
    const productSeed = Math.floor(Math.random() * 1000000);
    console.log(`Generated product seed: ${productSeed} (will be used for all transformations of this product)`);

    // Step 5: Prepare data for results page
    const resultsData = {
      ...productData,
      aiEnhanced: aiEnhanced,
      aiError: aiError,
      productSeed: productSeed,
      transformationSettings: transformationSettings,
      scrapedAt: new Date().toISOString(),
      screenshot: screenshotDataUrl
    };

    // Save to storage so results page can access it
    try {
      await chrome.storage.local.set({ latestScrapeResults: resultsData });

      // Log storage size for debugging
      const dataSize = JSON.stringify(resultsData).length;
      const dataSizeMB = (dataSize / (1024 * 1024)).toFixed(2);
      console.log(`✓ Stored ${dataSizeMB} MB in chrome.storage.local`);

      if (dataSize > 9 * 1024 * 1024) { // Warn if over 9MB (close to 10MB limit)
        console.warn('⚠️ Storage size approaching 10MB limit');
      }
    } catch (storageError) {
      console.error('Storage error:', storageError);
      if (storageError.message && storageError.message.includes('QUOTA')) {
        throw new Error('Storage quota exceeded. Try disabling image transformation or contact support if the issue persists.');
      }
      throw storageError;
    }

    // Open results page in new tab
    const resultsUrl = chrome.runtime.getURL('results.html');
    await chrome.tabs.create({ url: resultsUrl });

    return { message: 'Results page opened successfully' };

  } catch (error) {
    console.error('Scraping error:', error);
    throw error;
  }
}

/**
 * Transform a single image with user's custom prompt
 * Uses the product's consistent seed for all transformations
 */
async function transformSingleImageWithAI(imageUrl, imageIndex, allImages, productData, productSeed, userPrompt, replicateApiKey) {
  console.log(`=== Transforming single image ${imageIndex + 1} ===`);
  console.log(`Using product seed: ${productSeed}`);

  // Use the user's custom prompt directly
  const finalPrompt = `${userPrompt}, keeping the exact clothing design, colors, patterns, and text identical to the original.`;
  console.log(`Using prompt: "${finalPrompt}"`);

  // Transform with FLUX using the user's prompt and product seed
  console.log('Transforming with FLUX...');
  const transformedDataUrl = await replicateFluxKontextPro(
    imageUrl,
    replicateApiKey,
    finalPrompt,
    productSeed  // Use product seed for consistency
  );

  console.log('=== Transformation complete ===');
  return transformedDataUrl;
}

/**
 * Analyze product with OpenRouter AI to generate enhanced description
 */
async function analyzeProductWithOpenRouter(productData, screenshotDataUrl, apiKey) {
  // Limit images to max 10 to avoid API overload
  const maxImages = Math.min(productData.images.length, 10);
  const imagesToSend = productData.images.slice(0, maxImages);

  // Create image list with IDs for AI to reference
  const imageList = imagesToSend.map((url, index) => `Image ${index + 1}`).join(', ');

  // Build the message content array
  const content = [
    {
      type: "text",
      text: `You are an e-commerce product listing expert. Analyze the provided images and data to enhance this product listing.

PRODUCT DATA:
- Name: ${productData.productName}
- Colors: ${productData.colors?.join(', ') || 'N/A'}
- Sizes: ${productData.sizes?.join(', ') || 'N/A'}
- Price: ${productData.price || 'N/A'}
- Current Description: ${productData.description || 'N/A'}

TASKS:
1. IMAGE SELECTION: I will show you ${imagesToSend.length} product images numbered as: ${imageList}

   Select the best 3-6 images that clearly show the product:
   - REMOVE DUPLICATES: If multiple images look identical or nearly identical, choose only ONE
   - Different angles/views are good, but exact duplicates must be excluded
   - High quality, clear product visibility
   - No blurry or low-quality images

   IMPORTANT: Return ONLY the image numbers (e.g., [1, 3, 5, 7]). Do NOT return URLs or any other text.

2. DESCRIPTION: Write a simple, direct product description:
   - DO NOT mention any brand names (ROMWE, SHEIN, etc.)
   - Rephrase the product name in a natural, simple way (1 sentence max)
   - Keep it straightforward - just describe what the item is without flowery language
   - End with: "🖤 All sizes available on request"
   - Then add exactly 5 hashtags at the very end (e.g., #streetwear #goth #y2k #grunge #fashion)

   Example format:
   "Vintage-style rhinestone graphic t-shirt with retro design. 🖤 All sizes available on request #y2k #vintagefashion #streetwear #alternative #graphictee"

3. KEYWORDS: Generate 8-12 SEO-friendly comma-separated keywords (e.g., "graphic tee, streetwear, round neck, short sleeve, urban style")

RESPOND ONLY WITH VALID JSON IN THIS EXACT FORMAT (no markdown, no code blocks):
{
  "selectedImageIds": [1, 3, 5],
  "description": "Your description with hashtags at the end",
  "keywords": "keyword1, keyword2, keyword3, keyword4"
}

CRITICAL: For selectedImageIds, return an array of numbers only (the image numbers I show you).`
    },
    // Add screenshot first
    {
      type: "image_url",
      image_url: { url: screenshotDataUrl }
    }
  ];

  // Add product images (already limited in imagesToSend)
  imagesToSend.forEach(imageUrl => {
    content.push({
      type: "image_url",
      image_url: { url: imageUrl }
    });
  });

  if (productData.images.length > imagesToSend.length) {
    console.log(`Note: Limited to ${imagesToSend.length} images (out of ${productData.images.length}) to avoid API overload`);
  }

  const requestBody = {
    model: "openai/gpt-4o-mini",
    messages: [{ role: "user", content: content }],
    temperature: 0.7,
    max_tokens: 2000
  };

  // Call API with retry logic
  const response = await callOpenRouterWithRetry(requestBody, apiKey);

  // Parse response
  const aiResponseText = response.choices[0].message.content;

  let aiResult;
  try {
    aiResult = JSON.parse(aiResponseText);
  } catch (parseError) {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = aiResponseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                      aiResponseText.match(/```\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      aiResult = JSON.parse(jsonMatch[1]);
    } else {
      throw new Error('Failed to parse AI response as JSON');
    }
  }

  // IMPORTANT: Map image IDs back to actual URLs
  if (aiResult.selectedImageIds && Array.isArray(aiResult.selectedImageIds)) {
    console.log('AI selected image IDs:', aiResult.selectedImageIds);

    // Convert IDs to actual URLs
    const selectedImages = aiResult.selectedImageIds
      .map(id => {
        // IDs are 1-based (Image 1, Image 2, etc.), convert to 0-based array index
        const index = id - 1;
        if (index >= 0 && index < productData.images.length) {
          const url = productData.images[index];

          // Validate URL is from supported CDN (Shein, AliExpress, or Grailed)
          const isValidUrl = url && (
            url.includes('img.ltwebstatic.com') ||
            url.includes('sheimg.com') ||
            url.includes('shein.com') ||
            url.includes('aliexpress-media.com') ||
            url.includes('ae-pic-a1.aliexpress-media.com') ||
            url.includes('alicdn.com') ||
            url.includes('media-assets.grailed.com')
          );

          if (!isValidUrl) {
            console.warn(`  ⚠️ Invalid URL detected: ${url}`);
            return null;
          }

          console.log(`  Mapping Image ${id} → ${url.substring(0, 60)}...`);
          return url;
        } else {
          console.warn(`  ⚠️ AI returned invalid image ID: ${id} (we only have ${productData.images.length} images)`);
          return null;
        }
      })
      .filter(url => url !== null); // Remove any invalid IDs or URLs

    // If AI returned valid IDs, use those. Otherwise fall back to original images
    if (selectedImages.length === 0) {
      console.warn('⚠️ No valid images after ID mapping. Using original scraped images as fallback.');
      aiResult.selectedImages = productData.images.slice(0, 6);
    } else {
      console.log(`✓ Successfully mapped ${selectedImages.length} image IDs to URLs`);
      aiResult.selectedImages = selectedImages;
    }
  } else {
    // No image IDs returned, use all original images
    console.warn('⚠️ AI did not return selectedImageIds field. Using all scraped images.');
    aiResult.selectedImages = productData.images.slice(0, 6);
  }

  return aiResult;
}

/**
 * Call OpenRouter API with retry logic
 */
async function callOpenRouterWithRetry(requestData, apiKey, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": chrome.runtime.getURL(''),
          "X-Title": "Shein Product Scraper"
        },
        body: JSON.stringify(requestData),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Handle rate limiting
      if (response.status === 429) {
        const waitTime = Math.min(2000 * Math.pow(2, attempt - 1), 10000);
        console.log(`Rate limited, waiting ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      // Handle errors
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // Try to get detailed error message
        let errorMsg = errorData.error?.message ||
                      errorData.error?.code ||
                      errorData.message ||
                      `HTTP ${response.status}: ${response.statusText}`;

        // Log full error for debugging
        console.error('OpenRouter API error details:', errorData);

        throw new Error(errorMsg);
      }

      return await response.json();

    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error.message);

      if (attempt === maxRetries) {
        throw new Error(`OpenRouter API failed after ${maxRetries} attempts: ${error.message}`);
      }

      const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

/**
 * Get Replicate API key from storage
 */
async function getReplicateApiKey() {
  const result = await chrome.storage.sync.get('replicateApiKey');
  if (!result.replicateApiKey) {
    throw new Error('Replicate API key not configured');
  }
  return result.replicateApiKey;
}

// ============================================================================
// VISION.JS INTEGRATION - Clothing Categories & Helper Functions
// ============================================================================

const CLOTHING_CATEGORIES = {
  "tops": ["t-shirt", "shirt", "blouse", "tank_top", "crop_top",
           "polo_shirt", "henley", "tunic", "camisole", "bodysuit"],
  "sweaters": ["sweater", "pullover", "cardigan", "hoodie", "sweatshirt",
               "turtleneck", "knit_top", "fleece"],
  "outerwear": ["jacket", "coat", "blazer", "suit_jacket", "parka",
                "bomber_jacket", "denim_jacket", "leather_jacket",
                "trench_coat", "peacoat", "windbreaker", "puffer_jacket",
                "raincoat", "vest"],
  "dresses": ["dress", "maxi_dress", "midi_dress", "mini_dress",
              "cocktail_dress", "evening_gown", "sundress", "shirt_dress",
              "wrap_dress", "bodycon_dress", "a-line_dress"],
  "bottoms": ["pants", "jeans", "trousers", "chinos", "leggings",
              "joggers", "cargo_pants", "dress_pants", "sweatpants",
              "culottes", "palazzo_pants"],
  "skirts": ["skirt", "mini_skirt", "midi_skirt", "maxi_skirt",
             "pencil_skirt", "a-line_skirt", "pleated_skirt", "wrap_skirt"],
  "shorts": ["shorts", "bermuda_shorts", "denim_shorts", "athletic_shorts",
             "cargo_shorts", "dress_shorts"],
  "activewear": ["sports_bra", "athletic_top", "gym_shorts", "yoga_pants",
                 "tracksuit", "athletic_leggings", "sports_jacket"],
  "swimwear": ["swimsuit", "bikini", "one_piece_swimsuit", "swim_trunks",
               "boardshorts", "rash_guard"],
  "suits": ["suit", "two_piece_suit", "three_piece_suit", "tuxedo"],
  "jumpsuits": ["jumpsuit", "romper", "playsuit", "overalls"]
};

// Depop category list (limited to 4 main categories)
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

/**
 * Download image and convert to base64 (browser version)
 */
async function downloadAndConvertImage(imageUrl) {
  console.log('  → Downloading image...');
  const response = await fetch(imageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }

  const blob = await response.blob();

  // Convert blob to base64
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      const base64Data = dataUrl.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  console.log('  → Image converted to base64');
  return { base64, mimeType: 'image/jpeg' };
}

/**
 * STAGE 1: Analyze clothing with user's view confirmation (vision.js)
 */
async function analyzeClothingWithVision(imageUrl, productName, productLink, userView, apiKey) {
  console.log('\n' + '='.repeat(60));
  console.log('🔍 STAGE 1: Detailed Analysis');
  console.log('='.repeat(60));

  try {
    const { base64, mimeType } = await downloadAndConvertImage(imageUrl);

    const categoriesStr = JSON.stringify(CLOTHING_CATEGORIES, null, 2);

    const prompt = `You are an expert clothing analyzer. Analyze this image with HIGH REASONING capability.

**PRODUCT INFORMATION:**
- Product Name: ${productName}
- Product Link: ${productLink}
- View: ${userView} (confirmed by user)

**CLOTHING CATEGORIES:**
${categoriesStr}

**YOUR ANALYSIS TASK:**
Use deep reasoning to:
1. Carefully examine the image and identify the exact clothing item
2. Compare with the product name to verify accuracy
3. The user has confirmed this is the ${userView.toUpperCase()} view of the garment
4. Analyze patterns, style, and features in detail
5. Cross-reference with product name to ensure accuracy
6. Provide reasoning for your conclusions

**CRITICAL OUTPUT REQUIREMENTS:**
- Output ONLY valid JSON, nothing else
- No markdown, no code blocks, no backticks
- Be precise and confident in your analysis
- Use "${userView}" as the view in your output

**JSON OUTPUT FORMAT:**
{
  "item_type": "specific type (e.g., t-shirt, hoodie, dress, pants)",
  "category": "main category from the list above",
  "view": "${userView}",
  "confidence": 0.0 to 1.0,
  "details": {
    "pattern": "solid/striped/printed/graphic/etc",
    "style": "casual/formal/sporty/streetwear/etc",
    "sleeve_length": "sleeveless/short/long/three-quarter" (if applicable),
    "fit_type": "regular/slim/oversized/loose" (if visible),
    "notable_features": ["feature1", "feature2", "feature3"],
    "material_appearance": "cotton/denim/synthetic/knit/etc" (if visible)
  },
  "reasoning": {
    "item_identification": "why you classified it as this specific item type",
    "confidence_factors": "what makes you confident or uncertain",
    "view_note": "observations consistent with ${userView} view"
  },
  "product_name_match": "does the image match the product name? explain briefly"
}

USE HIGH REASONING. BE THOROUGH. OUTPUT ONLY JSON.`;

    console.log('  → Calling vision model...');

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': chrome.runtime.getURL(''),
        'X-Title': 'Shein Product Scraper - Vision Analysis'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4.5',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: base64
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }],
        max_tokens: 2000,
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    const result = await response.json();
    let content = result.choices[0].message.content.trim();

    // Clean markdown if present
    if (content.startsWith('```')) {
      const lines = content.split('\n');
      content = lines.filter(line => !line.startsWith('```')).join('\n').trim();
    }

    const classification = JSON.parse(content);

    console.log('  ✅ Stage 1 complete!');
    console.log('Classification:', JSON.stringify(classification, null, 2));

    return {
      success: true,
      classification,
      imageUrl,
      productName,
      productLink
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      imageUrl
    };
  }
}

/**
 * STAGE 2: Generate natural description (vision.js)
 */
async function generateNaturalDescription(stage1Result, apiKey) {
  console.log('\n' + '='.repeat(60));
  console.log('📝 STAGE 2: Generating Natural Description');
  console.log('='.repeat(60));

  if (!stage1Result.success) {
    return {
      success: false,
      error: 'Stage 1 failed, cannot proceed to Stage 2'
    };
  }

  try {
    const { classification, productName } = stage1Result;

    const prompt = `Based on the detailed analysis below, generate ONE concise sentence describing this clothing item.

**PRODUCT NAME:** ${productName}

**DETAILED ANALYSIS:**
${JSON.stringify(classification, null, 2)}

**YOUR TASK:**
Write ONE SINGLE SENTENCE in this exact format:
"This is the [front/back] side of a [item type] [with key features]."

**REQUIREMENTS:**
- MUST be ONE sentence only (no multiple sentences)
- MUST start with "This is the front side of" or "This is the back side of"
- Include 1-2 key distinguishing features (patterns, prints, style elements - NOT colors)
- DO NOT mention any colors
- Keep it under 25 words
- Be natural and conversational

**EXAMPLES:**
- "This is the front side of a striped one-shoulder long-sleeved t-shirt with angel heart print."
- "This is the back side of a hoodie with plain design."
- "This is the front side of denim jeans with distressed detailing and rhinestone embellishments."

Output ONLY the single sentence, nothing else:`;

    console.log('  → Generating description...');

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': chrome.runtime.getURL(''),
        'X-Title': 'Shein Product Scraper - Vision Description'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4.5',
        messages: [{
          role: 'user',
          content: prompt
        }],
        max_tokens: 100,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    const result = await response.json();
    let description = result.choices[0].message.content.trim();

    // Remove quotes and ensure single line
    description = description.replace(/^["']|["']$/g, '');
    description = description.replace(/\s+/g, ' ');

    console.log('  ✅ Stage 2 complete!');
    console.log(`Description: "${description}"`);

    return {
      success: true,
      description,
      detailedAnalysis: classification,
      productName,
      productLink: stage1Result.productLink,
      imageUrl: stage1Result.imageUrl
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * STAGE 3: Complete vision.js transform pipeline
 * Combines all 3 stages: Analyze → Describe → Transform
 */
async function transformWithVision(imageUrl, view, cardText, productName, productLink, productSeed, openRouterApiKey, replicateApiKey) {
  console.log('\n🚀 ' + '='.repeat(56));
  console.log('🚀 Starting Vision.js Transform Pipeline');
  console.log('🚀 ' + '='.repeat(56));
  console.log(`View: ${view}, Card Text: "${cardText}"`);
  console.log(`Product: ${productName}`);

  // Stage 1: Analyze clothing
  const stage1 = await analyzeClothingWithVision(imageUrl, productName, productLink, view, openRouterApiKey);

  if (!stage1.success) {
    console.log(`\n❌ Stage 1 failed: ${stage1.error}`);
    throw new Error(`Analysis failed: ${stage1.error}`);
  }

  // Stage 2: Generate description
  const stage2 = await generateNaturalDescription(stage1, openRouterApiKey);

  if (!stage2.success) {
    console.log(`\n❌ Stage 2 failed: ${stage2.error}`);
    throw new Error(`Description generation failed: ${stage2.error}`);
  }

  const aiDescription = stage2.description;
  console.log(`\n✨ AI Description: "${aiDescription}"`);

  // Stage 3: Transform with FLUX (EXACT prompt from vision.js line 362)
  console.log('\n🎨 Stage 3: Transforming with FLUX...');
  const prompt = `Keep the clothing item exactly as it is without any changes - this is the same product shown from different angles. Make these changes on: ${aiDescription}. Place it on a soft, unmade white bed with natural wrinkles in the sheets. Add natural warm daylight from a window, realistic shadows and folds. Casual phone photo aesthetic. Include a standard 3x5 inch (3 inches by 5 inches) white index card with "${cardText}" written clearly in black sharpie marker. The card should have distinct edges and the handwriting should be neat and fully legible. Only change the background and staging, preserve the clothing completely. Maintain consistent lighting and bed styling across all photos.`;

  console.log('FLUX Prompt:', prompt);

  const transformedDataUrl = await replicateFluxKontextPro(
    imageUrl,
    replicateApiKey,
    prompt,
    productSeed
  );

  console.log('\n' + '='.repeat(60));
  console.log('🎉 Vision.js Transform Complete!');
  console.log('='.repeat(60));

  return {
    dataUrl: transformedDataUrl,
    aiDescription: aiDescription
  };
}

/**
 * Suggest category using AI (Claude Sonnet 4.5)
 * @param {string} productName - Name of the product
 * @param {string} description - Product description
 * @param {string} apiKey - OpenRouter API key
 * @returns {Promise<{success: boolean, category: string, error?: string}>}
 */
async function suggestCategoryWithAI(productName, description, apiKey) {
  console.log('\n🏷️ Suggesting category with AI...');
  console.log(`Product: ${productName}`);
  console.log(`Description: ${description.substring(0, 100)}...`);

  // Build subcategories list for prompt
  const subcategoriesText = Object.entries(DEPOP_SUBCATEGORIES)
    .map(([cat, subs]) => `${cat}: [${subs.join(', ')}]`)
    .join('\n');

  const prompt = `You are an expert at categorizing clothing and fashion products for Depop listings.

Based on the product name and description below, select:
1. The MOST APPROPRIATE category
2. The MOST APPROPRIATE subcategory for that category

**PRODUCT NAME:** ${productName}

**DESCRIPTION:** ${description}

**AVAILABLE CATEGORIES AND SUBCATEGORIES:**
${subcategoriesText}

**INSTRUCTIONS:**
- Analyze the product name and description carefully
- Choose ONE category and ONE subcategory that best fits the product
- Return ONLY a JSON object with both values
- Example response: {"category": "Women - Tops", "subcategory": "T-shirts"}

**IMPORTANT:**
- You MUST select from the categories and subcategories listed above (do not make up categories)
- Use exact names (case-sensitive)
- Choose the most specific subcategory that matches the product
- Default to "Women - " categories if gender is unclear (women's fashion is most common)`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': chrome.runtime.getURL(''),
        'X-Title': 'Depop Extension'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4.5',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    console.log('AI Response:', content);

    const parsed = JSON.parse(content);
    const suggestedCategory = parsed.category;
    const suggestedSubcategory = parsed.subcategory;

    // Validate category
    if (!DEPOP_CATEGORIES.includes(suggestedCategory)) {
      console.warn(`⚠️ AI suggested invalid category: "${suggestedCategory}"`);
      console.warn('Defaulting to "Women - Tops" / "T-shirts"');
      return { success: true, category: 'Women - Tops', subcategory: 'T-shirts' };
    }

    // Validate subcategory
    const validSubcategories = DEPOP_SUBCATEGORIES[suggestedCategory] || [];
    if (!validSubcategories.includes(suggestedSubcategory)) {
      console.warn(`⚠️ AI suggested invalid subcategory: "${suggestedSubcategory}"`);
      console.warn(`Defaulting to first subcategory: ${validSubcategories[0]}`);
      return {
        success: true,
        category: suggestedCategory,
        subcategory: validSubcategories[0] || 'Other'
      };
    }

    console.log(`✓ Suggested category: ${suggestedCategory}`);
    console.log(`✓ Suggested subcategory: ${suggestedSubcategory}`);
    return { success: true, category: suggestedCategory, subcategory: suggestedSubcategory };

  } catch (error) {
    console.error('❌ Category suggestion failed:', error);
    return { success: false, error: error.message, category: 'Women - Tops', subcategory: 'T-shirts' };
  }
}

/**
 * Transform images with Replicate FLUX.1 Kontext Pro
 * - Preserves clothing exactly as is
 * - Places on bed with natural lighting
 * - Returns array of transformed image data URLs
 */
async function transformImagesWithReplicate(imageUrls, settings, apiKey, productDescription = null) {
  const transformedImages = [];

  console.log(`Starting FLUX.1 Kontext Pro transformation of ${imageUrls.length} images`);
  console.log(`  🎲 Using different random seed for EACH image transformation`);
  if (productDescription) {
    console.log(`  AI Product Description: "${productDescription}"`);
  }
  imageUrls.forEach((url, index) => {
    console.log(`  Image ${index + 1}: ${url.substring(0, 80)}...`);
  });

  for (let i = 0; i < imageUrls.length; i++) {
    console.log(`\nTransforming image ${i + 1}/${imageUrls.length}...`);

    // Generate unique random seed for EACH image transformation
    const imageSeed = Math.floor(Math.random() * 1000000);
    console.log(`  🎲 Image ${i + 1} seed: ${imageSeed}`);

    try {
      const currentImage = imageUrls[i];

      // Only transform if bed scene staging is enabled
      if (settings.addBedScene) {
        console.log(`  🎨 Applying FLUX.1 Kontext Pro transformation...`);
        const transformedUrl = await replicateFluxKontextPro(currentImage, apiKey, productDescription, imageSeed);

        // Verify we got a valid data URL
        if (transformedUrl.startsWith('data:image/')) {
          console.log(`  ✓ Image ${i + 1} transformed successfully`);
          transformedImages.push(transformedUrl);
        } else {
          console.warn(`  ⚠ Transformation returned unexpected format, using original`);
          transformedImages.push(currentImage);
        }
      } else {
        console.log(`  ℹ Bed scene disabled, using original image`);
        transformedImages.push(currentImage);
      }

    } catch (error) {
      console.error(`  ✗ Failed to transform image ${i + 1}:`, error.message);
      console.error(`     Error details:`, error);
      console.error(`     Original image URL:`, imageUrls[i]);
      // On error, keep the original image
      transformedImages.push(imageUrls[i]);
    }
  }

  console.log(`\n✅ Transformation complete: ${transformedImages.length} images processed`);
  return transformedImages;
}

/**
 * Transform image using Replicate FLUX.1 Kontext Pro
 * Preserves clothing exactly, changes background to bed scene
 */
async function replicateFluxKontextPro(imageUrl, apiKey, productDescription = null, seed = null) {
  // Get custom prompt from storage, or use default
  const { fluxPrompt } = await chrome.storage.local.get('fluxPrompt');
  const userPrompt = fluxPrompt || "Keep the clothing item exactly as it is without any changes. Place it on a soft, unmade white bed with natural wrinkles in the sheets. Add natural warm daylight from a window, realistic shadows and folds. Casual phone photo aesthetic. Only change the background and staging, preserve the clothing completely.";

  // Combine AI product description with user's custom prompt
  // Use "This item is..." structure to establish description as reference context
  let finalPrompt;
  if (productDescription) {
    finalPrompt = `This item is ${productDescription}. ${userPrompt}, keeping the exact clothing design, colors, patterns, and text identical to the original.`;
    console.log('  📝 Combined prompt:', finalPrompt);
  } else {
    finalPrompt = userPrompt;
    console.log('  📝 Using custom prompt only (no AI description available)');
  }

  console.log('  📤 Creating Replicate prediction...');
  if (seed) {
    console.log(`  🎲 Using seed: ${seed}`);
  }

  // Step 1: Create prediction
  const createResponse = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: "0f1178f5a27e9aa2d2d39c8a43c110f7fa7cbf64062ff04a04cd40899e546065",
      input: {
        prompt: finalPrompt,
        input_image: imageUrl,
        seed: seed,
        num_outputs: 1,
        aspect_ratio: "1:1",
        output_format: "jpg",
        output_quality: 80
      }
    })
  });

  if (!createResponse.ok) {
    const error = await createResponse.text();
    throw new Error(`Replicate API error: ${createResponse.status} - ${error}`);
  }

  const prediction = await createResponse.json();
  console.log(`  ✓ Prediction created: ${prediction.id}`);

  // Step 2: Poll for results (max 2 minutes)
  let result = prediction;
  const maxAttempts = 120;
  let attempt = 0;

  while ((result.status === 'starting' || result.status === 'processing') && attempt < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    attempt++;

    const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: {
        'Authorization': `Token ${apiKey}`,
      }
    });

    result = await pollResponse.json();
    if (attempt % 5 === 0) {
      console.log(`  ⏳ Status: ${result.status}... (${attempt}s elapsed)`);
    }
  }

  if (result.status === 'succeeded') {
    console.log(`  🎉 Generation succeeded!`);

    // Get the output image URL
    const outputUrl = Array.isArray(result.output) ? result.output[0] : result.output;

    // Fetch the image and convert to base64
    const imageResponse = await fetch(outputUrl);
    const blob = await imageResponse.blob();
    const dataUrl = await blobToBase64(blob);

    const sizeKB = Math.round(dataUrl.length / 1024);
    console.log(`  📦 Transformed image size: ${sizeKB} KB`);

    return dataUrl;
  } else {
    console.error(`  ❌ Generation failed with status: ${result.status}`);
    if (result.error) {
      console.error(`  Error details:`, result.error);
    }
    throw new Error(`Replicate generation failed: ${result.status}${result.error ? ' - ' + result.error : ''}`);
  }
}

/**
 * Convert blob to base64 data URL
 */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Remix a single image with FLUX (called from results page via message passing)
 */
async function remixImageWithFlux(imageUrl, prompt, apiKey) {
  console.log('🎨 Starting image remix with FLUX...');
  console.log('  Prompt:', prompt);

  // Generate random seed for variation
  const seed = Math.floor(Math.random() * 1000000);
  console.log(`  🎲 Using seed: ${seed}`);

  // Step 1: Create prediction
  const createResponse = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: "0f1178f5a27e9aa2d2d39c8a43c110f7fa7cbf64062ff04a04cd40899e546065",
      input: {
        prompt: prompt,
        input_image: imageUrl,
        seed: seed,
        num_outputs: 1,
        aspect_ratio: "1:1",
        output_format: "jpg",
        output_quality: 80
      }
    })
  });

  if (!createResponse.ok) {
    const error = await createResponse.text();
    throw new Error(`Replicate API error: ${createResponse.status} - ${error}`);
  }

  const prediction = await createResponse.json();
  const predictionId = prediction.id;
  console.log(`  ✓ Prediction created: ${predictionId}`);

  // Step 2: Poll for completion
  let attempts = 0;
  const maxAttempts = 120; // 2 minutes timeout

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

    const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: {
        'Authorization': `Token ${apiKey}`,
      }
    });

    if (!statusResponse.ok) {
      throw new Error(`Failed to check prediction status: ${statusResponse.status}`);
    }

    const status = await statusResponse.json();

    if (status.status === 'succeeded') {
      console.log('  🎉 Remix succeeded!');

      // Get the output image URL
      const outputUrl = status.output[0];

      // Convert to data URL for storage
      const imageResponse = await fetch(outputUrl);
      const blob = await imageResponse.blob();
      const dataUrl = await blobToBase64(blob);

      const sizeKB = Math.round(dataUrl.length / 1024);
      console.log(`  📦 Remixed image size: ${sizeKB} KB`);

      return dataUrl;

    } else if (status.status === 'failed') {
      throw new Error(status.error || 'FLUX prediction failed');
    }

    attempts++;
    if (attempts % 5 === 0) {
      console.log(`  ⏳ Processing... (${attempts}s elapsed)`);
    }
  }

  throw new Error('Remix timeout - please try again');
}

/**
 * Transform multiple images with FLUX (called from results page via message passing)
 */
async function transformRemainingImagesWithFlux(imageUrls, prompt, apiKey) {
  console.log(`🎨 Starting transformation of ${imageUrls.length} images...`);
  console.log('  Prompt:', prompt);

  // Generate consistent seed for all images
  const sessionSeed = Math.floor(Math.random() * 1000000);
  console.log(`  🎲 Using session seed: ${sessionSeed}`);

  const transformedImages = [];

  for (let i = 0; i < imageUrls.length; i++) {
    console.log(`\nTransforming image ${i + 1}/${imageUrls.length}...`);

    try {
      // Step 1: Create prediction
      const createResponse = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: "0f1178f5a27e9aa2d2d39c8a43c110f7fa7cbf64062ff04a04cd40899e546065",
          input: {
            prompt: prompt,
            input_image: imageUrls[i],
            seed: sessionSeed,
            num_outputs: 1,
            aspect_ratio: "1:1",
            output_format: "jpg",
            output_quality: 80
          }
        })
      });

      if (!createResponse.ok) {
        const error = await createResponse.text();
        throw new Error(`Replicate API error: ${createResponse.status} - ${error}`);
      }

      const prediction = await createResponse.json();
      const predictionId = prediction.id;
      console.log(`  ✓ Prediction created: ${predictionId}`);

      // Step 2: Poll for completion
      let attempts = 0;
      const maxAttempts = 120;

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));

        const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
          headers: {
            'Authorization': `Token ${apiKey}`,
          }
        });

        if (!statusResponse.ok) {
          throw new Error(`Failed to check prediction status: ${statusResponse.status}`);
        }

        const status = await statusResponse.json();

        if (status.status === 'succeeded') {
          console.log(`  ✓ Image ${i + 1} transformed successfully`);

          const outputUrl = status.output[0];
          const imageResponse = await fetch(outputUrl);
          const blob = await imageResponse.blob();
          const dataUrl = await blobToBase64(blob);

          transformedImages.push(dataUrl);
          break;

        } else if (status.status === 'failed') {
          throw new Error(status.error || 'FLUX prediction failed');
        }

        attempts++;
      }

      if (attempts >= maxAttempts) {
        throw new Error('Transformation timeout');
      }

    } catch (error) {
      console.error(`  ✗ Failed to transform image ${i + 1}:`, error.message);
      // Keep original image on error
      transformedImages.push(imageUrls[i]);
    }
  }

  console.log(`\n✅ Transformation complete: ${transformedImages.length} images processed`);
  return transformedImages;
}

