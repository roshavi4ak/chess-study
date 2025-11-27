
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import readline from 'readline';
import path from 'path';

const prisma = new PrismaClient();
const CSV_FILE = path.join(__dirname, '../lichess_db_puzzle.csv');
const TARGET_COUNT = 1000;
const MAX_RATING = 1700;
const USER_ID = 'cmidi8gr50000v8vc36ubbgir'; // roshavi4ak

async function main() {
    if (!fs.existsSync(CSV_FILE)) {
        console.error(`File not found: ${CSV_FILE}`);
        process.exit(1);
    }

    const fileStream = fs.createReadStream(CSV_FILE);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
    });

    const puzzlesToInsert: any[] = [];
    let count = 0;
    let processed = 0;

    console.log('Starting import...');

    for await (const line of rl) {
        processed++;
        if (processed === 1) continue; // Skip header

        // Simple CSV split (assuming no commas in fields for this specific dataset)
        const cols = line.split(',');

        // PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
        // 0       1   2     3      4               5          6       7      8       9

        if (cols.length < 10) continue;

        const rating = parseInt(cols[3]);
        if (isNaN(rating)) continue;

        if (rating < MAX_RATING) {
            const puzzleId = cols[0];
            const fen = cols[1];
            const moves = cols[2];
            const themes = cols[7];

            puzzlesToInsert.push({
                name: puzzleId,
                fen: fen,
                solution: moves, // Storing moves as space-separated string
                rating: rating,
                tags: themes ? themes.split(' ') : [],
                createdBy: USER_ID,
                description: `Lichess Puzzle ${puzzleId}`,
            });

            count++;
            if (count % 100 === 0) {
                process.stdout.write(`\rFound ${count} puzzles...`);
            }

            if (count >= TARGET_COUNT) {
                break;
            }
        }
    }

    console.log(`\nFound ${puzzlesToInsert.length} puzzles. Inserting into database...`);

    // Insert in batches to avoid too large query
    const BATCH_SIZE = 100;
    let inserted = 0;

    for (let i = 0; i < puzzlesToInsert.length; i += BATCH_SIZE) {
        const batch = puzzlesToInsert.slice(i, i + BATCH_SIZE);
        try {
            await prisma.puzzle.createMany({
                data: batch,
                skipDuplicates: true,
            });
            inserted += batch.length;
            process.stdout.write(`\rInserted ${inserted}/${puzzlesToInsert.length}`);
        } catch (e) {
            console.error(`\nError inserting batch ${i}:`, e);
        }
    }

    console.log('\nImport complete!');
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
