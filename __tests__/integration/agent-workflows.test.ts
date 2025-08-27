/**
 * Agent Workflow Integration Tests
 * 
 * Tests the complete agent orchestration system including task creation,
 * assignment, execution, and monitoring.
 */

// @ts-nocheck - Temporarily disable TS for test migration
import { NextRequest, NextResponse } from 'next/server';
import { POST as createTask, GET as getTasks } from '@/app/api/agents/tasks/route';
import { GET as getStatus } from '@/app/api/agents/status/route';
import { POST as initAgents } from '@/app/api/agents/init/route';
import { useOrchestratorStore } from '@/lib/agents/orchestrator';
import { agentRegistry } from '@/lib/agents/registry';
import { mcpAdapter } from '@/lib/agents/mcp-adapter';
import { TaskStatus, AgentCapability, AgentStatus } from '@/lib/agents/types';

// Mock authentication
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn().mockResolvedValue({
    userId: 'test-user-123',
    sessionId: 'test-session-123'
  })
}));

// Mock MCP adapter health check
jest.mock('@/lib/agents/mcp-adapter', () => ({
  mcpAdapter: {
    healthCheck: jest.fn().mockResolvedValue([
      {
        server: 'seq-thinking',
        status: 'healthy',
        capabilities: ['planning', 'thinking'],
        lastCheck: new Date()
      },
      {
        server: 'filesystem',
        status: 'healthy',
        capabilities: ['file_operations', 'code_generation'],
        lastCheck: new Date()
      },
      {
        server: 'postgres',
        status: 'healthy',
        capabilities: ['query_execution', 'schema_design'],
        lastCheck: new Date()
      }
    ]),
    getCapabilityMap: jest.fn().mockReturnValue(new Map([
      ['seq-thinking', [AgentCapability.PLANNING, AgentCapability.DECISION_MAKING]],
      ['filesystem', [AgentCapability.FILE_OPERATIONS, AgentCapability.CODE_GENERATION]],
      ['postgres', [AgentCapability.DATA_ANALYSIS, AgentCapability.QUERY_OPTIMIZATION]]
    ])),
    executeTask: jest.fn().mockImplementation(async (server, taskType, payload) => {
      // Simulate task execution based on server type
      if (server === 'seq-thinking') {
        return {
          success: true,
          result: {
            plan: 'Test plan created',
            steps: ['Step 1', 'Step 2', 'Step 3']
          }
        };
      }
      if (server === 'filesystem') {
        return {
          success: true,
          result: {
            filesCreated: ['test.ts', 'test.spec.ts'],
            content: 'Generated test content'
          }
        };
      }
      if (server === 'postgres') {
        return {
          success: true,
          result: {
            query: 'SELECT * FROM test',
            rowCount: 10
          }
        };
      }
      return { success: false, error: 'Unknown server' };
    })
  }
}));

describe('Agent Workflow Integration Tests', () => {
  beforeAll(async () => {
    // Initialize the agent system
    const request = new NextRequest('http://localhost:3000/api/agents/init', {
      method: 'POST'
    });
    await initAgents(request);
  });

  beforeEach(() => {
    // Reset orchestrator state before each test
    const store = useOrchestratorStore.getState();
    store.reset();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up after each test
    const store = useOrchestratorStore.getState();
    store.reset();
  });

  describe('Agent System Initialization', () => {
    it('should initialize agents successfully', async () => {
      const request = new NextRequest('http://localhost:3000/api/agents/init', {
        method: 'POST'
      });

      const response = await initAgents(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.agents).toBeDefined();
      expect(data.agents.length).toBeGreaterThan(0);
      expect(data.message).toContain('initialized successfully');
    });

    it('should report system status correctly', async () => {
      const request = new NextRequest('http://localhost:3000/api/agents/status', {
        method: 'GET'
      });

      const response = await getStatus(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.system).toBeDefined();
      expect(data.orchestrator).toBeDefined();
      expect(data.agents).toBeDefined();
      expect(data.mcpServers).toBeDefined();
    });
  });

  describe('Task Creation and Management', () => {
    it('should create a planning task successfully', async () => {
      const taskData = {
        type: 'PLANNING',
        title: 'Test Planning Task',
        description: 'Create a plan for testing agent workflows',
        priority: 'HIGH',
        requiredCapabilities: [AgentCapability.PLANNING, AgentCapability.DECISION_MAKING],
        input: {
          goal: 'Test agent workflow execution',
          constraints: ['Time: 5 minutes', 'Resources: Limited'],
          context: { testMode: true }
        }
      };

      const request = new NextRequest('http://localhost:3000/api/agents/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });

      const response = await createTask(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.taskId).toBeDefined();
      expect(data.task.title).toBe(taskData.title);
      expect(data.task.status).toBe(TaskStatus.PENDING);
      expect(data.message).toContain('created and queued');
    });

    it('should create a UI generation task successfully', async () => {
      const taskData = {
        type: 'UI_GENERATION',
        title: 'Generate Test Component',
        description: 'Create a React component for testing',
        priority: 'MEDIUM',
        requiredCapabilities: [AgentCapability.CODE_GENERATION, AgentCapability.FILE_OPERATIONS],
        input: {
          componentType: 'functional',
          props: ['title', 'description'],
          styling: 'tailwind'
        }
      };

      const request = new NextRequest('http://localhost:3000/api/agents/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });

      const response = await createTask(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.taskId).toBeDefined();
      expect(data.task.title).toBe(taskData.title);
      expect(data.task.requiredCapabilities).toContain(AgentCapability.CODE_GENERATION);
    });

    it('should retrieve tasks with filtering', async () => {
      // Create multiple tasks first
      const tasks = [
        {
          type: 'PLANNING',
          title: 'Planning Task 1',
          description: 'First planning task',
          priority: 'HIGH',
          requiredCapabilities: [AgentCapability.PLANNING],
          input: { goal: 'Plan 1' }
        },
        {
          type: 'DATABASE_OPERATION',
          title: 'Database Task 1',
          description: 'First database task',
          priority: 'MEDIUM',
          requiredCapabilities: [AgentCapability.DATA_ANALYSIS],
          input: { query: 'SELECT * FROM users' }
        }
      ];

      for (const taskData of tasks) {
        const request = new NextRequest('http://localhost:3000/api/agents/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(taskData)
        });
        await createTask(request);
      }

      // Retrieve all tasks
      const getRequest = new NextRequest('http://localhost:3000/api/agents/tasks?limit=10', {
        method: 'GET'
      });

      const response = await getTasks(getRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tasks).toBeDefined();
      expect(data.tasks.length).toBe(2);
      expect(data.summary).toBeDefined();
      expect(data.summary.total).toBe(2);
    });
  });

  describe('Agent Assignment and Execution', () => {
    it('should assign tasks to appropriate agents based on capabilities', async () => {
      const store = useOrchestratorStore.getState();

      // Create a planning task
      const taskId = store.createTask({
        type: 'PLANNING',
        title: 'Test Agent Assignment',
        description: 'Test capability-based assignment',
        priority: 'MEDIUM',
        requiredCapabilities: [AgentCapability.PLANNING, AgentCapability.DECISION_MAKING],
        input: { goal: 'Test assignment logic' },
        dependencies: [],
        subtasks: [],
        checkpoints: [],
        metadata: {}
      });

      // Simulate agent assignment
      const availableAgents = Array.from(store.agents.values())
        .filter(agent => agent.status === AgentStatus.IDLE);

      expect(availableAgents.length).toBeGreaterThan(0);

      const task = store.tasks.get(taskId);
      expect(task).toBeDefined();
      expect(task?.status).toBe(TaskStatus.PENDING);
    });

    it('should handle task execution lifecycle', async () => {
      const store = useOrchestratorStore.getState();

      // Create and execute a test task
      const taskId = store.createTask({
        type: 'FILE_OPERATION',
        title: 'Test File Creation',
        description: 'Create test files',
        priority: 'LOW',
        requiredCapabilities: [AgentCapability.FILE_OPERATIONS],
        input: { files: ['test1.ts', 'test2.ts'] },
        dependencies: [],
        subtasks: [],
        checkpoints: [],
        metadata: {}
      });

      // Simulate task assignment and execution
      store.updateTaskStatus(taskId, TaskStatus.ASSIGNED);
      store.updateTaskStatus(taskId, TaskStatus.IN_PROGRESS);

      const task = store.tasks.get(taskId);
      expect(task?.status).toBe(TaskStatus.IN_PROGRESS);

      // Simulate completion
      store.updateTaskStatus(taskId, TaskStatus.COMPLETED);
      expect(store.tasks.get(taskId)?.status).toBe(TaskStatus.COMPLETED);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle task failures gracefully', async () => {
      const store = useOrchestratorStore.getState();

      const taskId = store.createTask({
        type: 'FAILING_TASK',
        title: 'Test Task Failure',
        description: 'Test error handling',
        priority: 'LOW',
        requiredCapabilities: [AgentCapability.CODE_GENERATION],
        input: { shouldFail: true },
        dependencies: [],
        subtasks: [],
        checkpoints: [],
        metadata: {}
      });

      // Simulate task failure
      store.updateTaskStatus(taskId, TaskStatus.FAILED);

      const task = store.tasks.get(taskId);
      expect(task?.status).toBe(TaskStatus.FAILED);

      // Test retry functionality
      store.retryTask(taskId);
      expect(store.tasks.get(taskId)?.status).toBe(TaskStatus.PENDING);
    });

    it('should cancel tasks when requested', async () => {
      const store = useOrchestratorStore.getState();

      const taskId = store.createTask({
        type: 'LONG_RUNNING_TASK',
        title: 'Test Task Cancellation',
        description: 'Test cancellation',
        priority: 'LOW',
        requiredCapabilities: [AgentCapability.DATA_ANALYSIS],
        input: { duration: 1000 },
        dependencies: [],
        subtasks: [],
        checkpoints: [],
        metadata: {}
      });

      // Start the task
      store.updateTaskStatus(taskId, TaskStatus.IN_PROGRESS);

      // Cancel the task
      store.cancelTask(taskId);

      const task = store.tasks.get(taskId);
      expect(task?.status).toBe(TaskStatus.CANCELLED);
    });
  });

  describe('Monitoring and Metrics', () => {
    it('should collect performance metrics', async () => {
      const request = new NextRequest('http://localhost:3000/api/agents/status?metrics=true', {
        method: 'GET'
      });

      const response = await getStatus(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.performance).toBeDefined();
      expect(data.performance.tasks).toBeDefined();
      expect(data.performance.agents).toBeDefined();
      expect(data.performance.system).toBeDefined();
    });

    it('should provide detailed system information', async () => {
      const request = new NextRequest('http://localhost:3000/api/agents/status?details=true', {
        method: 'GET'
      });

      const response = await getStatus(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.taskDetails).toBeDefined();
      expect(data.workflowDetails).toBeDefined();
    });
  });

  describe('Security and Authorization', () => {
    it('should require authentication for task creation', async () => {
      // Mock failed authentication
      jest.mocked(require('@clerk/nextjs/server').auth).mockResolvedValueOnce({
        userId: null
      });

      const taskData = {
        type: 'UNAUTHORIZED_TASK',
        title: 'Should Fail',
        description: 'This should fail due to lack of auth',
        priority: 'LOW',
        requiredCapabilities: [AgentCapability.PLANNING],
        input: {}
      };

      const request = new NextRequest('http://localhost:3000/api/agents/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });

      const response = await createTask(request);
      expect(response.status).toBe(401);
    });

    it('should validate task input data', async () => {
      const invalidTaskData = {
        // Missing required fields
        type: '',
        title: '',
        priority: 'INVALID_PRIORITY',
        requiredCapabilities: [],
        input: {}
      };

      const request = new NextRequest('http://localhost:3000/api/agents/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidTaskData)
      });

      const response = await createTask(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toContain('Invalid request data');
      expect(data.details).toBeDefined();
    });
  });
});