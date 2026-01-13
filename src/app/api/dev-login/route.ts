
import { prisma } from "@/lib/db"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"

export async function GET(request: NextRequest) {
    if (process.env.NODE_ENV !== 'development') {
        return new NextResponse("Not available", { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const email = searchParams.get("email")

    if (!email) {
        return new NextResponse("Email required", { status: 400 })
    }

    let user = await prisma.user.findUnique({
        where: { email },
    })

    // Fallback: search by name locally if email fails (just in case)
    if (!user) {
        const name = email.split('@')[0] // try roshavi4ak from roshavi4ak@gmail.com
        user = await prisma.user.findFirst({
            where: { name: name }
        })
    }

    if (!user) {
        return new NextResponse(`User not found with email: ${email}`, { status: 404 })
    }

    // Create session
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    const sessionToken = randomUUID()

    await prisma.session.create({
        data: {
            sessionToken,
            userId: user.id,
            expires,
        },
    })

    const cookieStore = await cookies()

    // Set cookies for both authjs and next-auth to be safe with v5 beta versions
    const cookieOptions = {
        httpOnly: true,
        path: "/",
        expires,
        sameSite: "lax" as const,
        secure: false, // localhost
    }

    cookieStore.set("authjs.session-token", sessionToken, cookieOptions)
    cookieStore.set("next-auth.session-token", sessionToken, cookieOptions)
    // Also set the secure one just in case purely for name matching if checks are strict, 
    // though secure:false might invalidate it if the browser enforces __Secure prefix semantics strictly (it usually does).
    // So we skip __Secure- prefix for localhost http.

    return redirect("/dashboard")
}
