
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, '../backups', timestamp);
    fs.mkdirSync(backupDir, { recursive: true });

    console.log(`Backing up to ${backupDir}...`);

    const users = await prisma.user.findMany();
    fs.writeFileSync(path.join(backupDir, 'users.json'), JSON.stringify(users, null, 2));
    console.log(`Backed up ${users.length} users.`);

    const puzzles = await prisma.puzzle.findMany();
    fs.writeFileSync(path.join(backupDir, 'puzzles.json'), JSON.stringify(puzzles, null, 2));
    console.log(`Backed up ${puzzles.length} puzzles.`);

    const openings = await prisma.opening.findMany();
    fs.writeFileSync(path.join(backupDir, 'openings.json'), JSON.stringify(openings, null, 2));
    console.log(`Backed up ${openings.length} openings.`);

    const openingSteps = await prisma.openingStep.findMany();
    fs.writeFileSync(path.join(backupDir, 'openingSteps.json'), JSON.stringify(openingSteps, null, 2));
    console.log(`Backed up ${openingSteps.length} opening steps.`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
