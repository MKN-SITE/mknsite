import { API_URL } from "./api";

export type RealtimeContext = "employee" | "admin";

export type RealtimeHandlers = {
  onConnected?: () => void;
  onAccessUpdated?: () => void;
  onSessionRevoked?: (message?: string) => void;
  onAdminUsersUpdated?: (userId: number) => void;
  onError?: (event: Event) => void;
};

export function connectRealtime(
  context: RealtimeContext = "employee",
  handlers: RealtimeHandlers = {}
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const streamUrl = `${API_URL}/realtime/events?context=${context}`;
  const stream = new EventSource(streamUrl, { withCredentials: true });

  stream.addEventListener("connected", () => {
    handlers.onConnected?.();
  });

  stream.addEventListener("access.updated", () => {
    handlers.onAccessUpdated?.();
  });

  stream.addEventListener("session.revoked", (event) => {
    let message: string | undefined;
    try {
      const data = JSON.parse(event.data);
      message = data.message;
    } catch {}
    handlers.onSessionRevoked?.(message);
    stream.close();
  });

  if (context === "admin") {
    stream.addEventListener("admin.users.updated", (event) => {
      try {
        const data = JSON.parse(event.data);
        if (typeof data.userId === "number") {
          handlers.onAdminUsersUpdated?.(data.userId);
        }
      } catch {}
    });
  }

  stream.onerror = (err) => {
    handlers.onError?.(err);
  };

  return () => {
    stream.close();
  };
}
