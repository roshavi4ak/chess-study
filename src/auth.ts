import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { PrismaClient } from "@prisma/client"
import type { Adapter } from "next-auth/adapters"

const prisma = new PrismaClient()

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(prisma) as Adapter,
    providers: [
        {
            id: "lichess",
            name: "Lichess",
            type: "oauth",
            clientId: process.env.LICHESS_CLIENT_ID || "chess-study-app",
            clientSecret: undefined, // PKCE doesn't use client secret
            authorization: {
                url: "https://lichess.org/oauth",
                params: {
                    scope: "preference:read email:read challenge:write bot:play board:play",
                },
            },
            token: {
                url: `${process.env.NEXTAUTH_URL}/api/lichess-token`,
            },
            userinfo: "https://lichess.org/api/account",
            profile(profile: any) {
                return {
                    id: profile.id,
                    name: profile.username,
                    email: profile.email,
                    image: `https://lichess1.org/assets/logo/lichess-pad3.svg`,
                    role: "STUDENT",
                    lichessId: profile.id
                }
            },
            checks: ["pkce"],
        }
    ],
    secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
    debug: true,
    callbacks: {
        async session({ session, user }) {
            if (session.user && user) {
                session.user.role = (user as any).role || "STUDENT";
                session.user.lichessId = (user as any).lichessId || null;
            }
            return session;
        }
    }
})
