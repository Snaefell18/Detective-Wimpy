/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Vercel liefert die Bilder als WebP/AVIF in der Größe aus, die das Gerät
    // wirklich braucht - aus einem 1280px-PNG werden so ~100 kB statt 500.
    // Nur WebP: AVIF ist beim ersten Aufruf sehr langsam zu erzeugen und
    // spart hier kaum etwas gegenüber der schnellen WebP-Variante.
    formats: ["image/webp"],
    deviceSizes: [390, 430, 640, 828, 1080, 1280],
    imageSizes: [64, 96, 128, 256, 384],
  },
};

export default nextConfig;
