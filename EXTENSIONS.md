# 🔌 Extensions Guide

How to extend the Art Gallery Scraper to work with Google Maps and Yelp.

## 🗺️ Google Maps Extension

### Overview

Google Maps requires different selectors and scrolling behavior to load results dynamically.

### Implementation

Add this handler to `main.js` in the `requestHandler` function:

```javascript
// ═══════════════════════════════════════════════════════════════
// STAGE: GOOGLE MAPS LISTING
// ═══════════════════════════════════════════════════════════════

else if (label === 'GOOGLE_MAPS') {
    log.info('🗺️ Processing Google Maps search results...');
    
    // Wait for results to load
    await page.waitForSelector('[role="feed"]', { timeout: 15000 });
    
    // Scroll to load more results
    const scrollContainer = await page.$('[role="feed"]');
    if (scrollContainer) {
        await autoScroll(page, scrollContainer);
    }
    
    // Extract gallery listings
    const galleries = await page.$$eval('[role="article"]', (articles) => {
        return articles.map(article => {
            // Extract name
            const nameEl = article.querySelector('[role="heading"]');
            const name = nameEl ? nameEl.textContent.trim() : '';
            
            // Extract phone
            const phoneEl = article.querySelector('[data-tooltip="Copy phone number"]');
            const phone = phoneEl ? phoneEl.getAttribute('aria-label')?.replace('Phone: ', '') : '';
            
            // Extract website
            const websiteEl = article.querySelector('a[data-tooltip="Open website"]');
            const website = websiteEl ? websiteEl.href : '';
            
            // Extract address
            const addressEl = article.querySelector('[data-tooltip="Copy address"]');
            const location = addressEl ? addressEl.getAttribute('aria-label')?.replace('Address: ', '') : '';
            
            return {
                name,
                phone,
                website,
                location
            };
        }).filter(g => g.name && (g.phone || g.website));
    });
    
    log.info(`Found ${galleries.length} galleries on Google Maps`);
    stats.galleriesFound += galleries.length;
    
    // Process each gallery
    for (const gallery of galleries) {
        const domain = gallery.website ? getDomain(gallery.website) : null;
        
        // If has website and not processed, crawl it
        if (domain && gallery.website && !processedDomains.has(domain)) {
            processedDomains.add(domain);
            
            await crawler.addRequests([{
                url: gallery.website,
                userData: {
                    label: 'GALLERY_HOME',
                    galleryData: {
                        galleryName: gallery.name,
                        website: gallery.website,
                        location: gallery.location,
                        sourceUrl: url,
                        emails: [],
                        phoneNumbers: gallery.phone ? [gallery.phone] : []
                    }
                }
            }]);
        } else {
            // No website, save direct contact info
            await dataset.pushData({
                galleryName: gallery.name,
                website: gallery.website || '',
                emails: [],
                phoneNumbers: gallery.phone ? [gallery.phone] : [],
                location: gallery.location,
                sourceUrl: url,
                scrapedAt: new Date().toISOString()
            });
        }
    }
    
    // Try to load more results (click "Next" button if exists)
    try {
        const nextButton = await page.$('button[aria-label*="Next"]');
        if (nextButton) {
            await nextButton.click();
            await page.waitForTimeout(2000);
            
            // Re-enqueue the same search with updated results
            await crawler.addRequests([{
                url: url,
                userData: { label: 'GOOGLE_MAPS' }
            }]);
        }
    } catch (e) {
        log.info('No more pages to load');
    }
}
```

### Helper Function: Auto Scroll

Add this utility function before `Actor.main()`:

```javascript
/**
 * Auto-scroll a container to load all results
 */
async function autoScroll(page, scrollableElement) {
    await page.evaluate(async (element) => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
                const scrollHeight = element.scrollHeight;
                element.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    }, scrollableElement);
}
```

### Input Configuration

```json
{
  "startUrls": [
    { 
      "url": "https://www.google.com/maps/search/art+galleries+in+new+york",
      "userData": { "label": "GOOGLE_MAPS" }
    },
    { 
      "url": "https://www.google.com/maps/search/art+galleries+in+los+angeles",
      "userData": { "label": "GOOGLE_MAPS" }
    }
  ],
  "maxPagesPerCrawl": 500,
  "maxConcurrency": 3
}
```

### Tips for Google Maps

1. **Rate Limiting**: Google Maps heavily rate-limits. Use lower concurrency (2-3)
2. **Scrolling**: Results load dynamically, scrolling is crucial
3. **Captchas**: May appear. Use Apify Proxy to rotate IPs
4. **Data Quality**: Google Maps data is more accurate but limited

---

## 📱 Yelp Extension

### Overview

Yelp has a different structure. This extension handles both search listings and individual business pages.

### Implementation

Add these handlers to `main.js`:

```javascript
// ═══════════════════════════════════════════════════════════════
// STAGE: YELP LISTING
// ═══════════════════════════════════════════════════════════════

else if (label === 'YELP_LISTING') {
    log.info('📱 Processing Yelp search results...');
    
    await page.waitForSelector('[data-testid="serp-ia-card"]', { timeout: 10000 });
    
    // Extract business cards
    const businesses = await page.$$eval('[data-testid="serp-ia-card"]', (cards) => {
        return cards.map(card => {
            const nameEl = card.querySelector('h3 a');
            const name = nameEl ? nameEl.textContent.trim() : '';
            const detailUrl = nameEl ? nameEl.href : '';
            
            const phoneEl = card.querySelector('[href^="tel:"]');
            const phone = phoneEl ? phoneEl.textContent.trim() : '';
            
            const addressEl = card.querySelector('[data-font-weight="semibold"]');
            const location = addressEl ? addressEl.textContent.trim() : '';
            
            return {
                name,
                detailUrl,
                phone,
                location
            };
        }).filter(b => b.name && b.detailUrl);
    });
    
    log.info(`Found ${businesses.length} businesses on Yelp`);
    stats.galleriesFound += businesses.length;
    
    // Enqueue each business detail page
    for (const business of businesses) {
        await crawler.addRequests([{
            url: business.detailUrl,
            userData: {
                label: 'YELP_DETAIL',
                galleryData: {
                    galleryName: business.name,
                    website: '',
                    location: business.location,
                    sourceUrl: url,
                    emails: [],
                    phoneNumbers: business.phone ? [business.phone] : []
                }
            }
        }]);
    }
    
    // Check for pagination
    await enqueueLinks({
        selector: 'a[aria-label*="Next"]',
        label: 'YELP_LISTING',
        limit: 10
    });
}

// ═══════════════════════════════════════════════════════════════
// STAGE: YELP DETAIL PAGE
// ═══════════════════════════════════════════════════════════════

else if (label === 'YELP_DETAIL') {
    log.info(`📱 Processing Yelp detail page: ${galleryData.galleryName}`);
    stats.galleriesProcessed++;
    
    // Extract website
    try {
        const websiteLink = await page.$('a[href*="/biz_redir"]');
        if (websiteLink) {
            const website = await page.evaluate(el => el.href, websiteLink);
            galleryData.website = website;
        }
    } catch (e) {
        log.info('No website found');
    }
    
    // Extract additional phone numbers
    try {
        const phones = await page.$$eval('a[href^="tel:"]', (links) => {
            return links.map(link => link.textContent.trim());
        });
        galleryData.phoneNumbers.push(...phones);
    } catch (e) {
        log.info('No additional phones');
    }
    
    // Extract full address
    try {
        const address = await page.$eval('[data-testid="business-address"]', el => el.textContent.trim());
        galleryData.location = address;
    } catch (e) {
        log.info('Address not found');
    }
    
    // If website exists, crawl it for emails
    if (galleryData.website && !galleryData.website.includes('yelp.com')) {
        const domain = getDomain(galleryData.website);
        if (domain && !processedDomains.has(domain)) {
            processedDomains.add(domain);
            
            await crawler.addRequests([{
                url: galleryData.website,
                userData: {
                    label: 'GALLERY_HOME',
                    galleryData: { ...galleryData }
                }
            }]);
        }
    } else {
        // Save Yelp data directly
        await saveGalleryData(galleryData, dataset, stats);
    }
}
```

### Input Configuration

```json
{
  "startUrls": [
    { 
      "url": "https://www.yelp.com/search?find_desc=Art+Galleries&find_loc=New+York%2C+NY",
      "userData": { "label": "YELP_LISTING" }
    },
    { 
      "url": "https://www.yelp.com/search?find_desc=Art+Galleries&find_loc=Los+Angeles%2C+CA",
      "userData": { "label": "YELP_LISTING" }
    }
  ],
  "maxPagesPerCrawl": 500,
  "maxConcurrency": 4
}
```

### Tips for Yelp

1. **Two-stage approach**: Listing → Detail page
2. **Website extraction**: Yelp has redirect URLs, extract carefully
3. **Rate limiting**: Moderate - use concurrency 3-5
4. **Pagination**: Yelp has clear pagination buttons
5. **Rich data**: Yelp provides good structured data

---

## 🔄 Combined Multi-Source Scraping

### Unified Input

Combine all sources in one run:

```json
{
  "startUrls": [
    { 
      "url": "https://www.artsy.net/galleries",
      "userData": { "label": "LISTING" }
    },
    { 
      "url": "https://www.google.com/maps/search/art+galleries+new+york",
      "userData": { "label": "GOOGLE_MAPS" }
    },
    { 
      "url": "https://www.yelp.com/search?find_desc=Art+Galleries&find_loc=New+York",
      "userData": { "label": "YELP_LISTING" }
    }
  ],
  "maxPagesPerCrawl": 1500,
  "maxConcurrency": 5
}
```

### Benefits

- **Data diversity**: Different sources provide different contact info
- **Coverage**: Reach more galleries
- **Validation**: Cross-reference data across sources
- **Redundancy**: If one source fails, others continue

---

## 📊 Comparison Matrix

| Feature | Directory Sites | Google Maps | Yelp |
|---------|----------------|-------------|------|
| **Data Quality** | High | Very High | High |
| **Coverage** | Medium | Very High | High |
| **Website URLs** | ✅ Yes | ⚠️ Sometimes | ✅ Yes |
| **Phone Numbers** | ⚠️ Sometimes | ✅ Always | ✅ Always |
| **Addresses** | ⚠️ Sometimes | ✅ Always | ✅ Always |
| **Emails** | ⚠️ Rare | ❌ No | ❌ No |
| **Rate Limiting** | Low | High | Medium |
| **Difficulty** | Low | High | Medium |
| **Best For** | Email discovery | Complete contact info | Business validation |

---

## 🎯 Recommended Strategy

### Phase 1: Yelp + Google Maps
Extract phone numbers and addresses quickly

### Phase 2: Website Crawling
Visit websites to extract emails

### Phase 3: Directory Sites
Fill gaps and find niche galleries

### Result
Comprehensive database with:
- Names ✅
- Websites ✅
- Phones ✅
- Emails ✅
- Addresses ✅

---

## 🚀 Production Tips

1. **Start small**: Test with 10-20 galleries per source
2. **Monitor costs**: Each source has different resource usage
3. **Deduplicate**: Combine datasets and remove duplicates by domain
4. **Validate**: Check data quality before scaling
5. **Rotate proxies**: Essential for Google Maps
6. **Respect robots.txt**: Check before scraping

---

**Ready to extend! 🎨**
