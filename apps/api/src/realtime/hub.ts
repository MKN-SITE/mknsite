import { sse } from "elysia";
import { getAuthenticatedProfile } from "../auth/auth";

export type RealtimeEvent =
  | { type: "access.updated" | "session.revoked"; message: string; occurredAt: string }
  | { type: "notification.created"; message: string; occurredAt: string }
  | { type: "admin.users.updated"; userId: number; occurredAt: string };

const subscribers = new Map<number, Set<(event: RealtimeEvent) => void>>();
const adminSubscribers = new Set<(event: RealtimeEvent) => void>();

export function publishRealtimeEvent(userId: number, event: { type: "access.updated" | "session.revoked"; message: string }) {
  const payload: RealtimeEvent = { ...event, occurredAt: new Date().toISOString() };
  subscribers.get(userId)?.forEach((send) => send(payload));
}

export function publishAdminUsersUpdated(userId: number) {
  const payload: RealtimeEvent = {
    type: "admin.users.updated",
    userId,
    occurredAt: new Date().toISOString()
  };
  adminSubscribers.forEach((send) => send(payload));
}

export async function* userEventStream(
  userId: number,
  context: "employee" | "admin" = "employee",
  headers?: Headers
) {
  const queue: RealtimeEvent[] = [];
  let isClosed = false;
  let wake: (() => void) | undefined;

  const send = (event: RealtimeEvent) => {
    if (isClosed) return;
    if (queue.length > 100) {
      queue.shift(); // batasi antrean untuk client lambat
    }
    queue.push(event);
    wake?.();
    wake = undefined;
  };

  const userSubscribers = subscribers.get(userId) ?? new Set();
  userSubscribers.add(send);
  subscribers.set(userId, userSubscribers);

  if (context === "admin") {
    adminSubscribers.add(send);
  }

  // Heartbeat transport (25s) dengan revalidasi sesi berkala
  const heartbeat = setInterval(async () => {
    if (isClosed) return;

    if (headers) {
      const activeUser = await getAuthenticatedProfile(headers, context);
      if (!activeUser) {
        send({
          type: "session.revoked",
          message: "Sesi Anda tidak lagi valid.",
          occurredAt: new Date().toISOString()
        });
        isClosed = true;
        return;
      }
    }

    send({
      type: "notification.created",
      message: "keep-alive",
      occurredAt: new Date().toISOString()
    });
  }, 25_000);

  try {
    yield sse({ event: "connected", data: { occurredAt: new Date().toISOString() } });
    while (!isClosed) {
      if (!queue.length) {
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      }
      const event = queue.shift();
      if (event) {
        yield sse({ event: event.type, data: event });
        if (event.type === "session.revoked") {
          // Sesi dicabut: tutup stream setelah event terkirim
          break;
        }
      }
    }
  } finally {
    isClosed = true;
    clearInterval(heartbeat);
    userSubscribers.delete(send);
    if (!userSubscribers.size) {
      subscribers.delete(userId);
    }
    if (context === "admin") {
      adminSubscribers.delete(send);
    }
  }
}
