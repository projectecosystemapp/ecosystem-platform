/**
 * Agent Registry - Central repository for agent discovery and management
 * 
 * Provides a centralized registry for all agents in the system with
 * capability matching, health monitoring, and discovery mechanisms.
 */

import { 
  Agent, 
  AgentId, 
  AgentCapability, 
  AgentStatus, 
  AgentPriority,
  SystemEvent,
  EventType 
} from './types';

/**
 * Agent filter criteria for discovery
 */
export interface AgentFilter {
  capabilities?: AgentCapability[];
  status?: AgentStatus;
  priority?: AgentPriority;
  maxTasks?: number;
  minSuccessRate?: number;
  specializations?: string[];
}

/**
 * Agent match score for capability matching
 */
export interface AgentMatch {
  agent: Agent;
  score: number;
  matchedCapabilities: AgentCapability[];
  availability: number;
  estimatedResponseTime: number;
}

/**
 * Registry statistics
 */
export interface RegistryStats {
  totalAgents: number;
  activeAgents: number;
  idleAgents: number;
  errorAgents: number;
  offlineAgents: number;
  totalCapabilities: number;
  averageSuccessRate: number;
  averageResponseTime: number;
}

/**
 * Agent Registry implementation
 */
export class AgentRegistry {
  private agents: Map<AgentId, Agent>;
  private capabilityIndex: Map<AgentCapability, Set<AgentId>>;
  private specializationIndex: Map<string, Set<AgentId>>;
  private eventHandlers: Map<EventType, Set<(event: SystemEvent) => void>>;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.agents = new Map();
    this.capabilityIndex = new Map();
    this.specializationIndex = new Map();
    this.eventHandlers = new Map();
    this.initializeIndexes();
  }

  /**
   * Initialize capability and specialization indexes
   */
  private initializeIndexes(): void {
    // Initialize capability index with all possible capabilities
    Object.values(AgentCapability).forEach(capability => {
      this.capabilityIndex.set(capability, new Set());
    });
  }

  /**
   * Register a new agent
   */
  public registerAgent(agent: Agent): void {
    // Validate agent doesn't already exist
    if (this.agents.has(agent.id)) {
      throw new Error(`Agent ${agent.id} is already registered`);
    }

    // Add to main registry
    this.agents.set(agent.id, agent);

    // Update capability index
    agent.capabilities.forEach(capability => {
      const agents = this.capabilityIndex.get(capability) || new Set();
      agents.add(agent.id);
      this.capabilityIndex.set(capability, agents);
    });

    // Update specialization index
    if (agent.metadata.specializations) {
      agent.metadata.specializations.forEach(specialization => {
        const agents = this.specializationIndex.get(specialization) || new Set();
        agents.add(agent.id);
        this.specializationIndex.set(specialization, agents);
      });
    }

    // Emit registration event
    this.emitEvent({
      id: `evt_${Date.now()}`,
      type: EventType.AGENT_REGISTERED,
      timestamp: new Date(),
      source: 'registry',
      data: { agentId: agent.id, capabilities: agent.capabilities }
    });
  }

  /**
   * Unregister an agent
   */
  public unregisterAgent(agentId: AgentId): void {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Remove from capability index
    agent.capabilities.forEach(capability => {
      const agents = this.capabilityIndex.get(capability);
      if (agents) {
        agents.delete(agentId);
      }
    });

    // Remove from specialization index
    if (agent.metadata.specializations) {
      agent.metadata.specializations.forEach(specialization => {
        const agents = this.specializationIndex.get(specialization);
        if (agents) {
          agents.delete(agentId);
        }
      });
    }

    // Remove from main registry
    this.agents.delete(agentId);

    // Emit unregistration event
    this.emitEvent({
      id: `evt_${Date.now()}`,
      type: EventType.AGENT_UNREGISTERED,
      timestamp: new Date(),
      source: 'registry',
      data: { agentId }
    });
  }

  /**
   * Get agent by ID
   */
  public getAgent(agentId: AgentId): Agent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all agents
   */
  public getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Find agents by capabilities
   */
  public findAgentsByCapabilities(
    requiredCapabilities: AgentCapability[],
    optionalCapabilities: AgentCapability[] = []
  ): AgentMatch[] {
    const matches: AgentMatch[] = [];

    // Find agents that have all required capabilities
    const candidateAgentIds = new Set<AgentId>();
    
    if (requiredCapabilities.length === 0) {
      // If no required capabilities, consider all agents
      this.agents.forEach((_, id) => candidateAgentIds.add(id));
    } else {
      // Find intersection of agents with all required capabilities
      const capabilitySets = requiredCapabilities.map(cap => 
        this.capabilityIndex.get(cap) || new Set()
      );
      
      if (capabilitySets.length > 0) {
        const firstSet = capabilitySets[0];
        firstSet.forEach(agentId => {
          if (capabilitySets.every(set => set.has(agentId))) {
            candidateAgentIds.add(agentId);
          }
        });
      }
    }

    // Score and rank candidates
    candidateAgentIds.forEach(agentId => {
      const agent = this.agents.get(agentId);
      if (!agent) return;

      // Skip offline or error agents
      if (agent.status === AgentStatus.OFFLINE || agent.status === AgentStatus.ERROR) {
        return;
      }

      // Calculate match score
      let score = 0;
      const matchedCapabilities: AgentCapability[] = [];

      // Score for required capabilities (higher weight)
      requiredCapabilities.forEach(cap => {
        if (agent.capabilities.includes(cap)) {
          score += 10;
          matchedCapabilities.push(cap);
        }
      });

      // Score for optional capabilities (lower weight)
      optionalCapabilities.forEach(cap => {
        if (agent.capabilities.includes(cap)) {
          score += 5;
          matchedCapabilities.push(cap);
        }
      });

      // Adjust score based on agent metrics
      score += agent.metadata.successRate * 10;
      score -= agent.metadata.averageResponseTime / 1000; // Penalize slow agents
      
      // Adjust based on current load
      const currentLoad = this.calculateAgentLoad(agent);
      const availability = 1 - (currentLoad / agent.metadata.maxConcurrentTasks);
      score *= availability;

      // Priority bonus
      if (agent.priority === AgentPriority.CRITICAL) score *= 1.5;
      else if (agent.priority === AgentPriority.HIGH) score *= 1.2;

      matches.push({
        agent,
        score,
        matchedCapabilities,
        availability,
        estimatedResponseTime: agent.metadata.averageResponseTime * (1 + currentLoad)
      });
    });

    // Sort by score (highest first)
    return matches.sort((a, b) => b.score - a.score);
  }

  /**
   * Find agents by filter criteria
   */
  public findAgents(filter: AgentFilter): Agent[] {
    let agents = Array.from(this.agents.values());

    // Filter by capabilities
    if (filter.capabilities && filter.capabilities.length > 0) {
      agents = agents.filter(agent =>
        filter.capabilities!.every(cap => agent.capabilities.includes(cap))
      );
    }

    // Filter by status
    if (filter.status) {
      agents = agents.filter(agent => agent.status === filter.status);
    }

    // Filter by priority
    if (filter.priority) {
      agents = agents.filter(agent => agent.priority === filter.priority);
    }

    // Filter by success rate
    if (filter.minSuccessRate !== undefined) {
      agents = agents.filter(agent => 
        agent.metadata.successRate >= filter.minSuccessRate!
      );
    }

    // Filter by specializations
    if (filter.specializations && filter.specializations.length > 0) {
      agents = agents.filter(agent =>
        filter.specializations!.some(spec =>
          agent.metadata.specializations?.includes(spec)
        )
      );
    }

    return agents;
  }

  /**
   * Update agent status
   */
  public updateAgentStatus(agentId: AgentId, status: AgentStatus): void {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const oldStatus = agent.status;
    
    // Create a new agent object with updated properties to avoid mutating frozen objects
    const updatedAgent = {
      ...agent,
      status: status,
      metadata: {
        ...agent.metadata,
        lastActiveAt: new Date()
      }
    };
    
    // Replace the agent in the map with the updated version
    this.agents.set(agentId, updatedAgent);

    // Emit status change event
    this.emitEvent({
      id: `evt_${Date.now()}`,
      type: EventType.AGENT_STATUS_CHANGED,
      timestamp: new Date(),
      source: 'registry',
      data: { agentId, oldStatus, newStatus: status }
    });
  }

  /**
   * Update agent metrics
   */
  public updateAgentMetrics(
    agentId: AgentId, 
    metrics: Partial<Agent['metadata']>
  ): void {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Create a new agent object with updated metrics to avoid mutating frozen objects
    const updatedAgent = {
      ...agent,
      metadata: {
        ...agent.metadata,
        ...metrics
      }
    };
    
    // Replace the agent in the map with the updated version
    this.agents.set(agentId, updatedAgent);
  }

  /**
   * Get registry statistics
   */
  public getStats(): RegistryStats {
    const agents = Array.from(this.agents.values());
    
    const statusCounts = agents.reduce((acc, agent) => {
      acc[agent.status] = (acc[agent.status] || 0) + 1;
      return acc;
    }, {} as Record<AgentStatus, number>);

    const totalCapabilities = new Set(
      agents.flatMap(agent => agent.capabilities)
    ).size;

    const averageSuccessRate = agents.length > 0
      ? agents.reduce((sum, agent) => sum + agent.metadata.successRate, 0) / agents.length
      : 0;

    const averageResponseTime = agents.length > 0
      ? agents.reduce((sum, agent) => sum + agent.metadata.averageResponseTime, 0) / agents.length
      : 0;

    return {
      totalAgents: agents.length,
      activeAgents: statusCounts[AgentStatus.BUSY] || 0,
      idleAgents: statusCounts[AgentStatus.IDLE] || 0,
      errorAgents: statusCounts[AgentStatus.ERROR] || 0,
      offlineAgents: statusCounts[AgentStatus.OFFLINE] || 0,
      totalCapabilities,
      averageSuccessRate,
      averageResponseTime
    };
  }

  /**
   * Find best agent for task
   */
  public findBestAgentForTask(
    requiredCapabilities: AgentCapability[],
    preferredCapabilities: AgentCapability[] = [],
    constraints?: {
      maxResponseTime?: number;
      minSuccessRate?: number;
      excludeAgents?: AgentId[];
    }
  ): Agent | null {
    let matches = this.findAgentsByCapabilities(
      requiredCapabilities, 
      preferredCapabilities
    );

    // Apply constraints
    if (constraints) {
      if (constraints.maxResponseTime) {
        matches = matches.filter(m => 
          m.estimatedResponseTime <= constraints.maxResponseTime!
        );
      }
      if (constraints.minSuccessRate) {
        matches = matches.filter(m => 
          m.agent.metadata.successRate >= constraints.minSuccessRate!
        );
      }
      if (constraints.excludeAgents) {
        matches = matches.filter(m => 
          !constraints.excludeAgents!.includes(m.agent.id)
        );
      }
    }

    return matches.length > 0 ? matches[0].agent : null;
  }

  /**
   * Calculate agent load
   */
  private calculateAgentLoad(agent: Agent): number {
    // This would be calculated based on active tasks
    // For now, return a simulated value
    return agent.status === AgentStatus.BUSY ? 0.7 : 0.2;
  }

  /**
   * Start health check monitoring
   */
  public startHealthMonitoring(intervalMs: number = 30000): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, intervalMs);
  }

  /**
   * Stop health check monitoring
   */
  public stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Perform health check on all agents
   */
  private async performHealthCheck(): Promise<void> {
    const agents = Array.from(this.agents.values());
    
    for (const agent of agents) {
      // Check if agent has been inactive for too long
      const inactiveThreshold = 5 * 60 * 1000; // 5 minutes
      const timeSinceLastActive = Date.now() - agent.metadata.lastActiveAt.getTime();
      
      if (timeSinceLastActive > inactiveThreshold && agent.status === AgentStatus.IDLE) {
        // Perform health check (would normally ping the agent)
        // For now, simulate health check
        const isHealthy = Math.random() > 0.1; // 90% healthy
        
        if (!isHealthy) {
          this.updateAgentStatus(agent.id, AgentStatus.ERROR);
        }
      }
    }
  }

  /**
   * Subscribe to registry events
   */
  public on(eventType: EventType, handler: (event: SystemEvent) => void): void {
    const handlers = this.eventHandlers.get(eventType) || new Set();
    handlers.add(handler);
    this.eventHandlers.set(eventType, handlers);
  }

  /**
   * Unsubscribe from registry events
   */
  public off(eventType: EventType, handler: (event: SystemEvent) => void): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Emit a system event
   */
  private emitEvent(event: SystemEvent): void {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      handlers.forEach(handler => handler(event));
    }
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    this.stopHealthMonitoring();
    this.agents.clear();
    this.capabilityIndex.clear();
    this.specializationIndex.clear();
    this.eventHandlers.clear();
  }
}

// Singleton instance
export const agentRegistry = new AgentRegistry();