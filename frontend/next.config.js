/** @type {import('next').NextConfig} */
// Куда сервер Next проксирует /api (иначе при входе с :3000 запросы попадают в Next и дают не-JSON).
// На хосте: 127.0.0.1:8000; в Docker Compose задаётся build-arg → http://backend:8000
const INTERNAL_API_ORIGIN =
  process.env.INTERNAL_API_ORIGIN || 'http://127.0.0.1:8000'

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // Для production деплоя (оптимизированный standalone режим)
  // SAME_ORIGIN — один публичный хост (туннель + nginx), API по относительным путям /api/v1
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL !== undefined &&
      process.env.NEXT_PUBLIC_API_URL !== ''
        ? process.env.NEXT_PUBLIC_API_URL
        : 'http://localhost:8000',
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${INTERNAL_API_ORIGIN}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${INTERNAL_API_ORIGIN}/uploads/:path*`,
      },
      { source: '/health', destination: `${INTERNAL_API_ORIGIN}/health` },
    ]
  },
}

module.exports = nextConfig




