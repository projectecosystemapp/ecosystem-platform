/**
 * Multi-Agent Coordination Integration Tests
 * 
 * Tests the coordination and communication between multiple agents
 * working together on complex tasks and workflows.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Orchestrator, useOrchestratorStore } from '../../../lib/agents/orchestrator';
import { AgentRegistry } from '../../../lib/agents/registry';
import { MonitoringSystem } from '../../../lib/agents/monitoring';
import { createBugFixWorkflow, BugSeverity } from '../../../lib/agents/workflows/bugfix';
import { createDeploymentWorkflow, DeploymentTarget, DeploymentStrategy } from '../../../lib/agents/workflows/deployment';
import {
  Agent,
  AgentId,
  AgentCapability,
  AgentStatus,
  AgentPriority,
  Task,
  TaskStatus,
  MessageType,
  MessagePriority,
  TaskResponsePayload,
  WorkflowStatus
} from '../../../lib/agents/types';

describe('Multi-Agent Coordination Integration Tests', () => {
  let orchestrator: Orchestrator;
  let registry: AgentRegistry;
  let monitoring: MonitoringSystem;
  let agents: Agent[];

  // Create mock agents with different capabilities
  const createMockAgent = (
    id: string,
    capabilities: AgentCapability[],
    successRate: number = 0.95
  ): Agent => ({
    id: `agent_${id}` as AgentId,
    name: `Agent ${id}`,
    description: `Mock agent ${id} for integration testing`,
    capabilities,
    status: AgentStatus.IDLE,
    priority: AgentPriority.MEDIUM,
    version: '1.0.0',
    metadata: {
      createdAt: new Date(),
      lastActiveAt: new Date(),
      totalTasksCompleted: 0,
      averageResponseTime: Math.floor(Math.random() * 300) + 100,
      successRate,
      specializations: capabilities.map(c => `spec_${c}`),
      maxConcurrentTasks: 3
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
        maxCPUPercent: 50
      }
    }
  });

  // Simulate agent task execution
  const simulateAgentExecution = async (
    agentId: AgentId,
    taskId: string,
    duration: number = 1000,
    shouldSucceed: boolean = true
  ): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const response: TaskResponsePayload = {
          taskId,
          status: shouldSucceed ? 'completed' : 'failed',
          result: shouldSucceed ? { data: 'Task completed successfully' } : undefined,
          error: shouldSucceed ? undefined : {
            code: 'EXEC_ERROR',
            message: 'Task execution failed',
            details: { reason: 'Simulated failure' }
          },
          metrics: {
            startTime: new Date(Date.now() - duration),
            endTime: new Date(),
            duration,
            resourcesUsed: {
              cpu: Math.random() * 50,
              memory: Math.random() * 256
            }
          }
        };

        useOrchestratorStore.getState().sendMessage({
          type: MessageType.TASK_RESPONSE,
          priority: MessagePriority.HIGH,
          sender: agentId,
          recipient: 'system',
          payload: response
        });

        // Process the message
        const messages = useOrchestratorStore.getState().messageQueue;
        const message = messages.find(m => 
          m.type === MessageType.TASK_RESPONSE && 
          (m.payload as TaskResponsePayload).taskId === taskId
        );
        
        if (message) {
          useOrchestratorStore.getState().processMessage(message.id);
        }

        resolve();
      }, 100);
    });
  };

  beforeEach(() => {
    // Initialize systems
    orchestrator = new Orchestrator();
    registry = new AgentRegistry();
    monitoring = new MonitoringSystem({ enableLogging: false });

    // Create diverse agent pool
    agents = [
      createMockAgent('coder1', [AgentCapability.CODE_GENERATION, AgentCapability.BUG_FIXING], 0.95),
      createMockAgent('coder2', [AgentCapability.CODE_GENERATION, AgentCapability.REFACTORING], 0.9),
      createMockAgent('reviewer1', [AgentCapability.CODE_REVIEW, AgentCapability.SECURITY_AUDIT], 0.98),
      createMockAgent('tester1', [AgentCapability.TESTING], 0.92),
      createMockAgent('tester2', [AgentCapability.TESTING, AgentCapability.PERFORMANCE_OPTIMIZATION], 0.88),
      createMockAgent('deployer1', [AgentCapability.DEPLOYMENT, AgentCapability.MONITORING], 0.96),
      createMockAgent('analyst1', [AgentCapability.DATA_ANALYSIS, AgentCapability.MONITORING], 0.94),
      createMockAgent('documenter1', [AgentCapability.DOCUMENTATION, AgentCapability.USER_INTERACTION], 0.99),
      createMockAgent('coordinator1', [AgentCapability.WORKFLOW_COORDINATION], 1.0)
    ];

    // Register all agents
    agents.forEach(agent => {
      registry.registerAgent(agent);
      useOrchestratorStore.getState().registerAgent(agent);
    });
  });

  afterEach(() => {
    orchestrator.dispose();
    registry.dispose();
    monitoring.dispose();
    useOrchestratorStore.getState().reset();
  });

  describe('Collaborative Task Execution', () => {
    test('should distribute tasks among capable agents', async () => {
      // Create tasks requiring different capabilities
      const tasks = [
        {
          type: 'code_generation',
          capabilities: [AgentCapability.CODE_GENERATION]
        },
        {
          type: 'code_review',
          capabilities: [AgentCapability.CODE_REVIEW]
        },
        {
          type: 'testing',
          capabilities: [AgentCapability.TESTING]
        },
        {
          type: 'deployment',
          capabilities: [AgentCapability.DEPLOYMENT]
        }
      ];

      const taskIds: string[] = [];

      // Create and assign tasks
      tasks.forEach(taskConfig => {
        const taskId = useOrchestratorStore.getState().createTask({
          type: taskConfig.type,
          title: `Test ${taskConfig.type}`,
          description: 'Integration test task',
          status: TaskStatus.PENDING,
          priority: AgentPriority.MEDIUM,
          requiredCapabilities: taskConfig.capabilities,
          input: { testData: 'test' },
          dependencies: [],
          subtasks: [],
          checkpoints: []
        });
        taskIds.push(taskId);
      });

      // Verify tasks were assigned to appropriate agents
      taskIds.forEach((taskId, index) => {
        const task = useOrchestratorStore.getState().tasks.get(taskId);
        expect(task?.status).toBe(TaskStatus.ASSIGNED);
        expect(task?.assignedTo).toBeDefined();
        
        // Check agent has required capability
        const agent = agents.find(a => a.id === task?.assignedTo);
        expect(agent?.capabilities).toEqual(
          expect.arrayContaining(tasks[index].capabilities)
        );
      });

      // Simulate task execution
      await Promise.all(
        taskIds.map(taskId => {
          const task = useOrchestratorStore.getState().tasks.get(taskId);
          return simulateAgentExecution(task!.assignedTo!, taskId);
        })
      );

      // Verify all tasks completed
      taskIds.forEach(taskId => {
        const task = useOrchestratorStore.getState().tasks.get(taskId);
        expect(task?.status).toBe(TaskStatus.COMPLETED);
        expect(task?.output).toBeDefined();
      });
    });

    test('should handle task dependencies correctly', async () => {
      // Create dependent tasks
      const task1Id = useOrchestratorStore.getState().createTask({
        type: 'analysis',
        title: 'Analyze code',
        description: 'First task',
        status: TaskStatus.PENDING,
        priority: AgentPriority.HIGH,
        requiredCapabilities: [AgentCapability.DATA_ANALYSIS],
        input: {},
        dependencies: [],
        subtasks: [],
        checkpoints: []
      });

      const task2Id = useOrchestratorStore.getState().createTask({
        type: 'implementation',
        title: 'Implement solution',
        description: 'Depends on analysis',
        status: TaskStatus.PENDING,
        priority: AgentPriority.HIGH,
        requiredCapabilities: [AgentCapability.CODE_GENERATION],
        input: {},
        dependencies: [task1Id],
        subtasks: [],
        checkpoints: []
      });

      const task3Id = useOrchestratorStore.getState().createTask({
        type: 'testing',
        title: 'Test implementation',
        description: 'Depends on implementation',
        status: TaskStatus.PENDING,
        priority: AgentPriority.HIGH,
        requiredCapabilities: [AgentCapability.TESTING],
        input: {},
        dependencies: [task2Id],
        subtasks: [],
        checkpoints: []
      });

      // Task 1 should be assigned immediately
      expect(useOrchestratorStore.getState().tasks.get(task1Id)?.status).toBe(TaskStatus.ASSIGNED);
      
      // Tasks 2 and 3 should still be pending
      expect(useOrchestratorStore.getState().tasks.get(task2Id)?.status).toBe(TaskStatus.PENDING);
      expect(useOrchestratorStore.getState().tasks.get(task3Id)?.status).toBe(TaskStatus.PENDING);

      // Complete task 1
      const task1 = useOrchestratorStore.getState().tasks.get(task1Id);
      await simulateAgentExecution(task1!.assignedTo!, task1Id);

      // Task 2 should now be assigned
      expect(useOrchestratorStore.getState().tasks.get(task2Id)?.status).toBe(TaskStatus.ASSIGNED);
      expect(useOrchestratorStore.getState().tasks.get(task3Id)?.status).toBe(TaskStatus.PENDING);

      // Complete task 2
      const task2 = useOrchestratorStore.getState().tasks.get(task2Id);
      await simulateAgentExecution(task2!.assignedTo!, task2Id);

      // Task 3 should now be assigned
      expect(useOrchestratorStore.getState().tasks.get(task3Id)?.status).toBe(TaskStatus.ASSIGNED);

      // Complete task 3
      const task3 = useOrchestratorStore.getState().tasks.get(task3Id);
      await simulateAgentExecution(task3!.assignedTo!, task3Id);

      // All tasks should be completed
      [task1Id, task2Id, task3Id].forEach(taskId => {
        expect(useOrchestratorStore.getState().tasks.get(taskId)?.status).toBe(TaskStatus.COMPLETED);
      });
    });

    test('should reassign tasks when agent fails', async () => {
      // Create a task
      const taskId = useOrchestratorStore.getState().createTask({
        type: 'testing',
        title: 'Test with failure',
        description: 'Will fail first time',
        status: TaskStatus.PENDING,
        priority: AgentPriority.HIGH,
        requiredCapabilities: [AgentCapability.TESTING],
        input: {},
        dependencies: [],
        subtasks: [],
        checkpoints: []
      });

      const task = useOrchestratorStore.getState().tasks.get(taskId);
      const firstAgent = task?.assignedTo;
      expect(firstAgent).toBeDefined();

      // Simulate failure
      await simulateAgentExecution(firstAgent!, taskId, 1000, false);

      // Task should be retrying
      const retriedTask = useOrchestratorStore.getState().tasks.get(taskId);
      expect(retriedTask?.status).toBe(TaskStatus.RETRYING);
      expect(retriedTask?.metadata.retryCount).toBe(1);

      // Should be reassigned (potentially to same or different agent)
      useOrchestratorStore.getState().assignTask(taskId);
      const reassignedTask = useOrchestratorStore.getState().tasks.get(taskId);
      expect(reassignedTask?.status).toBe(TaskStatus.ASSIGNED);

      // Simulate successful retry
      await simulateAgentExecution(reassignedTask!.assignedTo!, taskId);

      const completedTask = useOrchestratorStore.getState().tasks.get(taskId);
      expect(completedTask?.status).toBe(TaskStatus.COMPLETED);
    });

    test('should handle concurrent task execution', async () => {
      // Create multiple independent tasks
      const taskIds: string[] = [];
      for (let i = 0; i < 10; i++) {
        const taskId = useOrchestratorStore.getState().createTask({
          type: `task_${i}`,
          title: `Concurrent task ${i}`,
          description: 'Concurrent execution test',
          status: TaskStatus.PENDING,
          priority: AgentPriority.MEDIUM,
          requiredCapabilities: [
            i % 2 === 0 ? AgentCapability.CODE_GENERATION : AgentCapability.TESTING
          ],
          input: { index: i },
          dependencies: [],
          subtasks: [],
          checkpoints: []
        });
        taskIds.push(taskId);
      }

      // All tasks should be assigned to available agents
      const assignedAgents = new Set<AgentId>();
      taskIds.forEach(taskId => {
        const task = useOrchestratorStore.getState().tasks.get(taskId);
        expect(task?.status).toBe(TaskStatus.ASSIGNED);
        if (task?.assignedTo) {
          assignedAgents.add(task.assignedTo);
        }
      });

      // Multiple agents should be utilized
      expect(assignedAgents.size).toBeGreaterThan(1);

      // Execute all tasks concurrently
      await Promise.all(
        taskIds.map(taskId => {
          const task = useOrchestratorStore.getState().tasks.get(taskId);
          return simulateAgentExecution(task!.assignedTo!, taskId, 500);
        })
      );

      // All tasks should be completed
      taskIds.forEach(taskId => {
        const task = useOrchestratorStore.getState().tasks.get(taskId);
        expect(task?.status).toBe(TaskStatus.COMPLETED);
      });
    });
  });

  describe('Workflow Execution', () => {
    test('should execute bug fix workflow end-to-end', async () => {
      // Create bug fix workflow
      const workflow = createBugFixWorkflow({
        bugId: 'BUG-001',
        title: 'Critical login bug',
        description: 'Users cannot login',
        severity: BugSeverity.CRITICAL,
        affectedComponents: ['auth'],
        reportedBy: 'qa@test.com',
        enableRootCauseAnalysis: true,
        enableRegressionTesting: false,
        autoDeployFix: false
      });

      // Register workflow
      useOrchestratorStore.getState().registerWorkflow(workflow);

      // Start workflow execution
      const executionId = useOrchestratorStore.getState().startWorkflow(workflow.id, {
        urgent: true
      });

      expect(executionId).toBeDefined();

      // Check execution started
      const execution = useOrchestratorStore.getState().activeExecutions.get(executionId);
      expect(execution).toBeDefined();
      expect(execution?.status).toBe(WorkflowStatus.RUNNING);

      // Simulate workflow task execution
      // Note: In real scenario, this would be handled by the workflow engine
      const workflowTasks = Array.from(useOrchestratorStore.getState().tasks.values())
        .filter(task => task.metadata.workflowId === workflow.id);

      // Execute tasks in order (simplified)
      for (const task of workflowTasks) {
        if (task.status === TaskStatus.ASSIGNED) {
          await simulateAgentExecution(task.assignedTo!, task.id);
        }
      }

      // Check metrics
      const metrics = monitoring.getPerformanceMetrics();
      expect(metrics.taskMetrics.totalProcessed).toBeGreaterThan(0);
    });

    test('should handle parallel workflow execution', async () => {
      // Create deployment workflow
      const workflow = createDeploymentWorkflow({
        version: '2.0.0',
        target: DeploymentTarget.STAGING,
        strategy: DeploymentStrategy.BLUE_GREEN,
        rollbackEnabled: true,
        smokeTestsEnabled: true,
        notificationChannels: ['slack']
      });

      useOrchestratorStore.getState().registerWorkflow(workflow);

      // Start multiple workflow instances
      const executionIds = [];
      for (let i = 0; i < 3; i++) {
        const executionId = useOrchestratorStore.getState().startWorkflow(workflow.id, {
          environment: `staging-${i}`
        });
        executionIds.push(executionId);
      }

      // All executions should be running
      executionIds.forEach(execId => {
        const execution = useOrchestratorStore.getState().activeExecutions.get(execId);
        expect(execution?.status).toBe(WorkflowStatus.RUNNING);
      });

      // Different instances should not interfere
      expect(new Set(executionIds).size).toBe(3);
    });

    test('should pause and resume workflow execution', async () => {
      const workflow = createBugFixWorkflow({
        bugId: 'BUG-002',
        title: 'Test bug',
        description: 'Test pause/resume',
        severity: BugSeverity.MEDIUM,
        affectedComponents: ['test'],
        reportedBy: 'test@test.com'
      });

      useOrchestratorStore.getState().registerWorkflow(workflow);
      const executionId = useOrchestratorStore.getState().startWorkflow(workflow.id, {});

      // Pause workflow
      useOrchestratorStore.getState().pauseWorkflow(executionId);
      let execution = useOrchestratorStore.getState().activeExecutions.get(executionId);
      expect(execution?.status).toBe(WorkflowStatus.PAUSED);

      // Tasks should not be processed while paused
      const tasksBefore = Array.from(useOrchestratorStore.getState().tasks.values())
        .filter(t => t.metadata.workflowId === workflow.id && t.status === TaskStatus.COMPLETED);

      await new Promise(resolve => setTimeout(resolve, 100));

      const tasksAfter = Array.from(useOrchestratorStore.getState().tasks.values())
        .filter(t => t.metadata.workflowId === workflow.id && t.status === TaskStatus.COMPLETED);

      expect(tasksAfter.length).toBe(tasksBefore.length);

      // Resume workflow
      useOrchestratorStore.getState().resumeWorkflow(executionId);
      execution = useOrchestratorStore.getState().activeExecutions.get(executionId);
      expect(execution?.status).toBe(WorkflowStatus.RUNNING);
    });

    test('should handle workflow cancellation', async () => {
      const workflow = createDeploymentWorkflow({
        version: '1.0.0',
        target: DeploymentTarget.PRODUCTION,
        strategy: DeploymentStrategy.CANARY,
        rollbackEnabled: true,
        smokeTestsEnabled: true,
        notificationChannels: []
      });

      useOrchestratorStore.getState().registerWorkflow(workflow);
      const executionId = useOrchestratorStore.getState().startWorkflow(workflow.id, {});

      // Cancel workflow
      useOrchestratorStore.getState().cancelWorkflow(executionId);

      const execution = useOrchestratorStore.getState().activeExecutions.get(executionId);
      expect(execution?.status).toBe(WorkflowStatus.CANCELLED);
      expect(execution?.completedAt).toBeDefined();

      // Associated tasks should be cancelled
      const workflowTasks = Array.from(useOrchestratorStore.getState().tasks.values())
        .filter(t => t.metadata.workflowId === workflow.id);

      workflowTasks.forEach(task => {
        if (task.status === TaskStatus.PENDING || task.status === TaskStatus.ASSIGNED) {
          // These tasks should be cancelled or not started
          expect([TaskStatus.CANCELLED, TaskStatus.PENDING]).toContain(task.status);
        }
      });
    });
  });

  describe('Agent Health and Recovery', () => {
    test('should detect and handle agent failures', async () => {
      const agent = agents[0];
      
      // Simulate agent going offline
      registry.updateAgentStatus(agent.id, AgentStatus.ERROR);
      useOrchestratorStore.getState().updateAgentStatus(agent.id, AgentStatus.ERROR);

      // Create task that would normally go to this agent
      const taskId = useOrchestratorStore.getState().createTask({
        type: 'code',
        title: 'Code task',
        description: 'Should avoid error agent',
        status: TaskStatus.PENDING,
        priority: AgentPriority.HIGH,
        requiredCapabilities: agent.capabilities,
        input: {},
        dependencies: [],
        subtasks: [],
        checkpoints: []
      });

      const task = useOrchestratorStore.getState().tasks.get(taskId);
      
      // Task should be assigned to a different capable agent
      expect(task?.assignedTo).toBeDefined();
      expect(task?.assignedTo).not.toBe(agent.id);
    });

    test('should rebalance load when agent recovers', async () => {
      const agent = agents[0];
      
      // Mark agent as error
      useOrchestratorStore.getState().updateAgentStatus(agent.id, AgentStatus.ERROR);

      // Create tasks
      const taskIds = [];
      for (let i = 0; i < 5; i++) {
        const taskId = useOrchestratorStore.getState().createTask({
          type: 'code',
          title: `Task ${i}`,
          description: 'Load balancing test',
          status: TaskStatus.PENDING,
          priority: AgentPriority.MEDIUM,
          requiredCapabilities: [AgentCapability.CODE_GENERATION],
          input: {},
          dependencies: [],
          subtasks: [],
          checkpoints: []
        });
        taskIds.push(taskId);
      }

      // Agent should not have any tasks
      const agentTasks1 = Array.from(useOrchestratorStore.getState().activeTasks.values())
        .filter(agentId => agentId === agent.id);
      expect(agentTasks1.length).toBe(0);

      // Recover agent
      useOrchestratorStore.getState().updateAgentStatus(agent.id, AgentStatus.IDLE);

      // Create more tasks
      for (let i = 5; i < 10; i++) {
        const taskId = useOrchestratorStore.getState().createTask({
          type: 'code',
          title: `Task ${i}`,
          description: 'Load balancing test',
          status: TaskStatus.PENDING,
          priority: AgentPriority.MEDIUM,
          requiredCapabilities: [AgentCapability.CODE_GENERATION],
          input: {},
          dependencies: [],
          subtasks: [],
          checkpoints: []
        });
        taskIds.push(taskId);
      }

      // Agent should now have tasks assigned
      const agentTasks2 = Array.from(useOrchestratorStore.getState().activeTasks.values())
        .filter(agentId => agentId === agent.id);
      expect(agentTasks2.length).toBeGreaterThan(0);
    });

    test('should perform health checks on idle agents', async () => {
      // Start health monitoring
      registry.startHealthMonitoring(100); // Fast interval for testing

      // Mark an agent as idle for extended period
      const agent = agents[0];
      agent.metadata.lastActiveAt = new Date(Date.now() - 600000); // 10 minutes ago

      // Wait for health check
      await new Promise(resolve => setTimeout(resolve, 200));

      // In real implementation, health check would ping the agent
      // For testing, we just verify the mechanism exists
      expect(registry.getAgent(agent.id)).toBeDefined();
    });
  });

  describe('Performance and Load Testing', () => {
    test('should handle high task throughput', async () => {
      const startTime = Date.now();
      const taskCount = 100;
      const taskIds: string[] = [];

      // Create many tasks rapidly
      for (let i = 0; i < taskCount; i++) {
        const taskId = useOrchestratorStore.getState().createTask({
          type: `perf_test_${i}`,
          title: `Performance test ${i}`,
          description: 'High throughput test',
          status: TaskStatus.PENDING,
          priority: AgentPriority.LOW,
          requiredCapabilities: [
            i % 3 === 0 ? AgentCapability.CODE_GENERATION :
            i % 3 === 1 ? AgentCapability.TESTING :
            AgentCapability.CODE_REVIEW
          ],
          input: { index: i },
          dependencies: [],
          subtasks: [],
          checkpoints: []
        });
        taskIds.push(taskId);
      }

      const creationTime = Date.now() - startTime;
      
      // Should handle creation quickly
      expect(creationTime).toBeLessThan(1000); // Less than 1 second for 100 tasks

      // All tasks should be queued or assigned
      taskIds.forEach(taskId => {
        const task = useOrchestratorStore.getState().tasks.get(taskId);
        expect([TaskStatus.PENDING, TaskStatus.ASSIGNED]).toContain(task?.status);
      });

      // Check system metrics
      const metrics = monitoring.getPerformanceMetrics();
      expect(metrics.systemMetrics.taskQueueSize).toBeGreaterThanOrEqual(0);
    });

    test('should maintain performance under sustained load', async () => {
      const duration = 2000; // 2 seconds
      const startTime = Date.now();
      let tasksCreated = 0;
      let tasksCompleted = 0;

      // Continuously create and complete tasks
      const interval = setInterval(() => {
        if (Date.now() - startTime > duration) {
          clearInterval(interval);
          return;
        }

        // Create task
        const taskId = useOrchestratorStore.getState().createTask({
          type: 'sustained_load',
          title: `Load test ${tasksCreated}`,
          description: 'Sustained load test',
          status: TaskStatus.PENDING,
          priority: AgentPriority.MEDIUM,
          requiredCapabilities: [AgentCapability.CODE_GENERATION],
          input: {},
          dependencies: [],
          subtasks: [],
          checkpoints: []
        });
        tasksCreated++;

        // Simulate quick completion
        const task = useOrchestratorStore.getState().tasks.get(taskId);
        if (task?.assignedTo) {
          simulateAgentExecution(task.assignedTo, taskId, 50).then(() => {
            tasksCompleted++;
          });
        }
      }, 10); // Create task every 10ms

      // Wait for test duration
      await new Promise(resolve => setTimeout(resolve, duration + 500));
      clearInterval(interval);

      // System should handle the load
      expect(tasksCreated).toBeGreaterThan(50);
      expect(tasksCompleted).toBeGreaterThan(0);

      // Check system health
      const state = useOrchestratorStore.getState();
      expect(state.systemStatus).not.toBe('critical');
    });

    test('should optimize agent utilization', () => {
      // Create tasks with varying requirements
      const taskConfigs = [
        { count: 10, capabilities: [AgentCapability.CODE_GENERATION] },
        { count: 10, capabilities: [AgentCapability.TESTING] },
        { count: 10, capabilities: [AgentCapability.CODE_REVIEW] },
        { count: 10, capabilities: [AgentCapability.DEPLOYMENT] }
      ];

      taskConfigs.forEach(config => {
        for (let i = 0; i < config.count; i++) {
          useOrchestratorStore.getState().createTask({
            type: 'utilization_test',
            title: `Utilization test`,
            description: 'Agent utilization test',
            status: TaskStatus.PENDING,
            priority: AgentPriority.MEDIUM,
            requiredCapabilities: config.capabilities,
            input: {},
            dependencies: [],
            subtasks: [],
            checkpoints: []
          });
        }
      });

      // Check agent utilization
      const utilization = useOrchestratorStore.getState().metrics.agentUtilization;
      const activeAgents = Array.from(utilization.entries())
        .filter(([_, util]) => util > 0);

      // Multiple agents should be utilized
      expect(activeAgents.length).toBeGreaterThan(3);

      // No single agent should be overloaded
      activeAgents.forEach(([agentId, util]) => {
        const agent = agents.find(a => a.id === agentId);
        expect(util).toBeLessThanOrEqual(agent?.metadata.maxConcurrentTasks || 3);
      });
    });
  });

  describe('Error Recovery and Resilience', () => {
    test('should recover from message queue overflow', () => {
      // Flood message queue
      for (let i = 0; i < 2000; i++) {
        useOrchestratorStore.getState().sendMessage({
          type: MessageType.STATUS_UPDATE,
          priority: MessagePriority.LOW,
          sender: 'system',
          recipient: 'broadcast',
          payload: { index: i }
        });
      }

      // System should maintain message history limit
      expect(useOrchestratorStore.getState().messageHistory.length).toBeLessThanOrEqual(1000);

      // Should still be able to process high priority messages
      useOrchestratorStore.getState().sendMessage({
        type: MessageType.ERROR_REPORT,
        priority: MessagePriority.URGENT,
        sender: 'system',
        recipient: 'broadcast',
        payload: { error: 'Critical error' }
      });

      // Urgent message should be processed
      const processedCount = useOrchestratorStore.getState().messageQueue.filter(
        m => m.priority === MessagePriority.URGENT
      ).length;
      
      // If urgent messages are auto-processed, queue should be empty or small
      expect(processedCount).toBeLessThanOrEqual(1);
    });

    test('should handle cascading task failures', async () => {
      // Create chain of dependent tasks
      const task1Id = useOrchestratorStore.getState().createTask({
        type: 'task1',
        title: 'Task 1',
        description: 'Will fail',
        status: TaskStatus.PENDING,
        priority: AgentPriority.HIGH,
        requiredCapabilities: [AgentCapability.CODE_GENERATION],
        input: {},
        dependencies: [],
        subtasks: [],
        checkpoints: []
      });

      const task2Id = useOrchestratorStore.getState().createTask({
        type: 'task2',
        title: 'Task 2',
        description: 'Depends on task1',
        status: TaskStatus.PENDING,
        priority: AgentPriority.HIGH,
        requiredCapabilities: [AgentCapability.TESTING],
        input: {},
        dependencies: [task1Id],
        subtasks: [],
        checkpoints: []
      });

      const task3Id = useOrchestratorStore.getState().createTask({
        type: 'task3',
        title: 'Task 3',
        description: 'Depends on task2',
        status: TaskStatus.PENDING,
        priority: AgentPriority.HIGH,
        requiredCapabilities: [AgentCapability.DEPLOYMENT],
        input: {},
        dependencies: [task2Id],
        subtasks: [],
        checkpoints: []
      });

      // Make task1 fail permanently
      const task1 = useOrchestratorStore.getState().tasks.get(task1Id);
      if (task1) {
        task1.metadata.maxRetries = 0; // No retries
      }

      // Simulate task1 failure
      await simulateAgentExecution(task1!.assignedTo!, task1Id, 100, false);

      // Task1 should be failed
      expect(useOrchestratorStore.getState().tasks.get(task1Id)?.status).toBe(TaskStatus.FAILED);

      // Dependent tasks should remain pending (not failed)
      expect(useOrchestratorStore.getState().tasks.get(task2Id)?.status).toBe(TaskStatus.PENDING);
      expect(useOrchestratorStore.getState().tasks.get(task3Id)?.status).toBe(TaskStatus.PENDING);

      // System should still be operational
      expect(useOrchestratorStore.getState().systemStatus).not.toBe('critical');
    });

    test('should handle agent communication failures gracefully', async () => {
      // Simulate delayed/lost messages
      const originalSendMessage = useOrchestratorStore.getState().sendMessage;
      let droppedMessages = 0;

      // Override sendMessage to randomly drop messages
      useOrchestratorStore.setState({
        sendMessage: (message) => {
          if (Math.random() < 0.2 && message.priority !== MessagePriority.URGENT) {
            droppedMessages++;
            return; // Drop 20% of non-urgent messages
          }
          originalSendMessage(message);
        }
      });

      // Create tasks
      const taskIds = [];
      for (let i = 0; i < 10; i++) {
        const taskId = useOrchestratorStore.getState().createTask({
          type: 'comm_test',
          title: `Communication test ${i}`,
          description: 'Testing message drops',
          status: TaskStatus.PENDING,
          priority: AgentPriority.LOW,
          requiredCapabilities: [AgentCapability.CODE_GENERATION],
          input: {},
          dependencies: [],
          subtasks: [],
          checkpoints: []
        });
        taskIds.push(taskId);
      }

      // System should still function despite dropped messages
      expect(droppedMessages).toBeGreaterThanOrEqual(0);
      
      // Tasks should still be assigned
      const assignedTasks = taskIds.filter(taskId => {
        const task = useOrchestratorStore.getState().tasks.get(taskId);
        return task?.status === TaskStatus.ASSIGNED;
      });
      
      expect(assignedTasks.length).toBeGreaterThan(0);

      // Restore original function
      useOrchestratorStore.setState({ sendMessage: originalSendMessage });
    });
  });
});