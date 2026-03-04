# Bidmetric

## Local Development

- `npm run dev` starts both the Next.js app and the document worker.
- The worker is required for document parsing, indexing, and contract scan extraction.
- Without the worker, uploads will succeed but scans will remain queued or in progress.

## Production

- Run the web app and the document worker as separate processes.
- Web process: `npm run start`
- Worker process: `npm run worker:documents`
- Do not rely on the web process to execute queued jobs. Contract scan progress depends on the worker being live.
