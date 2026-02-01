# 🎨 Art Gallery Scraper - Quick Reference Card

## 🚀 Getting Started (Copy-Paste Commands)

```bash
# Install dependencies
cd art-gallery-scraper
npm install

# Run locally
npm start

# Deploy to Apify
npm install -g apify-cli
apify login
apify push
```

## 📁 File Quick Reference

| File | Purpose | Edit This? |
|------|---------|------------|
| **main.js** | Core scraper logic | ✅ Yes - for custom sources |
| **package.json** | Dependencies | ⚠️ Only if adding libraries |
| **INPUT_SCHEMA.json** | Input configuration | ⚠️ Only for new parameters |
| **input-example.json** | Example input | ✅ Yes - your start URLs |
| **Dockerfile** | Docker config | ❌ No - leave as is |
| **.actor/actor.json** | Apify metadata | ⚠️ Only for publishing |

## 🎯 Common Customizations

### Change Starting URLs

Edit `input-example.json`:
```json
{
  "startUrls": [
    { "url": "https://your-gallery-directory.com" }
  ]
}
```

### Customize Gallery Extraction

Edit `main.js`, find line ~130:
```javascript
async function extractGalleriesFromListing(page) {
    // Change selectors here
    const galleries = await page.$$eval('a[href]', ...);
}
```

### Add New Contact Page Patterns

Edit `main.js`, line ~20:
```javascript
const CONTACT_PAGE_PATTERNS = [
    '/contact',
    '/your-custom-page'  // Add here
];
```

## 📊 Input Parameters Cheat Sheet

```json
{
  "startUrls": [],              // Required: Where to start
  "maxPagesPerCrawl": 1000,     // How many pages max
  "maxConcurrency": 5,          // How many browsers in parallel
  "proxyConfiguration": {...}   // Proxy settings
}
```

## 🔍 Testing Workflow

1. **Start small**: `maxPagesPerCrawl: 10`
2. **Check output**: `./apify_storage/datasets/default/`
3. **Verify data**: Open `.json` files
4. **Scale up**: Increase to 100, then 1000+

## 📈 Performance Tuning

| Scenario | Recommended Settings |
|----------|---------------------|
| **Fast testing** | concurrency: 10, pages: 50 |
| **Stable run** | concurrency: 3-5, pages: 500 |
| **Free tier** | concurrency: 2, pages: 100 |
| **Production** | concurrency: 5-10, pages: 1000+ |

## 🐛 Common Issues & Fixes

| Problem | Solution |
|---------|----------|
| No results | Check `startUrls` are directory pages |
| Crashes | Lower `maxConcurrency` to 2-3 |
| Wrong data | Customize `extractGalleriesFromListing()` |
| Blocked | Enable proxy configuration |
| Slow | Increase `maxConcurrency` to 8-10 |

## 📦 Export Commands

```bash
# CSV export
apify dataset get-items --format=csv > galleries.csv

# JSON export
apify dataset get-items --format=json > galleries.json

# Excel export
apify dataset get-items --format=xlsx > galleries.xlsx
```

## 🔗 Key Functions Location

| Function | Line | Purpose |
|----------|------|---------|
| `extractEmails()` | ~45 | Email regex extraction |
| `extractPhoneNumbers()` | ~54 | Phone normalization |
| `extractGalleriesFromListing()` | ~130 | **Customize for your source** |
| `findContactLinks()` | ~105 | Auto-discover contact pages |
| `saveGalleryData()` | ~360 | Save to dataset |

## 💡 Pro Tips

✅ Always test locally first  
✅ Start with `maxPagesPerCrawl: 10`  
✅ Check output quality before scaling  
✅ Use proxies for large-scale scraping  
✅ Monitor Apify platform usage costs  
✅ Export data regularly (don't lose progress)  

## 📚 Documentation Quick Links

- **Full docs**: README.md
- **Deployment**: DEPLOYMENT.md
- **Extensions**: EXTENSIONS.md (Google Maps/Yelp)
- **Overview**: OVERVIEW.md

## 🎯 Typical Workflow

```
1. Customize input-example.json
2. Run: npm start
3. Check: ./apify_storage/datasets/default/
4. Verify: Open .json files
5. Scale: Increase maxPagesPerCrawl
6. Deploy: apify push
7. Monitor: Apify Console
8. Export: CSV/JSON/Excel
```

## ⚡ Speed Optimizations

Already included in the code:
- ✅ Resource blocking (images, media, fonts)
- ✅ Domain deduplication
- ✅ Contact info deduplication
- ✅ Configurable concurrency
- ✅ Smart retry logic

## 🔐 Security Notes

- ⚠️ Never commit `.env` file
- ⚠️ Keep Apify token private
- ⚠️ Use `.env.example` as template
- ✅ `.gitignore` already configured

---

**Need help?** Check README.md or OVERVIEW.md
**Ready to deploy?** See DEPLOYMENT.md
**Want to extend?** See EXTENSIONS.md

**Happy Scraping! 🎨**
