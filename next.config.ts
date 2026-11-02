import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Hasilkan server mandiri di .next/standalone supaya image Docker kecil
  // (hanya berisi file yang benar-benar dipakai). Vercel mengabaikan opsi ini.
  output: 'standalone',
};

export default nextConfig;
