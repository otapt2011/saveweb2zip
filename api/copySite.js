// api/copySite.js
import { kv } from '@vercel/kv';
import { put } from '@vercel/blob';
import { scrapeWebsite } from '../utils/scraper.js';

export default async function handler(req, res) {
  // CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { url, renameAssets, saveStructure, alternativeAlgorithm, mobileVersion } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ errorText: 'url_required' });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ errorText: 'invalid_url' });
    }

    const hash = Math.random().toString(36).substring(2, 15);

    // Initial job status
    await kv.set(`job:${hash}`, {
      status: 'processing',
      copiedFilesAmount: 0,
      total: 0,
      isFinished: false,
      errorText: null
    });

    // Send response immediately
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({ md5: hash, isFinished: false, success: false, copiedFilesAmount: 0 });

    // Run scraping in background
    scrapeWebsite(
      url,
      { renameAssets: !!renameAssets, saveStructure: !!saveStructure },
      async (progress) => {
        try {
          await kv.set(`job:${hash}`, {
            status: 'processing',
            copiedFilesAmount: progress.copiedFilesAmount,
            total: progress.total,
            isFinished: progress.isFinished,
            errorText: null
          });
        } catch (e) {
          console.error('KV update failed:', e);
        }
      }
    )
      .then(async (zipBuffer) => {
        // Upload ZIP to Vercel Blob
        const blob = await put(`archive-${hash}.zip`, zipBuffer, { access: 'public' });
        await kv.set(`job:${hash}`, {
          status: 'finished',
          copiedFilesAmount: progress?.copiedFilesAmount || 0,
          total: progress?.total || 0,
          isFinished: true,
          success: true,
          downloadUrl: blob.url,
          errorText: null
        });
      })
      .catch(async (err) => {
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
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ errorText: 'internal_error' });
  }
}
