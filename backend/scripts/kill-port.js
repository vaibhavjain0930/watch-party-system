const { execSync } = require('node:child_process');

function run(cmd) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8');
}

function killWindows(port) {
  // netstat -ano shows PID in last column
  const output = run(`netstat -ano | findstr :${port}`);
  const pids = new Set();

  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Example:
    // TCP    0.0.0.0:5000     0.0.0.0:0     LISTENING     1234
    const parts = trimmed.split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && /^\d+$/.test(pid)) pids.add(pid);
  }

  for (const pid of pids) {
    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
      process.stdout.write(`[kill-port] Killed PID ${pid} on port ${port}\n`);
    } catch {
      // ignore
    }
  }
}

function killUnix(port) {
  // Try lsof first (mac/linux)
  try {
    const pids = run(`lsof -ti tcp:${port}`).split(/\r?\n/).filter(Boolean);
    for (const pid of new Set(pids)) {
      try {
        execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
        process.stdout.write(`[kill-port] Killed PID ${pid} on port ${port}\n`);
      } catch {
        // ignore
      }
    }
  } catch {
    // lsof not present or nothing using the port
  }
}

function main() {
  const port = Number(process.argv[2]);
  if (!Number.isFinite(port) || port <= 0) {
    process.stderr.write('Usage: node scripts/kill-port.js <port>\n');
    process.exit(1);
  }

  try {
    if (process.platform === 'win32') killWindows(port);
    else killUnix(port);
  } catch {
    // If port is free, netstat/findstr can return non-zero; that's fine.
  }
}

main();

