import { spawn, ChildProcess } from "node:child_process";

type ManagedProcess = {
  name: string;
  child: ChildProcess;
};

const children: ManagedProcess[] = [];
let shuttingDown = false;

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

spawnProcess("web", "npm", ["run", "dev:web"]);
spawnProcess("worker", "npm", ["run", "worker:documents"]);
