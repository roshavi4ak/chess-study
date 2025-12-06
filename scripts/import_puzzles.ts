
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import readline from 'readline';
import path from 'path';

const prisma = new PrismaClient();
const CSV_FILE = path.join(process.cwd(), 'lichess_db_puzzle.csv');
const USER_ID = 'cmidi8gr50000v8vc36ubbgir'; // roshavi4ak

// Configuration for the batches we want to import
// "between 1700 and 2000" and "between 2000 and 2400"
const BATCHES = [
    { min: 1700, max: 2000, target: 20000, inserted: 0, buffer: [] as any[] },
    { min: 2000, max: 2400, target: 10000, inserted: 0, buffer: [] as any[] }
];

const FLUSH_THRESHOLD = 500; // Insert to DB when buffer reaches this size

async function flushBuffer(batchIndex: number) {
    const batch = BATCHES[batchIndex];
    if (batch.buffer.length === 0) return;

    try {
        const result = await prisma.puzzle.createMany({
            data: batch.buffer,
            skipDuplicates: true,
        });
        batch.inserted += result.count;
        // console.log(`Batch ${batchIndex} (${batch.min}-${batch.max}): +${result.count} inserted (Total: ${batch.inserted}/${batch.target})`);
    } catch (e) {
        console.error(`Error inserting batch ${batchIndex}:`, e);
    } finally {
        // Clear buffer regardless of success to avoid stuck loop, duplicate attempts will be skipped next time anyway or we move on.
        // But for safety, we clear it.
        batch.buffer = [];
    }
}

async function main() {
    if (!fs.existsSync(CSV_FILE)) {
        console.error(`File not found: ${CSV_FILE}`);
        process.exit(1);
    }

    console.log('Starting multi-batch import...');
    console.log('Batches:', BATCHES.map(b => `${b.min}-${b.max}: target ${b.target}`).join(', '));

    const fileStream = fs.createReadStream(CSV_FILE);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
    });

    let processed = 0;

    // We scan the file from the beginning to ensure we find puzzles in the desired ranges.
    // We ignore previous state for this specific multi-range fill operation.

    for await (const line of rl) {
        processed++;
        if (processed % 10000 === 0) {
            process.stdout.write(`\rScanned ${processed} lines... Status: [${BATCHES.map(b => `${b.inserted}/${b.target}`).join(', ')}]`);
        }

        if (processed === 1) continue; // Skip header

        // Check if all batches are done
        if (BATCHES.every(b => b.inserted >= b.target)) {
            console.log('\nAll targets reached!');
            break;
        }

        const cols = line.split(',');
        if (cols.length < 10) continue;

        const puzzleId = cols[0];
        const rating = parseInt(cols[3]);

        if (isNaN(rating)) continue;

        // Check which batch this puzzle belongs to
        for (let i = 0; i < BATCHES.length; i++) {
            const batch = BATCHES[i];

            // If batch is full, skip
            if (batch.inserted >= batch.target) continue;

            // Check rating range: min <= rating < max
            if (rating >= batch.min && rating < batch.max) {
                const fen = cols[1];
                const moves = cols[2];
                const themes = cols[7];

                batch.buffer.push({
                    name: puzzleId,
                    fen: fen,
                    solution: moves,
                    rating: rating,
                    tags: themes ? themes.split(' ') : [],
                    createdBy: USER_ID,
                    description: `Lichess Puzzle ${puzzleId}`,
                });

                // Flush if buffer is full
                if (batch.buffer.length >= FLUSH_THRESHOLD) {
                    await flushBuffer(i);
                }

                // Once added to a batch, we break (puzzle belongs to only one range effectively)
                break;
            }
        }
    }

    // Final flush for remaining items
    console.log('\nFinalizing imports...');
    for (let i = 0; i < BATCHES.length; i++) {
        await flushBuffer(i);
    }

    console.log('\nImport Summary:');
    BATCHES.forEach(b => {
        console.log(`Range ${b.min}-${b.max}: Requested ${b.target}, Inserted ${b.inserted}`);
    });

    console.log('Done!');
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
