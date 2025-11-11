import express from 'express';
import puppeteer from 'puppeteer';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Allow big HTML/CSS

// --- HELPER: Scroll function ---
const autoScroll = async (page) => {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve(true);
        }
      }, 100);
    });
  });
};

// --- HELPER: Function to get Used CSS ---
const getUsedCss = async (page, originalUrl) => {
  await autoScroll(page); 
  await new Promise(resolve => setTimeout(resolve, 500)); 
  const cssCoverage = await page.coverage.stopCSSCoverage();
  
  let allUsedCss = '';
  for (const entry of cssCoverage) {
    let baseUrl;
    try { baseUrl = new URL(entry.url); } catch (e) { baseUrl = new URL(originalUrl); }
    const basePath = baseUrl.origin + baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf('/') + 1);

    for (const range of entry.ranges) {
      let cssText = entry.text.substring(range.start, range.end);
      cssText = cssText.replace(/url\((['"]?)(?!data:|https?:\/\/|\/\/)([^'")]+)\1\)/g, (match, quote, relativeUrl) => {
        try {
          const absoluteUrl = new URL(relativeUrl, basePath).href;
          return `url(${quote}${absoluteUrl}${quote})`;
        } catch (e) { 
          console.warn(`Failed to resolve CSS URL: ${relativeUrl} with base ${basePath}`);
          return match; 
        }
      });
      allUsedCss += cssText + '\n';
    }
  }
  return allUsedCss;
};

// --- ENDPOINT 1: /api/scrape (FIXED for Render) ---
app.post('/api/scrape', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });
  try { new URL(url); } catch (error) { return res.status(400).json({ error: 'Invalid URL format' }); }

  console.log(`Scraping started for: ${url}`);
  let browser;
  try {
    // --- THIS IS THE RENDER FIX ---
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Added this for Render
        '--single-process' // Added this for Render
      ],
      // This tells Puppeteer to use the Chrome that Render already has installed
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined, 
    });
    // --- END OF FIX ---

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    await page.coverage.startCSSCoverage(); 
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    const htmlContent = await page.content();
    const usedCss = await getUsedCss(page, url); 

    await browser.close();
    console.log(`Scraping finished for: ${url}. Sent ${usedCss.length} chars of USED CSS.`);
    res.json({ html: htmlContent, css: usedCss });

  } catch (error) {
    console.error(`Scraping failed for ${url}:`, error);
    if (browser) await browser.close();
    let errorMessage = 'Failed to scrape the website.';
    if (error.message.includes('timeout')) errorMessage = 'Request timed out.';
    else if (error.message.includes('net::ERR')) errorMessage = 'Could not connect to the website.';
    res.status(500).json({ error: errorMessage });
  }
});

// --- ENDPOINT 2: /api/process-local (We don't need this, Upload Files is frontend-only) ---
// (We can leave the old code here, it won't be called)

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Scraper backend is running' });
});

app.listen(PORT, () => {
  console.log(`Scraper backend running on http://localhost:${PORT}`);
});