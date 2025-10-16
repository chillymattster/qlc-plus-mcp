export interface QLCWidget {
  id: number;
  name: string;
  type: string;
}

export interface QLCFunction {
  id: number;
  name: string;
  type: string;
}

export interface QLCConfig {
  host: string;
  port: number;
  apiKey?: string;
}

export interface QLCResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface Fixture {
  name: string;
  manufacturer: string;
  model: string;
  universe: number;
  address: number;
  channels: number;
}

export interface Scene {
  name: string;
  fixtureId: number;
  channels: Record<number, number>;
  fadeIn?: number;
  fadeOut?: number;
}

export interface WorkspaceConfig {
  fixtures: Fixture[];
  scenes: Scene[];
}
