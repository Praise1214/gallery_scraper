# 🚀 Deployment Guide

Complete guide for deploying the Art Gallery Contact Scraper to Apify.

## Prerequisites

- Node.js 18+ installed
- npm or yarn
- Apify account (free tier works)
- Apify CLI installed globally

## Installation Steps

### 1. Install Apify CLI

```bash
npm install -g apify-cli
```

### 2. Login to Apify

```bash
apify login
```

This will open a browser window for authentication.

### 3. Verify Installation

```bash
apify --version
```

## Local Testing

Before deploying, test locally:

```bash
# Install dependencies
cd art-gallery-scraper
npm install

# Run with example input
npm start
```

## Deployment Methods

### Method 1: Using Apify CLI (Recommended)

```bash
# Navigate to project directory
cd art-gallery-scraper

# Initialize if not already done
apify init

# Push to Apify platform
apify push
```

This will:
- Upload all files to Apify
- Build the Docker image
- Create/update the Actor

### Method 2: Manual Deployment via Apify Console

1. Go to [Apify Console](https://console.apify.com)
2. Click "Actors" → "Create new"
3. Choose "Custom" → "Node.js + Playwright + Chrome"
4. Copy/paste files:
   - `main.js`
   - `package.json`
   - `INPUT_SCHEMA.json`
   - `Dockerfile`
5. Click "Build" → "Start"

### Method 3: GitHub Integration

1. Push code to GitHub repository
2. In Apify Console → "Actors" → "Create new"
3. Choose "Import from GitHub"
4. Connect your repository
5. Select branch and configure
6. Click "Build"

## Running the Actor

### Via Apify Console

1. Go to your Actor page
2. Click "Try it" or "Console"
3. Configure input:

```json
{
  "startUrls": [
    { "url": "https://www.artsy.net/galleries" }
  ],
  "maxPagesPerCrawl": 100,
  "maxConcurrency": 3
}
```

4. Click "Start"

### Via API

```bash
curl -X POST https://api.apify.com/v2/acts/YOUR_ACTOR_ID/runs \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "startUrls": [{"url": "https://www.artsy.net/galleries"}],
    "maxPagesPerCrawl": 100,
    "maxConcurrency": 3
  }'
```

### Via Apify CLI

```bash
apify call YOUR_ACTOR_NAME --input-file=input-example.json
```

## Monitoring

### View Logs in Real-time

```bash
apify logs
```

### Check Run Status

In Apify Console:
- Go to "Runs" tab
- Click on specific run
- View logs, statistics, and dataset

## Exporting Results

### Export as CSV

```bash
# Via API
curl "https://api.apify.com/v2/datasets/DATASET_ID/items?format=csv" \
  -H "Authorization: Bearer YOUR_TOKEN" > galleries.csv

# Via CLI
apify dataset get-items --dataset-id=DATASET_ID --format=csv > galleries.csv
```

### Export as JSON

```bash
curl "https://api.apify.com/v2/datasets/DATASET_ID/items?format=json" \
  -H "Authorization: Bearer YOUR_TOKEN" > galleries.json
```

### Export as Excel

```bash
curl "https://api.apify.com/v2/datasets/DATASET_ID/items?format=xlsx" \
  -H "Authorization: Bearer YOUR_TOKEN" > galleries.xlsx
```

## Scheduling

Set up automatic runs:

1. Go to Actor → "Schedules" tab
2. Click "Create schedule"
3. Configure:
   - Name: "Daily gallery scrape"
   - Cron: `0 9 * * *` (9 AM daily)
   - Input: Use saved input configuration
4. Save

## Cost Optimization

### Free Tier Limits
- 5 Actors
- $5 platform usage per month
- Unlimited public Actors

### Tips to Stay Within Limits

1. **Reduce concurrency**: `maxConcurrency: 2-3`
2. **Limit pages**: `maxPagesPerCrawl: 100-200`
3. **Use proxy wisely**: Only enable if needed
4. **Schedule off-peak**: Run during low-traffic hours

### Example Budget-Friendly Config

```json
{
  "startUrls": [
    { "url": "https://www.artsy.net/galleries" }
  ],
  "maxPagesPerCrawl": 100,
  "maxConcurrency": 2,
  "proxyConfiguration": {
    "useApifyProxy": false
  }
}
```

## Troubleshooting

### Build Failures

```bash
# Check logs
apify logs

# Common fixes:
# 1. Verify package.json syntax
# 2. Check Dockerfile
# 3. Ensure all dependencies are listed
```

### Runtime Errors

1. Check Actor logs in Console
2. Verify input schema
3. Test locally first: `npm start`
4. Check proxy configuration

### Memory Issues

If Actor crashes due to memory:

1. Lower `maxConcurrency`
2. Upgrade to higher memory tier
3. Reduce `maxPagesPerCrawl`

## Production Best Practices

### 1. Version Control

Tag your releases:

```bash
git tag -a v1.0.0 -m "Production release"
git push origin v1.0.0
```

### 2. Input Validation

Always validate URLs before running:
- Check they're directory pages
- Verify they're accessible
- Test with small batch first

### 3. Monitoring

Set up alerts:
- Email notifications on failure
- Slack/Discord webhooks
- Custom monitoring dashboards

### 4. Data Quality

After each run:
- Check for duplicates
- Validate email formats
- Verify phone number formats
- Review sample records

### 5. Incremental Runs

For large-scale scraping:
1. Run small batches (100-200 pages)
2. Export and validate data
3. Scale up gradually
4. Combine datasets

## Updating the Actor

```bash
# Make code changes
# Update version in package.json and .actor/actor.json

# Push updates
apify push

# The Actor will rebuild automatically
```

## Support

- [Apify Documentation](https://docs.apify.com)
- [Apify Discord](https://discord.gg/jyEM2PRvMU)
- [Apify Forum](https://forum.apify.com)

---

**Happy Scraping! 🎨**
