import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { hash } = req.query;
  if (!hash) return res.status(400).json({ error: 'hash missing' });

  const job = await kv.get(`job:${hash}`);
  if (!job) return res.status(404).json({ error: 'job not found' });

  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(200).json({ ...job, md5: hash });
}
