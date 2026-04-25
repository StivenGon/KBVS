export function resolveTypingWebSocketUrl() {
  const envUrl = process.env.NEXT_PUBLIC_TYPING_WS_URL;
  const envPort = process.env.NEXT_PUBLIC_TYPING_WS_PORT;

  if (envUrl) {
    return envUrl;
  }

  const port = envPort?.trim() || "8787";

  if (typeof window === "undefined") {
    return `ws://127.0.0.1:${port}`;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.hostname}:${port}`;
}