import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import type { Adapter } from "next-auth/adapters"
import { prisma } from "./lib/db"
import { AVATARS } from "./lib/avatars";
const NEXTAUTH_URL = process.env.NEXTAUTH_URL;
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
const LICHESS_CLIENT_ID = process.env.LICHESS_CLIENT_ID || "chess-study-app";

if (!NEXTAUTH_SECRET) {
    console.error('[Auth] ERROR: NEXTAUTH_SECRET or AUTH_SECRET environment variable is not set');
}

if (!NEXTAUTH_URL) {
    console.error('[Auth] ERROR: NEXTAUTH_URL environment variable is not set');
}

console.log('[Auth] Configuration:', {
    hasSecret: !!NEXTAUTH_SECRET,
    nextAuthUrl: NEXTAUTH_URL,
    lichessClientId: LICHESS_CLIENT_ID,
    nodeEnv: process.env.NODE_ENV
});

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(prisma) as Adapter,
    providers: [
        {
            id: "lichess",
            name: "Lichess",
            type: "oauth",
            clientId: LICHESS_CLIENT_ID,
            authorization: {
                url: "https://lichess.org/oauth",
                params: {
                    scope: "preference:read email:read challenge:write bot:play board:play",
                },
            },
            token: {
                url: `${NEXTAUTH_URL}/api/lichess-token`,
            },
            userinfo: "https://lichess.org/api/account",

            profile(profile: any) {
                const randomAvatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
                return {
                    id: profile.id,
                    name: profile.username,
                    email: profile.email,
                    image: `/img/avatars/${randomAvatar}`,
                    role: "STUDENT",
                    lichessId: profile.id,
                    isNameSet: false,
                    ratingPuzzle: profile.perfs?.puzzle?.rating,
                    ratingBullet: profile.perfs?.bullet?.rating,
                    ratingBlitz: profile.perfs?.blitz?.rating,
                    ratingRapid: profile.perfs?.rapid?.rating,
                    ratingClassical: profile.perfs?.classical?.rating,
                    ratingCorrespondence: profile.perfs?.correspondence?.rating,
                }
            },
            checks: ["pkce"],
        }
    ],
    secret: NEXTAUTH_SECRET,
    trustHost: true, // Critical for production with proxy/hosting environment
    basePath: '/api/auth',
    debug: true,
    callbacks: {
        async session({ session, user }) {
            if (session.user && user) {
                session.user.role = (user as any).role || "STUDENT";
                session.user.lichessId = (user as any).lichessId || null;
                session.user.ratingPuzzle = (user as any).ratingPuzzle || null;
                session.user.isNameSet = (user as any).isNameSet || false;
            }
            return session;
        }
    }
})
