// utils/scraper.js
import * as cheerio from 'cheerio';
import JSZip from 'jszip';

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp', 'tiff']);
const FONT_EXTS  = new Set(['woff', 'woff2', 'ttf', 'otf', 'eot']);

function getCategory(filename) {
  const ext = filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
  if (IMAGE_EXTS.has(ext)) return 'images';
  if (FONT_EXTS.has(ext))  return 'fonts';
  return 'assets';
}

async function fetchFile(url) {
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SaveWeb2ZIP/1.0)' }
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return Buffer.from(await resp.arrayBuffer());
}

/**
 * Scrape a website and return a ZIP buffer.
 * @param {string} pageUrl
 * @param {object} options - { renameAssets, saveStructure, alternativeAlgorithm, mobileVersion }
 * @param {function} progressCallback - called with { copiedFilesAmount, total, isFinished, errorText }
 * @returns {Promise<Buffer>} ZIP file buffer
 */
export async function scrapeWebsite(pageUrl, options = {}, progressCallback = null) {
  const { renameAssets, saveStructure } = options;

  // Fetch page HTML
  const htmlResp = await fetch(pageUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SaveWeb2ZIP/1.0)' }
  });
  if (!htmlResp.ok) throw new Error(`Failed to fetch page: HTTP ${htmlResp.status}`);
  const html = await htmlResp.text();
  const $ = cheerio.load(html);

  // Collect assets
  const assets = []; // { url, type, folder, filename? }

  // CSS
  $('link[rel="stylesheet"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) assets.push({ url: new URL(href, pageUrl).href, type: 'css', folder: saveStructure ? 'css' : '' });
  });

  // JavaScript (external)
  $('script[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (src) assets.push({ url: new URL(src, pageUrl).href, type: 'js', folder: saveStructure ? 'js' : '' });
  });

  // Images
  $('img[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (src) assets.push({ url: new URL(src, pageUrl).href, type: 'img', folder: 'images' });
  });

  // Fonts (simplified: collect all url() in CSS will be handled separately; here just a basic collection)
  // For now we assume images, CSS, JS are enough. A full impl would parse CSS for url().

  // Rename if needed
  if (renameAssets) {
    const nameCount = new Map();
    assets.forEach(asset => {
      let name = asset.url.split('/').pop().split('?')[0] || 'index';
      const ext = name.includes('.') ? name.split('.').pop() : '';
      const base = name.replace(`.${ext}`, '') || 'file';
      let counter = 1;
      while (nameCount.has(name)) {
        name = `${base}_${counter}.${ext}`;
        counter++;
      }
      asset.filename = name;
      nameCount.set(name, true);
    });
  } else {
    assets.forEach(asset => {
      asset.filename = asset.url.split('/').pop().split('?')[0] || 'index';
    });
  }

  // Download and zip
  const zip = new JSZip();
  let copiedFiles = 0;
  const total = assets.length;

  for (const asset of assets) {
    try {
      const buffer = await fetchFile(asset.url);
      const path = asset.folder ? `${asset.folder}/${asset.filename}` : asset.filename;
      zip.file(path, buffer);
    } catch (e) {
      // skip failed assets
    }
    copiedFiles++;
    if (progressCallback) {
      progressCallback({ copiedFilesAmount: copiedFiles, total, isFinished: false });
    }
  }

  // Rewrite HTML to use local paths
  $('link[rel="stylesheet"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      const orig = assets.find(a => a.url === new URL(href, pageUrl).href);
      if (orig) {
        const local = orig.folder ? `${orig.folder}/${orig.filename}` : orig.filename;
        $(el).attr('href', local);
      }
    }
  });
  $('script[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (src) {
      const orig = assets.find(a => a.url === new URL(src, pageUrl).href);
      if (orig) {
        const local = orig.folder ? `${orig.folder}/${orig.filename}` : orig.filename;
        $(el).attr('src', local);
      }
    }
  });
  $('img[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (src) {
      const orig = assets.find(a => a.url === new URL(src, pageUrl).href);
      if (orig) {
        const local = orig.folder ? `${orig.folder}/${orig.filename}` : orig.filename;
        $(el).attr('src', local);
      }
    }
  });

  const finalHtml = $.html();
  zip.file('index.html', finalHtml);

  if (progressCallback) {
    progressCallback({ copiedFilesAmount: copiedFiles, total, isFinished: true });
  }

  return zip.generateAsync({ type: 'nodebuffer' });
}
