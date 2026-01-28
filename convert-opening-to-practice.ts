import { Chess } from "chess.js";
import fs from "fs";
import path from "path";

// Tree node structure for practice
interface PracticeNode {
    id: string;
    fen: string;
    move: string | null;
    notes: string;
    lineNumber: number | null;
    children: PracticeNode[];
}

// Generate unique IDs for nodes
let nodeIdCounter = 0;
function generateNodeId(): string {
    return `node_${Date.now()}_${nodeIdCounter++}`;
}

// Convert opening data to practice tree
function convertOpeningToPractice(openingData: any): PracticeNode {
    const { opening } = openingData;
    const { lines, lineNames, descriptions, shortDescriptions, sharedOpeningFen, sharedOpeningPgn, playerSide, displayName } = opening;

    // Create root node at starting position
    const rootFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    let rootNode: PracticeNode = {
        id: generateNodeId(),
        fen: rootFen,
        move: null,
        notes: (descriptions && descriptions[rootFen]) || (shortDescriptions && shortDescriptions[rootFen]) || "",
        lineNumber: null,
        children: [],
    };

    // Generate nodes for shared opening moves if sharedOpeningPgn exists
    if (sharedOpeningPgn && sharedOpeningFen) {
        const sharedGame = new Chess();
        try {
            sharedGame.loadPgn(sharedOpeningPgn);
            const sharedHistory = sharedGame.history({ verbose: true });
            
            let currentNode = rootNode;
            for (const move of sharedHistory) {
                const uci = `${move.from}${move.to}${move.promotion || ""}`;
                const gameCopy = new Chess(currentNode.fen);
                
                try {
                    const from = uci.slice(0, 2);
                    const to = uci.slice(2, 4);
                    const promotion = uci[4] as "q" | "r" | "b" | "n" | undefined;
                    gameCopy.move({ from, to, promotion });
                    
                    const newNode: PracticeNode = {
                        id: generateNodeId(),
                        fen: gameCopy.fen(),
                        move: uci,
                        notes: (descriptions && descriptions[gameCopy.fen()]) || (shortDescriptions && shortDescriptions[gameCopy.fen()]) || "",
                        lineNumber: null,
                        children: [],
                    };
                    
                    currentNode.children.push(newNode);
                    currentNode = newNode;
                    
                    // Stop if we reached the shared opening FEN
                    if (gameCopy.fen() === sharedOpeningFen) {
                        break;
                    }
                } catch (error) {
                    console.error(`Error applying shared opening move ${uci}:`, error);
                    break;
                }
            }
            
            // Update rootNode if we generated shared opening nodes
            // If shared opening moves were added, currentNode will be the shared opening position
            if (currentNode.fen === sharedOpeningFen && currentNode.id !== rootNode.id) {
                // Do nothing, currentNode is already the root of the practice tree
            }
        } catch (error) {
            console.error(`Error parsing shared opening PGN:`, error);
        }
    }

    // Find the correct root node for processing lines (shared opening position)
    let practiceRootNode = rootNode;
    if (sharedOpeningFen) {
        // Traverse to find the shared opening position
        let tempNode: PracticeNode | null = rootNode;
        while (tempNode) {
            if (tempNode.fen === sharedOpeningFen) {
                practiceRootNode = tempNode;
                break;
            }
            
            // If not found, try to find in children (should only be one path to shared opening)
            tempNode = tempNode.children.length === 1 ? tempNode.children[0] : null;
        }
    }

    // Process each line
    lines.forEach((pgnLine: string, lineIndex: number) => {
        // Parse the entire PGN line
        const game = new Chess();
        const moves: string[] = [];
        try {
            game.loadPgn(pgnLine);
            const history = game.history({ verbose: true });
            
            // Determine starting point based on sharedOpeningFen
            if (sharedOpeningFen) {
                // Find the move that brings us to the shared opening position
                let moveIndex = 0;
                let tempGame = new Chess();
                while (moveIndex < history.length) {
                    tempGame.move(history[moveIndex].san);
                    if (tempGame.fen() === sharedOpeningFen) {
                        break;
                    }
                    moveIndex++;
                }
                
                // Collect moves after shared opening
                for (let i = moveIndex + 1; i < history.length; i++) {
                    const move = history[i];
                    const uci = `${move.from}${move.to}${move.promotion || ""}`;
                    moves.push(uci);
                }
            } else {
                // Collect all moves if no shared opening
                history.forEach(move => {
                    const uci = `${move.from}${move.to}${move.promotion || ""}`;
                    moves.push(uci);
                });
            }
        } catch (error) {
            console.error(`Error parsing line ${lineIndex + 1}:`, error);
            return; // Skip this line if parsing fails
        }

        // Build tree for this line
        let currentNode = practiceRootNode;
        for (const uciMove of moves) {
            // Check if move already exists as child
            const existingChild = currentNode.children.find(child => child.move === uciMove);
            if (existingChild) {
                currentNode = existingChild;
            } else {
                // Create new node
                const gameCopy = new Chess(currentNode.fen);
                try {
                    const from = uciMove.slice(0, 2);
                    const to = uciMove.slice(2, 4);
                    const promotion = uciMove[4] as "q" | "r" | "b" | "n" | undefined;
                    const result = gameCopy.move({ from, to, promotion });
                    
                    const newNode: PracticeNode = {
                        id: generateNodeId(),
                        fen: gameCopy.fen(),
                        move: uciMove,
                        notes: (descriptions && descriptions[gameCopy.fen()]) || (shortDescriptions && shortDescriptions[gameCopy.fen()]) || "",
                        lineNumber: null,
                        children: [],
                    };
                    
                    currentNode.children.push(newNode);
                    currentNode = newNode;
                } catch (error) {
                    console.error(`Error applying move ${uciMove}:`, error);
                    break;
                }
            }
        }

        // Set line number on leaf node
        if (currentNode.id !== practiceRootNode.id) {
            currentNode.lineNumber = lineIndex + 1;
            
            // Add line name as note if no other note exists
            if (!currentNode.notes && lineNames[pgnLine]) {
                currentNode.notes = lineNames[pgnLine];
            }
        }
    });

    return rootNode;
}

// Main function to convert all opening files
async function main() {
    const currentDir = process.cwd();
    const openingFiles = fs.readdirSync(currentDir).filter(file => file.endsWith("-opening.json") || file.endsWith("-attack.json"));

    for (const fileName of openingFiles) {
        console.log(`Processing ${fileName}...`);
        
        const filePath = path.join(currentDir, fileName);
        const content = fs.readFileSync(filePath, "utf8");
        const openingData = JSON.parse(content);
        
        const practiceTree = convertOpeningToPractice(openingData);
        
        // Save output
        const outputFileName = fileName.replace(".json", "-practice.json");
        const outputPath = path.join(currentDir, outputFileName);
        fs.writeFileSync(outputPath, JSON.stringify(practiceTree, null, 2));
        
        console.log(`✅ Saved practice tree to ${outputFileName}`);
    }

    console.log("\nConversion complete!");
}

// Run the script
main().catch(error => {
    console.error("Error during conversion:", error);
    process.exit(1);
});
