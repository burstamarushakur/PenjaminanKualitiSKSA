PENJAMINAN KUALITI SKSA - NEON v2.2 KPM OFFICIAL PDF

PERUBAHAN UTAMA
- PDF TIDAK lagi direka semula.
- /api/kpm-pdf mengambil PDF asal rasmi KPM:
  "Bahan Instrumen Penjaminan Mutu Pentaksiran Berasaskan Sekolah (PBS)".
- Browser mengenal pasti halaman instrumen berdasarkan tajuk rasmi + Lampiran.
- Halaman asal KPM disalin 1:1.
- Nama/Jawatan, jawapan, catatan dan tandatangan digital distamp pada ruangan asal.
- PBD Lampiran C dan PAJSK Lampiran B siap dipetakan untuk assignment semasa.
- Beberapa marker instrumen lain turut disediakan untuk peluasan kemudian.

DEPLOY
Upload SEMUA kandungan ZIP ke root repo GitHub, termasuk:
  index.html
  app.js
  styles.css
  config.js
  api/kpm-pdf.js
  package.json
  vercel.json

Vercel akan deploy static frontend + serverless API dalam projek yang sama.
