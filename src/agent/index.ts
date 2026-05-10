import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import * as readline from 'readline';
import dotenv from 'dotenv';
import { MCPClient } from './client.js';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error('Error: GEMINI_API_KEY is not set in environment variables.');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

// Map MCP JSON Schema types to Gemini Schema types
function mapType(type: string): SchemaType {
    switch (type) {
        case 'string': return SchemaType.STRING;
        case 'number': return SchemaType.NUMBER;
        case 'integer': return SchemaType.NUMBER;
        case 'boolean': return SchemaType.BOOLEAN;
        case 'array': return SchemaType.ARRAY;
        case 'object': return SchemaType.OBJECT;
        default: return SchemaType.STRING;
    }
}

// Helper to convert MCP tool schema to Gemini function declaration
function convertToolToGemini(tool: any): any {
    const properties: any = {};
    const required: string[] = tool.inputSchema.required || [];

    if (tool.inputSchema.properties) {
        for (const [key, value] of Object.entries(tool.inputSchema.properties) as [string, any][]) {
            properties[key] = {
                type: mapType(value.type),
                description: value.description,
            };
            if (value.type === 'array' && value.items) {
                properties[key].items = {
                    type: mapType(value.items.type),
                    properties: value.items.properties ? convertProperties(value.items.properties) : undefined
                }
            }
            if (value.type === 'object' && value.properties) {
                properties[key].properties = convertProperties(value.properties);
            }
        }
    }

    return {
        name: tool.name,
        description: tool.description,
        parameters: {
            type: SchemaType.OBJECT,
            properties: properties,
            required: required,
        },
    };
}

function convertProperties(props: any): any {
    const converted: any = {};
    for (const [key, value] of Object.entries(props) as [string, any][]) {
        converted[key] = {
            type: mapType(value.type),
            description: value.description
        };
        if (value.type === 'array' && value.items) {
            converted[key].items = {
                type: mapType(value.items.type),
                properties: value.items.properties ? convertProperties(value.items.properties) : undefined
            }
        }
        if (value.type === 'object' && value.properties) {
            converted[key].properties = convertProperties(value.properties);
        }
    }
    return converted;
}


async function main() {
    const mcpClient = new MCPClient();

    try {
        console.log('Connecting to MCP server...');
        await mcpClient.connect();
        console.log('Connected!');

        const toolsList = await mcpClient.listTools();
        const geminiTools = toolsList.tools.map(convertToolToGemini);

        const model = genAI.getGenerativeModel({
            model: 'gemini-1.5-pro-latest',
            tools: [{ functionDeclarations: geminiTools }],
        });

        const chat = model.startChat();

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        console.log('\n💡 QLC+ Agent Ready! Type your command (or "exit" to quit).');
        console.log('------------------------------------------------------------');

        const askQuestion = () => {
            rl.question('> ', async (userInput) => {
                if (userInput.toLowerCase() === 'exit') {
                    rl.close();
                    await mcpClient.close();
                    return;
                }

                try {
                    let result = await chat.sendMessage(userInput);
                    let response = result.response;
                    let functionCalls = response.functionCalls();

                    while (functionCalls && functionCalls.length > 0) {
                        for (const call of functionCalls) {
                            console.log(`🛠️  Calling tool: ${call.name}`);
                            // Extract text content from tool result
                            let toolOutput = '';
                            try {
                                const toolResult = await mcpClient.callTool(call.name, call.args);
                                if (toolResult.content && Array.isArray(toolResult.content)) {
                                    toolOutput = toolResult.content.map(c => c.type === 'text' ? c.text : '').join('\n');
                                } else {
                                    toolOutput = JSON.stringify(toolResult);
                                }

                                // Send result back to model
                                result = await chat.sendMessage([{
                                    functionResponse: {
                                        name: call.name,
                                        response: { content: toolOutput }
                                    }
                                }]);
                            } catch (err: any) {
                                console.error(`❌ Tool error: ${err.message}`);
                                result = await chat.sendMessage([{
                                    functionResponse: {
                                        name: call.name,
                                        response: { error: err.message }
                                    }
                                }]);
                            }
                        }
                        response = result.response;
                        functionCalls = response.functionCalls();
                    }

                    console.log(`🤖 ${response.text()}`);

                } catch (error: any) {
                    console.error('Error:', error.message);
                }

                askQuestion();
            });
        };

        askQuestion();

    } catch (error) {
        console.error('Initialization error:', error);
        await mcpClient.close();
    }
}

main();
