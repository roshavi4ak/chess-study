function parseOpeningData(input: string): any {
  // Extract the data from the SvelteKit resolve function
  const dataMatch = input.match(/__sveltekit_\w+\.resolve\(\d+, \(\) => \[(.*)\]\)/);
  
  if (!dataMatch) {
    throw new Error('Invalid input format');
  }
  
  try {
    // Evaluate the extracted data to get the object
    const data = eval(`(${dataMatch[1]})`);
    return data;
  } catch (error) {
    throw new Error('Failed to parse the opening data');
  }
}

// Example usage
const exampleInput = `__sveltekit_92kwyw.resolve(1, () => [{opening:{id:"9081606c-7b7c-4e4f-8d14-4d46457a33ba",displayName:"Italian Game",playerSide:"w",lines:["1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 Bb4+ 7. Nc3 Nxe4 8. O-O Nxc3 9. bxc3 Bxc3 10. Ba3 Bxa1 11. Re1+ Ne7 12. Bxe7 Qxe7 13. Rxe7+ Kxe7 14. Qxa1","1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d4 Nxe4 5. dxe5 Bc5 6. Qd5 Bxf2+ 7. Kf1 O-O 8. Qxe4"],lineNames:{"1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 Bb4+ 7. Nc3 Nxe4 8. O-O Nxc3 9. bxc3 Bxc3 10. Ba3 Bxa1 11. Re1+ Ne7 12. Bxe7 Qxe7 13. Rxe7+ Kxe7 14. Qxa1":"Rook Gambit","1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d4 Nxe4 5. dxe5 Bc5 6. Qd5 Bxf2+ 7. Kf1 O-O 8. Qxe4":"Queen's Assault"},lineCount:22,sharedOpeningPgn:"1. e4 e5 2. Nf3",sharedOpeningFen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2",shortDescriptions:{"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1":"Let's play the italian game!"},isTrial:false}}])`;

// Parse the example input
try {
  const openingData = parseOpeningData(exampleInput);
  console.log('Successfully parsed opening data:');
  console.log(JSON.stringify(openingData, null, 2));
} catch (error) {
  console.error('Error parsing opening data:', error);
}