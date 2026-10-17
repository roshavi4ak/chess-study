/* eslint-disable @typescript-eslint/no-require-imports -- Historical repair entry point. */
// The earlier move-recap repair was superseded by the user's original-note request.
// Retain this entry point as a read-only check; never regenerate its old patch.
require('node:child_process').execFileSync(process.execPath,
  [require('node:path').join(__dirname, 'prepare-original-closing-notes.cjs'), '--check'],
  { stdio: 'inherit' });
