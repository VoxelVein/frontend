export interface ModEventData {
  id: string;
  name: string;
}

export interface ModEvent {
  event: "mod.created" | "mod.updated" | "mod.deleted";
  data: ModEventData;
}

type Subscriber = (event: ModEvent) => void;

const subscribers = new Set<Subscriber>();

export const events = {
  broadcast(event: ModEvent): void {
    for (const subscriber of subscribers) {
      subscriber(event);
    }
  },
  subscribe(subscriber: Subscriber): () => void {
    subscribers.add(subscriber);

    return () => {
      subscribers.delete(subscriber);
    };
  },
};

/**
 * A minimal async queue used to bridge webhook broadcasts into the SSE
 * generator. `next()` resolves with the next pushed item (or `null` once
 * `close()` is called), so a disconnected client never leaks a waiter.
 */
export class AsyncQueue<T> {
  private items: T[] = [];
  private waiters: ((item: T | null) => void)[] = [];
  private closed = false;

  push(item: T): void {
    if (this.closed) {
      return;
    }

    const waiter = this.waiters.shift();

    if (waiter) {
      waiter(item);
    } else {
      this.items.push(item);
    }
  }

  close(): void {
    if (this.closed) {
      return;
    }

    this.closed = true;

    for (const waiter of this.waiters.splice(0)) {
      waiter(null);
    }
  }

  next(): Promise<T | null> {
    if (this.items.length > 0) {
      return Promise.resolve(this.items.shift() ?? null);
    }

    if (this.closed) {
      return Promise.resolve(null);
    }

    // oxlint-disable-next-line promise/avoid-new -- The queue bridges external push events into the SSE generator; a manually-resolved promise is the only way to await the next pushed item without polling.
    return new Promise<T | null>((resolve) => {
      this.waiters.push(resolve);

      // Re-check after registering: an item may have arrived (or the queue
      // closed) between the checks above and this registration.
      if (this.closed) {
        const index = this.waiters.indexOf(resolve);

        if (index !== -1) {
          this.waiters.splice(index, 1);
          resolve(null);
        }

        return;
      }

      if (this.items.length > 0) {
        const index = this.waiters.indexOf(resolve);

        if (index !== -1) {
          this.waiters.splice(index, 1);
          resolve(this.items.shift() ?? null);
        }
      }
    });
  }
}
