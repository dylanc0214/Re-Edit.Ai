import express from 'express';
import puppeteer from 'puppeteer';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS Configuration
const whitelist = [
  'https://re-edit-ai.vercel.app',
  'http://localhost:3000'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || whitelist.indexOf(origin) !== -1 || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      console.error('CORS error: Origin not allowed:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  }
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '50mb' }));

// HELPER: Scroll function
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

// HELPER: Function to get Used CSS
const getUsedCss = async (page, originalUrl) => {
  await autoScroll(page); 
  await new Promise(resolve => setTimeout(resolve, 500)); 
  const cssCoverage = await page.coverage.stopCSSCoverage();
  
  let allUsedCss = '';
  for (const entry of cssCoverage) {
    let baseUrl;
    try { 
      baseUrl = new URL(entry.url); 
    } catch (e) { 
      baseUrl = new URL(originalUrl); 
    }
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

// ENDPOINT 1: /api/scrape
app.post('/api/scrape', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });
  
  try { 
    new URL(url); 
  } catch (error) { 
    return res.status(400).json({ error: 'Invalid URL format' }); 
  }

  console.log(`Scraping started for: ${url}`);
  let browser;
  
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--single-process'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.coverage.startCSSCoverage(); 
    
    const htmlContent = await page.content();
    const usedCss = await getUsedCss(page, url); 

    await browser.close();
    console.log(`Scraping finished for: ${url}. Sent ${usedCss.length} chars of USED CSS.`);
    res.json({ html: htmlContent, css: usedCss });

  } catch (error) {
    console.error(`Scraping failed for ${url}:`, error); // Keep this
    if (browser) await browser.close();
    
    // THIS IS THE FIX: Send the REAL error message to the frontend
    // We check for error.message first, otherwise convert the whole error to a string.
    const realErrorMessage = error.message || String(error);
    
    res.status(500).json({ error: realErrorMessage });
  }
});

// ENDPOINT 2: /api/process-local
app.post('/api/process-local', async (req, res) => {
  const { html, css } = req.body;
  if (!html || !css) {
    return res.status(400).json({ error: 'HTML and CSS content are required' });
  }

  console.log(`Processing local files...`);
  let browser;
  
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--single-process'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined, 
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.coverage.startCSSCoverage();
    await page.addStyleTag({ content: css });
    const usedCss = await getUsedCss(page, 'http://localhost'); 

    await browser.close();
    console.log(`Local processing finished. Sent ${usedCss.length} chars of USED CSS.`);
    
    res.json({ html: html, css: usedCss });

  } catch (error) {
    console.error(`Local processing failed:`, error);
    if (browser) await browser.close();
    res.status(500).json({ error: 'Failed to process local files.' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Scraper backend is running' });
});

app.listen(PORT, () => {
  console.log(`Scraper backend is LISTENING on port ${PORT}`);
});