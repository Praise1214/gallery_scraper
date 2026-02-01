/**
 * ═══════════════════════════════════════════════════════════════
 * ART GALLERY CONTACT SCRAPER - PRODUCTION APIFY ACTOR
 * ═══════════════════════════════════════════════════════════════
 * 
 * Purpose: Scrape contact details from 1000+ US art galleries
 * Tech: Apify SDK + Crawlee + Playwright
 * Strategy: Multi-stage crawling (directories → gallery sites → contact pages)
 * 
 * Author: Senior JavaScript Automation Engineer
 * Version: 1.0.0
 */

import { Actor } from 'apify';
import { PlaywrightCrawler, Dataset } from 'crawlee';
import fs from 'fs';

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION & CONSTANTS
// ═══════════════════════════════════════════════════════════════

const CONTACT_PAGE_PATTERNS = [
    '/contact',
    '/about',
    '/submit',
    '/submissions',
    '/artists',
    '/visit',
    '/info',
    '/location'
];

const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
const PHONE_REGEX = /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

const URL_REGEX = /https?:\/\/[^\s,"')]+/gi;

const EXCLUDED_DOMAINS = new Set([
    'facebook.com',
    'instagram.com',
    'twitter.com',
    'x.com',
    'linkedin.com',
    'youtube.com',
    'tiktok.com',
    'pinterest.com',
    'mapquest.com',
    'goo.gl',
    'bit.ly',
    'maps.google.com',
    'google.com',
    'cookiedatabase.org',
    'domainworx.com',
    'yelp.com',
    'tripadvisor.com',
    'yellowpages.com',
    'bbb.org',
    'apple.com',
    'play.google.com'
]);

const EXCLUDED_PATH_KEYWORDS = [
    'privacy',
    'policy',
    'terms',
    'cookie',
    'login',
    'signup',
    'account',
    'cart',
    'checkout',
    'donate',
    'press',
    'news',
    'events',
    'blog'
];

const LISTING_PATH_KEYWORDS = [
    'gallery',
    'galleries',
    'directory',
    'listing',
    'listings',
    'index',
    'art-galleries',
    'locations',
    'states',
    'usa'
];

async function fetchText(url, timeoutMs = 20000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return null;
        return await res.text();
    } catch {
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
}

function extractSitemapLocs(xml) {
    const locs = [];
    if (!xml) return locs;
    const re = /<loc>([^<]+)<\/loc>/gi;
    let match;
    while ((match = re.exec(xml)) !== null) {
        const url = match[1].trim();
        if (url.startsWith('http')) locs.push(url);
    }
    return locs;
}

async function expandSitemapUrls(sitemapUrls, maxUrls = 2000) {
    const queue = [...new Set(sitemapUrls)].filter(Boolean);
    const visited = new Set();
    const results = [];

    while (queue.length > 0 && results.length < maxUrls) {
        const sitemapUrl = queue.shift();
        if (!sitemapUrl || visited.has(sitemapUrl)) continue;
        visited.add(sitemapUrl);

        const xml = await fetchText(sitemapUrl);
        if (!xml) continue;

        const locs = extractSitemapLocs(xml);
        const isIndex = xml.includes('<sitemapindex');

        if (isIndex) {
            for (const loc of locs) {
                if (!visited.has(loc)) queue.push(loc);
            }
        } else {
            for (const loc of locs) {
                results.push(loc);
                if (results.length >= maxUrls) break;
            }
        }
    }

    return results;
}

async function discoverSitemapsFromRobots(startUrls) {
    const origins = new Set();
    for (const url of startUrls) {
        try {
            origins.add(new URL(url).origin);
        } catch {
            // Ignore invalid URLs.
        }
    }

    const sitemaps = new Set();
    for (const origin of origins) {
        let foundForOrigin = false;
        const robotsUrl = `${origin}/robots.txt`;
        const robotsText = await fetchText(robotsUrl);
        if (robotsText) {
            const lines = robotsText.split('\n');
            for (const line of lines) {
                const match = line.match(/^sitemap:\s*(.+)$/i);
                if (match && match[1]) {
                    sitemaps.add(match[1].trim());
                    foundForOrigin = true;
                }
            }
        }
        if (!foundForOrigin) {
            sitemaps.add(`${origin}/sitemap.xml`);
            sitemaps.add(`${origin}/sitemap_index.xml`);
        }
    }
    return [...sitemaps];
}

function extractUrlsFromCsvText(csvText) {
    if (!csvText) return [];
    const matches = csvText.match(URL_REGEX);
    return matches ? matches.map((url) => url.trim()) : [];
}

async function loadUrlsFromCsv(startUrlsCsv) {
    if (!startUrlsCsv) return [];
    const paths = Array.isArray(startUrlsCsv) ? startUrlsCsv : [startUrlsCsv];
    const urls = [];

    for (const entry of paths) {
        if (!entry) continue;
        if (fs.existsSync(entry)) {
            const csvText = fs.readFileSync(entry, 'utf-8');
            urls.push(...extractUrlsFromCsvText(csvText));
        } else if (entry.includes('http')) {
            urls.push(...extractUrlsFromCsvText(entry));
        } else {
            console.warn(`⚠️  CSV path not found: ${entry}`);
        }
    }

    return urls;
}

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Extract all emails from text content
 */
function extractEmails(text) {
    if (!text) return [];
    const matches = text.match(EMAIL_REGEX) || [];
    return [...new Set(matches.map(email => email.toLowerCase().trim()))];
}

/**
 * Extract and normalize phone numbers
 */
function extractPhoneNumbers(text) {
    if (!text) return [];
    const matches = [...text.matchAll(PHONE_REGEX)];
    const phones = matches.map(match => {
        // Normalize to (XXX) XXX-XXXX format
        return `(${match[1]}) ${match[2]}-${match[3]}`;
    });
    return [...new Set(phones)];
}

/**
 * Normalize URL for deduplication
 */
function normalizeUrl(url) {
    try {
        const parsed = new URL(url);
        return `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`.replace(/\/$/, '');
    } catch {
        return url;
    }
}

/**
 * Extract domain from URL
 */
function getDomain(url) {
    try {
        return new URL(url).hostname.replace('www.', '');
    } catch {
        return null;
    }
}

/**
 * Check if URL is likely a gallery detail page (not a listing)
 */
function isGalleryDetailPage(url) {
    const detailPatterns = ['/gallery/', '/galleries/', '/artist/', '/view/', '/details/'];
    return detailPatterns.some(pattern => url.includes(pattern));
}

function isExcludedUrl(url) {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.replace('www.', '').toLowerCase();
        const path = parsed.pathname.toLowerCase();
        if (EXCLUDED_DOMAINS.has(host)) return true;
        return EXCLUDED_PATH_KEYWORDS.some((kw) => path.includes(kw));
    } catch {
        return true;
    }
}

function isLikelyListingUrl(url, baseDomain) {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.replace('www.', '').toLowerCase();
        if (baseDomain && host !== baseDomain) return false;
        const path = parsed.pathname.toLowerCase();
        return LISTING_PATH_KEYWORDS.some((kw) => path.includes(kw));
    } catch {
        return false;
    }
}

function getSeedLabel(url) {
    if (isLikelyListingUrl(url)) return 'LISTING';
    if (isGalleryDetailPage(url) || isContactPage(url)) return 'GALLERY_HOME';
    return 'LISTING';
}

function normalizeStartUrlEntry(entry) {
    if (!entry) return null;
    if (typeof entry === 'string') return entry;
    if (typeof entry.url === 'string') return entry.url;
    return null;
}

async function buildSeedUrls({
    startUrls,
    sitemapUrls,
    startUrlsCsv,
    autoDiscoverSitemaps,
    maxSitemapUrls,
}) {
    const seedUrls = [];

    const normalizedStartUrls = (startUrls || [])
        .map(normalizeStartUrlEntry)
        .filter(Boolean);

    seedUrls.push(...normalizedStartUrls);

    const csvUrls = await loadUrlsFromCsv(startUrlsCsv);
    seedUrls.push(...csvUrls);

    let sitemapSeeds = [];
    if (Array.isArray(sitemapUrls) && sitemapUrls.length > 0) {
        sitemapSeeds.push(...sitemapUrls);
    }

    if (autoDiscoverSitemaps) {
        const discovered = await discoverSitemapsFromRobots(normalizedStartUrls);
        sitemapSeeds.push(...discovered);
    }

    sitemapSeeds = [...new Set(sitemapSeeds.filter(Boolean))];
    if (sitemapSeeds.length > 0) {
        const sitemapUrlsExpanded = await expandSitemapUrls(sitemapSeeds, maxSitemapUrls);
        let filtered = sitemapUrlsExpanded.filter((url) => isLikelyListingUrl(url) || isGalleryDetailPage(url));
        if (filtered.length === 0) filtered = sitemapUrlsExpanded;
        seedUrls.push(...filtered);
    }

    return [...new Set(seedUrls)].filter((url) => url && url.startsWith('http'));
}

/**
 * Check if URL is a contact-related page
 */
function isContactPage(url) {
    return CONTACT_PAGE_PATTERNS.some(pattern => 
        url.toLowerCase().includes(pattern)
    );
}

/**
 * Find contact page links on a page
 */
async function findContactLinks(page, baseUrl) {
    try {
        const links = await page.$$eval('a[href]', (anchors, patterns) => {
            return anchors
                .map(a => a.href)
                .filter(href => {
                    const lower = href.toLowerCase();
                    return patterns.some(pattern => lower.includes(pattern));
                });
        }, CONTACT_PAGE_PATTERNS);
        
        return [...new Set(links)].slice(0, 5); // Limit to 5 contact pages per site
    } catch (error) {
        console.log(`Error finding contact links: ${error.message}`);
        return [];
    }
}

/**
 * Extract gallery detail page links from directory listing page
 * Only extracts links to gallery detail pages on the SAME domain
 */
async function extractGalleriesFromListing(page, baseUrl) {
    try {
        const baseDomain = getDomain(baseUrl);

        // Extract gallery detail page links (same domain only)
        const galleries = await page.$$eval('a[href]', (anchors, baseDomainArg) => {
            const results = [];
            const seenUrls = new Set();

            for (const a of anchors) {
                const href = a.href;
                const text = a.textContent.trim();

                if (!href || !text) continue;
                if (text.length < 3 || text.length > 120) continue;
                if (href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
                if (href.includes('#')) continue;

                try {
                    const parsed = new URL(href);
                    const host = parsed.hostname.replace('www.', '').toLowerCase();
                    const path = parsed.pathname.toLowerCase();

                    // ONLY process links on the same domain (gallery detail pages)
                    if (host !== baseDomainArg) continue;

                    // Skip pagination, category, and utility links
                    if (path.includes('/page/') || path.includes('?page=')) continue;
                    if (path === '/' || path === '') continue;
                    if (path.includes('/states/') && path.split('/').filter(Boolean).length <= 2) continue;
                    if (path.includes('/claim') || path.includes('/login') || path.includes('/register')) continue;
                    if (path.includes('/privacy') || path.includes('/terms') || path.includes('/cookie')) continue;

                    // Look for gallery detail pages - typically have 3+ path segments
                    // e.g., /alabama/florence/art-more-gallery/
                    const pathSegments = path.split('/').filter(Boolean);
                    if (pathSegments.length >= 3) {
                        if (seenUrls.has(href)) continue;
                        seenUrls.add(href);

                        results.push({
                            name: text,
                            url: href,
                            location: ''
                        });
                    }
                } catch {
                    continue;
                }
            }

            return results;
        }, baseDomain);

        return galleries;
    } catch (error) {
        console.log(`Error extracting galleries: ${error.message}`);
        return [];
    }
}

/**
 * Extract contact info directly from a gallery detail page on the directory site
 * (e.g., artgalleries.com/alabama/florence/art-more-gallery/)
 */
async function extractContactFromDetailPage(page) {
    try {
        const contactInfo = await page.evaluate(() => {
            const result = {
                galleryName: '',
                phone: '',
                website: '',
                email: '',
                address: ''
            };

            // Get gallery name from multiple possible sources
            // Try h1 first
            const h1 = document.querySelector('h1');
            if (h1 && h1.textContent.trim().length > 2) {
                result.galleryName = h1.textContent.trim();
            }
            // Try h2 if h1 is empty/missing
            if (!result.galleryName) {
                const h2 = document.querySelector('h2');
                if (h2 && h2.textContent.trim().length > 2) {
                    result.galleryName = h2.textContent.trim();
                }
            }
            // Try the page title
            if (!result.galleryName) {
                const title = document.title;
                if (title) {
                    // Remove common suffixes like "| Art Galleries"
                    result.galleryName = title.split('|')[0].split('-')[0].split('–')[0].trim();
                }
            }
            // Try meta og:title
            if (!result.galleryName) {
                const ogTitle = document.querySelector('meta[property="og:title"]');
                if (ogTitle) {
                    result.galleryName = ogTitle.content.split('|')[0].split('-')[0].trim();
                }
            }

            // Find phone number from tel: links
            const telLinks = document.querySelectorAll('a[href^="tel:"]');
            for (const link of telLinks) {
                const phone = link.href.replace('tel:', '').trim();
                if (phone && phone.length >= 10) {
                    // Decode URL encoding and clean up
                    result.phone = decodeURIComponent(phone).replace(/[^\d()-\s]/g, '').trim();
                    break;
                }
            }

            // Find website from links (look for "Website" text or external links)
            const allLinks = document.querySelectorAll('a[href]');
            for (const link of allLinks) {
                const text = link.textContent.toLowerCase().trim();
                const href = link.href;

                // Skip social media and known non-gallery sites
                const skipDomains = ['facebook.com', 'instagram.com', 'twitter.com', 'yelp.com',
                                     'google.com', 'maps.google.com', 'tripadvisor.com', 'artgalleries.com'];

                if (text === 'website' || text.includes('visit website') || text.includes('official site')) {
                    try {
                        const linkHost = new URL(href).hostname.toLowerCase();
                        if (!skipDomains.some(d => linkHost.includes(d))) {
                            result.website = href;
                            break;
                        }
                    } catch {}
                }
            }

            // Find email from mailto: links
            const mailtoLinks = document.querySelectorAll('a[href^="mailto:"]');
            for (const link of mailtoLinks) {
                const email = link.href.replace('mailto:', '').split('?')[0].trim();
                if (email && email.includes('@')) {
                    result.email = email.toLowerCase();
                    break;
                }
            }

            // Try to find address from Google Maps directions link
            const mapsLinks = document.querySelectorAll('a[href*="maps.google.com"], a[href*="google.com/maps"]');
            for (const link of mapsLinks) {
                const href = link.href;
                const daddrMatch = href.match(/daddr=([^&]+)/);
                if (daddrMatch) {
                    result.address = decodeURIComponent(daddrMatch[1]).replace(/\+/g, ' ');
                    break;
                }
            }

            // Also scan page text for email patterns
            if (!result.email) {
                const bodyText = document.body.innerText || '';
                const emailMatch = bodyText.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
                if (emailMatch) {
                    result.email = emailMatch[0].toLowerCase();
                }
            }

            return result;
        });

        return contactInfo;
    } catch (error) {
        console.log(`Error extracting contact from detail page: ${error.message}`);
        return null;
    }
}

/**
 * Extract all text content from page for contact info mining
 */
async function extractPageText(page) {
    try {
        return await page.evaluate(() => {
            // Remove script and style elements
            const scripts = document.querySelectorAll('script, style, noscript');
            scripts.forEach(el => el.remove());
            
            return document.body.innerText || document.body.textContent;
        });
    } catch (error) {
        console.log(`Error extracting page text: ${error.message}`);
        return '';
    }
}

// ═══════════════════════════════════════════════════════════════
// MAIN ACTOR LOGIC
// ═══════════════════════════════════════════════════════════════

Actor.main(async () => {
    console.log('🎨 Art Gallery Contact Scraper - Starting...');

    // Get input configuration
    const input = await Actor.getInput() || {};
    const {
        startUrls = [],
        sitemapUrls = [],
        startUrlsCsv = null,
        autoDiscoverSitemaps = true,
        maxSitemapUrls = 2000,
        maxSeedUrls = 200,
        maxPagesPerCrawl = 1000,
        maxConcurrency = 5,
        logResultsToConsole = true,
        maxResultsToLog = 20,
        proxyConfiguration = { useApifyProxy: true }
    } = input;

    let seedUrls = await buildSeedUrls({
        startUrls,
        sitemapUrls,
        startUrlsCsv,
        autoDiscoverSitemaps,
        maxSitemapUrls,
    });

    if (seedUrls.length > maxSeedUrls) {
        seedUrls = seedUrls.slice(0, maxSeedUrls);
        console.log(`⚠️  Seed URLs capped to ${maxSeedUrls} (set maxSeedUrls to increase).`);
    }

    // Validate input
    if (!seedUrls || seedUrls.length === 0) {
        throw new Error('No start URLs provided. Please provide startUrls, sitemapUrls, or startUrlsCsv.');
    }

    console.log(`📋 Configuration:
    - Start URLs: ${seedUrls.length}
    - Max pages: ${maxPagesPerCrawl}
    - Concurrency: ${maxConcurrency}
    `);

    // Initialize dataset for storing results
    const dataset = await Dataset.open();
    
    // Track processed domains to avoid duplicates
    const processedDomains = new Set();
    
    // Statistics tracking
    let stats = {
        galleriesFound: 0,
        galleriesProcessed: 0,
        contactPagesVisited: 0,
        emailsFound: 0,
        phonesFound: 0
    };

    // ═══════════════════════════════════════════════════════════════
    // PROXY CONFIGURATION - CRITICAL FOR AVOIDING BLOCKS
    // ═══════════════════════════════════════════════════════════════
    
    // Get useProxy from input (defaults to true for production)
    const useProxy = input.useProxy !== undefined ? input.useProxy : true;
    
    let proxyConfig = undefined; // Use undefined instead of null
    if (useProxy) {
        try {
            // Create proxy configuration with Apify Proxy
            // This rotates IPs automatically per request
            proxyConfig = await Actor.createProxyConfiguration({
                groups: ['RESIDENTIAL'], // Use residential proxies (best for anti-bot)
                countryCode: 'US',       // US IPs for US galleries
                ...proxyConfiguration
            });
            console.log('✅ Proxy enabled: Residential IPs from US');
        } catch (error) {
            console.log('⚠️  Proxy setup failed, running without proxy:', error.message);
            console.log('⚠️  WARNING: Running without proxy will likely result in blocks');
            proxyConfig = undefined; // Ensure undefined on error
        }
    } else {
        console.log('⚠️  Proxy disabled - expect high block rate from anti-bot systems');
    }

    // ═══════════════════════════════════════════════════════════════
    // BROWSER FINGERPRINTING - MAKE REQUESTS LOOK HUMAN
    // ═══════════════════════════════════════════════════════════════
    
    const REALISTIC_USER_AGENTS = [
        // Latest Chrome on Mac
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        // Latest Chrome on Windows
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        // Latest Edge
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
    ];
    
    const VIEWPORTS = [
        { width: 1920, height: 1080 }, // Full HD
        { width: 1366, height: 768 },  // Common laptop
        { width: 1440, height: 900 },  // MacBook
    ];

    // ═══════════════════════════════════════════════════════════════
    // CRAWLER CONFIGURATION - PRODUCTION ANTI-DETECTION
    // ═══════════════════════════════════════════════════════════════

    const crawler = new PlaywrightCrawler({
        // ═══════════════════════════════════════════════════════════
        // PROXY - ROTATE IPS TO AVOID BLOCKS (only if configured)
        // ═══════════════════════════════════════════════════════════
        ...(proxyConfig && { proxyConfiguration: proxyConfig }),
        
        // ═══════════════════════════════════════════════════════════
        // CONCURRENCY & PERFORMANCE
        // ═══════════════════════════════════════════════════════════
        maxConcurrency,
        maxRequestsPerCrawl: maxPagesPerCrawl,
        maxRequestRetries: 5, // Increased from 3 for 403/429 recovery
        requestHandlerTimeoutSecs: 90, // Increased timeout for slower proxy
        
        // ═══════════════════════════════════════════════════════════
        // BROWSER LAUNCH - CRITICAL ANTI-DETECTION
        // ═══════════════════════════════════════════════════════════
        launchContext: {
            // Use real Chrome if available; otherwise fall back to bundled Chromium.
            useChrome: (() => {
                const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
                if (fs.existsSync(chromePath)) return true;
                console.warn(`⚠️  Chrome not found at ${chromePath}. Falling back to bundled Chromium.`);
                return false;
            })(),
            // Required for setting pageOptions like timezone/locale in Playwright.
            useIncognitoPages: true,
            
            // Launch in headful mode (or use new headless mode)
            // New headless mode in Chrome 109+ is undetectable
            launchOptions: {
                // Playwright expects a boolean for headless.
                headless: true,
                
                // Realistic browser args (don't disable too much)
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled', // Hide automation
                    '--disable-features=IsolateOrigins,site-per-process',
                    '--window-size=1920,1080',
                ],
                
                // Ignore HTTPS errors for flexibility
                ignoreHTTPSErrors: true,
            },
        },
        browserPoolOptions: {
            prePageCreateHooks: [
                (_pageId, _browserController, pageOptions) => {
                    if (!pageOptions) return;
                    pageOptions.timezoneId = 'America/New_York';
                    pageOptions.locale = 'en-US';
                },
            ],
        },

        // ═══════════════════════════════════════════════════════════
        // PRE-NAVIGATION HOOKS - FINGERPRINT & STEALTH
        // ═══════════════════════════════════════════════════════════
        preNavigationHooks: [
            async ({ page, request }, gotoOptions) => {
                // ═══════════════════════════════════════════════════
                // 1. RANDOMIZE VIEWPORT (looks more human)
                // ═══════════════════════════════════════════════════
                const viewport = VIEWPORTS[Math.floor(Math.random() * VIEWPORTS.length)];
                await page.setViewportSize(viewport);
                
                // ═══════════════════════════════════════════════════
                // 2. SET REALISTIC HEADERS
                // ═══════════════════════════════════════════════════
                const randomUA = REALISTIC_USER_AGENTS[Math.floor(Math.random() * REALISTIC_USER_AGENTS.length)];
                
                await page.setExtraHTTPHeaders({
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Sec-Fetch-User': '?1',
                    'Cache-Control': 'max-age=0',
                    'User-Agent': randomUA,
                });
                
                // ═══════════════════════════════════════════════════
                // 3. INJECT ANTI-DETECTION SCRIPTS
                // ═══════════════════════════════════════════════════
                await page.addInitScript(() => {
                    // Override navigator.webdriver
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined,
                    });
                    
                    // Mock chrome object
                    window.chrome = {
                        runtime: {},
                    };
                    
                    // Mock plugins
                    Object.defineProperty(navigator, 'plugins', {
                        get: () => [1, 2, 3, 4, 5],
                    });
                    
                    // Mock languages
                    Object.defineProperty(navigator, 'languages', {
                        get: () => ['en-US', 'en'],
                    });
                    
                    // Override permissions
                    const originalQuery = window.navigator.permissions.query;
                    window.navigator.permissions.query = (parameters) => (
                        parameters.name === 'notifications' ?
                            Promise.resolve({ state: Notification.permission }) :
                            originalQuery(parameters)
                    );
                });
                
                // ═══════════════════════════════════════════════════
                // 4. SELECTIVE RESOURCE BLOCKING (less aggressive)
                // ═══════════════════════════════════════════════════
                // Only block large media, keep images for now
                await page.route('**/*', (route) => {
                    const resourceType = route.request().resourceType();
                    const url = route.request().url();
                    
                    // Block large media and tracking
                    if (resourceType === 'media' || 
                        url.includes('google-analytics') ||
                        url.includes('googletagmanager') ||
                        url.includes('facebook.com/tr') ||
                        url.includes('doubleclick.net')) {
                        route.abort();
                    } else {
                        route.continue();
                    }
                });
                
                // ═══════════════════════════════════════════════════
                // 5. TIMEZONE & LOCALE ARE SET VIA BROWSER CONTEXT
                // ═══════════════════════════════════════════════════
            }
        ],

        // ═══════════════════════════════════════════════════════════════
        // REQUEST HANDLER - MAIN CRAWLING LOGIC
        // ═══════════════════════════════════════════════════════════════
        
        async requestHandler({ request, page, enqueueLinks, log }) {
            const { url, userData = {} } = request;
            const { label = 'LISTING', galleryData = {} } = userData;

            log.info(`Processing [${label}]: ${url}`);

            try {
                // Wait for page to be reasonably loaded
                await page.waitForLoadState('domcontentloaded', { timeout: 30000 });

                // ═══════════════════════════════════════════════════════════════
                // DETECT PAGE TYPE: Is this actually a gallery detail page?
                // URLs like /state/city/gallery-name/ are detail pages, not listings
                // ═══════════════════════════════════════════════════════════════

                let actualLabel = label;
                try {
                    const parsed = new URL(url);
                    const pathSegments = parsed.pathname.split('/').filter(Boolean);
                    // Gallery detail pages on artgalleries.com have pattern: /state/city/gallery-name/
                    // That's 3 segments, and NOT starting with 'states'
                    if (pathSegments.length >= 3 && pathSegments[0] !== 'states' &&
                        !pathSegments.includes('page') && !pathSegments.includes('category')) {
                        actualLabel = 'GALLERY_DETAIL';
                    }
                } catch {}

                // ═══════════════════════════════════════════════════════════════
                // STAGE 1: DIRECTORY LISTING PAGE
                // ═══════════════════════════════════════════════════════════════

                if (actualLabel === 'LISTING') {
                    log.info('📋 Processing directory listing page...');

                    // Extract gallery detail page links (same domain only)
                    const galleries = await extractGalleriesFromListing(page, url);

                    log.info(`Found ${galleries.length} gallery detail pages to visit`);
                    stats.galleriesFound += galleries.length;

                    // Enqueue each gallery DETAIL page (on the directory site)
                    for (const gallery of galleries) {
                        const normalizedUrl = normalizeUrl(gallery.url);

                        // Skip if already processed
                        if (!processedDomains.has(normalizedUrl)) {
                            processedDomains.add(normalizedUrl);

                            await crawler.addRequests([{
                                url: gallery.url,
                                userData: {
                                    label: 'GALLERY_DETAIL',  // New label for directory detail pages
                                    galleryData: {
                                        galleryName: gallery.name,
                                        sourceUrl: url
                                    }
                                }
                            }]);
                        }
                    }

                    // NOTE: Disabled automatic listing discovery - all state URLs are in input file
                    // This ensures crawler focuses on gallery detail pages and their websites
                }

                // ═══════════════════════════════════════════════════════════════
                // STAGE 1.5: GALLERY DETAIL PAGE (on directory site)
                // This is where the actual contact info is!
                // ═══════════════════════════════════════════════════════════════

                else if (actualLabel === 'GALLERY_DETAIL') {
                    log.info(`🏛️ Processing gallery detail page: ${url}`);
                    stats.galleriesProcessed++;

                    // Extract contact info from the detail page
                    const contactInfo = await extractContactFromDetailPage(page);

                    if (contactInfo) {
                        const emails = contactInfo.email ? [contactInfo.email] : [];
                        const phones = contactInfo.phone ? [contactInfo.phone] : [];

                        // Also scan full page text for additional emails/phones
                        const pageText = await extractPageText(page);
                        const additionalEmails = extractEmails(pageText);
                        const additionalPhones = extractPhoneNumbers(pageText);

                        emails.push(...additionalEmails);
                        phones.push(...additionalPhones);

                        const galleryRecord = {
                            galleryName: contactInfo.galleryName || galleryData.galleryName || 'Unknown',
                            website: contactInfo.website || '',
                            emails: [...new Set(emails)],
                            phoneNumbers: [...new Set(phones)],
                            address: contactInfo.address || '',
                            sourceUrl: url
                        };

                        log.info(`📞 Directory page - Emails: ${galleryRecord.emails.length}, Phones: ${galleryRecord.phoneNumbers.length}, Website: ${galleryRecord.website || 'none'}`);

                        // If there's a website, visit it to get email (DON'T save yet - wait for website scrape)
                        if (contactInfo.website && !processedDomains.has(getDomain(contactInfo.website))) {
                            processedDomains.add(getDomain(contactInfo.website));
                            log.info(`🌐 Following gallery website for email: ${contactInfo.website}`);
                            await crawler.addRequests([{
                                url: contactInfo.website,
                                userData: {
                                    label: 'GALLERY_HOME',
                                    galleryData: {
                                        galleryName: galleryRecord.galleryName,
                                        website: contactInfo.website,
                                        address: galleryRecord.address,
                                        sourceUrl: url,
                                        emails: [...galleryRecord.emails],
                                        phoneNumbers: [...galleryRecord.phoneNumbers]
                                    }
                                }
                            }]);
                        } else {
                            // No website to visit, save what we have from directory
                            if (galleryRecord.emails.length > 0 || galleryRecord.phoneNumbers.length > 0) {
                                await saveGalleryData(galleryRecord, dataset, stats);
                            }
                        }
                    }
                }

                // ═══════════════════════════════════════════════════════════════
                // STAGE 2: GALLERY HOMEPAGE
                // ═══════════════════════════════════════════════════════════════
                
                else if (actualLabel === 'GALLERY_HOME') {
                    galleryData.emails = galleryData.emails || [];
                    galleryData.phoneNumbers = galleryData.phoneNumbers || [];
                    galleryData.galleryName = galleryData.galleryName || (() => {
                        try {
                            return new URL(url).hostname;
                        } catch {
                            return 'Unknown';
                        }
                    })();
                    galleryData.website = galleryData.website || url;
                    galleryData.sourceUrl = galleryData.sourceUrl || url;

                    log.info(`🌐 Scraping gallery website for EMAIL: ${galleryData.galleryName} - ${url}`);

                    // Extract text content from homepage
                    const pageText = await extractPageText(page);

                    // Extract contact info from homepage - THIS IS WHERE WE GET EMAILS!
                    const homeEmails = extractEmails(pageText);
                    const homePhones = extractPhoneNumbers(pageText);

                    // Also look for mailto: links specifically
                    const mailtoEmails = await page.$$eval('a[href^="mailto:"]', (links) => {
                        return links.map(link => {
                            const email = link.href.replace('mailto:', '').split('?')[0].trim();
                            return email.toLowerCase();
                        }).filter(e => e.includes('@'));
                    });

                    galleryData.emails.push(...homeEmails, ...mailtoEmails);
                    galleryData.phoneNumbers.push(...homePhones);

                    log.info(`📧 Website emails found: ${homeEmails.length} from text, ${mailtoEmails.length} from mailto links`);

                    // Find and enqueue contact pages for MORE emails
                    const contactLinks = await findContactLinks(page, url);

                    if (contactLinks.length > 0) {
                        log.info(`📄 Found ${contactLinks.length} contact pages to check for more emails`);
                        for (const contactUrl of contactLinks) {
                            await crawler.addRequests([{
                                url: contactUrl,
                                userData: {
                                    label: 'CONTACT_PAGE',
                                    galleryData: { ...galleryData }
                                }
                            }]);
                        }
                    } else {
                        // No contact pages - save what we have NOW
                        const uniqueEmails = [...new Set(galleryData.emails)];
                        const uniquePhones = [...new Set(galleryData.phoneNumbers)];

                        log.info(`💾 Saving gallery: ${galleryData.galleryName} - ${uniqueEmails.length} emails, ${uniquePhones.length} phones`);

                        if (uniqueEmails.length > 0 || uniquePhones.length > 0 || galleryData.website) {
                            await saveGalleryData({
                                ...galleryData,
                                emails: uniqueEmails,
                                phoneNumbers: uniquePhones
                            }, dataset, stats);
                        }
                    }
                }

                // ═══════════════════════════════════════════════════════════════
                // STAGE 3: CONTACT/ABOUT PAGES
                // ═══════════════════════════════════════════════════════════════
                
                else if (actualLabel === 'CONTACT_PAGE') {
                    log.info(`📄 Processing CONTACT PAGE for: ${galleryData.galleryName} - ${url}`);
                    stats.contactPagesVisited++;

                    // Extract text content
                    const pageText = await extractPageText(page);

                    // Extract contact info from text
                    const textEmails = extractEmails(pageText);
                    const textPhones = extractPhoneNumbers(pageText);

                    // Also extract mailto: links directly
                    const mailtoEmails = await page.$$eval('a[href^="mailto:"]', (links) => {
                        return links.map(link => {
                            const email = link.href.replace('mailto:', '').split('?')[0].trim();
                            return email.toLowerCase();
                        }).filter(e => e.includes('@'));
                    });

                    galleryData.emails = galleryData.emails || [];
                    galleryData.phoneNumbers = galleryData.phoneNumbers || [];

                    galleryData.emails.push(...textEmails, ...mailtoEmails);
                    galleryData.phoneNumbers.push(...textPhones);

                    // Deduplicate
                    const uniqueEmails = [...new Set(galleryData.emails)];
                    const uniquePhones = [...new Set(galleryData.phoneNumbers)];

                    log.info(`📧 Contact page emails: ${textEmails.length} from text, ${mailtoEmails.length} from mailto`);
                    log.info(`💾 FINAL SAVE: ${galleryData.galleryName} - ${uniqueEmails.length} emails, ${uniquePhones.length} phones`);

                    // Save the gallery data with all collected info
                    if (uniqueEmails.length > 0 || uniquePhones.length > 0 || galleryData.website) {
                        await saveGalleryData({
                            ...galleryData,
                            emails: uniqueEmails,
                            phoneNumbers: uniquePhones
                        }, dataset, stats);
                    }
                }

            } catch (error) {
                log.error(`Error processing ${url}: ${error.message}`);
            }
        },

        // ═══════════════════════════════════════════════════════════════
        // ERROR HANDLER - DETECT AND RECOVER FROM BLOCKS
        // ═══════════════════════════════════════════════════════════════
        
        failedRequestHandler({ request, log }, error) {
            const { url } = request;
            const errorMsg = error.message || '';
            
            // Detect 403/429 blocks
            if (errorMsg.includes('403') || errorMsg.includes('429')) {
                log.error(`🚫 BLOCKED: ${url}`, {
                    status: errorMsg.includes('403') ? '403 Forbidden' : '429 Too Many Requests',
                    error: errorMsg,
                    suggestion: useProxy 
                        ? 'Proxy rotation in effect, will retry with new IP' 
                        : 'Enable proxy with useProxy: true to avoid blocks'
                });
                
                if (!useProxy) {
                    log.warning('💡 TIP: Add "useProxy": true to your input to enable IP rotation');
                }
            } else {
                log.error(`Request ${url} failed after ${request.retryCount} retries`, { 
                    error: errorMsg 
                });
            }
        },
    });

    // ═══════════════════════════════════════════════════════════════
    // HELPER: SAVE GALLERY DATA
    // ═══════════════════════════════════════════════════════════════
    
    /**
     * Save gallery data to dataset with deduplication
     */
    async function saveGalleryData(data, dataset, stats) {
        // Deduplicate emails and phones
        const uniqueEmails = [...new Set(data.emails || [])];
        const uniquePhones = [...new Set(data.phoneNumbers || [])];

        // Only save if we have at least some contact info (email, phone, OR website)
        if (uniqueEmails.length > 0 || uniquePhones.length > 0 || data.website) {
            await dataset.pushData({
                galleryName: data.galleryName || 'Unknown',
                website: data.website || '',
                emails: uniqueEmails,
                phoneNumbers: uniquePhones,
                address: data.address || data.location || '',
                sourceUrl: data.sourceUrl || '',
                scrapedAt: new Date().toISOString()
            });

            stats.emailsFound += uniqueEmails.length;
            stats.phonesFound += uniquePhones.length;

            console.log(`✅ Saved: ${data.galleryName} - ${uniqueEmails.length} emails, ${uniquePhones.length} phones, website: ${data.website ? 'yes' : 'no'}`);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // START CRAWLING
    // ═══════════════════════════════════════════════════════════════

    // Add initial URLs to the queue
    await crawler.addRequests(
        seedUrls.map((url) => {
            const label = getSeedLabel(url);
            if (label === 'GALLERY_HOME') {
                let galleryName = 'Unknown';
                try {
                    galleryName = new URL(url).hostname;
                } catch {
                    // Use default.
                }
                return {
                    url,
                    userData: {
                        label,
                        galleryData: {
                            galleryName,
                            website: url,
                            location: '',
                            sourceUrl: url,
                            emails: [],
                            phoneNumbers: []
                        }
                    }
                };
            }

            return {
                url,
                userData: { label }
            };
        })
    );

    // Run the crawler
    await crawler.run();

    // ═══════════════════════════════════════════════════════════════
    // FINAL STATISTICS
    // ═══════════════════════════════════════════════════════════════

    console.log(`
    ═══════════════════════════════════════════════════════════
    🎨 SCRAPING COMPLETE - FINAL STATISTICS
    ═══════════════════════════════════════════════════════════
    
    📊 Galleries:
       - Found in listings: ${stats.galleriesFound}
       - Successfully processed: ${stats.galleriesProcessed}
    
    📞 Contact Info Extracted:
       - Total emails: ${stats.emailsFound}
       - Total phone numbers: ${stats.phonesFound}
       - Contact pages visited: ${stats.contactPagesVisited}
    
    💾 Dataset Info:
       - Total records saved: ${await dataset.getInfo().then(info => info.itemCount)}
    
    ═══════════════════════════════════════════════════════════
    `);

    if (logResultsToConsole) {
        const limit = Math.max(1, Math.min(100, Number(maxResultsToLog) || 20));
        const data = await dataset.getData({ limit });
        if (data.items.length > 0) {
            console.log(`📦 Sample results (up to ${limit}):`);
            data.items.forEach((item, index) => {
                const emails = Array.isArray(item.emails) ? item.emails.length : 0;
                const phones = Array.isArray(item.phoneNumbers) ? item.phoneNumbers.length : 0;
                console.log(`${index + 1}. ${item.galleryName} | ${item.website} | emails: ${emails}, phones: ${phones}`);
            });
        } else {
            console.log('📦 No saved records yet (no emails/phones found).');
        }
    }

    console.log('✨ Actor finished successfully!');
});
