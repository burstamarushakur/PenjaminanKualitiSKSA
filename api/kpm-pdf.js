const OFFICIAL_KPM_PDF =
  'https://www.moe.gov.my/storage/files/shares/pentaksiran-berasaskan-sekolah/' +
  'Bahan%20Instrumen%20Penjaminan%20Mutu%20Pentaksiran%20Berasaskan%20Sekolah%20%28PBS%29.pdf';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  try {
    const r = await fetch(OFFICIAL_KPM_PDF, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SKSA-Penjaminan-Kualiti/2.2)',
        'Accept': 'application/pdf,*/*'
      }
    });

    if (!r.ok) {
      return res.status(502).json({
        error: 'KPM_TEMPLATE_FETCH_FAILED',
        status: r.status
      });
    }

    const type = r.headers.get('content-type') || '';
    const buf = Buffer.from(await r.arrayBuffer());
    if (!buf.length || (!type.includes('pdf') && buf.slice(0, 4).toString() !== '%PDF')) {
      return res.status(502).json({ error: 'KPM_TEMPLATE_INVALID' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(buf.length));
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000');
    return res.status(200).send(buf);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'KPM_TEMPLATE_PROXY_ERROR' });
  }
}
