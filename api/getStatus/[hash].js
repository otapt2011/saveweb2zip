// api/getStatus/[hash].js
import { list } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  const { hash } = req.query;
  if (!hash) return res.status(400).json({ error: 'hash missing' });

  const token = process.env.BLOB_READ_WRITE_TOKEN;

  try {
    const { blobs } = await list({ prefix: `job-${hash}`, token });
    if (blobs.length === 0) return res.status(404).json({ errorText: 'job_not_found' });

    const statusResp = await fetch(blobs[0].url);
    const status = await statusResp.json();

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(status);
  } catch (err) {
    return res.status(500).json({ errorText: err.message });
  }
}
