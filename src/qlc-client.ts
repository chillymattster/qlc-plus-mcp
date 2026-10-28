import WebSocket from 'ws';
import {QLCConfig,QLCResponse,Fixture,Scene,WorkspaceConfig} from './types.js';
import {XMLBuilder} from 'fast-xml-parser';
import FormData from 'form-data';
import {readFileSync,writeFileSync} from 'fs';
import axios from 'axios';

export class QLCClient{
  private config:QLCConfig;
  private ws:WebSocket|null=null;

  constructor(config:QLCConfig){
    this.config=config;
  }

  private async connect():Promise<WebSocket>{
    if(this.ws?.readyState===WebSocket.OPEN)return this.ws;
    return new Promise((resolve,reject)=>{
      this.ws=new WebSocket(`ws://${this.config.host}:${this.config.port}/qlcplusWS`);
      this.ws.on('open',()=>resolve(this.ws!));
      this.ws.on('error',reject);
      setTimeout(()=>reject(new Error('Timeout')),5000);
    });
  }

  async healthCheck():Promise<boolean>{
    try{
      const response=await fetch(`http://${this.config.host}:${this.config.port}/`);
      return response.ok;
    }catch{return false}
  }

  private async send<T>(command:string):Promise<QLCResponse<T>>{
    try{
      const ws=await this.connect();
      return new Promise((resolve)=>{
        const timeout = setTimeout(() => {
          resolve({ success: false, error: 'Response timeout' });
        }, 5000);

        ws.on('message',(data)=>{
          clearTimeout(timeout);
          const response = data.toString();
          const parsed = this.parseQLCResponse<T>(response);
          resolve(parsed);
        });
        ws.send(command);
      });
    }catch(e:any){return{success:false,error:e.message}}
  }

  private parseQLCResponse<T>(response: string): QLCResponse<T> {
    // Handle empty response
    if (!response || response.trim() === '') {
      return { success: true, data: [] as unknown as T };
    }

    // Handle HTML responses (QLC+ sometimes returns HTML)
    if (response.includes('<html>') || response.includes('<!DOCTYPE')) {
      return { success: true, data: [] as unknown as T };
    }

    // Handle "OK" responses from commands
    if (response.trim() === 'OK') {
      return { success: true };
    }

    // Parse pipe-delimited QLC+ responses
    // Format: "QLC+API|commandName|param1|param2|..."
    const parts = response.split('|');

    if (parts[0] === 'QLC+API') {
      // Remove the QLC+API prefix
      const commandName = parts[1];
      const data = parts.slice(2);

      return { success: true, data: data as unknown as T };
    }

    // If not a QLC+API response, return raw parts
    return { success: true, data: parts as unknown as T };
  }

  // ============================================================================
  // OFFICIALLY SUPPORTED WEBSOCKET APIs
  // ============================================================================

  // ------------- Functions API (Standard) -------------

  async getFunctionsNumber(): Promise<QLCResponse<number>> {
    const result = await this.send<string[]>('QLC+API|getFunctionsNumber');
    if (result.success && result.data && result.data.length > 0) {
      return { success: true, data: parseInt(result.data[0]) };
    }
    return { success: false, error: 'Failed to get functions number' };
  }

  async getFunctionsList(): Promise<QLCResponse<Array<{id: number, name: string}>>> {
    const result = await this.send<string[]>('QLC+API|getFunctionsList');
    if (result.success && result.data) {
      // Response format: ID|Name|ID|Name|...
      const functions: Array<{id: number, name: string}> = [];
      for (let i = 0; i < result.data.length; i += 2) {
        if (i + 1 < result.data.length) {
          functions.push({
            id: parseInt(result.data[i]),
            name: result.data[i + 1]
          });
        }
      }
      return { success: true, data: functions };
    }
    return { success: false, error: 'Failed to get functions list' };
  }

  async getFunctionType(functionId: number): Promise<QLCResponse<string>> {
    const result = await this.send<string[]>(`QLC+API|getFunctionType|${functionId}`);
    if (result.success && result.data && result.data.length > 0) {
      return { success: true, data: result.data[0] };
    }
    return { success: false, error: 'Failed to get function type' };
  }

  async getFunctionStatus(functionId: number): Promise<QLCResponse<string>> {
    const result = await this.send<string[]>(`QLC+API|getFunctionStatus|${functionId}`);
    if (result.success && result.data && result.data.length > 0) {
      // Response: "Running", "Stopped", or "Undefined"
      return { success: true, data: result.data[0] };
    }
    return { success: false, error: 'Failed to get function status' };
  }

  async setFunctionStatus(functionId: number, status: 0 | 1): Promise<QLCResponse> {
    const result = await this.send(`QLC+API|setFunctionStatus|${functionId}|${status}`);
    return result;
  }

  // ------------- Widgets API (Standard) -------------

  async getWidgetsNumber(): Promise<QLCResponse<number>> {
    const result = await this.send<string[]>('QLC+API|getWidgetsNumber');
    if (result.success && result.data && result.data.length > 0) {
      return { success: true, data: parseInt(result.data[0]) };
    }
    return { success: false, error: 'Failed to get widgets number' };
  }

  async getWidgetsList(): Promise<QLCResponse<Array<{id: number, name: string}>>> {
    const result = await this.send<string[]>('QLC+API|getWidgetsList');
    if (result.success && result.data) {
      // Response format: ID|Name|ID|Name|...
      const widgets: Array<{id: number, name: string}> = [];
      for (let i = 0; i < result.data.length; i += 2) {
        if (i + 1 < result.data.length) {
          widgets.push({
            id: parseInt(result.data[i]),
            name: result.data[i + 1]
          });
        }
      }
      return { success: true, data: widgets };
    }
    return { success: false, error: 'Failed to get widgets list' };
  }

  async getWidgetType(widgetId: number): Promise<QLCResponse<string>> {
    const result = await this.send<string[]>(`QLC+API|getWidgetType|${widgetId}`);
    if (result.success && result.data && result.data.length > 1) {
      // Response format: widgetId|type
      return { success: true, data: result.data[1] };
    }
    return { success: false, error: 'Failed to get widget type' };
  }

  async getWidgetStatus(widgetId: number): Promise<QLCResponse<{status: string, step?: number}>> {
    const result = await this.send<string[]>(`QLC+API|getWidgetStatus|${widgetId}`);
    if (result.success && result.data && result.data.length > 1) {
      // Response format: widgetId|status or widgetId|PLAY|step
      if (result.data[1] === 'PLAY' && result.data.length > 2) {
        return {
          success: true,
          data: {
            status: 'PLAY',
            step: parseInt(result.data[2])
          }
        };
      }
      return { success: true, data: { status: result.data[1] } };
    }
    return { success: false, error: 'Failed to get widget status' };
  }

  async getWidgetSubIdList(widgetId: number): Promise<QLCResponse<Array<{id: number, type: string}>>> {
    const result = await this.send<string[]>(`QLC+API|getWidgetSubIdList|${widgetId}`);
    if (result.success && result.data) {
      // Response format: ID|Type|ID|Type|...
      const subWidgets: Array<{id: number, type: string}> = [];
      for (let i = 0; i < result.data.length; i += 2) {
        if (i + 1 < result.data.length) {
          subWidgets.push({
            id: parseInt(result.data[i]),
            type: result.data[i + 1]
          });
        }
      }
      return { success: true, data: subWidgets };
    }
    return { success: false, error: 'Failed to get widget sub-ID list' };
  }

  // ------------- Channels API (Standard) -------------

  // Universes are 1-based everywhere, matching the QLC+ UI and its web API
  private universeError(universe: number): string | null {
    return Number.isInteger(universe) && universe >= 1
      ? null
      : `Invalid universe ${universe} (universes are numbered from 1)`;
  }

  // Convert universe + channel to absolute DMX address for the CH| API
  // Universe 1: addresses 1-512
  // Universe 2: addresses 513-1024
  // etc.
  private toAbsoluteAddress(universe: number, channel: number): number {
    return ((universe - 1) * 512) + channel;
  }

  async getChannelsValues(universe: number, startAddress: number, count: number): Promise<QLCResponse<Array<{index: number, value: number, type: string}>>> {
    const universeError = this.universeError(universe);
    if (universeError) {
      return { success: false, error: universeError };
    }

    const result = await this.send<string[]>(`QLC+API|getChannelsValues|${universe}|${startAddress}|${count}`);
    if (result.success && result.data) {
      // Response format: QLC+ 4 sends Index|Value|Type per channel,
      // QLC+ 5 appends a fourth field (Index|Value|Type|X). Detect the record
      // width from where the second channel index sits.
      const stride = parseInt(result.data[3]) === parseInt(result.data[0]) + 1 ? 3 : 4;
      const channels: Array<{index: number, value: number, type: string}> = [];
      for (let i = 0; i < result.data.length; i += stride) {
        if (i + 2 < result.data.length) {
          channels.push({
            index: parseInt(result.data[i]),
            value: parseInt(result.data[i + 1]),
            type: result.data[i + 2]
          });
        }
      }
      return { success: true, data: channels };
    }
    return { success: false, error: 'Failed to get channel values' };
  }

  // ============================================================================
  // HIGH-RATE APIs (No QLC+API prefix)
  // ============================================================================

  // ------------- Simple Desk Channel Set -------------

  async setChannelValue(universe: number, channel: number, value: number): Promise<QLCResponse> {
    if (value < 0 || value > 255) {
      return { success: false, error: 'Value must be 0-255' };
    }

    const universeError = this.universeError(universe);
    if (universeError) {
      return { success: false, error: universeError };
    }

    const absoluteAddress = this.toAbsoluteAddress(universe, channel);

    try {
      const ws = await this.connect();
      // High-rate API: CH|absoluteAddress|value (no QLC+API prefix)
      ws.send(`CH|${absoluteAddress}|${value}`);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  // ------------- Basic Widget Value Set -------------

  async setWidgetValue(widgetId: number, value: number): Promise<QLCResponse> {
    if (value < 0 || value > 255) {
      return { success: false, error: 'Value must be 0-255' };
    }

    try {
      const ws = await this.connect();
      // High-rate API: widgetId|value (no QLC+API prefix)
      ws.send(`${widgetId}|${value}`);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  // ------------- Cue List Control -------------

  async cueListControl(cueListId: number, operation: 'PLAY' | 'NEXT' | 'PREV'): Promise<QLCResponse> {
    try {
      const ws = await this.connect();
      // High-rate API: cueListId|operation (no QLC+API prefix)
      ws.send(`${cueListId}|${operation}`);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async cueListGoToStep(cueListId: number, stepIndex: number): Promise<QLCResponse> {
    try {
      const ws = await this.connect();
      // High-rate API: cueListId|STEP|stepIndex (no QLC+API prefix)
      ws.send(`${cueListId}|STEP|${stepIndex}`);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  // ------------- Multipage Frame Control -------------

  async frameControl(frameId: number, operation: 'NEXT_PG' | 'PREV_PG'): Promise<QLCResponse> {
    try {
      const ws = await this.connect();
      // High-rate API: frameId|operation (no QLC+API prefix)
      ws.send(`${frameId}|${operation}`);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  // ------------- Animation Widget Control -------------

  async animationControl(animationId: number, controlId: number): Promise<QLCResponse> {
    try {
      const ws = await this.connect();
      // High-rate API: animationId|MATRIX_PUSHBUTTON|controlId (no QLC+API prefix)
      ws.send(`${animationId}|MATRIX_PUSHBUTTON|${controlId}`);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  async getFunctionByName(name: string): Promise<QLCResponse<{id: number, name: string}>> {
    const result = await this.getFunctionsList();
    if (result.success && result.data) {
      const func = result.data.find(f => f.name === name);
      if (func) {
        return { success: true, data: func };
      }
      return { success: false, error: `Function "${name}" not found` };
    }
    return { success: false, error: 'Failed to search for function' };
  }

  async getWidgetByName(name: string): Promise<QLCResponse<{id: number, name: string}>> {
    const result = await this.getWidgetsList();
    if (result.success && result.data) {
      const widget = result.data.find(w => w.name === name);
      if (widget) {
        return { success: true, data: widget };
      }
      return { success: false, error: `Widget "${name}" not found` };
    }
    return { success: false, error: 'Failed to search for widget' };
  }

  async getUniverseSnapshot(universe: number): Promise<QLCResponse<Array<{index: number, value: number, type: string}>>> {
    // Get all 512 channels for the universe
    return this.getChannelsValues(universe, 1, 512);
  }

  async setMultipleChannels(universe: number, channels: Record<number, number>): Promise<QLCResponse> {
    const universeError = this.universeError(universe);
    if (universeError) {
      return { success: false, error: universeError };
    }

    try {
      const ws = await this.connect();

      for (const [channel, value] of Object.entries(channels)) {
        const ch = parseInt(channel);
        const val = parseInt(value as any);

        if (val < 0 || val > 255) {
          return { success: false, error: `Invalid value ${val} for channel ${ch}` };
        }

        const absoluteAddress = this.toAbsoluteAddress(universe, ch);
        ws.send(`CH|${absoluteAddress}|${val}`);
      }

      return { success: true, data: { channelsSet: Object.keys(channels).length } };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  // ============================================================================
  // WORKSPACE GENERATION & EFFECT SEQUENCING
  // ============================================================================

  /**
   * Generate a QLC+ workspace XML file
   */
  generateWorkspace(config: WorkspaceConfig): string {
    // Tool input is 1-based like the QLC+ UI (universe 1, address 1-512,
    // fixture channel 1..n); the .qxw file stores all of them 0-based
    config.fixtures.forEach((f) => {
      const universeError = this.universeError(f.universe);
      if (universeError) {
        throw new Error(`Fixture "${f.name}": ${universeError}`);
      }
      if (!Number.isInteger(f.address) || f.address < 1 || f.address + f.channels - 1 > 512) {
        throw new Error(`Fixture "${f.name}": address ${f.address} invalid (addresses are 1-512)`);
      }
    });
    config.scenes.forEach((s) => {
      const fixture = config.fixtures[s.fixtureId];
      Object.keys(s.channels).forEach((ch) => {
        const channel = parseInt(ch);
        if (!(channel >= 1 && (!fixture || channel <= fixture.channels))) {
          throw new Error(`Scene "${s.name}": channel ${ch} invalid (fixture channels are numbered from 1)`);
        }
      });
    });

    // Build functions array: scenes first, then chasers
    const functions: any[] = [];

    // Add scene functions (IDs 0 to scenes.length - 1)
    config.scenes.forEach((s, idx) => {
      functions.push({
        '@ID': idx.toString(),
        '@Type': 'Scene',
        '@Name': s.name,
        Speed: {
          '@FadeIn': (s.fadeIn || 0).toString(),
          '@FadeOut': (s.fadeOut || 0).toString(),
          '@Duration': '0'
        },
        FixtureVal: Object.entries(s.channels).map(([ch, val]) => ({
          '@ID': s.fixtureId.toString(),
          '#text': `${parseInt(ch) - 1},${val}`
        }))
      });
    });

    // Add chaser functions (IDs starting from scenes.length)
    if (config.chasers && config.chasers.length > 0) {
      const sceneCount = config.scenes.length;

      config.chasers.forEach((chaser, chaserIdx) => {
        const chaserId = sceneCount + chaserIdx;

        functions.push({
          '@ID': chaserId.toString(),
          '@Type': 'Chaser',
          '@Name': chaser.name,
          Speed: {
            '@FadeIn': '0',
            '@FadeOut': '0',
            '@Duration': '0'
          },
          Direction: chaser.direction || 'Forward',
          RunOrder: chaser.runOrder || 'Loop',
          SpeedModes: {
            '@FadeIn': 'Common',
            '@FadeOut': 'Common',
            '@Duration': 'PerStep'
          },
          Step: chaser.steps.map((step, stepIdx) => ({
            '@Number': stepIdx.toString(),
            '@FadeIn': (step.fadeIn || 0).toString(),
            '@Hold': step.hold.toString(),
            '@FadeOut': (step.fadeOut || 0).toString(),
            '#text': step.sceneIndex.toString()
          }))
        });
      });
    }

    const workspace = {
      '?xml': {
        '@version': '1.0',
        '@encoding': 'UTF-8'
      },
      Workspace: {
        '@xmlns': 'http://www.qlcplus.org/Workspace',
        '@CurrentWindow': 'VirtualConsole',
        Creator: {
          Name: 'Q Light Controller Plus',
          Version: '4.12.0',
          Author: 'MCP Server'
        },
        Engine: {
          InputOutputMap: {
            Universe: {
              '@Name': 'Universe 1',
              '@ID': '0',
              '@Passthrough': 'False'
            }
          },
          Fixture: config.fixtures.map((f, idx) => ({
            Manufacturer: f.manufacturer,
            Model: f.model,
            Mode: `${f.channels} Channel`,
            ID: idx.toString(),
            Name: f.name,
            Universe: (f.universe - 1).toString(),
            Address: (f.address - 1).toString(),
            Channels: f.channels.toString()
          })),
          Function: functions
        },
        VirtualConsole: {
          Frame: {
            '@Caption': ''
          }
        },
        SimpleDesk: {}
      }
    };

    const builder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: '@',
      format: true,
      indentBy: '  ',
      suppressEmptyNode: true
    });

    let xml = builder.build(workspace);

    // Add DOCTYPE manually since fast-xml-parser doesn't support it properly
    xml = xml.replace('<?xml version="1.0" encoding="UTF-8"?>',
                      '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE Workspace>');

    return xml;
  }

  /**
   * Save workspace XML to file
   */
  saveWorkspace(xml: string, filePath: string): QLCResponse {
    try {
      writeFileSync(filePath, xml, 'utf-8');
      return { success: true, data: { path: filePath } };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Reload workspace file into QLC+ via HTTP POST
   */
  async reloadWorkspace(filePath: string): Promise<QLCResponse> {
    try {
      const fileContent = readFileSync(filePath);
      const form = new FormData();
      form.append('qlcprj', fileContent, {
        filename: 'workspace.qxw',
        contentType: 'application/xml'
      });

      const response = await axios.post(
        `http://${this.config.host}:${this.config.port}/loadProject`,
        form,
        {
          headers: {
            ...form.getHeaders()
          },
          timeout: 10000
        }
      );

      if (response.status !== 200) {
        return {
          success: false,
          error: `Failed to reload workspace: HTTP ${response.status}`
        };
      }

      // Wait briefly for QLC+ to process the workspace
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify the workspace actually loaded
      const functionsResult = await this.getFunctionsNumber();
      const functionsCount = functionsResult.success ? functionsResult.data : 0;

      if (functionsCount === 0) {
        return {
          success: false,
          error: 'Workspace uploaded but QLC+ loaded 0 functions. The XML may be invalid or QLC+ cannot parse it.'
        };
      }

      return {
        success: true,
        data: {
          message: 'Workspace reloaded successfully',
          functionsLoaded: functionsCount
        }
      };
    } catch (e: any) {
      return {
        success: false,
        error: `Failed to reload workspace: ${e.message}`
      };
    }
  }

  /**
   * Create a timed effect sequence
   */
  async createEffectSequence(
    effectType: 'fade' | 'strobe' | 'chase' | 'color_wash',
    universe: number,
    channels: number[],
    durationMs: number,
    fps: number = 40
  ): Promise<QLCResponse> {
    const universeError = this.universeError(universe);
    if (universeError) {
      return { success: false, error: universeError };
    }

    try {
      const ws = await this.connect();
      const frameTime = 1000 / fps;
      const totalFrames = Math.floor(durationMs / frameTime);

      const frames = this.generateEffectFrames(effectType, channels, totalFrames);

      // Send frames with precise timing
      for (let frame = 0; frame < frames.length; frame++) {
        const channelValues = frames[frame];

        for (const [ch, val] of Object.entries(channelValues)) {
          const absoluteAddr = this.toAbsoluteAddress(universe, parseInt(ch));
          ws.send(`CH|${absoluteAddr}|${val}`);
        }

        // Wait for next frame
        await new Promise(resolve => setTimeout(resolve, frameTime));
      }

      return {
        success: true,
        data: {
          framesRendered: frames.length,
          effectType,
          durationMs: frames.length * frameTime
        }
      };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Generate effect frames based on effect type
   */
  private generateEffectFrames(
    effectType: string,
    channels: number[],
    totalFrames: number
  ): Record<number, number>[] {
    const frames: Record<number, number>[] = [];

    switch (effectType) {
      case 'strobe':
        // Alternating on/off at maximum rate
        for (let f = 0; f < totalFrames; f++) {
          const on = f % 2 === 0;
          const frame: Record<number, number> = {};
          channels.forEach(ch => frame[ch] = on ? 255 : 0);
          frames.push(frame);
        }
        break;

      case 'fade':
        // Linear fade from 0 to 255
        for (let f = 0; f < totalFrames; f++) {
          const progress = f / (totalFrames - 1);
          const value = Math.floor(255 * progress);
          const frame: Record<number, number> = {};
          channels.forEach(ch => frame[ch] = value);
          frames.push(frame);
        }
        break;

      case 'chase':
        // Sequential activation of channels
        for (let f = 0; f < totalFrames; f++) {
          const activeIdx = Math.floor((f / totalFrames) * channels.length) % channels.length;
          const frame: Record<number, number> = {};
          channels.forEach((ch, idx) => {
            frame[ch] = idx === activeIdx ? 255 : 0;
          });
          frames.push(frame);
        }
        break;

      case 'color_wash':
        // Rainbow cycle through RGB values
        for (let f = 0; f < totalFrames; f++) {
          const hue = (f / totalFrames) * 360;
          const rgb = this.hsvToRgb(hue, 1.0, 1.0);
          const frame: Record<number, number> = {};

          // Assume channels are RGB triplets
          for (let i = 0; i < channels.length; i += 3) {
            if (i + 2 < channels.length) {
              frame[channels[i]] = rgb[0];
              frame[channels[i + 1]] = rgb[1];
              frame[channels[i + 2]] = rgb[2];
            }
          }
          frames.push(frame);
        }
        break;
    }

    return frames;
  }

  /**
   * Convert HSV to RGB (helper for color effects)
   */
  private hsvToRgb(h: number, s: number, v: number): [number, number, number] {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;

    let r = 0, g = 0, b = 0;

    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }

    return [
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255)
    ];
  }
}
