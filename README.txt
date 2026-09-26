PENJAMINAN KUALITI SKSA - NEON v2.8 METADATA MAPPING + SELF AUDIT

ROOT CAUSE YANG DIBETULKAN
PAJSK-B: nilai seperti "KRIKET" sebenarnya sudah tersimpan dalam Neon.
PDF tak memaparkannya kerana label panjang
"Kelab Persatuan / Sukan Permainan / Pasukan Badan Beruniform:"
dipecahkan oleh PDF.js kepada banyak text item. Locator lama hanya mencari satu item.

v2.8
- Locator Bahagian A sekarang membaca KESELURUHAN BARIS PDF dan boleh match label
  walaupun label dipecahkan kepada banyak text item.
- PAJSK-B kini stamp field Kelab/Persatuan/Sukan/Permainan/Pasukan Badan Beruniform.
- Mapping Bahagian A rasmi disahkan untuk semua 11 instrumen:
  PBD-A/B/C: Nama, Jawatan, Mata Pelajaran Diajar, Tahun/Tingkatan
  PPsi-A/B/C: Nama, Jawatan
  PAJSK-A: Nama, Jawatan, Sekolah
  PAJSK-B: Nama, Jawatan, Kelab Persatuan / Sukan Permainan / Pasukan Badan Beruniform
  SEGAK-A/B/C: Nama Sekolah, Kod Sekolah, Nama, Jawatan pilihan, Skop SEGAK/BMI
- Nama sekolah & kod sekolah auto seperti v2.6:
  SEKOLAH KEBANGSAAN SUNGAI ABONG / JBA5095
- Checkbox Ya/Tidak dalam petak seperti v2.7.
- SELF-AUDIT PDF: jika satu medan Bahagian A wajib gagal dipetakan,
  sistem TIDAK akan keluarkan PDF separuh lengkap. Ia hentikan download dan
  beri nama medan yang gagal mapping.
- Data "KRIKET" submission sedia ada tak perlu diisi semula selepas deploy.

DEPLOY
Upload SEMUA kandungan ZIP ke root repo GitHub/Vercel.
Selepas deploy, Ctrl+Shift+R.
