PENJAMINAN KUALITI SKSA - NEON v3.0 OFFICIAL KPM PDF AUDIT

SUMBER
- Webapp kini menggunakan TERUS fail rasmi KPM yang dibundel:
  /assets/kpm-pbs-official.pdf
- Fail ini ialah PDF 62 halaman yang dibekalkan pengguna dan diaudit keseluruhannya.

HASIL AUDIT 62 HALAMAN
- 246 baris standard berjaya dibaca daripada jadual rasmi.
- Tiga baris SEGAK-C Bahagian C (3.1, 3.2, 3.3) mempunyai lima petak skala
  tetapi angka 1-5 TIDAK dicetak dalam PDF asal KPM.
  Sistem kini mengisi angka 1-5 pada petak tersebut dan membulatkan jawapan.
- PBD-B Bahagian C 4.1 dalam PDF asal tercetak "1 2 3 4 4".
  Sistem membetulkan sel terakhir kepada "5".
- SEGAK-B Bahagian C 2.3 mempunyai dua subitem (i) individu dan (ii) kumpulan
  dalam satu baris visual. Kedua-duanya dimapping secara berasingan.
- Ya/Tidak kekal ditanda √ dalam petak kosong yang betul.
- Skala 1-5 menggunakan geometri kolum, bukan bergantung kepada teks angka pada baris itu.

SELF AUDIT
- PDF tidak akan dimuat turun jika satu item gagal dimapping.
- PDF tidak akan dimuat turun jika jawapan lama tidak sepadan dengan jenis respons semasa.
- Jadi sistem tidak lagi senyap-senyap menghasilkan borang separuh lengkap.

NOTA SEGAK-C
- Item C 3.1, 3.2, 3.3 kini ditetapkan sebagai SKALA_1_5.
- Submission lama yang menjawab YA/TIDAK perlu KEMASKINI dan pilih skala 1-5
  untuk tiga item itu sahaja. Jawapan item lain kekal.

DEPLOY
Upload SEMUA kandungan ZIP ke root repo GitHub/Vercel.
Pastikan folder assets/ turut naik.
Selepas deploy: Ctrl+Shift+R.
