/**
 * Agent Orchestration System - Type Definitions
 * 
 * Core type system for the agent orchestration platform.
 * Implements graph-based architecture with specialized agent roles.
 */

import { z } from 'zod';

// ============================================================================
// Core Agent Types
// ============================================================================

/**
 * Unique identifier for agents in the system
 */
export type AgentId = `agent_${string}`;

/**
 * Agent capability definitions
 */
export enum AgentCapability {
  CODE_GENERATION = 'code_generation',
  CODE_REVIEW = 'code_review',
  TESTING = 'testing',
  DEPLOYMENT = 'deployment',
  MONITORING = 'monitoring',
  SECURITY_AUDIT = 'security_audit',
  DATABASE_OPERATIONS = 'database_operations',
  API_INTEGRATION = 'api_integration',
  DOCUMENTATION = 'documentation',
  PERFORMANCE_OPTIMIZATION = 'performance_optimization',
  BUG_FIXING = 'bug_fixing',
  REFACTORING = 'refactoring',
  DATA_ANALYSIS = 'data_analysis',
  USER_INTERACTION = 'user_interaction',
  WORKFLOW_COORDINATION = 'workflow_coordination',
  PLANNING = 'planning',
  DECISION_MAKING = 'decision_making',
  FILE_OPERATIONS = 'file_operations',
  QUERY_OPTIMIZATION = 'query_optimization',
  DEBUGGING = 'debugging',
  TASK_MANAGEMENT = 'task_management',
  COORDINATION = 'coordination',
  PROBLEM_SOLVING = 'problem_solving',
  KNOWLEDGE_MANAGEMENT = 'knowledge_management',
  CONTEXT_UNDERSTANDING = 'context_understanding',
  VERSION_CONTROL = 'version_control',
  COLLABORATION = 'collaboration',
  QUALITY_ASSURANCE = 'quality_assurance',
}

/**
 * Agent status states
 */
export enum AgentStatus {
  IDLE = 'idle',
  BUSY = 'busy',
  ERROR = 'error',
  OFFLINE = 'offline',
  INITIALIZING = 'initializing',
  TERMINATED = 'terminated',
}

/**
 * Agent priority levels
 */
export enum AgentPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

/**
 * Base agent interface
 */
export interface Agent {
  id: AgentId;
  name: string;
  description: string;
  capabilities: AgentCapability[];
  status: AgentStatus;
  priority: AgentPriority;
  version: string;
  metadata: {
    createdAt: Date;
    lastActiveAt: Date;
    totalTasksCompleted: number;
    averageResponseTime: number;
    successRate: number;
    specializations?: string[];
    dependencies?: AgentId[];
    maxConcurrentTasks: number;
  };
  config: {
    timeout: number;
    retryPolicy: {
      maxRetries: number;
      backoffMultiplier: number;
      initialDelay: number;
    };
    resourceLimits: {
      maxMemoryMB: number;
      maxCPUPercent: number;
    };
  };
}

// ============================================================================
// Message Types
// ============================================================================

/**
 * Message types for inter-agent communication
 */
export enum MessageType {
  TASK_REQUEST = 'task_request',
  TASK_RESPONSE = 'task_response',
  STATUS_UPDATE = 'status_update',
  ERROR_REPORT = 'error_report',
  CAPABILITY_QUERY = 'capability_query',
  CAPABILITY_RESPONSE = 'capability_response',
  COORDINATION = 'coordination',
  HUMAN_APPROVAL_REQUEST = 'human_approval_request',
  HUMAN_APPROVAL_RESPONSE = 'human_approval_response',
  METRICS_UPDATE = 'metrics_update',
  HEARTBEAT = 'heartbeat',
}

/**
 * Message priority levels
 */
export enum MessagePriority {
  URGENT = 'urgent',
  HIGH = 'high',
  NORMAL = 'normal',
  LOW = 'low',
}

/**
 * Base message interface
 */
export interface Message<T = unknown> {
  id: string;
  type: MessageType;
  priority: MessagePriority;
  sender: AgentId | 'system' | 'human';
  recipient: AgentId | 'broadcast' | 'human';
  timestamp: Date;
  correlationId?: string;
  replyTo?: string;
  payload: T;
  metadata: {
    retryCount?: number;
    expiresAt?: Date;
    requiresAcknowledgment?: boolean;
    encrypted?: boolean;
  };
}

/**
 * Task request payload
 */
export interface TaskRequestPayload {
  taskId: string;
  taskType: string;
  description: string;
  requirements: Record<string, any>;
  constraints: {
    deadline?: Date;
    budget?: number;
    qualityThreshold?: number;
  };
  context: {
    workflowId?: string;
    parentTaskId?: string;
    environment?: string;
    dependencies?: string[];
  };
}

/**
 * Task response payload
 */
export interface TaskResponsePayload {
  taskId: string;
  status: 'accepted' | 'rejected' | 'completed' | 'failed' | 'partial';
  result?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metrics: {
    startTime: Date;
    endTime?: Date;
    duration?: number;
    resourcesUsed?: Record<string, number>;
  };
}

// ============================================================================
// Task & Workflow Types
// ============================================================================

/**
 * Task status states
 */
export enum TaskStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  AWAITING_APPROVAL = 'awaiting_approval',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  RETRYING = 'retrying',
}

/**
 * Task definition
 */
export interface Task {
  id: string;
  type: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: AgentPriority;
  assignedTo?: AgentId;
  requiredCapabilities: AgentCapability[];
  input: Record<string, any>;
  output?: Record<string, any>;
  error?: Error;
  metadata: {
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    deadline?: Date;
    retryCount: number;
    maxRetries: number;
    parentTaskId?: string;
    workflowId?: string;
    humanApprovalRequired?: boolean;
    estimatedDuration?: number;
  };
  dependencies: string[];
  subtasks: string[];
  checkpoints: TaskCheckpoint[];
}

/**
 * Task checkpoint for recovery
 */
export interface TaskCheckpoint {
  id: string;
  taskId: string;
  timestamp: Date;
  state: Record<string, any>;
  description: string;
}

/**
 * Workflow status states
 */
export enum WorkflowStatus {
  DRAFT = 'draft',
  READY = 'ready',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Workflow node types
 */
export enum WorkflowNodeType {
  START = 'start',
  END = 'end',
  TASK = 'task',
  DECISION = 'decision',
  PARALLEL = 'parallel',
  LOOP = 'loop',
  HUMAN_APPROVAL = 'human_approval',
  SUBWORKFLOW = 'subworkflow',
  ERROR_HANDLER = 'error_handler',
}

/**
 * Workflow node definition
 */
export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  name: string;
  description?: string;
  task?: Task;
  conditions?: WorkflowCondition[];
  config: Record<string, any>;
  position: { x: number; y: number };
}

/**
 * Workflow edge definition
 */
export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  condition?: WorkflowCondition;
  label?: string;
}

/**
 * Workflow condition
 */
export interface WorkflowCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'regex';
  value: any;
  combinator?: 'and' | 'or';
}

/**
 * Workflow definition
 */
export interface Workflow {
  id: string;
  name: string;
  description: string;
  version: string;
  status: WorkflowStatus;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables: Record<string, any>;
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    author: string;
    tags: string[];
    category: string;
    estimatedDuration?: number;
    successRate?: number;
    lastExecutedAt?: Date;
  };
  config: {
    maxExecutionTime: number;
    maxRetries: number;
    parallelismLimit: number;
    requiresApproval: boolean;
    notificationChannels: string[];
  };
}

/**
 * Workflow execution instance
 */
export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: WorkflowStatus;
  startedAt: Date;
  completedAt?: Date;
  currentNode?: string;
  executionPath: string[];
  context: Record<string, any>;
  results: Record<string, any>;
  errors: Array<{
    nodeId: string;
    error: Error;
    timestamp: Date;
  }>;
  metrics: {
    totalDuration?: number;
    nodesExecuted: number;
    nodesSkipped: number;
    nodesFailed: number;
    resourceUsage: Record<string, number>;
  };
}

// ============================================================================
// State Management Types
// ============================================================================

/**
 * Agent orchestrator state
 */
export interface OrchestratorState {
  // Agents
  agents: Map<AgentId, Agent>;
  agentStatuses: Map<AgentId, AgentStatus>;
  
  // Tasks
  tasks: Map<string, Task>;
  taskQueue: string[];
  activeTasks: Map<string, AgentId>;
  
  // Workflows
  workflows: Map<string, Workflow>;
  activeExecutions: Map<string, WorkflowExecution>;
  
  // Messages
  messageQueue: Message[];
  messageHistory: Message[];
  
  // Metrics
  metrics: {
    totalTasksProcessed: number;
    totalTasksFailed: number;
    averageTaskDuration: number;
    agentUtilization: Map<AgentId, number>;
    systemLoad: number;
    errorRate: number;
  };
  
  // System
  systemStatus: 'healthy' | 'degraded' | 'critical';
  lastHealthCheck: Date;
  config: OrchestratorConfig;
}

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  maxConcurrentTasks: number;
  taskTimeoutMs: number;
  messageRetentionMs: number;
  healthCheckIntervalMs: number;
  metricsUpdateIntervalMs: number;
  enableHumanInTheLoop: boolean;
  enableAutoScaling: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * System event types
 */
export enum EventType {
  AGENT_REGISTERED = 'agent_registered',
  AGENT_UNREGISTERED = 'agent_unregistered',
  AGENT_STATUS_CHANGED = 'agent_status_changed',
  TASK_CREATED = 'task_created',
  TASK_ASSIGNED = 'task_assigned',
  TASK_COMPLETED = 'task_completed',
  TASK_FAILED = 'task_failed',
  WORKFLOW_STARTED = 'workflow_started',
  WORKFLOW_COMPLETED = 'workflow_completed',
  WORKFLOW_FAILED = 'workflow_failed',
  MESSAGE_SENT = 'message_sent',
  MESSAGE_RECEIVED = 'message_received',
  SYSTEM_ERROR = 'system_error',
  METRICS_UPDATED = 'metrics_updated',
}

/**
 * System event
 */
export interface SystemEvent {
  id: string;
  type: EventType;
  timestamp: Date;
  source: string;
  data: Record<string, any>;
  metadata?: Record<string, any>;
}

// ============================================================================
// Validation Schemas
// ============================================================================

/**
 * Agent validation schema
 */
export const AgentSchema = z.object({
  id: z.string().startsWith('agent_'),
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  capabilities: z.array(z.nativeEnum(AgentCapability)),
  status: z.nativeEnum(AgentStatus),
  priority: z.nativeEnum(AgentPriority),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
});

/**
 * Task validation schema
 */
export const TaskSchema = z.object({
  id: z.string().uuid(),
  type: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string(),
  status: z.nativeEnum(TaskStatus),
  priority: z.nativeEnum(AgentPriority),
  requiredCapabilities: z.array(z.nativeEnum(AgentCapability)),
  input: z.record(z.any()),
});

/**
 * Message validation schema
 */
export const MessageSchema = z.object({
  id: z.string().uuid(),
  type: z.nativeEnum(MessageType),
  priority: z.nativeEnum(MessagePriority),
  sender: z.string(),
  recipient: z.string(),
  timestamp: z.date(),
  payload: z.any(),
});

// ============================================================================
// Type Guards
// ============================================================================

export const isAgent = (obj: any): obj is Agent => {
  return AgentSchema.safeParse(obj).success;
};

export const isTask = (obj: any): obj is Task => {
  return TaskSchema.safeParse(obj).success;
};

export const isMessage = (obj: any): obj is Message => {
  return MessageSchema.safeParse(obj).success;
};

export const isWorkflow = (obj: any): obj is Workflow => {
  return obj && typeof obj === 'object' && 
    'nodes' in obj && 
    'edges' in obj &&
    Array.isArray(obj.nodes) &&
    Array.isArray(obj.edges);
};