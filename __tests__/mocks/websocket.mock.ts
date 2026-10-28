import { jest } from '@jest/globals';

/**
 * MockWebSocket — drop-in replacement for the `ws` library's default export
 * for unit tests. Mimics the ws.WebSocket surface used by src/qlc-client.ts:
 *   - `on('open' | 'error' | 'message' | 'close', ...)` event subscription
 *   - `send(data)` method that emits a synthetic response back via the
 *     `'message'` event listeners (matching the QLC+API pipe-delimited format
 *     that QLCClient.parseQLCResponse expects).
 *   - Static readyState constants (CONNECTING / OPEN / CLOSING / CLOSED).
 *
 * The mocked `send` implementation is intentionally protocol-aware:
 * QLC+API commands are parsed and a synthesized pipe-delimited response is
 * emitted, so QLCClient's parser can decode it as if it came from a real
 * QLC+ daemon.
 */
export class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  /**
   * Test-injectable behavior knobs. Set before constructing a client and
   * reset to defaults in a `finally` block. Avoids the ergonomic mess of
   * subclass-and-replace-the-mock-module-for-one-test.
   */
  static suppressOpen = false;
  /** Wire format for getChannelsValues: QLC+ 4 (3 fields) or QLC+ 5 (4 fields per channel). */
  static channelValuesFormat: 'v4' | 'v5' = 'v4';
  /** Every command passed to send(), across all instances. Clear it in the test. */
  static sentCommands: string[] = [];

  readyState = MockWebSocket.OPEN;
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  private listeners: Map<string, Function[]> = new Map();
  private mockResponses: Map<string, string> = new Map();

  constructor(url: string) {
    this.url = url;

    // Set up default mock responses for common QLC+ API calls
    this.setupDefaultResponses();

    if (MockWebSocket.suppressOpen) {
      // Caller wants to simulate a stuck connection (never opens).
      return;
    }

    // Simulate connection opening
    setTimeout(() => {
      if (this.onopen) this.onopen(new Event('open'));
      this.emit('open');
    }, 0);
  }

  private setupDefaultResponses(): void {
    // Default fallback response (used when no command-specific match is found
    // and the command isn't a known QLC+API call). Pure 'OK' acknowledgement.
    this.mockResponses.set('default', 'OK');

    // Empty workspace response
    this.mockResponses.set('empty', '');

    // Error response
    this.mockResponses.set('error', 'ERROR: Command not found');
  }

  /**
   * Synthesize a QLC+API response for the given command.
   * Returns null if the command is not a recognized QLC+API request — caller
   * should fall back to the 'OK' default for high-rate APIs that don't reply.
   */
  private synthesizeQLCResponse(command: string): string | null {
    // Caller may have overridden the response for this exact command string.
    if (this.mockResponses.has(command)) {
      return this.mockResponses.get(command)!;
    }

    if (!command.startsWith('QLC+API|')) return null;

    const parts = command.split('|');
    const apiName = parts[1];
    const args = parts.slice(2);

    // Format: QLC+API|<commandName>|<param1>|<param2>|...
    // QLCClient.parseQLCResponse strips the 'QLC+API' prefix and exposes the
    // remaining parts as `data`. We must include both the echoed command name
    // AND the payload so the parser sees data.length > 0 / > 1 as needed.
    switch (apiName) {
      case 'getFunctionsNumber':
        // Parser expects data[0] to be a number-string (functions count).
        return 'QLC+API|getFunctionsNumber|2';

      case 'getFunctionsList':
        // Parser iterates pairs: id|name|id|name|...
        return 'QLC+API|getFunctionsList|1|Test Scene|2|Chase 1';

      case 'getFunctionType':
        // Parser expects data[0] to be the type string.
        return `QLC+API|getFunctionType|Scene`;

      case 'getFunctionStatus':
        // Parser expects data[0] to be 'Running' / 'Stopped' / 'Undefined'.
        return `QLC+API|getFunctionStatus|Stopped`;

      case 'setFunctionStatus':
        // Just an acknowledgement — parser returns success: true.
        return 'OK';

      case 'getWidgetsNumber':
        return 'QLC+API|getWidgetsNumber|2';

      case 'getWidgetsList':
        // Parser iterates pairs: id|name|id|name|...
        return 'QLC+API|getWidgetsList|1|Test Button|2|Slider 1';

      case 'getWidgetType':
        // QLCClient.getWidgetType reads data[1] — it expects the parser's
        // `data` array (everything after `QLC+API|<commandName>`) to look
        // like [widgetId, type]. So format the wire payload as
        // `QLC+API|getWidgetType|<widgetId>|<type>`.
        return `QLC+API|getWidgetType|${args[0] ?? '0'}|Button`;

      case 'getWidgetStatus':
        // Same shape: data[1] is the status. Use a non-PLAY status so the
        // simple-status branch executes (PLAY would require a step at data[2]).
        return `QLC+API|getWidgetStatus|${args[0] ?? '0'}|255`;

      case 'getWidgetSubIdList':
        // Parser iterates pairs: id|type|id|type|...
        return `QLC+API|getWidgetSubIdList|10|Button|11|Slider`;

      case 'getChannelsValues': {
        // QLC+ 4: index|value|type|...  QLC+ 5: index|value|type|0|...
        // Values are (i * 10) % 256 so tests can check record alignment.
        // args = [universe, startAddress, count]
        const start = parseInt(args[1] ?? '1', 10);
        const count = parseInt(args[2] ?? '1', 10);
        const fields: string[] = ['QLC+API', 'getChannelsValues'];
        for (let i = 0; i < count; i++) {
          fields.push(String(start + i), String((i * 10) % 256), '0.#FF0000');
          if (MockWebSocket.channelValuesFormat === 'v5') fields.push('0');
        }
        return fields.join('|');
      }

      default:
        // Unknown QLC+API command — acknowledge so the call doesn't time out.
        return 'OK';
    }
  }

  send(data: string | ArrayBuffer): void {
    const command = data.toString();
    MockWebSocket.sentCommands.push(command);

    // High-rate APIs (CH|..., widgetId|value, cueListId|OP, frameId|OP,
    // animationId|MATRIX_PUSHBUTTON|...) are fire-and-forget in the real
    // QLC+ protocol — they NEVER produce a wire response. If we synthesize
    // an 'OK' anyway, the qlc-client's leaked message listeners (it adds
    // a new on('message', ...) per QLC+API send and never removes them)
    // can pick up these stray frames and resolve the WRONG request, which
    // makes downstream tests flaky. Silently dropping the synthesized
    // response for non-QLC+API commands matches reality and keeps the
    // request/response pairing intact.
    if (!command.startsWith('QLC+API|') && !this.mockResponses.has(command)) {
      return;
    }

    // Simulate async response on the next tick (matches real ws timing).
    setTimeout(() => {
      const synthesized = this.synthesizeQLCResponse(command);
      const response = synthesized ?? this.mockResponses.get('default') ?? 'OK';
      this.simulateMessage(response);
    }, 10);
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
    this.emit('close');
  }

  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  emit(event: string, ...args: any[]): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(...args));
    }
  }

  // Test helper methods
  simulateMessage(data: string): void {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data }));
    }
    // src/qlc-client.ts subscribes via `ws.on('message', ...)` (EventEmitter
    // style), not via the `onmessage` browser-style property — we MUST emit
    // here too or the listener never fires and every call times out.
    this.emit('message', data);
  }

  simulateError(): void {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
    this.emit('error', new Error('Connection failed'));
  }

  setMockResponse(command: string, response: string): void {
    this.mockResponses.set(command, response);
  }

  simulateConnectionFailure(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.simulateError();
  }

  simulateTimeout(): void {
    // Don't respond to any messages to simulate timeout
    this.send = jest.fn();
  }
}

export default MockWebSocket;
