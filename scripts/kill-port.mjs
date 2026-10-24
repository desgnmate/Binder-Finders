// Kill any process on the given port (default 3000).
// Runs as an npm predev hook to prevent EADDRINUSE.
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const port = process.argv[2] || "3000";

// Cross-platform port kill:
// 1. Try lsof (macOS / Linux)
try {
  const pids = execSync(`lsof -ti :${port}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 3000 }).trim().split("\n");
  for (const pid of pids) {
    if (pid && /^\d+$/.test(pid)) {
      try {
        process.kill(Number(pid), "SIGKILL");
        console.log(`Killed PID ${pid} on port ${port}`);
      } catch {}
    }
  }
} catch {
  // If not on Unix or no process found, try Windows netstat/taskkill
  const patterns = [`:${port} `, `:${port}\\s`, `[::]:${port}`, `0.0.0.0:${port}`];
  let winPids = new Set();
  for (const pattern of patterns) {
    try {
      const out = execSync(`netstat -ano | findstr "${pattern}"`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 5000,
      });
      for (const line of out.trim().split("\n")) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid) && pid !== "0") winPids.add(pid);
      }
    } catch {}
  }
  for (const pid of winPids) {
    try {
      execSync(`taskkill /F /PID ${pid} /T 2>nul`, { stdio: "ignore", timeout: 3000 });
      console.log(`Killed PID ${pid} on port ${port}`);
    } catch {}
  }
}

// Clean the Next.js build cache to prevent 404/hydration conflicts.
try {
  const nextDir = path.join(process.cwd(), ".next");
  if (fs.existsSync(nextDir)) {
    fs.rmSync(nextDir, { recursive: true, force: true });
    console.log("Cleaned stale Next.js cache (.next)");
  }
} catch (error) {
  console.warn("Failed to clean Next.js cache directory:", error.message);
}
