import { describe, it, expect } from '@jest/globals';
import { QLCWidget, QLCFunction, QLCConfig, QLCResponse } from '../../src/types.js';

describe('Type Definitions', () => {
  describe('QLCWidget', () => {
    it('should define widget structure correctly', () => {
      const widget: QLCWidget = {
        id: 1,
        name: 'Test Button',
        type: 'Button'
      };

      expect(widget).toHaveProperty('id');
      expect(widget).toHaveProperty('name');
      expect(widget).toHaveProperty('type');
      expect(typeof widget.id).toBe('number');
      expect(typeof widget.name).toBe('string');
      expect(typeof widget.type).toBe('string');
    });

    it('should accept different widget types', () => {
      const button: QLCWidget = { id: 1, name: 'Button', type: 'Button' };
      const slider: QLCWidget = { id: 2, name: 'Slider', type: 'Slider' };
      const speedDial: QLCWidget = { id: 3, name: 'Speed', type: 'SpeedDial' };

      expect(button.type).toBe('Button');
      expect(slider.type).toBe('Slider');
      expect(speedDial.type).toBe('SpeedDial');
    });
  });

  describe('QLCFunction', () => {
    it('should define function structure correctly', () => {
      const func: QLCFunction = {
        id: 1,
        name: 'Main Scene',
        type: 'Scene'
      };

      expect(func).toHaveProperty('id');
      expect(func).toHaveProperty('name');
      expect(func).toHaveProperty('type');
      expect(typeof func.id).toBe('number');
      expect(typeof func.name).toBe('string');
      expect(typeof func.type).toBe('string');
    });

    it('should accept different function types', () => {
      const scene: QLCFunction = { id: 1, name: 'Scene 1', type: 'Scene' };
      const chaser: QLCFunction = { id: 2, name: 'Chase 1', type: 'Chaser' };
      const sequence: QLCFunction = { id: 3, name: 'Sequence 1', type: 'Sequence' };
      const efx: QLCFunction = { id: 4, name: 'Effect 1', type: 'EFX' };

      expect(scene.type).toBe('Scene');
      expect(chaser.type).toBe('Chaser');
      expect(sequence.type).toBe('Sequence');
      expect(efx.type).toBe('EFX');
    });
  });

  describe('QLCConfig', () => {
    it('should define minimal config correctly', () => {
      const config: QLCConfig = {
        host: 'localhost',
        port: 9999
      };

      expect(config).toHaveProperty('host');
      expect(config).toHaveProperty('port');
      expect(typeof config.host).toBe('string');
      expect(typeof config.port).toBe('number');
      expect(config.apiKey).toBeUndefined();
    });

    it('should define config with API key', () => {
      const config: QLCConfig = {
        host: '192.168.1.100',
        port: 8080,
        apiKey: 'secret-api-key'
      };

      expect(config).toHaveProperty('host');
      expect(config).toHaveProperty('port');
      expect(config).toHaveProperty('apiKey');
      expect(typeof config.host).toBe('string');
      expect(typeof config.port).toBe('number');
      expect(typeof config.apiKey).toBe('string');
    });

    it('should accept different host formats', () => {
      const localhostConfig: QLCConfig = { host: 'localhost', port: 9999 };
      const ipConfig: QLCConfig = { host: '192.168.1.100', port: 9999 };
      const domainConfig: QLCConfig = { host: 'qlc.example.com', port: 80 };

      expect(localhostConfig.host).toBe('localhost');
      expect(ipConfig.host).toBe('192.168.1.100');
      expect(domainConfig.host).toBe('qlc.example.com');
    });

    it('should accept different port numbers', () => {
      const defaultConfig: QLCConfig = { host: 'localhost', port: 9999 };
      const customConfig: QLCConfig = { host: 'localhost', port: 8080 };
      const httpConfig: QLCConfig = { host: 'localhost', port: 80 };

      expect(defaultConfig.port).toBe(9999);
      expect(customConfig.port).toBe(8080);
      expect(httpConfig.port).toBe(80);
    });
  });

  describe('QLCResponse', () => {
    it('should define successful response without data', () => {
      const response: QLCResponse = {
        success: true
      };

      expect(response).toHaveProperty('success');
      expect(response.success).toBe(true);
      expect(response.data).toBeUndefined();
      expect(response.error).toBeUndefined();
    });

    it('should define successful response with data', () => {
      const response: QLCResponse<string[]> = {
        success: true,
        data: ['item1', 'item2', 'item3']
      };

      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('data');
      expect(response.success).toBe(true);
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data).toHaveLength(3);
      expect(response.error).toBeUndefined();
    });

    it('should define error response', () => {
      const response: QLCResponse = {
        success: false,
        error: 'Connection failed'
      };

      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('error');
      expect(response.success).toBe(false);
      expect(response.error).toBe('Connection failed');
      expect(response.data).toBeUndefined();
    });

    it('should accept different data types', () => {
      const stringResponse: QLCResponse<string> = {
        success: true,
        data: 'test string'
      };

      const numberResponse: QLCResponse<number> = {
        success: true,
        data: 42
      };

      const objectResponse: QLCResponse<{ id: number; name: string }> = {
        success: true,
        data: { id: 1, name: 'test' }
      };

      const arrayResponse: QLCResponse<QLCFunction[]> = {
        success: true,
        data: [
          { id: 1, name: 'Scene 1', type: 'Scene' },
          { id: 2, name: 'Chase 1', type: 'Chaser' }
        ]
      };

      expect(typeof stringResponse.data).toBe('string');
      expect(typeof numberResponse.data).toBe('number');
      expect(typeof objectResponse.data).toBe('object');
      expect(Array.isArray(arrayResponse.data)).toBe(true);
    });

    it('should define complex response structures', () => {
      interface WorkspaceInfo {
        connected: boolean;
        fixtures: number;
        functions: number;
        widgets: number;
        timestamp: string;
      }

      const workspaceResponse: QLCResponse<WorkspaceInfo> = {
        success: true,
        data: {
          connected: true,
          fixtures: 10,
          functions: 25,
          widgets: 15,
          timestamp: '2024-01-01T00:00:00Z'
        }
      };

      expect(workspaceResponse.success).toBe(true);
      expect(workspaceResponse.data?.connected).toBe(true);
      expect(workspaceResponse.data?.fixtures).toBe(10);
      expect(workspaceResponse.data?.functions).toBe(25);
      expect(workspaceResponse.data?.widgets).toBe(15);
      expect(workspaceResponse.data?.timestamp).toBe('2024-01-01T00:00:00Z');
    });
  });

  describe('Type Compatibility', () => {
    it('should work with generic response types', () => {
      function createSuccessResponse<T>(data: T): QLCResponse<T> {
        return { success: true, data };
      }

      function createErrorResponse(error: string): QLCResponse {
        return { success: false, error };
      }

      const fixtures: QLCFunction[] = [
        { id: 1, name: 'Scene 1', type: 'Scene' }
      ];

      const successResponse = createSuccessResponse(fixtures);
      const errorResponse = createErrorResponse('Network error');

      expect(successResponse.success).toBe(true);
      expect(successResponse.data).toEqual(fixtures);
      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toBe('Network error');
    });

    it('should handle optional properties correctly', () => {
      // Test that optional properties work as expected
      const minimalConfig: QLCConfig = {
        host: 'localhost',
        port: 9999
        // apiKey is optional
      };

      const fullConfig: QLCConfig = {
        host: 'localhost',
        port: 9999,
        apiKey: 'api-key-123'
      };

      expect(minimalConfig.apiKey).toBeUndefined();
      expect(fullConfig.apiKey).toBe('api-key-123');
    });

    it('should work with array types', () => {
      const widgets: QLCWidget[] = [
        { id: 1, name: 'Button 1', type: 'Button' },
        { id: 2, name: 'Slider 1', type: 'Slider' }
      ];

      const functions: QLCFunction[] = [
        { id: 1, name: 'Scene 1', type: 'Scene' },
        { id: 2, name: 'Chase 1', type: 'Chaser' }
      ];

      const widgetResponse: QLCResponse<QLCWidget[]> = {
        success: true,
        data: widgets
      };

      const functionResponse: QLCResponse<QLCFunction[]> = {
        success: true,
        data: functions
      };

      expect(Array.isArray(widgetResponse.data)).toBe(true);
      expect(Array.isArray(functionResponse.data)).toBe(true);
      expect(widgetResponse.data).toHaveLength(2);
      expect(functionResponse.data).toHaveLength(2);
    });
  });
});