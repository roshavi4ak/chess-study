"use client";

import { useState, useRef, useEffect } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import type { PieceDropHandlerArgs } from "react-chessboard";
import { uciToMove } from "@/lib/stockfishWorker";
import { getAvailableUsers, type AvailableUser } from "@/app/actions/users";
import {
    createLichessAIChallenge,
    createLichessUserChallenge,
    streamLichessGame,
    streamLichessEvents,
    makeLichessMove,
    acceptLichessChallenge,
    declineLichessChallenge,
    resignLichessGame,
    offerLichessDraw,
    type LichessLevel,
    type LichessGameState,
    type ChallengeOptions
} from "@/lib/lichessService";
import { getLichessAccessToken, getCurrentUserLichessId } from "@/app/actions/lichess";

type GameMode = 'lichess' | 'friend';

interface IncomingChallenge {
    id: string;
    challengerName: string;
    challengerRating?: number;
    rated: boolean;
    timeControl: string;
    variant: string;
}

// Helper to format clock time
function formatTime(ms: number | undefined): string {
    if (ms === undefined) return '--:--';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function PlayPage() {
    // Game state
    const chessGameRef = useRef(new Chess());
    const chessGame = chessGameRef.current;
    const [chessPosition, setChessPosition] = useState(chessGame.fen());

    // Mode and difficulty
    const [gameMode, setGameMode] = useState<GameMode>('lichess');
    const [lichessLevel, setLichessLevel] = useState<LichessLevel>(3);

    // Status and errors
    const [status, setStatus] = useState<string>('Make your move');
    const [error, setError] = useState<string>('');

    // Board orientation
    const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');

    // Player color for the current game (persisted throughout the game)
    const playerColorRef = useRef<'white' | 'black'>('white');
    const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white');

    // Player info state
    const [whiteName, setWhiteName] = useState<string>('White');
    const [blackName, setBlackName] = useState<string>('Black');
    const [whiteRating, setWhiteRating] = useState<number | undefined>();
    const [blackRating, setBlackRating] = useState<number | undefined>();
    const [whiteTime, setWhiteTime] = useState<number | undefined>();
    const [blackTime, setBlackTime] = useState<number | undefined>();

    // Lichess game refs
    const lichessGameIdRef = useRef<string | null>(null);
    const lichessCleanupRef = useRef<(() => void) | null>(null);
    const lichessEventCleanupRef = useRef<(() => void) | null>(null);
    const lichessTokenRef = useRef<string | null>(null);
    const [lichessGameStarted, setLichessGameStarted] = useState(false);

    // Friend Challenge State
    const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
    const [selectedUser, setSelectedUser] = useState<string>('');
    const [challengeConfig, setChallengeConfig] = useState<ChallengeOptions>({
        rated: false,
        clock: { limit: 300, increment: 0 }, // 5+0 default
        color: 'random'
    });
    const [incomingChallenge, setIncomingChallenge] = useState<IncomingChallenge | null>(null);
    const [isWaitingForChallenge, setIsWaitingForChallenge] = useState(false);
    const myLichessIdRef = useRef<string | null>(null);



    // Initialize Lichess event stream
    useEffect(() => {
        const initLichessStream = async () => {
            const token = await getLichessAccessToken();
            const myLichessId = await getCurrentUserLichessId();

            if (token && myLichessId) {
                lichessTokenRef.current = token;
                myLichessIdRef.current = myLichessId;

                // Fetch available users
                const users = await getAvailableUsers();
                setAvailableUsers(users);
                if (users.length > 0) {
                    setSelectedUser(users[0].id);
                }

                // Start event stream
                lichessEventCleanupRef.current = streamLichessEvents(
                    token,
                    (event) => {
                        console.log('Lichess event:', event);
                        if (event.type === 'challenge') {
                            const challenge = event.challenge;
                            // Only show incoming challenges where I am the recipient (destUser)
                            // Filter out challenges I sent (where I'm the challenger)
                            if (challenge.status === 'created' &&
                                challenge.destUser &&
                                challenge.challenger?.id?.toLowerCase() !== myLichessId.toLowerCase()) {
                                // Incoming challenge from another user
                                setIncomingChallenge({
                                    id: challenge.id,
                                    challengerName: challenge.challenger?.name || 'Unknown',
                                    challengerRating: challenge.challenger?.rating,
                                    rated: challenge.rated || false,
                                    timeControl: challenge.timeControl?.show || 'Correspondence',
                                    variant: challenge.variant?.name || 'Standard'
                                });
                            }
                        } else if (event.type === 'gameStart') {
                            // Game started!
                            const gameId = event.game.id;
                            // Only connect if we're not already connected to avoid double-stream error
                            if (gameId && !lichessGameIdRef.current) {
                                setIsWaitingForChallenge(false);
                                setIncomingChallenge(null);
                                // Don't change game mode - keep it as 'friend' if that's what it was

                                // Start streaming the game
                                connectToLichessGame(gameId);
                            }
                        }
                    },
                    (err) => console.error('Lichess event stream error:', err)
                );
            }
        };

        initLichessStream();

        return () => {
            if (lichessCleanupRef.current) {
                lichessCleanupRef.current();
            }
            if (lichessEventCleanupRef.current) {
                lichessEventCleanupRef.current();
            }
        };
    }, []);


    // Connect to an existing Lichess game
    async function connectToLichessGame(gameId: string) {
        if (!lichessTokenRef.current) return;

        setStatus('Connecting to game...');
        lichessGameIdRef.current = gameId;
        setLichessGameStarted(true);

        // Stream game events
        const cleanup = streamLichessGame(
            lichessTokenRef.current,
            gameId,
            myLichessIdRef.current,
            (gameState) => {
                // ... existing game state handling ...
                // Reuse the logic from startLichessGame but extracted
                handleLichessGameState(gameState);
            },
            (errorMsg) => {
                setError(errorMsg);
                setStatus('');
            }
        );

        lichessCleanupRef.current = cleanup;
    }

    function handleLichessGameState(gameState: LichessGameState) {
        console.log('Lichess game state update:', gameState);

        // Set board orientation and player color (only once at game start when playerColor is provided)
        if (gameState.playerColor) {
            setBoardOrientation(gameState.playerColor);
            setPlayerColor(gameState.playerColor);
            playerColorRef.current = gameState.playerColor;
        }

        // Update player names and ratings (only from gameFull events which have this data)
        if (gameState.whiteName) {
            setWhiteName(gameState.whiteName);
        }
        if (gameState.blackName) {
            setBlackName(gameState.blackName);
        }
        if (gameState.whiteRating !== undefined) {
            setWhiteRating(gameState.whiteRating);
        }
        if (gameState.blackRating !== undefined) {
            setBlackRating(gameState.blackRating);
        }

        // Update clock times
        if (gameState.wtime !== undefined) {
            setWhiteTime(gameState.wtime);
        }
        if (gameState.btime !== undefined) {
            setBlackTime(gameState.btime);
        }

        // Apply all moves from the game state
        if (gameState.moves !== undefined) {
            try {
                // Reset to starting position
                const newGame = new Chess();

                // Apply each move from Lichess if there are any
                const movesArray = gameState.moves.trim().split(' ').filter(m => m);
                for (const uciMove of movesArray) {
                    const move = uciToMove(uciMove);
                    newGame.move(move);
                }

                // Update our game state
                chessGameRef.current = newGame;
                setChessPosition(newGame.fen());

                // Update status based on whose turn it is
                // Use the stored playerColorRef since gameState.playerColor is only in gameFull
                if (gameState.status === 'finished') {
                    setStatus(`Game finished! Winner: ${gameState.winner || 'Draw'}`);
                } else {
                    // Check if it's player's turn using the persisted playerColorRef
                    const currentTurn = newGame.turn(); // 'w' or 'b'
                    const myTurn = playerColorRef.current === 'white' ? 'w' : 'b';

                    if (currentTurn === myTurn) {
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
    }

    // Start a Lichess AI game
    async function startLichessGame() {
        setStatus('Connecting to Lichess...');
        setError('');

        try {
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

            connectToLichessGame(gameId);
            setStatus('Connected to Lichess! Game started.');
        } catch (err) {
            setError('Error connecting to Lichess');
            setStatus('');
            console.error('Lichess error:', err);
        }
    }

    // Start a User Challenge
    async function startUserChallenge() {
        if (!selectedUser) {
            setError('Please select a user to challenge');
            return;
        }

        setStatus('Sending challenge...');
        setError('');
        setIsWaitingForChallenge(true);

        try {
            const token = await getLichessAccessToken();
            if (!token) {
                setError('Please log in with Lichess');
                setIsWaitingForChallenge(false);
                return;
            }
            lichessTokenRef.current = token;

            // Find the lichess username of the selected user
            const targetUser = availableUsers.find(u => u.id === selectedUser);
            if (!targetUser?.lichessId) {
                setError('Selected user does not have a Lichess ID');
                setIsWaitingForChallenge(false);
                return;
            }

            const result = await createLichessUserChallenge(token, targetUser.lichessId, challengeConfig);

            if (result.accepted) {
                // Challenge was accepted!
                // Don't call connectToLichessGame here - let the event stream handle it
                // This prevents the double-stream error
                setStatus(`Challenge accepted! Starting game...`);
                // The gameStart event will trigger connectToLichessGame
            } else {
                setError(`Challenge failed: ${result.reason}`);
                setIsWaitingForChallenge(false);
                setStatus('');
            }
        } catch (err) {
            setError('Error sending challenge');
            setIsWaitingForChallenge(false);
            console.error('Challenge error:', err);
        }
    }

    async function handleAcceptChallenge() {
        if (!incomingChallenge || !lichessTokenRef.current) return;

        const success = await acceptLichessChallenge(lichessTokenRef.current, incomingChallenge.id);
        if (success) {
            setIncomingChallenge(null);
            // Game start will be handled by event stream
        } else {
            setError('Failed to accept challenge');
        }
    }

    async function handleDeclineChallenge() {
        if (!incomingChallenge || !lichessTokenRef.current) return;

        const success = await declineLichessChallenge(lichessTokenRef.current, incomingChallenge.id);
        if (success) {
            setIncomingChallenge(null);
        } else {
            setError('Failed to decline challenge');
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

        // For Lichess games, verify it's the player's turn before allowing the move
        if (lichessGameStarted && (gameMode === 'lichess' || gameMode === 'friend')) {
            const currentTurn = chessGame.turn(); // 'w' or 'b'
            const myTurn = playerColorRef.current === 'white' ? 'w' : 'b';

            if (currentTurn !== myTurn) {
                setError('It\'s not your turn!');
                return false;
            }
        }

        try {
            chessGame.move({
                from: sourceSquare,
                to: targetSquare,
                promotion: 'q'
            });

            setChessPosition(chessGame.fen());
            setError(''); // Clear any previous error

            // Send move to Lichess BEFORE checking if game is over
            // This ensures checkmate moves are transmitted
            if (gameMode === 'lichess' || gameMode === 'friend') {
                sendLichessMove(sourceSquare, targetSquare);
            }

            if (chessGame.isGameOver()) {
                setStatus(getGameOverMessage());
                return true;
            }

            // Handle opponent move based on mode
            if (gameMode === 'lichess' || gameMode === 'friend') {
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

        // Reset player info
        setPlayerColor('white');
        playerColorRef.current = 'white';
        setWhiteName('White');
        setBlackName('Black');
        setWhiteRating(undefined);
        setBlackRating(undefined);
        setWhiteTime(undefined);
        setBlackTime(undefined);

        // Clean up Lichess connection
        if (lichessCleanupRef.current) {
            lichessCleanupRef.current();
            lichessCleanupRef.current = null;
        }
        lichessGameIdRef.current = null;
        setLichessGameStarted(false);
        setIsWaitingForChallenge(false);

        // Change mode if specified
        if (mode && mode !== gameMode) {
            setGameMode(mode);
        }

        // Don't auto-start Lichess game - wait for Start button
    }

    // Handle resign
    async function handleResign() {
        if (!lichessTokenRef.current || !lichessGameIdRef.current) return;

        const confirmed = window.confirm('Are you sure you want to resign?');
        if (!confirmed) return;

        const success = await resignLichessGame(lichessTokenRef.current, lichessGameIdRef.current);
        if (!success) {
            setError('Failed to resign');
        }
    }

    // Handle offer draw
    async function handleOfferDraw() {
        if (!lichessTokenRef.current || !lichessGameIdRef.current) return;

        const success = await offerLichessDraw(lichessTokenRef.current, lichessGameIdRef.current);
        if (success) {
            setStatus('Draw offer sent');
        } else {
            setError('Failed to offer draw');
        }
    }

    // Check if a piece is draggable (only allow dragging your own pieces)
    function isDraggablePiece({ piece }: { piece: string }): boolean {
        // If no Lichess game is active, allow all pieces to be dragged
        if (!lichessGameStarted) return true;

        // piece format is like 'wP', 'bK' etc - first char is color
        const pieceColor = piece[0] === 'w' ? 'white' : 'black';
        return pieceColor === playerColorRef.current;
    }

    // Set the chessboard options (as per react-chessboard documentation)
    const chessboardOptions = {
        position: chessPosition,
        onPieceDrop,
        boardOrientation: boardOrientation,
        isDraggablePiece,
        id: `play-vs-${gameMode}`
    };

    return (
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0">
                <div className="mb-6 text-center">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                        Play Chess
                    </h1>

                    {/* Incoming Challenge Modal/Banner */}
                    {incomingChallenge && (
                        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg shadow-sm animate-pulse">
                            <h3 className="text-lg font-bold text-blue-800 dark:text-blue-200 mb-2">
                                Incoming Challenge!
                            </h3>
                            <p className="text-blue-700 dark:text-blue-300 mb-4">
                                <span className="font-semibold">{incomingChallenge.challengerName}</span> ({incomingChallenge.challengerRating}) challenges you to a {incomingChallenge.rated ? 'Rated' : 'Casual'} {incomingChallenge.variant} game ({incomingChallenge.timeControl}).
                            </p>
                            <div className="flex justify-center gap-4">
                                <button
                                    onClick={handleAcceptChallenge}
                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                                >
                                    Accept
                                </button>
                                <button
                                    onClick={handleDeclineChallenge}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                                >
                                    Decline
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Mode Selection */}
                    <div className="flex justify-center gap-2 mb-4 flex-wrap">
                        <button
                            onClick={() => startNewGame('lichess')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${gameMode === 'lichess'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                                }`}
                        >
                            Lichess AI
                        </button>
                        <button
                            onClick={() => startNewGame('friend')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${gameMode === 'friend'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                                }`}
                        >
                            Challenge Friend
                        </button>
                    </div>


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

                    {/* Friend Challenge UI */}
                    {gameMode === 'friend' && (
                        <div className="max-w-md mx-auto mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                            {!lichessGameStarted && !isWaitingForChallenge ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Select Opponent
                                        </label>
                                        <select
                                            value={selectedUser}
                                            onChange={(e) => setSelectedUser(e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        >
                                            {availableUsers.length === 0 && <option value="">No other users available</option>}
                                            {availableUsers.map(user => (
                                                <option key={user.id} value={user.id}>
                                                    {user.name || 'Unnamed User'} ({user.lichessId})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Time Control
                                            </label>
                                            <select
                                                value={`${challengeConfig.clock?.limit}|${challengeConfig.clock?.increment}`}
                                                onChange={(e) => {
                                                    const [limit, increment] = e.target.value.split('|').map(Number);
                                                    setChallengeConfig({
                                                        ...challengeConfig,
                                                        clock: { limit, increment }
                                                    });
                                                }}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                            >
                                                <option value="60|0">1 min</option>
                                                <option value="180|0">3 min</option>
                                                <option value="180|2">3+2</option>
                                                <option value="300|0">5 min</option>
                                                <option value="300|3">5+3</option>
                                                <option value="600|0">10 min</option>
                                                <option value="900|10">15+10</option>
                                                <option value="1800|0">30 min</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Color
                                            </label>
                                            <select
                                                value={challengeConfig.color}
                                                onChange={(e) => setChallengeConfig({ ...challengeConfig, color: e.target.value as any })}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                            >
                                                <option value="random">Random</option>
                                                <option value="white">White</option>
                                                <option value="black">Black</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="rated"
                                            checked={challengeConfig.rated}
                                            onChange={(e) => setChallengeConfig({ ...challengeConfig, rated: e.target.checked })}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <label htmlFor="rated" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Rated Game
                                        </label>
                                    </div>

                                    <button
                                        onClick={startUserChallenge}
                                        disabled={availableUsers.length === 0}
                                        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                                    >
                                        Send Challenge
                                    </button>
                                </div>
                            ) : isWaitingForChallenge ? (
                                <div className="text-center py-4">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                                    <p className="text-gray-600 dark:text-gray-400">Waiting for opponent to accept...</p>
                                    <button
                                        onClick={() => setIsWaitingForChallenge(false)}
                                        className="mt-2 text-sm text-red-600 hover:underline"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center py-2 text-green-600 font-medium">
                                    Game in progress
                                </div>
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

                {/* Chessboard with player panels */}
                <div className="flex justify-center">
                    <div className="w-full max-w-[600px]">
                        {/* Opponent Panel (top) - shows opposite of player color */}
                        {lichessGameStarted && (
                            <div className="flex justify-between items-center mb-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <div className={`w-4 h-4 rounded-full ${playerColor === 'white' ? 'bg-gray-900' : 'bg-white border border-gray-300'}`} />
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                        {playerColor === 'white' ? blackName : whiteName}
                                    </span>
                                    {(playerColor === 'white' ? blackRating : whiteRating) && (
                                        <span className="text-sm text-gray-500">
                                            ({playerColor === 'white' ? blackRating : whiteRating})
                                        </span>
                                    )}
                                </div>
                                <div className={`px-3 py-1 rounded font-mono text-lg ${chessGameRef.current.turn() !== (playerColor === 'white' ? 'w' : 'b')
                                    ? 'bg-green-600 text-white'
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                    }`}>
                                    {formatTime(playerColor === 'white' ? blackTime : whiteTime)}
                                </div>
                            </div>
                        )}

                        {/* Chessboard */}
                        <div className="aspect-square">
                            <Chessboard options={chessboardOptions} />
                        </div>

                        {/* Player Panel (bottom) - shows player's color */}
                        {lichessGameStarted && (
                            <div className="flex justify-between items-center mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <div className={`w-4 h-4 rounded-full ${playerColor === 'white' ? 'bg-white border border-gray-300' : 'bg-gray-900'}`} />
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                        {playerColor === 'white' ? whiteName : blackName}
                                    </span>
                                    {(playerColor === 'white' ? whiteRating : blackRating) && (
                                        <span className="text-sm text-gray-500">
                                            ({playerColor === 'white' ? whiteRating : blackRating})
                                        </span>
                                    )}
                                    <span className="text-xs text-blue-500 ml-2">(You)</span>
                                </div>
                                <div className={`px-3 py-1 rounded font-mono text-lg ${chessGameRef.current.turn() === (playerColor === 'white' ? 'w' : 'b')
                                    ? 'bg-green-600 text-white'
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                    }`}>
                                    {formatTime(playerColor === 'white' ? whiteTime : blackTime)}
                                </div>
                            </div>
                        )}

                        {/* Game Actions (Resign/Draw) */}
                        {lichessGameStarted && status !== 'Game finished!' && !status.startsWith('Game finished') && (
                            <div className="flex justify-center gap-4 mt-4">
                                <button
                                    onClick={handleOfferDraw}
                                    className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                                >
                                    ½ Offer Draw
                                </button>
                                <button
                                    onClick={handleResign}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                                >
                                    🏳️ Resign
                                </button>
                            </div>
                        )}
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
                        {gameMode === 'lichess' && `Playing against Lichess AI (Level ${lichessLevel})`}
                        {gameMode === 'friend' && `Playing against Friend`}
                    </p>
                </div>
            </div>
        </main >
    );
}
