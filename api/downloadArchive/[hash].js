import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { hash } = req.query;
  const job = await kv.get(`job:${hash}`);
  if (!job || !job.downloadUrl) return res.status(404).json({ error: 'archive not ready' });

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.redirect(job.downloadUrl); // or proxy the blob
}
