import express from 'express';
import puppeteer from 'puppeteer-core'; // 👈 Change this
import chromium from 'chrome-aws-lambda'; // 👈 Add this
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json()); // Back to default limit

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
          resolve();
        }
      }, 100);
    });
  });
};

// --- ENDPOINT 1: /api/scrape (FIXED) ---
app.post('/api/scrape', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });
  try { new URL(url); } catch (error) { return res.status(400).json({ error: 'Invalid URL format' }); }

  console.log(`Scraping started for: ${url}`);
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
      args: [
        ...chromium.args, // <-- This brings in all the important chromium args
    
        // --- Now we add YOUR args ---
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // 1. Start the scan BEFORE going to the page
    await page.coverage.startCSSCoverage(); 
    
    // 2. Go to the page
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // 3. Get the HTML
    const htmlContent = await page.content();
    
    // 4. Scroll and stop the scan
    await autoScroll(page);
    await new Promise(resolve => setTimeout(resolve, 500));
    const cssCoverage = await page.coverage.stopCSSCoverage();
    
    // --- Re-added the CSS processing logic here ---
    let allUsedCss = '';
    for (const entry of cssCoverage) {
      let baseUrl;
      try { baseUrl = new URL(entry.url); } catch (e) { baseUrl = new URL(url); }
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
    // --- End of CSS logic ---

    await browser.close();
    console.log(`Scraping finished for: ${url}. Sent ${allUsedCss.length} chars of USED CSS.`);
    res.json({ html: htmlContent, css: allUsedCss }); // Send allUsedCss

  } catch (error) {
    console.error(`Scraping failed for ${url}:`, error);
    if (browser) await browser.close();
    let errorMessage = 'Failed to scrape the website.';
    if (error.message.includes('timeout')) errorMessage = 'Request timed out.';
    else if (error.message.includes('net::ERR')) errorMessage = 'Could not connect to the website.';
    res.status(500).json({ error: errorMessage });
  }
});

// --- REMOVED THE BROKEN /api/process-local ENDPOINT ---

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Scraper backend is running' });
});

app.listen(PORT, () => {
  console.log(`Scraper backend running on http://localhost:${PORT}`);
});