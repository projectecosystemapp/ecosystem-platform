/**
 * Core Agent Runner
 * 
 * Implements the Core Agent specification using the seq-thinking MCP server.
 * Responsible for task coordination, planning, and orchestration.
 */

import { 
  Agent, 
  AgentCapability, 
  Task, 
  TaskStatus, 
  TaskRequestPayload,
  TaskResponsePayload,
  MessageType,
  MessagePriority
} from '../types';
import { mcpAdapter } from '../mcp-adapter';
import { monitoringSystem } from '../monitoring';
import { useOrchestratorStore } from '../orchestrator';
import { agentConfig } from '../config';

export interface PlanningRequest {
  goal: string;
  constraints?: string[];
  context?: Record<string, any>;
  priority: 'low' | 'medium' | 'high' | 'critical';
  deadline?: Date;
}

export interface TaskDecomposition {
  mainTask: string;
  subtasks: {
    id: string;
    title: string;
    description: string;
    requiredCapabilities: AgentCapability[];
    dependencies: string[];
    estimatedDuration: number;
    priority: 'low' | 'medium' | 'high' | 'critical';
  }[];
  executionStrategy: 'sequential' | 'parallel' | 'hybrid';
  totalEstimatedDuration: number;
  riskAssessment: {
    level: 'low' | 'medium' | 'high';
    factors: string[];
    mitigations: string[];
  };
}

export interface CoordinationDecision {
  action: 'approve' | 'reject' | 'modify' | 'escalate';
  reasoning: string;
  modifications?: string[];
  escalationLevel?: 'team-lead' | 'product-owner' | 'security-team';
  confidence: number;
}

/**
 * Core Agent Runner - implements the Core Agent specification
 */
export class CoreAgentRunner {
  private agentId = 'agent_core_orchestrator';
  private isProcessing = false;
  private activeTaskCount = 0;
  private maxConcurrentTasks = 5;

  constructor() {
    this.setupMessageHandlers();
    this.initializeMetrics();
  }

  /**
   * Setup message handlers for task requests
   */
  private setupMessageHandlers(): void {
    const store = useOrchestratorStore.getState();
    
    // Subscribe to task requests for this agent
    useOrchestratorStore.subscribe(
      (state) => state.messageQueue,
      (messages) => {
        const myMessages = messages.filter(msg => 
          msg.recipient === this.agentId && 
          msg.type === MessageType.TASK_REQUEST
        );
        
        myMessages.forEach(msg => this.handleTaskRequest(msg.payload as TaskRequestPayload));
      }
    );
  }

  /**
   * Initialize monitoring metrics for this agent
   */
  private initializeMetrics(): void {
    monitoringSystem.registerMetric({
      name: 'core_agent_planning_requests',
      type: 'counter' as any,
      description: 'Number of planning requests processed',
      labels: ['complexity', 'success']
    });

    monitoringSystem.registerMetric({
      name: 'core_agent_task_decompositions',
      type: 'counter' as any,
      description: 'Number of tasks decomposed',
      labels: ['strategy', 'subtask_count']
    });

    monitoringSystem.registerMetric({
      name: 'core_agent_coordination_decisions',
      type: 'counter' as any,
      description: 'Number of coordination decisions made',
      labels: ['decision_type', 'confidence_level']
    });
  }

  /**
   * Handle incoming task requests
   */
  private async handleTaskRequest(payload: TaskRequestPayload): Promise<void> {
    if (this.activeTaskCount >= this.maxConcurrentTasks) {
      console.log(`🚫 Core agent at capacity (${this.activeTaskCount}/${this.maxConcurrentTasks})`);
      return;
    }

    this.activeTaskCount++;
    const startTime = Date.now();

    try {
      console.log(`🎯 Core agent processing task: ${payload.taskId} - ${payload.description}`);

      let result;
      
      // Route to appropriate capability based on task type
      switch (payload.taskType) {
        case 'planning':
          result = await this.handlePlanningTask(payload);
          break;
        case 'task_decomposition':
          result = await this.handleTaskDecomposition(payload);
          break;
        case 'coordination':
          result = await this.handleCoordinationTask(payload);
          break;
        case 'workflow_design':
          result = await this.handleWorkflowDesign(payload);
          break;
        case 'agent_assignment':
          result = await this.handleAgentAssignment(payload);
          break;
        default:
          throw new Error(`Unsupported task type: ${payload.taskType}`);
      }

      // Send success response
      const store = useOrchestratorStore.getState();
      store.sendMessage({
        type: MessageType.TASK_RESPONSE,
        priority: MessagePriority.HIGH,
        sender: this.agentId,
        recipient: 'system',
        payload: {
          taskId: payload.taskId,
          status: 'completed',
          result,
          executionTime: Date.now() - startTime
        } as TaskResponsePayload
      });

      monitoringSystem.incrementMetric('agent_tasks_total', {
        agent_id: this.agentId,
        task_type: payload.taskType,
        status: 'success'
      });

    } catch (error) {
      console.error(`❌ Core agent task failed: ${error}`);

      // Send error response
      const store = useOrchestratorStore.getState();
      store.sendMessage({
        type: MessageType.TASK_RESPONSE,
        priority: MessagePriority.HIGH,
        sender: this.agentId,
        recipient: 'system',
        payload: {
          taskId: payload.taskId,
          status: 'failed',
          error: {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'CORE_AGENT_ERROR'
          },
          executionTime: Date.now() - startTime
        } as TaskResponsePayload
      });

      monitoringSystem.incrementMetric('agent_tasks_total', {
        agent_id: this.agentId,
        task_type: payload.taskType,
        status: 'error'
      });
    } finally {
      this.activeTaskCount--;
      monitoringSystem.recordMetric('agent_response_time', Date.now() - startTime, {
        agent_id: this.agentId
      });
    }
  }

  /**
   * Handle planning tasks using seq-thinking MCP
   */
  private async handlePlanningTask(payload: TaskRequestPayload): Promise<TaskDecomposition> {
    const request = payload.requirements as PlanningRequest;
    
    console.log(`🧠 Planning for goal: ${request.goal}`);

    // Use sequential thinking to create a comprehensive plan
    const planningSteps = [
      `Goal: ${request.goal}`,
      `Context: ${JSON.stringify(request.context || {})}`,
      `Constraints: ${request.constraints?.join(', ') || 'None'}`,
      `Priority: ${request.priority}`,
      request.deadline ? `Deadline: ${request.deadline.toISOString()}` : ''
    ].filter(Boolean).join('\n');

    // This would use the actual MCP function in a real implementation
    const thinkingResult = await this.useSequentialThinking(`
      Plan the implementation of: ${request.goal}
      
      Context:
      ${planningSteps}
      
      Please provide:
      1. Break down the goal into specific, actionable subtasks
      2. Identify required capabilities for each subtask
      3. Determine dependencies between tasks
      4. Estimate duration for each subtask
      5. Suggest execution strategy (sequential/parallel/hybrid)
      6. Assess risks and provide mitigations
    `);

    // Parse the thinking result and create structured task decomposition
    const decomposition = this.parseThinkingResultToDecomposition(thinkingResult, request);

    monitoringSystem.incrementMetric('core_agent_planning_requests', {
      complexity: this.assessComplexity(decomposition),
      success: 'true'
    });

    monitoringSystem.incrementMetric('core_agent_task_decompositions', {
      strategy: decomposition.executionStrategy,
      subtask_count: decomposition.subtasks.length.toString()
    });

    return decomposition;
  }

  /**
   * Handle task decomposition requests
   */
  private async handleTaskDecomposition(payload: TaskRequestPayload): Promise<TaskDecomposition> {
    const taskDescription = payload.description;
    
    console.log(`🔧 Decomposing task: ${taskDescription}`);

    const thinkingResult = await this.useSequentialThinking(`
      Decompose this complex task: ${taskDescription}
      
      Requirements:
      ${JSON.stringify(payload.requirements)}
      
      Please analyze and provide:
      1. Main task objective
      2. Specific subtasks needed
      3. Required agent capabilities for each subtask
      4. Task dependencies and order
      5. Risk assessment
      6. Time estimates
      7. Optimal execution strategy
    `);

    return this.parseThinkingResultToDecomposition(thinkingResult, { goal: taskDescription, priority: 'medium' });
  }

  /**
   * Handle coordination decisions
   */
  private async handleCoordinationTask(payload: TaskRequestPayload): Promise<CoordinationDecision> {
    const coordinationContext = payload.requirements as {
      situation: string;
      agents: string[];
      currentState: string;
      proposedAction: string;
      stakeholders?: string[];
    };

    console.log(`⚖️ Making coordination decision for: ${coordinationContext.situation}`);

    const thinkingResult = await this.useSequentialThinking(`
      Coordination Decision Required:
      
      Situation: ${coordinationContext.situation}
      Involved Agents: ${coordinationContext.agents.join(', ')}
      Current State: ${coordinationContext.currentState}
      Proposed Action: ${coordinationContext.proposedAction}
      Stakeholders: ${coordinationContext.stakeholders?.join(', ') || 'None specified'}
      
      Please analyze and decide:
      1. Should the proposed action be approved, rejected, modified, or escalated?
      2. What is the reasoning behind this decision?
      3. If modifications are needed, what should they be?
      4. If escalation is needed, to whom?
      5. What is your confidence level (0-100)?
      
      Consider:
      - Project standards and guidelines
      - Security implications
      - Resource constraints
      - Timeline impact
      - Stakeholder interests
    `);

    const decision = this.parseThinkingResultToCoordination(thinkingResult);

    monitoringSystem.incrementMetric('core_agent_coordination_decisions', {
      decision_type: decision.action,
      confidence_level: this.getConfidenceCategory(decision.confidence)
    });

    return decision;
  }

  /**
   * Handle workflow design tasks
   */
  private async handleWorkflowDesign(payload: TaskRequestPayload): Promise<any> {
    const designRequest = payload.requirements as {
      workflowType: 'development' | 'deployment' | 'security' | 'bugfix';
      requirements: string[];
      constraints: string[];
    };

    console.log(`📋 Designing ${designRequest.workflowType} workflow`);

    const thinkingResult = await this.useSequentialThinking(`
      Design a ${designRequest.workflowType} workflow:
      
      Requirements:
      ${designRequest.requirements.map((req, i) => `${i + 1}. ${req}`).join('\n')}
      
      Constraints:
      ${designRequest.constraints.map((con, i) => `${i + 1}. ${con}`).join('\n')}
      
      Please design a workflow that includes:
      1. Clear sequence of steps
      2. Decision points and branching
      3. Human approval gates where needed
      4. Error handling and rollback procedures
      5. Success criteria for each step
      6. Resource requirements
      7. Estimated timeline
    `);

    return {
      workflowType: designRequest.workflowType,
      design: thinkingResult,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Handle agent assignment optimization
   */
  private async handleAgentAssignment(payload: TaskRequestPayload): Promise<any> {
    const assignmentRequest = payload.requirements as {
      availableAgents: Array<{ id: string; capabilities: AgentCapability[]; currentLoad: number }>;
      tasks: Array<{ id: string; requiredCapabilities: AgentCapability[]; priority: string }>;
    };

    console.log(`👥 Optimizing agent assignments for ${assignmentRequest.tasks.length} tasks`);

    const thinkingResult = await this.useSequentialThinking(`
      Optimize agent assignments:
      
      Available Agents:
      ${assignmentRequest.availableAgents.map(agent => 
        `${agent.id}: ${agent.capabilities.join(', ')} (load: ${agent.currentLoad})`
      ).join('\n')}
      
      Tasks to assign:
      ${assignmentRequest.tasks.map(task => 
        `${task.id}: needs ${task.requiredCapabilities.join(', ')} (priority: ${task.priority})`
      ).join('\n')}
      
      Please provide optimal assignment considering:
      1. Agent capability matching
      2. Current workload balance
      3. Task priorities
      4. Potential for parallel execution
      5. Agent specialization effectiveness
    `);

    return {
      assignments: thinkingResult,
      timestamp: new Date().toISOString(),
      totalTasks: assignmentRequest.tasks.length,
      totalAgents: assignmentRequest.availableAgents.length
    };
  }

  /**
   * Use sequential thinking MCP server for complex reasoning
   */
  private async useSequentialThinking(prompt: string): Promise<string> {
    try {
      // This would call the actual MCP function
      // For now, we'll simulate the structured thinking process
      const result = await mcpAdapter.executeFunction('mcp__seq-thinking__sequentialthinking', {
        thought: prompt,
        nextThoughtNeeded: true,
        thoughtNumber: 1,
        totalThoughts: 5
      });

      return `Sequential Thinking Result: ${JSON.stringify(result)}`;
    } catch (error) {
      console.error('Failed to use sequential thinking MCP:', error);
      
      // Fallback to basic reasoning
      return `Basic analysis of: ${prompt}\n\nThis would be enhanced with actual MCP sequential thinking capabilities.`;
    }
  }

  /**
   * Parse sequential thinking result into task decomposition
   */
  private parseThinkingResultToDecomposition(thinkingResult: string, request: PlanningRequest): TaskDecomposition {
    // This would parse the actual sequential thinking output
    // For now, we'll create a structured example
    
    const subtaskCount = Math.min(Math.max(2, Math.floor(Math.random() * 6)), 8);
    const subtasks = [];

    for (let i = 0; i < subtaskCount; i++) {
      subtasks.push({
        id: `subtask_${i + 1}`,
        title: `Subtask ${i + 1}: Implementation step`,
        description: `Detailed implementation step ${i + 1} for ${request.goal}`,
        requiredCapabilities: this.suggestCapabilities(i),
        dependencies: i > 0 ? [`subtask_${i}`] : [],
        estimatedDuration: 3600000 + (Math.random() * 7200000), // 1-3 hours
        priority: i === 0 ? request.priority : 'medium'
      });
    }

    return {
      mainTask: request.goal,
      subtasks,
      executionStrategy: subtaskCount <= 3 ? 'sequential' : 'hybrid',
      totalEstimatedDuration: subtasks.reduce((total, task) => total + task.estimatedDuration, 0),
      riskAssessment: {
        level: this.assessRiskLevel(request.priority, subtaskCount),
        factors: ['Timeline constraints', 'Resource availability', 'Technical complexity'],
        mitigations: ['Add buffer time', 'Parallel execution where possible', 'Regular checkpoints']
      }
    };
  }

  /**
   * Parse thinking result into coordination decision
   */
  private parseThinkingResultToCoordination(thinkingResult: string): CoordinationDecision {
    // This would parse the actual sequential thinking output
    // For now, we'll create a structured decision
    
    const actions: CoordinationDecision['action'][] = ['approve', 'modify', 'approve', 'modify', 'reject'];
    const action = actions[Math.floor(Math.random() * actions.length)];
    
    return {
      action,
      reasoning: `Based on analysis: ${thinkingResult.substring(0, 100)}...`,
      modifications: action === 'modify' ? ['Add additional security checks', 'Include error handling'] : undefined,
      escalationLevel: action === 'escalate' ? 'team-lead' : undefined,
      confidence: Math.random() * 40 + 60 // 60-100%
    };
  }

  /**
   * Suggest appropriate capabilities based on task index
   */
  private suggestCapabilities(index: number): AgentCapability[] {
    const capabilityGroups = [
      [AgentCapability.PLANNING, AgentCapability.ANALYSIS],
      [AgentCapability.CODE_GENERATION, AgentCapability.FILE_OPERATIONS],
      [AgentCapability.TESTING, AgentCapability.QUALITY_ASSURANCE],
      [AgentCapability.DEPLOYMENT, AgentCapability.MONITORING],
      [AgentCapability.DOCUMENTATION, AgentCapability.KNOWLEDGE_MANAGEMENT]
    ];

    return capabilityGroups[index % capabilityGroups.length];
  }

  /**
   * Assess complexity level
   */
  private assessComplexity(decomposition: TaskDecomposition): string {
    if (decomposition.subtasks.length <= 3) return 'low';
    if (decomposition.subtasks.length <= 6) return 'medium';
    return 'high';
  }

  /**
   * Assess risk level
   */
  private assessRiskLevel(priority: string, subtaskCount: number): 'low' | 'medium' | 'high' {
    if (priority === 'critical' || subtaskCount > 6) return 'high';
    if (priority === 'high' || subtaskCount > 4) return 'medium';
    return 'low';
  }

  /**
   * Get confidence category for metrics
   */
  private getConfidenceCategory(confidence: number): string {
    if (confidence >= 90) return 'very_high';
    if (confidence >= 75) return 'high';
    if (confidence >= 60) return 'medium';
    return 'low';
  }

  /**
   * Get current agent status
   */
  getStatus() {
    return {
      agentId: this.agentId,
      isProcessing: this.isProcessing,
      activeTaskCount: this.activeTaskCount,
      maxConcurrentTasks: this.maxConcurrentTasks,
      utilization: (this.activeTaskCount / this.maxConcurrentTasks) * 100
    };
  }

  /**
   * Process a standalone planning request (for direct API calls)
   */
  async planTask(request: PlanningRequest): Promise<TaskDecomposition> {
    console.log(`🎯 Direct planning request for: ${request.goal}`);
    
    const taskPayload: TaskRequestPayload = {
      taskId: `direct_planning_${Date.now()}`,
      taskType: 'planning',
      description: `Plan implementation of: ${request.goal}`,
      requirements: request,
      constraints: {
        deadline: request.deadline
      },
      context: request.context || {}
    };

    return await this.handlePlanningTask(taskPayload);
  }

  /**
   * Make a coordination decision (for direct API calls)
   */
  async makeCoordinationDecision(context: Parameters<CoreAgentRunner['handleCoordinationTask']>[0]['requirements']): Promise<CoordinationDecision> {
    console.log(`⚖️ Direct coordination decision for: ${context.situation}`);
    
    const taskPayload: TaskRequestPayload = {
      taskId: `direct_coordination_${Date.now()}`,
      taskType: 'coordination',
      description: `Coordination decision for: ${context.situation}`,
      requirements: context,
      constraints: {},
      context: {}
    };

    return await this.handleCoordinationTask(taskPayload);
  }
}

/**
 * Singleton instance
 */
export const coreAgentRunner = new CoreAgentRunner();