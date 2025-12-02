#!/usr/bin/env node

// Simple production server that uses Next.js CLI
const { spawn } = require('child_process');
const path = require('path');

const port = process.env.PORT || 3000;
const nextBin = path.join(__dirname, 'node_modules', '.bin', 'next');

console.log(`Starting Next.js production server on port ${port}...`);

const args = ['start', '-p', String(port)];

const child = spawn(nextBin, args, {
  cwd: __dirname,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production'
  }
});

child.on('error', (err) => {
  console.error('Failed to start Next.js:', err);
  process.exit(1);
});

child.on('exit', (code) => {
  if (code !== 0) {
    console.error(`Next.js exited with code ${code}`);
  }
  process.exit(code || 0);
});

// Handle shutdown
const shutdown = (signal) => {
  console.log(`Received ${signal}, shutting down...`);
  child.kill(signal);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
