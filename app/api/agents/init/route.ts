/**
 * Agent System Initialization API
 * 
 * Initializes and bootstraps the agent orchestration system.
 * This route should be called once during application startup.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { orchestrator, useOrchestratorStore } from '@/lib/agents/orchestrator';
import { agentRegistry } from '@/lib/agents/registry';
import { monitoringSystem } from '@/lib/agents/monitoring';
import { mcpAdapter } from '@/lib/agents/mcp-adapter';
import { 
  Agent, 
  AgentCapability, 
  AgentStatus, 
  AgentPriority 
} from '@/lib/agents/types';

/**
 * Initialize the agent system
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const store = useOrchestratorStore.getState();
    
    // Check if system is already initialized
    if (store.agents.size > 0) {
      return NextResponse.json({
        message: 'Agent system already initialized',
        agents: Array.from(store.agents.keys()),
        status: 'already_initialized'
      });
    }

    console.log('🚀 Initializing agent orchestration system...');

    // 1. Check MCP server availability
    const mcpHealth = await mcpAdapter.healthCheck();
    const healthyServers = mcpHealth.filter(s => s.status === 'healthy');
    
    console.log(`📡 MCP Health Check: ${healthyServers.length}/${mcpHealth.length} servers healthy`);

    // 2. Create core agents based on available MCP capabilities
    const coreAgents = await createCoreAgents(mcpHealth);
    
    // 3. Register agents with the orchestrator
    coreAgents.forEach(agent => {
      agentRegistry.registerAgent(agent);
      store.registerAgent(agent);
    });

    // 4. Initialize monitoring for agents
    setupAgentMonitoring();

    // 5. Perform initial system health check
    store.performHealthCheck();

    console.log(`✅ Agent system initialized with ${coreAgents.length} agents`);

    return NextResponse.json({
      message: 'Agent system initialized successfully',
      agents: coreAgents.map(agent => ({
        id: agent.id,
        name: agent.name,
        capabilities: agent.capabilities,
        status: agent.status
      })),
      mcpServers: mcpHealth.map(server => ({
        name: server.server,
        status: server.status,
        capabilities: server.capabilities.length
      })),
      systemStatus: store.systemStatus,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Failed to initialize agent system:', error);
    return NextResponse.json(
      { 
        error: 'Failed to initialize agent system',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Get agent system status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const store = useOrchestratorStore.getState();
    const registryStats = agentRegistry.getStats();
    const performanceMetrics = monitoringSystem.getPerformanceMetrics();
    const mcpHealth = await mcpAdapter.healthCheck();

    return NextResponse.json({
      system: {
        status: store.systemStatus,
        lastHealthCheck: store.lastHealthCheck,
        totalAgents: store.agents.size,
        activeAgents: registryStats.totalAgents - registryStats.offlineAgents,
        activeTasks: store.activeTasks.size,
        queuedTasks: store.taskQueue.length
      },
      performance: {
        totalTasksProcessed: performanceMetrics.taskMetrics.totalProcessed,
        totalTasksFailed: performanceMetrics.taskMetrics.totalFailed,
        averageTaskDuration: performanceMetrics.taskMetrics.averageDuration,
        errorRate: performanceMetrics.taskMetrics.errorRate,
        systemLoad: performanceMetrics.systemMetrics.load
      },
      agents: Array.from(store.agents.values()).map(agent => ({
        id: agent.id,
        name: agent.name,
        status: agent.status,
        capabilities: agent.capabilities,
        metadata: {
          totalTasksCompleted: agent.metadata.totalTasksCompleted,
          successRate: agent.metadata.successRate,
          averageResponseTime: agent.metadata.averageResponseTime
        }
      })),
      mcpServers: mcpHealth,
      workflows: Array.from(store.workflows.keys()),
      activeExecutions: Array.from(store.activeExecutions.keys())
    });

  } catch (error) {
    console.error('❌ Failed to get agent system status:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get agent system status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Shutdown agent system (for testing/maintenance)
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const store = useOrchestratorStore.getState();
    
    console.log('🛑 Shutting down agent system...');
    
    // Cancel all active workflows
    store.activeExecutions.forEach((execution, id) => {
      store.cancelWorkflow(id);
    });
    
    // Cancel all active tasks
    store.activeTasks.forEach((agentId, taskId) => {
      store.cancelTask(taskId);
    });
    
    // Unregister all agents
    Array.from(store.agents.keys()).forEach(agentId => {
      store.unregisterAgent(agentId);
    });
    
    // Reset the orchestrator
    store.reset();
    
    console.log('✅ Agent system shut down successfully');
    
    return NextResponse.json({
      message: 'Agent system shut down successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Failed to shutdown agent system:', error);
    return NextResponse.json(
      { 
        error: 'Failed to shutdown agent system',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Create core agents based on available MCP servers
 */
async function createCoreAgents(mcpHealth: Awaited<ReturnType<typeof mcpAdapter.healthCheck>>): Promise<Agent[]> {
  const agents: Agent[] = [];
  const healthyServers = mcpHealth.filter(s => s.status === 'healthy');
  
  // Core Orchestrator Agent - always created
  agents.push({
    id: 'agent_core_orchestrator',
    name: 'Core Orchestrator Agent',
    description: 'Coordinates tasks between other agents and manages workflows',
    capabilities: [
      AgentCapability.TASK_MANAGEMENT,
      AgentCapability.PLANNING,
      AgentCapability.COORDINATION
    ],
    status: AgentStatus.IDLE,
    priority: AgentPriority.CRITICAL,
    version: '1.0.0',
    metadata: {
      createdAt: new Date(),
      lastActiveAt: new Date(),
      totalTasksCompleted: 0,
      averageResponseTime: 100,
      successRate: 1.0,
      specializations: ['orchestration', 'planning', 'coordination'],
      maxConcurrentTasks: 5
    },
    config: {
      timeout: 30000,
      retryPolicy: {
        maxRetries: 3,
        backoffMultiplier: 2,
        initialDelay: 1000
      },
      resourceLimits: {
        maxMemoryMB: 512,
        maxCPUPercent: 25
      }
    }
  });

  // Sequential Thinking Agent (if seq-thinking server is healthy)
  if (healthyServers.some(s => s.server === 'seq-thinking')) {
    agents.push({
      id: 'agent_sequential_thinking',
      name: 'Sequential Thinking Agent',
      description: 'Uses structured reasoning for complex problem solving',
      capabilities: [
        AgentCapability.PLANNING,
        AgentCapability.DECISION_MAKING,
        AgentCapability.PROBLEM_SOLVING
      ],
      status: AgentStatus.IDLE,
      priority: AgentPriority.HIGH,
      version: '1.0.0',
      metadata: {
        createdAt: new Date(),
        lastActiveAt: new Date(),
        totalTasksCompleted: 0,
        averageResponseTime: 200,
        successRate: 0.95,
        specializations: ['planning', 'reasoning', 'analysis'],
        maxConcurrentTasks: 3
      },
      config: {
        timeout: 60000,
        retryPolicy: {
          maxRetries: 2,
          backoffMultiplier: 1.5,
          initialDelay: 500
        },
        resourceLimits: {
          maxMemoryMB: 256,
          maxCPUPercent: 20
        }
      }
    });
  }

  // Filesystem Agent (if filesystem server is healthy)
  if (healthyServers.some(s => s.server === 'filesystem')) {
    agents.push({
      id: 'agent_filesystem',
      name: 'Filesystem Agent',
      description: 'Manages file operations and code generation',
      capabilities: [
        AgentCapability.FILE_OPERATIONS,
        AgentCapability.CODE_GENERATION,
        AgentCapability.REFACTORING
      ],
      status: AgentStatus.IDLE,
      priority: AgentPriority.HIGH,
      version: '1.0.0',
      metadata: {
        createdAt: new Date(),
        lastActiveAt: new Date(),
        totalTasksCompleted: 0,
        averageResponseTime: 150,
        successRate: 0.98,
        specializations: ['files', 'code', 'refactoring'],
        maxConcurrentTasks: 4
      },
      config: {
        timeout: 45000,
        retryPolicy: {
          maxRetries: 3,
          backoffMultiplier: 2,
          initialDelay: 1000
        },
        resourceLimits: {
          maxMemoryMB: 384,
          maxCPUPercent: 30
        }
      }
    });
  }

  // Memory/Knowledge Agent (if memory server is healthy)
  if (healthyServers.some(s => s.server === 'memory')) {
    agents.push({
      id: 'agent_knowledge_manager',
      name: 'Knowledge Manager Agent',
      description: 'Manages knowledge graph and provides context analysis',
      capabilities: [
        AgentCapability.KNOWLEDGE_MANAGEMENT,
        AgentCapability.DATA_ANALYSIS,
        AgentCapability.CONTEXT_UNDERSTANDING
      ],
      status: AgentStatus.IDLE,
      priority: AgentPriority.MEDIUM,
      version: '1.0.0',
      metadata: {
        createdAt: new Date(),
        lastActiveAt: new Date(),
        totalTasksCompleted: 0,
        averageResponseTime: 120,
        successRate: 0.96,
        specializations: ['knowledge', 'context', 'analysis'],
        maxConcurrentTasks: 5
      },
      config: {
        timeout: 30000,
        retryPolicy: {
          maxRetries: 2,
          backoffMultiplier: 1.5,
          initialDelay: 500
        },
        resourceLimits: {
          maxMemoryMB: 256,
          maxCPUPercent: 20
        }
      }
    });
  }

  // GitHub Agent (if github server is healthy)
  if (healthyServers.some(s => s.server === 'github')) {
    agents.push({
      id: 'agent_version_control',
      name: 'Version Control Agent',
      description: 'Manages Git operations, PRs, and code review',
      capabilities: [
        AgentCapability.VERSION_CONTROL,
        AgentCapability.CODE_REVIEW,
        AgentCapability.COLLABORATION
      ],
      status: AgentStatus.IDLE,
      priority: AgentPriority.HIGH,
      version: '1.0.0',
      metadata: {
        createdAt: new Date(),
        lastActiveAt: new Date(),
        totalTasksCompleted: 0,
        averageResponseTime: 300,
        successRate: 0.93,
        specializations: ['git', 'pull-requests', 'code-review'],
        maxConcurrentTasks: 2
      },
      config: {
        timeout: 90000,
        retryPolicy: {
          maxRetries: 3,
          backoffMultiplier: 2,
          initialDelay: 2000
        },
        resourceLimits: {
          maxMemoryMB: 512,
          maxCPUPercent: 40
        }
      }
    });
  }

  // Vercel Deployment Agent (if vercel server is healthy)
  if (healthyServers.some(s => s.server === 'vercel')) {
    agents.push({
      id: 'agent_deployment',
      name: 'Deployment Agent',
      description: 'Manages Vercel deployments and monitoring',
      capabilities: [
        AgentCapability.DEPLOYMENT,
        AgentCapability.MONITORING,
        AgentCapability.PERFORMANCE_OPTIMIZATION
      ],
      status: AgentStatus.IDLE,
      priority: AgentPriority.HIGH,
      version: '1.0.0',
      metadata: {
        createdAt: new Date(),
        lastActiveAt: new Date(),
        totalTasksCompleted: 0,
        averageResponseTime: 250,
        successRate: 0.94,
        specializations: ['vercel', 'deployments', 'monitoring'],
        maxConcurrentTasks: 2
      },
      config: {
        timeout: 120000,
        retryPolicy: {
          maxRetries: 3,
          backoffMultiplier: 2,
          initialDelay: 3000
        },
        resourceLimits: {
          maxMemoryMB: 384,
          maxCPUPercent: 35
        }
      }
    });
  }

  // IDE/Testing Agent (if ide server is healthy)
  if (healthyServers.some(s => s.server === 'ide')) {
    agents.push({
      id: 'agent_quality_assurance',
      name: 'Quality Assurance Agent',
      description: 'Runs tests, diagnostics, and quality checks',
      capabilities: [
        AgentCapability.TESTING,
        AgentCapability.DEBUGGING,
        AgentCapability.QUALITY_ASSURANCE
      ],
      status: AgentStatus.IDLE,
      priority: AgentPriority.HIGH,
      version: '1.0.0',
      metadata: {
        createdAt: new Date(),
        lastActiveAt: new Date(),
        totalTasksCompleted: 0,
        averageResponseTime: 180,
        successRate: 0.97,
        specializations: ['testing', 'diagnostics', 'quality'],
        maxConcurrentTasks: 3
      },
      config: {
        timeout: 60000,
        retryPolicy: {
          maxRetries: 2,
          backoffMultiplier: 1.5,
          initialDelay: 1000
        },
        resourceLimits: {
          maxMemoryMB: 512,
          maxCPUPercent: 50
        }
      }
    });
  }

  return agents;
}

/**
 * Setup monitoring for all agents
 */
function setupAgentMonitoring(): void {
  // Register agent-specific metrics
  monitoringSystem.registerMetric({
    name: 'agent_tasks_total',
    type: 'counter' as any,
    description: 'Total tasks processed by agents',
    labels: ['agent_id', 'task_type', 'status']
  });

  monitoringSystem.registerMetric({
    name: 'agent_response_time',
    type: 'histogram' as any,
    description: 'Agent task response time',
    unit: 'ms',
    labels: ['agent_id']
  });

  monitoringSystem.registerMetric({
    name: 'agent_utilization',
    type: 'gauge' as any,
    description: 'Agent utilization percentage',
    unit: 'percent',
    labels: ['agent_id']
  });

  // Setup health check alerts
  monitoringSystem.registerAlert(
    'Agent High Error Rate',
    'critical' as any,
    {
      metric: 'agent_tasks_total',
      operator: 'gt',
      threshold: 10, // More than 10% error rate
      duration: 300000, // 5 minutes
      aggregation: 'rate'
    },
    'Agent error rate is critically high'
  );

  console.log('📊 Agent monitoring setup complete');
}