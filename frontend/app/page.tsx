'use client';

import { useState, useRef, useEffect } from 'react'; 
import postcss from 'postcss';
import html2canvas from 'html2canvas';
import tinycolor from 'tinycolor2'; 

// ------------------------------------------------------------------
// SCRIPT TO INJECT INTO IFRAME
// (This is unchanged)
// ------------------------------------------------------------------
const iframeListenerScript = `
  console.log('IFRAME LISTENER: Script Injected and RUNNING.');
  
  let overrideStyleTag = null;
  let highlightStyleTag = null; 
  let isTextEditEnabled = false;
  let lastHoveredTextElement = null;
  const TEXT_EDIT_TAGS = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SPAN', 'A', 'LI', 'BUTTON', 'LABEL', 'SMALL', 'STRONG', 'EM', 'TIME', 'BLOCKQUOTE', 'TD', 'TH', 'DIV'];
  let isImageEditEnabled = false;
  let lastHoveredImageElement = null;
  const IMAGE_EDIT_TAGS = ['IMG', 'SVG']; 
  window.parent.postMessage({ type: 'IFRAME_READY' }, '*');
  const handleTextMouseOver = (event) => { if (!isTextEditEnabled) return; const target = event.target; if (TEXT_EDIT_TAGS.includes(target.tagName)) { lastHoveredTextElement = target; target.style.outline = '2px dashed #FF00FF !important'; target.style.cursor = 'pointer'; } };
  const handleTextMouseOut = (event) => { if (lastHoveredTextElement) { lastHoveredTextElement.style.outline = ''; lastHoveredTextElement.style.cursor = 'default'; lastHoveredTextElement = null; } };
  const handleTextClick = (event) => { if (!isTextEditEnabled || !lastHoveredTextElement) return; event.preventDefault(); event.stopPropagation(); const target = lastHoveredTextElement; const tempId = 'live-edit-text-' + Date.now(); target.setAttribute('data-live-edit-id', tempId); window.parent.postMessage({ type: 'ELEMENT_CLICKED', tempId: tempId, currentText: target.innerText }, '*'); };
  const cleanupTextEdit = () => { document.body.removeEventListener('mouseover', handleTextMouseOver); document.body.removeEventListener('mouseout', handleTextMouseOut); document.body.removeEventListener('click', handleTextClick, true); if (lastHoveredTextElement) lastHoveredTextElement.style.outline = ''; document.querySelectorAll('[data-live-edit-id]').forEach(el => el.removeAttribute('data-live-edit-id')); console.log('IFRAME LISTENER: Text Edit Mode Disabled.'); };
  const handleImageMouseOver = (event) => { if (!isImageEditEnabled) return; const target = event.target; if (IMAGE_EDIT_TAGS.includes(target.tagName)) { lastHoveredImageElement = target; target.style.outline = '3px solid #00A8FF !important'; target.style.cursor = 'pointer'; } };
  const handleImageMouseOut = (event) => { if (lastHoveredImageElement) { lastHoveredImageElement.style.outline = ''; lastHoveredImageElement.style.cursor = 'default'; lastHoveredImageElement = null; } };
  const handleImageClick = (event) => { if (!isImageEditEnabled || !lastHoveredImageElement) return; event.preventDefault(); event.stopPropagation(); const target = lastHoveredImageElement; const tempId = 'live-edit-img-' + Date.now(); target.setAttribute('data-live-edit-id', tempId); let currentSrc = target.tagName === 'IMG' ? target.src : ''; window.parent.postMessage({ type: 'IMAGE_CLICKED', tempId: tempId, tagName: target.tagName, currentSrc: currentSrc }, '*'); };
  const cleanupImageEdit = () => { document.body.removeEventListener('mouseover', handleImageMouseOver); document.body.removeEventListener('mouseout', handleImageMouseOut); document.body.removeEventListener('click', handleImageClick, true); if (lastHoveredImageElement) lastHoveredImageElement.style.outline = ''; document.querySelectorAll('[data-live-edit-id]').forEach(el => el.removeAttribute('data-live-edit-id')); console.log('IFRAME LISTENER: Image Edit Mode Disabled.'); };
  window.addEventListener('message', (event) => { const msg = event.data; if (!msg) return; if (msg.type === 'CSS_OVERRIDE') { if (!overrideStyleTag) { overrideStyleTag = document.createElement('style'); overrideStyleTag.id = 'live-editor-overrides'; document.head.appendChild(overrideStyleTag); } overrideStyleTag.innerHTML = msg.css; } else if (msg.type === 'HIGHLIGHT_ELEMENTS') { if (!highlightStyleTag) { highlightStyleTag = document.createElement('style'); highlightStyleTag.id = 'live-editor-highlight'; document.head.appendChild(highlightStyleTag); } const selectors = msg.selectors; if (selectors && selectors.length > 0) { const selectorString = selectors.join(', '); const highlightRule = selectorString + ' { ' + '  outline: 3px solid #00FFFF !important;' + '  outline-offset: 2px;' + '  box-shadow: 0 0 15px 5px #00FFFF;' + '  transition: outline 0.1s linear, box-shadow 0.1s linear;' + ' }'; highlightStyleTag.innerHTML = highlightRule; } } else if (msg.type === 'CLEAR_HIGHLIGHT') { if (highlightStyleTag) { highlightStyleTag.innerHTML = ''; } } else if (msg.type === 'ENABLE_TEXT_EDIT') { isTextEditEnabled = true; cleanupImageEdit(); isImageEditEnabled = false; document.body.addEventListener('mouseover', handleTextMouseOver); document.body.addEventListener('mouseout', handleTextMouseOut); document.body.addEventListener('click', handleTextClick, true); console.log('IFRAME LISTENER: Text Edit Mode Enabled.'); } else if (msg.type === 'DISABLE_TEXT_EDIT') { isTextEditEnabled = false; cleanupTextEdit(); } else if (msg.type === 'UPDATE_TEXT') { const el = document.querySelector('[data-live-edit-id="' + msg.tempId + '"]'); if (el) el.innerText = msg.newText; } else if (msg.type === 'ENABLE_IMAGE_EDIT') { isImageEditEnabled = true; cleanupTextEdit(); isTextEditEnabled = false; document.body.addEventListener('mouseover', handleImageMouseOver); document.body.addEventListener('mouseout', handleImageMouseOut); document.body.addEventListener('click', handleImageClick, true); console.log('IFRAME LISTENER: Image Edit Mode Enabled.'); } else if (msg.type === 'DISABLE_IMAGE_EDIT') { isImageEditEnabled = false; cleanupImageEdit(); } else if (msg.type === 'UPDATE_IMAGE') { const el = document.querySelector('[data-live-edit-id="' + msg.tempId + '"]'); if (!el) return; if (msg.action === 'replace') { if (el.tagName === 'IMG') { el.src = msg.newSrc; } else if (el.tagName === 'SVG') { el.style.display = 'none'; } } else if (msg.action === 'remove') { el.style.visibility = 'hidden'; } else if (msg.action === 'fill') { if (el.tagName === 'IMG') { el.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; el.style.backgroundColor = msg.newColor; } else if (el.tagName === 'SVG') { el.style.fill = msg.newColor; el.querySelectorAll('path').forEach(path => { path.style.fill = msg.newColor; }); } } } });
`;

// ------------------------------------------------------------------
// HELPER FUNCTION: Make URLs Absolute
// (This is unchanged)
// ------------------------------------------------------------------
function makeUrlsAbsolute(html: string, baseUrl: string | null): string {
  if (!baseUrl) {
    return html;
  }
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const base = new URL(baseUrl);
    
    // Fix image sources
    doc.querySelectorAll('img[src]').forEach(img => {
      const src = img.getAttribute('src');
      if (src && !src.startsWith('data:') && !src.startsWith('http')) {
        try { img.setAttribute('src', new URL(src, base).href); } catch (e) { console.warn('Failed to convert image URL:', src); }
      }
    });
    
    // Fix link hrefs
    doc.querySelectorAll('link[href]:not([rel="stylesheet"])').forEach(link => {
      const href = link.getAttribute('href');
      // --- THIS IS THE FIX ---
      if (href && !href.startsWith('data:') && !href.startsWith('http')) { 
      // --- END OF FIX ---
        try { link.setAttribute('href', new URL(href, base).href); } catch (e) { console.warn('Failed to convert link URL:', href); }
      }
    });
    
    // Fix background images in inline styles
    doc.querySelectorAll('[style]').forEach(el => {
      const style = el.getAttribute('style');
      if (style && style.includes('url(')) {
        const newStyle = style.replace(/url\((['"]?)(?!data:|https?:\/\/)([^'")]+)\1\)/g, (match, quote, relativeUrl) => {
          try {
            const absoluteUrl = new URL(relativeUrl, base).href;
            return `url(${quote}${absoluteUrl}${quote})`;
          } catch (e) { return match; }
        });
        el.setAttribute('style', newStyle);
      }
    });
    
    return doc.documentElement.outerHTML;
  } catch (error) {
    console.error('Error making URLs absolute:', error);
    return html;
  }
}

// ------------------------------------------------------------------
// MAIN PAGE COMPONENT
// (This is unchanged)
// ------------------------------------------------------------------
export default function Home() {
  const [targetUrl, setTargetUrl] = useState('');
  const [iframeContent, setIframeContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [iframeReady, setIframeReady] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  // State for all style properties
  const [colorChanges, setColorChanges] = useState<Map<string, string>>(new Map());
  const [colorSelectorMap, setColorSelectorMap] = useState<Map<string, { selector: string; property: string }[]>>(new Map());
  const [fontChanges, setFontChanges] = useState<Map<string, string>>(new Map());
  const [fontSelectorMap, setFontSelectorMap] = useState<Map<string, { selector: string; property: string }[]>>(new Map());
  const [fontSizeChanges, setFontSizeChanges] = useState<Map<string, string>>(new Map());
  const [fontSizeSelectorMap, setFontSizeSelectorMap] = useState<Map<string, { selector: string; property: string }[]>>(new Map());
  const [spacingChanges, setSpacingChanges] = useState<Map<string, string>>(new Map());
  const [spacingSelectorMap, setSpacingSelectorMap] = useState<Map<string, { selector: string; property: string }[]>>(new Map());

  // --- Text Edit State ---
  const [isTextEditMode, setIsTextEditMode] = useState(false);
  const [editingTextElement, setEditingTextElement] = useState<{ id: string; text: string } | null>(null);
  
  // --- Image Edit State ---
  const [isImageEditMode, setIsImageEditMode] = useState(false);
  const [editingImageElement, setEditingImageElement] = useState<{ id: string; tagName: string; src: string } | null>(null);
  const [fillColor, setFillColor] = useState('#000000');
  
  // --- Sidebar State ---
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  
  // --- "Upload Files" mode state ---
  const [mode, setMode] = useState<'scrape' | 'local'>('scrape');
  const [localHtml, setLocalHtml] = useState('');
  const [localCss, setLocalCss] = useState('');
  const [htmlFileName, setHtmlFileName] = useState('');
  const [cssFileName, setCssFileName] = useState('');
  // ---------------------------------------------

  // --- Constants for CSS properties to find (Unchanged) ---
  const COLOR_PROPERTIES = [ 
    'color', 'background-color', 
    'fill', 'stroke', 'outline-color',
    'border-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
    'background', 'border', 'border-left', 'border-right', 'border-top', 'border-bottom', 
    'box-shadow' 
  ];
  
  const FONT_PROPERTIES = ['font-family'];
  const FONT_SIZE_PROPERTIES = ['font-size'];
  const SPACING_PROPERTIES = [ 'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left' ];

  // ------------------------------------------------------------------
  // LISTEN FOR IFRAME MESSAGES
  // (This is unchanged)
  // ------------------------------------------------------------------
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'IFRAME_READY') {
        console.log('PARENT: Iframe is ready!');
        setIframeReady(true);
      }
      if (event.data && event.data.type === 'ELEMENT_CLICKED') {
        setEditingTextElement({ id: event.data.tempId, text: event.data.currentText });
      }
      if (event.data && event.data.type === 'IMAGE_CLICKED') {
        setEditingImageElement({ id: event.data.tempId, tagName: event.data.tagName, src: event.data.currentSrc });
        setFillColor('#000000');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // ------------------------------------------------------------------
  // --- ⭐️⭐️⭐️ NEW UPGRADED CSS PARSING LOGIC ⭐️⭐️⭐️ ---
  // (Now handles <style> blocks from the HTML)
  // ------------------------------------------------------------------
  const parseAllStyles = (cssString: string, htmlString: string): {
    processedHtml: string;
    colorMap: Map<string, { selector: string; property: string }[]>;
    fontMap: Map<string, { selector: string; property: string }[]>;
    fontSizeMap: Map<string, { selector: string; property: string }[]>;
    spacingMap: Map<string, { selector: string; property: string }[]>;
  } => {
    console.log('--- STARTING UPGRADED CSS PARSE (CSS file + HTML <style> + Inline [style]) ---');
    
    const newColorSelectorMap = new Map<string, { selector: string; property: string }[]>();
    const newFontSelectorMap = new Map<string, { selector: string; property: string }[]>();
    const newFontSizeSelectorMap = new Map<string, { selector: string; property: string }[]>();
    const newSpacingSelectorMap = new Map<string, { selector: string; property: string }[]>();

    const cssVariables = new Map<string, string>();
    const variableRegex = /var\((--[\w-]+)\)/g;
    
    const colorRegex = /(#(?:[0-9a-f]{3}){1,2}\b|rgba?\([^)]+\)|hsla?\([^)]+\))/gi;
    const filterList = ['inherit', 'initial', 'auto', 'unset'];

    // Helper function to resolve CSS variables
    const resolveValue = (value: string, maxDepth = 10): string => {
      if (maxDepth <= 0) {
        console.warn('CSS Variable resolution depth exceeded, possible circular reference:', value);
        return value;
      }
      let match = variableRegex.exec(value);
      if (match) {
        const varName = match[1];
        const varValue = cssVariables.get(varName);
        if (varValue) {
          const newValue = value.replace(match[0], varValue);
          return resolveValue(newValue, maxDepth - 1);
        }
      }
      return value;
    };

    // --- ⭐️ NEW: PART 1: Extract <style> blocks from HTML ---
    let processedHtml = htmlString;
    let inlineStyleTagCss = '';
    try {
      const doc = new DOMParser().parseFromString(htmlString, 'text/html');
      doc.querySelectorAll('style').forEach(styleTag => {
        inlineStyleTagCss += styleTag.textContent || '';
        // Remove the style tag from the document so it's not processed twice
        // (it will be injected later in prepareIframe)
        styleTag.remove(); 
      });
      processedHtml = doc.documentElement.outerHTML;
      console.log('PARSE: Extracted', inlineStyleTagCss.length, 'chars from <style> blocks.');
    } catch (e) {
      console.error('Error parsing <style> tags from HTML:', e);
      // processedHtml is still the original htmlString
    }
    
    // --- NEW: Combine external CSS file with inline <style> block CSS ---
    const combinedCssString = inlineStyleTagCss + '\n' + cssString;

    // --- PART 2: Parse the combined .css file + <style> blocks ---
    try {
      const root = postcss.parse(combinedCssString);
      
      // Pass 1 - Find all CSS Variables
      console.log('PARSE: Pass 1 - Finding CSS Variables...');
      root.walkRules(rule => {
        rule.walkDecls(decl => {
          if (decl.prop.startsWith('--')) {
            cssVariables.set(decl.prop, decl.value.trim());
          }
        });
      });
      console.log('PARSE: Found', cssVariables.size, 'CSS variables.');

      // Pass 2 - Parse all declarations and resolve variables
      console.log('PARSE: Pass 2 - Parsing rules and resolving variables...');
      root.walkRules(rule => {
        rule.walkDecls(decl => {
          if (decl.prop.startsWith('--')) return;

          const propLower = decl.prop.toLowerCase();
          const originalValue = decl.value.trim();
          const property = decl.prop;
          const selector = rule.selector;
          const value = resolveValue(originalValue);

          // Smarter Color Parsing
          if (COLOR_PROPERTIES.includes(propLower)) {
            let colorsFound: string[] = [];
            const matches = value.match(colorRegex);
            if (matches) { 
              colorsFound = matches; 
            }
            if (colorsFound.length === 0 && tinycolor(value).isValid()) {
              colorsFound.push(value);
            }
            for (const colorValue of colorsFound) {
              const colorObj = tinycolor(colorValue);
              if (colorObj.isValid()) { const hexColor = colorObj.toHexString(); if (!newColorSelectorMap.has(hexColor)) { newColorSelectorMap.set(hexColor, []); } newColorSelectorMap.get(hexColor)?.push({ selector, property }); }
            }
          }
          // Font Family
          if (FONT_PROPERTIES.includes(propLower)) {
            const fontValue = value.split(',')[0].replace(/['"]/g, '').trim(); 
            if (fontValue && !filterList.includes(fontValue)) { if (!newFontSelectorMap.has(fontValue)) { newFontSelectorMap.set(fontValue, []); } newFontSelectorMap.get(fontValue)?.push({ selector, property }); }
          }
          // Font Size
          if (FONT_SIZE_PROPERTIES.includes(propLower)) {
            if (value && !filterList.includes(value)) { if (!newFontSizeSelectorMap.has(value)) { newFontSizeSelectorMap.set(value, []); } newFontSizeSelectorMap.get(value)?.push({ selector, property }); }
          }
          // Spacing
          if (SPACING_PROPERTIES.includes(propLower)) {
            if (value && !filterList.includes(value)) { if (!newSpacingSelectorMap.has(value)) { newSpacingSelectorMap.set(value, []); } newSpacingSelectorMap.get(value)?.push({ selector, property }); }
          }
        });
      });
    } catch (error) {
      console.error('Failed to parse CSS file:', error);
      setErrorMessage('Failed to parse the provided CSS file.');
    }

    // --- PART 3: Parse the HTML for inline [style] attributes ---
    // (This part also benefits from the cssVariables map)
    try {
      const doc = new DOMParser().parseFromString(processedHtml, 'text/html'); // Use the already-processed HTML
      let inlineStyleCounter = 0;

      doc.querySelectorAll('[style]').forEach(el => {
        const styleString = el.getAttribute('style');
        if (!styleString) return;

        const tempId = `inline-style-${inlineStyleCounter++}`;
        el.setAttribute('data-inline-id', tempId);
        const selector = `[data-inline-id="${tempId}"]`;

        styleString.split(';').forEach(styleRule => {
          const parts = styleRule.split(':');
          if (parts.length < 2) return;
          
          const property = parts[0].trim().toLowerCase();
          const originalValue = parts.slice(1).join(':').trim();
          const value = resolveValue(originalValue);

          // Smarter Color Parsing (for inline styles)
          if (COLOR_PROPERTIES.includes(property)) {
            let colorsFound: string[] = [];
            const matches = value.match(colorRegex);
            if (matches) { 
              colorsFound = matches; 
            }
            if (colorsFound.length === 0 && tinycolor(value).isValid()) {
              colorsFound.push(value);
            }
            for (const colorValue of colorsFound) {
              const colorObj = tinycolor(colorValue);
              if (colorObj.isValid()) { const hexColor = colorObj.toHexString(); if (!newColorSelectorMap.has(hexColor)) { newColorSelectorMap.set(hexColor, []); } newColorSelectorMap.get(hexColor)?.push({ selector, property }); }
            }
          }
          // Font Family
          if (FONT_PROPERTIES.includes(property)) {
            const fontValue = value.split(',')[0].replace(/['"]/g, '').trim(); 
            if (fontValue && !filterList.includes(fontValue)) { if (!newFontSelectorMap.has(fontValue)) { newFontSelectorMap.set(fontValue, []); } newFontSelectorMap.get(fontValue)?.push({ selector, property }); }
          }
          // Font Size
          if (FONT_SIZE_PROPERTIES.includes(property)) {
            if (value && !filterList.includes(value)) { if (!newFontSizeSelectorMap.has(value)) { newFontSizeSelectorMap.set(value, []); } newFontSizeSelectorMap.get(value)?.push({ selector, property }); }
          }
          // Spacing
          if (SPACING_PROPERTIES.includes(property)) {
            if (value && !filterList.includes(value)) { if (!newSpacingSelectorMap.has(value)) { newSpacingSelectorMap.set(value, []); } newSpacingSelectorMap.get(value)?.push({ selector, property }); }
          }
        });
      });
      
      processedHtml = doc.documentElement.outerHTML;
      
    } catch (error) {
      console.error('Failed to parse inline HTML styles:', error);
    }

    // --- PART 4: Set the state (unchanged) ---
    console.log('PARSE: Found', newColorSelectorMap.size, 'unique colors (CSS + <style> + Inline).');
    setColorSelectorMap(newColorSelectorMap);
    const initialColorMap = new Map<string, string>(); newColorSelectorMap.forEach((_, color) => initialColorMap.set(color, color)); setColorChanges(initialColorMap);
    
    console.log('PARSE: Found', newFontSelectorMap.size, 'unique fonts (CSS + <style> + Inline).');
    setFontSelectorMap(newFontSelectorMap);
    const initialFontMap = new Map<string, string>(); newFontSelectorMap.forEach((_, font) => initialFontMap.set(font, font)); setFontChanges(initialFontMap);
    
    console.log('PARSE: Found', newFontSizeSelectorMap.size, 'unique font sizes (CSS + <style> + Inline).');
    setFontSizeSelectorMap(newFontSizeSelectorMap);
    const initialFontSizeMap = new Map<string, string>(); newFontSizeSelectorMap.forEach((_, size) => initialFontSizeMap.set(size, size)); setFontSizeChanges(initialFontSizeMap);
    
    console.log('PARSE: Found', newSpacingSelectorMap.size, 'unique spacing values (CSS + <style> + Inline).');
    setSpacingSelectorMap(newSpacingSelectorMap);
    const initialSpacingMap = new Map<string, string>(); newSpacingSelectorMap.forEach((_, size) => initialSpacingMap.set(size, size)); setSpacingChanges(initialSpacingMap);

    return { 
      processedHtml, // This HTML no longer has the <style> tags in it
      colorMap: newColorSelectorMap, 
      fontMap: newFontSelectorMap, 
      fontSizeMap: newFontSizeSelectorMap, 
      spacingMap: newSpacingSelectorMap
    };
  };

  // ------------------------------------------------------------------
  // --- REFACTORED IFRAME PREPARATION ---
  // (This is unchanged)
  // ------------------------------------------------------------------
  const prepareIframe = (htmlString: string, cssString: string, baseUrl: string | null) => {
    console.log('--- PREPARING IFRAME ---');
    let processedHtml = htmlString;
    if (baseUrl) { processedHtml = makeUrlsAbsolute(htmlString, baseUrl); }

    // --- ⭐️ NEW: Combine external CSS with <style> block CSS ---
    // We get the <style> CSS again just for the iframe injection.
    let inlineStyleTagCss = '';
    try {
      const doc = new DOMParser().parseFromString(htmlString, 'text/html');
      doc.querySelectorAll('style').forEach(styleTag => {
        inlineStyleTagCss += styleTag.textContent || '';
        styleTag.remove(); // Remove them so we can inject our combined <style>
      });
      processedHtml = doc.documentElement.outerHTML; // Use the HTML *without* the <style> tags
    } catch (e) { console.error('Error parsing <style> tags for iframe:', e); }
    
    const combinedCssString = inlineStyleTagCss + '\n' + cssString;
    // --- End of new logic ---

    const styleTag = `<style>${combinedCssString}</style>`; // 👈 Inject the COMBINED CSS
    const scriptTag = `<script>${iframeListenerScript}</script>`;
    const cspMetaTagRegex = /<meta\s+http-equiv=["']Content-Security-Policy["'][\s\S]*?>/gi;
    const xFrameMetaTagRegex = /<meta\s+http-equiv=["']X-Frame-Options["'][\s\S]*?>/gi;
    
    // We already removed <style> tags, so no need to do it again.
    const modifiedHtml = processedHtml
      .replace(cspMetaTagRegex, '')
      .replace(xFrameMetaTagRegex, '')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script\b[^>]*>/g, "")
      .replace(/<\/head>/i, `${scriptTag}${styleTag}</head>`);
      
    const cleanedHtml = modifiedHtml.replace( /<link[^>]*href=["']\/(?!http)[^"']+\.css["'][^>]*>/gi, '' );
    setIframeContent(cleanedHtml);
    console.log('PREPARE: Prepared HTML for iframe.');
  };


  // ------------------------------------------------------------------
  // HANDLE SCRAPE
  // (This is unchanged)
  // ------------------------------------------------------------------
  const handleScrape = async () => {
    if (!targetUrl) { setErrorMessage('Please enter a URL'); return; }
    try { new URL(targetUrl); } catch { setErrorMessage('Please enter a valid URL (including https://)'); return; }
    
    setIsLoading(true); setIframeContent(''); setIframeReady(false); setErrorMessage(''); setIsTextEditMode(false); setEditingTextElement(null); setIsImageEditMode(false); setEditingImageElement(null);

    try {
      console.log('--- STARTING SCRAPE ---');
      const response = await fetch('https://re-edit-ai.onrender.com/api/scrape', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: targetUrl }),
      });
      if (!response.ok) { const errorData = await response.json().catch(() => ({ error: 'Scrape failed' })); throw new Error(errorData.error || 'Failed to fetch website'); }
      const data = await response.json(); 
      console.log('SCRAPE: Received data from backend.');
      
      const { processedHtml } = parseAllStyles(data.css, data.html);
      prepareIframe(processedHtml, data.css, targetUrl); 

    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message || 'An error occurred while fetching the website');
    } finally {
      setIsLoading(false);
    }
  };
  
  // ------------------------------------------------------------------
  // --- UPLOAD FILES HANDLERS ---
  // (This is unchanged)
  // ------------------------------------------------------------------
  const handleHtmlUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setHtmlFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        setLocalHtml(e.target?.result as string);
      };
      reader.readAsText(file);
    }
  };
  
  const handleCssUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setCssFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        setLocalCss(e.target?.result as string);
      };
      reader.readAsText(file);
    }
  };
  
  // --- UPDATED handleLoadLocal ---
  const handleLoadLocal = () => {
    // ⭐️ We no longer require the CSS file! It's optional.
    if (!localHtml) {
      setErrorMessage('Please upload an HTML file.');
      return;
    }
    
    setIsLoading(true); setIframeContent(''); setIframeReady(false); setErrorMessage(''); setIsTextEditMode(false); setEditingTextElement(null); setIsImageEditMode(false); setEditingImageElement(null);

    try {
      console.log('--- STARTING LOCAL LOAD (Frontend-Only) ---');
      // localCss might be an empty string, which is fine.
      // parseAllStyles will get everything from the <style> blocks in localHtml.
      const { processedHtml } = parseAllStyles(localCss, localHtml);
      prepareIframe(processedHtml, localCss, null); 
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message || 'An error occurred while loading local code');
    } finally {
      setIsLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // --- GENERATE & POST OVERRIDES ---
  // (This is unchanged)
  // ------------------------------------------------------------------
  const generateAndPostOverrides = (
    newColorMap: Map<string, string>,
    newFontMap: Map<string, string>,
    newFontSizeMap: Map<string, string>,
    newSpacingMap: Map<string, string>
  ) => {
    if (!iframeReady) {
      console.warn('PARENT: Iframe not ready yet, skipping override.');
      return;
    }

    let overrideCss = '';
    
    // Color overrides
    newColorMap.forEach((newColor, oldColor) => {
      if (newColor !== oldColor) {
        const rules = colorSelectorMap.get(oldColor);
        if (rules) {
          rules.forEach(rule => {
            let propertyToOverride = rule.property.toLowerCase();

            if (propertyToOverride.startsWith('border')) {
              if (!propertyToOverride.endsWith('-color')) {
                propertyToOverride = propertyToOverride + '-color';
              }
            }
            
            overrideCss += `${rule.selector} { ${propertyToOverride}: ${newColor} !important; }\n`;

          });
        }
      }
    });
    
    // Font overrides (Unchanged)
    newFontMap.forEach((newFont, oldFont) => {
      if (newFont !== oldFont) { const rules = fontSelectorMap.get(oldFont); if (rules) { const safeFont = newFont.includes(' ') ? `'${newFont}'` : newFont; rules.forEach(rule => { overrideCss += `${rule.selector} { ${rule.property}: ${safeFont}, sans-serif !important; }\n`; }); } }
    });

    // Font size overrides (Unchanged)
    newFontSizeMap.forEach((newSize, oldSize) => {
      if (newSize !== oldSize) { const rules = fontSizeSelectorMap.get(oldSize); if (rules) { rules.forEach(rule => { overrideCss += `${rule.selector} { ${rule.property}: ${newSize} !important; }\n`; }); } }
    });

    // Spacing overrides (Unchanged)
    newSpacingMap.forEach((newValue, oldValue) => {
      if (newValue !== oldValue) { const rules = spacingSelectorMap.get(oldValue); if (rules) { rules.forEach(rule => { overrideCss += `${rule.selector} { ${rule.property}: ${newValue} !important; }\n`; }); } }
    });

    console.log('PARENT: Posting CSS_OVERRIDE message...');
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'CSS_OVERRIDE', css: overrideCss },
      '*'
    );
  };
  
  // ------------------------------------------------------------------
  // APPLY OVERRIDES WHEN IFRAME IS READY
  // (This is unchanged)
  // ------------------------------------------------------------------
  useEffect(() => {
    const hasChanges = colorChanges.size > 0 || fontChanges.size > 0 || fontSizeChanges.size > 0 || spacingChanges.size > 0;
    if (iframeReady && hasChanges) {
      console.log('PARENT: Iframe ready, applying initial overrides...');
      generateAndPostOverrides(colorChanges, fontChanges, fontSizeChanges, spacingChanges);
    }
  }, [iframeReady, colorChanges, fontChanges, fontSizeChanges, spacingChanges]);

  // ------------------------------------------------------------------
  // PROPERTY CHANGE HANDLERS
  // (This is unchanged)
  // ------------------------------------------------------------------
  const handleColorChange = (oldColor: string, newColor: string) => { const newMap = new Map(colorChanges); newMap.set(oldColor, newColor); setColorChanges(newMap); generateAndPostOverrides(newMap, fontChanges, fontSizeChanges, spacingChanges); };
  const handleFontChange = (oldFont: string, newFont: string) => { const newMap = new Map(fontChanges); newMap.set(oldFont, newFont); setFontChanges(newMap); generateAndPostOverrides(colorChanges, newMap, fontSizeChanges, spacingChanges); };
  const handleFontSizeChange = (oldSize: string, newSize: string) => { const newMap = new Map(fontSizeChanges); newMap.set(oldSize, newSize); setFontSizeChanges(newMap); generateAndPostOverrides(colorChanges, fontChanges, newMap, spacingChanges); };
  const handleSpacingChange = (oldValue: string, newValue: string) => { const newMap = new Map(spacingChanges); newMap.set(oldValue, newValue); setSpacingChanges(newMap); generateAndPostOverrides(colorChanges, fontChanges, fontSizeChanges, newMap); };

  // --- Text Edit Handlers ---
  // (This is unchanged)
  const toggleTextEditMode = (forceDisable = false) => { const newMode = forceDisable ? false : !isTextEditMode; setIsTextEditMode(newMode); if (newMode) { if (isImageEditMode) toggleImageEditMode(true); iframeRef.current?.contentWindow?.postMessage({ type: 'ENABLE_TEXT_EDIT' }, '*'); } else { iframeRef.current?.contentWindow?.postMessage({ type: 'DISABLE_TEXT_EDIT' }, '*'); setEditingTextElement(null); } };
  const handleTextEditChange = (newText: string) => { if (!editingTextElement) return; setEditingTextElement({ ...editingTextElement, text: newText }); iframeRef.current?.contentWindow?.postMessage({ type: 'UPDATE_TEXT', tempId: editingTextElement.id, newText: newText }, '*'); };
  const closeTextEditor = () => { setEditingTextElement(null); };

  // --- Image Edit Handlers ---
  // (This is unchanged)
  const toggleImageEditMode = (forceDisable = false) => { const newMode = forceDisable ? false : !isImageEditMode; setIsImageEditMode(newMode); if (newMode) { if (isTextEditMode) toggleTextEditMode(true); iframeRef.current?.contentWindow?.postMessage({ type: 'ENABLE_IMAGE_EDIT' }, '*'); } else { iframeRef.current?.contentWindow?.postMessage({ type: 'DISABLE_IMAGE_EDIT' }, '*'); setEditingImageElement(null); } };
  const closeImageEditor = () => { setEditingImageElement(null); };
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => { if (!event.target.files || !event.target.files[0] || !editingImageElement) return; const file = event.target.files[0]; const reader = new FileReader(); reader.onload = () => { const dataUrl = reader.result as string; iframeRef.current?.contentWindow?.postMessage({ type: 'UPDATE_IMAGE', tempId: editingImageElement.id, action: 'replace', newSrc: dataUrl, tagName: editingImageElement.tagName }, '*'); closeImageEditor(); }; reader.readAsDataURL(file); event.target.value = ''; };
  const handleImageRemove = () => { if (!editingImageElement) return; iframeRef.current?.contentWindow?.postMessage({ type: 'UPDATE_IMAGE', tempId: editingImageElement.id, action: 'remove', tagName: editingImageElement.tagName }, '*'); closeImageEditor(); };
  const handleImageFill = () => { if (!editingImageElement) return; iframeRef.current?.contentWindow?.postMessage({ type: 'UPDATE_IMAGE', tempId: editingImageElement.id, action: 'fill', newColor: fillColor, tagName: editingImageElement.tagName }, '*'); closeImageEditor(); };
  
  // ------------------------------------------------------------------
  // HANDLE EXPORT
  // (This is unchanged)
  // ------------------------------------------------------------------
  const handleExport = async () => {
    if (!iframeRef.current || !iframeRef.current.contentWindow) { setErrorMessage('Please fetch a website first.'); return; }
    setIsExporting(true); setErrorMessage('');
    if (isTextEditMode) { iframeRef.current?.contentWindow?.postMessage({ type: 'DISABLE_TEXT_EDIT' }, '*'); }
    if (isImageEditMode) { iframeRef.current?.contentWindow?.postMessage({ type: 'DISABLE_IMAGE_EDIT' }, '*'); }
    try {
      const iframeDoc = iframeRef.current.contentWindow.document; const iframeBody = iframeDoc.body;
      await new Promise(resolve => setTimeout(resolve, 500));
      const canvas = await html2canvas(iframeBody, { allowTaint: true, useCORS: true, width: iframeBody.scrollWidth, height: iframeBody.scrollHeight, windowWidth: iframeBody.scrollWidth, windowHeight: iframeBody.scrollHeight, logging: true, });
      const imageUrl = canvas.toDataURL('image/png'); const link = document.createElement('a'); link.href = imageUrl; link.download = `website-export-${Date.now()}.png`; document.body.appendChild(link); link.click(); document.body.removeChild(link);
    } catch (error) { console.error('Export failed:', error); setErrorMessage('Failed to export image. Some websites may not be exportable due to security restrictions.');
    } finally {
      setIsExporting(false);
      if (isTextEditMode) { iframeRef.current?.contentWindow?.postMessage({ type: 'ENABLE_TEXT_EDIT' }, '*'); }
      if (isImageEditMode) { iframeRef.current?.contentWindow?.postMessage({ type: 'ENABLE_IMAGE_EDIT' }, '*'); }
    }
  };
  
  // ------------------------------------------------------------------
  // HIGHLIGHT HANDLERS
  // (This is unchanged)
  // ------------------------------------------------------------------
  const handleHighlightStart = (oldColor: string) => { if (!iframeReady || isTextEditMode || isImageEditMode) return; const rules = colorSelectorMap.get(oldColor); if (!rules) return; const uniqueSelectors = [...new Set(rules.map(rule => rule.selector))]; iframeRef.current?.contentWindow?.postMessage( { type: 'HIGHLIGHT_ELEMENTS', selectors: uniqueSelectors }, '*' ); };
  const handleHighlightEnd = () => { if (!iframeReady || isTextEditMode || isImageEditMode) return; iframeRef.current?.contentWindow?.postMessage( { type: 'CLEAR_HIGHLIGHT' }, '*' ); };

  // ------------------------------------------------------------------
  // WRITE CONTENT TO IFRAME
  // (This is unchanged)
  // ------------------------------------------------------------------
  useEffect(() => {
    if (iframeContent && iframeRef.current) {
      console.log('useEffect: iframeContent changed. Writing to iframe...');
      setIframeReady(false);
      const doc = iframeRef.current.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(iframeContent);
        doc.close();
        console.log('useEffect: Wrote content to iframe.');
      }
    }
  }, [iframeContent]);

  // ------------------------------------------------------------------
  // RENDER UI
  // (This is unchanged, but the 'Upload CSS' is now optional)
  // ------------------------------------------------------------------
  return (
    <main className="flex flex-row w-full h-screen bg-gray-900 text-white">
      
      {/* LEFT SIDEBAR */}
      {isSidebarVisible && (
        <div className="flex flex-col w-96 p-4 border-r border-gray-700 overflow-y-auto shrink-0 relative">
          
          {/* --- Floating Text/Image Editors (Unchanged) --- */}
          {editingTextElement && ( <div className="absolute inset-0 bg-gray-900/90 backdrop-blur-sm z-10 p-4 flex flex-col"> <div className="flex justify-between items-center mb-3"> <h3 className="text-md font-semibold text-fuchsia-400">Edit Text</h3> <button onClick={closeTextEditor} className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded"> Done </button> </div> <textarea value={editingTextElement.text} onChange={(e) => handleTextEditChange(e.target.value)} className="w-full h-48 p-2 bg-gray-800 border border-gray-600 rounded-md outline-none focus:ring-2 focus:ring-fuchsia-500 text-sm" /> <p className="text-xs text-gray-500 mt-2"> Changes are applied live. Click "Done" to close this editor. </p> </div> )}
          {editingImageElement && ( <div className="absolute inset-0 bg-gray-900/90 backdrop-blur-sm z-10 p-4 flex flex-col"> <div className="flex justify-between items-center mb-4"> <h3 className="text-md font-semibold text-blue-400">Edit Image/Icon</h3> <button onClick={closeImageEditor} className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded"> Done </button> </div> <div className="flex flex-col gap-3"> <label className="w-full px-5 py-2 text-center font-semibold bg-blue-600 rounded-md hover:bg-blue-500 transition-colors cursor-pointer"> Upload & Replace <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} /> </label> <button onClick={handleImageRemove} className="w-full px-5 py-2 font-semibold bg-red-600 rounded-md hover:bg-red-500 transition-colors"> Remove </button> <div className="flex flex-col gap-2 p-3 bg-gray-800 rounded-md"> <p className="text-sm">Fill with color:</p> <div className="flex gap-2"> <input type="color" value={fillColor} className="w-12 h-10 p-0 border-0 rounded cursor-pointer bg-transparent" onChange={(e) => setFillColor(e.target.value)} /> <button onClick={handleImageFill} className="flex-1 px-4 py-2 font-semibold bg-green-600 rounded-md hover:bg-green-500 transition-colors"> Apply Fill </button> </div> </div> </div> </div> )}

          <h2 className="text-lg font-semibold mb-4">Style Editor</h2>
          
          {/* --- TABS --- */}
          <div className="flex w-full border-b border-gray-700 mb-4">
            <button
              onClick={() => setMode('scrape')}
              className={`flex-1 py-2 text-sm font-medium ${mode === 'scrape' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-200'}`}
            >
              Scrape URL
            </button>
            <button
              onClick={() => setMode('local')}
              className={`flex-1 py-2 text-sm font-medium ${mode === 'local' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-200'}`}
            >
              Upload Files
            </button>
          </div>
          {/* --- END TABS --- */}

          {/* --- Main Controls (Now conditional) --- */}
          <div className="flex flex-col gap-2 mb-6">
            
            {/* --- MODE 1: SCRAPE URL (Your original code) --- */}
            {mode === 'scrape' && (
              <>
                <input
                  type="text"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleScrape()}
                  placeholder="E.g., https://example.com"
                  className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isTextEditMode || isImageEditMode}
                />
                <button
                  onClick={handleScrape}
                  disabled={isLoading || isExporting || isTextEditMode || isImageEditMode}
                  className="w-full px-5 py-2 font-semibold bg-blue-600 rounded-md hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? 'Loading...' : 'Fetch Website'}
                </button>
              </>
            )}
            
            {/* --- MODE 2: UPLOAD FILES (The new function) --- */}
            {mode === 'local' && (
              <div className="flex flex-col gap-3">
              
                {/* --- GUIDANCE --- */}
                <div className="p-3 bg-gray-800 border border-gray-700 rounded-md text-sm">
                  <p className="font-semibold mb-2 text-blue-300">How to Upload (for login pages):</p>
                  <ol className="list-decimal list-inside text-gray-400 space-y-1 text-xs">
                    <li>Log in to your page in your own browser.</li>
                    <li>Right-click {'>'} <strong>Save As...</strong></li>
                    <li>For "Format", choose <strong>"Webpage, HTML Only"</strong>.</li>
                    <li>Upload that HTML file below.</li>
                    <li>(Optional) Upload your project's <strong>.css</strong> file if you have one.</li>
                  </ol>
                </div>
                {/* --- END GUIDANCE --- */}
                
                <label className="w-full px-4 py-2 text-center text-sm font-medium bg-gray-700 rounded-md hover:bg-gray-600 transition-colors cursor-pointer">
                  {htmlFileName ? htmlFileName : 'Upload HTML File'}
                  <input 
                    type="file" 
                    accept=".html,.htm" 
                    className="hidden"
                    onChange={handleHtmlUpload}
                  />
                </label>
                
                <label className="w-full px-4 py-2 text-center text-sm font-medium bg-gray-700 rounded-md hover:bg-gray-600 transition-colors cursor-pointer">
                  {cssFileName ? cssFileName : 'Upload CSS File (Optional)'}
                  <input 
                    type="file" 
                    accept=".css" 
                    className="hidden"
                    onChange={handleCssUpload}
                  />
                </label>

                <button
                  onClick={handleLoadLocal}
                  disabled={isLoading || isExporting || isTextEditMode || isImageEditMode}
                  className="w-full px-5 py-2 font-semibold bg-green-600 rounded-md hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? 'Loading...' : 'Load Local Files'}
                </button>
              </div>
            )}

            <hr className="border-gray-700 my-2" />
            
            {/* --- Common Buttons (Unchanged) --- */}
            <button
              onClick={handleExport}
              disabled={isLoading || isExporting || !iframeContent || !iframeReady}
              className="w-full px-5 py-2 font-semibold bg-gray-700 rounded-md hover:bg-gray-600 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
            >
              {isExporting ? 'Exporting...' : 'Export as PNG'}
            </button>
            <button
              onClick={() => toggleTextEditMode()}
              disabled={isLoading || isExporting || !iframeContent || !iframeReady}
              className={`w-full px-5 py-2 font-semibold rounded-md transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed ${isTextEditMode ? 'bg-fuchsia-600 hover:bg-fuchsia-500' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
              {isTextEditMode ? 'Stop Editing Text' : 'Edit Text'}
            </button>
            <button
              onClick={() => toggleImageEditMode()}
              disabled={isLoading || isExporting || !iframeContent || !iframeReady}
              className={`w-full px-5 py-2 font-semibold rounded-md transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed ${isImageEditMode ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
              {isImageEditMode ? 'Stop Editing Images' : 'Edit Images'}
            </button>
            
            {/* --- Error/Status Messages (Unchanged) --- */}
            {errorMessage && ( <div className="p-3 bg-red-900/50 border border-red-700 rounded-md text-sm text-red-200"> {errorMessage} </div> )}
            {iframeContent && !iframeReady && ( <div className="p-3 bg-yellow-900/50 border border-yellow-700 rounded-md text-sm text-yellow-200"> Initializing preview... </div> )}
          </div>
          
          {/* --- COLOR PALETTE (Unchanged) --- */}
          <h3 className="text-md font-semibold mb-3"> Color Palette {iframeReady && colorChanges.size > 0 && ( <span className="ml-2 text-xs text-green-400">● Live</span> )} </h3>
          <div className="flex flex-col gap-3">
            {isLoading ? ( <p className="text-sm text-gray-500">Extracting colors...</p> ) : colorChanges.size > 0 ? (
              Array.from(colorChanges.entries()).map(([oldColor, newColor]) => (
                <div key={oldColor} className={`flex items-center justify-between gap-2 p-2 rounded transition-colors ${!(isTextEditMode || isImageEditMode) ? 'hover:bg-gray-800 cursor-pointer' : 'opacity-50'}`} onMouseEnter={() => handleHighlightStart(oldColor)} onMouseLeave={handleHighlightEnd}>
                  <div className="w-8 h-8 rounded border-2 border-gray-500 shrink-0" style={{ backgroundColor: newColor }} />
                  <span className="text-sm text-gray-400 truncate flex-1" title={oldColor}> {oldColor} </span>
                  <input type="color" value={newColor} className="w-12 h-8 p-0 border-0 rounded cursor-pointer bg-transparent" onChange={(e) => handleColorChange(oldColor, e.target.value)} disabled={!iframeReady || isTextEditMode || isImageEditMode} />
                </div>
              ))
            ) : ( <p className="text-sm text-gray-500">No opaque colors found. Try loading a preview first.</p> )}
          </div>

          {/* --- FONT FAMILY (Unchanged) --- */}
          <h3 className="text-md font-semibold mb-3 mt-6"> Fonts {iframeReady && fontChanges.size > 0 && ( <span className="ml-2 text-xs text-green-400">● Live</span> )} </h3>
          <div className={`flex flex-col gap-3 ${(isTextEditMode || isImageEditMode) ? 'opacity-50' : ''}`}>
            {isLoading ? ( <p className="text-sm text-gray-500">Extracting fonts...</p> ) : fontChanges.size > 0 ? (
              Array.from(fontChanges.entries()).map(([oldFont, newFont]) => (
                <div key={oldFont} className="flex items-center justify-between gap-2 p-2 rounded">
                  <span className="text-sm text-gray-200 truncate flex-1" title={oldFont} style={{ fontFamily: newFont, fontSize: '1.1rem' }}> {oldFont} </span>
                  <input type="text" value={newFont} placeholder="e.g., Arial" className="w-32 p-1 bg-gray-700 border border-gray-600 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500" onChange={(e) => handleFontChange(oldFont, e.target.value)} disabled={!iframeReady || isTextEditMode || isImageEditMode} />
                </div>
              ))
            ) : ( <p className="text-sm text-gray-500">No fonts found.</p> )}
          </div>

          {/* --- FONT SIZES (Unchanged) --- */}
          <h3 className="text-md font-semibold mb-3 mt-6"> Font Sizes {iframeReady && fontSizeChanges.size > 0 && ( <span className="ml-2 text-xs text-green-400">● Live</span> )} </h3>
          <div className={`flex flex-col gap-3 ${(isTextEditMode || isImageEditMode) ? 'opacity-50' : ''}`}>
            {isLoading ? ( <p className="text-sm text-gray-500">Extracting sizes...</p> ) : fontSizeChanges.size > 0 ? (
              Array.from(fontSizeChanges.entries()).map(([oldSize, newSize]) => (
                <div key={oldSize} className="flex items-center justify-between gap-2 p-2 rounded">
                  <span className="text-sm text-gray-200 truncate" title={oldSize}> {oldSize} </span>
                  <input type="text" value={newSize} placeholder="e.g., 18px" className="w-24 p-1 bg-gray-700 border border-gray-600 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500" onChange={(e) => handleFontSizeChange(oldSize, e.target.value)} disabled={!iframeReady || isTextEditMode || isImageEditMode} />
                </div>
              ))
            ) : ( <p className="text-sm text-gray-500">No specific font sizes found.</p> )}
          </div>
          
          {/* --- SPACING (Unchanged) --- */}
          <h3 className="text-md font-semibold mb-3 mt-6"> Spacing (Margin & Padding) {iframeReady && spacingChanges.size > 0 && ( <span className="ml-2 text-xs text-green-400">● Live</span> )} </h3>
          <div className={`flex flex-col gap-3 ${(isTextEditMode || isImageEditMode) ? 'opacity-50' : ''}`}>
            {isLoading ? ( <p className="text-sm text-gray-500">Extracting spacing...</p> ) : spacingChanges.size > 0 ? (
              Array.from(spacingChanges.entries()).map(([oldSize, newSize]) => {
                const properties = [...new Set(spacingSelectorMap.get(oldSize)?.map(r => r.property) || [])].join(', ');
                return (
                  <div key={oldSize} className="flex flex-col gap-2 p-2 rounded">
                    <span className="text-xs text-gray-400 truncate" title={properties}> {properties} </span>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-gray-200 truncate" title={oldSize}> {oldSize} </span>
                      <input type="text" value={newSize} placeholder="e.g., 1rem 0" className="w-24 p-1 bg-gray-700 border border-gray-600 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500" onChange={(e) => handleSpacingChange(oldSize, e.target.value)} disabled={!iframeReady || isTextEditMode || isImageEditMode} />
                    </div>
                  </div>
                );
              })
            ) : ( <p className="text-sm text-gray-500">No specific spacing values found.</p> )}
          </div>
          
        </div>
      )}
      {/* --- END OF SIDEBAR --- */}

      {/* RIGHT PREVIEW AREA (With Fullscreen Toggle) */}
      <div className="flex-grow w-full h-full relative">
        
        {/* --- Fullscreen Toggle Button (Unchanged) --- */}
        <button onClick={() => setIsSidebarVisible(!isSidebarVisible)} className="absolute top-4 left-4 z-20 p-2 bg-gray-800/80 text-white hover:bg-gray-700 rounded-md transition-colors" title={isSidebarVisible ? 'Enter Fullscreen' : 'Exit Fullscreen'}>
          {isSidebarVisible ? ( <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"> <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75v4.5m0-4.5h-4.5m4.5 0L15 9m5.25 11.25v-4.5m0 4.5h-4.5m4.5 0L15 15" /> </svg> ) : ( <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"> <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l-5.25 5.25M9 9h3.75v3.75M9 9V3.75H5.25M15 15l5.25-5.25M15 15v-3.75h-3.75M15 15h5.25v3.75" /> </svg> )}
        </button>

        {/* --- Iframe (Unchanged) --- */}
        {iframeContent ? (
          <iframe
            ref={iframeRef}
            title="Website Preview"
            className="w-full h-full bg-white border-0"
            sandbox="allow-scripts allow-same-origin"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            {isLoading ? 'Loading preview...' : 'Enter a URL or upload files to start'}
          </div>
        )}
      </div>
    </main>
  );
}