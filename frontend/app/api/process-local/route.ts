import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium-min';

// --- HELPER: Scroll function ---
const autoScroll = async (page: any) => {
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
const getUsedCss = async (page: any, originalUrl: string) => {
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
      
      // --- FIX: Added types to the parameters ---
      cssText = cssText.replace(/url\((['"]?)(?!data:|https?:\/\/|\/\/)([^'")]+)\1\)/g, (match: string, quote: string, relativeUrl: string) => {
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

// --- This is the new API Endpoint ---
export async function POST(request: Request) {
  const { html, css } = await request.json();
  if (!html || !css) {
    return NextResponse.json({ error: 'HTML and CSS content are required' }, { status: 400 });
  }

  console.log(`Processing local files...`);
  let browser;
  try {
    // --- VERCEL FIX ---
    const executablePath = await chromium.executablePath();
    
    browser = await puppeteer.launch({
      args: chromium.args,
      // --- FIX: Cast chromium to 'any' to bypass TS error ---
      defaultViewport: (chromium as any).defaultViewport,
      executablePath: executablePath,
      headless: (chromium as any).headless,
      // --- END OF FIX ---
    });
    // --- END VERCEL FIX ---
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.coverage.startCSSCoverage();
    await page.addStyleTag({ content: css });
    const usedCss = await getUsedCss(page, 'http://localhost'); 

    await browser.close();
    console.log(`Local processing finished. Sent ${usedCss.length} chars of USED CSS.`);
    
    return NextResponse.json({ html: html, css: usedCss });

  } catch (error: any) {
    console.error(`Local processing failed:`, error);
    if (browser) await browser.close();
    return NextResponse.json({ error: 'Failed to process local files.' }, { status: 500 });
  }
}