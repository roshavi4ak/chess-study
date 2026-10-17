/* eslint-disable @typescript-eslint/no-require-imports -- Local source and translation maintenance. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { assertBulgarian, extractLiteral, readJson, writeJson } = require('./prepare-bulgarian-openings.cjs');
const root = path.resolve(__dirname, '..');
const directory = path.join(root, 'openings/bulgarian');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');

function originalClosingNotes() {
  const source = readJson(path.join(directory, 'original-closing-notes-source.json'));
  const texts = readJson(path.join(directory, 'original-closing-texts.json'));
  const translations = readJson(path.join(directory, 'original-closing-translations.json'));
  assert.equal(source.courses.length, 29);
  assert.equal(texts.length, 662);
  assert.deepEqual(Object.keys(translations).sort(), texts.map(t => t.id).sort(), 'Every original text must have exactly one translation');
  const byText = new Map(texts.map(t => [t.text, t]));
  assert.equal(byText.size, texts.length);
  const fallback = readJson(path.join(directory, 'original-bulgarian-closing-notes.json'));
  assert.equal(fallback.notes.length, 15);
  const fallbackNodes = new Map(fallback.notes.map(n => [n.nodeId, n]));
  const endpointNotes = {}, courses = [];
  const boardKey = fen => fen.split(' ').slice(0, 4).join(' ');
  const usedIds = new Set(), nodeIds = new Set();
  for (const course of source.courses) {
    const original = course.source ? extractLiteral(fs.readFileSync(path.join(root, 'openings', course.source), 'utf8')).opening : null;
    endpointNotes[course.name] = {};
    const lines = course.lines.map(line => {
      assert(!nodeIds.has(line.nodeId), 'Duplicate ending'); nodeIds.add(line.nodeId);
      let textId = null, notes;
      if (line.language === 'en') {
        assert(original, `${course.slug}: missing downloaded source`);
        const exact = original.descriptions?.[line.fen] || original.shortDescriptions?.[line.fen];
        const candidates = [...new Set(Object.entries({ ...original.shortDescriptions, ...original.descriptions })
          .filter(([fen]) => boardKey(fen) === boardKey(line.fen)).map(([, text]) => text).filter(Boolean))];
        assert(exact || candidates.length === 1, `${course.slug}:${line.lineNumber}: ambiguous original`);
        assert.equal(line.sourceText, exact || candidates[0], 'Original commentary changed; re-extract and review its translation');
        const entry = byText.get(line.sourceText); assert(entry);
        textId = entry.id; usedIds.add(textId); notes = translations[textId];
      } else {
        assert.equal(line.language, 'bg');
        const saved = fallbackNodes.get(line.nodeId); assert(saved);
        assert.equal(saved.practiceId, course.practiceId); assert.equal(saved.fen, line.fen);
        assert.equal(line.sourceText, saved.notes, 'Original Bulgarian backup changed');
        notes = line.sourceText;
      }
      assertBulgarian(notes, `${course.slug}:${line.lineNumber}`);
      assert(!/В крайната позиция (?:белите|черните) са на ход\./u.test(notes), 'Do not append turn boilerplate');
      const prior = endpointNotes[course.name][line.fen];
      assert(!prior || prior === notes, 'Conflicting original notes for a shared endpoint');
      endpointNotes[course.name][line.fen] = notes;
      return { ...line, textId, sourceSha256: hash(line.sourceText), notes };
    });
    courses.push({ ...course, lines });
  }
  assert.equal(nodeIds.size, 694); assert.equal(usedIds.size, texts.length);
  const receipt = { formatVersion: 1, method: 'Original closing commentary translated faithfully into Bulgarian; original Bulgarian backup only when downloaded commentary is unavailable.', courses };
  return { endpointNotes, receipt };
}

if (require.main === module) {
  const { endpointNotes, receipt } = originalClosingNotes();
  const traxler = Object.fromEntries(receipt.courses.find(c => c.slug === 'traxler').lines.map(l => [l.lineNumber, l.notes]));
  const targets = [
    [path.join(directory, 'endpoint-notes.json'), endpointNotes],
    [path.join(directory, 'original-closing-notes.json'), receipt],
    [path.join(directory, 'next20/traxler-endings.json'), traxler],
  ];
  for (const [file, data] of targets) {
    if (process.argv.includes('--check')) assert.deepEqual(readJson(file), data, `Original notes out of sync: ${file}`);
    else writeJson(file, data);
  }
  console.log(JSON.stringify({ courses: receipt.courses.length, closingNotes: 694, originalEnglishNotes: 679, originalBulgarianNotes: 15, translatedTexts: 662, mode: process.argv.includes('--check') ? 'CHECKED' : 'PREPARED' }));
}
module.exports = { originalClosingNotes };
