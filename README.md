🎨 ReEditAi: Live Visual Style Editor

ReEditAi is a powerful in-browser developer tool that lets you scrape, load, and live-edit the CSS and content of any webpage. It's perfect for prototyping new color palettes, testing text changes, or seeing how a new font looks on a real site without ever touching the original code.

Don't forget to add a screenshot here!
![ReEditAi Screenshot](path/to/your/screenshot.png)

✨ Core Features

Live Style Editor: Automatically parses all CSS (from files and inline styles) to find every color, font, and spacing value.

Interactive Palette: Generates a full palette of all your site's styles. Click any color to change it everywhere it's used.

Two Import Modes:

Scrape URL: Fetches any public website using a Node.js/Puppeteer backend, which smartly scans for only the CSS used on that page.

Upload Files: Bypass logins! Upload your local HTML and CSS files directly.

✍️ Live Text Edit Mode: Click on any text element (paragraphs, headers, and even emojis in <div>s) and edit the content on the fly.

🖼️ Live Image Edit Mode: Click any image or SVG to replace it, remove it, or fill it with a solid color.

📤 Export to PNG: Save a high-quality PNG screenshot of your final, edited design with one click.

Modern UI: Features a fullscreen toggle, side-by-side view, and a dark-mode interface.

🚀 How It Works

This tool gives you two ways to load a site, each with a specific purpose.

1. Scrape URL (For Public Sites)

This mode is for any public website (like https://google.com or your own deployed project).

Paste the URL into the "Scrape URL" tab and click "Fetch Website."

The backend (index.js) uses Puppeteer to launch a headless browser, visit the page, and scroll to the bottom.

It uses CSS Coverage to find only the styles used on that specific page, giving you a clean, accurate style palette.

It sends the HTML and the "used" CSS to the frontend to be loaded in the iframe.

2. Upload Files (For Login Pages & Local Projects)

This is the solution for editing pages behind a login (like your dashboard.php). The backend can't log in, so you bring the files to the tool!

Log in to your page in your own browser (e.g., Chrome).

Go to File > Save As...

For "Format" (or "Save as type"), choose "Webpage, HTML Only". This saves the final HTML (the "kuih," not the "resepi"!).

Find your project's .css file (e.g., style.css).

In the "Upload Files" tab, upload the .html file you just saved and your .css file.

Click "Load Preview."

The app will parse all CSS from both the .css file and any style="..." attributes in your HTML, giving you a complete palette.

💻 Tech Stack

Frontend: Next.js (React), TypeScript, Tailwind CSS, postcss (for parsing), html2canvas (for exporting)

Backend: Node.js, Express, puppeteer (for scraping)

🛠️ How to Run Locally

This project is in a "monorepo" style (two folders in one repo). You'll need to run two terminals.

1. Backend (The Scraper)

# Go to the backend folder
cd backend

# Install dependencies
npm install

# Run the backend server (runs on http://localhost:3001)
node index.js


2. Frontend (The UI)

In a new terminal:

# Go to the frontend folder
cd frontend

# Install dependencies
npm install

# Run the development server (runs on http://localhost:3000)
npm run dev


Now, just open http://localhost:3000 in your browser to use the app!
