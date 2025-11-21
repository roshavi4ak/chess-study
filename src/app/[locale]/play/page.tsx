"use client";

import { useState, useRef, useEffect } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import type { PieceDropHandlerArgs } from "react-chessboard";
import { createStockfishWorker, uciToMove, type StockfishDifficulty } from "@/lib/stockfishWorker";
import { createLichessAIChallenge, streamLichessGame, makeLichessMove, type LichessLevel, type LichessGameState } from "@/lib/lichessService";
import { getLichessAccessToken } from "@/app/actions/lichess";

type GameMode = 'random' | 'stockfish' | 'lichess';

export default function PlayPage() {
    // Game state
    const chessGameRef = useRef(new Chess());
    const chessGame = chessGameRef.current;
    const [chessPosition, setChessPosition] = useState(chessGame.fen());

    // Mode and difficulty
    const [gameMode, setGameMode] = useState<GameMode>('random');
    const [stockfishDifficulty, setStockfishDifficulty] = useState<StockfishDifficulty>('medium');
    const [lichessLevel, setLichessLevel] = useState<LichessLevel>(3);

    // Status and errors
    const [status, setStatus] = useState<string>('Make your move');
    const [error, setError] = useState<string>('');

    // Board orientation
    const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');

    // Stockfish worker ref
    const stockfishWorkerRef = useRef<ReturnType<typeof createStockfishWorker> | null>(null);

    // Lichess game refs
    const lichessGameIdRef = useRef<string | null>(null);
    const lichessCleanupRef = useRef<(() => void) | null>(null);
    const lichessTokenRef = useRef<string | null>(null);
    const [lichessGameStarted, setLichessGameStarted] = useState(false);

    // Initialize Stockfish worker when in Stockfish mode
    useEffect(() => {
        if (gameMode === 'stockfish' && !stockfishWorkerRef.current) {
            stockfishWorkerRef.current = createStockfishWorker();
            setStatus('Stockfish engine ready');
        }

        return () => {
            if (stockfishWorkerRef.current && gameMode !== 'stockfish') {
                stockfishWorkerRef.current.terminate();
                stockfishWorkerRef.current = null;
            }
        };
    }, [gameMode]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (stockfishWorkerRef.current) {
                stockfishWorkerRef.current.terminate();
            }
            if (lichessCleanupRef.current) {
                lichessCleanupRef.current();
            }
        };
    }, []);

    // Make a random CPU move
    function makeRandomMove() {
        const possibleMoves = chessGame.moves();

        if (chessGame.isGameOver()) {
            setStatus(getGameOverMessage());
            return;
        }

        const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
        chessGame.move(randomMove);
        setChessPosition(chessGame.fen());

        if (chessGame.isGameOver()) {
            setStatus(getGameOverMessage());
        } else {
            setStatus('Your turn');
        }
    }

    // Make a Stockfish AI move
    async function makeStockfishMove() {
        if (!stockfishWorkerRef.current) {
            setError('Stockfish engine not initialized');
            return;
        }

        setStatus(`Stockfish is thinking (${stockfishDifficulty})...`);

        try {
            const bestMove = await stockfishWorkerRef.current.messageHandler(
                chessGame.fen(),
                stockfishDifficulty
            );

            if (bestMove) {
                const move = uciToMove(bestMove);
                chessGame.move(move);
                setChessPosition(chessGame.fen());

                if (chessGame.isGameOver()) {
                    setStatus(getGameOverMessage());
                } else {
                    setStatus('Your turn');
                }
            } else {
                setError('Stockfish failed to find a move');
                setStatus('Your turn');
            }
        } catch (err) {
            setError('Error getting Stockfish move');
            setStatus('Your turn');
            console.error('Stockfish error:', err);
        }
    }

    // Start a Lichess game
    async function startLichessGame() {
        setStatus('Connecting to Lichess...');
        setError('');

        try {
            // Get access token
            const token = await getLichessAccessToken();
            if (!token) {
                setError('Please log in with Lichess to play online');
                setStatus('');
                return;
            }

            lichessTokenRef.current = token;

            // Create AI challenge
            const gameId = await createLichessAIChallenge(token, lichessLevel);
            if (!gameId) {
                setError('Failed to create Lichess game');
                setStatus('');
                return;
            }

            lichessGameIdRef.current = gameId;
            setLichessGameStarted(true);
            setStatus('Connected to Lichess! Game started.');

            // Stream game events
            const cleanup = streamLichessGame(
                token,
                gameId,
                (gameState) => {
                    console.log('Lichess game state update:', gameState);

                    // Set board orientation based on player color (only once at game start)
                    if (gameState.playerColor) {
                        setBoardOrientation(gameState.playerColor);
                    }

                    // Apply all moves from the game state
                    if (gameState.moves) {
                        try {
                            // Reset to starting position
                            const newGame = new Chess();

                            // Apply each move from Lichess
                            const movesArray = gameState.moves.trim().split(' ').filter(m => m);
                            for (const uciMove of movesArray) {
                                const move = uciToMove(uciMove);
                                newGame.move(move);
                            }

                            // Update our game state
                            chessGameRef.current = newGame;
                            setChessPosition(newGame.fen());

                            // Update status  based on whose turn it is
                            if (gameState.status === 'finished') {
                                setStatus(`Game finished! Winner: ${gameState.winner || 'Draw'}`);
                            } else {
                                // Check if it's player's turn
                                const currentTurn = newGame.turn(); // 'w' or 'b'
                                const playerTurn = gameState.playerColor === 'white' ? 'w' : 'b';

                                if (currentTurn === playerTurn) {
                                    setStatus('Your turn');
                                } else {
                                    setStatus('Opponent is thinking...');
                                }
                            }
                        } catch (err) {
                            console.error('Error applying Lichess moves:', err);
                            setError('Failed to sync game state');
                        }
                    }
                },
                (errorMsg) => {
                    setError(errorMsg);
                    setStatus('');
                }
            );

            lichessCleanupRef.current = cleanup;
        } catch (err) {
            setError('Error connecting to Lichess');
            setStatus('');
            console.error('Lichess error:', err);
        }
    }

    // Send move to Lichess
    async function sendLichessMove(from: string, to: string, promotion?: string) {
        if (!lichessTokenRef.current || !lichessGameIdRef.current) {
            return false;
        }

        const move = from + to + (promotion || '');
        const success = await makeLichessMove(
            lichessTokenRef.current,
            lichessGameIdRef.current,
            move
        );

        if (!success) {
            setError('Failed to send move to Lichess');
        }

        return success;
    }

    // Get game over message
    function getGameOverMessage(): string {
        if (chessGame.isCheckmate()) {
            return chessGame.turn() === 'w' ? 'Checkmate! Black wins!' : 'Checkmate! White wins!';
        } else if (chessGame.isDraw()) {
            return 'Game drawn!';
        } else if (chessGame.isStalemate()) {
            return 'Stalemate!';
        } else if (chessGame.isThreefoldRepetition()) {
            return 'Draw by threefold repetition!';
        } else if (chessGame.isInsufficientMaterial()) {
            return 'Draw by insufficient material!';
        }
        return 'Game over!';
    }

    // Handle piece drop
    function onPieceDrop({
        sourceSquare,
        targetSquare
    }: PieceDropHandlerArgs) {
        if (!targetSquare) {
            return false;
        }

        try {
            chessGame.move({
                from: sourceSquare,
                to: targetSquare,
                promotion: 'q'
            });

            setChessPosition(chessGame.fen());

            if (chessGame.isGameOver()) {
                setStatus(getGameOverMessage());
                return true;
            }

            // Handle opponent move based on mode
            if (gameMode === 'random') {
                setStatus('CPU is thinking...');
                setTimeout(makeRandomMove, 500);
            } else if (gameMode === 'stockfish') {
                setTimeout(makeStockfishMove, 200);
            } else if (gameMode === 'lichess') {
                // Send move to Lichess
                sendLichessMove(sourceSquare, targetSquare);
                setStatus('Waiting for opponent...');
            }

            return true;
        } catch {
            return false;
        }
    }

    // Start new game
    function startNewGame(mode?: GameMode) {
        // Reset game
        chessGameRef.current = new Chess();
        setChessPosition(chessGameRef.current.fen());
        setError('');
        setStatus('Make your move');
        setBoardOrientation('white');

        // Clean up Lichess connection
        if (lichessCleanupRef.current) {
            lichessCleanupRef.current();
            lichessCleanupRef.current = null;
        }
        lichessGameIdRef.current = null;
        setLichessGameStarted(false);

        // Change mode if specified
        if (mode && mode !== gameMode) {
            setGameMode(mode);
        }

        // Don't auto-start Lichess game - wait for Start button
    }

    // Set the chessboard options (as per react-chessboard documentation)
    const chessboardOptions = {
        position: chessPosition,
        onPieceDrop,
        boardOrientation: boardOrientation,
        id: `play-vs-${gameMode}`
    };

    return (
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0">
                <div className="mb-6 text-center">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                        Play Chess
                    </h1>

                    {/* Mode Selection */}
                    <div className="flex justify-center gap-2 mb-4">
                        <button
                            onClick={() => startNewGame('random')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${gameMode === 'random'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                                }`}
                        >
                            Random
                        </button>
                        <button
                            onClick={() => startNewGame('stockfish')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${gameMode === 'stockfish'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                                }`}
                        >
                            Stockfish
                        </button>
                        <button
                            onClick={() => startNewGame('lichess')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${gameMode === 'lichess'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                                }`}
                        >
                            Lichess AI
                        </button>
                    </div>

                    {/* Difficulty Selection for Stockfish */}
                    {gameMode === 'stockfish' && (
                        <div className="flex justify-center items-center gap-2 mb-4">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Difficulty:
                            </label>
                            <select
                                value={stockfishDifficulty}
                                onChange={(e) => setStockfishDifficulty(e.target.value as StockfishDifficulty)}
                                className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            >
                                <option value="easy">Easy</option>
                                <option value="medium">Medium</option>
                                <option value="hard">Hard</option>
                                <option value="expert">Expert</option>
                            </select>
                        </div>
                    )}

                    {/* Level Selection for Lichess */}
                    {gameMode === 'lichess' && (
                        <div className="flex justify-center items-center gap-2 mb-4">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Level:
                            </label>
                            <select
                                value={lichessLevel}
                                onChange={(e) => setLichessLevel(parseInt(e.target.value) as LichessLevel)}
                                disabled={lichessGameStarted}
                                className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-50"
                            >
                                <option value="1">Level 1</option>
                                <option value="2">Level 2</option>
                                <option value="3">Level 3</option>
                                <option value="4">Level 4</option>
                                <option value="5">Level 5</option>
                                <option value="6">Level 6</option>
                                <option value="7">Level 7</option>
                                <option value="8">Level 8</option>
                            </select>
                            {!lichessGameStarted && (
                                <button
                                    onClick={startLichessGame}
                                    className="px-4 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                                >
                                    Start
                                </button>
                            )}
                        </div>
                    )}

                    {/* Status Display */}
                    {status && (
                        <div className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">
                            {status}
                        </div>
                    )}

                    {/* Error Display */}
                    {error && (
                        <div className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">
                            {error}
                        </div>
                    )}
                </div>

                {/* Chessboard */}
                <div className="flex justify-center">
                    <div className="w-full max-w-[600px] aspect-square">
                        <Chessboard options={chessboardOptions} />
                    </div>
                </div>

                {/* New Game Button */}
                <div className="mt-8 text-center">
                    <button
                        onClick={() => startNewGame()}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                    >
                        New Game
                    </button>
                </div>

                {/* Current Mode Indicator */}
                <div className="mt-4 text-center text-sm text-gray-500">
                    <p>
                        {gameMode === 'random' && 'Playing against random moves'}
                        {gameMode === 'stockfish' && `Playing against Stockfish (${stockfishDifficulty})`}
                        {gameMode === 'lichess' && `Playing against Lichess AI (Level ${lichessLevel})`}
                    </p>
                </div>
            </div>
        </main>
    );
}
