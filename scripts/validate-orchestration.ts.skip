#!/usr/bin/env node

/**
 * Agent Orchestration System Validation Script
 * 
 * Validates that all components of the orchestration system are properly
 * configured and functioning correctly.
 */

import { Orchestrator, useOrchestratorStore } from '../lib/agents/orchestrator';
import { AgentRegistry } from '../lib/agents/registry';
import { MonitoringSystem, MetricType } from '../lib/agents/monitoring';
import { createBugFixWorkflow, BugSeverity } from '../lib/agents/workflows/bugfix';
import { createDeploymentWorkflow, DeploymentTarget, DeploymentStrategy } from '../lib/agents/workflows/deployment';
import { runMarketplaceSearchExample } from '../lib/agents/examples/marketplace-search';
import {
  Agent,
  AgentId,
  AgentCapability,
  AgentStatus,
  AgentPriority,
  TaskStatus,
  WorkflowStatus
} from '../lib/agents/types';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class OrchestrationValidator {
  private orchestrator: Orchestrator | null = null;
  private registry: AgentRegistry | null = null;
  private monitoring: MonitoringSystem | null = null;
  private validationResults: {
    component: string;
    status: 'passed' | 'failed' | 'warning';
    message: string;
    details?: any;
  }[] = [];

  constructor() {
    console.log(`${colors.bright}${colors.cyan}====================================`);
    console.log('Agent Orchestration System Validator');
    console.log(`====================================${colors.reset}\n`);
  }

  /**
   * Run all validation checks
   */
  async validate(): Promise<boolean> {
    console.log(`${colors.bright}Starting validation...${colors.reset}\n`);

    // Core components
    await this.validateCoreComponents();
    
    // Agent management
    await this.validateAgentManagement();
    
    // Task execution
    await this.validateTaskExecution();
    
    // Workflow execution
    await this.validateWorkflowExecution();
    
    // Monitoring and metrics
    await this.validateMonitoring();
    
    // Integration tests
    await this.validateIntegration();
    
    // Performance benchmarks
    await this.validatePerformance();
    
    // Generate report
    return this.generateReport();
  }

  /**
   * Validate core components initialization
   */
  private async validateCoreComponents(): Promise<void> {
    console.log(`${colors.blue}▶ Validating Core Components${colors.reset}`);

    try {
      // Initialize orchestrator
      this.orchestrator = new Orchestrator();
      this.addResult('Orchestrator', 'passed', 'Successfully initialized');

      // Initialize registry
      this.registry = new AgentRegistry();
      this.addResult('Registry', 'passed', 'Successfully initialized');

      // Initialize monitoring with Prometheus enabled
      this.monitoring = new MonitoringSystem({ 
        enableLogging: false,
        enablePrometheus: true 
      });
      this.addResult('Monitoring', 'passed', 'Successfully initialized');

      // Check store initialization
      const state = useOrchestratorStore.getState();
      if (state.config && state.systemStatus) {
        this.addResult('Store', 'passed', 'State management initialized');
      } else {
        this.addResult('Store', 'failed', 'State management not properly initialized');
      }

    } catch (error) {
      this.addResult('Core Components', 'failed', `Initialization failed: ${error}`);
    }

    console.log();
  }

  /**
   * Validate agent management functionality
   */
  private async validateAgentManagement(): Promise<void> {
    console.log(`${colors.blue}▶ Validating Agent Management${colors.reset}`);

    try {
      // Create test agent
      const testAgent: Agent = {
        id: 'agent_validator_test' as AgentId,
        name: 'Validation Test Agent',
        description: 'Agent for validation testing',
        capabilities: [AgentCapability.CODE_GENERATION, AgentCapability.TESTING],
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
      };

      // Test registration
      this.registry!.registerAgent(testAgent);
      useOrchestratorStore.getState().registerAgent(testAgent);
      
      const registeredAgent = this.registry!.getAgent(testAgent.id);
      if (registeredAgent?.id === testAgent.id) {
        this.addResult('Agent Registration', 'passed', 'Agent registered successfully');
      } else {
        this.addResult('Agent Registration', 'failed', 'Agent not found after registration');
      }

      // Test capability search
      const matches = this.registry!.findAgentsByCapabilities([AgentCapability.CODE_GENERATION]);
      if (matches.length > 0 && matches.some(m => m.agent.id === testAgent.id)) {
        this.addResult('Capability Search', 'passed', 'Agent found by capability');
      } else {
        this.addResult('Capability Search', 'failed', 'Agent not found in capability search');
      }

      // Test status update
      this.registry!.updateAgentStatus(testAgent.id, AgentStatus.BUSY);
      const updatedAgent = this.registry!.getAgent(testAgent.id);
      if (updatedAgent?.status === AgentStatus.BUSY) {
        this.addResult('Status Update', 'passed', 'Agent status updated successfully');
      } else {
        this.addResult('Status Update', 'failed', 'Agent status not updated');
      }

      // Test unregistration
      this.registry!.unregisterAgent(testAgent.id);
      useOrchestratorStore.getState().unregisterAgent(testAgent.id);
      
      const unregisteredAgent = this.registry!.getAgent(testAgent.id);
      if (!unregisteredAgent) {
        this.addResult('Agent Unregistration', 'passed', 'Agent unregistered successfully');
      } else {
        this.addResult('Agent Unregistration', 'failed', 'Agent still exists after unregistration');
      }

    } catch (error) {
      this.addResult('Agent Management', 'failed', `Validation failed: ${error}`);
    }

    console.log();
  }

  /**
   * Validate task execution
   */
  private async validateTaskExecution(): Promise<void> {
    console.log(`${colors.blue}▶ Validating Task Execution${colors.reset}`);

    try {
      // Create test agent for task execution
      const taskAgent: Agent = {
        id: 'agent_task_executor' as AgentId,
        name: 'Task Executor',
        description: 'Agent for task execution validation',
        capabilities: [AgentCapability.CODE_GENERATION],
        status: AgentStatus.IDLE,
        priority: AgentPriority.HIGH,
        version: '1.0.0',
        metadata: {
          createdAt: new Date(),
          lastActiveAt: new Date(),
          totalTasksCompleted: 0,
          averageResponseTime: 50,
          successRate: 1.0,
          maxConcurrentTasks: 3
        },
        config: {
          timeout: 10000,
          retryPolicy: {
            maxRetries: 2,
            backoffMultiplier: 2,
            initialDelay: 100
          },
          resourceLimits: {
            maxMemoryMB: 256,
            maxCPUPercent: 30
          }
        }
      };

      this.registry!.registerAgent(taskAgent);
      useOrchestratorStore.getState().registerAgent(taskAgent);

      // Create task
      const taskId = useOrchestratorStore.getState().createTask({
        type: 'validation_test',
        title: 'Validation Test Task',
        description: 'Task for validation testing',
        status: TaskStatus.PENDING,
        priority: AgentPriority.HIGH,
        requiredCapabilities: [AgentCapability.CODE_GENERATION],
        input: { test: true },
        dependencies: [],
        subtasks: [],
        checkpoints: []
      });

      const task = useOrchestratorStore.getState().tasks.get(taskId);
      if (task) {
        this.addResult('Task Creation', 'passed', `Task created with ID: ${taskId}`);
        
        // Check if task was assigned
        if (task.status === TaskStatus.ASSIGNED && task.assignedTo) {
          this.addResult('Task Assignment', 'passed', `Task assigned to agent: ${task.assignedTo}`);
        } else {
          this.addResult('Task Assignment', 'warning', 'Task not automatically assigned');
        }
      } else {
        this.addResult('Task Creation', 'failed', 'Task not found after creation');
      }

      // Test task completion
      useOrchestratorStore.getState().completeTask(taskId, { result: 'success' });
      const completedTask = useOrchestratorStore.getState().tasks.get(taskId);
      
      if (completedTask?.status === TaskStatus.COMPLETED) {
        this.addResult('Task Completion', 'passed', 'Task completed successfully');
      } else {
        this.addResult('Task Completion', 'failed', 'Task not marked as completed');
      }

      // Test metrics update
      const metrics = useOrchestratorStore.getState().metrics;
      if (metrics.totalTasksProcessed > 0) {
        this.addResult('Task Metrics', 'passed', `Processed tasks: ${metrics.totalTasksProcessed}`);
      } else {
        this.addResult('Task Metrics', 'warning', 'Task metrics not updated');
      }

      // Cleanup
      this.registry!.unregisterAgent(taskAgent.id);
      useOrchestratorStore.getState().unregisterAgent(taskAgent.id);

    } catch (error) {
      this.addResult('Task Execution', 'failed', `Validation failed: ${error}`);
    }

    console.log();
  }

  /**
   * Validate workflow execution
   */
  private async validateWorkflowExecution(): Promise<void> {
    console.log(`${colors.blue}▶ Validating Workflow Execution${colors.reset}`);

    try {
      // Create a simple test workflow
      const testWorkflow = createBugFixWorkflow({
        bugId: 'TEST-001',
        title: 'Test Bug',
        description: 'Validation test bug',
        severity: BugSeverity.LOW,
        affectedComponents: ['test'],
        reportedBy: 'validator@test.com',
        enableRootCauseAnalysis: false,
        enableRegressionTesting: false,
        autoDeployFix: false
      });

      // Register workflow
      useOrchestratorStore.getState().registerWorkflow(testWorkflow);
      this.addResult('Workflow Registration', 'passed', `Workflow registered: ${testWorkflow.id}`);

      // Start workflow
      const executionId = useOrchestratorStore.getState().startWorkflow(testWorkflow.id, {
        test: true
      });
      
      const execution = useOrchestratorStore.getState().activeExecutions.get(executionId);
      if (execution && execution.status === WorkflowStatus.RUNNING) {
        this.addResult('Workflow Start', 'passed', `Workflow execution started: ${executionId}`);
      } else {
        this.addResult('Workflow Start', 'failed', 'Workflow not running after start');
      }

      // Test pause/resume
      useOrchestratorStore.getState().pauseWorkflow(executionId);
      let pausedExecution = useOrchestratorStore.getState().activeExecutions.get(executionId);
      
      if (pausedExecution?.status === WorkflowStatus.PAUSED) {
        this.addResult('Workflow Pause', 'passed', 'Workflow paused successfully');
      } else {
        this.addResult('Workflow Pause', 'warning', 'Workflow pause not working');
      }

      useOrchestratorStore.getState().resumeWorkflow(executionId);
      let resumedExecution = useOrchestratorStore.getState().activeExecutions.get(executionId);
      
      if (resumedExecution?.status === WorkflowStatus.RUNNING) {
        this.addResult('Workflow Resume', 'passed', 'Workflow resumed successfully');
      } else {
        this.addResult('Workflow Resume', 'warning', 'Workflow resume not working');
      }

      // Cancel workflow
      useOrchestratorStore.getState().cancelWorkflow(executionId);
      const cancelledExecution = useOrchestratorStore.getState().activeExecutions.get(executionId);
      
      if (cancelledExecution?.status === WorkflowStatus.CANCELLED) {
        this.addResult('Workflow Cancel', 'passed', 'Workflow cancelled successfully');
      } else {
        this.addResult('Workflow Cancel', 'failed', 'Workflow not cancelled');
      }

    } catch (error) {
      this.addResult('Workflow Execution', 'failed', `Validation failed: ${error}`);
    }

    console.log();
  }

  /**
   * Validate monitoring and metrics
   */
  private async validateMonitoring(): Promise<void> {
    console.log(`${colors.blue}▶ Validating Monitoring System${colors.reset}`);

    try {
      // Register custom metric
      this.monitoring!.registerMetric({
        name: 'validation_test_metric',
        type: MetricType.GAUGE,
        description: 'Test metric for validation',
        unit: 'units'
      });
      this.addResult('Metric Registration', 'passed', 'Custom metric registered');

      // Record metric value
      this.monitoring!.setGauge('validation_test_metric', 42);
      
      // Export Prometheus metrics
      const prometheusOutput = this.monitoring!.exportPrometheusMetrics();
      if (prometheusOutput.includes('validation_test_metric') && prometheusOutput.includes('42')) {
        this.addResult('Metric Recording', 'passed', 'Metric value recorded and exported');
      } else {
        this.addResult('Metric Recording', 'failed', 'Metric not found in export');
      }

      // Register alert
      this.monitoring!.registerAlert(
        'Test Alert',
        'warning' as any,
        {
          metric: 'validation_test_metric',
          operator: 'gt',
          threshold: 40
        },
        'Test alert for validation'
      );
      this.addResult('Alert Registration', 'passed', 'Alert registered successfully');

      // Get performance metrics
      const perfMetrics = this.monitoring!.getPerformanceMetrics();
      if (perfMetrics && perfMetrics.systemMetrics) {
        this.addResult('Performance Metrics', 'passed', 'Performance metrics available', {
          taskMetrics: perfMetrics.taskMetrics.totalProcessed,
          agentMetrics: perfMetrics.agentMetrics.totalAgents,
          systemLoad: perfMetrics.systemMetrics.systemLoad
        });
      } else {
        this.addResult('Performance Metrics', 'warning', 'Performance metrics incomplete');
      }

    } catch (error) {
      this.addResult('Monitoring System', 'failed', `Validation failed: ${error}`);
    }

    console.log();
  }

  /**
   * Validate integration between components
   */
  private async validateIntegration(): Promise<void> {
    console.log(`${colors.blue}▶ Validating Component Integration${colors.reset}`);

    try {
      // Create multiple agents
      const agents: Agent[] = [];
      for (let i = 0; i < 3; i++) {
        const agent: Agent = {
          id: `agent_integration_${i}` as AgentId,
          name: `Integration Agent ${i}`,
          description: 'Agent for integration testing',
          capabilities: i === 0 ? [AgentCapability.CODE_GENERATION] :
                       i === 1 ? [AgentCapability.TESTING] :
                                [AgentCapability.DEPLOYMENT],
          status: AgentStatus.IDLE,
          priority: AgentPriority.MEDIUM,
          version: '1.0.0',
          metadata: {
            createdAt: new Date(),
            lastActiveAt: new Date(),
            totalTasksCompleted: 0,
            averageResponseTime: 100,
            successRate: 0.95,
            maxConcurrentTasks: 2
          },
          config: {
            timeout: 5000,
            retryPolicy: {
              maxRetries: 1,
              backoffMultiplier: 2,
              initialDelay: 100
            },
            resourceLimits: {
              maxMemoryMB: 256,
              maxCPUPercent: 25
            }
          }
        };
        
        agents.push(agent);
        this.registry!.registerAgent(agent);
        useOrchestratorStore.getState().registerAgent(agent);
      }

      // Create dependent tasks
      const task1Id = useOrchestratorStore.getState().createTask({
        type: 'code',
        title: 'Generate code',
        description: 'Integration test',
        status: TaskStatus.PENDING,
        priority: AgentPriority.HIGH,
        requiredCapabilities: [AgentCapability.CODE_GENERATION],
        input: {},
        dependencies: [],
        subtasks: [],
        checkpoints: []
      });

      const task2Id = useOrchestratorStore.getState().createTask({
        type: 'test',
        title: 'Test code',
        description: 'Integration test',
        status: TaskStatus.PENDING,
        priority: AgentPriority.HIGH,
        requiredCapabilities: [AgentCapability.TESTING],
        input: {},
        dependencies: [task1Id],
        subtasks: [],
        checkpoints: []
      });

      const task3Id = useOrchestratorStore.getState().createTask({
        type: 'deploy',
        title: 'Deploy code',
        description: 'Integration test',
        status: TaskStatus.PENDING,
        priority: AgentPriority.HIGH,
        requiredCapabilities: [AgentCapability.DEPLOYMENT],
        input: {},
        dependencies: [task2Id],
        subtasks: [],
        checkpoints: []
      });

      // Check task dependencies
      const task1 = useOrchestratorStore.getState().tasks.get(task1Id);
      const task2 = useOrchestratorStore.getState().tasks.get(task2Id);
      const task3 = useOrchestratorStore.getState().tasks.get(task3Id);

      if (task1?.status === TaskStatus.ASSIGNED &&
          task2?.status === TaskStatus.PENDING &&
          task3?.status === TaskStatus.PENDING) {
        this.addResult('Task Dependencies', 'passed', 'Dependency chain properly enforced');
      } else {
        this.addResult('Task Dependencies', 'failed', 'Dependency chain not working correctly');
      }

      // Check agent assignment
      const activeAgents = Array.from(useOrchestratorStore.getState().activeTasks.values());
      if (activeAgents.length > 0) {
        this.addResult('Agent Assignment', 'passed', `${activeAgents.length} agents assigned tasks`);
      } else {
        this.addResult('Agent Assignment', 'warning', 'No agents assigned to tasks');
      }

      // Cleanup
      agents.forEach(agent => {
        this.registry!.unregisterAgent(agent.id);
        useOrchestratorStore.getState().unregisterAgent(agent.id);
      });

    } catch (error) {
      this.addResult('Component Integration', 'failed', `Validation failed: ${error}`);
    }

    console.log();
  }

  /**
   * Validate performance benchmarks
   */
  private async validatePerformance(): Promise<void> {
    console.log(`${colors.blue}▶ Validating Performance${colors.reset}`);

    try {
      const startTime = Date.now();
      
      // Create many tasks quickly
      const taskIds: string[] = [];
      for (let i = 0; i < 100; i++) {
        const taskId = useOrchestratorStore.getState().createTask({
          type: `perf_test_${i}`,
          title: `Performance test ${i}`,
          description: 'Performance validation',
          status: TaskStatus.PENDING,
          priority: AgentPriority.LOW,
          requiredCapabilities: [AgentCapability.CODE_GENERATION],
          input: { index: i },
          dependencies: [],
          subtasks: [],
          checkpoints: []
        });
        taskIds.push(taskId);
      }
      
      const creationTime = Date.now() - startTime;
      
      if (creationTime < 1000) {
        this.addResult('Task Creation Performance', 'passed', 
          `Created 100 tasks in ${creationTime}ms`);
      } else {
        this.addResult('Task Creation Performance', 'warning', 
          `Task creation slow: ${creationTime}ms for 100 tasks`);
      }

      // Check memory usage
      const memoryUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      
      if (heapUsedMB < 200) {
        this.addResult('Memory Usage', 'passed', `Heap used: ${heapUsedMB}MB`);
      } else {
        this.addResult('Memory Usage', 'warning', `High memory usage: ${heapUsedMB}MB`);
      }

      // Check system load
      const state = useOrchestratorStore.getState();
      const systemLoad = state.metrics.systemLoad;
      
      if (systemLoad < 0.8) {
        this.addResult('System Load', 'passed', `System load: ${(systemLoad * 100).toFixed(1)}%`);
      } else {
        this.addResult('System Load', 'warning', `High system load: ${(systemLoad * 100).toFixed(1)}%`);
      }

    } catch (error) {
      this.addResult('Performance Validation', 'failed', `Validation failed: ${error}`);
    }

    console.log();
  }

  /**
   * Add validation result
   */
  private addResult(
    component: string,
    status: 'passed' | 'failed' | 'warning',
    message: string,
    details?: any
  ): void {
    this.validationResults.push({ component, status, message, details });
    
    const icon = status === 'passed' ? '✓' : status === 'failed' ? '✗' : '⚠';
    const color = status === 'passed' ? colors.green : 
                  status === 'failed' ? colors.red : colors.yellow;
    
    console.log(`  ${color}${icon} ${component}: ${message}${colors.reset}`);
    
    if (details) {
      console.log(`    ${colors.cyan}Details: ${JSON.stringify(details, null, 2)}${colors.reset}`);
    }
  }

  /**
   * Generate validation report
   */
  private generateReport(): boolean {
    console.log(`\n${colors.bright}${colors.cyan}====================================`);
    console.log('Validation Report');
    console.log(`====================================${colors.reset}\n`);

    const passed = this.validationResults.filter(r => r.status === 'passed').length;
    const failed = this.validationResults.filter(r => r.status === 'failed').length;
    const warnings = this.validationResults.filter(r => r.status === 'warning').length;
    const total = this.validationResults.length;

    console.log(`${colors.bright}Summary:${colors.reset}`);
    console.log(`  ${colors.green}Passed: ${passed}/${total}${colors.reset}`);
    console.log(`  ${colors.red}Failed: ${failed}/${total}${colors.reset}`);
    console.log(`  ${colors.yellow}Warnings: ${warnings}/${total}${colors.reset}`);

    const successRate = (passed / total) * 100;
    console.log(`\n${colors.bright}Success Rate: ${successRate.toFixed(1)}%${colors.reset}`);

    if (failed > 0) {
      console.log(`\n${colors.red}Failed Components:${colors.reset}`);
      this.validationResults
        .filter(r => r.status === 'failed')
        .forEach(r => {
          console.log(`  - ${r.component}: ${r.message}`);
        });
    }

    if (warnings > 0) {
      console.log(`\n${colors.yellow}Warnings:${colors.reset}`);
      this.validationResults
        .filter(r => r.status === 'warning')
        .forEach(r => {
          console.log(`  - ${r.component}: ${r.message}`);
        });
    }

    // Cleanup
    this.cleanup();

    const allPassed = failed === 0;
    
    console.log(`\n${colors.bright}${colors.cyan}====================================`);
    if (allPassed) {
      console.log(`${colors.green}✓ Validation PASSED${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Validation FAILED${colors.reset}`);
    }
    console.log(`${colors.cyan}====================================${colors.reset}\n`);

    return allPassed;
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    if (this.orchestrator) {
      this.orchestrator.dispose();
    }
    if (this.registry) {
      this.registry.dispose();
    }
    if (this.monitoring) {
      this.monitoring.dispose();
    }
    useOrchestratorStore.getState().reset();
  }
}

/**
 * Run validation
 */
async function main(): Promise<void> {
  const validator = new OrchestrationValidator();
  
  try {
    const success = await validator.validate();
    
    // Optionally run examples
    if (process.argv.includes('--with-examples')) {
      console.log(`\n${colors.bright}${colors.magenta}Running Examples...${colors.reset}\n`);
      await runMarketplaceSearchExample();
    }
    
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error(`${colors.red}Validation failed with error:${colors.reset}`, error);
    process.exit(1);
  }
}

// Run validation if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { OrchestrationValidator };