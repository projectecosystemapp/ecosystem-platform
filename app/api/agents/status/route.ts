/**
 * Agent System Status API
 * 
 * Provides real-time status information for agents, tasks, and system health.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { useOrchestratorStore } from '@/lib/agents/orchestrator';
import { agentRegistry } from '@/lib/agents/registry';
import { monitoringSystem } from '@/lib/agents/monitoring';
import { mcpAdapter } from '@/lib/agents/mcp-adapter';
import { coreAgentRunner } from '@/lib/agents/runners/CoreAgentRunner';
import { uiAgentRunner } from '@/lib/agents/runners/UIAgentRunner';
import { dbAgentRunner } from '@/lib/agents/runners/DBAgentRunner';
import { paymentsAgentRunner } from '@/lib/agents/runners/PaymentsAgentRunner';
import { securityAgentRunner } from '@/lib/agents/runners/SecurityAgentRunner';
import { TaskStatus } from '@/lib/agents/types';

/**
 * Get comprehensive system status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeDetails = searchParams.get('details') === 'true';
    const includeMetrics = searchParams.get('metrics') === 'true';

    const store = useOrchestratorStore.getState();
    const registryStats = agentRegistry.getStats();
    const performanceMetrics = monitoringSystem.getPerformanceMetrics();
    const mcpHealth = await mcpAdapter.healthCheck();

    // Get agent runner statuses
    const agentRunners = {
      core: coreAgentRunner.getStatus(),
      ui: uiAgentRunner.getStatus(),
      db: dbAgentRunner.getStatus(),
      payments: paymentsAgentRunner.getStatus(),
      security: securityAgentRunner.getStatus()
    };

    const response: any = {
      timestamp: new Date().toISOString(),
      system: {
        status: store.systemStatus,
        lastHealthCheck: store.lastHealthCheck,
        uptime: Date.now() - (store.lastHealthCheck?.getTime() || Date.now()),
        version: '1.0.0',
        // Include fields expected by the admin UI
        totalAgents: store.agents.size,
        activeAgents: registryStats.totalAgents - registryStats.offlineAgents,
        activeTasks: store.activeTasks.size,
        queuedTasks: store.taskQueue.length
      },
      orchestrator: {
        totalAgents: store.agents.size,
        activeAgents: registryStats.totalAgents - registryStats.offlineAgents,
        offlineAgents: registryStats.offlineAgents,
        totalTasks: store.tasks.size,
        activeTasks: store.activeTasks.size,
        queuedTasks: store.taskQueue.length,
        totalWorkflows: store.workflows.size,
        activeExecutions: store.activeExecutions.size
      },
      agents: Object.values(agentRunners),
      mcpServers: mcpHealth.map(server => ({
        name: server.server,
        status: server.status,
        capabilities: server.capabilities.length,
        lastCheck: server.lastCheck
      }))
    };

    if (includeDetails) {
      response.taskDetails = {
        byStatus: getTasksByStatus(store),
        byAgent: getTasksByAgent(store),
        recent: Array.from(store.tasks.values())
          .sort((a, b) => new Date(b.metadata.createdAt).getTime() - new Date(a.metadata.createdAt).getTime())
          .slice(0, 10)
          .map(task => ({
            id: task.id,
            title: task.title,
            status: task.status,
            assignedTo: task.assignedTo,
            createdAt: task.metadata.createdAt,
            duration: task.metadata.completedAt && task.metadata.startedAt ?
              task.metadata.completedAt.getTime() - task.metadata.startedAt.getTime() : null
          }))
      };

      response.workflowDetails = Array.from(store.activeExecutions.values()).map(execution => ({
        id: execution.id,
        workflowId: execution.workflowId,
        status: execution.status,
        currentNode: execution.currentNode,
        progress: {
          nodesExecuted: execution.metrics.nodesExecuted,
          nodesSkipped: execution.metrics.nodesSkipped,
          nodesFailed: execution.metrics.nodesFailed
        },
        startedAt: execution.startedAt,
        estimatedCompletion: estimateWorkflowCompletion(execution)
      }));
    }

    if (includeMetrics) {
      response.performance = {
        tasks: {
          totalProcessed: performanceMetrics.taskMetrics.totalProcessed,
          totalFailed: performanceMetrics.taskMetrics.totalFailed,
          averageDuration: performanceMetrics.taskMetrics.averageDuration,
          errorRate: performanceMetrics.taskMetrics.errorRate,
          throughput: performanceMetrics.taskMetrics.throughput
        },
        agents: {
          averageUtilization: performanceMetrics.agentMetrics.averageUtilization,
          peakUtilization: performanceMetrics.agentMetrics.averageUtilization, // Use averageUtilization as peakUtilization doesn't exist
          utilizationByAgent: Object.fromEntries(store.metrics.agentUtilization.entries())
        },
        system: {
          load: performanceMetrics.systemMetrics.systemLoad,
          memory: performanceMetrics.systemMetrics.memoryUsage,
          cpu: 0 // CPU metric not available in systemMetrics
        },
        workflows: {
          totalExecuted: performanceMetrics.workflowMetrics.totalExecutions,
          successRate: performanceMetrics.workflowMetrics.successRate,
          averageDuration: performanceMetrics.workflowMetrics.averageDuration
        }
      };

      response.alerts = monitoringSystem.getAlerts().map((alert: any) => ({
        id: alert.id,
        name: alert.name,
        severity: alert.severity,
        message: alert.message,
        triggeredAt: alert.triggeredAt,
        acknowledged: alert.acknowledged
      }));
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Failed to get system status:', error);
    return NextResponse.json({
      error: 'Failed to retrieve system status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Helper: Get tasks grouped by status
 */
function getTasksByStatus(store: ReturnType<typeof useOrchestratorStore.getState>) {
  const tasksByStatus: Record<string, number> = {};
  
  Object.values(TaskStatus).forEach(status => {
    tasksByStatus[status] = Array.from(store.tasks.values())
      .filter(task => task.status === status).length;
  });

  return tasksByStatus;
}

/**
 * Helper: Get tasks grouped by agent
 */
function getTasksByAgent(store: ReturnType<typeof useOrchestratorStore.getState>) {
  const tasksByAgent: Record<string, number> = {};
  
  Array.from(store.tasks.values()).forEach(task => {
    if (task.assignedTo) {
      tasksByAgent[task.assignedTo] = (tasksByAgent[task.assignedTo] || 0) + 1;
    } else {
      tasksByAgent['unassigned'] = (tasksByAgent['unassigned'] || 0) + 1;
    }
  });

  return tasksByAgent;
}

/**
 * Helper: Estimate workflow completion time
 */
function estimateWorkflowCompletion(execution: any): Date | null {
  if (!execution.startedAt) return null;
  
  // Simple estimation based on progress
  const totalNodes = execution.executionPath.length + 5; // Estimate remaining nodes
  const elapsedTime = Date.now() - execution.startedAt.getTime();
  const avgTimePerNode = elapsedTime / Math.max(1, execution.executionPath.length);
  const remainingTime = avgTimePerNode * (totalNodes - execution.executionPath.length);
  
  return new Date(Date.now() + remainingTime);
}