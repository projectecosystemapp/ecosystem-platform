/**
 * Agent Monitoring System - Comprehensive observability and metrics
 * 
 * Provides real-time monitoring, performance metrics, health checks,
 * and alerting for the agent orchestration system.
 */

import { EventEmitter } from 'events';
import {
  Agent,
  AgentId,
  AgentStatus,
  Task,
  TaskStatus,
  Workflow,
  WorkflowExecution,
  WorkflowStatus,
  SystemEvent,
  EventType,
  Message,
  MessageType
} from './types';
import { agentRegistry } from './registry';
import { useOrchestratorStore } from './orchestrator';

/**
 * Metric types
 */
export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary'
}

/**
 * Alert severity levels
 */
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * Metric data point
 */
export interface MetricDataPoint {
  timestamp: Date;
  value: number;
  labels?: Record<string, string>;
}

/**
 * Metric definition
 */
export interface Metric {
  name: string;
  type: MetricType;
  description: string;
  unit?: string;
  labels?: string[];
  dataPoints: MetricDataPoint[];
}

/**
 * Alert definition
 */
export interface Alert {
  id: string;
  name: string;
  severity: AlertSeverity;
  condition: AlertCondition;
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
}

/**
 * Alert condition
 */
export interface AlertCondition {
  metric: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
  threshold: number;
  duration?: number; // Duration in ms that condition must be true
  aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count';
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  component: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  checkTime: Date;
  responseTime?: number;
  metadata?: Record<string, any>;
}

/**
 * System health status
 */
export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  components: HealthCheckResult[];
  lastCheck: Date;
  uptime: number;
  metrics: {
    cpu: number;
    memory: number;
    diskUsage: number;
    networkLatency: number;
  };
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  taskMetrics: {
    totalProcessed: number;
    totalFailed: number;
    averageDuration: number;
    p50Duration: number;
    p95Duration: number;
    p99Duration: number;
    throughput: number;
    errorRate: number;
  };
  agentMetrics: {
    totalAgents: number;
    activeAgents: number;
    averageUtilization: number;
    averageResponseTime: number;
  };
  workflowMetrics: {
    totalExecutions: number;
    activeExecutions: number;
    completedExecutions: number;
    failedExecutions: number;
    averageDuration: number;
    successRate: number;
  };
  systemMetrics: {
    messageQueueSize: number;
    taskQueueSize: number;
    systemLoad: number;
    memoryUsage: number;
  };
}

/**
 * Monitoring configuration
 */
export interface MonitoringConfig {
  metricsRetentionMs: number;
  metricsUpdateIntervalMs: number;
  healthCheckIntervalMs: number;
  alertEvaluationIntervalMs: number;
  enablePrometheus: boolean;
  enableLogging: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Monitoring System implementation
 */
export class MonitoringSystem extends EventEmitter {
  private metrics: Map<string, Metric>;
  private alerts: Map<string, Alert>;
  private activeAlerts: Set<string>;
  private healthChecks: Map<string, HealthCheckResult>;
  private config: MonitoringConfig;
  private intervals: NodeJS.Timeout[];
  private startTime: Date;
  private taskDurations: number[];
  private orchestratorStore = useOrchestratorStore;

  constructor(config?: Partial<MonitoringConfig>) {
    super();
    
    this.metrics = new Map();
    this.alerts = new Map();
    this.activeAlerts = new Set();
    this.healthChecks = new Map();
    this.intervals = [];
    this.startTime = new Date();
    this.taskDurations = [];
    
    this.config = {
      metricsRetentionMs: 3600000, // 1 hour
      metricsUpdateIntervalMs: 10000, // 10 seconds
      healthCheckIntervalMs: 30000, // 30 seconds
      alertEvaluationIntervalMs: 5000, // 5 seconds
      enablePrometheus: false,
      enableLogging: true,
      logLevel: 'info',
      ...config
    };
    
    this.initialize();
  }

  /**
   * Initialize monitoring system
   */
  private initialize(): void {
    // Register default metrics
    this.registerDefaultMetrics();
    
    // Start periodic tasks
    this.startPeriodicTasks();
    
    // Subscribe to system events
    this.subscribeToEvents();
    
    this.log('info', 'Monitoring system initialized');
  }

  /**
   * Register default metrics
   */
  private registerDefaultMetrics(): void {
    // Task metrics
    this.registerMetric({
      name: 'tasks_total',
      type: MetricType.COUNTER,
      description: 'Total number of tasks processed',
      labels: ['status', 'type']
    });
    
    this.registerMetric({
      name: 'task_duration_seconds',
      type: MetricType.HISTOGRAM,
      description: 'Task execution duration in seconds',
      unit: 'seconds',
      labels: ['type']
    });
    
    // Agent metrics
    this.registerMetric({
      name: 'agents_total',
      type: MetricType.GAUGE,
      description: 'Total number of registered agents'
    });
    
    this.registerMetric({
      name: 'agent_utilization',
      type: MetricType.GAUGE,
      description: 'Agent utilization percentage',
      unit: 'percent',
      labels: ['agent_id']
    });
    
    // Workflow metrics
    this.registerMetric({
      name: 'workflows_total',
      type: MetricType.COUNTER,
      description: 'Total number of workflow executions',
      labels: ['status', 'workflow_id']
    });
    
    this.registerMetric({
      name: 'workflow_duration_seconds',
      type: MetricType.HISTOGRAM,
      description: 'Workflow execution duration in seconds',
      unit: 'seconds',
      labels: ['workflow_id']
    });
    
    // System metrics
    this.registerMetric({
      name: 'message_queue_size',
      type: MetricType.GAUGE,
      description: 'Current message queue size'
    });
    
    this.registerMetric({
      name: 'system_load',
      type: MetricType.GAUGE,
      description: 'System load percentage',
      unit: 'percent'
    });
    
    this.registerMetric({
      name: 'error_rate',
      type: MetricType.GAUGE,
      description: 'System error rate',
      unit: 'percent'
    });
  }

  /**
   * Start periodic tasks
   */
  private startPeriodicTasks(): void {
    // Metrics update
    this.intervals.push(
      setInterval(() => {
        this.updateMetrics();
      }, this.config.metricsUpdateIntervalMs)
    );
    
    // Health checks
    this.intervals.push(
      setInterval(() => {
        this.performHealthChecks();
      }, this.config.healthCheckIntervalMs)
    );
    
    // Alert evaluation
    this.intervals.push(
      setInterval(() => {
        this.evaluateAlerts();
      }, this.config.alertEvaluationIntervalMs)
    );
    
    // Metrics cleanup
    this.intervals.push(
      setInterval(() => {
        this.cleanupOldMetrics();
      }, 60000) // Every minute
    );
  }

  /**
   * Subscribe to system events
   */
  private subscribeToEvents(): void {
    // Agent events
    agentRegistry.on(EventType.AGENT_REGISTERED, (event) => {
      this.incrementMetric('agents_total', 1);
      this.log('info', `Agent registered: ${event.data.agentId}`);
    });
    
    agentRegistry.on(EventType.AGENT_STATUS_CHANGED, (event) => {
      this.log('debug', `Agent status changed: ${event.data.agentId} -> ${event.data.newStatus}`);
    });
    
    // Task events
    agentRegistry.on(EventType.TASK_COMPLETED, (event) => {
      this.incrementMetric('tasks_total', 1, { status: 'completed', type: event.data.taskType });
      if (event.data.duration) {
        this.recordTaskDuration(event.data.duration);
      }
    });
    
    agentRegistry.on(EventType.TASK_FAILED, (event) => {
      this.incrementMetric('tasks_total', 1, { status: 'failed', type: event.data.taskType });
      this.log('error', `Task failed: ${event.data.taskId} - ${event.data.error}`);
    });
  }

  /**
   * Register a metric
   */
  public registerMetric(definition: Omit<Metric, 'dataPoints'>): void {
    const metric: Metric = {
      ...definition,
      dataPoints: []
    };
    this.metrics.set(definition.name, metric);
  }

  /**
   * Record a metric value
   */
  public recordMetric(
    name: string, 
    value: number, 
    labels?: Record<string, string>
  ): void {
    const metric = this.metrics.get(name);
    if (!metric) {
      this.log('warn', `Metric ${name} not registered`);
      return;
    }
    
    metric.dataPoints.push({
      timestamp: new Date(),
      value,
      labels
    });
  }

  /**
   * Increment a counter metric
   */
  public incrementMetric(
    name: string, 
    value: number = 1, 
    labels?: Record<string, string>
  ): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== MetricType.COUNTER) {
      return;
    }
    
    // Find existing counter or create new one
    const lastPoint = metric.dataPoints[metric.dataPoints.length - 1];
    const currentValue = lastPoint ? lastPoint.value : 0;
    
    this.recordMetric(name, currentValue + value, labels);
  }

  /**
   * Set a gauge metric
   */
  public setGauge(
    name: string, 
    value: number, 
    labels?: Record<string, string>
  ): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== MetricType.GAUGE) {
      return;
    }
    
    this.recordMetric(name, value, labels);
  }

  /**
   * Record task duration
   */
  private recordTaskDuration(duration: number): void {
    this.taskDurations.push(duration);
    
    // Keep only last 1000 durations
    if (this.taskDurations.length > 1000) {
      this.taskDurations.shift();
    }
    
    this.recordMetric('task_duration_seconds', duration / 1000);
  }

  /**
   * Update metrics from orchestrator state
   */
  private updateMetrics(): void {
    const state = this.orchestratorStore.getState();
    
    // Update gauges
    this.setGauge('agents_total', state.agents.size);
    this.setGauge('message_queue_size', state.messageQueue.length);
    this.setGauge('system_load', state.metrics.systemLoad * 100);
    this.setGauge('error_rate', state.metrics.errorRate * 100);
    
    // Update agent utilization
    state.metrics.agentUtilization.forEach((utilization, agentId) => {
      this.setGauge('agent_utilization', utilization * 100, { agent_id: agentId });
    });
  }

  /**
   * Perform health checks
   */
  private async performHealthChecks(): Promise<void> {
    const checks: HealthCheckResult[] = [];
    
    // Check orchestrator health
    const orchestratorHealth = this.checkOrchestratorHealth();
    checks.push(orchestratorHealth);
    
    // Check agent health
    const agentHealth = this.checkAgentHealth();
    checks.push(agentHealth);
    
    // Check queue health
    const queueHealth = this.checkQueueHealth();
    checks.push(queueHealth);
    
    // Check resource health
    const resourceHealth = this.checkResourceHealth();
    checks.push(resourceHealth);
    
    // Store results
    checks.forEach(check => {
      this.healthChecks.set(check.component, check);
    });
    
    // Emit health status
    const overallHealth = this.calculateOverallHealth(checks);
    this.emit('health', {
      overall: overallHealth,
      components: checks,
      lastCheck: new Date(),
      uptime: Date.now() - this.startTime.getTime()
    });
  }

  /**
   * Check orchestrator health
   */
  private checkOrchestratorHealth(): HealthCheckResult {
    const state = this.orchestratorStore.getState();
    const status = state.systemStatus === 'healthy' ? 'healthy' : 
                  state.systemStatus === 'degraded' ? 'degraded' : 'unhealthy';
    
    return {
      component: 'orchestrator',
      status,
      message: `System status: ${state.systemStatus}`,
      checkTime: new Date(),
      metadata: {
        activeTasks: state.activeTasks.size,
        queuedTasks: state.taskQueue.length,
        activeWorkflows: state.activeExecutions.size
      }
    };
  }

  /**
   * Check agent health
   */
  private checkAgentHealth(): HealthCheckResult {
    const stats = agentRegistry.getStats();
    const healthyRatio = (stats.totalAgents - stats.errorAgents) / stats.totalAgents;
    
    const status = healthyRatio >= 0.9 ? 'healthy' :
                  healthyRatio >= 0.7 ? 'degraded' : 'unhealthy';
    
    return {
      component: 'agents',
      status,
      message: `${stats.totalAgents - stats.errorAgents}/${stats.totalAgents} agents healthy`,
      checkTime: new Date(),
      metadata: stats
    };
  }

  /**
   * Check queue health
   */
  private checkQueueHealth(): HealthCheckResult {
    const state = this.orchestratorStore.getState();
    const queueSize = state.messageQueue.length + state.taskQueue.length;
    
    const status = queueSize < 100 ? 'healthy' :
                  queueSize < 500 ? 'degraded' : 'unhealthy';
    
    return {
      component: 'queues',
      status,
      message: `Queue size: ${queueSize}`,
      checkTime: new Date(),
      metadata: {
        messageQueue: state.messageQueue.length,
        taskQueue: state.taskQueue.length
      }
    };
  }

  /**
   * Check resource health
   */
  private checkResourceHealth(): HealthCheckResult {
    // Simulate resource checks
    const cpuUsage = Math.random() * 100;
    const memoryUsage = Math.random() * 100;
    
    const status = cpuUsage < 70 && memoryUsage < 80 ? 'healthy' :
                  cpuUsage < 85 && memoryUsage < 90 ? 'degraded' : 'unhealthy';
    
    return {
      component: 'resources',
      status,
      message: `CPU: ${cpuUsage.toFixed(1)}%, Memory: ${memoryUsage.toFixed(1)}%`,
      checkTime: new Date(),
      metadata: {
        cpu: cpuUsage,
        memory: memoryUsage
      }
    };
  }

  /**
   * Calculate overall health
   */
  private calculateOverallHealth(checks: HealthCheckResult[]): 'healthy' | 'degraded' | 'unhealthy' {
    const unhealthy = checks.filter(c => c.status === 'unhealthy').length;
    const degraded = checks.filter(c => c.status === 'degraded').length;
    
    if (unhealthy > 0) return 'unhealthy';
    if (degraded > 1) return 'degraded';
    return 'healthy';
  }

  /**
   * Register an alert
   */
  public registerAlert(
    name: string,
    severity: AlertSeverity,
    condition: AlertCondition,
    message: string
  ): void {
    const alert: Alert = {
      id: `alert_${Date.now()}`,
      name,
      severity,
      condition,
      message,
      timestamp: new Date(),
      resolved: false
    };
    
    this.alerts.set(alert.id, alert);
    this.log('info', `Alert registered: ${name}`);
  }

  /**
   * Evaluate alerts
   */
  private evaluateAlerts(): void {
    this.alerts.forEach(alert => {
      if (alert.resolved) return;
      
      const shouldTrigger = this.evaluateAlertCondition(alert.condition);
      
      if (shouldTrigger && !this.activeAlerts.has(alert.id)) {
        this.triggerAlert(alert);
      } else if (!shouldTrigger && this.activeAlerts.has(alert.id)) {
        this.resolveAlert(alert);
      }
    });
  }

  /**
   * Evaluate alert condition
   */
  private evaluateAlertCondition(condition: AlertCondition): boolean {
    const metric = this.metrics.get(condition.metric);
    if (!metric || metric.dataPoints.length === 0) return false;
    
    // Get recent data points
    const now = Date.now();
    const duration = condition.duration || 0;
    const recentPoints = metric.dataPoints.filter(
      p => now - p.timestamp.getTime() <= duration
    );
    
    if (recentPoints.length === 0) return false;
    
    // Calculate aggregated value
    let value: number;
    switch (condition.aggregation || 'avg') {
      case 'avg':
        value = recentPoints.reduce((sum, p) => sum + p.value, 0) / recentPoints.length;
        break;
      case 'sum':
        value = recentPoints.reduce((sum, p) => sum + p.value, 0);
        break;
      case 'min':
        value = Math.min(...recentPoints.map(p => p.value));
        break;
      case 'max':
        value = Math.max(...recentPoints.map(p => p.value));
        break;
      case 'count':
        value = recentPoints.length;
        break;
      default:
        value = recentPoints[recentPoints.length - 1].value;
    }
    
    // Evaluate condition
    switch (condition.operator) {
      case 'gt': return value > condition.threshold;
      case 'gte': return value >= condition.threshold;
      case 'lt': return value < condition.threshold;
      case 'lte': return value <= condition.threshold;
      case 'eq': return value === condition.threshold;
      case 'neq': return value !== condition.threshold;
      default: return false;
    }
  }

  /**
   * Trigger an alert
   */
  private triggerAlert(alert: Alert): void {
    this.activeAlerts.add(alert.id);
    this.emit('alert', alert);
    this.log(
      alert.severity === AlertSeverity.CRITICAL ? 'error' : 'warn',
      `Alert triggered: ${alert.name} - ${alert.message}`
    );
  }

  /**
   * Resolve an alert
   */
  private resolveAlert(alert: Alert): void {
    this.activeAlerts.delete(alert.id);
    alert.resolved = true;
    alert.resolvedAt = new Date();
    this.emit('alert-resolved', alert);
    this.log('info', `Alert resolved: ${alert.name}`);
  }

  /**
   * Get performance metrics
   */
  public getPerformanceMetrics(): PerformanceMetrics {
    const state = this.orchestratorStore.getState();
    const stats = agentRegistry.getStats();
    
    // Calculate task metrics
    const taskMetrics = {
      totalProcessed: state.metrics.totalTasksProcessed,
      totalFailed: state.metrics.totalTasksFailed,
      averageDuration: state.metrics.averageTaskDuration,
      p50Duration: this.calculatePercentile(this.taskDurations, 50),
      p95Duration: this.calculatePercentile(this.taskDurations, 95),
      p99Duration: this.calculatePercentile(this.taskDurations, 99),
      throughput: state.metrics.totalTasksProcessed / 
        ((Date.now() - this.startTime.getTime()) / 1000),
      errorRate: state.metrics.errorRate
    };
    
    // Calculate agent metrics
    const agentMetrics = {
      totalAgents: stats.totalAgents,
      activeAgents: stats.activeAgents,
      averageUtilization: Array.from(state.metrics.agentUtilization.values())
        .reduce((sum, u) => sum + u, 0) / state.agents.size || 0,
      averageResponseTime: stats.averageResponseTime
    };
    
    // Calculate workflow metrics
    const workflowExecutions = Array.from(state.activeExecutions.values());
    const completedWorkflows = workflowExecutions.filter(
      w => w.status === WorkflowStatus.COMPLETED
    );
    const failedWorkflows = workflowExecutions.filter(
      w => w.status === WorkflowStatus.FAILED
    );
    
    const workflowMetrics = {
      totalExecutions: workflowExecutions.length,
      activeExecutions: workflowExecutions.filter(
        w => w.status === WorkflowStatus.RUNNING
      ).length,
      completedExecutions: completedWorkflows.length,
      failedExecutions: failedWorkflows.length,
      averageDuration: this.calculateAverageWorkflowDuration(completedWorkflows),
      successRate: completedWorkflows.length / 
        (completedWorkflows.length + failedWorkflows.length) || 0
    };
    
    // System metrics
    const systemMetrics = {
      messageQueueSize: state.messageQueue.length,
      taskQueueSize: state.taskQueue.length,
      systemLoad: state.metrics.systemLoad,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024 // MB
    };
    
    return {
      taskMetrics,
      agentMetrics,
      workflowMetrics,
      systemMetrics
    };
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  /**
   * Calculate average workflow duration
   */
  private calculateAverageWorkflowDuration(workflows: WorkflowExecution[]): number {
    if (workflows.length === 0) return 0;
    
    const durations = workflows
      .filter(w => w.completedAt && w.startedAt)
      .map(w => w.completedAt!.getTime() - w.startedAt.getTime());
    
    return durations.reduce((sum, d) => sum + d, 0) / durations.length || 0;
  }

  /**
   * Clean up old metrics
   */
  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - this.config.metricsRetentionMs;
    
    this.metrics.forEach(metric => {
      metric.dataPoints = metric.dataPoints.filter(
        p => p.timestamp.getTime() > cutoff
      );
    });
  }

  /**
   * Export metrics in Prometheus format
   */
  public exportPrometheusMetrics(): string {
    if (!this.config.enablePrometheus) return '';
    
    let output = '';
    
    this.metrics.forEach(metric => {
      // Add metric help and type
      output += `# HELP ${metric.name} ${metric.description}\n`;
      output += `# TYPE ${metric.name} ${metric.type}\n`;
      
      // Add latest data point for each label combination
      const latestByLabels = new Map<string, MetricDataPoint>();
      
      metric.dataPoints.forEach(point => {
        const labelKey = JSON.stringify(point.labels || {});
        latestByLabels.set(labelKey, point);
      });
      
      latestByLabels.forEach(point => {
        const labels = point.labels 
          ? Object.entries(point.labels)
              .map(([k, v]) => `${k}="${v}"`)
              .join(',')
          : '';
        
        const labelStr = labels ? `{${labels}}` : '';
        output += `${metric.name}${labelStr} ${point.value}\n`;
      });
      
      output += '\n';
    });
    
    return output;
  }

  /**
   * Log a message
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    if (!this.config.enableLogging) return;
    
    const levels = ['debug', 'info', 'warn', 'error'];
    const configLevel = levels.indexOf(this.config.logLevel);
    const messageLevel = levels.indexOf(level);
    
    if (messageLevel >= configLevel) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [${level.toUpperCase()}] [Monitoring] ${message}`);
    }
  }

  /**
   * Dispose monitoring system
   */
  public dispose(): void {
    // Clear intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    
    // Clear data
    this.metrics.clear();
    this.alerts.clear();
    this.activeAlerts.clear();
    this.healthChecks.clear();
    
    // Remove all listeners
    this.removeAllListeners();
    
    this.log('info', 'Monitoring system disposed');
  }
}

// Export singleton instance
export const monitoringSystem = new MonitoringSystem();