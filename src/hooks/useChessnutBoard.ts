"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useChessnutTransport } from "@/components/ChessnutSession";
import { differentSquares, liftedSquare, physicalMove, placement, type BoardMove, type PhysicalCandidate } from "@/lib/chessnut";

type PositionStatus = "setup" | "ready" | "hint" | "opponent" | "adjusting" | "restore" | "replace" | "paused" | "complete";
type LightKind = "steady" | "hint" | "wrong" | "complete" | "test";
interface Options {
    fen: string;
    reply?: { fen: string; move: string };
    epoch: number;
    canMove: boolean;
    expectedMoves: string[];
    hintMove?: string;
    completion?: number | string;
    synchronize?: boolean;
    syncMove?: string;
    active?: boolean;
    candidates?: PhysicalCandidate[];
    guideSquares?: string[];
    onLift?(square: string): boolean;
    onMove(move: BoardMove): boolean | Promise<boolean>;
    onReply(): void;
}

export function useChessnutBoard(options: Options) {
    const transport = useChessnutTransport();
    const { available, enabled, status, position, revision, name, error, connection } = transport;
    const [positionStatus, setPositionStatus] = useState<PositionStatus>("setup");
    const [confirmed, setConfirmed] = useState<{ fen: string; revision: number } | null>(null);
    const aligned = useRef(false);
    const restoring = useRef(false);
    const epoch = useRef(-1);
    const lightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lights = useRef<string[]>([]);
    const lastCompletion = useRef<number | string | undefined>(undefined);
    const patternKind = useRef<LightKind | null>(null);
    const lastHint = useRef("");
    const wrongSequence = useRef(0);
    const wrongSignalled = useRef(false);
    const target = useRef("");
    const identifying = useRef(false);
    const processing = useRef(false);
    const moveSerial = useRef(0);

    const releaseBoard = useEffectEvent(() => {
        moveSerial.current++;
        void connection.current?.setLights([]).catch(() => {});
    });
    useEffect(() => {
        return () => {
            if (lightTimer.current) clearTimeout(lightTimer.current);
            releaseBoard();
        };
    }, [connection]);

    function showLights(squares: string[], kind: LightKind = "steady") {
        if (patternKind.current && patternKind.current !== kind) stopLightPattern();
        lights.current = squares;
        const client = connection.current;
        if (!client || lightTimer.current) return;
        void client.setLights(squares).catch(error => client.reportError(error));
    }

    function stopLightPattern() {
        if (lightTimer.current) clearTimeout(lightTimer.current);
        lightTimer.current = null;
        patternKind.current = null;
    }

    function flashLights(squares: string[], flashes: number, stayLit: boolean, kind: LightKind) {
        const client = connection.current;
        if (!client) return;
        stopLightPattern();
        patternKind.current = kind;
        lights.current = stayLit ? squares : [];
        let phase = 0;
        const step = () => {
            if (connection.current !== client) return;
            void client.setLights(phase % 2 === 0 ? squares : []).catch(error => client.reportError(error));
            phase++;
            if (phase < flashes * 2) lightTimer.current = setTimeout(step, 220);
            else lightTimer.current = setTimeout(() => {
                lightTimer.current = null;
                patternKind.current = null;
                if (connection.current === client) void client.setLights(lights.current).catch(error => client.reportError(error));
            }, 220);
        };
        step();
    }

    function showWrongMove(squares: string[]) {
        showLights(squares, "wrong");
        if (!wrongSignalled.current) {
            wrongSignalled.current = true;
            flashLights(squares, 3, true, "wrong");
        }
    }

    const reconcile = useEffectEvent(() => {
        if (epoch.current !== options.epoch) {
            stopLightPattern();
            epoch.current = options.epoch;
            aligned.current = false;
            restoring.current = false;
            wrongSignalled.current = false;
            identifying.current = false;
            moveSerial.current++;
            processing.current = false;
        }
        if (!enabled || status !== "connected" || !position) {
            stopLightPattern();
            aligned.current = false;
            return;
        }
        if (options.active === false) {
            setPositionStatus("paused"); showLights([]); return;
        }
        if (!options.completion) lastCompletion.current = undefined;
        if (options.synchronize && target.current !== options.fen) {
            target.current = options.fen;
            aligned.current = false; restoring.current = false; identifying.current = false; wrongSignalled.current = false;
        }
        const same = placement(options.fen) === position;
        if (!aligned.current || restoring.current || identifying.current) {
            if (!same) {
                setPositionStatus(identifying.current ? "replace" : restoring.current ? "restore" : options.syncMove ? "opponent" : "setup");
                const squares = differentSquares(options.fen, position);
                if (restoring.current) showWrongMove(squares);
                else showLights(squares);
                return;
            }
            aligned.current = true;
            restoring.current = false;
            wrongSignalled.current = false;
            identifying.current = false;
        }
        if (same) setConfirmed(previous => previous?.fen === options.fen && previous.revision === revision ? previous : { fen: options.fen, revision });
        if (options.reply) {
            if (placement(options.reply.fen) === position) {
                showLights([]);
                options.onReply();
            } else {
                setPositionStatus("opponent");
                showLights(differentSquares(options.reply.fen, position));
            }
            return;
        }
        if (processing.current) return;
        if (!options.canMove) {
            const lifted = options.onLift ? liftedSquare(options.fen, position) : null;
            if (lifted) {
                identifying.current = true;
                const correct = options.onLift!(lifted);
                setPositionStatus(correct ? "replace" : "restore");
                if (correct) showLights([lifted]);
                else { identifying.current = false; restoring.current = true; showWrongMove([lifted]); }
                return;
            }
            if (!same) {
                restoring.current = true;
                setPositionStatus("restore");
                showWrongMove(differentSquares(options.fen, position));
                return;
            }
            setPositionStatus(options.completion ? "complete" : "paused");
            showLights(options.guideSquares ?? [], options.completion ? "complete" : "steady");
            if (options.completion && same && lastCompletion.current !== options.completion) {
                lastCompletion.current = options.completion;
                flashLights(["d4", "e4", "d5", "e5"], 10, false, "complete");
            }
            return;
        }
        const observation = physicalMove(options.fen, position, options.expectedMoves, options.candidates);
        if (observation.kind === "move") {
            const client = connection.current, serial = ++moveSerial.current, inputFen = options.fen;
            const finish = (accepted: boolean) => {
                if (serial !== moveSerial.current || connection.current !== client) return;
                processing.current = false;
                if (options.synchronize && target.current !== inputFen) return;
                if (!accepted) {
                    restoring.current = true; wrongSequence.current++;
                    setPositionStatus("restore"); showWrongMove(differentSquares(inputFen, position));
                } else { wrongSignalled.current = false; showLights([]); }
            };
            try {
                const result = options.onMove(observation.move);
                if (typeof result === "boolean") finish(result);
                else { processing.current = true; void result.then(finish, () => finish(false)); }
            } catch { finish(false); }
        } else {
            const hint = observation.kind === "same" ? options.hintMove : undefined;
            setPositionStatus(observation.kind === "same" ? hint ? "hint" : "ready" : observation.kind === "adjusting" ? "adjusting" : "restore");
            // An illegal arrangement needs correcting, but sensor transients never count as mistakes.
            if (observation.kind === "mismatch") showWrongMove(differentSquares(options.fen, position));
            else if (hint) {
                wrongSignalled.current = false;
                const squares = [hint.slice(0, 2), hint.slice(2, 4)];
                showLights(squares, "hint");
                const key = `${options.epoch}:${options.fen}:${hint}:${wrongSequence.current}`;
                if (lastHint.current !== key) {
                    lastHint.current = key;
                    flashLights(squares, 5, true, "hint");
                }
            } else {
                if (observation.kind === "same") wrongSignalled.current = false;
                showLights(observation.kind === "same" ? options.guideSquares ?? [] : []);
            }
        }
    });

    const expectedKey = options.expectedMoves.join(",");
    const candidatesKey = JSON.stringify(options.candidates);
    const guideKey = options.guideSquares?.join(",");
    useEffect(() => {
        // Wait for a settled position; duplicate reports do not restart this timer.
        const timer = setTimeout(() => reconcile(), 300);
        return () => clearTimeout(timer);
    }, [position, revision, status, enabled, options.fen, options.reply?.fen, options.epoch, options.canMove, options.hintMove, options.completion, options.synchronize, options.syncMove, options.active, expectedKey, candidatesKey, guideKey]);

    async function connect() {
        stopLightPattern();
        aligned.current = false;
        restoring.current = false;
        wrongSignalled.current = false;
        setPositionStatus("setup");
        await transport.connect();
    }

    function disconnect(screen = false) {
        stopLightPattern();
        transport.disconnect(screen);
    }

    function testLights() {
        const client = connection.current;
        if (!client || lightTimer.current) return;
        patternKind.current = "test";
        void client.setLights(["a1", "h8"]).catch(error => client.reportError(error));
        lightTimer.current = setTimeout(() => {
            lightTimer.current = null;
            patternKind.current = null;
            if (connection.current === client) void client.setLights(lights.current).catch(error => client.reportError(error));
        }, 1500);
    }

    function refresh() {
        const client = connection.current;
        if (client) void client.refresh().catch(error => client.reportError(error));
    }

    const synchronized = status === "connected" && confirmed?.fen === options.fen && confirmed.revision === revision && position === placement(options.fen);
    return { available, enabled, status, positionStatus, position, name, error, synchronized, hintMove: options.hintMove, connect, disconnect, testLights, refresh };
}
