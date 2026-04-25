# KBVS

KBVS is a Next.js app scaffold for a local-network typing competition game.

The current workspace includes a playable front-end prototype with:

- a live typing arena
- a spectator or master view for the match
- placeholder telemetry for time, mistakes, accuracy, and WPM
- room-oriented UI that is ready for WebSocket sync and database persistence

## Getting Started

Run the development stack:

```bash
npm run dev
```

That command now starts both services:

- Next.js on port `3000`
- WebSocket relay on port `8787`

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## LAN Multiplayer (No Internet)

If you are playing on two devices connected to the same Wi-Fi router (without internet), use the host PC Wi-Fi IPv4 address on both devices.

Host checklist:

1. Start everything once on the host PC with `npm run dev`.
2. Find the host IPv4 (for example with `ipconfig`) and share that IP with the second device.
3. Open the game from that host IP on both devices.

Example:

- `http://<HOST_WIFI_IP>:3000/lobby`
- `http://<HOST_WIFI_IP>:3000/master`
- `http://<HOST_WIFI_IP>:3000/player/A`
- `http://<HOST_WIFI_IP>:3000/player/B`

Important:

- Do not use `localhost` on phones or other devices.
- Keep `npm run dev` running on the host PC during the match.
- Ensure Windows firewall allows inbound TCP ports `3000` and `8787` on private networks.
- If `npm run websocket:dev` is started twice, the second start now exits cleanly when it detects an active relay on port `8787`.

For a basic multiplayer demo, open the dedicated routes in separate tabs:

- [http://localhost:3000/lobby](http://localhost:3000/lobby)
- [http://localhost:3000/master](http://localhost:3000/master)
- [http://localhost:3000/player](http://localhost:3000/player)
- [http://localhost:3000/player/A](http://localhost:3000/player/A)
- [http://localhost:3000/player/B](http://localhost:3000/player/B)

The lobby and master views now share a synchronized 3-second countdown before the race starts, and the player views stay locked until the room becomes live.

Before each race, the host can pick the round text from the shared catalog and see its difficulty level reflected in the lobby, master view, and live arena.

The landing page lives in `src/app/page.tsx`, the lobby in `src/app/lobby/page.tsx`, the master view in `src/app/master/page.tsx`, and the player routes in `src/app/player/`.

## What is next

The scaffold is ready for the next implementation step:

- real-time rooms over WebSockets, already wired for the first demo step
- a database model for players, matches, and results
- a master dashboard that follows the live typing session
- historical rankings and per-player statistics

## Database Setup

The repository now includes an installable MySQL schema in [database/install.sql](database/install.sql). It creates the `kbvs` database, the `text_difficulty` and `textos` tables, and seeds the starter catalog used by the app.

If you clone the project onto another device, import that file into MySQL first, then configure the connection variables. You can start from [.env.example](.env.example) and copy the values into a local `.env.local` file:

```bash
mysql -u root -p < database/install.sql
```

If you prefer MySQL Workbench, open [database/install.sql](database/install.sql) and run it against your local server.

The app reads these environment variables:

- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_DATABASE`

If they are not set, the app falls back to `localhost`, port `3306`, user `root`, password `123456`, and database `kbvs`.

This project uses `next/font` to load Geist for the interface.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
