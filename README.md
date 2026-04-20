# SilverRain

SilverRain is now a minimal Node.js handoff service for n8n. The Discord bot behavior has been removed from this repository, so Discord commands, voice playback, and welcome-message automation are no longer handled here.

## What This Does

- Starts a lightweight HTTP server
- Exposes a `/health` endpoint for basic status checks
- Leaves all workflow automation to n8n

## Setup

1. Install dependencies:

```bash
npm install
```

2. Start the service:

```bash
npm start
```

## Environment Variables

- `PORT` - optional. HTTP port for the local status server. Defaults to `3000`.

## Notes

- If you want Discord actions, message handling, or music playback, wire those workflows in n8n instead of this codebase.
- The `/health` endpoint returns a small JSON payload you can use to confirm the process is running.
