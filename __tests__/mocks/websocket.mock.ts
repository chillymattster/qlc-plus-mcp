import { jest } from '@jest/globals';

export class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

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

    // Simulate connection opening
    setTimeout(() => {
      if (this.onopen) this.onopen(new Event('open'));
      this.emit('open');
    }, 0);
  }

  private setupDefaultResponses(): void {
    // Health check response
    this.mockResponses.set('default', 'OK');

    // Fixtures list
    this.mockResponses.set('QLC+API|getFixturesList', JSON.stringify([
      { id: 1, name: 'LED Strip 1', type: 'Generic RGB LED Strip' },
      { id: 2, name: 'Moving Head 1', type: 'Martin MAC Quantum Wash' }
    ]));

    // Functions list
    this.mockResponses.set('QLC+API|getFunctionsList', JSON.stringify([
      { id: 1, name: 'Scene 1', type: 'Scene' },
      { id: 2, name: 'Chase 1', type: 'Chaser' }
    ]));

    // Widgets list
    this.mockResponses.set('QLC+API|getWidgetsList', JSON.stringify([
      { id: 1, name: 'Button 1', type: 'Button' },
      { id: 2, name: 'Slider 1', type: 'Slider' }
    ]));

    // Empty workspace response
    this.mockResponses.set('empty', '');

    // Error response
    this.mockResponses.set('error', 'ERROR: Command not found');
  }

  send(data: string | ArrayBuffer): void {
    const command = data.toString();

    // Simulate async response
    setTimeout(() => {
      let response = this.mockResponses.get(command) || this.mockResponses.get('default');

      // Handle specific command patterns
      if (command.includes('sdSetChannelValue')) {
        response = 'OK';
      } else if (command.includes('setFunctionStatus')) {
        response = 'OK';
      } else if (command.includes('stopAllFunctions')) {
        response = 'OK';
      } else if (command.includes('setWidgetValue')) {
        response = 'OK';
      }

      this.simulateMessage(response!);
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