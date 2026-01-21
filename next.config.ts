import createNextIntlPlugin from 'next-intl/plugin';
import path from 'path';

const withNextIntl = createNextIntlPlugin();

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean) || [];

if (allowedOrigins.includes('*')) {
    throw new Error('serverActions.allowedOrigins must contain only explicit hostnames, no wildcards');
}

/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    transpilePackages: ['react-chessboard'],
    reactStrictMode: true,
    images: {
        unoptimized: true,
    },
    compress: false,
    poweredByHeader: false,
    experimental: {
        optimizePackageImports: ['react-chessboard'],
        serverActions: {
            bodySizeLimit: '2mb',
            allowedOrigins: allowedOrigins,
        },
    },
    async redirects() {
        return [];
    },
    async rewrites() {
        return [];
    },

};

export default withNextIntl(nextConfig as any);