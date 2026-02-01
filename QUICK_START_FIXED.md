# 🚀 QUICK START - Fixed Version

## What Changed?
✅ **Anti-detection measures** - Chrome + new headless mode, fingerprint evasion  
✅ **Proxy support** - Residential IP rotation to avoid blocks  
✅ **Current user agents** - Chrome 131 (not outdated 120)  
✅ **Better error handling** - Detects 403/429 and suggests fixes  
✅ **Alternative sources documented** - Easier directories than Artsy  

---

## 🏃 Run It Now (3 Options)

### Option 1: Easy Test (No Proxy - May Block on Artsy)
```bash
cd art-gallery-scraper

apify run --input='{
  "startUrls":[{"url":"https://www.artgalleryguide.com/"}],
  "maxPagesPerCrawl":20,
  "maxConcurrency":2,
  "useProxy":false
}'
```
**Good for:** Testing on easy sites (ArtGalleryGuide, GalleryGuide)

---

### Option 2: Production (With Proxy - Recommended)
```bash
# Set your Apify token
export APIFY_TOKEN="your_apify_token_here"

apify run --input='{
  "startUrls":[{"url":"https://www.artsy.net/galleries"}],
  "maxPagesPerCrawl":50,
  "maxConcurrency":3,
  "useProxy":true
}'
```
**Good for:** Protected sites (Artsy, Google Maps, Yelp)  
**Cost:** ~$0.50-1.00 per 1000 requests

---

### Option 3: Multi-Source (Best Coverage)
```bash
apify run --input='{
  "startUrls":[
    {"url":"https://www.artgalleryguide.com/"},
    {"url":"https://galleryguide.org/"},
    {"url":"https://www.google.com/maps/search/art+galleries+new+york",
     "userData":{"label":"GOOGLE_MAPS"}}
  ],
  "maxPagesPerCrawl":500,
  "maxConcurrency":5,
  "useProxy":true
}'
```
**Good for:** Maximum gallery coverage  
**Requires:** Google Maps handler from EXTENSIONS.md

---

## 📋 Local Input File Method

Create `.actor/INPUT.json`:
```json
{
  "startUrls": [
    {"url": "https://www.artgalleryguide.com/"}
  ],
  "maxPagesPerCrawl": 100,
  "maxConcurrency": 3,
  "useProxy": false
}
```

Then simply run:
```bash
apify run
```

---

## 🎯 Recommended Sources by Difficulty

### 🟢 Easy (No Proxy Needed)
```json
{
  "startUrls": [
    {"url": "https://www.artgalleryguide.com/"},
    {"url": "https://galleryguide.org/"},
    {"url": "https://www.artbusiness.com/fineart.html"}
  ],
  "useProxy": false
}
```

### 🟡 Medium (Proxy Recommended)
```json
{
  "startUrls": [
    {"url": "https://www.yelp.com/search?find_desc=Art+Galleries&find_loc=New+York",
     "userData": {"label": "YELP_LISTING"}}
  ],
  "useProxy": true
}
```

### 🔴 Hard (Proxy Required)
```json
{
  "startUrls": [
    {"url": "https://www.artsy.net/galleries"},
    {"url": "https://www.google.com/maps/search/art+galleries",
     "userData": {"label": "GOOGLE_MAPS"}}
  ],
  "useProxy": true
}
```

---

## ✅ What to Expect

### With Anti-Detection + Proxy:
```
✅ Proxy enabled: Residential IPs from US
🎨 Art Gallery Contact Scraper - Starting...
📋 Configuration:
    - Start URLs: 1
    - Max pages: 50
    - Concurrency: 3
    
📋 Processing directory listing page...
Found 20 potential galleries
🏛️ Processing gallery homepage: Gagosian Gallery
Homepage contacts - Emails: 2, Phones: 1
📞 Processing contact page for: Gagosian Gallery
Contact page - Emails: 1, Phones: 0
✅ Saved: Gagosian Gallery - 2 emails, 1 phones

═══════════════════════════════════════════════════════════
🎨 SCRAPING COMPLETE - FINAL STATISTICS
═══════════════════════════════════════════════════════════

📊 Galleries:
   - Found in listings: 45
   - Successfully processed: 42

📞 Contact Info Extracted:
   - Total emails: 87
   - Total phone numbers: 63
   - Contact pages visited: 98
```

### If Blocked (403/429):
```
🚫 BLOCKED: https://www.artsy.net/galleries
📊 Status: 403 Forbidden
💡 TIP: Add "useProxy": true to avoid blocks
```

---

## 🔧 Troubleshooting

### "Request blocked - 403"
**Solution:** Add `"useProxy": true` to input

### "No start URLs provided"
**Solution:** Create `.actor/INPUT.json` with startUrls (see above)

### "Proxy setup failed"
**Solution:** Set `APIFY_TOKEN` environment variable:
```bash
export APIFY_TOKEN="your_token_here"
```

### Still getting blocked even with proxy?
**Solution:** Try easier sources first:
- ArtGalleryGuide.com (easiest)
- GalleryGuide.org (easy)
- Then move to Artsy/Google Maps

---

## 📚 Full Documentation

- **FIX_POST_MORTEM.md** - What was wrong and how it was fixed
- **README.md** - Full feature documentation
- **EXTENSIONS.md** - Google Maps & Yelp integration
- **DEPLOYMENT.md** - Deploy to Apify platform

---

## 💡 Pro Tips

1. **Start without proxy** on easy sites to test
2. **Enable proxy** for Artsy, Google Maps, Yelp
3. **Monitor costs** - residential proxies add up
4. **Use multiple sources** for best coverage
5. **Export data regularly** - don't lose progress

---

**Ready to scrape? Pick an option above and run!** 🎨
