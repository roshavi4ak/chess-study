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
import { useLegalMoves } from "@/hooks/useLegalMoves";
import { getLichessAccessToken, getCurrentUserLichessId } from "@/app/actions/lichess";
import { useTranslations } from "next-intl";

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
    const t = useTranslations("Play");
    const commonT = useTranslations("Common");
    // Game state
    const chessGameRef = useRef(new Chess());
    const chessGame = chessGameRef.current;
    const [chessPosition, setChessPosition] = useState(chessGame.fen());

    // Mode and difficulty
    const [gameMode, setGameMode] = useState<GameMode>('lichess');
    const [lichessLevel, setLichessLevel] = useState<LichessLevel>(3);

    // Status and errors
    const [status, setStatus] = useState<string>(t("makeYourMove"));
    const [error, setError] = useState<string>('');

    // Board orientation
    const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');

    // Player color for the current game (persisted throughout the game)
    const playerColorRef = useRef<'white' | 'black'>('white');
    const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white');

    // Player info state
    const [whiteName, setWhiteName] = useState<string>(t("white"));
    const [blackName, setBlackName] = useState<string>(t("black"));
    const [whiteRating, setWhiteRating] = useState<number | undefined>();
    const [blackRating, setBlackRating] = useState<number | undefined>();
    const [whiteTime, setWhiteTime] = useState<number | undefined>();
    const [blackTime, setBlackTime] = useState<number | undefined>();

    // Clock countdown refs - for client-side countdown between Lichess updates
    const lastClockUpdateRef = useRef<number>(Date.now());
    const clockIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const whiteTimeRef = useRef<number | undefined>(undefined);
    const blackTimeRef = useRef<number | undefined>(undefined);

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

    // Clock countdown effect - runs every 100ms to update the active player's clock
    useEffect(() => {
        // Only run countdown if game is started and we have clock times
        if (!lichessGameStarted || (whiteTimeRef.current === undefined && blackTimeRef.current === undefined)) {
            return;
        }

        // Start the countdown interval
        clockIntervalRef.current = setInterval(() => {
            const now = Date.now();
            const elapsed = now - lastClockUpdateRef.current;
            lastClockUpdateRef.current = now;

            // Determine whose turn it is
            const currentTurn = chessGameRef.current.turn(); // 'w' or 'b'

            // Decrement the active player's time
            if (currentTurn === 'w' && whiteTimeRef.current !== undefined) {
                const newTime = Math.max(0, whiteTimeRef.current - elapsed);
                whiteTimeRef.current = newTime;
                setWhiteTime(newTime);
            } else if (currentTurn === 'b' && blackTimeRef.current !== undefined) {
                const newTime = Math.max(0, blackTimeRef.current - elapsed);
                blackTimeRef.current = newTime;
                setBlackTime(newTime);
            }
        }, 100); // Update every 100ms for smooth countdown

        return () => {
            if (clockIntervalRef.current) {
                clearInterval(clockIntervalRef.current);
                clockIntervalRef.current = null;
            }
        };
    }, [lichessGameStarted, chessPosition]); // Re-run when game starts or position changes


    // Connect to an existing Lichess game
    async function connectToLichessGame(gameId: string) {
        if (!lichessTokenRef.current) return;

        setStatus(t("connectingToLichess"));
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

    // Check if a piece is draggable (only allow dragging your own pieces)
    function isDraggablePiece({ piece }: { piece: string }): boolean {
        // If no Lichess game is active, allow all pieces to be dragged
        if (!lichessGameStarted) return true;

        // piece format is like 'wP', 'bK' etc - first char is color
        const pieceColor = piece[0] === 'w' ? 'white' : 'black';
        return pieceColor === playerColorRef.current;
    }

    function handleLichessGameState(gameState: LichessGameState) {
        console.log('Lichess game state update:', gameState);

        if (gameState.playerColor) {
            setBoardOrientation(gameState.playerColor);
            setPlayerColor(gameState.playerColor);
            playerColorRef.current = gameState.playerColor;
        }

        if (gameState.whiteName) setWhiteName(gameState.whiteName);
        if (gameState.blackName) setBlackName(gameState.blackName);
        if (gameState.whiteRating !== undefined) setWhiteRating(gameState.whiteRating);
        if (gameState.blackRating !== undefined) setBlackRating(gameState.blackRating);

        if (gameState.wtime !== undefined) {
            setWhiteTime(gameState.wtime);
            whiteTimeRef.current = gameState.wtime;
            lastClockUpdateRef.current = Date.now();
        }
        if (gameState.btime !== undefined) {
            setBlackTime(gameState.btime);
            blackTimeRef.current = gameState.btime;
            lastClockUpdateRef.current = Date.now();
        }

        if (gameState.moves !== undefined) {
            try {
                const newGame = new Chess();
                const movesArray = gameState.moves.trim().split(' ').filter(m => m);
                for (const uciMove of movesArray) {
                    const move = uciToMove(uciMove);
                    newGame.move(move);
                }
                chessGameRef.current = newGame;
                setChessPosition(newGame.fen());

                if (gameState.status === 'finished') {
                    setStatus(`${t("gameFinished")} ${t("winner")}: ${gameState.winner || t("draw")}`);
                } else {
                    const currentTurn = newGame.turn();
                    const myTurn = playerColorRef.current === 'white' ? 'w' : 'b';
                    if (currentTurn === myTurn) setStatus(t("yourTurn"));
                    else setStatus(t("opponentThinking"));
                }
            } catch (err) {
                console.error('Error applying Lichess moves:', err);
                setError('Failed to sync game state');
            }
        }
    }

    async function startLichessGame() {
        setStatus(t("connectingToLichess"));
        setError('');
        try {
            const token = await getLichessAccessToken();
            if (!token) {
                setError(t("loginLichessToPlay"));
                setStatus('');
                return;
            }
            const gameId = await createLichessAIChallenge(token, lichessLevel);
            if (!gameId) {
                setError(t("failedCreateGame"));
                setStatus('');
                return;
            }
            connectToLichessGame(gameId);
            setStatus(t("connectedGamedStarted"));
        } catch (err) {
            setError(t("errorConnectingLichess"));
            setStatus('');
        }
    }

    async function startUserChallenge() {
        if (!selectedUser) {
            setError(t("selectUserToChallenge"));
            return;
        }
        setStatus(t("sendingChallenge"));
        setError('');
        setIsWaitingForChallenge(true);
        try {
            const token = await getLichessAccessToken();
            if (!token) {
                setError(t("loginToLichess"));
                setIsWaitingForChallenge(false);
                return;
            }
            const targetUser = availableUsers.find(u => u.id === selectedUser);
            if (!targetUser?.lichessId) {
                setError(t("noLichessId"));
                setIsWaitingForChallenge(false);
                return;
            }
            const result = await createLichessUserChallenge(token, targetUser.lichessId, challengeConfig);
            if (result.accepted) setStatus(t("challengeAccepted"));
            else {
                setError(t("challengeFailed", { reason: result.reason || commonT("unknown") }));
                setIsWaitingForChallenge(false);
                setStatus('');
            }
        } catch (err) {
            setError(t("errorConnectingLichess"));
            setIsWaitingForChallenge(false);
        }
    }

    async function handleAcceptChallenge() {
        if (!incomingChallenge || !lichessTokenRef.current) return;
        const success = await acceptLichessChallenge(lichessTokenRef.current, incomingChallenge.id);
        if (success) setIncomingChallenge(null);
        else setError(t("failedAcceptChallenge"));
    }

    async function handleDeclineChallenge() {
        if (!incomingChallenge || !lichessTokenRef.current) return;
        const success = await declineLichessChallenge(lichessTokenRef.current, incomingChallenge.id);
        if (success) setIncomingChallenge(null);
        else setError(t("failedDeclineChallenge"));
    }

    async function sendLichessMove(from: string, to: string, promotion?: string) {
        if (!lichessTokenRef.current || !lichessGameIdRef.current) return false;
        const move = from + to + (promotion || '');
        const success = await makeLichessMove(lichessTokenRef.current, lichessGameIdRef.current, move);
        if (!success) setError(t("failedSendMove"));
        return success;
    }

    function getGameOverMessage(): string {
        if (chessGame.isCheckmate()) {
            return chessGame.turn() === 'w' ? t("checkmateBlackWins") : t("checkmateWhiteWins");
        } else if (chessGame.isDraw()) {
            return t("draw");
        } else if (chessGame.isStalemate()) {
            return t("stalemate");
        } else if (chessGame.isThreefoldRepetition()) {
            return t("threefoldRepetition");
        } else if (chessGame.isInsufficientMaterial()) {
            return t("insufficientMaterial");
        }
        return t("gameOver");
    }

    const handleMove = (move: { from: string; to: string; promotion?: string }) => {
        const { from, to, promotion = 'q' } = move;
        setOptionSquares({});
        if (!to) return false;
        if (from === to) return false;

        if (lichessGameStarted && (gameMode === 'lichess' || gameMode === 'friend')) {
            const currentTurn = chessGame.turn();
            const myTurn = playerColorRef.current === 'white' ? 'w' : 'b';
            if (currentTurn !== myTurn) {
                setError(t("notYourTurn"));
                return false;
            }
        }
        try {
            chessGame.move({ from, to, promotion });
            setChessPosition(chessGame.fen());
            setError('');
            if (gameMode === 'lichess' || gameMode === 'friend') sendLichessMove(from, to, promotion);
            if (chessGame.isGameOver()) {
                setStatus(getGameOverMessage());
                return true;
            }
            if (gameMode === 'lichess' || gameMode === 'friend') setStatus(t("waitingForOpponent"));
            return true;
        } catch { return false; }
    };

    const { onSquareClick, onPieceClick, optionSquares, setOptionSquares, onPieceDrop } = useLegalMoves({
        game: chessGameRef.current,
        onMove: handleMove
    });

    const handlePieceDrop = ({ sourceSquare, targetSquare }: PieceDropHandlerArgs) => {
        return onPieceDrop({ sourceSquare, targetSquare });
    };

    function startNewGame(mode?: GameMode) {
        chessGameRef.current = new Chess();
        setChessPosition(chessGameRef.current.fen());
        setError('');
        setStatus(t("makeYourMove"));
        setBoardOrientation('white');
        setPlayerColor('white');
        playerColorRef.current = 'white';
        setWhiteName(t("white"));
        setBlackName(t("black"));
        setWhiteRating(undefined);
        setBlackRating(undefined);
        setWhiteTime(undefined);
        setBlackTime(undefined);
        whiteTimeRef.current = undefined;
        blackTimeRef.current = undefined;
        lastClockUpdateRef.current = Date.now();
        if (clockIntervalRef.current) { clearInterval(clockIntervalRef.current); clockIntervalRef.current = null; }
        if (lichessCleanupRef.current) { lichessCleanupRef.current(); lichessCleanupRef.current = null; }
        lichessGameIdRef.current = null;
        setLichessGameStarted(false);
        setIsWaitingForChallenge(false);
        if (mode && mode !== gameMode) setGameMode(mode);
    }

    async function handleResign() {
        if (!lichessTokenRef.current || !lichessGameIdRef.current) return;
        const confirmed = window.confirm(t("confirmResign"));
        if (!confirmed) return;
        const success = await resignLichessGame(lichessTokenRef.current, lichessGameIdRef.current);
        if (!success) setError(t("failedResign"));
    }

    async function handleOfferDraw() {
        if (!lichessTokenRef.current || !lichessGameIdRef.current) return;
        const success = await offerLichessDraw(lichessTokenRef.current, lichessGameIdRef.current);
        if (success) setStatus(t("drawOfferSent"));
        else setError(t("failedOfferDraw"));
    }

    const chessboardOptions = {
        position: chessPosition,
        onPieceDrop: handlePieceDrop as any,
        boardOrientation: boardOrientation,
        isDraggablePiece,
        id: `play-vs-${gameMode}`,
        onSquareClick,
        onPieceClick,
        squareStyles: optionSquares
    };

    return (
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0">
                <div className="mb-6 text-center">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                        {t("title")}
                    </h1>

                    {incomingChallenge && (
                        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg shadow-sm animate-pulse">
                            <h3 className="text-lg font-bold text-blue-800 dark:text-blue-200 mb-2">
                                {t("incomingChallenge")}
                            </h3>
                            <p className="text-blue-700 dark:text-blue-300 mb-4">
                                {t("challengeDetails", {
                                    name: incomingChallenge.challengerName,
                                    rating: incomingChallenge.challengerRating?.toString() || commonT("unknown"),
                                    rated: incomingChallenge.rated ? t("rated") : t("casual"),
                                    variant: incomingChallenge.variant,
                                    timeControl: incomingChallenge.timeControl
                                })}
                            </p>
                            <div className="flex justify-center gap-4">
                                <button
                                    onClick={handleAcceptChallenge}
                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                                >
                                    {t("accept")}
                                </button>
                                <button
                                    onClick={handleDeclineChallenge}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                                >
                                    {t("decline")}
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-center gap-2 mb-4 flex-wrap">
                        <button
                            onClick={() => startNewGame('lichess')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${gameMode === 'lichess'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                                }`}
                        >
                            {t("lichessAI")}
                        </button>
                        <button
                            onClick={() => startNewGame('friend')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${gameMode === 'friend'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                                }`}
                        >
                            {t("challengeFriend")}
                        </button>
                    </div>

                    {gameMode === 'lichess' && (
                        <div className="flex justify-center items-center gap-2 mb-4">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {t("level")}:
                            </label>
                            <select
                                value={lichessLevel}
                                onChange={(e) => setLichessLevel(parseInt(e.target.value) as LichessLevel)}
                                disabled={lichessGameStarted}
                                className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-50"
                            >
                                <option value="1">{t("level")} 1</option>
                                <option value="2">{t("level")} 2</option>
                                <option value="3">{t("level")} 3</option>
                                <option value="4">{t("level")} 4</option>
                                <option value="5">{t("level")} 5</option>
                                <option value="6">{t("level")} 6</option>
                                <option value="7">{t("level")} 7</option>
                                <option value="8">{t("level")} 8</option>
                            </select>
                            {!lichessGameStarted && (
                                <button
                                    onClick={startLichessGame}
                                    className="px-4 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                                >
                                    {t("start")}
                                </button>
                            )}
                        </div>
                    )}

                    {gameMode === 'friend' && (
                        <div className="max-w-md mx-auto mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                            {!lichessGameStarted && !isWaitingForChallenge ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            {t("selectOpponent")}
                                        </label>
                                        <select
                                            value={selectedUser}
                                            onChange={(e) => setSelectedUser(e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        >
                                            {availableUsers.length === 0 && <option value="">{t("noOtherUsers")}</option>}
                                            {availableUsers.map(user => (
                                                <option key={user.id} value={user.id}>
                                                    {user.name || t("unnamedUser")} ({user.lichessId})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                {t("timeControl")}
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
                                                {t("color")}
                                            </label>
                                            <select
                                                value={challengeConfig.color}
                                                onChange={(e) => setChallengeConfig({ ...challengeConfig, color: e.target.value as any })}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                            >
                                                <option value="random">{t("random")}</option>
                                                <option value="white">{t("white")}</option>
                                                <option value="black">{t("black")}</option>
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
                                            {t("ratedGame")}
                                        </label>
                                    </div>

                                    <button
                                        onClick={startUserChallenge}
                                        disabled={availableUsers.length === 0}
                                        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                                    >
                                        {t("sendChallenge")}
                                    </button>
                                </div>
                            ) : isWaitingForChallenge ? (
                                <div className="text-center py-4">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                                    <p className="text-gray-600 dark:text-gray-400">{t("waitingForOpponentAccept")}</p>
                                    <button
                                        onClick={() => setIsWaitingForChallenge(false)}
                                        className="mt-2 text-sm text-red-600 hover:underline"
                                    >
                                        {commonT("cancel")}
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center py-2 text-green-600 font-medium">
                                    {t("gameInProgress")}
                                </div>
                            )}
                        </div>
                    )}

                    {status && (
                        <div className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">
                            {status}
                        </div>
                    )}

                    {error && (
                        <div className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">
                            {error}
                        </div>
                    )}
                </div>

                <div className="flex justify-center">
                    <div className="w-full max-w-[600px]">
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

                        <div className="aspect-square">
                            <Chessboard options={chessboardOptions} />
                        </div>

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
                                    <span className="text-xs text-blue-500 ml-2">({t("you")})</span>
                                </div>
                                <div className={`px-3 py-1 rounded font-mono text-lg ${chessGameRef.current.turn() === (playerColor === 'white' ? 'w' : 'b')
                                    ? 'bg-green-600 text-white'
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                    }`}>
                                    {formatTime(playerColor === 'white' ? whiteTime : blackTime)}
                                </div>
                            </div>
                        )}

                        {lichessGameStarted && !status.startsWith(t("gameFinished")) && (
                            <div className="flex justify-center gap-4 mt-4">
                                <button
                                    onClick={handleOfferDraw}
                                    className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                                >
                                    ½ {t("offerDraw")}
                                </button>
                                <button
                                    onClick={handleResign}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                                >
                                    🏳️ {t("resign")}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-8 text-center">
                    <button
                        onClick={() => startNewGame()}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                    >
                        {t("newGame")}
                    </button>
                </div>

                <div className="mt-4 text-center text-sm text-gray-500">
                    <p>
                        {gameMode === 'lichess' && t("playingAgainstAI", { level: lichessLevel })}
                        {gameMode === 'friend' && t("playingAgainstFriend")}
                    </p>
                </div>
            </div>
        </main >
    );
}
