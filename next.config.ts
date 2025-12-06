import createNextIntlPlugin from 'next-intl/plugin';
import path from 'path';

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    transpilePackages: ['react-chessboard'],
    reactStrictMode: false,
    images: {
        unoptimized: true,
    },
    compress: false,
    poweredByHeader: false,
    experimental: {
        // Force single-threaded operation to reduce process count
        workerThreads: false,
        cpus: 1,
    },
};

export default withNextIntl(nextConfig as any);
