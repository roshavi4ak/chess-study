# Environment Setup

This file contains instructions for setting up the required environment variables.

## Required Environment Variables

Create a `.env` or `.env.local` file in the root directory with the following variables:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/chess_study"

# NextAuth Configuration
# Generate a secret with: openssl rand -base64 32
# Or use any random string generator
NEXTAUTH_SECRET="your-secret-key-here-minimum-32-characters"
AUTH_SECRET="your-secret-key-here-minimum-32-characters"
NEXTAUTH_URL="http://localhost:3000"

# Lichess OAuth
# Register your app at: https://lichess.org/account/oauth/app/create
# Redirect URI should be: http://localhost:3000/api/auth/callback/lichess
LICHESS_CLIENT_ID="your-lichess-client-id"
LICHESS_CLIENT_SECRET=""  # Leave empty for PKCE flow
```

## Setup Steps

### 1. Generate NEXTAUTH_SECRET

Run one of these commands:

**On Linux/Mac:**
```bash
openssl rand -base64 32
```

**On Windows (PowerShell):**
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

**Or use an online generator:**
- https://generate-secret.vercel.app/32

### 2. Register Lichess OAuth App

1. Go to https://lichess.org/account/oauth/app/create
2. Fill in the form:
   - **Name:** Chess Study Platform (or any name)
   - **Redirect URI:** `http://localhost:3000/api/auth/callback/lichess`
   - **Description:** (optional)
3. Click "Create"
4. Copy the **Client ID** and paste it as `LICHESS_CLIENT_ID` in your `.env` file
5. Leave `LICHESS_CLIENT_SECRET` empty (we use PKCE flow which doesn't require a secret)

### 3. Database Setup

Make sure you have PostgreSQL running and update the `DATABASE_URL` with your credentials.

Then run:
```bash
npx prisma generate
npx prisma db push
```

## Troubleshooting

If you see "Configuration error" when trying to log in:
- Make sure `NEXTAUTH_SECRET` or `AUTH_SECRET` is set
- Make sure `NEXTAUTH_URL` matches your application URL
- Restart the dev server after changing environment variables
