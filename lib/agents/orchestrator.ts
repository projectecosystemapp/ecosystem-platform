/**
 * Agent Orchestrator - Core orchestration engine
 * 
 * Manages task distribution, workflow execution, state management,
 * and coordination between agents using a graph-based architecture.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';
import { enableMapSet } from 'immer';

// Enable Map and Set support in Immer
enableMapSet();
import { 
  Agent,
  AgentId,
  AgentCapability,
  AgentStatus,
  Task,
  TaskStatus,
  Workflow,
  WorkflowStatus,
  WorkflowExecution,
  WorkflowNode,
  WorkflowNodeType,
  Message,
  MessageType,
  MessagePriority,
  SystemEvent,
  EventType,
  OrchestratorState,
  OrchestratorConfig,
  TaskRequestPayload,
  TaskResponsePayload
} from './types';
import { agentRegistry } from './registry';

/**
 * Task assignment strategy
 */
export enum AssignmentStrategy {
  ROUND_ROBIN = 'round_robin',
  LEAST_LOADED = 'least_loaded',
  BEST_FIT = 'best_fit',
  RANDOM = 'random',
  PRIORITY_BASED = 'priority_based'
}

/**
 * Orchestrator actions interface
 */
interface OrchestratorActions {
  // Agent management
  registerAgent: (agent: Agent) => void;
  unregisterAgent: (agentId: AgentId) => void;
  updateAgentStatus: (agentId: AgentId, status: AgentStatus) => void;
  
  // Task management
  createTask: (task: Omit<Task, 'id' | 'metadata'>) => string;
  assignTask: (taskId: string, agentId?: AgentId) => void;
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;
  completeTask: (taskId: string, output: any) => void;
  failTask: (taskId: string, error: Error) => void;
  retryTask: (taskId: string) => void;
  cancelTask: (taskId: string) => void;
  
  // Workflow management
  registerWorkflow: (workflow: Workflow) => void;
  startWorkflow: (workflowId: string, input: Record<string, any>) => string;
  pauseWorkflow: (executionId: string) => void;
  resumeWorkflow: (executionId: string) => void;
  cancelWorkflow: (executionId: string) => void;
  
  // Message handling
  sendMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  processMessage: (messageId: string) => void;
  
  // System management
  updateConfig: (config: Partial<OrchestratorConfig>) => void;
  updateMetrics: () => void;
  performHealthCheck: () => void;
  reset: () => void;
}

/**
 * Default orchestrator configuration
 */
const defaultConfig: OrchestratorConfig = {
  maxConcurrentTasks: 100,
  taskTimeoutMs: 300000, // 5 minutes
  messageRetentionMs: 3600000, // 1 hour
  healthCheckIntervalMs: 30000, // 30 seconds
  metricsUpdateIntervalMs: 10000, // 10 seconds
  enableHumanInTheLoop: true,
  enableAutoScaling: false,
  logLevel: 'info'
};

/**
 * Initial orchestrator state
 */
const initialState: OrchestratorState = {
  agents: new Map(),
  agentStatuses: new Map(),
  tasks: new Map(),
  taskQueue: [],
  activeTasks: new Map(),
  workflows: new Map(),
  activeExecutions: new Map(),
  messageQueue: [],
  messageHistory: [],
  metrics: {
    totalTasksProcessed: 0,
    totalTasksFailed: 0,
    averageTaskDuration: 0,
    agentUtilization: new Map(),
    systemLoad: 0,
    errorRate: 0
  },
  systemStatus: 'healthy',
  lastHealthCheck: new Date(),
  config: defaultConfig
};

/**
 * Orchestrator store with Zustand
 */
export const useOrchestratorStore = create<OrchestratorState & OrchestratorActions>()(
  subscribeWithSelector(
    immer((set, get) => ({
      ...initialState,

      // ========================================================================
      // Agent Management
      // ========================================================================

      registerAgent: (agent: Agent) => {
        set((state) => {
          state.agents.set(agent.id, agent);
          state.agentStatuses.set(agent.id, agent.status);
          state.metrics.agentUtilization.set(agent.id, 0);
        });
        
        // Register with global registry
        agentRegistry.registerAgent(agent);
        
        // Log event
        get().sendMessage({
          type: MessageType.STATUS_UPDATE,
          priority: MessagePriority.NORMAL,
          sender: 'system',
          recipient: 'broadcast',
          payload: {
            event: 'agent_registered',
            agentId: agent.id,
            capabilities: agent.capabilities
          }
        });
      },

      unregisterAgent: (agentId: AgentId) => {
        set((state) => {
          // Reassign any active tasks
          const activeTasks = Array.from(state.activeTasks.entries())
            .filter(([_, assignedAgent]) => assignedAgent === agentId)
            .map(([taskId]) => taskId);
          
          activeTasks.forEach(taskId => {
            const task = state.tasks.get(taskId);
            if (task) {
              task.status = TaskStatus.PENDING;
              task.assignedTo = undefined;
              state.taskQueue.push(taskId);
            }
          });
          
          state.agents.delete(agentId);
          state.agentStatuses.delete(agentId);
          state.metrics.agentUtilization.delete(agentId);
        });
        
        // Unregister from global registry
        agentRegistry.unregisterAgent(agentId);
      },

      updateAgentStatus: (agentId: AgentId, status: AgentStatus) => {
        set((state) => {
          const agent = state.agents.get(agentId);
          if (agent) {
            agent.status = status;
            state.agentStatuses.set(agentId, status);
          }
        });
        
        agentRegistry.updateAgentStatus(agentId, status);
      },

      // ========================================================================
      // Task Management
      // ========================================================================

      createTask: (taskData: Omit<Task, 'id' | 'metadata'>) => {
        const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const task: Task = {
          ...taskData,
          id: taskId,
          status: TaskStatus.PENDING,
          metadata: {
            createdAt: new Date(),
            retryCount: 0,
            maxRetries: 3,
            ...taskData.metadata
          },
          dependencies: taskData.dependencies || [],
          subtasks: taskData.subtasks || [],
          checkpoints: []
        };
        
        set((state) => {
          state.tasks.set(taskId, task);
          state.taskQueue.push(taskId);
        });
        
        // Attempt immediate assignment
        get().assignTask(taskId);
        
        return taskId;
      },

      assignTask: (taskId: string, agentId?: AgentId) => {
        const state = get();
        const task = state.tasks.get(taskId);
        
        if (!task) {
          console.error(`Task ${taskId} not found`);
          return;
        }
        
        // Check if task has unmet dependencies
        const hasUnmetDependencies = task.dependencies.some(depId => {
          const depTask = state.tasks.get(depId);
          return depTask && depTask.status !== TaskStatus.COMPLETED;
        });
        
        if (hasUnmetDependencies) {
          console.log(`Task ${taskId} has unmet dependencies`);
          return;
        }
        
        // Find suitable agent if not specified
        let assignedAgent: Agent | null = null;
        
        if (agentId) {
          assignedAgent = state.agents.get(agentId) || null;
        } else {
          assignedAgent = agentRegistry.findBestAgentForTask(
            task.requiredCapabilities,
            [],
            {
              minSuccessRate: 0.7,
              excludeAgents: Array.from(state.activeTasks.values())
            }
          );
        }
        
        if (!assignedAgent) {
          console.log(`No suitable agent found for task ${taskId}`);
          return;
        }
        
        // Store the agent ID to use in the draft
        const finalAgentId = assignedAgent.id;
        
        set((state) => {
          const taskInDraft = state.tasks.get(taskId);
          if (taskInDraft) {
            taskInDraft.status = TaskStatus.ASSIGNED;
            taskInDraft.assignedTo = finalAgentId;
            taskInDraft.metadata.startedAt = new Date();
          }
          
          state.activeTasks.set(taskId, finalAgentId);
          state.taskQueue = state.taskQueue.filter(id => id !== taskId);
          
          // Update agent utilization
          const currentUtilization = state.metrics.agentUtilization.get(finalAgentId) || 0;
          state.metrics.agentUtilization.set(finalAgentId, currentUtilization + 1);
        });
        
        // Send task request to agent
        get().sendMessage({
          type: MessageType.TASK_REQUEST,
          priority: MessagePriority.HIGH,
          sender: 'system',
          recipient: assignedAgent.id,
          payload: {
            taskId,
            taskType: task.type,
            description: task.description,
            requirements: task.input,
            constraints: {
              deadline: task.metadata.deadline
            },
            context: {
              workflowId: task.metadata.workflowId,
              parentTaskId: task.metadata.parentTaskId
            }
          } as TaskRequestPayload
        });
        
        // Update agent status
        get().updateAgentStatus(assignedAgent.id, AgentStatus.BUSY);
      },

      updateTaskStatus: (taskId: string, status: TaskStatus) => {
        set((state) => {
          const task = state.tasks.get(taskId);
          if (task) {
            task.status = status;
            
            if (status === TaskStatus.IN_PROGRESS) {
              task.metadata = { ...task.metadata, startedAt: new Date() };
            }
          }
        });
      },

      completeTask: (taskId: string, output: any) => {
        set((state) => {
          const task = state.tasks.get(taskId);
          if (!task) return;
          
          task.status = TaskStatus.COMPLETED;
          task.output = output;
          task.metadata.completedAt = new Date();
          
          // Update metrics
          state.metrics.totalTasksProcessed++;
          
          // Calculate duration
          if (task.metadata.startedAt) {
            const duration = task.metadata.completedAt!.getTime() - task.metadata.startedAt.getTime();
            const currentAvg = state.metrics.averageTaskDuration;
            const totalTasks = state.metrics.totalTasksProcessed;
            state.metrics.averageTaskDuration = 
              (currentAvg * (totalTasks - 1) + duration) / totalTasks;
          }
          
          // Remove from active tasks
          const agentId = state.activeTasks.get(taskId);
          if (agentId) {
            state.activeTasks.delete(taskId);
            
            // Update agent utilization
            const currentUtilization = state.metrics.agentUtilization.get(agentId) || 0;
            state.metrics.agentUtilization.set(agentId, Math.max(0, currentUtilization - 1));
            
            // Update agent status if no more tasks
            const agentTasks = Array.from(state.activeTasks.values())
              .filter(id => id === agentId).length;
            if (agentTasks === 0) {
              const agent = state.agents.get(agentId);
              if (agent) {
                agent.status = AgentStatus.IDLE;
              }
            }
          }
          
          // Check for dependent tasks
          const dependentTasks = Array.from(state.tasks.values())
            .filter(t => t.dependencies.includes(taskId));
          
          dependentTasks.forEach(depTask => {
            const allDependenciesMet = depTask.dependencies.every(depId => {
              const dep = state.tasks.get(depId);
              return dep && dep.status === TaskStatus.COMPLETED;
            });
            
            if (allDependenciesMet && depTask.status === TaskStatus.PENDING) {
              state.taskQueue.push(depTask.id);
            }
          });
        });
        
        // Process task queue
        const state = get();
        if (state.taskQueue.length > 0) {
          const nextTaskId = state.taskQueue[0];
          get().assignTask(nextTaskId);
        }
      },

      failTask: (taskId: string, error: Error) => {
        set((state) => {
          const task = state.tasks.get(taskId);
          if (!task) return;
          
          task.error = error;
          task.metadata.retryCount++;
          
          // Check if should retry
          if (task.metadata.retryCount < task.metadata.maxRetries) {
            task.status = TaskStatus.RETRYING;
            state.taskQueue.push(taskId);
          } else {
            task.status = TaskStatus.FAILED;
            state.metrics.totalTasksFailed++;
          }
          
          // Remove from active tasks
          const agentId = state.activeTasks.get(taskId);
          if (agentId) {
            state.activeTasks.delete(taskId);
            
            // Update agent utilization
            const currentUtilization = state.metrics.agentUtilization.get(agentId) || 0;
            state.metrics.agentUtilization.set(agentId, Math.max(0, currentUtilization - 1));
          }
        });
        
        // Update error rate
        const state = get();
        state.metrics.errorRate = state.metrics.totalTasksFailed / 
          (state.metrics.totalTasksProcessed + state.metrics.totalTasksFailed);
      },

      retryTask: (taskId: string) => {
        set((state) => {
          const task = state.tasks.get(taskId);
          if (task && task.status === TaskStatus.FAILED) {
            task.status = TaskStatus.PENDING;
            task.error = undefined;
            state.taskQueue.push(taskId);
          }
        });
        
        // Attempt assignment
        get().assignTask(taskId);
      },

      cancelTask: (taskId: string) => {
        set((state) => {
          const task = state.tasks.get(taskId);
          if (!task) return;
          
          task.status = TaskStatus.CANCELLED;
          
          // Remove from queue or active tasks
          state.taskQueue = state.taskQueue.filter(id => id !== taskId);
          
          const agentId = state.activeTasks.get(taskId);
          if (agentId) {
            state.activeTasks.delete(taskId);
            
            // Update agent utilization
            const currentUtilization = state.metrics.agentUtilization.get(agentId) || 0;
            state.metrics.agentUtilization.set(agentId, Math.max(0, currentUtilization - 1));
          }
        });
      },

      // ========================================================================
      // Workflow Management
      // ========================================================================

      registerWorkflow: (workflow: Workflow) => {
        set((state) => {
          state.workflows.set(workflow.id, workflow);
        });
      },

      startWorkflow: (workflowId: string, input: Record<string, any>) => {
        const state = get();
        const workflow = state.workflows.get(workflowId);
        
        if (!workflow) {
          throw new Error(`Workflow ${workflowId} not found`);
        }
        
        const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const execution: WorkflowExecution = {
          id: executionId,
          workflowId,
          status: WorkflowStatus.RUNNING,
          startedAt: new Date(),
          executionPath: [],
          context: { ...workflow.variables, ...input },
          results: {},
          errors: [],
          metrics: {
            nodesExecuted: 0,
            nodesSkipped: 0,
            nodesFailed: 0,
            resourceUsage: {}
          }
        };
        
        set((state) => {
          state.activeExecutions.set(executionId, execution);
        });
        
        // Start with the start node
        const startNode = workflow.nodes.find(n => n.type === WorkflowNodeType.START);
        if (startNode) {
          get().executeWorkflowNode(executionId, startNode.id);
        }
        
        return executionId;
      },

      pauseWorkflow: (executionId: string) => {
        set((state) => {
          const execution = state.activeExecutions.get(executionId);
          if (execution && execution.status === WorkflowStatus.RUNNING) {
            execution.status = WorkflowStatus.PAUSED;
          }
        });
      },

      resumeWorkflow: (executionId: string) => {
        set((state) => {
          const execution = state.activeExecutions.get(executionId);
          if (execution && execution.status === WorkflowStatus.PAUSED) {
            execution.status = WorkflowStatus.RUNNING;
          }
        });
        
        // Resume from current node
        const execution = get().activeExecutions.get(executionId);
        if (execution && execution.currentNode) {
          get().executeWorkflowNode(executionId, execution.currentNode);
        }
      },

      cancelWorkflow: (executionId: string) => {
        set((state) => {
          const execution = state.activeExecutions.get(executionId);
          if (execution) {
            execution.status = WorkflowStatus.CANCELLED;
            execution.completedAt = new Date();
          }
        });
      },

      // ========================================================================
      // Message Handling
      // ========================================================================

      sendMessage: (messageData: Omit<Message, 'id' | 'timestamp'>) => {
        const message: Message = {
          ...messageData,
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date()
        };
        
        set((state) => {
          state.messageQueue.push(message);
          
          // Maintain message history size
          state.messageHistory.unshift(message);
          if (state.messageHistory.length > 1000) {
            state.messageHistory.pop();
          }
        });
        
        // Process message if it's high priority
        if (message.priority === MessagePriority.URGENT) {
          get().processMessage(message.id);
        }
      },

      processMessage: (messageId: string) => {
        const state = get();
        const messageIndex = state.messageQueue.findIndex(m => m.id === messageId);
        
        if (messageIndex === -1) return;
        
        const message = state.messageQueue[messageIndex];
        
        set((state) => {
          state.messageQueue.splice(messageIndex, 1);
        });
        
        // Route message based on type
        switch (message.type) {
          case MessageType.TASK_RESPONSE:
            const response = message.payload as TaskResponsePayload;
            if (response.status === 'completed') {
              get().completeTask(response.taskId, response.result);
            } else if (response.status === 'failed' && response.error) {
              get().failTask(response.taskId, new Error(response.error.message));
            }
            break;
            
          case MessageType.STATUS_UPDATE:
            // Handle status updates
            console.log('Status update:', message.payload);
            break;
            
          case MessageType.ERROR_REPORT:
            // Handle error reports
            console.error('Error report:', message.payload);
            break;
            
          case MessageType.HUMAN_APPROVAL_REQUEST:
            // Handle human approval requests
            console.log('Human approval needed:', message.payload);
            break;
            
          default:
            console.log('Unhandled message type:', message.type);
        }
      },

      // ========================================================================
      // System Management
      // ========================================================================

      updateConfig: (config: Partial<OrchestratorConfig>) => {
        set((state) => {
          Object.assign(state.config, config);
        });
      },

      updateMetrics: () => {
        set((state) => {
          // Calculate system load
          const totalCapacity = state.agents.size * 10; // Assume each agent can handle 10 tasks
          const currentLoad = state.activeTasks.size;
          state.metrics.systemLoad = totalCapacity > 0 ? currentLoad / totalCapacity : 0;
          
          // Update other metrics as needed
        });
      },

      performHealthCheck: () => {
        const state = get();
        
        set((state) => {
          state.lastHealthCheck = new Date();
          
          // Determine system status based on metrics
          if (state.metrics.errorRate > 0.3 || state.metrics.systemLoad > 0.9) {
            state.systemStatus = 'critical';
          } else if (state.metrics.errorRate > 0.1 || state.metrics.systemLoad > 0.7) {
            state.systemStatus = 'degraded';
          } else {
            state.systemStatus = 'healthy';
          }
        });
        
        // Perform agent health checks
        state.agents.forEach(agent => {
          // Check agent responsiveness
          get().sendMessage({
            type: MessageType.HEARTBEAT,
            priority: MessagePriority.LOW,
            sender: 'system',
            recipient: agent.id,
            payload: { timestamp: Date.now() }
          });
        });
      },

      reset: () => {
        set(() => initialState);
      },

      // ========================================================================
      // Helper Methods (not exposed in interface)
      // ========================================================================

      executeWorkflowNode: (executionId: string, nodeId: string) => {
        const state = get();
        const execution = state.activeExecutions.get(executionId);
        const workflow = execution ? state.workflows.get(execution.workflowId) : null;
        
        if (!execution || !workflow) return;
        
        const node = workflow.nodes.find(n => n.id === nodeId);
        if (!node) return;
        
        // Update execution state within immer draft
        set((state) => {
          const exec = state.activeExecutions.get(executionId);
          if (exec) {
            exec.currentNode = nodeId;
            exec.executionPath = [...exec.executionPath, nodeId];
          }
        });
        
        switch (node.type) {
          case WorkflowNodeType.TASK:
            if (node.task) {
              const taskId = get().createTask({
                ...node.task,
                metadata: {
                  ...node.task.metadata,
                  workflowId: workflow.id,
                  parentTaskId: execution.currentNode
                }
              });
              
              // Wait for task completion before proceeding
              // This would be handled by task completion callback
            }
            break;
            
          case WorkflowNodeType.DECISION:
            // Evaluate conditions and choose path
            const edge = workflow.edges.find(e => 
              e.source === nodeId && 
              (!e.condition || get().evaluateCondition(e.condition, execution.context))
            );
            
            if (edge) {
              get().executeWorkflowNode(executionId, edge.target);
            }
            break;
            
          case WorkflowNodeType.PARALLEL:
            // Execute all outgoing edges in parallel
            const parallelEdges = workflow.edges.filter(e => e.source === nodeId);
            parallelEdges.forEach(edge => {
              get().executeWorkflowNode(executionId, edge.target);
            });
            break;
            
          case WorkflowNodeType.END:
            set((state) => {
              const exec = state.activeExecutions.get(executionId);
              if (exec) {
                exec.status = WorkflowStatus.COMPLETED;
                exec.completedAt = new Date();
              }
            });
            break;
        }
      },

      evaluateCondition: (condition: any, context: Record<string, any>): boolean => {
        // Simple condition evaluation
        // In production, this would be more sophisticated
        const value = context[condition.field];
        
        switch (condition.operator) {
          case 'eq': return value === condition.value;
          case 'neq': return value !== condition.value;
          case 'gt': return value > condition.value;
          case 'gte': return value >= condition.value;
          case 'lt': return value < condition.value;
          case 'lte': return value <= condition.value;
          case 'contains': return value?.includes?.(condition.value);
          default: return false;
        }
      }
    }))
  )
);

/**
 * Orchestrator class for external API
 */
export class Orchestrator {
  private store = useOrchestratorStore;
  private intervals: NodeJS.Timeout[] = [];

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    // Start periodic tasks
    const config = this.store.getState().config;
    
    // Health check interval
    this.intervals.push(
      setInterval(() => {
        this.store.getState().performHealthCheck();
      }, config.healthCheckIntervalMs)
    );
    
    // Metrics update interval
    this.intervals.push(
      setInterval(() => {
        this.store.getState().updateMetrics();
      }, config.metricsUpdateIntervalMs)
    );
    
    // Message processing interval
    this.intervals.push(
      setInterval(() => {
        this.processMessageQueue();
      }, 1000)
    );
  }

  private processMessageQueue(): void {
    const state = this.store.getState();
    const now = Date.now();
    
    // Process expired messages
    const expiredMessages = state.messageQueue.filter(m => 
      m.metadata?.expiresAt && m.metadata.expiresAt.getTime() < now
    );
    
    if (expiredMessages.length > 0) {
      // Use the store's set method to properly update state
      this.store.setState((draft) => {
        expiredMessages.forEach(message => {
          const index = draft.messageQueue.findIndex(m => m.id === message.id);
          if (index !== -1) {
            draft.messageQueue.splice(index, 1);
          }
        });
      });
    }
    
    // Process high priority messages
    const urgentMessages = state.messageQueue
      .filter(m => m.priority === MessagePriority.URGENT)
      .slice(0, 10);
    
    urgentMessages.forEach(message => {
      this.store.getState().processMessage(message.id);
    });
  }

  public dispose(): void {
    // Clear all intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    
    // Reset store
    this.store.getState().reset();
  }
}

// Export singleton instance
export const orchestrator = new Orchestrator();