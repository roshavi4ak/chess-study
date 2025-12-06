#!/usr/bin/env node

// Optimized production server with maximum resource constraints
const { spawn } = require('child_process');
const path = require('path');

const port = process.env.PORT || 3000;
const nextBin = path.join(__dirname, 'node_modules', '.bin', 'next');

console.log(`[Server] Starting Next.js production server on port ${port}...`);
console.log(`[Server] Applying resource constraints...`);

const args = ['start', '-p', String(port)];

const child = spawn(nextBin, args, {
  cwd: __dirname,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    // Disable telemetry to reduce overhead
    NEXT_TELEMETRY_DISABLED: '1',
    // Limit libuv thread pool
    UV_THREADPOOL_SIZE: process.env.UV_THREADPOOL_SIZE || '1',
    // Limit glibc memory arenas
    MALLOC_ARENA_MAX: process.env.MALLOC_ARENA_MAX || '2',
    // Limit Node.js memory
    NODE_OPTIONS: (process.env.NODE_OPTIONS || '') + ' --max-old-space-size=512',
    // Ensure hostname is set
    HOSTNAME: process.env.HOSTNAME || '0.0.0.0',
  }
});

child.on('error', (err) => {
  console.error('[Server] Failed to start Next.js:', err);
  process.exit(1);
});

child.on('exit', (code) => {
  if (code !== 0) {
    console.error(`[Server] Next.js exited with code ${code}`);
  }
  process.exit(code || 0);
});

// Handle shutdown
const shutdown = (signal) => {
  console.log(`[Server] Received ${signal}, shutting down...`);
  child.kill(signal);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
