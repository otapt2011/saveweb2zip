// api/copySite.js
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
    const token = process.env.BLOB_READ_WRITE_TOKEN;

    const makeStatus = (data) => JSON.stringify({ ...data, md5: hash });

    // Initial status
    await put(`job-${hash}.json`, makeStatus({
      status: 'processing',
      copiedFilesAmount: 0,
      total: 0,
      isFinished: false,
      success: false,
      errorText: null
    }), { access: 'public', contentType: 'application/json', token });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({ md5: hash, isFinished: false, success: false, copiedFilesAmount: 0 });

    // Run the scraper with a safety wrapper
    (async () => {
      let finalCopied = 0, finalTotal = 0;
      try {
        const zipBuffer = await scrapeWebsite(
          url,
          { renameAssets: !!renameAssets, saveStructure: !!saveStructure },
          (progress) => {
            finalCopied = progress.copiedFilesAmount;
            finalTotal = progress.total;
            // Update status periodically
            put(`job-${hash}.json`, makeStatus({
              status: 'processing',
              copiedFilesAmount: progress.copiedFilesAmount,
              total: progress.total,
              isFinished: progress.isFinished,
              success: false,
              errorText: null
            }), { access: 'public', contentType: 'application/json', token }).catch(console.error);
          }
        );

        // Upload the ZIP
        const zipBlob = await put(`archive-${hash}.zip`, zipBuffer, { access: 'public', token });
        await put(`job-${hash}.json`, makeStatus({
          status: 'finished',
          copiedFilesAmount: finalCopied,
          total: finalTotal,
          isFinished: true,
          success: true,
          downloadUrl: zipBlob.url,
          errorText: null
        }), { access: 'public', contentType: 'application/json', token });
      } catch (err) {
        console.error('Scraper error:', err);
        // Write the error into the status blob
        await put(`job-${hash}.json`, makeStatus({
          status: 'error',
          isFinished: true,
          success: false,
          errorText: err.message || 'unknown_error',
          copiedFilesAmount: finalCopied,
          total: finalTotal,
          downloadUrl: null
        }), { access: 'public', contentType: 'application/json', token });
      }
    })();

  } catch (err) {
    console.error('Handler error:', err);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ errorText: `internal_error: ${err.message}` });
  }
}
