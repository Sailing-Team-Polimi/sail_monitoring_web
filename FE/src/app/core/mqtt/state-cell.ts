/** Small synchronous state source. Keeps the protocol engine independent of Angular/RxJS. */
export class StateCell<T> {
  private readonly listeners = new Set<(value: T) => void>();
  constructor(public value: T) {}
  next(value: T): void {
    this.value = value;
    for (const listener of this.listeners) listener(value);
  }
  subscribe(observer: ((value: T) => void) | {next?: (value: T) => void}): {unsubscribe: () => void} {
    const listener = typeof observer === 'function' ? observer : (value: T) => observer.next?.(value);
    this.listeners.add(listener);
    listener(this.value);
    return {unsubscribe: () => this.listeners.delete(listener)};
  }
}
