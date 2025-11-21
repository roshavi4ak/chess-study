/**
 * Lichess Board API Service
 * Handles game creation, move streaming, and game state updates
 */

export type LichessLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface LichessGameState {
    gameId: string;
    fen: string;
    moves: string; // Space-separated UCI moves
    lastMove?: string;
    status: 'created' | 'started' | 'finished';
    winner?: 'white' | 'black' | 'draw';
    playerColor?: 'white' | 'black'; // Which color the player is playing
}

interface LichessGameEvent {
    type: 'gameFull' | 'gameState' | 'chatLine';
    id?: string;
    white?: {
        id?: string;
        name?: string;
        aiLevel?: number;
    };
    black?: {
        id?: string;
        name?: string;
        aiLevel?: number;
    };
    state?: {
        moves: string;
        wtime?: number;
        btime?: number;
        status: string;
        winner?: string;
    };
    moves?: string;
    status?: string;
    winner?: string;
}

export async function createLichessAIChallenge(
    accessToken: string,
    level: LichessLevel = 3
): Promise<string | null> {
    try {
        const response = await fetch('https://lichess.org/api/challenge/ai', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                level: level.toString(),
                // No clock parameters = unlimited/correspondence time
            }),
        });

        if (!response.ok) {
            console.error('Failed to create Lichess AI challenge:', response.statusText);
            return null;
        }

        const data = await response.json();
        return data.id || null;
    } catch (error) {
        console.error('Error creating Lichess AI challenge:', error);
        return null;
    }
}

/**
 * Stream a Lichess game and receive real-time updates
 * Uses fetch with ReadableStream since EventSource doesn't support custom headers
 */
export function streamLichessGame(
    accessToken: string,
    gameId: string,
    onGameState: (state: LichessGameState) => void,
    onError: (error: string) => void
): () => void {
    let abortController = new AbortController();

    const startStream = async () => {
        try {
            const response = await fetch(
                `https://lichess.org/api/board/game/stream/${gameId}`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                    },
                    signal: abortController.signal,
                }
            );

            if (!response.ok) {
                onError(`Failed to connect to Lichess: ${response.status} ${response.statusText}`);
                return;
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
                onError('Failed to read Lichess stream');
                return;
            }

            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.trim() === '') continue;

                    try {
                        const data: LichessGameEvent = JSON.parse(line);

                        if (data.type === 'gameFull') {
                            // Initial game state
                            const moves = data.state?.moves || '';

                            // Detect player color (if white has aiLevel, player is black)
                            const playerColor = data.white?.aiLevel ? 'black' : 'white';

                            onGameState({
                                gameId,
                                fen: '', // Will be calculated from moves
                                moves: moves,
                                lastMove: moves.split(' ').pop(),
                                status: 'started',
                                playerColor: playerColor,
                            });
                        } else if (data.type === 'gameState') {
                            // Game state update
                            const moves = data.moves || data.state?.moves || '';
                            const status = data.status || data.state?.status || 'started';

                            onGameState({
                                gameId,
                                fen: '', // Will be calculated from moves
                                moves: moves,
                                lastMove: moves.split(' ').pop(),
                                status: status === 'mate' || status === 'resign' || status === 'draw'
                                    ? 'finished'
                                    : 'started',
                                winner: data.winner || data.state?.winner
                                    ? (data.winner || data.state?.winner) as 'white' | 'black' | 'draw'
                                    : undefined,
                            });
                        }
                    } catch (error) {
                        console.error('Error parsing Lichess event:', error, 'Raw line:', line);
                    }
                }
            }
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error('Lichess stream error:', error);
                onError('Connection to Lichess lost');
            }
        }
    };

    // Start the stream
    startStream();

    // Return cleanup function
    return () => {
        abortController.abort();
    };
}

/**
 * Make a move on a Lichess game
 */
export async function makeLichessMove(
    accessToken: string,
    gameId: string,
    move: string
): Promise<boolean> {
    try {
        const response = await fetch(
            `https://lichess.org/api/board/game/${gameId}/move/${move}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            }
        );

        return response.ok;
    } catch (error) {
        console.error('Error making Lichess move:', error);
        return false;
    }
}

/**
 * Resign a Lichess game
 */
export async function resignLichessGame(
    accessToken: string,
    gameId: string
): Promise<boolean> {
    try {
        const response = await fetch(
            `https://lichess.org/api/board/game/${gameId}/resign`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            }
        );

        return response.ok;
    } catch (error) {
        console.error('Error resigning Lichess game:', error);
        return false;
    }
}
