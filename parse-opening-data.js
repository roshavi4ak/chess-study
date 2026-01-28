const fs = require('fs');
const path = require('path');

function parseOpeningData(input) {
  // Extract the data from the SvelteKit resolve function
  const dataMatch = input.match(/__sveltekit_\w+\.resolve\(\d+, \(\) => \[(.*)\]\)/);
  
  if (!dataMatch) {
    throw new Error('Invalid input format - could not find SvelteKit resolve function');
  }
  
  try {
    // Evaluate the extracted data to get the object
    const data = eval('(' + dataMatch[1] + ')');
    return data;
  } catch (error) {
    throw new Error(`Failed to parse opening data: ${error.message}`);
  }
}

function processFile(filePath) {
  try {
    console.log(`Processing file: ${filePath}`);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error('File does not exist');
    }
    
    // Read and parse file
    const rawData = fs.readFileSync(filePath, 'utf8');
    const openingData = parseOpeningData(rawData);
    
    // Generate output file path
    const outputFile = path.join(path.dirname(filePath), path.basename(filePath, '.js') + '.json');
    
    // Write JSON output
    fs.writeFileSync(outputFile, JSON.stringify(openingData, null, 2));
    console.log(`✓ Successfully processed: ${outputFile}`);
    
    return true;
  } catch (error) {
    console.error(`✗ Error processing ${filePath}: ${error.message}`);
    return false;
  }
}

// Main functionality
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node parse-opening-data.js <file1.js> [file2.js] [file3.js] ...');
    console.log('');
    console.log('Example:');
    console.log('  node parse-opening-data.js fried-liver-attack.js italian-game.js');
    return;
  }
  
  console.log('========================================');
  console.log('Parsing opening data files');
  console.log('========================================');
  console.log('');
  
  let successCount = 0;
  let errorCount = 0;
  
  args.forEach(filePath => {
    const result = processFile(filePath);
    if (result) {
      successCount++;
    } else {
      errorCount++;
    }
    console.log('');
  });
  
  console.log('========================================');
  console.log(`Summary: ${successCount} successful, ${errorCount} failed`);
  console.log('========================================');
}

// Run the main function
main();