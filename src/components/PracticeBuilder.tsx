"use client";

import { useState, useEffect, useCallback } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import type { Square } from "chess.js";
import { useRouter } from "next/navigation";

// Tree node structure
interface PracticeNode {
    id: string;
    fen: string;
    move: string | null; // UCI format e.g. "e2e4"
    san: string | null;  // SAN format for display e.g. "e4"
    notes: string;
    lineNumber: number | null;
    children: PracticeNode[];
}

// Generate unique IDs for nodes
let nodeIdCounter = 0;
function generateNodeId(): string {
    return `node_${Date.now()}_${nodeIdCounter++}`;
}

// Create starting position as root
function createRootNode(): PracticeNode {
    return {
        id: generateNodeId(),
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        move: null,
        san: null,
        notes: "",
        lineNumber: null,
        children: [],
    };
}

// Recursive tree visualization component
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
                title={isEndOfLine ? "End of line - add more moves or variations" : isStudentMove ? "Student move" : "Opponent move (can have variations)"}
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

export default function PracticeBuilder() {
    const router = useRouter();
    const [tree, setTree] = useState<PracticeNode>(createRootNode);
    const [currentNode, setCurrentNode] = useState<PracticeNode>(tree);
    const [path, setPath] = useState<PracticeNode[]>([tree]); // Breadcrumb path from root
    const [game, setGame] = useState(new Chess());

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [playerColor, setPlayerColor] = useState<"WHITE" | "BLACK">("WHITE");
    const [currentNotes, setCurrentNotes] = useState("");
    const [currentLineNumber, setCurrentLineNumber] = useState<string>("");

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Track changes
    useEffect(() => {
        const hasChanges = tree.children.length > 0 || name.trim() !== "" || description.trim() !== "";
        setHasUnsavedChanges(hasChanges);
    }, [tree, name, description]);

    // Warn before leaving with unsaved changes
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
        setCurrentLineNumber(currentNode.lineNumber?.toString() || "");
    }, [currentNode]);

    // Handle piece drop - create new node
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

            // Check if this move already exists as a child
            const existingChild = currentNode.children.find(
                child => child.move === uciMove
            );

            if (existingChild) {
                // Navigate to existing child
                navigateToNode(existingChild);
                return true;
            }

            // Create new node
            const newNode: PracticeNode = {
                id: generateNodeId(),
                fen: gameCopy.fen(),
                move: uciMove,
                san: move.san,
                notes: "",
                lineNumber: null,
                children: [],
            };

            // Add to current node's children
            const updatedNode = {
                ...currentNode,
                children: [...currentNode.children, newNode],
            };

            // Update tree
            updateNodeInTree(currentNode.id, updatedNode);

            // Navigate to new node
            setCurrentNode(newNode);
            setPath([...path, newNode]);
            setGame(gameCopy);

            return true;
        } catch (e) {
            return false;
        }
    }

    // Update a node in the tree by ID
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

        // Update currentNode reference if it was the updated node
        if (currentNode.id === nodeId) {
            setCurrentNode(updatedNode);
        }
    }

    // Navigate to a specific node
    function navigateToNode(targetNode: PracticeNode) {
        // Find path from root to target
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

    // Go back one step
    function goBack() {
        if (path.length > 1) {
            const newPath = path.slice(0, -1);
            setPath(newPath);
            setCurrentNode(newPath[newPath.length - 1]);
        }
    }

    // Delete current node and its subtree
    function deleteCurrentNode() {
        if (path.length <= 1) return; // Can't delete root

        const parentNode = path[path.length - 2];
        const updatedParent = {
            ...parentNode,
            children: parentNode.children.filter(c => c.id !== currentNode.id),
        };

        updateNodeInTree(parentNode.id, updatedParent);

        // Navigate back to parent
        const newPath = path.slice(0, -1);
        setPath(newPath);
        setCurrentNode(updatedParent);
    }

    // Save notes for current node
    function saveNotes() {
        const updatedNode = {
            ...currentNode,
            notes: currentNotes,
        };
        updateNodeInTree(currentNode.id, updatedNode);
    }

    // Save line number for current node
    function saveLineNumber() {
        const lineNum = currentLineNumber.trim() === "" ? null : parseInt(currentLineNumber, 10);
        const updatedNode = {
            ...currentNode,
            lineNumber: isNaN(lineNum as number) ? null : lineNum,
        };
        updateNodeInTree(currentNode.id, updatedNode);
    }

    // Check if node is a leaf (end of line)
    function isLeafNode(node: PracticeNode): boolean {
        return node.children.length === 0;
    }

    // Count total nodes in tree
    function countNodes(node: PracticeNode): number {
        return 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);
    }

    // Count lines (leaf nodes)
    function countLines(node: PracticeNode): number {
        if (node.children.length === 0) return 1;
        return node.children.reduce((sum, child) => sum + countLines(child), 0);
    }

    // Determine whose turn it is
    function getCurrentTurn(): "WHITE" | "BLACK" {
        return game.turn() === "w" ? "WHITE" : "BLACK";
    }

    function isStudentTurn(): boolean {
        return getCurrentTurn() === playerColor;
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setIsSubmitting(true);

        // Strip out the 'san' property before sending (not in DB schema)
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
            const { createPractice } = await import("@/app/actions/practice");
            setHasUnsavedChanges(false);
            await createPractice(formData);
        } catch (error: any) {
            // Next.js redirect throws a special error - don't show alert for it
            if (error?.digest?.startsWith('NEXT_REDIRECT')) {
                // This is expected - the redirect is working
                return;
            }
            console.error(error);
            alert("Failed to create practice");
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

                    {/* Turn indicator with clear instructions */}
                    <div className={`p-4 rounded-lg ${isStudentTurn()
                        ? "bg-green-100 dark:bg-green-900/50 border-2 border-green-500"
                        : "bg-blue-100 dark:bg-blue-900/50 border-2 border-blue-500"
                        }`}>
                        <div className="font-bold text-lg mb-1">
                            {isStudentTurn() ? "👨‍🎓 Student's Turn" : "🤖 Opponent's Turn"}
                        </div>
                        <div className="text-sm opacity-75">
                            {isStudentTurn()
                                ? "Add the correct move the student should play"
                                : "Add one or more response moves. Multiple moves = variations the app will randomly choose from!"
                            }
                        </div>
                    </div>

                    {/* Quick navigation */}
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

                        {/* Breadcrumb */}
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

                    {/* Notes */}
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                        <label className="block text-sm font-medium mb-2">
                            📝 Coach Notes for "{currentNode.san || 'Starting Position'}"
                        </label>
                        <textarea
                            value={currentNotes}
                            onChange={(e) => setCurrentNotes(e.target.value)}
                            onBlur={saveNotes}
                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                            rows={2}
                            placeholder="Explain why this move is important..."
                        />
                    </div>

                    {/* Line Number - only show for leaf nodes */}
                    {isLeafNode(currentNode) && (
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                            <label className="block text-sm font-medium mb-2">
                                🔢 Line Number (for practice order)
                            </label>
                            <input
                                type="number"
                                min="1"
                                value={currentLineNumber}
                                onChange={(e) => setCurrentLineNumber(e.target.value)}
                                onBlur={saveLineNumber}
                                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                placeholder="Leave empty for random order"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Unseen lines are practiced in order of their line number (1 first, then 2, etc.)
                            </p>
                        </div>
                    )}
                </div>

                {/* Middle Column: Tree Visualization */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        🌳 Move Tree
                        <span className="text-sm font-normal text-gray-500">
                            (click any move to navigate)
                        </span>
                    </h2>

                    {/* Legend */}
                    <div className="flex flex-wrap gap-3 mb-4 text-xs">
                        <span className="flex items-center gap-1">
                            <span className="w-4 h-4 bg-green-100 dark:bg-green-900/50 rounded"></span>
                            Student move
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-4 h-4 bg-blue-100 dark:bg-blue-900/50 rounded"></span>
                            Opponent move
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="text-orange-500">⚡</span>
                            Has variations
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="text-gray-500">🏁</span>
                            End of line
                        </span>
                    </div>

                    <div className="overflow-auto max-h-[500px] p-2 bg-gray-50 dark:bg-gray-900 rounded">
                        <TreeView
                            node={tree}
                            currentNodeId={currentNode.id}
                            onNodeClick={navigateToNode}
                            playerColor={playerColor}
                            isRoot={true}
                        />
                    </div>

                    {tree.children.length === 0 && (
                        <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg text-center">
                            <p className="text-yellow-800 dark:text-yellow-200">
                                Make your first move on the board to start building the practice tree!
                            </p>
                        </div>
                    )}
                </div>

                {/* Right Column: Settings and Stats */}
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
                                    placeholder="e.g., Fried Liver Attack"
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
                                    placeholder="What will students learn?"
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
                            <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-900 rounded">
                                <span>Current depth:</span>
                                <span className="font-bold">{path.length - 1} moves</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-purple-50 dark:bg-purple-900/30 p-4 rounded-lg border-2 border-purple-200 dark:border-purple-800">
                        <h3 className="font-bold text-purple-800 dark:text-purple-200 mb-2">💡 How to create variations:</h3>
                        <ol className="text-sm text-purple-700 dark:text-purple-300 space-y-2 list-decimal list-inside">
                            <li>Navigate to an <strong>opponent's position</strong> (blue in tree)</li>
                            <li>Make a move on the board</li>
                            <li>Click <strong>"← Back"</strong> to return</li>
                            <li>Make a <strong>different move</strong> - this creates a variation!</li>
                            <li>The app will randomly pick between variations during practice</li>
                        </ol>
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || tree.children.length === 0 || !name}
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-lg font-bold text-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    >
                        {isSubmitting ? "Saving..." : "💾 Save Practice"}
                    </button>
                </div>
            </div>
        </div>
    );
}
