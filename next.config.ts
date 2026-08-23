import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Foto bukti pengerjaan & foto desain (bisa beberapa file sekaligus,
      // minimal 3 saat membuat pesanan baru) diunggah lewat Server Action;
      // default 1MB terlalu kecil.
      bodySizeLimit: '30mb',
    },
  },
};

export default nextConfig;
