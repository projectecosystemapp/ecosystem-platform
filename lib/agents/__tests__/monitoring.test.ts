/**
 * Monitoring System Unit Tests
 * 
 * Comprehensive test suite for monitoring system functionality including
 * metrics collection, alerting, health checks, and performance tracking.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MonitoringSystem, MetricType, AlertSeverity } from '../monitoring';
import { agentRegistry } from '../registry';
import { useOrchestratorStore } from '../orchestrator';
import {
  Agent,
  AgentId,
  AgentCapability,
  AgentStatus,
  AgentPriority,
  EventType,
  TaskStatus,
  WorkflowStatus
} from '../types';

// Mock dependencies
jest.mock('../registry');
jest.mock('../orchestrator');

describe('Monitoring System Unit Tests', () => {
  let monitoring: MonitoringSystem;
  const mockStore = {
    getState: jest.fn(),
    setState: jest.fn(),
    subscribe: jest.fn()
  };

  // Test data
  const defaultOrchestratorState = {
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
    systemStatus: 'healthy' as const,
    lastHealthCheck: new Date(),
    config: {
      maxConcurrentTasks: 100,
      taskTimeoutMs: 300000,
      messageRetentionMs: 3600000,
      healthCheckIntervalMs: 30000,
      metricsUpdateIntervalMs: 10000,
      enableHumanInTheLoop: true,
      enableAutoScaling: false,
      logLevel: 'info' as const
    }
  };

  beforeEach(() => {
    // Setup mocks
    (useOrchestratorStore as unknown as jest.Mock).mockReturnValue(mockStore);
    mockStore.getState.mockReturnValue(defaultOrchestratorState);
    
    // Clear all timers
    jest.clearAllTimers();
    jest.useFakeTimers();
    
    // Create monitoring instance
    monitoring = new MonitoringSystem({
      enableLogging: false // Disable logging for tests
    });
  });

  afterEach(() => {
    monitoring.dispose();
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('Metric Registration and Recording', () => {
    test('should register custom metric', () => {
      monitoring.registerMetric({
        name: 'custom_metric',
        type: MetricType.GAUGE,
        description: 'Custom test metric',
        unit: 'units'
      });
      
      monitoring.recordMetric('custom_metric', 42);
      
      // Verify through Prometheus export
      const prometheusOutput = monitoring.exportPrometheusMetrics();
      expect(prometheusOutput).toContain('custom_metric');
      expect(prometheusOutput).toContain('42');
    });

    test('should record counter metric with increment', () => {
      monitoring.registerMetric({
        name: 'test_counter',
        type: MetricType.COUNTER,
        description: 'Test counter metric'
      });
      
      monitoring.incrementMetric('test_counter', 1);
      monitoring.incrementMetric('test_counter', 2);
      monitoring.incrementMetric('test_counter', 3);
      
      const prometheusOutput = monitoring.exportPrometheusMetrics();
      expect(prometheusOutput).toContain('test_counter');
      expect(prometheusOutput).toContain('6'); // 1 + 2 + 3
    });

    test('should set gauge metric value', () => {
      monitoring.registerMetric({
        name: 'test_gauge',
        type: MetricType.GAUGE,
        description: 'Test gauge metric'
      });
      
      monitoring.setGauge('test_gauge', 75.5);
      monitoring.setGauge('test_gauge', 80.2); // Should replace previous value
      
      const prometheusOutput = monitoring.exportPrometheusMetrics();
      expect(prometheusOutput).toContain('test_gauge');
      expect(prometheusOutput).toContain('80.2');
    });

    test('should record metric with labels', () => {
      monitoring.registerMetric({
        name: 'labeled_metric',
        type: MetricType.GAUGE,
        description: 'Metric with labels',
        labels: ['service', 'environment']
      });
      
      monitoring.recordMetric('labeled_metric', 100, {
        service: 'api',
        environment: 'production'
      });
      
      monitoring.recordMetric('labeled_metric', 200, {
        service: 'api',
        environment: 'staging'
      });
      
      const prometheusOutput = monitoring.exportPrometheusMetrics();
      expect(prometheusOutput).toContain('service="api",environment="production"');
      expect(prometheusOutput).toContain('service="api",environment="staging"');
      expect(prometheusOutput).toContain('100');
      expect(prometheusOutput).toContain('200');
    });

    test('should handle histogram metrics', () => {
      monitoring.registerMetric({
        name: 'response_time',
        type: MetricType.HISTOGRAM,
        description: 'Response time histogram',
        unit: 'ms'
      });
      
      // Record multiple values
      [100, 200, 150, 300, 250].forEach(value => {
        monitoring.recordMetric('response_time', value);
      });
      
      const prometheusOutput = monitoring.exportPrometheusMetrics();
      expect(prometheusOutput).toContain('response_time');
      expect(prometheusOutput).toContain('# TYPE response_time histogram');
    });

    test('should warn when recording to non-existent metric', () => {
      const consoleWarnSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Enable logging temporarily
      const monitoringWithLogging = new MonitoringSystem({
        enableLogging: true,
        logLevel: 'warn'
      });
      
      monitoringWithLogging.recordMetric('non_existent', 100);
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Metric non_existent not registered')
      );
      
      monitoringWithLogging.dispose();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('Alert Management', () => {
    beforeEach(() => {
      // Setup test metrics
      monitoring.registerMetric({
        name: 'error_rate',
        type: MetricType.GAUGE,
        description: 'System error rate'
      });
      
      monitoring.registerMetric({
        name: 'response_time',
        type: MetricType.GAUGE,
        description: 'Average response time'
      });
    });

    test('should register and trigger alert', () => {
      const alertHandler = jest.fn();
      monitoring.on('alert', alertHandler);
      
      monitoring.registerAlert(
        'High Error Rate',
        AlertSeverity.WARNING,
        {
          metric: 'error_rate',
          operator: 'gt',
          threshold: 10
        },
        'Error rate exceeds 10%'
      );
      
      // Set metric above threshold
      monitoring.setGauge('error_rate', 15);
      
      // Trigger alert evaluation
      jest.advanceTimersByTime(5000);
      
      expect(alertHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'High Error Rate',
          severity: AlertSeverity.WARNING,
          message: 'Error rate exceeds 10%'
        })
      );
    });

    test('should resolve alert when condition no longer met', () => {
      const alertHandler = jest.fn();
      const resolveHandler = jest.fn();
      monitoring.on('alert', alertHandler);
      monitoring.on('alert-resolved', resolveHandler);
      
      monitoring.registerAlert(
        'Slow Response',
        AlertSeverity.ERROR,
        {
          metric: 'response_time',
          operator: 'gt',
          threshold: 1000
        },
        'Response time exceeds 1000ms'
      );
      
      // Trigger alert
      monitoring.setGauge('response_time', 1500);
      jest.advanceTimersByTime(5000);
      expect(alertHandler).toHaveBeenCalled();
      
      // Resolve alert
      monitoring.setGauge('response_time', 800);
      jest.advanceTimersByTime(5000);
      expect(resolveHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Slow Response',
          resolved: true
        })
      );
    });

    test('should handle alert with duration requirement', () => {
      const alertHandler = jest.fn();
      monitoring.on('alert', alertHandler);
      
      monitoring.registerAlert(
        'Sustained High Load',
        AlertSeverity.CRITICAL,
        {
          metric: 'error_rate',
          operator: 'gte',
          threshold: 20,
          duration: 10000 // 10 seconds
        },
        'Error rate sustained above 20% for 10 seconds'
      );
      
      // Set metric above threshold
      monitoring.setGauge('error_rate', 25);
      
      // Should not trigger immediately
      jest.advanceTimersByTime(5000);
      expect(alertHandler).not.toHaveBeenCalled();
      
      // Should trigger after duration
      monitoring.setGauge('error_rate', 25);
      jest.advanceTimersByTime(10000);
      expect(alertHandler).toHaveBeenCalled();
    });

    test('should support different aggregation methods', () => {
      monitoring.registerMetric({
        name: 'request_count',
        type: MetricType.COUNTER,
        description: 'Request count'
      });
      
      const testCases = [
        { aggregation: 'avg' as const, values: [10, 20, 30], expected: 20 },
        { aggregation: 'sum' as const, values: [10, 20, 30], expected: 60 },
        { aggregation: 'min' as const, values: [10, 20, 30], expected: 10 },
        { aggregation: 'max' as const, values: [10, 20, 30], expected: 30 },
        { aggregation: 'count' as const, values: [10, 20, 30], expected: 3 }
      ];
      
      testCases.forEach(({ aggregation, values, expected }) => {
        const alertHandler = jest.fn();
        monitoring.on('alert', alertHandler);
        
        monitoring.registerAlert(
          `Test ${aggregation}`,
          AlertSeverity.INFO,
          {
            metric: 'request_count',
            operator: 'eq',
            threshold: expected,
            aggregation
          },
          `Test ${aggregation} alert`
        );
        
        values.forEach(value => {
          monitoring.recordMetric('request_count', value);
        });
        
        jest.advanceTimersByTime(5000);
        
        // Clean up for next test
        monitoring.off('alert', alertHandler);
      });
    });

    test('should handle multiple alerts on same metric', () => {
      const warningHandler = jest.fn();
      const criticalHandler = jest.fn();
      
      monitoring.registerAlert(
        'Warning Level',
        AlertSeverity.WARNING,
        {
          metric: 'error_rate',
          operator: 'gt',
          threshold: 10
        },
        'Warning: Error rate above 10%'
      );
      
      monitoring.registerAlert(
        'Critical Level',
        AlertSeverity.CRITICAL,
        {
          metric: 'error_rate',
          operator: 'gt',
          threshold: 25
        },
        'Critical: Error rate above 25%'
      );
      
      monitoring.on('alert', (alert) => {
        if (alert.severity === AlertSeverity.WARNING) warningHandler(alert);
        if (alert.severity === AlertSeverity.CRITICAL) criticalHandler(alert);
      });
      
      // Set to trigger warning only
      monitoring.setGauge('error_rate', 15);
      jest.advanceTimersByTime(5000);
      expect(warningHandler).toHaveBeenCalled();
      expect(criticalHandler).not.toHaveBeenCalled();
      
      // Set to trigger both
      monitoring.setGauge('error_rate', 30);
      jest.advanceTimersByTime(5000);
      expect(criticalHandler).toHaveBeenCalled();
    });
  });

  describe('Health Checks', () => {
    test('should perform comprehensive health checks', () => {
      const healthHandler = jest.fn();
      monitoring.on('health', healthHandler);
      
      // Setup state for health checks
      mockStore.getState.mockReturnValue({
        ...defaultOrchestratorState,
        systemStatus: 'healthy',
        agents: new Map([['agent_1', {}]]),
        activeTasks: new Map([['task_1', 'agent_1']]),
        taskQueue: ['task_2', 'task_3'],
        messageQueue: Array(50).fill({})
      });
      
      (agentRegistry.getStats as jest.Mock).mockReturnValue({
        totalAgents: 5,
        activeAgents: 3,
        idleAgents: 1,
        errorAgents: 1,
        offlineAgents: 0,
        totalCapabilities: 10,
        averageSuccessRate: 0.9,
        averageResponseTime: 200
      });
      
      // Trigger health check
      jest.advanceTimersByTime(30000);
      
      expect(healthHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          overall: expect.stringMatching(/healthy|degraded|unhealthy/),
          components: expect.arrayContaining([
            expect.objectContaining({ component: 'orchestrator' }),
            expect.objectContaining({ component: 'agents' }),
            expect.objectContaining({ component: 'queues' }),
            expect.objectContaining({ component: 'resources' })
          ]),
          lastCheck: expect.any(Date),
          uptime: expect.any(Number)
        })
      );
    });

    test('should detect degraded orchestrator health', () => {
      const healthHandler = jest.fn();
      monitoring.on('health', healthHandler);
      
      mockStore.getState.mockReturnValue({
        ...defaultOrchestratorState,
        systemStatus: 'degraded'
      });
      
      jest.advanceTimersByTime(30000);
      
      const healthCall = healthHandler.mock.calls[0][0];
      const orchestratorHealth = healthCall.components.find(
        (c: any) => c.component === 'orchestrator'
      );
      
      expect(orchestratorHealth.status).toBe('degraded');
    });

    test('should detect unhealthy agent status', () => {
      const healthHandler = jest.fn();
      monitoring.on('health', healthHandler);
      
      (agentRegistry.getStats as jest.Mock).mockReturnValue({
        totalAgents: 10,
        activeAgents: 2,
        idleAgents: 1,
        errorAgents: 6, // More than 30% in error
        offlineAgents: 1,
        totalCapabilities: 10,
        averageSuccessRate: 0.6,
        averageResponseTime: 500
      });
      
      jest.advanceTimersByTime(30000);
      
      const healthCall = healthHandler.mock.calls[0][0];
      const agentHealth = healthCall.components.find(
        (c: any) => c.component === 'agents'
      );
      
      expect(agentHealth.status).toBe('unhealthy');
    });

    test('should detect unhealthy queue status', () => {
      const healthHandler = jest.fn();
      monitoring.on('health', healthHandler);
      
      mockStore.getState.mockReturnValue({
        ...defaultOrchestratorState,
        messageQueue: Array(300).fill({}),
        taskQueue: Array(250).fill('task')
      });
      
      jest.advanceTimersByTime(30000);
      
      const healthCall = healthHandler.mock.calls[0][0];
      const queueHealth = healthCall.components.find(
        (c: any) => c.component === 'queues'
      );
      
      expect(queueHealth.status).toBe('unhealthy');
      expect(queueHealth.metadata.messageQueue).toBe(300);
      expect(queueHealth.metadata.taskQueue).toBe(250);
    });

    test('should calculate overall health status correctly', () => {
      const testCases = [
        {
          components: ['healthy', 'healthy', 'healthy', 'healthy'],
          expected: 'healthy'
        },
        {
          components: ['healthy', 'degraded', 'healthy', 'healthy'],
          expected: 'healthy'
        },
        {
          components: ['degraded', 'degraded', 'healthy', 'healthy'],
          expected: 'degraded'
        },
        {
          components: ['unhealthy', 'healthy', 'healthy', 'healthy'],
          expected: 'unhealthy'
        },
        {
          components: ['unhealthy', 'degraded', 'degraded', 'unhealthy'],
          expected: 'unhealthy'
        }
      ];
      
      testCases.forEach(({ components, expected }) => {
        const healthHandler = jest.fn();
        monitoring.on('health', healthHandler);
        
        // Mock different component statuses
        mockStore.getState.mockReturnValue({
          ...defaultOrchestratorState,
          systemStatus: components[0] as any
        });
        
        const agentHealthRatio = components[1] === 'healthy' ? 0.95 :
                                components[1] === 'degraded' ? 0.75 : 0.5;
        
        (agentRegistry.getStats as jest.Mock).mockReturnValue({
          totalAgents: 10,
          errorAgents: Math.floor(10 * (1 - agentHealthRatio)),
          activeAgents: 5,
          idleAgents: 5,
          offlineAgents: 0,
          totalCapabilities: 10,
          averageSuccessRate: 0.9,
          averageResponseTime: 200
        });
        
        const queueSize = components[2] === 'healthy' ? 50 :
                         components[2] === 'degraded' ? 200 : 600;
        
        mockStore.getState.mockReturnValue({
          ...mockStore.getState(),
          messageQueue: Array(queueSize).fill({}),
          taskQueue: []
        });
        
        jest.advanceTimersByTime(30000);
        
        const healthCall = healthHandler.mock.calls[0][0];
        expect(healthCall.overall).toBe(expected);
        
        monitoring.off('health', healthHandler);
      });
    });
  });

  describe('Performance Metrics', () => {
    test('should calculate performance metrics correctly', () => {
      // Setup mock state with comprehensive data
      const mockAgentUtilization = new Map([
        ['agent_1' as AgentId, 0.8],
        ['agent_2' as AgentId, 0.6],
        ['agent_3' as AgentId, 0.4]
      ]);
      
      const mockExecutions = [
        {
          status: WorkflowStatus.COMPLETED,
          startedAt: new Date(Date.now() - 3600000),
          completedAt: new Date()
        },
        {
          status: WorkflowStatus.RUNNING,
          startedAt: new Date()
        },
        {
          status: WorkflowStatus.FAILED,
          startedAt: new Date(Date.now() - 1800000),
          completedAt: new Date(Date.now() - 1200000)
        }
      ];
      
      mockStore.getState.mockReturnValue({
        ...defaultOrchestratorState,
        agents: new Map([
          ['agent_1', {}],
          ['agent_2', {}],
          ['agent_3', {}]
        ]),
        metrics: {
          totalTasksProcessed: 150,
          totalTasksFailed: 10,
          averageTaskDuration: 5000,
          agentUtilization: mockAgentUtilization,
          systemLoad: 0.75,
          errorRate: 0.067
        },
        activeExecutions: new Map(
          mockExecutions.map((exec, i) => [`exec_${i}`, exec])
        ),
        messageQueue: Array(25).fill({}),
        taskQueue: Array(15).fill('task')
      });
      
      (agentRegistry.getStats as jest.Mock).mockReturnValue({
        totalAgents: 3,
        activeAgents: 2,
        idleAgents: 1,
        errorAgents: 0,
        offlineAgents: 0,
        totalCapabilities: 10,
        averageSuccessRate: 0.95,
        averageResponseTime: 250
      });
      
      const metrics = monitoring.getPerformanceMetrics();
      
      // Task metrics
      expect(metrics.taskMetrics.totalProcessed).toBe(150);
      expect(metrics.taskMetrics.totalFailed).toBe(10);
      expect(metrics.taskMetrics.averageDuration).toBe(5000);
      expect(metrics.taskMetrics.errorRate).toBeCloseTo(0.067, 3);
      
      // Agent metrics
      expect(metrics.agentMetrics.totalAgents).toBe(3);
      expect(metrics.agentMetrics.activeAgents).toBe(2);
      expect(metrics.agentMetrics.averageUtilization).toBeCloseTo(0.6, 1);
      expect(metrics.agentMetrics.averageResponseTime).toBe(250);
      
      // Workflow metrics
      expect(metrics.workflowMetrics.totalExecutions).toBe(3);
      expect(metrics.workflowMetrics.activeExecutions).toBe(1);
      expect(metrics.workflowMetrics.completedExecutions).toBe(1);
      expect(metrics.workflowMetrics.failedExecutions).toBe(1);
      expect(metrics.workflowMetrics.successRate).toBe(0.5);
      
      // System metrics
      expect(metrics.systemMetrics.messageQueueSize).toBe(25);
      expect(metrics.systemMetrics.taskQueueSize).toBe(15);
      expect(metrics.systemMetrics.systemLoad).toBe(0.75);
      expect(metrics.systemMetrics.memoryUsage).toBeGreaterThan(0);
    });

    test('should calculate percentiles correctly', () => {
      // Add task duration data through private method access
      const durations = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
      durations.forEach(duration => {
        // Use reflection to access private method
        (monitoring as any).recordTaskDuration(duration);
      });
      
      const metrics = monitoring.getPerformanceMetrics();
      
      expect(metrics.taskMetrics.p50Duration).toBe(500);
      expect(metrics.taskMetrics.p95Duration).toBe(950);
      expect(metrics.taskMetrics.p99Duration).toBe(1000);
    });

    test('should calculate throughput correctly', () => {
      mockStore.getState.mockReturnValue({
        ...defaultOrchestratorState,
        metrics: {
          ...defaultOrchestratorState.metrics,
          totalTasksProcessed: 3600 // 3600 tasks
        }
      });
      
      // Simulate 1 hour uptime
      jest.advanceTimersByTime(3600000);
      
      const metrics = monitoring.getPerformanceMetrics();
      
      // Should be 1 task per second
      expect(metrics.taskMetrics.throughput).toBeCloseTo(1, 1);
    });
  });

  describe('Prometheus Export', () => {
    test('should export metrics in Prometheus format', () => {
      monitoring.registerMetric({
        name: 'test_metric',
        type: MetricType.GAUGE,
        description: 'Test metric for Prometheus export'
      });
      
      monitoring.setGauge('test_metric', 123.45);
      
      const output = monitoring.exportPrometheusMetrics();
      
      expect(output).toContain('# HELP test_metric Test metric for Prometheus export');
      expect(output).toContain('# TYPE test_metric gauge');
      expect(output).toContain('test_metric 123.45');
    });

    test('should include labels in Prometheus export', () => {
      monitoring.registerMetric({
        name: 'http_requests',
        type: MetricType.COUNTER,
        description: 'HTTP request counter',
        labels: ['method', 'status']
      });
      
      monitoring.recordMetric('http_requests', 100, {
        method: 'GET',
        status: '200'
      });
      
      monitoring.recordMetric('http_requests', 50, {
        method: 'POST',
        status: '201'
      });
      
      const output = monitoring.exportPrometheusMetrics();
      
      expect(output).toContain('http_requests{method="GET",status="200"} 100');
      expect(output).toContain('http_requests{method="POST",status="201"} 50');
    });

    test('should only export latest value for each label combination', () => {
      monitoring.registerMetric({
        name: 'cpu_usage',
        type: MetricType.GAUGE,
        description: 'CPU usage percentage',
        labels: ['core']
      });
      
      // Record multiple values for same label
      monitoring.recordMetric('cpu_usage', 50, { core: '0' });
      monitoring.recordMetric('cpu_usage', 60, { core: '0' });
      monitoring.recordMetric('cpu_usage', 70, { core: '0' });
      
      const output = monitoring.exportPrometheusMetrics();
      
      // Should only contain the latest value
      expect(output).toContain('cpu_usage{core="0"} 70');
      expect(output).not.toContain('50');
      expect(output).not.toContain('60');
    });

    test('should return empty string when Prometheus disabled', () => {
      const monitoringNoPrometheus = new MonitoringSystem({
        enablePrometheus: false
      });
      
      monitoringNoPrometheus.registerMetric({
        name: 'test',
        type: MetricType.GAUGE,
        description: 'Test'
      });
      
      monitoringNoPrometheus.setGauge('test', 100);
      
      const output = monitoringNoPrometheus.exportPrometheusMetrics();
      expect(output).toBe('');
      
      monitoringNoPrometheus.dispose();
    });
  });

  describe('Event Subscription', () => {
    test('should handle agent registration events', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const monitoringWithLogging = new MonitoringSystem({
        enableLogging: true,
        logLevel: 'info'
      });
      
      // Simulate agent registration event
      const registrationHandler = (agentRegistry.on as jest.Mock).mock.calls
        .find(call => call[0] === EventType.AGENT_REGISTERED)?.[1];
      
      if (registrationHandler) {
        registrationHandler({
          type: EventType.AGENT_REGISTERED,
          data: { agentId: 'agent_test', capabilities: [] }
        });
      }
      
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Agent registered: agent_test')
      );
      
      monitoringWithLogging.dispose();
      logSpy.mockRestore();
    });

    test('should track task completion events', () => {
      // Find and call the task completion handler
      const completionHandler = (agentRegistry.on as jest.Mock).mock.calls
        .find(call => call[0] === EventType.TASK_COMPLETED)?.[1];
      
      if (completionHandler) {
        completionHandler({
          type: EventType.TASK_COMPLETED,
          data: {
            taskId: 'task_123',
            taskType: 'analysis',
            duration: 5000
          }
        });
      }
      
      // Check that metrics were updated
      const prometheusOutput = monitoring.exportPrometheusMetrics();
      expect(prometheusOutput).toContain('tasks_total');
    });

    test('should log task failure events', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const monitoringWithLogging = new MonitoringSystem({
        enableLogging: true,
        logLevel: 'error'
      });
      
      const failureHandler = (agentRegistry.on as jest.Mock).mock.calls
        .find(call => call[0] === EventType.TASK_FAILED)?.[1];
      
      if (failureHandler) {
        failureHandler({
          type: EventType.TASK_FAILED,
          data: {
            taskId: 'task_failed',
            taskType: 'deployment',
            error: 'Connection timeout'
          }
        });
      }
      
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Task failed: task_failed')
      );
      
      monitoringWithLogging.dispose();
      logSpy.mockRestore();
    });
  });

  describe('Periodic Tasks', () => {
    test('should update metrics periodically', () => {
      mockStore.getState.mockReturnValue({
        ...defaultOrchestratorState,
        agents: new Map([['agent_1', {}], ['agent_2', {}]]),
        messageQueue: Array(10).fill({}),
        metrics: {
          ...defaultOrchestratorState.metrics,
          systemLoad: 0.5,
          errorRate: 0.05,
          agentUtilization: new Map([
            ['agent_1' as AgentId, 0.7],
            ['agent_2' as AgentId, 0.3]
          ])
        }
      });
      
      // Advance time to trigger metrics update
      jest.advanceTimersByTime(10000);
      
      const prometheusOutput = monitoring.exportPrometheusMetrics();
      expect(prometheusOutput).toContain('agents_total');
      expect(prometheusOutput).toContain('2'); // 2 agents
      expect(prometheusOutput).toContain('message_queue_size');
      expect(prometheusOutput).toContain('10'); // 10 messages
      expect(prometheusOutput).toContain('system_load');
      expect(prometheusOutput).toContain('50'); // 50% load
    });

    test('should clean up old metrics periodically', () => {
      monitoring.registerMetric({
        name: 'temp_metric',
        type: MetricType.GAUGE,
        description: 'Temporary metric'
      });
      
      // Record metric
      monitoring.recordMetric('temp_metric', 100);
      
      // Advance time beyond retention period
      jest.advanceTimersByTime(3700000); // > 1 hour
      
      // Record new metric
      monitoring.recordMetric('temp_metric', 200);
      
      // Old metric should be cleaned up
      const prometheusOutput = monitoring.exportPrometheusMetrics();
      expect(prometheusOutput).not.toContain('100');
      expect(prometheusOutput).toContain('200');
    });

    test('should evaluate alerts periodically', () => {
      const alertHandler = jest.fn();
      monitoring.on('alert', alertHandler);
      
      monitoring.registerAlert(
        'Test Alert',
        AlertSeverity.INFO,
        {
          metric: 'system_load',
          operator: 'gt',
          threshold: 70
        },
        'System load high'
      );
      
      // Set metric above threshold
      monitoring.setGauge('system_load', 80);
      
      // Wait for alert evaluation interval
      jest.advanceTimersByTime(5000);
      
      expect(alertHandler).toHaveBeenCalled();
    });
  });

  describe('Logging', () => {
    test('should respect log level configuration', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const monitoringWithLogging = new MonitoringSystem({
        enableLogging: true,
        logLevel: 'warn'
      });
      
      // These should not be logged (below warn level)
      (monitoringWithLogging as any).log('debug', 'Debug message');
      (monitoringWithLogging as any).log('info', 'Info message');
      
      // These should be logged
      (monitoringWithLogging as any).log('warn', 'Warning message');
      (monitoringWithLogging as any).log('error', 'Error message');
      
      expect(logSpy).toHaveBeenCalledTimes(2);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Warning message'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Error message'));
      
      monitoringWithLogging.dispose();
      logSpy.mockRestore();
    });

    test('should include timestamp and level in log messages', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const monitoringWithLogging = new MonitoringSystem({
        enableLogging: true,
        logLevel: 'info'
      });
      
      (monitoringWithLogging as any).log('info', 'Test message');
      
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T.*\] \[INFO\] \[Monitoring\] Test message/)
      );
      
      monitoringWithLogging.dispose();
      logSpy.mockRestore();
    });
  });

  describe('Resource Cleanup', () => {
    test('should clean up intervals on dispose', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      const monitoring = new MonitoringSystem();
      monitoring.dispose();
      
      // Should clear at least 4 intervals (metrics, health, alerts, cleanup)
      expect(clearIntervalSpy).toHaveBeenCalledTimes(4);
      
      clearIntervalSpy.mockRestore();
    });

    test('should clear all data on dispose', () => {
      monitoring.registerMetric({
        name: 'test',
        type: MetricType.GAUGE,
        description: 'Test'
      });
      
      monitoring.registerAlert(
        'Test Alert',
        AlertSeverity.INFO,
        { metric: 'test', operator: 'gt', threshold: 10 },
        'Test'
      );
      
      monitoring.dispose();
      
      // All data should be cleared
      const prometheusOutput = monitoring.exportPrometheusMetrics();
      expect(prometheusOutput).toBe('');
    });

    test('should remove all event listeners on dispose', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      monitoring.on('alert', handler1);
      monitoring.on('health', handler2);
      
      monitoring.dispose();
      
      // Handlers should be removed
      monitoring.emit('alert', {} as any);
      monitoring.emit('health', {} as any);
      
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle empty task durations array', () => {
      const metrics = monitoring.getPerformanceMetrics();
      
      expect(metrics.taskMetrics.p50Duration).toBe(0);
      expect(metrics.taskMetrics.p95Duration).toBe(0);
      expect(metrics.taskMetrics.p99Duration).toBe(0);
    });

    test('should handle division by zero in metrics', () => {
      mockStore.getState.mockReturnValue({
        ...defaultOrchestratorState,
        agents: new Map(),
        metrics: {
          ...defaultOrchestratorState.metrics,
          totalTasksProcessed: 0,
          totalTasksFailed: 0
        }
      });
      
      const metrics = monitoring.getPerformanceMetrics();
      
      expect(metrics.taskMetrics.errorRate).toBe(0);
      expect(metrics.agentMetrics.averageUtilization).toBe(0);
    });

    test('should handle malformed alert conditions gracefully', () => {
      monitoring.registerAlert(
        'Invalid Alert',
        AlertSeverity.WARNING,
        {
          metric: 'non_existent_metric',
          operator: 'gt',
          threshold: 10
        },
        'This should not trigger'
      );
      
      // Should not throw when evaluating
      expect(() => {
        jest.advanceTimersByTime(5000);
      }).not.toThrow();
    });

    test('should limit task duration array size', () => {
      // Record more than 1000 durations
      for (let i = 0; i < 1100; i++) {
        (monitoring as any).recordTaskDuration(i);
      }
      
      // Should maintain only last 1000
      expect((monitoring as any).taskDurations.length).toBe(1000);
    });
  });
});