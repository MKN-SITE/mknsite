import { sse } from "elysia";

export type RealtimeEvent = {
  type: "access.updated" | "session.revoked" | "notification.created";
  message: string;
  occurredAt: string;
};

const subscribers = new Map<number, Set<(event: RealtimeEvent) => void>>();

export function publishRealtimeEvent(userId: number, event: Omit<RealtimeEvent, "occurredAt">) {
  const payload: RealtimeEvent = { ...event, occurredAt: new Date().toISOString() };
  subscribers.get(userId)?.forEach((send) => send(payload));
}

export async function* userEventStream(userId: number) {
  const queue: RealtimeEvent[] = [];
  let wake: (() => void) | undefined;
  const send = (event: RealtimeEvent) => {
    queue.push(event);
    wake?.();
    wake = undefined;
  };
  const userSubscribers = subscribers.get(userId) ?? new Set();
  userSubscribers.add(send);
  subscribers.set(userId, userSubscribers);
  const heartbeat = setInterval(() => send({ type: "notification.created", message: "keep-alive", occurredAt: new Date().toISOString() }), 25_000);

  try {
    yield sse({ event: "connected", data: { occurredAt: new Date().toISOString() } });
    while (true) {
      if (!queue.length) await new Promise<void>((resolve) => { wake = resolve; });
      const event = queue.shift();
      if (event) yield sse({ event: event.type, data: event });
    }
  } finally {
    clearInterval(heartbeat);
    userSubscribers.delete(send);
    if (!userSubscribers.size) subscribers.delete(userId);
  }
}
