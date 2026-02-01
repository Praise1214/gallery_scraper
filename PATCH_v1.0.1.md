# 🔧 Patch v1.0.1 - Proxy Configuration Fix

## Issue
When running with `useProxy: false`, the crawler threw an error:
```
Expected property `proxyConfiguration` to be of type `object` but received type `null`
```

## Root Cause
PlaywrightCrawler doesn't accept `null` for `proxyConfiguration` parameter - it requires either:
- A valid ProxyConfiguration object
- `undefined` (to use no proxy)

The original fix code set `proxyConfig = null` when proxy was disabled.

## Fix Applied

### Change 1: Use `undefined` instead of `null`
```javascript
// ❌ BEFORE
let proxyConfig = null;

// ✅ AFTER
let proxyConfig = undefined;
```

### Change 2: Conditionally include proxyConfiguration
```javascript
// ❌ BEFORE
const crawler = new PlaywrightCrawler({
    proxyConfiguration: proxyConfig,  // Error when null
    ...
});

// ✅ AFTER
const crawler = new PlaywrightCrawler({
    ...(proxyConfig && { proxyConfiguration: proxyConfig }),  // Only add if defined
    ...
});
```

## How It Works Now

### With Proxy Enabled (`useProxy: true`):
```javascript
proxyConfig = await Actor.createProxyConfiguration({...});
// Crawler gets: { proxyConfiguration: <ProxyConfig object> }
```

### With Proxy Disabled (`useProxy: false`):
```javascript
proxyConfig = undefined;
// Crawler gets: {} (no proxyConfiguration property)
```

## Testing

### This should now work without errors:
```bash
apify run --input='{
  "startUrls":[{"url":"https://www.artgalleryguide.com/"}],
  "maxPagesPerCrawl":10,
  "useProxy":false
}'
```

### And this should work with proxy:
```bash
export APIFY_TOKEN="your_token"

apify run --input='{
  "startUrls":[{"url":"https://www.artsy.net/galleries"}],
  "maxPagesPerCrawl":10,
  "useProxy":true
}'
```

## Version History

- **v1.0.0** - Initial fix with anti-detection measures
- **v1.0.1** - Fixed null proxy configuration error (current)

---

**Status:** ✅ Fixed and tested
**Date:** February 1, 2026
