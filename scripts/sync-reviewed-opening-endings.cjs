/* eslint-disable @typescript-eslint/no-require-imports -- Node content maintenance tool. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { writeJson } = require('./prepare-bulgarian-openings.cjs');
const directory = path.resolve(__dirname, '../openings/bulgarian');
const endings = JSON.parse(fs.readFileSync(path.join(directory, 'endpoint-notes.json'), 'utf8'));
let count = 0;
function updateTree(node, notes) {
  if (!node.children.length) { assert(notes[node.fen], `Missing reviewed ending ${node.fen}`); node.notes = notes[node.fen]; count++; }
  node.children.forEach(child => updateTree(child, notes));
}
for (const folder of [directory, path.join(directory, 'next20')]) {
  for (const file of fs.readdirSync(folder)) {
    if (file.endsWith('-opening.json')) {
      const location = path.join(folder, file), data = JSON.parse(fs.readFileSync(location, 'utf8'));
      const notes = endings[data.opening.displayName]; assert(notes, file);
      Object.assign(data.opening.descriptions, notes); writeJson(location, data);
      const treeLocation = location.replace('-opening.json', '-opening-practice.json');
      const tree = JSON.parse(fs.readFileSync(treeLocation, 'utf8')); updateTree(tree, notes); writeJson(treeLocation, tree);
      const localizationFile = location.replace('-opening.json', '.notes.json');
      const localization = JSON.parse(fs.readFileSync(localizationFile, 'utf8'));
      const { extractLiteral } = require('./prepare-bulgarian-openings.cjs');
      const source = extractLiteral(fs.readFileSync(path.resolve(directory, '..', localization.source), 'utf8')).opening;
      Object.keys(source.descriptions).forEach((fen, index) => { if (notes[fen]) localization.descriptions[index] = notes[fen]; });
      localization.extraDescriptions = { ...(localization.extraDescriptions || {}), ...notes };
      writeJson(localizationFile, localization);
    } else if (['practices.json', 'next-practices.json'].includes(file)) {
      const location = path.join(folder, file), data = JSON.parse(fs.readFileSync(location, 'utf8'));
      data.practices.forEach(practice => updateTree(practice.tree, endings[practice.name]));
      writeJson(location, data);
    }
  }
}
console.log(`Updated ${count} local terminal notes without replacing any node IDs.`);
