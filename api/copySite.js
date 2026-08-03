// api/copySite.js
import { kv } from '@vercel/kv';
import { put } from '@vercel/blob';
import { scrapeWebsite } from '../utils/scraper.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { url, renameAssets, saveStructure } = req.body || {};
    if (!url) return res.status(400).json({ errorText: 'url_required' });

    try { new URL(url); } catch { return res.status(400).json({ errorText: 'invalid_url' }); }

    const hash = Math.random().toString(36).substring(2, 15);

    // Initial job
    await kv.set(`job:${hash}`, {
      status: 'processing',
      copiedFilesAmount: 0,
      total: 0,
      isFinished: false,
      errorText: null
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({ md5: hash, isFinished: false, success: false, copiedFilesAmount: 0 });

    let finalCopied = 0, finalTotal = 0;

    scrapeWebsite(
      url,
      { renameAssets: !!renameAssets, saveStructure: !!saveStructure },
      async (progress) => {
        finalCopied = progress.copiedFilesAmount;
        finalTotal = progress.total;
        try {
          await kv.set(`job:${hash}`, {
            status: 'processing',
            copiedFilesAmount: progress.copiedFilesAmount,
            total: progress.total,
            isFinished: progress.isFinished,
            errorText: null
          });
        } catch (e) { console.error('KV update:', e); }
      }
    )
      .then(async (zipBuffer) => {
        const blob = await put(`archive-${hash}.zip`, zipBuffer, { access: 'public' });
        await kv.set(`job:${hash}`, {
          status: 'finished',
          copiedFilesAmount: finalCopied,
          total: finalTotal,
          isFinished: true,
          success: true,
          downloadUrl: blob.url,
          errorText: null
        });
      })
      .catch(async (err) => {
        // Log the full error (visible in Vercel Runtime Logs)
        console.error('Scrape failed:', err);
        await kv.set(`job:${hash}`, {
          status: 'error',
          isFinished: true,
          success: false,
          errorText: err.message || 'unknown_error',
          copiedFilesAmount: 0,
          total: 0,
        });
      });

  } catch (err) {
    // ---- DEBUG: return the real error ----
    console.error('Handler error:', err);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({
      errorText: `internal_error: ${err.message || 'no details'}`,
      stack: err.stack   // helps debugging
    });
  }
}
