import express from 'express';
import puppeteer from 'puppeteer-core'; // <-- This must be puppeteer-core
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3001;

// --- THIS IS THE CORS FIX ---
// 1. Define who is allowed to call your backend
const whitelist = [
  'https://re-edit-ai.vercel.app', // <--- YOUR LIVE VERCEL APP
  'http://localhost:3000'         // Your local computer for testing
];

const corsOptions = {
  origin: function (origin, callback) {
    // Check if the origin is in our whitelist OR if it's a Vercel preview URL
    // (origin.endsWith('.vercel.app') allows your preview deploys)
    if (!origin || whitelist.indexOf(origin) !== -1 || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      console.error('CORS error: Origin not allowed:', origin); // Log the bad origin
      callback(new Error('Not allowed by CORS'));
    }
  }
};

// 2. Use these new, smarter options
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // This line is new! It handles "pre-flight" requests.
// --- END OF FIX ---

app.use(express.json({ limit: '50mb' }));

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
    
    // 1. Go to the page FIRST
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // 2. NOW start the scan
    await page.coverage.startCSSCoverage(); 
    
    // 3. Get the HTML (after goto)
    const htmlContent = await page.content();
    
    // 4. Get the used CSS (this will scroll and stop the scan)
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

// --- ENDPOINT 2: /api/process-local (We don't need this) ---
app.post('/api/process-local', async (req, res) => {
  res.status(404).json({ error: 'This endpoint is not used in the Vercel+Render setup.' });
});


// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Scraper backend is running' });
});

app.listen(PORT, () => {
  // This log is just text, it doesn't do anything.
  console.log(`Scraper backend is LISTENING on port ${PORT} (provided by Render)`);
});