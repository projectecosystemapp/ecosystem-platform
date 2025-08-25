/**
 * Orchestrator Unit Tests
 * 
 * Comprehensive test suite for the agent orchestrator core functionality
 * including task management, agent coordination, workflow execution, and state management.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { useOrchestratorStore, Orchestrator, AssignmentStrategy } from '../orchestrator';
import { agentRegistry } from '../registry';
import {
  Agent,
  AgentId,
  AgentCapability,
  AgentStatus,
  AgentPriority,
  Task,
  TaskStatus,
  Workflow,
  WorkflowStatus,
  WorkflowNodeType,
  MessageType,
  MessagePriority,
  TaskRequestPayload,
  TaskResponsePayload
} from '../types';

// Mock the registry
jest.mock('../registry', () => ({
  agentRegistry: {
    registerAgent: jest.fn(),
    unregisterAgent: jest.fn(),
    updateAgentStatus: jest.fn(),
    findBestAgentForTask: jest.fn()
  }
}));

describe('Orchestrator Unit Tests', () => {
  let orchestrator: Orchestrator;
  const store = useOrchestratorStore;

  // Test data
  const createTestAgent = (id: string, capabilities: AgentCapability[]): Agent => ({
    id: `agent_${id}` as AgentId,
    name: `Test Agent ${id}`,
    description: `Test agent for unit testing`,
    capabilities,
    status: AgentStatus.IDLE,
    priority: AgentPriority.MEDIUM,
    version: '1.0.0',
    metadata: {
      createdAt: new Date(),
      lastActiveAt: new Date(),
      totalTasksCompleted: 0,
      averageResponseTime: 100,
      successRate: 0.95,
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
        maxCPUPercent: 50
      }
    }
  });

  const createTestTask = (type: string, capabilities: AgentCapability[]): Omit<Task, 'id' | 'metadata'> => ({
    type,
    title: `Test ${type} task`,
    description: 'Test task for unit testing',
    status: TaskStatus.PENDING,
    priority: AgentPriority.MEDIUM,
    requiredCapabilities: capabilities,
    input: { testData: 'test' },
    dependencies: [],
    subtasks: [],
    checkpoints: []
  });

  beforeEach(() => {
    // Reset store
    store.getState().reset();
    // Clear all mocks
    jest.clearAllMocks();
    // Create new orchestrator instance
    orchestrator = new Orchestrator();
  });

  afterEach(() => {
    // Cleanup
    orchestrator.dispose();
  });

  describe('Agent Management', () => {
    test('should register an agent successfully', () => {
      const agent = createTestAgent('test1', [AgentCapability.CODE_GENERATION]);
      
      store.getState().registerAgent(agent);
      
      expect(store.getState().agents.get(agent.id)).toEqual(agent);
      expect(store.getState().agentStatuses.get(agent.id)).toBe(agent.status);
      expect(agentRegistry.registerAgent).toHaveBeenCalledWith(agent);
    });

    test('should unregister an agent and reassign its tasks', () => {
      const agent = createTestAgent('test1', [AgentCapability.TESTING]);
      store.getState().registerAgent(agent);
      
      // Create and assign a task
      const taskId = store.getState().createTask(
        createTestTask('test', [AgentCapability.TESTING])
      );
      store.getState().activeTasks.set(taskId, agent.id);
      
      // Unregister agent
      store.getState().unregisterAgent(agent.id);
      
      expect(store.getState().agents.has(agent.id)).toBe(false);
      expect(store.getState().taskQueue).toContain(taskId);
      expect(agentRegistry.unregisterAgent).toHaveBeenCalledWith(agent.id);
    });

    test('should update agent status correctly', () => {
      const agent = createTestAgent('test1', [AgentCapability.CODE_REVIEW]);
      store.getState().registerAgent(agent);
      
      store.getState().updateAgentStatus(agent.id, AgentStatus.BUSY);
      
      expect(store.getState().agents.get(agent.id)?.status).toBe(AgentStatus.BUSY);
      expect(store.getState().agentStatuses.get(agent.id)).toBe(AgentStatus.BUSY);
      expect(agentRegistry.updateAgentStatus).toHaveBeenCalledWith(agent.id, AgentStatus.BUSY);
    });

    test('should handle multiple agent registrations', () => {
      const agents = [
        createTestAgent('test1', [AgentCapability.CODE_GENERATION]),
        createTestAgent('test2', [AgentCapability.TESTING]),
        createTestAgent('test3', [AgentCapability.DEPLOYMENT])
      ];
      
      agents.forEach(agent => store.getState().registerAgent(agent));
      
      expect(store.getState().agents.size).toBe(3);
      agents.forEach(agent => {
        expect(store.getState().agents.has(agent.id)).toBe(true);
      });
    });

    test('should handle agent status transitions correctly', () => {
      const agent = createTestAgent('test1', [AgentCapability.CODE_GENERATION]);
      store.getState().registerAgent(agent);
      
      const statusTransitions = [
        AgentStatus.INITIALIZING,
        AgentStatus.IDLE,
        AgentStatus.BUSY,
        AgentStatus.ERROR,
        AgentStatus.OFFLINE,
        AgentStatus.TERMINATED
      ];
      
      statusTransitions.forEach(status => {
        store.getState().updateAgentStatus(agent.id, status);
        expect(store.getState().agents.get(agent.id)?.status).toBe(status);
      });
    });
  });

  describe('Task Management', () => {
    test('should create a task with unique ID', () => {
      const taskData = createTestTask('analysis', [AgentCapability.DATA_ANALYSIS]);
      
      const taskId = store.getState().createTask(taskData);
      
      expect(taskId).toMatch(/^task_\d+_[a-z0-9]+$/);
      const task = store.getState().tasks.get(taskId);
      expect(task).toBeDefined();
      expect(task?.type).toBe('analysis');
      expect(task?.status).toBe(TaskStatus.PENDING);
    });

    test('should assign task to available agent', () => {
      const agent = createTestAgent('test1', [AgentCapability.TESTING]);
      store.getState().registerAgent(agent);
      
      (agentRegistry.findBestAgentForTask as jest.Mock).mockReturnValue(agent);
      
      const taskId = store.getState().createTask(
        createTestTask('test', [AgentCapability.TESTING])
      );
      
      const task = store.getState().tasks.get(taskId);
      expect(task?.status).toBe(TaskStatus.ASSIGNED);
      expect(task?.assignedTo).toBe(agent.id);
      expect(store.getState().activeTasks.get(taskId)).toBe(agent.id);
    });

    test('should handle task with dependencies', () => {
      const agent = createTestAgent('test1', [AgentCapability.CODE_GENERATION]);
      store.getState().registerAgent(agent);
      
      // Create parent task
      const parentId = store.getState().createTask(
        createTestTask('parent', [AgentCapability.CODE_GENERATION])
      );
      
      // Create dependent task
      const dependentData = {
        ...createTestTask('dependent', [AgentCapability.CODE_GENERATION]),
        dependencies: [parentId]
      };
      const dependentId = store.getState().createTask(dependentData);
      
      // Dependent task should not be assigned yet
      const dependentTask = store.getState().tasks.get(dependentId);
      expect(dependentTask?.status).toBe(TaskStatus.PENDING);
      expect(dependentTask?.assignedTo).toBeUndefined();
      
      // Complete parent task
      store.getState().completeTask(parentId, { result: 'success' });
      
      // Now dependent task should be queued
      expect(store.getState().taskQueue).toContain(dependentId);
    });

    test('should complete task and update metrics', () => {
      const agent = createTestAgent('test1', [AgentCapability.TESTING]);
      store.getState().registerAgent(agent);
      
      const taskId = store.getState().createTask(
        createTestTask('test', [AgentCapability.TESTING])
      );
      store.getState().activeTasks.set(taskId, agent.id);
      store.getState().updateTaskStatus(taskId, TaskStatus.IN_PROGRESS);
      
      const output = { result: 'success', data: 'test data' };
      store.getState().completeTask(taskId, output);
      
      const task = store.getState().tasks.get(taskId);
      expect(task?.status).toBe(TaskStatus.COMPLETED);
      expect(task?.output).toEqual(output);
      expect(store.getState().metrics.totalTasksProcessed).toBe(1);
      expect(store.getState().activeTasks.has(taskId)).toBe(false);
    });

    test('should handle task failure with retry', () => {
      const taskId = store.getState().createTask(
        createTestTask('test', [AgentCapability.TESTING])
      );
      
      const error = new Error('Task failed');
      store.getState().failTask(taskId, error);
      
      const task = store.getState().tasks.get(taskId);
      expect(task?.status).toBe(TaskStatus.RETRYING);
      expect(task?.error).toEqual(error);
      expect(task?.metadata.retryCount).toBe(1);
      expect(store.getState().taskQueue).toContain(taskId);
    });

    test('should fail task permanently after max retries', () => {
      const taskId = store.getState().createTask(
        createTestTask('test', [AgentCapability.TESTING])
      );
      
      const task = store.getState().tasks.get(taskId);
      if (task) {
        task.metadata.retryCount = 2; // Already retried twice
        task.metadata.maxRetries = 3;
      }
      
      const error = new Error('Task failed');
      store.getState().failTask(taskId, error);
      
      expect(task?.status).toBe(TaskStatus.FAILED);
      expect(store.getState().metrics.totalTasksFailed).toBe(1);
      expect(store.getState().taskQueue).not.toContain(taskId);
    });

    test('should cancel task and cleanup resources', () => {
      const agent = createTestAgent('test1', [AgentCapability.TESTING]);
      store.getState().registerAgent(agent);
      
      const taskId = store.getState().createTask(
        createTestTask('test', [AgentCapability.TESTING])
      );
      store.getState().activeTasks.set(taskId, agent.id);
      
      store.getState().cancelTask(taskId);
      
      const task = store.getState().tasks.get(taskId);
      expect(task?.status).toBe(TaskStatus.CANCELLED);
      expect(store.getState().activeTasks.has(taskId)).toBe(false);
      expect(store.getState().taskQueue).not.toContain(taskId);
    });

    test('should handle concurrent task assignments', () => {
      const agents = [
        createTestAgent('test1', [AgentCapability.CODE_GENERATION]),
        createTestAgent('test2', [AgentCapability.CODE_GENERATION])
      ];
      agents.forEach(agent => store.getState().registerAgent(agent));
      
      const taskIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        (agentRegistry.findBestAgentForTask as jest.Mock)
          .mockReturnValueOnce(agents[i % 2]);
        
        const taskId = store.getState().createTask(
          createTestTask(`task${i}`, [AgentCapability.CODE_GENERATION])
        );
        taskIds.push(taskId);
      }
      
      // Check that tasks are distributed
      const agent1Tasks = Array.from(store.getState().activeTasks.values())
        .filter(agentId => agentId === agents[0].id).length;
      const agent2Tasks = Array.from(store.getState().activeTasks.values())
        .filter(agentId => agentId === agents[1].id).length;
      
      expect(agent1Tasks + agent2Tasks).toBeGreaterThan(0);
    });
  });

  describe('Workflow Management', () => {
    const createTestWorkflow = (): Workflow => ({
      id: 'wf_test',
      name: 'Test Workflow',
      description: 'Test workflow for unit testing',
      version: '1.0.0',
      status: WorkflowStatus.READY,
      nodes: [
        {
          id: 'start',
          type: WorkflowNodeType.START,
          name: 'Start',
          config: {},
          position: { x: 0, y: 0 }
        },
        {
          id: 'task1',
          type: WorkflowNodeType.TASK,
          name: 'Task 1',
          task: createTestTask('task1', [AgentCapability.CODE_GENERATION]) as Task,
          config: {},
          position: { x: 100, y: 0 }
        },
        {
          id: 'end',
          type: WorkflowNodeType.END,
          name: 'End',
          config: {},
          position: { x: 200, y: 0 }
        }
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'task1' },
        { id: 'e2', source: 'task1', target: 'end' }
      ],
      variables: { testVar: 'test' },
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        author: 'test',
        tags: ['test'],
        category: 'test'
      },
      config: {
        maxExecutionTime: 60000,
        maxRetries: 1,
        parallelismLimit: 2,
        requiresApproval: false,
        notificationChannels: []
      }
    });

    test('should register workflow', () => {
      const workflow = createTestWorkflow();
      
      store.getState().registerWorkflow(workflow);
      
      expect(store.getState().workflows.get(workflow.id)).toEqual(workflow);
    });

    test('should start workflow execution', () => {
      const workflow = createTestWorkflow();
      store.getState().registerWorkflow(workflow);
      
      const input = { param1: 'value1' };
      const executionId = store.getState().startWorkflow(workflow.id, input);
      
      expect(executionId).toMatch(/^exec_\d+_[a-z0-9]+$/);
      const execution = store.getState().activeExecutions.get(executionId);
      expect(execution).toBeDefined();
      expect(execution?.status).toBe(WorkflowStatus.RUNNING);
      expect(execution?.workflowId).toBe(workflow.id);
      expect(execution?.context).toMatchObject({ ...workflow.variables, ...input });
    });

    test('should pause and resume workflow', () => {
      const workflow = createTestWorkflow();
      store.getState().registerWorkflow(workflow);
      
      const executionId = store.getState().startWorkflow(workflow.id, {});
      
      // Pause workflow
      store.getState().pauseWorkflow(executionId);
      let execution = store.getState().activeExecutions.get(executionId);
      expect(execution?.status).toBe(WorkflowStatus.PAUSED);
      
      // Resume workflow
      store.getState().resumeWorkflow(executionId);
      execution = store.getState().activeExecutions.get(executionId);
      expect(execution?.status).toBe(WorkflowStatus.RUNNING);
    });

    test('should cancel workflow execution', () => {
      const workflow = createTestWorkflow();
      store.getState().registerWorkflow(workflow);
      
      const executionId = store.getState().startWorkflow(workflow.id, {});
      
      store.getState().cancelWorkflow(executionId);
      
      const execution = store.getState().activeExecutions.get(executionId);
      expect(execution?.status).toBe(WorkflowStatus.CANCELLED);
      expect(execution?.completedAt).toBeDefined();
    });

    test('should throw error for non-existent workflow', () => {
      expect(() => {
        store.getState().startWorkflow('non-existent', {});
      }).toThrow('Workflow non-existent not found');
    });
  });

  describe('Message Handling', () => {
    test('should send message to queue', () => {
      const messageData = {
        type: MessageType.TASK_REQUEST,
        priority: MessagePriority.HIGH,
        sender: 'system' as const,
        recipient: 'agent_test' as AgentId,
        payload: { test: 'data' }
      };
      
      store.getState().sendMessage(messageData);
      
      const queue = store.getState().messageQueue;
      expect(queue.length).toBe(1);
      expect(queue[0]).toMatchObject(messageData);
      expect(queue[0].id).toMatch(/^msg_\d+_[a-z0-9]+$/);
    });

    test('should process task response message', () => {
      const taskId = store.getState().createTask(
        createTestTask('test', [AgentCapability.TESTING])
      );
      
      const responsePayload: TaskResponsePayload = {
        taskId,
        status: 'completed',
        result: { data: 'result' },
        metrics: {
          startTime: new Date(),
          endTime: new Date(),
          duration: 1000
        }
      };
      
      store.getState().sendMessage({
        type: MessageType.TASK_RESPONSE,
        priority: MessagePriority.NORMAL,
        sender: 'agent_test' as AgentId,
        recipient: 'system',
        payload: responsePayload
      });
      
      const messageId = store.getState().messageQueue[0].id;
      store.getState().processMessage(messageId);
      
      const task = store.getState().tasks.get(taskId);
      expect(task?.status).toBe(TaskStatus.COMPLETED);
      expect(task?.output).toEqual(responsePayload.result);
    });

    test('should maintain message history', () => {
      for (let i = 0; i < 5; i++) {
        store.getState().sendMessage({
          type: MessageType.HEARTBEAT,
          priority: MessagePriority.LOW,
          sender: 'system' as const,
          recipient: 'broadcast' as const,
          payload: { index: i }
        });
      }
      
      expect(store.getState().messageHistory.length).toBe(5);
    });

    test('should process urgent messages immediately', () => {
      const processMessageSpy = jest.spyOn(store.getState(), 'processMessage');
      
      store.getState().sendMessage({
        type: MessageType.ERROR_REPORT,
        priority: MessagePriority.URGENT,
        sender: 'agent_test' as AgentId,
        recipient: 'system',
        payload: { error: 'Critical error' }
      });
      
      expect(processMessageSpy).toHaveBeenCalled();
    });
  });

  describe('System Management', () => {
    test('should update configuration', () => {
      const newConfig = {
        maxConcurrentTasks: 200,
        taskTimeoutMs: 600000,
        logLevel: 'debug' as const
      };
      
      store.getState().updateConfig(newConfig);
      
      const config = store.getState().config;
      expect(config.maxConcurrentTasks).toBe(200);
      expect(config.taskTimeoutMs).toBe(600000);
      expect(config.logLevel).toBe('debug');
    });

    test('should update metrics correctly', () => {
      // Setup some agents and tasks
      const agent1 = createTestAgent('test1', [AgentCapability.CODE_GENERATION]);
      const agent2 = createTestAgent('test2', [AgentCapability.TESTING]);
      store.getState().registerAgent(agent1);
      store.getState().registerAgent(agent2);
      
      store.getState().activeTasks.set('task1', agent1.id);
      store.getState().activeTasks.set('task2', agent1.id);
      store.getState().activeTasks.set('task3', agent2.id);
      
      store.getState().updateMetrics();
      
      const metrics = store.getState().metrics;
      expect(metrics.systemLoad).toBeGreaterThanOrEqual(0);
      expect(metrics.systemLoad).toBeLessThanOrEqual(1);
    });

    test('should perform health check', () => {
      const agent = createTestAgent('test1', [AgentCapability.MONITORING]);
      store.getState().registerAgent(agent);
      
      store.getState().metrics.errorRate = 0.05;
      store.getState().metrics.systemLoad = 0.5;
      
      store.getState().performHealthCheck();
      
      expect(store.getState().systemStatus).toBe('healthy');
      expect(store.getState().lastHealthCheck).toBeDefined();
      
      // Check that heartbeat messages were sent
      const heartbeats = store.getState().messageQueue.filter(
        m => m.type === MessageType.HEARTBEAT
      );
      expect(heartbeats.length).toBe(1);
    });

    test('should detect degraded system status', () => {
      store.getState().metrics.errorRate = 0.15;
      store.getState().metrics.systemLoad = 0.75;
      
      store.getState().performHealthCheck();
      
      expect(store.getState().systemStatus).toBe('degraded');
    });

    test('should detect critical system status', () => {
      store.getState().metrics.errorRate = 0.35;
      store.getState().metrics.systemLoad = 0.95;
      
      store.getState().performHealthCheck();
      
      expect(store.getState().systemStatus).toBe('critical');
    });

    test('should reset state completely', () => {
      // Add some data
      const agent = createTestAgent('test1', [AgentCapability.CODE_GENERATION]);
      store.getState().registerAgent(agent);
      store.getState().createTask(createTestTask('test', [AgentCapability.CODE_GENERATION]));
      store.getState().sendMessage({
        type: MessageType.STATUS_UPDATE,
        priority: MessagePriority.NORMAL,
        sender: 'system' as const,
        recipient: 'broadcast' as const,
        payload: {}
      });
      
      // Reset
      store.getState().reset();
      
      // Verify everything is cleared
      expect(store.getState().agents.size).toBe(0);
      expect(store.getState().tasks.size).toBe(0);
      expect(store.getState().messageQueue.length).toBe(0);
      expect(store.getState().metrics.totalTasksProcessed).toBe(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle task assignment when no suitable agent available', () => {
      (agentRegistry.findBestAgentForTask as jest.Mock).mockReturnValue(null);
      
      const taskId = store.getState().createTask(
        createTestTask('specialized', [AgentCapability.SECURITY_AUDIT])
      );
      
      const task = store.getState().tasks.get(taskId);
      expect(task?.status).toBe(TaskStatus.PENDING);
      expect(task?.assignedTo).toBeUndefined();
      expect(store.getState().taskQueue).toContain(taskId);
    });

    test('should handle circular task dependencies gracefully', () => {
      const task1Id = store.getState().createTask(
        createTestTask('task1', [AgentCapability.CODE_GENERATION])
      );
      
      const task2Data = {
        ...createTestTask('task2', [AgentCapability.CODE_GENERATION]),
        dependencies: [task1Id]
      };
      const task2Id = store.getState().createTask(task2Data);
      
      // Try to add circular dependency (should be prevented in real implementation)
      const task1 = store.getState().tasks.get(task1Id);
      if (task1) {
        task1.dependencies.push(task2Id);
      }
      
      // Neither task should be assigned due to circular dependency
      expect(store.getState().tasks.get(task1Id)?.status).toBe(TaskStatus.PENDING);
      expect(store.getState().tasks.get(task2Id)?.status).toBe(TaskStatus.PENDING);
    });

    test('should handle message processing for non-existent task', () => {
      const responsePayload: TaskResponsePayload = {
        taskId: 'non-existent-task',
        status: 'completed',
        result: { data: 'result' },
        metrics: {
          startTime: new Date(),
          endTime: new Date()
        }
      };
      
      store.getState().sendMessage({
        type: MessageType.TASK_RESPONSE,
        priority: MessagePriority.NORMAL,
        sender: 'agent_test' as AgentId,
        recipient: 'system',
        payload: responsePayload
      });
      
      const messageId = store.getState().messageQueue[0].id;
      
      // Should not throw, just handle gracefully
      expect(() => {
        store.getState().processMessage(messageId);
      }).not.toThrow();
    });

    test('should handle agent removal with multiple active tasks', () => {
      const agent = createTestAgent('test1', [AgentCapability.CODE_GENERATION, AgentCapability.TESTING]);
      store.getState().registerAgent(agent);
      
      // Assign multiple tasks to the agent
      const taskIds = [];
      for (let i = 0; i < 3; i++) {
        const taskId = store.getState().createTask(
          createTestTask(`task${i}`, [AgentCapability.CODE_GENERATION])
        );
        store.getState().activeTasks.set(taskId, agent.id);
        taskIds.push(taskId);
      }
      
      // Unregister agent
      store.getState().unregisterAgent(agent.id);
      
      // All tasks should be returned to queue
      taskIds.forEach(taskId => {
        expect(store.getState().taskQueue).toContain(taskId);
        expect(store.getState().activeTasks.has(taskId)).toBe(false);
      });
    });

    test('should handle workflow with missing start node', () => {
      const workflow: Workflow = {
        id: 'wf_no_start',
        name: 'No Start Workflow',
        description: 'Workflow without start node',
        version: '1.0.0',
        status: WorkflowStatus.READY,
        nodes: [
          {
            id: 'task1',
            type: WorkflowNodeType.TASK,
            name: 'Task 1',
            config: {},
            position: { x: 0, y: 0 }
          }
        ],
        edges: [],
        variables: {},
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          author: 'test',
          tags: [],
          category: 'test'
        },
        config: {
          maxExecutionTime: 60000,
          maxRetries: 1,
          parallelismLimit: 1,
          requiresApproval: false,
          notificationChannels: []
        }
      };
      
      store.getState().registerWorkflow(workflow);
      const executionId = store.getState().startWorkflow(workflow.id, {});
      
      // Workflow should be created but not progressing
      const execution = store.getState().activeExecutions.get(executionId);
      expect(execution).toBeDefined();
      expect(execution?.currentNode).toBeUndefined();
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle large number of agents efficiently', () => {
      const startTime = Date.now();
      
      // Register 100 agents
      for (let i = 0; i < 100; i++) {
        const agent = createTestAgent(`agent${i}`, [
          AgentCapability.CODE_GENERATION,
          AgentCapability.TESTING
        ]);
        store.getState().registerAgent(agent);
      }
      
      const registrationTime = Date.now() - startTime;
      
      expect(store.getState().agents.size).toBe(100);
      expect(registrationTime).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should handle large task queue efficiently', () => {
      // Create 500 tasks
      const taskIds: string[] = [];
      for (let i = 0; i < 500; i++) {
        const taskId = store.getState().createTask(
          createTestTask(`task${i}`, [AgentCapability.CODE_GENERATION])
        );
        taskIds.push(taskId);
      }
      
      expect(store.getState().tasks.size).toBe(500);
      expect(store.getState().taskQueue.length).toBeGreaterThan(0);
    });

    test('should maintain message history limit', () => {
      // Send more than 1000 messages
      for (let i = 0; i < 1100; i++) {
        store.getState().sendMessage({
          type: MessageType.STATUS_UPDATE,
          priority: MessagePriority.LOW,
          sender: 'system' as const,
          recipient: 'broadcast' as const,
          payload: { index: i }
        });
      }
      
      // History should be capped at 1000
      expect(store.getState().messageHistory.length).toBe(1000);
      // Most recent message should be last
      expect(store.getState().messageHistory[0].payload).toMatchObject({ index: 1099 });
    });
  });

  describe('Orchestrator Class Integration', () => {
    test('should initialize periodic tasks on construction', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      
      const orchestrator = new Orchestrator();
      
      // Should set up health check, metrics update, and message processing intervals
      expect(setIntervalSpy).toHaveBeenCalledTimes(3);
      
      orchestrator.dispose();
      setIntervalSpy.mockRestore();
    });

    test('should clean up resources on dispose', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      const orchestrator = new Orchestrator();
      
      orchestrator.dispose();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(store.getState().agents.size).toBe(0);
      
      clearIntervalSpy.mockRestore();
    });
  });
});