
import { PrismaClient } from "@prisma/client";


// Redefining to be safe in case of module resolution issues with "src/lib/avatars" vs relative paths
const AVATARS_LIST = [
    "Alpaca.png",
    "Bear.png",
    "Cat.png",
    "Dear.png",
    "Dog.png",
    "Elephant.png",
    "Fox.png",
    "Frog.png",
    "Giraffe.png",
    "Goat.png",
    "Koala.png",
    "Lion.png",
    "Monkey.png",
    "Panda.png",
    "Penguin.png",
    "Pig.png",
    "Rabbit.png",
    "Raccoon.png",
    "Rat.png",
    "Seal.png",
    "Sheep.png",
    "Sloth.png",
    "Tiger.png",
    "Zebra.png"
];

const prisma = new PrismaClient();

async function main() {
    console.log("Checking for users without avatars...");

    const usersWithoutAvatar = await prisma.user.findMany({
        where: {
            OR: [
                { image: null },
                { image: "" },
                { image: "https://lichess1.org/assets/logo/lichess-pad3.svg" }
            ]
        }
    });

    console.log(`Found ${usersWithoutAvatar.length} users without avatars.`);

    for (const user of usersWithoutAvatar) {
        const randomAvatar = AVATARS_LIST[Math.floor(Math.random() * AVATARS_LIST.length)];
        const imagePath = `/img/avatars/${randomAvatar}`;

        console.log(`Assigning ${randomAvatar} to ${user.name || user.email || user.id}`);

        await prisma.user.update({
            where: { id: user.id },
            data: { image: imagePath }
        });
    }

    console.log("Done!");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
