import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MockWebSocket } from '../mocks/websocket.mock.js';
import { fetchMock } from '../mocks/fetch.mock.js';
import '../mocks/osc.mock.js';

// Mock the entire MCP SDK
const mockServer = {
  setRequestHandler: jest.fn(),
  connect: jest.fn()
};

const mockTransport = {
  start: jest.fn()
};

jest.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn().mockImplementation(() => mockServer)
}));

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn().mockImplementation(() => mockTransport)
}));

jest.mock('@modelcontextprotocol/sdk/types.js', () => ({
  CallToolRequestSchema: 'call-tool',
  ListToolsRequestSchema: 'list-tools'
}));

// Mock ws module — require() inside factory because jest.mock is hoisted above imports.
jest.mock('ws', () => ({
  __esModule: true,
  default: require('../mocks/websocket.mock').MockWebSocket,
}));

// Mock fs/promises.
// `as never` casts work around @jest/globals' UnknownFunction strict typing —
// the resolved values are correct at runtime.
jest.mock('fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined as never),
  readFile: jest.fn().mockResolvedValue('{"test": "data"}' as never)
}));

describe('MCP Server', () => {
  let toolHandlers: Map<string, Function>;
  let listToolsHandler: Function;

  beforeEach(async () => {
    jest.clearAllMocks();
    fetchMock.reset();
    toolHandlers = new Map();

    // Capture the handlers registered with the mock server.
    // `as any` impl is a concession to @jest/globals strict UnknownFunction generic.
    mockServer.setRequestHandler.mockImplementation(((schema: string, handler: Function) => {
      if (schema === 'list-tools') {
        listToolsHandler = handler;
      } else if (schema === 'call-tool') {
        // Store the call tool handler
        toolHandlers.set('call-tool', handler);
      }
    }) as any);

    // Import the server module to trigger handler registration
    await import('../../src/index.js');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Tool Registration', () => {
    it('should register list tools handler', () => {
      expect(mockServer.setRequestHandler).toHaveBeenCalledWith('list-tools', expect.any(Function));
    });

    it('should register call tool handler', () => {
      expect(mockServer.setRequestHandler).toHaveBeenCalledWith('call-tool', expect.any(Function));
    });

    it('should return comprehensive tools list', async () => {
      const result = await listToolsHandler({});
      expect(result).toHaveProperty('tools');
      expect(Array.isArray(result.tools)).toBe(true);
      expect(result.tools.length).toBeGreaterThan(20); // We have 20+ tools

      // Check for key tools
      const toolNames = result.tools.map((tool: any) => tool.name);

      // Core API tools
      expect(toolNames).toContain('qlc_health_check');
      expect(toolNames).toContain('qlc_get_functions_number');
      expect(toolNames).toContain('qlc_list_functions');
      expect(toolNames).toContain('qlc_start_function');
      expect(toolNames).toContain('qlc_stop_function');
      expect(toolNames).toContain('qlc_set_channel');
      expect(toolNames).toContain('qlc_list_widgets');
      expect(toolNames).toContain('qlc_set_widget_value');
      expect(toolNames).toContain('qlc_generate_workspace');
      expect(toolNames).toContain('qlc_create_effect_sequence');
    });

    it('should have proper tool schemas', async () => {
      const result = await listToolsHandler({});
      const tools = result.tools;

      // Check a few representative tools have proper schemas
      const healthCheck = tools.find((tool: any) => tool.name === 'qlc_health_check');
      expect(healthCheck).toHaveProperty('description');
      expect(healthCheck).toHaveProperty('inputSchema');
      expect(healthCheck.inputSchema).toHaveProperty('type', 'object');

      const setChannel = tools.find((tool: any) => tool.name === 'qlc_set_channel');
      expect(setChannel.inputSchema).toHaveProperty('properties');
      expect(setChannel.inputSchema.properties).toHaveProperty('universe');
      expect(setChannel.inputSchema.properties).toHaveProperty('channel');
      expect(setChannel.inputSchema.properties).toHaveProperty('value');
      expect(setChannel.inputSchema).toHaveProperty('required');
      expect(setChannel.inputSchema.required).toContain('universe');
      expect(setChannel.inputSchema.required).toContain('channel');
      expect(setChannel.inputSchema.required).toContain('value');
    });
  });

  describe('Tool Handler Execution', () => {
    let callToolHandler: Function;

    beforeEach(() => {
      callToolHandler = toolHandlers.get('call-tool')!;
    });

    describe('Basic Tools', () => {
      it('should handle health check tool', async () => {
        fetchMock.setMockResponse('http://localhost:9999/', { ok: true, status: 200 });

        const request = {
          params: {
            name: 'qlc_health_check',
            arguments: {}
          }
        };

        const result = await callToolHandler(request);
        expect(result).toHaveProperty('content');
        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content[0]).toHaveProperty('type', 'text');
        expect(result.content[0].text).toContain('✅');
      });

      it('should handle health check failure', async () => {
        fetchMock.simulateNetworkError('http://localhost:9999/');

        const request = {
          params: {
            name: 'qlc_health_check',
            arguments: {}
          }
        };

        const result = await callToolHandler(request);
        expect(result.content[0].text).toContain('❌');
      });

      it('should handle list functions tool', async () => {
        const request = {
          params: {
            name: 'qlc_list_functions',
            arguments: {}
          }
        };

        const result = await callToolHandler(request);
        expect(result).toHaveProperty('content');
        expect(result.content[0]).toHaveProperty('type', 'text');
        // Should return JSON string of functions
        expect(() => JSON.parse(result.content[0].text)).not.toThrow();
      });

      it('should handle set channel tool with valid parameters', async () => {
        const request = {
          params: {
            name: 'qlc_set_channel',
            arguments: {
              universe: 0,
              channel: 1,
              value: 255
            }
          }
        };

        const result = await callToolHandler(request);
        expect(result.content[0].text).toContain('✅');
        expect(result.content[0].text).toContain('universe 0');
        expect(result.content[0].text).toContain('channel 1');
      });

      it('should handle function management tools', async () => {
        // Test start function
        const startRequest = {
          params: {
            name: 'qlc_start_function',
            arguments: { name: 'Scene 1' }
          }
        };

        const startResult = await callToolHandler(startRequest);
        expect(startResult.content[0].text).toContain('✅');

        // Test stop function
        const stopRequest = {
          params: {
            name: 'qlc_stop_function',
            arguments: { name: 'Scene 1' }
          }
        };

        const stopResult = await callToolHandler(stopRequest);
        expect(stopResult.content[0].text).toContain('✅');

      });
    });

    describe('Advanced Tools', () => {
      it('should handle cue list control', async () => {
        const request = {
          params: {
            name: 'qlc_cue_list_control',
            arguments: {
              cueListId: 1,
              operation: 'NEXT'
            }
          }
        };

        const result = await callToolHandler(request);
        expect(result.content[0].text).toContain('✅');
      });

      it('should handle cue list go to step', async () => {
        const request = {
          params: {
            name: 'qlc_cue_list_go_to_step',
            arguments: {
              cueListId: 1,
              stepIndex: 5
            }
          }
        };

        const result = await callToolHandler(request);
        expect(result.content[0].text).toContain('✅');
      });

      it('should handle workspace generation', async () => {
        const request = {
          params: {
            name: 'qlc_generate_workspace',
            arguments: {
              fixtures: [
                { name: 'LED 1', manufacturer: 'Generic', model: 'RGB', universe: 0, address: 1, channels: 3 }
              ],
              scenes: [
                { name: 'Red', fixtureId: 0, channels: { 1: 255, 2: 0, 3: 0 } }
              ],
              outputPath: '/tmp/test.qxw'
            }
          }
        };

        const result = await callToolHandler(request);
        expect(result.content[0].text).toContain('✅');
        expect(result.content[0].text).toContain('Workspace generated');
      });

      it('should handle effect sequence creation', async () => {
        const request = {
          params: {
            name: 'qlc_create_effect_sequence',
            arguments: {
              effectType: 'fade',
              universe: 0,
              channels: [1, 2, 3],
              durationMs: 1000,
              fps: 40
            }
          }
        };

        const result = await callToolHandler(request);
        expect(result.content[0].text).toContain('✅');
        expect(result.content[0].text).toContain('Effect completed');
      });
    });




    describe('Widget Operations', () => {
      it('should handle get widgets number', async () => {
        const request = {
          params: {
            name: 'qlc_get_widgets_number',
            arguments: {}
          }
        };

        const result = await callToolHandler(request);
        expect(result.content[0].text).toContain('Total widgets:');
      });

      it('should handle set widget value', async () => {
        const request = {
          params: {
            name: 'qlc_set_widget_value',
            arguments: {
              widgetId: 1,
              value: 128
            }
          }
        };

        const result = await callToolHandler(request);
        expect(result.content[0].text).toContain('✅');
      });
    });

    describe('Unknown Tool Handling', () => {
      it('should handle unknown tool gracefully', async () => {
        const request = {
          params: {
            name: 'unknown_tool',
            arguments: {}
          }
        };

        const result = await callToolHandler(request);
        expect(result.content[0].text).toContain('Unknown');
        expect(result.isError).toBe(true);
      });
    });
  });

  describe('Server Initialization', () => {
    it('should create server with correct configuration', () => {
      const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
      expect(Server).toHaveBeenCalledWith(
        { name: 'qlc-plus-mcp', version: '1.0.0' },
        { capabilities: { tools: {} } }
      );
    });

    it('should connect to transport', () => {
      expect(mockServer.connect).toHaveBeenCalledWith(mockTransport);
    });
  });
});