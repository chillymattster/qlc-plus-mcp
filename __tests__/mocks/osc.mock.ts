import { jest } from '@jest/globals';

// Mock OSC Message class
export class MockOSCMessage {
  address: string;
  args: any[];

  constructor(address: string, ...args: any[]) {
    this.address = address;
    this.args = args;
  }

  pack(): Buffer {
    // Simulate packed OSC message
    return Buffer.from(`${this.address}|${this.args.join('|')}`);
  }
}

// Mock OSC module
export const MockOSC = {
  Message: MockOSCMessage
};

// Create jest mock for osc-js module
jest.mock('osc-js', () => ({
  __esModule: true,
  default: MockOSC
}));

export default MockOSC;