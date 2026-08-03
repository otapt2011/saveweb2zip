import { kv } from '@vercel/kv';
import { put } from '@vercel/blob';
import { scrapeWebsite } from '../../utils/scraper.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { url, renameAssets, saveStructure, alternativeAlgorithm, mobileVersion } = req.body;
    if (!url) return res.status(400).json({ error: 'url required' });

    // Generate a unique job ID
    const hash = Math.random().toString(36).substring(2, 15);

    // Store initial status
    await kv.set(`job:${hash}`, { status: 'processing', copiedFilesAmount: 0, isFinished: false, errorText: null });

    // Run the scrape asynchronously
    scrapeWebsite(url, { renameAssets, saveStructure, alternativeAlgorithm, mobileVersion }, async (progress) => {
      await kv.set(`job:${hash}`, {
        status: 'processing',
        copiedFilesAmount: progress.copiedFilesAmount,
        isFinished: progress.isFinished,
        errorText: null
      });

      if (progress.isFinished) {
        // Finalize: upload zip to Vercel Blob
        // (You would need to pass the zip blob from the scraper; adjust scrapeWebsite to return the blob at the end)
        // For simplicity, we'll assume scrapeWebsite saves the blob internally. We'll refine.
      }
    });

    // Return the job ID immediately
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ md5: hash, isFinished: false, success: false, copiedFilesAmount: 0 });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
