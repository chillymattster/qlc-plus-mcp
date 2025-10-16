import { jest } from '@jest/globals';

export interface MockFetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<any>;
  text: () => Promise<string>;
}

export class FetchMock {
  private responses: Map<string, MockFetchResponse> = new Map();

  constructor() {
    this.setupDefaultResponses();
  }

  private setupDefaultResponses(): void {
    // QLC+ health check response
    this.responses.set('http://localhost:9999/', {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve({}),
      text: () => Promise.resolve('QLC+ Web Interface')
    });

    // QLC+ not available response
    this.responses.set('http://localhost:9999/error', {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.reject(new Error('Server Error')),
      text: () => Promise.resolve('Error')
    });
  }

  async fetch(url: string, options?: RequestInit): Promise<MockFetchResponse> {
    const response = this.responses.get(url);

    if (!response) {
      // Default response for unknown URLs
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({}),
        text: () => Promise.resolve('')
      };
    }

    return response;
  }

  setMockResponse(url: string, response: Partial<MockFetchResponse>): void {
    const fullResponse: MockFetchResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
      ...response
    };
    this.responses.set(url, fullResponse);
  }

  simulateNetworkError(url: string): void {
    this.responses.set(url, {
      ok: false,
      status: 0,
      statusText: 'Network Error',
      json: () => Promise.reject(new Error('Network Error')),
      text: () => Promise.reject(new Error('Network Error'))
    });
  }

  reset(): void {
    this.responses.clear();
    this.setupDefaultResponses();
  }
}

export const fetchMock = new FetchMock();

// Replace global fetch with our mock
(global as any).fetch = jest.fn().mockImplementation((url: string, options?: RequestInit) =>
  fetchMock.fetch(url, options)
);