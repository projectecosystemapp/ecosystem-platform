/**
 * Agent Registry Unit Tests
 * 
 * Comprehensive test suite for agent registry functionality including
 * agent discovery, capability matching, health monitoring, and event handling.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AgentRegistry } from '../registry';
import {
  Agent,
  AgentId,
  AgentCapability,
  AgentStatus,
  AgentPriority,
  SystemEvent,
  EventType
} from '../types';

describe('Agent Registry Unit Tests', () => {
  let registry: AgentRegistry;

  // Test data factory
  const createTestAgent = (
    id: string,
    capabilities: AgentCapability[],
    status: AgentStatus = AgentStatus.IDLE,
    priority: AgentPriority = AgentPriority.MEDIUM
  ): Agent => ({
    id: `agent_${id}` as AgentId,
    name: `Test Agent ${id}`,
    description: `Test agent ${id} for unit testing`,
    capabilities,
    status,
    priority,
    version: '1.0.0',
    metadata: {
      createdAt: new Date(),
      lastActiveAt: new Date(),
      totalTasksCompleted: Math.floor(Math.random() * 100),
      averageResponseTime: Math.floor(Math.random() * 500) + 100,
      successRate: 0.8 + Math.random() * 0.2,
      specializations: [`spec_${id}`],
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

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  afterEach(() => {
    registry.dispose();
  });

  describe('Agent Registration', () => {
    test('should register a new agent successfully', () => {
      const agent = createTestAgent('test1', [AgentCapability.CODE_GENERATION]);
      
      registry.registerAgent(agent);
      
      expect(registry.getAgent(agent.id)).toEqual(agent);
      expect(registry.getAllAgents()).toContainEqual(agent);
    });

    test('should throw error when registering duplicate agent', () => {
      const agent = createTestAgent('test1', [AgentCapability.TESTING]);
      
      registry.registerAgent(agent);
      
      expect(() => {
        registry.registerAgent(agent);
      }).toThrow(`Agent ${agent.id} is already registered`);
    });

    test('should update capability index on registration', () => {
      const capabilities = [
        AgentCapability.CODE_GENERATION,
        AgentCapability.CODE_REVIEW,
        AgentCapability.TESTING
      ];
      const agent = createTestAgent('test1', capabilities);
      
      registry.registerAgent(agent);
      
      const matches = registry.findAgentsByCapabilities(capabilities);
      expect(matches).toHaveLength(1);
      expect(matches[0].agent.id).toBe(agent.id);
    });

    test('should update specialization index on registration', () => {
      const agent = createTestAgent('test1', [AgentCapability.CODE_GENERATION]);
      agent.metadata.specializations = ['backend', 'api', 'database'];
      
      registry.registerAgent(agent);
      
      const found = registry.findAgents({
        specializations: ['backend']
      });
      expect(found).toContainEqual(agent);
    });

    test('should emit registration event', () => {
      const agent = createTestAgent('test1', [AgentCapability.DEPLOYMENT]);
      const eventHandler = jest.fn();
      
      registry.on(EventType.AGENT_REGISTERED, eventHandler);
      registry.registerAgent(agent);
      
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EventType.AGENT_REGISTERED,
          data: expect.objectContaining({
            agentId: agent.id,
            capabilities: agent.capabilities
          })
        })
      );
    });

    test('should handle multiple agent registrations', () => {
      const agents = [
        createTestAgent('test1', [AgentCapability.CODE_GENERATION]),
        createTestAgent('test2', [AgentCapability.TESTING]),
        createTestAgent('test3', [AgentCapability.DEPLOYMENT]),
        createTestAgent('test4', [AgentCapability.MONITORING]),
        createTestAgent('test5', [AgentCapability.SECURITY_AUDIT])
      ];
      
      agents.forEach(agent => registry.registerAgent(agent));
      
      expect(registry.getAllAgents()).toHaveLength(5);
      agents.forEach(agent => {
        expect(registry.getAgent(agent.id)).toEqual(agent);
      });
    });
  });

  describe('Agent Unregistration', () => {
    test('should unregister agent successfully', () => {
      const agent = createTestAgent('test1', [AgentCapability.CODE_REVIEW]);
      registry.registerAgent(agent);
      
      registry.unregisterAgent(agent.id);
      
      expect(registry.getAgent(agent.id)).toBeUndefined();
      expect(registry.getAllAgents()).not.toContainEqual(agent);
    });

    test('should throw error when unregistering non-existent agent', () => {
      expect(() => {
        registry.unregisterAgent('agent_nonexistent' as AgentId);
      }).toThrow('Agent agent_nonexistent not found');
    });

    test('should clean up capability index on unregistration', () => {
      const agent = createTestAgent('test1', [
        AgentCapability.CODE_GENERATION,
        AgentCapability.TESTING
      ]);
      registry.registerAgent(agent);
      
      registry.unregisterAgent(agent.id);
      
      const matches = registry.findAgentsByCapabilities([AgentCapability.CODE_GENERATION]);
      expect(matches).toHaveLength(0);
    });

    test('should clean up specialization index on unregistration', () => {
      const agent = createTestAgent('test1', [AgentCapability.API_INTEGRATION]);
      agent.metadata.specializations = ['rest', 'graphql'];
      registry.registerAgent(agent);
      
      registry.unregisterAgent(agent.id);
      
      const found = registry.findAgents({ specializations: ['rest'] });
      expect(found).toHaveLength(0);
    });

    test('should emit unregistration event', () => {
      const agent = createTestAgent('test1', [AgentCapability.MONITORING]);
      const eventHandler = jest.fn();
      
      registry.registerAgent(agent);
      registry.on(EventType.AGENT_UNREGISTERED, eventHandler);
      registry.unregisterAgent(agent.id);
      
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EventType.AGENT_UNREGISTERED,
          data: expect.objectContaining({ agentId: agent.id })
        })
      );
    });
  });

  describe('Agent Discovery by Capabilities', () => {
    test('should find agents with all required capabilities', () => {
      const agent1 = createTestAgent('test1', [
        AgentCapability.CODE_GENERATION,
        AgentCapability.TESTING
      ]);
      const agent2 = createTestAgent('test2', [
        AgentCapability.CODE_GENERATION
      ]);
      const agent3 = createTestAgent('test3', [
        AgentCapability.TESTING,
        AgentCapability.CODE_GENERATION,
        AgentCapability.DEPLOYMENT
      ]);
      
      registry.registerAgent(agent1);
      registry.registerAgent(agent2);
      registry.registerAgent(agent3);
      
      const matches = registry.findAgentsByCapabilities([
        AgentCapability.CODE_GENERATION,
        AgentCapability.TESTING
      ]);
      
      expect(matches).toHaveLength(2);
      expect(matches.map(m => m.agent.id)).toContain(agent1.id);
      expect(matches.map(m => m.agent.id)).toContain(agent3.id);
      expect(matches.map(m => m.agent.id)).not.toContain(agent2.id);
    });

    test('should rank agents by optional capabilities', () => {
      const agent1 = createTestAgent('test1', [
        AgentCapability.CODE_GENERATION
      ]);
      const agent2 = createTestAgent('test2', [
        AgentCapability.CODE_GENERATION,
        AgentCapability.CODE_REVIEW
      ]);
      const agent3 = createTestAgent('test3', [
        AgentCapability.CODE_GENERATION,
        AgentCapability.CODE_REVIEW,
        AgentCapability.TESTING
      ]);
      
      registry.registerAgent(agent1);
      registry.registerAgent(agent2);
      registry.registerAgent(agent3);
      
      const matches = registry.findAgentsByCapabilities(
        [AgentCapability.CODE_GENERATION],
        [AgentCapability.CODE_REVIEW, AgentCapability.TESTING]
      );
      
      expect(matches).toHaveLength(3);
      // Agent3 should rank highest (has all optional capabilities)
      expect(matches[0].agent.id).toBe(agent3.id);
      expect(matches[0].matchedCapabilities).toHaveLength(3);
    });

    test('should exclude offline and error agents', () => {
      const agent1 = createTestAgent('test1', [AgentCapability.TESTING], AgentStatus.IDLE);
      const agent2 = createTestAgent('test2', [AgentCapability.TESTING], AgentStatus.OFFLINE);
      const agent3 = createTestAgent('test3', [AgentCapability.TESTING], AgentStatus.ERROR);
      
      registry.registerAgent(agent1);
      registry.registerAgent(agent2);
      registry.registerAgent(agent3);
      
      const matches = registry.findAgentsByCapabilities([AgentCapability.TESTING]);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].agent.id).toBe(agent1.id);
    });

    test('should calculate match scores correctly', () => {
      const agent = createTestAgent('test1', [
        AgentCapability.CODE_GENERATION,
        AgentCapability.CODE_REVIEW,
        AgentCapability.TESTING
      ]);
      agent.metadata.successRate = 0.95;
      agent.metadata.averageResponseTime = 200;
      agent.priority = AgentPriority.HIGH;
      
      registry.registerAgent(agent);
      
      const matches = registry.findAgentsByCapabilities(
        [AgentCapability.CODE_GENERATION],
        [AgentCapability.CODE_REVIEW]
      );
      
      expect(matches).toHaveLength(1);
      const match = matches[0];
      expect(match.score).toBeGreaterThan(0);
      expect(match.matchedCapabilities).toContain(AgentCapability.CODE_GENERATION);
      expect(match.matchedCapabilities).toContain(AgentCapability.CODE_REVIEW);
      expect(match.availability).toBeGreaterThanOrEqual(0);
      expect(match.availability).toBeLessThanOrEqual(1);
    });

    test('should handle empty required capabilities', () => {
      const agent1 = createTestAgent('test1', [AgentCapability.CODE_GENERATION]);
      const agent2 = createTestAgent('test2', [AgentCapability.TESTING]);
      
      registry.registerAgent(agent1);
      registry.registerAgent(agent2);
      
      const matches = registry.findAgentsByCapabilities([]);
      
      expect(matches).toHaveLength(2);
    });
  });

  describe('Agent Filtering', () => {
    beforeEach(() => {
      // Setup diverse set of agents
      const agents = [
        createTestAgent('test1', [AgentCapability.CODE_GENERATION], AgentStatus.IDLE, AgentPriority.HIGH),
        createTestAgent('test2', [AgentCapability.TESTING], AgentStatus.BUSY, AgentPriority.MEDIUM),
        createTestAgent('test3', [AgentCapability.DEPLOYMENT], AgentStatus.IDLE, AgentPriority.LOW),
        createTestAgent('test4', [AgentCapability.MONITORING], AgentStatus.ERROR, AgentPriority.CRITICAL),
        createTestAgent('test5', [
          AgentCapability.CODE_GENERATION,
          AgentCapability.TESTING
        ], AgentStatus.IDLE, AgentPriority.HIGH)
      ];
      
      agents[0].metadata.successRate = 0.95;
      agents[1].metadata.successRate = 0.85;
      agents[2].metadata.successRate = 0.75;
      agents[3].metadata.successRate = 0.65;
      agents[4].metadata.successRate = 0.99;
      
      agents.forEach(agent => registry.registerAgent(agent));
    });

    test('should filter by capabilities', () => {
      const found = registry.findAgents({
        capabilities: [AgentCapability.CODE_GENERATION]
      });
      
      expect(found).toHaveLength(2);
      expect(found.every(a => a.capabilities.includes(AgentCapability.CODE_GENERATION))).toBe(true);
    });

    test('should filter by status', () => {
      const found = registry.findAgents({
        status: AgentStatus.IDLE
      });
      
      expect(found).toHaveLength(3);
      expect(found.every(a => a.status === AgentStatus.IDLE)).toBe(true);
    });

    test('should filter by priority', () => {
      const found = registry.findAgents({
        priority: AgentPriority.HIGH
      });
      
      expect(found).toHaveLength(2);
      expect(found.every(a => a.priority === AgentPriority.HIGH)).toBe(true);
    });

    test('should filter by minimum success rate', () => {
      const found = registry.findAgents({
        minSuccessRate: 0.9
      });
      
      expect(found).toHaveLength(2);
      expect(found.every(a => a.metadata.successRate >= 0.9)).toBe(true);
    });

    test('should filter by specializations', () => {
      const found = registry.findAgents({
        specializations: ['spec_test1', 'spec_test3']
      });
      
      expect(found).toHaveLength(2);
    });

    test('should combine multiple filters', () => {
      const found = registry.findAgents({
        capabilities: [AgentCapability.CODE_GENERATION],
        status: AgentStatus.IDLE,
        minSuccessRate: 0.9
      });
      
      expect(found).toHaveLength(1);
      expect(found[0].id).toBe('agent_test5');
    });
  });

  describe('Best Agent Selection', () => {
    test('should find best agent for task', () => {
      const agent1 = createTestAgent('test1', [AgentCapability.CODE_GENERATION]);
      agent1.metadata.successRate = 0.8;
      agent1.metadata.averageResponseTime = 500;
      
      const agent2 = createTestAgent('test2', [AgentCapability.CODE_GENERATION]);
      agent2.metadata.successRate = 0.95;
      agent2.metadata.averageResponseTime = 200;
      
      const agent3 = createTestAgent('test3', [AgentCapability.CODE_GENERATION]);
      agent3.metadata.successRate = 0.9;
      agent3.metadata.averageResponseTime = 300;
      
      registry.registerAgent(agent1);
      registry.registerAgent(agent2);
      registry.registerAgent(agent3);
      
      const best = registry.findBestAgentForTask([AgentCapability.CODE_GENERATION]);
      
      expect(best).toBe(agent2); // Highest success rate and lowest response time
    });

    test('should respect constraints when finding best agent', () => {
      const agent1 = createTestAgent('test1', [AgentCapability.TESTING]);
      agent1.metadata.averageResponseTime = 600;
      agent1.metadata.successRate = 0.95;
      
      const agent2 = createTestAgent('test2', [AgentCapability.TESTING]);
      agent2.metadata.averageResponseTime = 300;
      agent2.metadata.successRate = 0.85;
      
      registry.registerAgent(agent1);
      registry.registerAgent(agent2);
      
      const best = registry.findBestAgentForTask(
        [AgentCapability.TESTING],
        [],
        {
          maxResponseTime: 400,
          minSuccessRate: 0.8
        }
      );
      
      expect(best).toBe(agent2); // Only agent meeting response time constraint
    });

    test('should exclude specified agents', () => {
      const agent1 = createTestAgent('test1', [AgentCapability.DEPLOYMENT]);
      const agent2 = createTestAgent('test2', [AgentCapability.DEPLOYMENT]);
      const agent3 = createTestAgent('test3', [AgentCapability.DEPLOYMENT]);
      
      registry.registerAgent(agent1);
      registry.registerAgent(agent2);
      registry.registerAgent(agent3);
      
      const best = registry.findBestAgentForTask(
        [AgentCapability.DEPLOYMENT],
        [],
        {
          excludeAgents: [agent1.id, agent2.id]
        }
      );
      
      expect(best).toBe(agent3);
    });

    test('should return null when no suitable agent found', () => {
      const agent = createTestAgent('test1', [AgentCapability.CODE_GENERATION]);
      registry.registerAgent(agent);
      
      const best = registry.findBestAgentForTask([AgentCapability.SECURITY_AUDIT]);
      
      expect(best).toBeNull();
    });

    test('should prefer agents with preferred capabilities', () => {
      const agent1 = createTestAgent('test1', [
        AgentCapability.CODE_GENERATION
      ]);
      const agent2 = createTestAgent('test2', [
        AgentCapability.CODE_GENERATION,
        AgentCapability.CODE_REVIEW
      ]);
      
      registry.registerAgent(agent1);
      registry.registerAgent(agent2);
      
      const best = registry.findBestAgentForTask(
        [AgentCapability.CODE_GENERATION],
        [AgentCapability.CODE_REVIEW]
      );
      
      expect(best).toBe(agent2);
    });
  });

  describe('Agent Status Management', () => {
    test('should update agent status', () => {
      const agent = createTestAgent('test1', [AgentCapability.MONITORING]);
      registry.registerAgent(agent);
      
      registry.updateAgentStatus(agent.id, AgentStatus.BUSY);
      
      const updated = registry.getAgent(agent.id);
      expect(updated?.status).toBe(AgentStatus.BUSY);
      expect(updated?.metadata.lastActiveAt).toBeDefined();
    });

    test('should throw error when updating non-existent agent status', () => {
      expect(() => {
        registry.updateAgentStatus('agent_nonexistent' as AgentId, AgentStatus.BUSY);
      }).toThrow('Agent agent_nonexistent not found');
    });

    test('should emit status change event', () => {
      const agent = createTestAgent('test1', [AgentCapability.DATABASE_OPERATIONS]);
      const eventHandler = jest.fn();
      
      registry.registerAgent(agent);
      registry.on(EventType.AGENT_STATUS_CHANGED, eventHandler);
      registry.updateAgentStatus(agent.id, AgentStatus.ERROR);
      
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EventType.AGENT_STATUS_CHANGED,
          data: expect.objectContaining({
            agentId: agent.id,
            oldStatus: AgentStatus.IDLE,
            newStatus: AgentStatus.ERROR
          })
        })
      );
    });
  });

  describe('Agent Metrics', () => {
    test('should update agent metrics', () => {
      const agent = createTestAgent('test1', [AgentCapability.PERFORMANCE_OPTIMIZATION]);
      registry.registerAgent(agent);
      
      const newMetrics = {
        totalTasksCompleted: 150,
        averageResponseTime: 250,
        successRate: 0.98
      };
      
      registry.updateAgentMetrics(agent.id, newMetrics);
      
      const updated = registry.getAgent(agent.id);
      expect(updated?.metadata.totalTasksCompleted).toBe(150);
      expect(updated?.metadata.averageResponseTime).toBe(250);
      expect(updated?.metadata.successRate).toBe(0.98);
    });

    test('should throw error when updating metrics for non-existent agent', () => {
      expect(() => {
        registry.updateAgentMetrics('agent_nonexistent' as AgentId, {});
      }).toThrow('Agent agent_nonexistent not found');
    });
  });

  describe('Registry Statistics', () => {
    test('should calculate registry statistics correctly', () => {
      const agents = [
        createTestAgent('test1', [AgentCapability.CODE_GENERATION], AgentStatus.IDLE),
        createTestAgent('test2', [AgentCapability.TESTING], AgentStatus.BUSY),
        createTestAgent('test3', [AgentCapability.DEPLOYMENT], AgentStatus.BUSY),
        createTestAgent('test4', [AgentCapability.MONITORING], AgentStatus.ERROR),
        createTestAgent('test5', [AgentCapability.SECURITY_AUDIT], AgentStatus.OFFLINE)
      ];
      
      agents[0].metadata.successRate = 0.9;
      agents[1].metadata.successRate = 0.85;
      agents[2].metadata.successRate = 0.95;
      agents[3].metadata.successRate = 0.8;
      agents[4].metadata.successRate = 0.75;
      
      agents[0].metadata.averageResponseTime = 200;
      agents[1].metadata.averageResponseTime = 300;
      agents[2].metadata.averageResponseTime = 250;
      agents[3].metadata.averageResponseTime = 400;
      agents[4].metadata.averageResponseTime = 350;
      
      agents.forEach(agent => registry.registerAgent(agent));
      
      const stats = registry.getStats();
      
      expect(stats.totalAgents).toBe(5);
      expect(stats.activeAgents).toBe(2);
      expect(stats.idleAgents).toBe(1);
      expect(stats.errorAgents).toBe(1);
      expect(stats.offlineAgents).toBe(1);
      expect(stats.totalCapabilities).toBe(5);
      expect(stats.averageSuccessRate).toBeCloseTo(0.85, 2);
      expect(stats.averageResponseTime).toBeCloseTo(300, 0);
    });

    test('should handle empty registry statistics', () => {
      const stats = registry.getStats();
      
      expect(stats.totalAgents).toBe(0);
      expect(stats.activeAgents).toBe(0);
      expect(stats.idleAgents).toBe(0);
      expect(stats.errorAgents).toBe(0);
      expect(stats.offlineAgents).toBe(0);
      expect(stats.totalCapabilities).toBe(0);
      expect(stats.averageSuccessRate).toBe(0);
      expect(stats.averageResponseTime).toBe(0);
    });
  });

  describe('Health Monitoring', () => {
    test('should start health monitoring', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      
      registry.startHealthMonitoring(5000);
      
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
      
      setIntervalSpy.mockRestore();
    });

    test('should stop health monitoring', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      registry.startHealthMonitoring(5000);
      registry.stopHealthMonitoring();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      
      clearIntervalSpy.mockRestore();
    });

    test('should restart health monitoring with new interval', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      registry.startHealthMonitoring(5000);
      registry.startHealthMonitoring(10000);
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(setIntervalSpy).toHaveBeenLastCalledWith(expect.any(Function), 10000);
      
      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
    });
  });

  describe('Event Handling', () => {
    test('should subscribe to events', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      registry.on(EventType.AGENT_REGISTERED, handler1);
      registry.on(EventType.AGENT_REGISTERED, handler2);
      
      const agent = createTestAgent('test1', [AgentCapability.BUG_FIXING]);
      registry.registerAgent(agent);
      
      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    test('should unsubscribe from events', () => {
      const handler = jest.fn();
      
      registry.on(EventType.AGENT_REGISTERED, handler);
      registry.off(EventType.AGENT_REGISTERED, handler);
      
      const agent = createTestAgent('test1', [AgentCapability.REFACTORING]);
      registry.registerAgent(agent);
      
      expect(handler).not.toHaveBeenCalled();
    });

    test('should handle multiple event types', () => {
      const registrationHandler = jest.fn();
      const statusHandler = jest.fn();
      
      registry.on(EventType.AGENT_REGISTERED, registrationHandler);
      registry.on(EventType.AGENT_STATUS_CHANGED, statusHandler);
      
      const agent = createTestAgent('test1', [AgentCapability.DOCUMENTATION]);
      registry.registerAgent(agent);
      registry.updateAgentStatus(agent.id, AgentStatus.BUSY);
      
      expect(registrationHandler).toHaveBeenCalledTimes(1);
      expect(statusHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle agent with no capabilities', () => {
      const agent = createTestAgent('test1', []);
      
      registry.registerAgent(agent);
      
      expect(registry.getAgent(agent.id)).toEqual(agent);
      const matches = registry.findAgentsByCapabilities([]);
      expect(matches).toHaveLength(1);
    });

    test('should handle agent with duplicate capabilities', () => {
      const agent = createTestAgent('test1', [
        AgentCapability.CODE_GENERATION,
        AgentCapability.CODE_GENERATION // Duplicate
      ]);
      
      registry.registerAgent(agent);
      
      const matches = registry.findAgentsByCapabilities([AgentCapability.CODE_GENERATION]);
      expect(matches).toHaveLength(1);
    });

    test('should handle finding agents with non-existent capability combination', () => {
      const agent = createTestAgent('test1', [AgentCapability.CODE_GENERATION]);
      registry.registerAgent(agent);
      
      const matches = registry.findAgentsByCapabilities([
        AgentCapability.CODE_GENERATION,
        AgentCapability.SECURITY_AUDIT,
        AgentCapability.DEPLOYMENT
      ]);
      
      expect(matches).toHaveLength(0);
    });

    test('should handle registry disposal correctly', () => {
      const agents = [
        createTestAgent('test1', [AgentCapability.CODE_GENERATION]),
        createTestAgent('test2', [AgentCapability.TESTING]),
        createTestAgent('test3', [AgentCapability.DEPLOYMENT])
      ];
      
      agents.forEach(agent => registry.registerAgent(agent));
      
      registry.dispose();
      
      expect(registry.getAllAgents()).toHaveLength(0);
      expect(registry.getStats().totalAgents).toBe(0);
    });
  });

  describe('Performance Tests', () => {
    test('should handle large number of agents efficiently', () => {
      const startTime = Date.now();
      
      // Register 1000 agents
      for (let i = 0; i < 1000; i++) {
        const capabilities = [
          AgentCapability.CODE_GENERATION,
          AgentCapability.TESTING
        ];
        if (i % 3 === 0) capabilities.push(AgentCapability.DEPLOYMENT);
        if (i % 5 === 0) capabilities.push(AgentCapability.MONITORING);
        
        const agent = createTestAgent(`test${i}`, capabilities);
        registry.registerAgent(agent);
      }
      
      const registrationTime = Date.now() - startTime;
      
      // Should complete within 2 seconds
      expect(registrationTime).toBeLessThan(2000);
      expect(registry.getAllAgents()).toHaveLength(1000);
      
      // Test search performance
      const searchStart = Date.now();
      const matches = registry.findAgentsByCapabilities([
        AgentCapability.CODE_GENERATION,
        AgentCapability.DEPLOYMENT
      ]);
      const searchTime = Date.now() - searchStart;
      
      // Search should be fast even with 1000 agents
      expect(searchTime).toBeLessThan(100);
      expect(matches.length).toBeGreaterThan(0);
    });

    test('should maintain index integrity with many operations', () => {
      const agents: Agent[] = [];
      
      // Create 100 agents
      for (let i = 0; i < 100; i++) {
        const agent = createTestAgent(`test${i}`, [
          AgentCapability.CODE_GENERATION,
          AgentCapability.TESTING
        ]);
        agents.push(agent);
        registry.registerAgent(agent);
      }
      
      // Remove half of them
      for (let i = 0; i < 50; i++) {
        registry.unregisterAgent(agents[i].id);
      }
      
      // Check integrity
      expect(registry.getAllAgents()).toHaveLength(50);
      const matches = registry.findAgentsByCapabilities([AgentCapability.CODE_GENERATION]);
      expect(matches).toHaveLength(50);
      
      // Re-add some
      for (let i = 0; i < 25; i++) {
        registry.registerAgent(agents[i]);
      }
      
      expect(registry.getAllAgents()).toHaveLength(75);
    });
  });
});