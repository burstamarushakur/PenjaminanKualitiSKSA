PENJAMINAN KUALITI SKSA - NEON v2.7 CHECKBOX MAPPING

PEMBETULAN PENTING
- Ya/Tidak TIDAK lagi ditanda di atas perkataan atau garisan.
- Sistem membaca geometri 5 kolum SKALA daripada PDF rasmi KPM.
- Untuk baris Ya/Tidak:
    YA    -> tanda √ pada PETAK KOSONG selepas "Ya" (kolum skala ke-2)
    TIDAK -> tanda √ pada PETAK KOSONG selepas "Tidak" (kolum skala ke-5)
- Jika sesuatu halaman hanya ada Ya/Tidak, sistem pinjam geometri grid daripada halaman
  terdekat dalam instrumen rasmi yang sama.
- Fallback berasaskan kedudukan teks disediakan jika PDF extraction berbeza.

SKOP
Pembetulan ini digunakan oleh SATU engine generik untuk semua 11 instrumen:
PBD-A, PBD-B, PBD-C,
PPsi-A, PPsi-B, PPsi-C,
PAJSK-A, PAJSK-B,
SEGAK-A, SEGAK-B, SEGAK-C.

Semua pembetulan v2.6 kekal:
- Nama sekolah auto: SEKOLAH KEBANGSAAN SUNGAI ABONG
- Kod sekolah auto: JBA5095
- Metadata wajib ikut instrumen
- PDF asal rasmi KPM sebagai template
- skala 1-5 dibulatkan
- tandatangan digital

DEPLOY
Upload SEMUA kandungan ZIP ke root repo GitHub/Vercel.
Selepas Vercel siap deploy, buat Ctrl+Shift+R.
