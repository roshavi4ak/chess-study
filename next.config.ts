import createNextIntlPlugin from 'next-intl/plugin';
import path from 'path';

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
    turbopack: {
        root: path.resolve(__dirname),
    },
    transpilePackages: ['react-chessboard'],
    reactStrictMode: false,
};

export default withNextIntl(nextConfig as any);

