
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import readline from 'readline';
import path from 'path';

const prisma = new PrismaClient();
const CSV_FILE = path.join(__dirname, '../lichess_db_puzzle.csv');
const STATE_FILE = path.join(__dirname, '../.import_state.json');
const TARGET_COUNT = 10000;
const MAX_RATING = 1700;
const USER_ID = 'cmidi8gr50000v8vc36ubbgir'; // roshavi4ak

interface ImportState {
    lastImportedId: string | null;
    totalImported: number;
}

function loadState(): ImportState {
    if (fs.existsSync(STATE_FILE)) {
        const data = fs.readFileSync(STATE_FILE, 'utf-8');
        return JSON.parse(data);
    }
    return { lastImportedId: null, totalImported: 0 };
}

function saveState(state: ImportState) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function main() {
    if (!fs.existsSync(CSV_FILE)) {
        console.error(`File not found: ${CSV_FILE}`);
        process.exit(1);
    }

    const state = loadState();
    console.log(`Resuming from: ${state.lastImportedId || 'beginning'}`);
    console.log(`Total previously imported: ${state.totalImported}`);

    const fileStream = fs.createReadStream(CSV_FILE);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
    });

    const puzzlesToInsert: any[] = [];
    let count = 0;
    let processed = 0;
    let foundResumePont = state.lastImportedId === null;
    let lastProcessedId: string | null = null;

    console.log('Starting import...');

    for await (const line of rl) {
        processed++;
        if (processed === 1) continue; // Skip header

        const cols = line.split(',');
        if (cols.length < 10) continue;

        const puzzleId = cols[0];
        lastProcessedId = puzzleId;

        // Skip until we find our resume point
        if (!foundResumePont) {
            if (puzzleId === state.lastImportedId) {
                foundResumePont = true;
                console.log(`Found resume point at puzzle: ${puzzleId}`);
            }
            continue;
        }

        const rating = parseInt(cols[3]);
        if (isNaN(rating)) continue;

        if (rating < MAX_RATING) {
            const fen = cols[1];
            const moves = cols[2];
            const themes = cols[7];

            puzzlesToInsert.push({
                name: puzzleId,
                fen: fen,
                solution: moves,
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

    // Insert in batches
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

    // Update state
    if (lastProcessedId) {
        state.lastImportedId = lastProcessedId;
        state.totalImported += inserted;
        saveState(state);
        console.log(`\nSaved state. Last imported: ${lastProcessedId}`);
        console.log(`Total imported so far: ${state.totalImported}`);
    }

    console.log('\nImport complete!');
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
