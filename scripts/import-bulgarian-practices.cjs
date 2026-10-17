/* eslint-disable @typescript-eslint/no-require-imports -- These .cjs tools use Node's CommonJS runtime. */
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const manifestPath = process.argv.slice(2).find(argument => !argument.startsWith('--')) ||
  path.join(process.cwd(), 'openings', 'bulgarian', 'next-practices.json');
const checkOnly = process.argv.includes('--check');

function countNodes(node) {
  return 1 + node.children.reduce((count, child) => count + countNodes(child), 0);
}

function countLeaves(node) {
  return node.children.length === 0
    ? 1
    : node.children.reduce((count, child) => count + countLeaves(child), 0);
}

function assertBulgarian(value, label, allowEnglish = false) {
  if (typeof value !== 'string' || !/[А-Яа-я]/.test(value)) {
    throw new Error(`${label} is not Bulgarian text`);
  }
  if (!allowEnglish && /[A-Za-z]{2,}/.test(value
    .replace(/\b(?:[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?|O-O(?:-O)?)\b/g, '')
    .replace(/\b[a-h]-/g, ''))) throw new Error(`${label} contains untranslated Latin prose`);
}

function validateManifest(manifest) {
  if (manifest?.formatVersion !== 1 || manifest.language !== 'bg') {
    throw new Error('Unexpected Bulgarian practice manifest format');
  }
  if (!Array.isArray(manifest.practices) || manifest.practices.length < 1 || manifest.practices.length > 20) {
    throw new Error('Expected between one and twenty practices in the manifest');
  }
  if (new Set(manifest.practices.map(practice => practice.name)).size !== manifest.practices.length) {
    throw new Error('Manifest contains duplicate practice names');
  }
  for (const practice of manifest.practices) {
    assertBulgarian(practice.name, `${practice.slug} name`, true);
    assertBulgarian(practice.description, `${practice.slug} description`);
    if (!['WHITE', 'BLACK'].includes(practice.playerColor)) {
      throw new Error(`${practice.slug} has an invalid player color`);
    }
    if (!practice.tree || practice.tree.move !== null || practice.tree.lineNumber !== null ||
        practice.tree.fen !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
      throw new Error(`${practice.slug} has an invalid root node`);
    }
    const nodes = [];
    const seen = new Set();
    const walk = (node) => {
      if (!node || typeof node.fen !== 'string' || !Array.isArray(node.children)) {
        throw new Error(`${practice.slug} contains an invalid tree node`);
      }
      if (seen.has(node.id)) throw new Error(`${practice.slug} contains duplicate tree IDs`);
      seen.add(node.id);
      nodes.push(node);
      if (node.notes) assertBulgarian(node.notes, `${practice.slug} node note`);
      if (node.children.length && node.lineNumber !== null) {
        throw new Error(`${practice.slug} has a numbered nonterminal node`);
      }
      node.children.forEach(walk);
    };
    walk(practice.tree);
    const lines = countLeaves(practice.tree);
    const expectedNodes = countNodes(practice.tree);
    if (nodes.length !== expectedNodes || lines < 1) {
      throw new Error(`${practice.slug} tree counts are invalid`);
    }
    const lineNumbers = nodes.filter(node => !node.children.length).map(node => node.lineNumber).sort((a, b) => a - b);
    if (lineNumbers.some((number, index) => number !== index + 1)) {
      throw new Error(`${practice.slug} has invalid terminal line numbers`);
    }
    if (practice.counts?.nodes !== nodes.length || practice.counts?.lines !== lines ||
        practice.counts?.notes !== nodes.filter(node => node.notes).length) {
      throw new Error(`${practice.slug} differs from its validated manifest counts`);
    }
    console.log(`${practice.name}: ${lines} lines, ${nodes.length} nodes, ${nodes.filter((node) => node.notes).length} notes`);
  }
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  validateManifest(manifest);
  if (checkOnly) {
    console.log(JSON.stringify({ status: 'VALID_MANIFEST_NO_IMPORT', practices: manifest.practices.length }));
    return;
  }
  const names = manifest.practices.map((practice) => practice.name);

  const result = await prisma.$transaction(async (tx) => {
    const coach = await tx.user.findFirst({
      where: { lichessId: manifest.coachLichessId || 'roshavi4ak' },
      select: { id: true, name: true, role: true, lichessId: true },
    });
    if (!coach) throw new Error('Coach account was not found');
    if (coach.role !== 'COACH') throw new Error(`Coach account has role ${coach.role}`);

    const duplicates = await tx.practice.findMany({
      where: { name: { in: names } },
      select: { id: true, name: true },
    });
    if (duplicates.length) {
      throw new Error(`Practice already exists: ${duplicates.map((practice) => practice.name).join(', ')}`);
    }

    const created = [];
    for (const input of manifest.practices) {
      const practice = await tx.practice.create({
        data: {
          name: input.name,
          description: input.description,
          playerColor: input.playerColor,
          createdBy: coach.id,
        },
        select: { id: true, name: true },
      });
      let nodeCount = 0;
      let lineCount = 0;
      async function createNode(node, parentId, order) {
        const createdNode = await tx.practiceNode.create({
          data: {
            practiceId: practice.id,
            parentId,
            fen: node.fen,
            move: node.move,
            notes: node.notes || null,
            order,
            lineNumber: node.lineNumber,
          },
        });
        nodeCount += 1;
        if (node.children.length === 0) lineCount += 1;
        for (let index = 0; index < node.children.length; index += 1) {
          await createNode(node.children[index], createdNode.id, index);
        }
      }
      await createNode(input.tree, null, 0);
      const numbered = await tx.practiceNode.count({
        where: { practiceId: practice.id, lineNumber: { not: null } },
      });
      if (numbered !== lineCount) {
        throw new Error(`${input.slug} line-number count mismatch`);
      }
      created.push({ id: practice.id, name: practice.name, nodes: nodeCount, lines: lineCount });
    }
    return { coach, created };
  }, { maxWait: 10000, timeout: 120000 });

  console.log(JSON.stringify({ status: 'IMPORTED', coach: result.coach, practices: result.created }));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ status: 'NOT_IMPORTED', error: error.message }));
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
