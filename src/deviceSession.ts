import { BINDING_TIMEOUT } from './settings.js';

type Phase = 'idle' | 'binding' | 'status' | 'ready' | 'closed';

/** One timer and one receive path per device, including across failed binding and recovery. */
export class DeviceSession {
  private phase: Phase = 'idle';
  private timer?: ReturnType<typeof setTimeout>;
  private attempts = 0;
  private lastStatus = 0;

  constructor(
    private readonly pollInterval: number,
    private readonly bind: (alternate: boolean) => void,
    private readonly poll: () => void,
    private readonly unavailable: () => void,
  ) {}

  start() {
    if (this.phase !== 'idle') {
      return;
    }
    this.retryBind();
  }

  isReady() {
    return this.phase === 'ready';
  }

  private schedule(action: () => void, delay: number) {
    clearTimeout(this.timer);
    this.timer = setTimeout(action, delay);
  }

  private retryBind() {
    if (this.phase === 'closed') {
      return;
    }
    this.phase = 'binding';
    this.unavailable();
    // Try both protocol versions, then back off to a maximum of one attempt every five minutes.
    const delay = this.attempts < 2 ? BINDING_TIMEOUT : Math.min(300000, 60000 * 2 ** Math.min(this.attempts - 2, 3));
    this.schedule(() => this.retryBind(), delay);
    this.bind(this.attempts++ > 0);
  }

  bindingAccepted() {
    if (this.phase !== 'binding') {
      return false;
    }
    this.phase = 'status';
    // Repeated bind replies must not postpone the status deadline indefinitely.
    this.schedule(() => this.retryBind(), BINDING_TIMEOUT);
    this.poll();
    return true;
  }

  statusReceived() {
    if (this.phase !== 'status' && this.phase !== 'ready') {
      return false;
    }
    const recovered = this.phase !== 'ready';
    this.lastStatus = Date.now();
    this.phase = 'ready';
    this.attempts = 0;
    if (recovered) {
      this.schedule(() => this.tick(), this.pollInterval);
    }
    return true;
  }

  private tick() {
    if (this.phase !== 'ready') {
      return;
    }
    if (Date.now() - this.lastStatus >= Math.max(90000, this.pollInterval * 3)) {
      this.retryBind();
      return;
    }
    this.schedule(() => this.tick(), this.pollInterval);
    this.poll();
  }

  transportFailed() {
    if (this.phase === 'ready') {
      this.retryBind();
    }
  }

  close() {
    this.phase = 'closed';
    clearTimeout(this.timer);
  }
}
