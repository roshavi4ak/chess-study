import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const username = "roshavi4ak";

    console.log(`Updating role for user: ${username}...`);

    try {
        // Try to find by name or lichessId
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { name: username },
                    { lichessId: username }
                ]
            }
        });

        if (!user) {
            console.error(`User '${username}' not found.`);
            return;
        }

        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: { role: "COACH" }
        });

        console.log(`Successfully updated user '${updatedUser.name}' (ID: ${updatedUser.id}) to role: ${updatedUser.role}`);
    } catch (error) {
        console.error("Error updating user role:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
