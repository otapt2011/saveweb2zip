// api/downloadArchive/[hash].js
import { list } from '@vercel/blob';

export default async function handler(req, res) {
  const { hash } = req.query;
  try {
    const { blobs } = await list({ prefix: `archive-${hash}` });
    if (blobs.length === 0) return res.status(404).json({ errorText: 'archive_not_ready' });
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.writeHead(302, { Location: blobs[0].url });
    res.end();
  } catch (err) {
    return res.status(500).json({ errorText: err.message });
  }
}
