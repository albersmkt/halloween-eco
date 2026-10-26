const {createHmac, timingSafeEqual} = require('node:crypto');
const {Readable} = require('node:stream');
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return res.status(405).end();
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return res.status(503).end('Photo storage is not configured');
  const {id,expires,signature} = req.query;
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id) || typeof expires !== 'string' || !/^\d{13}$/.test(expires) || typeof signature !== 'string' || !/^[a-f0-9]{64}$/.test(signature)) return res.status(400).end();
  const expected = createHmac('sha256',token).update(`${id}:${expires}`).digest();
  if (!timingSafeEqual(expected,Buffer.from(signature,'hex'))) return res.status(403).end();
  if (Number(expires) < Date.now()) return res.status(410).end('Este link expirou.');
  try {
    const {get} = await import('@vercel/blob');
    const photo = await get(`selfies/${id}.jpg`, {access:'private'});
    if (!photo || photo.statusCode !== 200) return res.status(404).end();
    res.setHeader('Content-Type','image/jpeg');
    res.setHeader('Content-Disposition','attachment; filename="selfie-museu.jpg"');
    res.setHeader('X-Content-Type-Options','nosniff');
    Readable.fromWeb(photo.stream).on('error',()=>res.destroy()).pipe(res);
  } catch { return res.status(502).end('Não foi possível baixar a foto.'); }
};
