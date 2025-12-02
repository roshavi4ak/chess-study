import { NextResponse } from 'next/server';

// Diagnostic endpoint to check auth configuration
// Visit: https://shah.belovezem.com/api/debug/auth-config
export async function GET() {
    const config = {
        hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
        nextAuthUrl: process.env.NEXTAUTH_URL,
        hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
        hasAuthSecret: !!process.env.AUTH_SECRET,
        hasAuthTrustHost: !!process.env.AUTH_TRUST_HOST,
        authTrustHost: process.env.AUTH_TRUST_HOST,
        hasLichessClientId: !!process.env.LICHESS_CLIENT_ID,
        lichessClientId: process.env.LICHESS_CLIENT_ID,
        nodeEnv: process.env.NODE_ENV,
        allEnvKeys: Object.keys(process.env).filter(key =>
            key.includes('AUTH') || key.includes('LICHESS') || key.includes('DATABASE')
        )
    };

    return NextResponse.json(config, {
        headers: {
            'Content-Type': 'application/json',
        }
    });
}
