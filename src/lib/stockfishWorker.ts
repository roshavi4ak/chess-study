/**
 * Stockfish Worker Utility
 * Manages Stockfish Web Worker for chess AI gameplay
 */

export type StockfishDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

interface StockfishWorkerInstance {
    worker: Worker;
    messageHandler: (fen: string, difficulty: StockfishDifficulty) => Promise<string | null>;
    terminate: () => void;
}

/**
 * Get the search depth based on difficulty level
 */
function getDepthForDifficulty(difficulty: StockfishDifficulty): number {
    switch (difficulty) {
        case 'easy':
            return 5;
        case 'medium':
            return 10;
        case 'hard':
            return 15;
        case 'expert':
            return 20;
        default:
            return 10;
    }
}

/**
 * Initialize a Stockfish worker instance
 */
export function createStockfishWorker(): StockfishWorkerInstance {
    const worker = new Worker('/stockfish.js');

    // Initialize UCI mode
    worker.postMessage('uci');

    const messageHandler = async (
        fen: string,
        difficulty: StockfishDifficulty
    ): Promise<string | null> => {
        return new Promise((resolve) => {
            const depth = getDepthForDifficulty(difficulty);

            // Set up listener for the best move
            const onMessage = (e: MessageEvent) => {
                const message = e.data;

                // Look for bestmove response
                if (typeof message === 'string' && message.startsWith('bestmove')) {
                    worker.removeEventListener('message', onMessage);

                    // Parse the best move (format: "bestmove e2e4 ponder e7e5")
                    const parts = message.split(' ');
                    const bestMove = parts[1];

                    if (bestMove && bestMove !== '(none)') {
                        resolve(bestMove);
                    } else {
                        resolve(null);
                    }
                }
            };

            worker.addEventListener('message', onMessage);

            // Send position and search command
            worker.postMessage(`position fen ${fen}`);
            worker.postMessage(`go depth ${depth}`);

            // Timeout after 30 seconds
            setTimeout(() => {
                worker.removeEventListener('message', onMessage);
                resolve(null);
            }, 30000);
        });
    };

    const terminate = () => {
        worker.terminate();
    };

    return {
        worker,
        messageHandler,
        terminate
    };
}

/**
 * Convert UCI move format (e.g., "e2e4") to chess.js move object
 */
export function uciToMove(uciMove: string): { from: string; to: string; promotion?: string } {
    const from = uciMove.substring(0, 2);
    const to = uciMove.substring(2, 4);
    const promotion = uciMove.length > 4 ? uciMove.substring(4) : undefined;

    return { from, to, promotion };
}

let sharedWorker: Worker | null = null;

/**
 * Ask Stockfish for a move at a limited skill level and depth (used by the animal bots).
 * Resolves to null if the engine cannot start or does not answer in time, so callers can fall back.
 */
export function requestBotMove(fen: string, { skill, depth }: { skill: number; depth: number }, timeoutMs = 8000): Promise<string | null> {
    return new Promise((resolve) => {
        try {
            if (!sharedWorker) {
                sharedWorker = new Worker('/stockfish.js');
                sharedWorker.postMessage('uci');
            }
        } catch (error) {
            console.error('Stockfish could not start:', error);
            resolve(null);
            return;
        }
        const worker = sharedWorker;
        const timer = setTimeout(() => {
            worker.removeEventListener('message', onMessage);
            worker.postMessage('stop');
            resolve(null);
        }, timeoutMs);
        function onMessage(e: MessageEvent) {
            if (typeof e.data !== 'string' || !e.data.startsWith('bestmove')) return;
            clearTimeout(timer);
            worker.removeEventListener('message', onMessage);
            const move = e.data.split(' ')[1];
            resolve(move && move !== '(none)' ? move : null);
        }
        worker.addEventListener('message', onMessage);
        worker.postMessage('ucinewgame');
        worker.postMessage(`setoption name Skill Level value ${Math.max(0, Math.min(20, Math.round(skill)))}`);
        worker.postMessage(`position fen ${fen}`);
        worker.postMessage(`go depth ${Math.max(1, Math.round(depth))}`);
    });
}
