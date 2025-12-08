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
        ratingPuzzle?: number | null
        ratingBullet?: number | null
        ratingBlitz?: number | null
        ratingRapid?: number | null
        ratingClassical?: number | null
        ratingCorrespondence?: number | null
    }
}
