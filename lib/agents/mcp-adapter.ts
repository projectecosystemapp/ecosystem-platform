/**
 * MCP-Agent Bridge Adapter
 * 
 * Connects MCP servers to the agent orchestration system,
 * enabling agents to leverage MCP capabilities for task execution.
 */

import { AgentCapability, Task, TaskStatus } from './types';

/**
 * MCP Server capabilities mapped to agent capabilities
 */
export const MCP_CAPABILITY_MAP = {
  // Sequential thinking for planning and decision making
  'seq-thinking': [AgentCapability.PLANNING, AgentCapability.DECISION_MAKING],
  
  // Filesystem for file operations
  'filesystem': [AgentCapability.FILE_OPERATIONS, AgentCapability.CODE_GENERATION],
  
  // Memory for context and knowledge management
  'memory': [AgentCapability.DATA_ANALYSIS, AgentCapability.KNOWLEDGE_MANAGEMENT],
  
  // GitHub for repository and CI/CD operations
  'github': [AgentCapability.VERSION_CONTROL, AgentCapability.DEPLOYMENT, AgentCapability.CODE_REVIEW],
  
  // Notion for documentation
  'notion': [AgentCapability.DOCUMENTATION, AgentCapability.KNOWLEDGE_MANAGEMENT],
  
  // Vercel for deployment
  'vercel': [AgentCapability.DEPLOYMENT, AgentCapability.MONITORING],
  
  // IDE for diagnostics and code execution
  'ide': [AgentCapability.TESTING, AgentCapability.CODE_GENERATION, AgentCapability.DEBUGGING]
} as const;

/**
 * MCP function registry for dynamic capability discovery
 */
export interface MCPFunction {
  name: string;
  server: string;
  description: string;
  parameters: Record<string, any>;
  capabilities: AgentCapability[];
}

/**
 * MCP Server adapter class
 */
export class MCPAdapter {
  private availableFunctions: Map<string, MCPFunction> = new Map();
  
  constructor() {
    this.initializeFunctionRegistry();
  }
  
  /**
   * Initialize the registry of available MCP functions
   */
  private initializeFunctionRegistry(): void {
    // Sequential thinking functions
    this.registerFunction({
      name: 'mcp__seq-thinking__sequentialthinking',
      server: 'seq-thinking',
      description: 'Structured reasoning and planning',
      parameters: { thought: 'string', nextThoughtNeeded: 'boolean' },
      capabilities: [AgentCapability.PLANNING, AgentCapability.DECISION_MAKING]
    });
    
    // Filesystem functions
    this.registerFunction({
      name: 'mcp__filesystem__read_text_file',
      server: 'filesystem',
      description: 'Read file contents',
      parameters: { path: 'string' },
      capabilities: [AgentCapability.FILE_OPERATIONS]
    });
    
    this.registerFunction({
      name: 'mcp__filesystem__write_file',
      server: 'filesystem',
      description: 'Write file contents',
      parameters: { path: 'string', content: 'string' },
      capabilities: [AgentCapability.FILE_OPERATIONS, AgentCapability.CODE_GENERATION]
    });
    
    this.registerFunction({
      name: 'mcp__filesystem__edit_file',
      server: 'filesystem',
      description: 'Edit file with line-based changes',
      parameters: { path: 'string', edits: 'array' },
      capabilities: [AgentCapability.FILE_OPERATIONS, AgentCapability.CODE_GENERATION]
    });
    
    // Memory functions
    this.registerFunction({
      name: 'mcp__memory__create_entities',
      server: 'memory',
      description: 'Store knowledge entities',
      parameters: { entities: 'array' },
      capabilities: [AgentCapability.KNOWLEDGE_MANAGEMENT, AgentCapability.DATA_ANALYSIS]
    });
    
    this.registerFunction({
      name: 'mcp__memory__search_nodes',
      server: 'memory',
      description: 'Search knowledge graph',
      parameters: { query: 'string' },
      capabilities: [AgentCapability.KNOWLEDGE_MANAGEMENT, AgentCapability.DATA_ANALYSIS]
    });
    
    // GitHub functions
    this.registerFunction({
      name: 'mcp__github__create_pull_request',
      server: 'github',
      description: 'Create pull request',
      parameters: { owner: 'string', repo: 'string', title: 'string', head: 'string', base: 'string' },
      capabilities: [AgentCapability.VERSION_CONTROL, AgentCapability.CODE_REVIEW]
    });
    
    this.registerFunction({
      name: 'mcp__github__push_files',
      server: 'github',
      description: 'Push multiple files',
      parameters: { owner: 'string', repo: 'string', files: 'array', message: 'string' },
      capabilities: [AgentCapability.VERSION_CONTROL, AgentCapability.DEPLOYMENT]
    });
    
    // Vercel functions
    this.registerFunction({
      name: 'mcp__vercel__deploy_to_vercel',
      server: 'vercel',
      description: 'Deploy to Vercel',
      parameters: {},
      capabilities: [AgentCapability.DEPLOYMENT]
    });
    
    this.registerFunction({
      name: 'mcp__vercel__get_deployment',
      server: 'vercel',
      description: 'Get deployment status',
      parameters: { idOrUrl: 'string', teamId: 'string' },
      capabilities: [AgentCapability.DEPLOYMENT, AgentCapability.MONITORING]
    });
    
    // IDE functions
    this.registerFunction({
      name: 'mcp__ide__getDiagnostics',
      server: 'ide',
      description: 'Get TypeScript diagnostics',
      parameters: { uri: 'string' },
      capabilities: [AgentCapability.TESTING, AgentCapability.DEBUGGING]
    });
    
    this.registerFunction({
      name: 'mcp__ide__executeCode',
      server: 'ide',
      description: 'Execute Python code in Jupyter',
      parameters: { code: 'string' },
      capabilities: [AgentCapability.CODE_GENERATION, AgentCapability.TESTING]
    });
    
    // Notion functions
    this.registerFunction({
      name: 'mcp__notion__API-post-page',
      server: 'notion',
      description: 'Create Notion page',
      parameters: { parent: 'object', properties: 'object' },
      capabilities: [AgentCapability.DOCUMENTATION]
    });
    
    this.registerFunction({
      name: 'mcp__notion__API-post-search',
      server: 'notion',
      description: 'Search Notion pages',
      parameters: { query: 'string' },
      capabilities: [AgentCapability.KNOWLEDGE_MANAGEMENT, AgentCapability.DOCUMENTATION]
    });
  }
  
  /**
   * Register an MCP function
   */
  private registerFunction(func: MCPFunction): void {
    this.availableFunctions.set(func.name, func);
  }
  
  /**
   * Get available functions for specific capabilities
   */
  getFunctionsForCapabilities(capabilities: AgentCapability[]): MCPFunction[] {
    return Array.from(this.availableFunctions.values()).filter(func =>
      func.capabilities.some(cap => capabilities.includes(cap))
    );
  }
  
  /**
   * Get all available MCP servers and their capabilities
   */
  getAvailableServers(): Record<string, AgentCapability[]> {
    const servers: Record<string, Set<AgentCapability>> = {};
    
    this.availableFunctions.forEach(func => {
      if (!servers[func.server]) {
        servers[func.server] = new Set();
      }
      func.capabilities.forEach(cap => servers[func.server].add(cap));
    });
    
    // Convert Sets to arrays
    const result: Record<string, AgentCapability[]> = {};
    Object.entries(servers).forEach(([server, caps]) => {
      result[server] = Array.from(caps);
    });
    
    return result;
  }
  
  /**
   * Execute an MCP function (this would be implemented to actually call the MCP function)
   */
  async executeFunction(
    functionName: string, 
    parameters: Record<string, any>
  ): Promise<any> {
    const func = this.availableFunctions.get(functionName);
    if (!func) {
      throw new Error(`MCP function ${functionName} not found`);
    }
    
    // In a real implementation, this would make the actual MCP call
    // For now, we'll return a placeholder that agents can implement
    return {
      success: true,
      functionName,
      server: func.server,
      parameters,
      timestamp: new Date().toISOString(),
      message: `MCP function ${functionName} would be executed with parameters: ${JSON.stringify(parameters)}`
    };
  }
  
  /**
   * Plan task execution using available MCP functions
   */
  planTaskExecution(task: Task): {
    functions: MCPFunction[];
    executionPlan: string;
    estimatedDuration: number;
  } {
    const relevantFunctions = this.getFunctionsForCapabilities(task.requiredCapabilities);
    
    let executionPlan = `Task: ${task.title}\n`;
    executionPlan += `Required capabilities: ${task.requiredCapabilities.join(', ')}\n`;
    executionPlan += `Available MCP functions:\n`;
    
    relevantFunctions.forEach(func => {
      executionPlan += `  - ${func.name} (${func.server}): ${func.description}\n`;
    });
    
    // Estimate duration based on function complexity
    const estimatedDuration = relevantFunctions.length * 5000 + 10000; // 5s per function + 10s base
    
    return {
      functions: relevantFunctions,
      executionPlan,
      estimatedDuration
    };
  }
  
  /**
   * Check if required capabilities are available via MCP servers
   */
  canHandleCapabilities(capabilities: AgentCapability[]): {
    canHandle: boolean;
    availableCapabilities: AgentCapability[];
    missingCapabilities: AgentCapability[];
  } {
    const availableCapabilities = new Set<AgentCapability>();
    
    this.availableFunctions.forEach(func => {
      func.capabilities.forEach(cap => availableCapabilities.add(cap));
    });
    
    const available = Array.from(availableCapabilities);
    const missing = capabilities.filter(cap => !availableCapabilities.has(cap));
    
    return {
      canHandle: missing.length === 0,
      availableCapabilities: available,
      missingCapabilities: missing
    };
  }
  
  /**
   * Generate agent suggestions based on available MCP capabilities
   */
  suggestAgentImplementations(): {
    agentType: string;
    capabilities: AgentCapability[];
    mcpServers: string[];
    description: string;
  }[] {
    const suggestions = [
      {
        agentType: 'PlanningAgent',
        capabilities: [AgentCapability.PLANNING, AgentCapability.DECISION_MAKING],
        mcpServers: ['seq-thinking', 'memory'],
        description: 'Uses structured thinking to plan complex tasks and make decisions'
      },
      {
        agentType: 'DevelopmentAgent',
        capabilities: [AgentCapability.CODE_GENERATION, AgentCapability.FILE_OPERATIONS],
        mcpServers: ['filesystem', 'ide', 'github'],
        description: 'Generates code, manages files, and handles version control'
      },
      {
        agentType: 'DeploymentAgent',
        capabilities: [AgentCapability.DEPLOYMENT, AgentCapability.MONITORING],
        mcpServers: ['vercel', 'github'],
        description: 'Manages deployments and monitors application health'
      },
      {
        agentType: 'DocumentationAgent',
        capabilities: [AgentCapability.DOCUMENTATION, AgentCapability.KNOWLEDGE_MANAGEMENT],
        mcpServers: ['notion', 'memory', 'filesystem'],
        description: 'Creates and manages documentation and knowledge bases'
      },
      {
        agentType: 'QualityAssuranceAgent',
        capabilities: [AgentCapability.TESTING, AgentCapability.DEBUGGING],
        mcpServers: ['ide', 'github'],
        description: 'Runs tests, analyzes diagnostics, and debugs issues'
      }
    ];
    
    return suggestions;
  }
  
  /**
   * Health check for MCP servers
   */
  async healthCheck(): Promise<{
    server: string;
    status: 'healthy' | 'degraded' | 'down';
    capabilities: AgentCapability[];
    lastCheck: Date;
  }[]> {
    const servers = this.getAvailableServers();
    const results = [];
    
    for (const [server, capabilities] of Object.entries(servers)) {
      // In a real implementation, this would actually ping the MCP server
      const status = Math.random() > 0.1 ? 'healthy' : 'degraded'; // 90% healthy
      
      results.push({
        server,
        status: status as 'healthy' | 'degraded' | 'down',
        capabilities,
        lastCheck: new Date()
      });
    }
    
    return results;
  }
}

/**
 * Singleton instance of the MCP adapter
 */
export const mcpAdapter = new MCPAdapter();

/**
 * Utility function to check if MCP servers can handle a task
 */
export function canMCPHandleTask(task: Task): boolean {
  const { canHandle } = mcpAdapter.canHandleCapabilities(task.requiredCapabilities);
  return canHandle;
}

/**
 * Utility function to get execution plan for a task using MCP
 */
export function getMCPExecutionPlan(task: Task): ReturnType<MCPAdapter['planTaskExecution']> {
  return mcpAdapter.planTaskExecution(task);
}