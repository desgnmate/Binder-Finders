// Kill any process on the given port (default 3000).
// Runs as an npm predev hook to prevent EADDRINUSE.
import { execSync } from "node:child_process";
import { networkInterfaces } from "node:os";

const port = process.argv[2] || "3000";

// Try both IPv4 and IPv6 variants
const patterns = [
  `:${port} `,
  `:${port}\\s`,
  `[::]:${port}`,
  `0.0.0.0:${port}`,
];

let pids = new Set();

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
      if (pid && /^\d+$/.test(pid) && pid !== "0") pids.add(pid);
    }
  } catch {
    // no matches = no problem
  }
}

for (const pid of pids) {
  try {
    execSync(`taskkill /F /PID ${pid} /T 2>nul`, {
      stdio: "ignore",
      timeout: 3000,
    });
    console.log(`Killed PID ${pid} on port ${port}`);
  } catch {
    // process already gone, that's fine
  }
}

// Clean the Next.js build cache to prevent 404/hydration conflicts.
import fs from "node:fs";
import path from "node:path";

try {
  const nextDir = path.join(process.cwd(), ".next");
  if (fs.existsSync(nextDir)) {
    fs.rmSync(nextDir, { recursive: true, force: true });
    console.log("Cleaned stale Next.js cache (.next)");
  }
} catch (error) {
  console.warn("Failed to clean Next.js cache directory:", error.message);
}
