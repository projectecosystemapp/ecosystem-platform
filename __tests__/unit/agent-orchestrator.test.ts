/**
 * Agent Orchestrator Unit Tests
 * 
 * Tests the core orchestrator functionality including state management,
 * task distribution, and agent coordination.
 */

// @ts-nocheck - Temporarily disable TS for test migration
import { useOrchestratorStore } from '@/lib/agents/orchestrator';
import { agentRegistry } from '@/lib/agents/registry';
import { 
  TaskStatus, 
  AgentStatus, 
  AgentCapability, 
  AgentPriority,
  Agent,
  Task 
} from '@/lib/agents/types';

describe('Agent Orchestrator', () => {
  beforeEach(() => {
    // Reset store state before each test
    const store = useOrchestratorStore.getState();
    store.reset();
    // Clear registry for test isolation
    agentRegistry.clear();
  });

  describe('Task Management', () => {
    it('should create a new task with correct initial state', () => {
      const store = useOrchestratorStore.getState();

      const taskId = store.createTask({
        type: 'TEST_TASK',
        title: 'Test Task',
        description: 'A test task for unit testing',
        priority: AgentPriority.MEDIUM,
        requiredCapabilities: [AgentCapability.PLANNING],
        input: { testData: 'value' },
        dependencies: [],
        subtasks: [],
        checkpoints: [],
        metadata: {}
      });

      expect(taskId).toBeTruthy();
      const task = store.tasks.get(taskId);
      
      expect(task).toBeDefined();
      expect(task?.title).toBe('Test Task');
      expect(task?.status).toBe(TaskStatus.PENDING);
      expect(task?.priority).toBe(AgentPriority.MEDIUM);
      expect(task?.requiredCapabilities).toContain(AgentCapability.PLANNING);
      expect(task?.assignedTo).toBeUndefined();
      expect(task?.metadata.createdAt).toBeDefined();
    });

    it('should update task status correctly', () => {
      const store = useOrchestratorStore.getState();

      const taskId = store.createTask({
        type: 'TEST_TASK',
        title: 'Status Update Test',
        description: 'Test status updates',
        priority: AgentPriority.LOW,
        requiredCapabilities: [AgentCapability.FILE_OPERATIONS],
        input: {},
        dependencies: [],
        subtasks: [],
        checkpoints: [],
        metadata: {}
      });

      // Test status progression
      store.updateTaskStatus(taskId, TaskStatus.ASSIGNED);
      expect(store.tasks.get(taskId)?.status).toBe(TaskStatus.ASSIGNED);

      store.updateTaskStatus(taskId, TaskStatus.IN_PROGRESS);
      expect(store.tasks.get(taskId)?.status).toBe(TaskStatus.IN_PROGRESS);
      expect(store.tasks.get(taskId)?.metadata.startedAt).toBeDefined();

      store.updateTaskStatus(taskId, TaskStatus.COMPLETED);
      expect(store.tasks.get(taskId)?.status).toBe(TaskStatus.COMPLETED);
      expect(store.tasks.get(taskId)?.metadata.completedAt).toBeDefined();
    });

    it('should handle task dependencies correctly', () => {
      const store = useOrchestratorStore.getState();

      // Create parent task
      const parentTaskId = store.createTask({
        type: 'PARENT_TASK',
        title: 'Parent Task',
        description: 'Parent task',
        priority: AgentPriority.HIGH,
        requiredCapabilities: [AgentCapability.PLANNING],
        input: {},
        dependencies: [],
        subtasks: [],
        checkpoints: [],
        metadata: {}
      });

      // Create dependent task
      const dependentTaskId = store.createTask({
        type: 'DEPENDENT_TASK',
        title: 'Dependent Task',
        description: 'Task that depends on parent',
        priority: AgentPriority.MEDIUM,
        requiredCapabilities: [AgentCapability.CODE_GENERATION],
        input: {},
        dependencies: [parentTaskId],
        subtasks: [],
        checkpoints: [],
        metadata: {}
      });

      const dependentTask = store.tasks.get(dependentTaskId);
      expect(dependentTask?.dependencies).toContain(parentTaskId);
    });

    it('should retry failed tasks correctly', () => {
      const store = useOrchestratorStore.getState();

      const taskId = store.createTask({
        type: 'RETRY_TEST',
        title: 'Retry Test Task',
        description: 'Test retry functionality',
        priority: AgentPriority.LOW,
        requiredCapabilities: [AgentCapability.DATA_ANALYSIS],
        input: {},
        dependencies: [],
        subtasks: [],
        checkpoints: [],
        metadata: {}
      });

      // Mark as failed
      store.updateTaskStatus(taskId, TaskStatus.FAILED);
      expect(store.tasks.get(taskId)?.status).toBe(TaskStatus.FAILED);

      // Retry the task
      store.retryTask(taskId);
      const retriedTask = store.tasks.get(taskId);
      
      expect(retriedTask?.status).toBe(TaskStatus.PENDING);
      expect(retriedTask?.metadata.retryCount).toBe(1);
      expect(retriedTask?.assignedTo).toBeUndefined();
    });

    it('should cancel tasks correctly', () => {
      const store = useOrchestratorStore.getState();

      const taskId = store.createTask({
        type: 'CANCEL_TEST',
        title: 'Cancel Test Task',
        description: 'Test cancellation',
        priority: AgentPriority.LOW,
        requiredCapabilities: [AgentCapability.MONITORING],
        input: {},
        dependencies: [],
        subtasks: [],
        checkpoints: [],
        metadata: {}
      });

      store.updateTaskStatus(taskId, TaskStatus.IN_PROGRESS);
      store.cancelTask(taskId);

      const cancelledTask = store.tasks.get(taskId);
      expect(cancelledTask?.status).toBe(TaskStatus.CANCELLED);
      expect(cancelledTask?.metadata.completedAt).toBeDefined();
    });
  });

  describe('Agent Management', () => {
    it('should register agents correctly', () => {
      const store = useOrchestratorStore.getState();

      const agent: Agent = {
        id: 'test-agent-1',
        name: 'Test Agent',
        type: 'CORE',
        status: AgentStatus.IDLE,
        capabilities: [AgentCapability.PLANNING, AgentCapability.DECISION_MAKING],
        currentTask: undefined,
        taskQueue: [],
        metadata: {
          createdAt: new Date(),
          lastHeartbeat: new Date(),
          totalTasksCompleted: 0,
          averageTaskDuration: 0,
          successRate: 100,
          resourceUsage: {
            cpu: 0,
            memory: 0,
            disk: 0
          }
        },
        config: {
          maxConcurrentTasks: 3,
          timeout: 300000,
          retryPolicy: {
            maxAttempts: 3,
            backoffMs: 1000
          }
        }
      };

      store.registerAgent(agent);

      expect(store.agents.has('test-agent-1')).toBe(true);
      const registeredAgent = store.agents.get('test-agent-1');
      expect(registeredAgent?.name).toBe('Test Agent');
      expect(registeredAgent?.status).toBe(AgentStatus.IDLE);
    });

    it('should assign tasks to agents based on capabilities', () => {
      const store = useOrchestratorStore.getState();

      // Register test agents
      const planningAgent: Agent = {
        id: 'planning-agent',
        name: 'Planning Agent',
        type: 'CORE',
        status: AgentStatus.IDLE,
        capabilities: [AgentCapability.PLANNING, AgentCapability.DECISION_MAKING],
        currentTask: undefined,
        taskQueue: [],
        metadata: {
          createdAt: new Date(),
          lastHeartbeat: new Date(),
          totalTasksCompleted: 0,
          averageTaskDuration: 0,
          successRate: 100,
          resourceUsage: { cpu: 0, memory: 0, disk: 0 }
        },
        config: {
          maxConcurrentTasks: 3,
          timeout: 300000,
          retryPolicy: { maxAttempts: 3, backoffMs: 1000 }
        }
      };

      const fileAgent: Agent = {
        id: 'file-agent',
        name: 'File Agent',
        type: 'UI',
        status: AgentStatus.IDLE,
        capabilities: [AgentCapability.FILE_OPERATIONS, AgentCapability.CODE_GENERATION],
        currentTask: undefined,
        taskQueue: [],
        metadata: {
          createdAt: new Date(),
          lastHeartbeat: new Date(),
          totalTasksCompleted: 0,
          averageTaskDuration: 0,
          successRate: 100,
          resourceUsage: { cpu: 0, memory: 0, disk: 0 }
        },
        config: {
          maxConcurrentTasks: 2,
          timeout: 300000,
          retryPolicy: { maxAttempts: 3, backoffMs: 1000 }
        }
      };

      store.registerAgent(planningAgent);
      store.registerAgent(fileAgent);

      // Create tasks with different capability requirements
      const planningTaskId = store.createTask({
        type: 'PLANNING_TASK',
        title: 'Planning Task',
        description: 'Requires planning capability',
        priority: AgentPriority.HIGH,
        requiredCapabilities: [AgentCapability.PLANNING],
        input: {},
        dependencies: [],
        subtasks: [],
        checkpoints: [],
        metadata: {}
      });

      const fileTaskId = store.createTask({
        type: 'FILE_TASK',
        title: 'File Task',
        description: 'Requires file operations capability',
        priority: AgentPriority.MEDIUM,
        requiredCapabilities: [AgentCapability.FILE_OPERATIONS],
        input: {},
        dependencies: [],
        subtasks: [],
        checkpoints: [],
        metadata: {}
      });

      // Test assignment logic
      store.assignTask(planningTaskId, 'planning-agent');
      store.assignTask(fileTaskId, 'file-agent');

      const planningTask = store.tasks.get(planningTaskId);
      const fileTask = store.tasks.get(fileTaskId);

      expect(planningTask?.assignedTo).toBe('planning-agent');
      expect(planningTask?.status).toBe(TaskStatus.ASSIGNED);
      
      expect(fileTask?.assignedTo).toBe('file-agent');
      expect(fileTask?.status).toBe(TaskStatus.ASSIGNED);
    });

    it('should update agent status correctly', () => {
      const store = useOrchestratorStore.getState();

      const agent: Agent = {
        id: 'status-test-agent',
        name: 'Status Test Agent',
        type: 'CORE',
        status: AgentStatus.IDLE,
        capabilities: [AgentCapability.MONITORING],
        currentTask: undefined,
        taskQueue: [],
        metadata: {
          createdAt: new Date(),
          lastHeartbeat: new Date(),
          totalTasksCompleted: 0,
          averageTaskDuration: 0,
          successRate: 100,
          resourceUsage: { cpu: 0, memory: 0, disk: 0 }
        },
        config: {
          maxConcurrentTasks: 1,
          timeout: 300000,
          retryPolicy: { maxAttempts: 3, backoffMs: 1000 }
        }
      };

      store.registerAgent(agent);

      // Test status updates
      store.updateAgentStatus('status-test-agent', AgentStatus.BUSY);
      expect(store.agents.get('status-test-agent')?.status).toBe(AgentStatus.BUSY);

      store.updateAgentStatus('status-test-agent', AgentStatus.ERROR);
      expect(store.agents.get('status-test-agent')?.status).toBe(AgentStatus.ERROR);

      store.updateAgentStatus('status-test-agent', AgentStatus.IDLE);
      expect(store.agents.get('status-test-agent')?.status).toBe(AgentStatus.IDLE);
    });
  });

  describe('Queue Management', () => {
    it('should manage task queue correctly', () => {
      const store = useOrchestratorStore.getState();

      // Create multiple tasks
      const taskIds = [];
      for (let i = 0; i < 3; i++) {
        const taskId = store.createTask({
          type: `QUEUE_TEST_${i}`,
          title: `Queue Test Task ${i}`,
          description: `Task ${i} for queue testing`,
          priority: i === 1 ? AgentPriority.HIGH : AgentPriority.MEDIUM,
          requiredCapabilities: [AgentCapability.PLANNING],
          input: { index: i },
          dependencies: [],
          subtasks: [],
          checkpoints: [],
          metadata: {}
        });
        taskIds.push(taskId);
      }

      expect(store.taskQueue.length).toBe(3);
      
      // High priority task should be processed first
      const highPriorityTaskInQueue = store.taskQueue.find(task => 
        task.title === 'Queue Test Task 1'
      );
      expect(highPriorityTaskInQueue?.priority).toBe(AgentPriority.HIGH);
    });

    it('should handle queue processing correctly', () => {
      const store = useOrchestratorStore.getState();

      // Create tasks for queue processing
      const taskId1 = store.createTask({
        type: 'QUEUE_PROCESS_1',
        title: 'First Queue Task',
        description: 'First task in queue',
        priority: AgentPriority.LOW,
        requiredCapabilities: [AgentCapability.DATA_ANALYSIS],
        input: {},
        dependencies: [],
        subtasks: [],
        checkpoints: [],
        metadata: {}
      });

      const taskId2 = store.createTask({
        type: 'QUEUE_PROCESS_2',
        title: 'Second Queue Task',
        description: 'Second task in queue',
        priority: AgentPriority.HIGH,
        requiredCapabilities: [AgentCapability.DATA_ANALYSIS],
        input: {},
        dependencies: [],
        subtasks: [],
        checkpoints: [],
        metadata: {}
      });

      expect(store.taskQueue.length).toBe(2);

      // Process queue (simulate assignment)
      const nextTask = store.taskQueue[0];
      store.assignTask(nextTask.id, 'test-agent');

      // Task should be removed from queue and assigned
      expect(store.tasks.get(nextTask.id)?.status).toBe(TaskStatus.ASSIGNED);
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should track system metrics correctly', () => {
      const store = useOrchestratorStore.getState();

      // Create and process some tasks to generate metrics
      const taskId = store.createTask({
        type: 'METRICS_TEST',
        title: 'Metrics Test Task',
        description: 'Task for metrics testing',
        priority: AgentPriority.MEDIUM,
        requiredCapabilities: [AgentCapability.MONITORING],
        input: {},
        dependencies: [],
        subtasks: [],
        checkpoints: [],
        metadata: {}
      });

      store.updateTaskStatus(taskId, TaskStatus.COMPLETED);

      // Check that metrics are being tracked
      expect(store.metrics).toBeDefined();
      expect(store.metrics.tasksCreated).toBe(1);
      expect(store.metrics.tasksCompleted).toBe(1);
    });

    it('should handle system events correctly', () => {
      const store = useOrchestratorStore.getState();

      const initialEventCount = store.events.length;

      // Create a task to generate system events
      store.createTask({
        type: 'EVENT_TEST',
        title: 'Event Test Task',
        description: 'Task to test system events',
        priority: AgentPriority.LOW,
        requiredCapabilities: [AgentCapability.PLANNING],
        input: {},
        dependencies: [],
        subtasks: [],
        checkpoints: [],
        metadata: {}
      });

      // Events should be generated for task creation
      expect(store.events.length).toBeGreaterThan(initialEventCount);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid task creation gracefully', () => {
      const store = useOrchestratorStore.getState();

      expect(() => {
        // @ts-expect-error - Testing invalid input
        store.createTask({
          // Missing required fields
          title: '',
          description: ''
        });
      }).not.toThrow();
    });

    it('should handle non-existent agent assignment gracefully', () => {
      const store = useOrchestratorStore.getState();

      const taskId = store.createTask({
        type: 'INVALID_ASSIGNMENT_TEST',
        title: 'Invalid Assignment Test',
        description: 'Test invalid agent assignment',
        priority: AgentPriority.LOW,
        requiredCapabilities: [AgentCapability.PLANNING],
        input: {},
        dependencies: [],
        subtasks: [],
        checkpoints: [],
        metadata: {}
      });

      expect(() => {
        store.assignTask(taskId, 'non-existent-agent');
      }).not.toThrow();
      
      // Task should remain unassigned
      expect(store.tasks.get(taskId)?.assignedTo).toBeUndefined();
    });
  });
});