"use client";

import { useState, useEffect } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import type { Square } from "chess.js";
import { useRouter } from "next/navigation";

// Tree node structure
interface PracticeNode {
    id: string;
    fen: string;
    move: string | null;
    san: string | null;
    notes: string;
    children: PracticeNode[];
}

// Generate unique IDs for nodes
let nodeIdCounter = 0;
function generateNodeId(): string {
    return `node_${Date.now()}_${nodeIdCounter++}`;
}

// Recursive tree visualization component (same as PracticeBuilder)
function TreeView({
    node,
    currentNodeId,
    onNodeClick,
    depth = 0,
    playerColor,
    isRoot = false
}: {
    node: PracticeNode;
    currentNodeId: string;
    onNodeClick: (node: PracticeNode) => void;
    depth?: number;
    playerColor: "WHITE" | "BLACK";
    isRoot?: boolean;
}) {
    const isWhiteTurn = node.fen.includes(" w ");
    const isStudentMove = (isWhiteTurn && playerColor === "WHITE") || (!isWhiteTurn && playerColor === "BLACK");
    const isCurrent = node.id === currentNodeId;
    const hasVariations = node.children.length > 1;
    const isEndOfLine = node.children.length === 0;

    return (
        <div className="flex flex-col">
            <button
                onClick={() => onNodeClick(node)}
                className={`
                    px-2 py-1 rounded text-sm font-mono whitespace-nowrap transition-all
                    ${isCurrent
                        ? "ring-2 ring-yellow-400 bg-yellow-100 dark:bg-yellow-900 text-yellow-900 dark:text-yellow-100 font-bold"
                        : isStudentMove
                            ? "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800"
                            : "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800"
                    }
                    ${isEndOfLine ? "border-2 border-dashed border-gray-400" : ""}
                `}
                title={isEndOfLine ? "End of line" : isStudentMove ? "Student move" : "Opponent move"}
            >
                {isRoot ? "Start" : node.san || "?"}
                {hasVariations && !isRoot && <span className="ml-1 text-orange-500">⚡</span>}
                {isEndOfLine && <span className="ml-1 text-gray-500">🏁</span>}
            </button>

            {node.children.length > 0 && (
                <div className={`ml-2 mt-1 ${node.children.length > 1 ? "border-l-2 border-orange-400 pl-2" : "pl-2"}`}>
                    {node.children.map((child, index) => (
                        <div key={child.id} className={`${index > 0 ? "mt-2 pt-2 border-t border-dashed border-gray-300 dark:border-gray-600" : ""}`}>
                            {node.children.length > 1 && (
                                <span className="text-xs text-orange-500 font-medium">
                                    Variation {index + 1}:
                                </span>
                            )}
                            <TreeView
                                node={child}
                                currentNodeId={currentNodeId}
                                onNodeClick={onNodeClick}
                                depth={depth + 1}
                                playerColor={playerColor}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// Convert DB tree to client tree (add san property)
function convertToClientTree(dbNode: any, game: Chess): PracticeNode {
    const node: PracticeNode = {
        id: dbNode.id || generateNodeId(),
        fen: dbNode.fen,
        move: dbNode.move,
        san: null,
        notes: dbNode.notes || "",
        children: [],
    };

    // Calculate SAN from move
    if (dbNode.move && dbNode.move.length >= 4) {
        try {
            const tempGame = new Chess(game.fen());
            const from = dbNode.move.slice(0, 2) as Square;
            const to = dbNode.move.slice(2, 4) as Square;
            const promotion = dbNode.move[4] as "q" | "r" | "b" | "n" | undefined;
            const moveResult = tempGame.move({ from, to, promotion });
            if (moveResult) {
                node.san = moveResult.san;
            }
        } catch (e) {
            console.error("Error calculating SAN:", e);
        }
    }

    // Process children
    const childGame = new Chess(dbNode.fen);
    node.children = (dbNode.children || []).map((child: any) => convertToClientTree(child, childGame));

    return node;
}

interface PracticeEditorProps {
    practiceId: string;
    initialData: {
        name: string;
        description: string | null;
        playerColor: "WHITE" | "BLACK";
        tree: any;
    };
}

export default function PracticeEditor({ practiceId, initialData }: PracticeEditorProps) {
    const router = useRouter();
    const [tree, setTree] = useState<PracticeNode>(() => {
        const startGame = new Chess();
        return convertToClientTree(initialData.tree, startGame);
    });
    const [currentNode, setCurrentNode] = useState<PracticeNode>(tree);
    const [path, setPath] = useState<PracticeNode[]>([tree]);
    const [game, setGame] = useState(new Chess());

    const [name, setName] = useState(initialData.name);
    const [description, setDescription] = useState(initialData.description || "");
    const [playerColor, setPlayerColor] = useState<"WHITE" | "BLACK">(initialData.playerColor);
    const [currentNotes, setCurrentNotes] = useState("");

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Track changes
    useEffect(() => {
        setHasUnsavedChanges(true);
    }, [tree, name, description, playerColor]);

    // Warn before leaving
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);

    // Sync game position with current node
    useEffect(() => {
        const newGame = new Chess(currentNode.fen);
        setGame(newGame);
        setCurrentNotes(currentNode.notes);
    }, [currentNode]);

    // All the same functions from PracticeBuilder
    function onPieceDrop({ sourceSquare, targetSquare }: { sourceSquare: Square, targetSquare: Square }) {
        const gameCopy = new Chess(game.fen());

        try {
            const move = gameCopy.move({
                from: sourceSquare,
                to: targetSquare,
                promotion: "q",
            });

            if (move === null) return false;

            const uciMove = `${sourceSquare}${targetSquare}${move.promotion || ""}`;

            const existingChild = currentNode.children.find(
                child => child.move === uciMove
            );

            if (existingChild) {
                navigateToNode(existingChild);
                return true;
            }

            const newNode: PracticeNode = {
                id: generateNodeId(),
                fen: gameCopy.fen(),
                move: uciMove,
                san: move.san,
                notes: "",
                children: [],
            };

            const updatedNode = {
                ...currentNode,
                children: [...currentNode.children, newNode],
            };

            updateNodeInTree(currentNode.id, updatedNode);
            setCurrentNode(newNode);
            setPath([...path, newNode]);
            setGame(gameCopy);

            return true;
        } catch (e) {
            return false;
        }
    }

    function updateNodeInTree(nodeId: string, updatedNode: PracticeNode) {
        function updateRecursive(node: PracticeNode): PracticeNode {
            if (node.id === nodeId) {
                return updatedNode;
            }
            return {
                ...node,
                children: node.children.map(child => updateRecursive(child)),
            };
        }

        const newTree = updateRecursive(tree);
        setTree(newTree);

        if (currentNode.id === nodeId) {
            setCurrentNode(updatedNode);
        }
    }

    function navigateToNode(targetNode: PracticeNode) {
        function findPath(node: PracticeNode, target: string, currentPath: PracticeNode[]): PracticeNode[] | null {
            if (node.id === target) {
                return [...currentPath, node];
            }
            for (const child of node.children) {
                const result = findPath(child, target, [...currentPath, node]);
                if (result) return result;
            }
            return null;
        }

        const newPath = findPath(tree, targetNode.id, []);
        if (newPath) {
            setPath(newPath);
            setCurrentNode(targetNode);
        }
    }

    function goBack() {
        if (path.length > 1) {
            const newPath = path.slice(0, -1);
            setPath(newPath);
            setCurrentNode(newPath[newPath.length - 1]);
        }
    }

    function deleteCurrentNode() {
        if (path.length <= 1) return;

        const parentNode = path[path.length - 2];
        const updatedParent = {
            ...parentNode,
            children: parentNode.children.filter(c => c.id !== currentNode.id),
        };

        updateNodeInTree(parentNode.id, updatedParent);

        const newPath = path.slice(0, -1);
        setPath(newPath);
        setCurrentNode(updatedParent);
    }

    function saveNotes() {
        const updatedNode = {
            ...currentNode,
            notes: currentNotes,
        };
        updateNodeInTree(currentNode.id, updatedNode);
    }

    function countNodes(node: PracticeNode): number {
        return 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);
    }

    function countLines(node: PracticeNode): number {
        if (node.children.length === 0) return 1;
        return node.children.reduce((sum, child) => sum + countLines(child), 0);
    }

    function getCurrentTurn(): "WHITE" | "BLACK" {
        return game.turn() === "w" ? "WHITE" : "BLACK";
    }

    function isStudentTurn(): boolean {
        return getCurrentTurn() === playerColor;
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setIsSubmitting(true);

        function stripSan(node: PracticeNode): any {
            const { san, ...rest } = node;
            return {
                ...rest,
                children: node.children.map(stripSan),
            };
        }

        const formData = new FormData();
        formData.append("name", name);
        formData.append("description", description);
        formData.append("playerColor", playerColor);
        formData.append("tree", JSON.stringify(stripSan(tree)));

        try {
            const { updatePractice } = await import("@/app/actions/practice");
            setHasUnsavedChanges(false);
            await updatePractice(practiceId, formData);
        } catch (error: any) {
            if (error?.digest?.startsWith('NEXT_REDIRECT')) {
                return;
            }
            console.error(error);
            alert("Failed to update practice");
            setIsSubmitting(false);
        }
    }

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Left Column: Board */}
                <div className="space-y-4">
                    <div className="aspect-square w-full max-w-[500px] mx-auto border-4 border-gray-800 rounded-lg overflow-hidden shadow-xl">
                        <Chessboard
                            key={`practice-${game.fen()}`}
                            options={{
                                id: "practice-board",
                                position: game.fen(),
                                onPieceDrop: onPieceDrop,
                                boardOrientation: playerColor.toLowerCase() as "white" | "black",
                            } as any}
                        />
                    </div>

                    <div className={`p-4 rounded-lg ${isStudentTurn()
                            ? "bg-green-100 dark:bg-green-900/50 border-2 border-green-500"
                            : "bg-blue-100 dark:bg-blue-900/50 border-2 border-blue-500"
                        }`}>
                        <div className="font-bold text-lg mb-1">
                            {isStudentTurn() ? "👨‍🎓 Student's Turn" : "🤖 Opponent's Turn"}
                        </div>
                        <div className="text-sm opacity-75">
                            {isStudentTurn()
                                ? "Add the correct move"
                                : "Add variations here"
                            }
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                        <div className="flex items-center justify-between mb-3">
                            <span className="font-medium">Current Path:</span>
                            <div className="flex gap-2">
                                <button
                                    onClick={goBack}
                                    disabled={path.length <= 1}
                                    className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 text-sm"
                                >
                                    ← Back
                                </button>
                                <button
                                    onClick={deleteCurrentNode}
                                    disabled={path.length <= 1}
                                    className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 text-sm"
                                >
                                    🗑️ Delete
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1 text-sm bg-gray-50 dark:bg-gray-900 p-2 rounded">
                            {path.map((node, index) => (
                                <span key={node.id} className="flex items-center">
                                    {index > 0 && <span className="mx-1 text-gray-400">→</span>}
                                    <button
                                        onClick={() => navigateToNode(node)}
                                        className={`px-2 py-1 rounded ${node.id === currentNode.id
                                                ? "bg-yellow-400 text-yellow-900 font-bold"
                                                : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
                                            }`}
                                    >
                                        {node.san || "Start"}
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                        <label className="block text-sm font-medium mb-2">
                            📝 Coach Notes
                        </label>
                        <textarea
                            value={currentNotes}
                            onChange={(e) => setCurrentNotes(e.target.value)}
                            onBlur={saveNotes}
                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                            rows={2}
                            placeholder="Notes for this position..."
                        />
                    </div>
                </div>

                {/* Middle Column: Tree */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                    <h2 className="text-xl font-bold mb-4">🌳 Move Tree</h2>
                    <div className="overflow-auto max-h-[500px] p-2 bg-gray-50 dark:bg-gray-900 rounded">
                        <TreeView
                            node={tree}
                            currentNodeId={currentNode.id}
                            onNodeClick={navigateToNode}
                            playerColor={playerColor}
                            isRoot={true}
                        />
                    </div>
                </div>

                {/* Right Column: Settings */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                        <h2 className="text-xl font-bold mb-4">Practice Details</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Description</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                    rows={2}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Student Plays As</label>
                                <select
                                    value={playerColor}
                                    onChange={(e) => setPlayerColor(e.target.value as "WHITE" | "BLACK")}
                                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                >
                                    <option value="WHITE">♔ White</option>
                                    <option value="BLACK">♚ Black</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                        <h2 className="text-xl font-bold mb-4">📊 Statistics</h2>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-900 rounded">
                                <span>Total positions:</span>
                                <span className="font-bold">{countNodes(tree)}</span>
                            </div>
                            <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-900 rounded">
                                <span>Complete lines:</span>
                                <span className="font-bold">{countLines(tree)}</span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || tree.children.length === 0 || !name}
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-lg font-bold text-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    >
                        {isSubmitting ? "Saving..." : "💾 Update Practice"}
                    </button>
                </div>
            </div>
        </div>
    );
}
