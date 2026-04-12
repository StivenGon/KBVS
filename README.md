# KBVS

KBVS is a Next.js app scaffold for a local-network typing competition game.

The current workspace includes a playable front-end prototype with:

- a live typing arena
- a spectator or master view for the match
- placeholder telemetry for time, mistakes, accuracy, and WPM
- room-oriented UI that is ready for WebSocket sync and database persistence

## Getting Started

First, run the WebSocket relay in one terminal:

```bash
npm run websocket:dev
```

Then run the Next.js development server in another terminal:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

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

This project uses `next/font` to load Geist for the interface.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
