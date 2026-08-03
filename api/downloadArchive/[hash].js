import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { hash } = req.query;
  const job = await kv.get(`job:${hash}`);
  if (!job || !job.downloadUrl) return res.status(404).json({ errorText: 'archive_not_ready' });

  res.setHeader('Access-Control-Allow-Origin', '*');
  // Redirect to the public Blob URL
  res.writeHead(302, { Location: job.downloadUrl });
  res.end();
}
