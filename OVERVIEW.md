# 🎨 Art Gallery Contact Scraper - Project Overview

## 📁 Project Structure

```
art-gallery-scraper/
├── .actor/
│   └── actor.json              # Apify Actor metadata configuration
├── main.js                     # Core scraper implementation (500+ lines)
├── package.json                # Node.js dependencies
├── INPUT_SCHEMA.json           # Apify input configuration schema
├── Dockerfile                  # Docker container configuration
├── README.md                   # Comprehensive documentation
├── DEPLOYMENT.md               # Deployment guide
├── EXTENSIONS.md               # Google Maps & Yelp extensions
├── input-example.json          # Example input configuration
├── .env.example                # Environment variables template
└── .gitignore                  # Git ignore rules
```

## 🚀 Quick Start (3 Steps)

### 1️⃣ Install Dependencies

```bash
cd art-gallery-scraper
npm install
```

### 2️⃣ Configure Input

Edit `input-example.json` or create your own:

```json
{
  "startUrls": [
    { "url": "https://www.artsy.net/galleries" }
  ],
  "maxPagesPerCrawl": 100,
  "maxConcurrency": 3
}
```

### 3️⃣ Run Locally

```bash
npm start
```

Results will be saved in `./apify_storage/datasets/default/`

## 🎯 What This Scraper Does

1. **Starts from directory pages** (e.g., Artsy, Artnet)
2. **Extracts gallery links** from listings
3. **Visits each gallery website**
4. **Auto-discovers contact pages** (/contact, /about, /submit)
5. **Extracts contact information**:
   - 📧 Email addresses
   - 📞 Phone numbers  
   - 📍 Locations
6. **Deduplicates and normalizes** data
7. **Exports structured JSON/CSV**

## 📊 Output Example

```json
{
  "galleryName": "Gagosian Gallery",
  "website": "https://gagosian.com",
  "emails": ["info@gagosian.com", "press@gagosian.com"],
  "phoneNumbers": ["(212) 744-2313"],
  "location": "New York, NY",
  "sourceUrl": "https://www.artsy.net/galleries",
  "scrapedAt": "2026-01-31T12:00:00.000Z"
}
```

## 🏗️ Architecture Highlights

### Three-Stage Crawling Pipeline

```
📋 LISTING → 🏛️ GALLERY_HOME → 📞 CONTACT_PAGE
```

1. **LISTING**: Extract gallery URLs from directory sites
2. **GALLERY_HOME**: Visit homepage, extract initial contacts
3. **CONTACT_PAGE**: Deep-dive into /contact, /about pages

### Key Technologies

- **Apify SDK**: Actor framework and dataset management
- **Crawlee**: Modern web scraping/crawling framework
- **Playwright**: Headless browser automation (handles JS-heavy sites)

### Smart Features

✅ **Domain deduplication** - Won't crawl same gallery twice  
✅ **Contact page auto-discovery** - Finds /contact, /about, /submit  
✅ **Resource blocking** - Blocks images/media for 40-60% faster crawling  
✅ **Retry logic** - 3 attempts per failed request  
✅ **Data normalization** - Emails lowercased, phones formatted  
✅ **Progress tracking** - Detailed statistics and logging  

## 📚 Documentation Guide

| Document | Purpose |
|----------|---------|
| **README.md** | Main documentation, features, configuration |
| **DEPLOYMENT.md** | Step-by-step deployment to Apify |
| **EXTENSIONS.md** | How to extend to Google Maps & Yelp |
| **main.js** | Heavily commented source code |

## 🔧 Configuration Options

### Input Parameters

```javascript
{
  startUrls: [],           // Array of starting URLs
  maxPagesPerCrawl: 1000,  // Max pages to visit
  maxConcurrency: 5,       // Parallel browser instances
  proxyConfiguration: {}   // Proxy settings
}
```

### Environment Variables

Create `.env` from `.env.example`:

```bash
cp .env.example .env
# Edit .env with your Apify token
```

## 📈 Scaling Recommendations

| Scale | Pages | Concurrency | Runtime | Cost |
|-------|-------|-------------|---------|------|
| **Small** | 100 | 2-3 | ~10 min | Free tier |
| **Medium** | 500 | 5 | ~30 min | ~$0.50 |
| **Large** | 1000+ | 10 | ~1 hour | ~$2-5 |

## 🎓 Learning Resources

### For Beginners

1. Read **README.md** first
2. Run locally with example input
3. Check output in `./apify_storage/datasets/default/`
4. Modify `extractGalleriesFromListing()` for your source

### For Advanced Users

1. Read **EXTENSIONS.md** for multi-source scraping
2. Implement custom extractors
3. Deploy to Apify platform
4. Set up scheduled runs

## 🔌 Extension Points

### Add New Sources

The scraper is designed to be extended:

1. **Google Maps**: See EXTENSIONS.md
2. **Yelp**: See EXTENSIONS.md  
3. **Custom directories**: Modify `extractGalleriesFromListing()`

### Customize Extraction

```javascript
// In main.js, find this function:
async function extractGalleriesFromListing(page) {
    // Modify selectors here for your source
    const galleries = await page.$$eval('YOUR_SELECTOR', ...);
    return galleries;
}
```

## 🐛 Troubleshooting

### No results?
- Check your `startUrls` are actually gallery directory pages
- Verify selectors match your source's HTML structure
- Enable detailed logging: `LOG_LEVEL=debug`

### Slow performance?
- Reduce `maxConcurrency` (2-3 for stability)
- Lower `maxPagesPerCrawl`
- Enable proxy if getting blocked

### Memory issues?
- Lower concurrency
- Deploy to Apify (more resources)
- Process in smaller batches

## 📞 Support

- 📖 [Apify Docs](https://docs.apify.com)
- 💬 [Apify Discord](https://discord.gg/jyEM2PRvMU)
- 🔧 [Crawlee Docs](https://crawlee.dev)

## ✅ Production Checklist

Before deploying to production:

- [ ] Test locally with small dataset (10-20 galleries)
- [ ] Verify output data quality
- [ ] Check selectors match target websites
- [ ] Configure appropriate concurrency
- [ ] Enable proxy if needed
- [ ] Set up monitoring/alerts
- [ ] Review cost estimates
- [ ] Schedule runs during off-peak hours

## 🚀 Next Steps

1. **Test locally**: `npm start`
2. **Verify data**: Check `./apify_storage/datasets/default/`
3. **Customize**: Adapt to your gallery sources
4. **Deploy**: Follow **DEPLOYMENT.md**
5. **Scale**: Increase limits gradually
6. **Extend**: Add Google Maps/Yelp (see **EXTENSIONS.md**)

## 📊 Success Metrics

After a successful run, you should see:

```
🎨 SCRAPING COMPLETE - FINAL STATISTICS

📊 Galleries:
   - Found in listings: 150
   - Successfully processed: 145
   
📞 Contact Info Extracted:
   - Total emails: 287
   - Total phone numbers: 203
   - Contact pages visited: 412
   
💾 Dataset Info:
   - Total records saved: 145
```

## 🎯 Real-World Use Cases

- 🎨 **Art dealers**: Build contact database for wholesale
- 📰 **Journalists**: Research gallery contacts for stories
- 🤝 **Business development**: Find gallery partnerships
- 📧 **Marketing**: Build targeted outreach lists
- 📊 **Market research**: Analyze gallery distribution

---

**Built for production. Ready to scale. Happy scraping! 🚀**

## 💡 Pro Tips

1. **Start small**: Test with 10-20 galleries before scaling
2. **Monitor costs**: Track Apify platform usage
3. **Validate data**: Manually check first batch
4. **Respect robots.txt**: Be a good web citizen
5. **Use proxies**: Rotate IPs to avoid blocks
6. **Schedule wisely**: Run during low-traffic hours
7. **Export regularly**: Don't lose data from long runs
8. **Version control**: Track changes to selectors

---

**Questions?** Open an issue or check the documentation! 📚
