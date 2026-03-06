import { spawn, ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

type ManagedProcess = {
  name: string;
  child: ChildProcess;
};

const children: ManagedProcess[] = [];
let shuttingDown = false;

function loadLocalEnvFiles() {
  const envFiles = [".env.local", ".env"];

  for (const fileName of envFiles) {
    const filePath = path.join(process.cwd(), fileName);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }

      const separator = line.indexOf("=");
      if (separator === -1) {
        continue;
      }

      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim();
      if (key && !(key in process.env)) {
        process.env[key] = value;
      }
    }
  }
}

function spawnProcess(name: string, command: string, args: string[]) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  const managed = { name, child };
  children.push(managed);

  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.error(`${name} exited`, { code, signal });
    shutdown();
    process.exit(code ?? 1);
  });

  child.on("error", (error) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.error(`${name} failed to start`, error);
    shutdown();
    process.exit(1);
  });
}

function shutdown() {
  for (const { child } of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
}

process.on("SIGINT", () => {
  shuttingDown = true;
  shutdown();
  process.exit(0);
});

process.on("SIGTERM", () => {
  shuttingDown = true;
  shutdown();
  process.exit(0);
});

loadLocalEnvFiles();
spawnProcess("web", "npm", ["run", "dev:web"]);
spawnProcess("worker", "npm", ["run", "worker:documents"]);
