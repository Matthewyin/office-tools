import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { callTool, listTools } from './tools.js';

export async function handleMcpRequest(request, response, config) {
  const mcpServer = createMcpServer(config);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  try {
    await mcpServer.connect(transport);
    await transport.handleRequest(request, response);
  } finally {
    await mcpServer.close();
  }
}

export function createMcpServer(config) {
  const server = new McpServer({
    name: 'office-agent-server',
    version: '0.1.0',
  });

  for (const tool of listTools()) {
    server.registerTool(tool.name, {
      title: tool.name,
      description: tool.description,
      inputSchema: createToolInputSchema(tool.name),
    }, async (input) => {
      try {
        const result = await callTool(tool.name, input || {}, config, {
          host: input?.host,
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result.output, null, 2),
          }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{
            type: 'text',
            text: error.message || `工具执行失败：${tool.name}`,
          }],
        };
      }
    });
  }

  return server;
}

function createToolInputSchema(name) {
  if (name === 'web_search' || name === 'search') {
    return z.object({
      query: z.string().min(1),
      maxResults: z.number().optional(),
      topic: z.enum(['general', 'news', 'finance']).optional(),
      searchDepth: z.enum(['basic', 'advanced']).optional(),
      includeAnswer: z.union([z.boolean(), z.enum(['basic', 'advanced'])]).optional(),
      host: z.string().optional(),
    });
  }

  if (name === 'fetch_url') {
    return z.object({
      url: z.string().url(),
      maxChars: z.number().optional(),
      host: z.string().optional(),
    });
  }

  if (name === 'document_search') {
    return z.object({
      text: z.string().min(1),
      query: z.string().min(1),
      limit: z.number().optional(),
      mode: z.enum(['auto', 'keyword']).optional(),
      profileId: z.string().optional(),
      model: z.string().optional(),
      host: z.string().optional(),
    });
  }

  return z.object({}).passthrough();
}
