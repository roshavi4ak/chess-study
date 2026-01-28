// Run this with: npx ts-node --transpile-only scripts/set-vienna-progress-sql.ts
// This uses raw SQL to avoid Prisma client issues

import 'dotenv/config';

async function main() {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  
  try {
    // Get Vienna Gambit practice
    const practice = await prisma.$queryRaw`
      SELECT id, name FROM "Practice" 
      WHERE name ILIKE '%Vienna%' OR name ILIKE '%Виенск%'
      LIMIT 1
    ` as { id: string, name: string }[];

    if (!practice || practice.length === 0) {
      console.log('Vienna Gambit practice not found');
      return;
    }

    console.log(`Practice: ${practice[0].name}`);
    console.log(`ID: ${practice[0].id}`);

    // Get nodes with lineNumbers
    const nodes = await prisma.$queryRaw`
      SELECT id, "lineNumber" FROM "PracticeNode"
      WHERE "practiceId" = ${practice[0].id} AND "lineNumber" IS NOT NULL
      ORDER BY "lineNumber"
    ` as { id: string, lineNumber: number }[];

    console.log(`Nodes: ${nodes.length} (lineNumbers: ${nodes.map(n => n.lineNumber).join(', ')})`);

    // User IDs from the database
    const users = [
      { id: 'cmkqz6kkx00009avy4oro1mk3', name: 'ivantihov' },
      { id: 'cmkh3r36y00009axiopzrk250', name: 'meliproto' },
      { id: 'cmk7aucwp00009a230m7sefqw', name: 'grigor19' },
      { id: 'cmidi8gr50000v8vc36ubbgir', name: 'roshavi4ak' },
    ];

    console.log(`Found ${users.length} users`);

    // Create progress for each user
    const userProgress = [
      { name: 'ivantihov', perfect: 14, seen: 14 },
      { name: 'meliproto', perfect: 8, seen: 14 },
      { name: 'grigor19', perfect: 1, seen: 6 },
      { name: 'roshavi4ak', perfect: 14, seen: 14 },
    ];

    for (const up of userProgress) {
      const user = users.find(u => u.name === up.name);
      if (!user) {
        console.log(`User ${up.name} not found`);
        continue;
      }

      console.log(`\n=== ${up.name} ===`);
      console.log(`  Perfect: 1-${up.perfect}, Seen: 1-${up.seen}`);

      // Delete existing progress
      await prisma.$executeRaw`
        DELETE FROM "PracticeLineProgress"
        WHERE "userId" = ${user.id} AND "practiceId" = ${practice[0].id}
      `;

      // Insert new progress
      for (const node of nodes) {
        if (node.lineNumber <= up.seen) {
          const status = node.lineNumber <= up.perfect ? 'PERFECT' : 'COMPLETED';
          const id = crypto.randomUUID();
          await prisma.$executeRaw`
            INSERT INTO "PracticeLineProgress" (id, "userId", "practiceId", "nodeId", "status", "createdAt", "updatedAt")
            VALUES (${id}, ${user.id}, ${practice[0].id}, ${node.id}, ${status}::"LineStatus", NOW(), NOW())
          `;
        }
      }

      console.log(`  Inserted progress for ${up.seen} lines`);
    }

    console.log('\n✅ Done!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
