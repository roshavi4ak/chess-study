import { NextResponse } from 'next/server';

// Test endpoint to verify Lichess OAuth configuration
// Visit: https://shah.belovezem.com/api/debug/test-lichess-oauth
export async function GET(request: Request) {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const codeVerifier = url.searchParams.get('code_verifier');

    const NEXTAUTH_URL = process.env.NEXTAUTH_URL;
    const LICHESS_CLIENT_ID = process.env.LICHESS_CLIENT_ID || 'chess-study-app';

    if (!code || !codeVerifier) {
        return NextResponse.json({
            error: 'Missing parameters',
            instructions: 'This endpoint is for testing token exchange. You need code and code_verifier parameters.',
            config: {
                nextAuthUrl: NEXTAUTH_URL,
                lichessClientId: LICHESS_CLIENT_ID,
                redirectUri: `${NEXTAUTH_URL}/api/auth/callback/lichess`
            }
        });
    }

    try {
        const redirectUri = `${NEXTAUTH_URL}/api/auth/callback/lichess`;

        const requestBody = new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: redirectUri,
            client_id: LICHESS_CLIENT_ID,
            code_verifier: codeVerifier,
        });

        console.log('[Test OAuth] Making token request:', {
            redirectUri,
            clientId: LICHESS_CLIENT_ID,
            hasCode: !!code,
            hasCodeVerifier: !!codeVerifier
        });

        const response = await fetch('https://lichess.org/api/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: requestBody,
        });

        const responseText = await response.text();

        let parsedResponse;
        try {
            parsedResponse = JSON.parse(responseText);
        } catch {
            parsedResponse = responseText;
        }

        return NextResponse.json({
            success: response.ok,
            status: response.status,
            statusText: response.statusText,
            response: parsedResponse,
            requestDetails: {
                redirectUri,
                clientId: LICHESS_CLIENT_ID
            }
        });
    } catch (error: any) {
        return NextResponse.json({
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}
