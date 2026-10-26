const {randomUUID, createHmac} = require('node:crypto');
const MAX_BYTES = 3 * 1024 * 1024;
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return res.status(503).json({error:'Photo storage is not configured'});
  if (req.headers.origin !== `https://${req.headers.host}` && req.headers.origin !== `http://${req.headers.host}`) return res.status(403).end();
  if (req.headers['content-type'] !== 'application/json') return res.status(415).end();
  if (Number(req.headers['content-length']) > 4 * 1024 * 1024) return res.status(413).end();
  try {
    let payload = req.body;
    if (!payload) {
      const parts = []; let size = 0;
      for await (const part of req) {
        size += part.length;
        if (size > 4 * 1024 * 1024) return res.status(413).end();
        parts.push(part);
      }
      payload = JSON.parse(Buffer.concat(parts).toString('utf8'));
    } else if (typeof payload === 'string' || Buffer.isBuffer(payload)) {
      payload = JSON.parse(payload.toString());
    }
    if (typeof payload.image !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(payload.image)) return res.status(400).end();
    const body = Buffer.from(payload.image, 'base64');
    if (body.length > MAX_BYTES) return res.status(413).end();
    if (body.length < 4 || body[0] !== 0xff || body[1] !== 0xd8 || body[body.length-2] !== 0xff || body[body.length-1] !== 0xd9) return res.status(415).end();
    const {put} = await import('@vercel/blob');
    const id = randomUUID();
    await put(`selfies/${id}.jpg`, body, {access:'private', contentType:'image/jpeg', addRandomSuffix:false});
    const expires = Date.now() + 24*60*60*1000;
    const signature = createHmac('sha256', token).update(`${id}:${expires}`).digest('hex');
    return res.status(201).json({downloadPath:`/api/download?id=${id}&expires=${expires}&signature=${signature}`});
  } catch {
    return res.status(502).json({error:'Photo upload failed'});
  }
};
module.exports.config = {api:{bodyParser:false}};
