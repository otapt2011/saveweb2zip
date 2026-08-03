import { createToken } from '@vercel/blob';

export default async function handler(req, res) {
  try {
    const token = await createToken({
      permissions: ['read', 'write'],
      note: 'Temporary token for SaveWeb2ZIP'
    });
    return res.status(200).json({ token });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
