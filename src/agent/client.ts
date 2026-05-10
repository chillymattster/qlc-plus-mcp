import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ListToolsResult, CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export class MCPClient {
    private client: Client;
    private transport: StdioClientTransport;

    constructor() {
        this.transport = new StdioClientTransport({
            command: 'node',
            args: ['dist/index.js']
        });

        this.client = new Client(
            {
                name: 'qlc-agent-client',
                version: '1.0.0',
            },
            {
                capabilities: {},
            }
        );
    }

    async connect() {
        await this.client.connect(this.transport);
    }

    async listTools(): Promise<ListToolsResult> {
        return await this.client.listTools();
    }

    async callTool(name: string, args: any): Promise<CallToolResult> {
        return (await this.client.callTool({
            name,
            arguments: args,
        })) as unknown as CallToolResult;
    }

    async close() {
        await this.client.close();
    }
}
