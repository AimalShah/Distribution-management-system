type EventStreamResponse = {
  destroyed: boolean;
  writableEnded: boolean;
  write(chunk: string): boolean;
  end(): void;
};

export type MutationDomain =
  | "sales"
  | "payments"
  | "purchases"
  | "returns"
  | "products"
  | "categories"
  | "brands"
  | "suppliers"
  | "customers"
  | "inventory"
  | "roles"
  | "members"
  | "settings"
  | "all";

const subscribers = new Map<string, Set<EventStreamResponse>>();

let nextEventId = 1;

export function subscribeToTenantEvents(
  organizationId: string,
  response: EventStreamResponse
): () => void {
  const listeners = subscribers.get(organizationId) ?? new Set<EventStreamResponse>();

  listeners.add(response);
  subscribers.set(organizationId, listeners);

  return () => {
    listeners.delete(response);

    if (listeners.size === 0) subscribers.delete(organizationId);
  };
}

export function publishTenantMutation(
  organizationId: string,
  domain: MutationDomain
): void {
  const listeners = subscribers.get(organizationId);

  if (!listeners) return;

  const id = nextEventId++;
  const frame = `id: ${id}\nevent: mutation\ndata: ${JSON.stringify({ domain })}\n\n`;

  for (const response of listeners) {
    if (response.destroyed || response.writableEnded) {
      listeners.delete(response);

      continue;
    }

    try {
      if (!response.write(frame)) {
        listeners.delete(response);
        response.end();
      }
    } catch {
      listeners.delete(response);
    }
  }

  if (listeners.size === 0) subscribers.delete(organizationId);
}

export function tenantEventSubscriberCount(organizationId: string): number {
  return subscribers.get(organizationId)?.size ?? 0;
}
