import { Role } from "@prisma/client"
import NextAuth, { DefaultSession } from "next-auth"

declare module "next-auth" {
    interface Session {
        user: {
            role: Role
            lichessId: string | null
        } & DefaultSession["user"]
    }

    interface User {
        role: Role
        lichessId: string | null
    }
}
