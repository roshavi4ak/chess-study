
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const nameMapping = {
    "mi666ka": "Мария Кръстева",
    "so_nik_18": "so_nik_18",
    "katitooo": "Екатерина",
    "grigor19": "Григор",
    "petar1976": "Петър Треньор",
    "velitto": "Велизар",
    "meliproto": "Мелиса",
    "belozema": "Тоньо",
    "tani11": "Таня",
    "nikola9991": "Никола",
    "abzbfan-1472-natka": "Натанаил",
    "vanya_stoeva": "Ваня Стоева",
    "belozem": "Петър Треньор",
    "todorpro": "Тодор",
    "roshavi4ak": "Кръстьо Треньор"
};

async function updateNames() {
    console.log("Starting bulk update of user names...");

    for (const [username, name] of Object.entries(nameMapping)) {
        try {
            const result = await prisma.user.updateMany({
                where: {
                    lichessId: {
                        equals: username,
                        mode: 'insensitive'
                    }
                },
                data: {
                    name: name,
                    isNameSet: true
                }
            });
            console.log(`Updated ${username} -> ${name} (${result.count} record(s))`);
        } catch (error) {
            console.error(`Error updating ${username}:`, error);
        }
    }

    console.log("Update completed.");
}

updateNames()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
