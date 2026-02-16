/**
 * ═══════════════════════════════════════════════════════════════
 * ART GALLERY SCRAPER - WEB SERVER
 * ═══════════════════════════════════════════════════════════════
 *
 * Simple web interface to run the scraper and view/download results
 *
 * Usage: node server.js
 * Then open: http://localhost:3000
 */

import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// SECURITY: Only allow localhost origins, not open to the world
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST']
}));
app.use(express.json({ limit: '1kb' })); // Limit body size to prevent abuse
app.use(express.static(path.join(__dirname, 'public')));

// SECURITY: Bind to localhost only (not 0.0.0.0)
const HOST = '127.0.0.1';

// SECURITY: Rate limiting for API endpoints
const rateLimitMap = new Map();
function rateLimit(req, res, next) {
    const ip = req.ip;
    const now = Date.now();
    const windowMs = 1000; // 1 second
    const maxRequests = 10;

    if (!rateLimitMap.has(ip)) {
        rateLimitMap.set(ip, []);
    }

    const requests = rateLimitMap.get(ip).filter(t => now - t < windowMs);
    if (requests.length >= maxRequests) {
        return res.status(429).json({ error: 'Too many requests' });
    }

    requests.push(now);
    rateLimitMap.set(ip, requests);
    next();
}
app.use('/api', rateLimit);

// Store scraper state
let scraperState = {
    isRunning: false,
    progress: [],
    results: [],
    stats: {
        galleriesFound: 0,
        galleriesProcessed: 0,
        emailsFound: 0,
        phonesFound: 0
    },
    startTime: null,
    endTime: null
};

// Store the scraper process reference
let scraperProcess = null;

// ═══════════════════════════════════════════════════════════════
// API ENDPOINTS
// ═══════════════════════════════════════════════════════════════

// Get current scraper status
app.get('/api/status', (req, res) => {
    // Check if process died without updating state
    if (scraperState.isRunning && scraperProcess === null) {
        scraperState.isRunning = false;
        scraperState.endTime = new Date().toISOString();
        loadResultsFromDataset();
    }

    res.json({
        isRunning: scraperState.isRunning,
        stats: scraperState.stats,
        resultCount: scraperState.results.length,
        startTime: scraperState.startTime,
        endTime: scraperState.endTime,
        recentProgress: scraperState.progress.slice(-20) // Last 20 log lines
    });
});

// Get all results
app.get('/api/results', (req, res) => {
    res.json(scraperState.results);
});

// Download results as JSON
app.get('/api/download', (req, res) => {
    const filename = `gallery-contacts-${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(scraperState.results);
});

// Start the scraper
app.post('/api/scrape', (req, res) => {
    // Check if process is actually still running
    if (scraperState.isRunning && scraperProcess) {
        // Double-check the process is actually alive
        try {
            process.kill(scraperProcess.pid, 0); // Signal 0 just checks if process exists
            return res.status(400).json({ error: 'Scraper is already running' });
        } catch (e) {
            // Process is dead, reset state
            console.log('Process was marked as running but is dead, resetting state');
            scraperState.isRunning = false;
            scraperProcess = null;
        }
    } else if (scraperState.isRunning) {
        // State says running but no process reference - reset
        scraperState.isRunning = false;
        scraperProcess = null;
    }

    // SECURITY: Validate and sanitize input
    let { maxSeedUrls = 3, maxPagesPerCrawl = 100 } = req.body;
    maxSeedUrls = Math.max(1, Math.min(50, parseInt(maxSeedUrls) || 3));
    maxPagesPerCrawl = Math.max(10, Math.min(2000, parseInt(maxPagesPerCrawl) || 100));

    // Reset state
    scraperState = {
        isRunning: true,
        progress: [],
        results: [],
        stats: {
            galleriesFound: 0,
            galleriesProcessed: 0,
            emailsFound: 0,
            phonesFound: 0
        },
        startTime: new Date().toISOString(),
        endTime: null
    };

    // Update INPUT.json with custom settings
    const inputPath = path.join(__dirname, 'storage/key_value_stores/default/INPUT.json');
    try {
        const input = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
        input.maxSeedUrls = maxSeedUrls;
        input.maxPagesPerCrawl = maxPagesPerCrawl;
        fs.writeFileSync(inputPath, JSON.stringify(input, null, 2));
    } catch (err) {
        console.error('Failed to update INPUT.json:', err.message);
    }

    // Clean up old Apify request queue to avoid stale state
    const requestQueuePath = path.join(__dirname, 'storage/request_queues');
    if (fs.existsSync(requestQueuePath)) {
        try { fs.rmSync(requestQueuePath, { recursive: true, force: true }); } catch (e) {}
    }

    // Spawn the scraper process
    scraperProcess = spawn('node', ['main.js'], {
        cwd: __dirname,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe']
    });

    console.log(`Scraper started with PID: ${scraperProcess.pid}`);
    scraperState.progress.push(`[${new Date().toLocaleTimeString()}] 🚀 Scraper started (PID: ${scraperProcess.pid})...`);

    // Parse output for progress updates
    scraperProcess.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter(l => l.trim());

        for (const line of lines) {
            // Clean ANSI codes
            const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, '');

            // Track progress
            if (cleanLine.includes('Processing')) {
                scraperState.progress.push(`[${new Date().toLocaleTimeString()}] ${cleanLine}`);
            }

            // Track stats
            if (cleanLine.includes('Found') && cleanLine.includes('gallery detail pages')) {
                const match = cleanLine.match(/Found (\d+) gallery/);
                if (match) {
                    scraperState.stats.galleriesFound += parseInt(match[1]);
                }
            }

            if (cleanLine.includes('Saved:')) {
                scraperState.stats.galleriesProcessed++;

                // Extract email/phone counts
                const emailMatch = cleanLine.match(/(\d+) emails/);
                const phoneMatch = cleanLine.match(/(\d+) phones/);
                if (emailMatch) scraperState.stats.emailsFound += parseInt(emailMatch[1]);
                if (phoneMatch) scraperState.stats.phonesFound += parseInt(phoneMatch[1]);

                scraperState.progress.push(`[${new Date().toLocaleTimeString()}] ✅ ${cleanLine.split('Saved:')[1]?.trim() || 'Gallery saved'}`);
            }

            if (cleanLine.includes('Google Sheets')) {
                scraperState.progress.push(`[${new Date().toLocaleTimeString()}] 📊 ${cleanLine}`);
            }
        }

        // Keep progress log manageable
        if (scraperState.progress.length > 100) {
            scraperState.progress = scraperState.progress.slice(-100);
        }
    });

    scraperProcess.stderr.on('data', (data) => {
        const cleanLine = data.toString().replace(/\x1b\[[0-9;]*m/g, '').trim();
        if (cleanLine && !cleanLine.includes('ExperimentalWarning')) {
            scraperState.progress.push(`[${new Date().toLocaleTimeString()}] ⚠️ ${cleanLine.substring(0, 100)}`);
        }
    });

    scraperProcess.on('close', (code) => {
        // Only update if not already stopped manually
        if (scraperState.isRunning) {
            scraperState.isRunning = false;
            scraperState.endTime = new Date().toISOString();
            scraperState.progress.push(`[${new Date().toLocaleTimeString()}] 🏁 Scraper finished with code ${code}`);
            // Read results from Apify dataset
            loadResultsFromDataset();
        }
        scraperProcess = null;
    });

    scraperProcess.on('error', (err) => {
        console.error('Scraper process error:', err);
        scraperState.isRunning = false;
        scraperProcess = null;
    });

    res.json({
        message: 'Scraper started',
        settings: { maxSeedUrls, maxPagesPerCrawl }
    });
});

// Stop the scraper
app.post('/api/stop', (req, res) => {
    if (!scraperState.isRunning && !scraperProcess) {
        return res.status(400).json({ error: 'Scraper is not running' });
    }

    const pid = scraperProcess ? scraperProcess.pid : null;
    console.log(`Stopping scraper process (PID: ${pid})...`);

    try {
        // Kill the process
        if (pid && scraperProcess) {
            try {
                scraperProcess.kill('SIGKILL');
            } catch (e) {
                // Process already dead
            }
        }

        // Immediately reset state so user can start again
        scraperState.isRunning = false;
        scraperState.endTime = new Date().toISOString();
        scraperState.progress.push(`[${new Date().toLocaleTimeString()}] 🛑 Scraper stopped by user`);
        scraperProcess = null;

        // Load any results that were saved before stopping
        loadResultsFromDataset();

        res.json({ message: 'Scraper stopped successfully' });
    } catch (err) {
        console.error('Error stopping scraper:', err);
        // Reset state even on error
        scraperState.isRunning = false;
        scraperProcess = null;
        res.status(500).json({ error: 'Failed to stop scraper: ' + err.message });
    }
});

// Clear results
app.post('/api/clear', (req, res) => {
    if (scraperState.isRunning) {
        return res.status(400).json({ error: 'Cannot clear while scraper is running' });
    }

    // Clear dataset directory
    const datasetPath = path.join(__dirname, 'storage/datasets/default');
    if (fs.existsSync(datasetPath)) {
        fs.rmSync(datasetPath, { recursive: true, force: true });
    }

    scraperState.results = [];
    scraperState.progress = [];
    scraperState.stats = {
        galleriesFound: 0,
        galleriesProcessed: 0,
        emailsFound: 0,
        phonesFound: 0
    };

    res.json({ message: 'Results cleared' });
});

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function loadResultsFromDataset() {
    const datasetPath = path.join(__dirname, 'storage/datasets/default');
    scraperState.results = [];

    if (!fs.existsSync(datasetPath)) {
        return;
    }

    try {
        const files = fs.readdirSync(datasetPath).filter(f => f.endsWith('.json'));

        for (const file of files) {
            const filePath = path.join(datasetPath, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(content);

            // Dataset files can contain single objects or arrays
            if (Array.isArray(data)) {
                scraperState.results.push(...data);
            } else {
                scraperState.results.push(data);
            }
        }

        console.log(`Loaded ${scraperState.results.length} results from dataset`);
    } catch (err) {
        console.error('Error loading dataset:', err.message);
    }
}

// Load existing results on startup
loadResultsFromDataset();

// ═══════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════

app.listen(PORT, HOST, () => {
    console.log(`
═══════════════════════════════════════════════════════════════
  🎨 ART GALLERY SCRAPER - WEB INTERFACE
═══════════════════════════════════════════════════════════════

  Server running at: http://localhost:${PORT}

  Open this URL in your browser to use the scraper!

═══════════════════════════════════════════════════════════════
    `);
});
