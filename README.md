# Paperflow — Offline Image-to-PDF (HTML/CSS/JavaScript)

A no-build, no-CDN browser application. Open `index.html` in a modern desktop browser and use it offline. Images are processed locally; no server or account is involved.

## Run
1. Extract this folder.
2. Double-click `index.html` (or right-click → Open with → Edge/Chrome/Firefox).
3. Add images, drag rows to reorder, choose settings and click **Create PDF**.

The browser's file picker and download prompt are used. No files are uploaded.

## Features
- Standalone HTML, CSS and JavaScript; no dependencies or remote scripts.
- Multi-image import, thumbnails, drag-and-drop reorder, remove/clear.
- A4, US Letter, or image-sized pages.
- Fit or fill placement, JPEG quality and optional image resizing.
- PDF generation with embedded JPEG streams and no third-party library.
- Progress feedback and cancellation checks.
- No artificial page-count quota.

## Important limitations
- The browser still has finite memory, canvas, and download limits. The app has no artificial image-count cap, but extremely large jobs can exhaust browser memory because prepared pages are retained until PDF assembly.
- Images are rasterized to JPEG; transparent backgrounds become white and PNG inputs become lossy JPEG data. Use quality 100 if visual fidelity is the priority, though this is still not lossless.
- Actual support for formats such as TIFF, HEIC and AVIF varies by browser. JPEG, PNG, WebP and BMP are the safest choices in current desktop browsers.
- “Fill page” may crop edges. “Fit to page” preserves the whole image.
- This starter is a browser app, not a signed Windows installer. For a packaged offline desktop app later, wrap it with Tauri or Electron.
- This application does not require internet after the files are on your computer. There are no external libraries, fonts, analytics, or CDN requests.

## Suggested next improvements
- Stream page preparation and PDF assembly to reduce peak memory use for huge jobs.
- Add page rotation, margins, page preview, per-page fit settings, and better error recovery.
- Add an automated browser test suite and test very large image batches on target Windows hardware.
