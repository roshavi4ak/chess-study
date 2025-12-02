import { NextResponse } from 'next/server';

// Enhanced diagnostic endpoint to capture auth errors
// Visit after a failed login attempt: https://shah.belovezem.com/api/debug/last-auth-error
let lastAuthError: any = null;

export function logAuthError(error: any, context: string) {
    lastAuthError = {
        timestamp: new Date().toISOString(),
        context,
        error: {
            message: error?.message || 'Unknown error',
            stack: error?.stack,
            name: error?.name,
            ...error
        }
    };
}

export async function GET() {
    return NextResponse.json({
        lastError: lastAuthError || 'No errors logged yet',
        note: 'This shows the last auth error that occurred. Try logging in with Lichess again, then refresh this page.'
    });
}
