import { NextResponse } from 'next/server';

// Enhanced diagnostic endpoint to capture auth errors
// Visit after a failed login attempt: https://shah.belovezem.com/api/debug/last-auth-error
let lastAuthError: {
    timestamp: string;
    context: string;
    error: Record<string, unknown>;
} | null = null;

export function logAuthError(error: unknown, context: string) {
    const details = error && typeof error === 'object' ? error : {};
    lastAuthError = {
        timestamp: new Date().toISOString(),
        context,
        error: {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            name: error instanceof Error ? error.name : undefined,
            ...details
        }
    };
}

export async function GET() {
    return NextResponse.json({
        lastError: lastAuthError || 'No errors logged yet',
        note: 'This shows the last auth error that occurred. Try logging in with Lichess again, then refresh this page.'
    });
}
