/**
 * Deployment Workflow - Automated deployment pipeline
 * 
 * Orchestrates the complete deployment process including
 * build, testing, deployment, and rollback capabilities.
 */

import {
  Workflow,
  WorkflowNode,
  WorkflowNodeType,
  WorkflowEdge,
  Task,
  TaskStatus,
  AgentCapability,
  AgentPriority
} from '../types';

/**
 * Deployment environments
 */
export enum DeploymentEnvironment {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production',
  CANARY = 'canary'
}

/**
 * Deployment strategies
 */
export enum DeploymentStrategy {
  BLUE_GREEN = 'blue_green',
  CANARY = 'canary',
  ROLLING = 'rolling',
  RECREATE = 'recreate'
}

/**
 * Deployment workflow configuration
 */
export interface DeploymentConfig {
  applicationName: string;
  version: string;
  environment: DeploymentEnvironment;
  strategy: DeploymentStrategy;
  sourceCommit: string;
  sourceBranch: string;
  runTests?: boolean;
  requireApproval?: boolean;
  enableMonitoring?: boolean;
  rollbackOnFailure?: boolean;
  notificationChannels?: string[];
  healthCheckEndpoints?: string[];
  canaryPercentage?: number;
  rollingUpdateBatchSize?: number;
}

/**
 * Create a deployment workflow
 */
export function createDeploymentWorkflow(config: DeploymentConfig): Workflow {
  const workflowId = `wf_deploy_${config.applicationName}_${config.version}_${Date.now()}`;
  const nodes: WorkflowNode[] = [];
  const edges: WorkflowEdge[] = [];

  const isProduction = config.environment === DeploymentEnvironment.PRODUCTION;
  const priority = isProduction ? AgentPriority.CRITICAL : AgentPriority.HIGH;

  // ============================================================================
  // Node Definitions
  // ============================================================================

  // Start node
  nodes.push({
    id: 'start',
    type: WorkflowNodeType.START,
    name: 'Start Deployment',
    description: `Initialize deployment of ${config.applicationName} v${config.version}`,
    config: {},
    position: { x: 0, y: 0 }
  });

  // Pre-deployment validation
  nodes.push({
    id: 'pre_validation',
    type: WorkflowNodeType.TASK,
    name: 'Pre-deployment Validation',
    description: 'Validate deployment prerequisites',
    task: {
      id: '',
      type: 'deployment_validation',
      title: 'Validate deployment prerequisites',
      description: 'Check source code, dependencies, and environment readiness',
      status: TaskStatus.PENDING,
      priority,
      requiredCapabilities: [
        AgentCapability.DEPLOYMENT,
        AgentCapability.MONITORING
      ],
      input: {
        applicationName: config.applicationName,
        version: config.version,
        environment: config.environment,
        sourceCommit: config.sourceCommit,
        validationChecks: [
          'source_integrity',
          'dependency_check',
          'environment_health',
          'resource_availability'
        ]
      },
      dependencies: [],
      subtasks: [],
      checkpoints: [],
      metadata: {
        createdAt: new Date(),
        retryCount: 0,
        maxRetries: 2,
        estimatedDuration: 600000 // 10 minutes
      }
    },
    config: {},
    position: { x: 100, y: 0 }
  });

  // Build application
  nodes.push({
    id: 'build',
    type: WorkflowNodeType.TASK,
    name: 'Build Application',
    description: 'Build and package the application',
    task: {
      id: '',
      type: 'build',
      title: `Build ${config.applicationName} v${config.version}`,
      description: 'Compile code, bundle assets, and create deployment artifacts',
      status: TaskStatus.PENDING,
      priority,
      requiredCapabilities: [
        AgentCapability.CODE_GENERATION,
        AgentCapability.DEPLOYMENT
      ],
      input: {
        applicationName: config.applicationName,
        version: config.version,
        sourceCommit: config.sourceCommit,
        buildType: isProduction ? 'production' : 'development',
        optimizations: isProduction
      },
      dependencies: [],
      subtasks: [],
      checkpoints: [],
      metadata: {
        createdAt: new Date(),
        retryCount: 0,
        maxRetries: 3,
        estimatedDuration: 1800000 // 30 minutes
      }
    },
    config: {},
    position: { x: 200, y: 0 }
  });

  // Run tests (optional)
  if (config.runTests) {
    nodes.push({
      id: 'test_suite',
      type: WorkflowNodeType.TASK,
      name: 'Run Test Suite',
      description: 'Execute automated tests',
      task: {
        id: '',
        type: 'testing',
        title: 'Run deployment tests',
        description: 'Execute unit, integration, and smoke tests',
        status: TaskStatus.PENDING,
        priority: AgentPriority.HIGH,
        requiredCapabilities: [AgentCapability.TESTING],
        input: {
          applicationName: config.applicationName,
          version: config.version,
          testSuites: isProduction 
            ? ['unit', 'integration', 'e2e', 'performance', 'security']
            : ['unit', 'integration', 'smoke'],
          failFast: isProduction
        },
        dependencies: [],
        subtasks: [],
        checkpoints: [],
        metadata: {
          createdAt: new Date(),
          retryCount: 0,
          maxRetries: 1,
          estimatedDuration: isProduction ? 3600000 : 1800000 // 30-60 minutes
        }
      },
      config: {},
      position: { x: 300, y: 0 }
    });
  }

  // Security scan
  if (isProduction) {
    nodes.push({
      id: 'security_scan',
      type: WorkflowNodeType.TASK,
      name: 'Security Scan',
      description: 'Perform security vulnerability scan',
      task: {
        id: '',
        type: 'security_scan',
        title: 'Security vulnerability scan',
        description: 'Scan for security vulnerabilities and compliance issues',
        status: TaskStatus.PENDING,
        priority: AgentPriority.CRITICAL,
        requiredCapabilities: [AgentCapability.SECURITY_AUDIT],
        input: {
          applicationName: config.applicationName,
          version: config.version,
          scanTypes: ['dependencies', 'code', 'containers', 'infrastructure'],
          complianceChecks: ['PCI', 'GDPR', 'SOC2']
        },
        dependencies: [],
        subtasks: [],
        checkpoints: [],
        metadata: {
          createdAt: new Date(),
          retryCount: 0,
          maxRetries: 1,
          estimatedDuration: 1200000 // 20 minutes
        }
      },
      config: {},
      position: { x: 400, y: -50 }
    });
  }

  // Approval gate (optional)
  if (config.requireApproval) {
    nodes.push({
      id: 'approval_gate',
      type: WorkflowNodeType.HUMAN_APPROVAL,
      name: 'Deployment Approval',
      description: 'Manual approval required for deployment',
      config: {
        approvalMessage: `Approve deployment of ${config.applicationName} v${config.version} to ${config.environment}`,
        approvers: isProduction ? ['devops-lead', 'product-owner'] : ['team-lead'],
        timeout: isProduction ? 3600000 : 1800000, // 30-60 minutes
        requireAllApprovers: isProduction
      },
      position: { x: 500, y: 0 }
    });
  }

  // Backup current state (for production)
  if (isProduction) {
    nodes.push({
      id: 'backup',
      type: WorkflowNodeType.TASK,
      name: 'Backup Current State',
      description: 'Create backup of current deployment',
      task: {
        id: '',
        type: 'backup',
        title: 'Create deployment backup',
        description: 'Backup database, configurations, and current application state',
        status: TaskStatus.PENDING,
        priority: AgentPriority.CRITICAL,
        requiredCapabilities: [
          AgentCapability.DATABASE_OPERATIONS,
          AgentCapability.DEPLOYMENT
        ],
        input: {
          environment: config.environment,
          backupTypes: ['database', 'configuration', 'application'],
          retentionDays: 30
        },
        dependencies: [],
        subtasks: [],
        checkpoints: [],
        metadata: {
          createdAt: new Date(),
          retryCount: 0,
          maxRetries: 2,
          estimatedDuration: 1800000 // 30 minutes
        }
      },
      config: {},
      position: { x: 600, y: 0 }
    });
  }

  // Deployment strategy implementation
  const deploymentNodeId = `deploy_${config.strategy}`;
  nodes.push({
    id: deploymentNodeId,
    type: WorkflowNodeType.TASK,
    name: `${config.strategy.replace('_', ' ').toUpperCase()} Deployment`,
    description: `Deploy using ${config.strategy} strategy`,
    task: {
      id: '',
      type: 'deployment_execution',
      title: `Deploy ${config.applicationName} v${config.version}`,
      description: `Execute ${config.strategy} deployment to ${config.environment}`,
      status: TaskStatus.PENDING,
      priority,
      requiredCapabilities: [
        AgentCapability.DEPLOYMENT,
        AgentCapability.MONITORING
      ],
      input: {
        applicationName: config.applicationName,
        version: config.version,
        environment: config.environment,
        strategy: config.strategy,
        strategyConfig: getStrategyConfig(config),
        rollbackEnabled: config.rollbackOnFailure
      },
      dependencies: [],
      subtasks: [],
      checkpoints: [],
      metadata: {
        createdAt: new Date(),
        retryCount: 0,
        maxRetries: isProduction ? 1 : 2,
        estimatedDuration: getDeploymentDuration(config),
        humanApprovalRequired: false
      }
    },
    config: {},
    position: { x: 700, y: 0 }
  });

  // Health checks
  nodes.push({
    id: 'health_check',
    type: WorkflowNodeType.TASK,
    name: 'Health Checks',
    description: 'Verify deployment health',
    task: {
      id: '',
      type: 'health_check',
      title: 'Verify deployment health',
      description: 'Check application health and readiness',
      status: TaskStatus.PENDING,
      priority,
      requiredCapabilities: [
        AgentCapability.MONITORING,
        AgentCapability.TESTING
      ],
      input: {
        applicationName: config.applicationName,
        version: config.version,
        environment: config.environment,
        endpoints: config.healthCheckEndpoints || ['/health', '/ready'],
        checks: ['response_time', 'error_rate', 'dependencies', 'database'],
        thresholds: {
          responseTime: 1000,
          errorRate: 0.01,
          availability: 0.99
        }
      },
      dependencies: [],
      subtasks: [],
      checkpoints: [],
      metadata: {
        createdAt: new Date(),
        retryCount: 0,
        maxRetries: 3,
        estimatedDuration: 600000 // 10 minutes
      }
    },
    config: {},
    position: { x: 800, y: 0 }
  });

  // Smoke tests
  nodes.push({
    id: 'smoke_tests',
    type: WorkflowNodeType.TASK,
    name: 'Smoke Tests',
    description: 'Run smoke tests on deployed application',
    task: {
      id: '',
      type: 'smoke_testing',
      title: 'Execute smoke tests',
      description: 'Verify critical functionality after deployment',
      status: TaskStatus.PENDING,
      priority: AgentPriority.HIGH,
      requiredCapabilities: [AgentCapability.TESTING],
      input: {
        applicationName: config.applicationName,
        version: config.version,
        environment: config.environment,
        testScenarios: [
          'user_login',
          'api_endpoints',
          'database_connectivity',
          'external_integrations'
        ]
      },
      dependencies: [],
      subtasks: [],
      checkpoints: [],
      metadata: {
        createdAt: new Date(),
        retryCount: 0,
        maxRetries: 2,
        estimatedDuration: 900000 // 15 minutes
      }
    },
    config: {},
    position: { x: 900, y: 0 }
  });

  // Decision: Deployment successful?
  nodes.push({
    id: 'deployment_check',
    type: WorkflowNodeType.DECISION,
    name: 'Deployment Check',
    description: 'Check if deployment was successful',
    conditions: [
      {
        field: 'healthCheckPassed',
        operator: 'eq',
        value: true
      },
      {
        field: 'smokeTestsPassed',
        operator: 'eq',
        value: true,
        combinator: 'and'
      }
    ],
    config: {},
    position: { x: 1000, y: 0 }
  });

  // Rollback (if enabled)
  if (config.rollbackOnFailure) {
    nodes.push({
      id: 'rollback',
      type: WorkflowNodeType.TASK,
      name: 'Rollback Deployment',
      description: 'Rollback to previous version',
      task: {
        id: '',
        type: 'rollback',
        title: 'Rollback deployment',
        description: 'Restore previous application version',
        status: TaskStatus.PENDING,
        priority: AgentPriority.CRITICAL,
        requiredCapabilities: [AgentCapability.DEPLOYMENT],
        input: {
          applicationName: config.applicationName,
          currentVersion: config.version,
          environment: config.environment,
          backupId: 'from_backup',
          strategy: 'immediate'
        },
        dependencies: [],
        subtasks: [],
        checkpoints: [],
        metadata: {
          createdAt: new Date(),
          retryCount: 0,
          maxRetries: 1,
          estimatedDuration: 1200000 // 20 minutes
        }
      },
      config: {},
      position: { x: 1000, y: 100 }
    });
  }

  // Monitoring setup (optional)
  if (config.enableMonitoring) {
    nodes.push({
      id: 'monitoring_setup',
      type: WorkflowNodeType.TASK,
      name: 'Setup Monitoring',
      description: 'Configure monitoring and alerting',
      task: {
        id: '',
        type: 'monitoring_setup',
        title: 'Configure monitoring',
        description: 'Setup metrics, logs, and alerts for new deployment',
        status: TaskStatus.PENDING,
        priority: AgentPriority.MEDIUM,
        requiredCapabilities: [AgentCapability.MONITORING],
        input: {
          applicationName: config.applicationName,
          version: config.version,
          environment: config.environment,
          metrics: ['cpu', 'memory', 'requests', 'errors', 'latency'],
          alertThresholds: {
            errorRate: 0.05,
            responseTime: 2000,
            cpuUsage: 80,
            memoryUsage: 85
          }
        },
        dependencies: [],
        subtasks: [],
        checkpoints: [],
        metadata: {
          createdAt: new Date(),
          retryCount: 0,
          maxRetries: 1,
          estimatedDuration: 600000 // 10 minutes
        }
      },
      config: {},
      position: { x: 1100, y: -50 }
    });
  }

  // Notification
  nodes.push({
    id: 'notify',
    type: WorkflowNodeType.TASK,
    name: 'Send Notifications',
    description: 'Notify stakeholders about deployment status',
    task: {
      id: '',
      type: 'notification',
      title: 'Send deployment notifications',
      description: 'Notify team about deployment status',
      status: TaskStatus.PENDING,
      priority: AgentPriority.LOW,
      requiredCapabilities: [AgentCapability.USER_INTERACTION],
      input: {
        applicationName: config.applicationName,
        version: config.version,
        environment: config.environment,
        status: 'from_deployment_check',
        channels: config.notificationChannels || ['email', 'slack'],
        includeMetrics: true
      },
      dependencies: [],
      subtasks: [],
      checkpoints: [],
      metadata: {
        createdAt: new Date(),
        retryCount: 0,
        maxRetries: 0,
        estimatedDuration: 300000 // 5 minutes
      }
    },
    config: {},
    position: { x: 1200, y: 0 }
  });

  // Error handler
  nodes.push({
    id: 'error_handler',
    type: WorkflowNodeType.ERROR_HANDLER,
    name: 'Error Handler',
    description: 'Handle deployment errors',
    config: {
      rollbackOnError: config.rollbackOnFailure,
      notifyOnError: true,
      createIncident: isProduction
    },
    position: { x: 700, y: 150 }
  });

  // End node
  nodes.push({
    id: 'end',
    type: WorkflowNodeType.END,
    name: 'Complete Deployment',
    description: 'Deployment workflow completed',
    config: {},
    position: { x: 1300, y: 0 }
  });

  // ============================================================================
  // Edge Definitions
  // ============================================================================

  let edgeId = 1;
  let currentNode = 'start';

  // Main flow
  edges.push({ id: `e${edgeId++}`, source: currentNode, target: 'pre_validation' });
  currentNode = 'pre_validation';

  edges.push({ id: `e${edgeId++}`, source: currentNode, target: 'build' });
  currentNode = 'build';

  if (config.runTests) {
    edges.push({ id: `e${edgeId++}`, source: currentNode, target: 'test_suite' });
    currentNode = 'test_suite';
  }

  if (isProduction) {
    edges.push({ id: `e${edgeId++}`, source: currentNode, target: 'security_scan' });
    currentNode = 'security_scan';
  }

  if (config.requireApproval) {
    edges.push({ id: `e${edgeId++}`, source: currentNode, target: 'approval_gate' });
    currentNode = 'approval_gate';
  }

  if (isProduction) {
    edges.push({ id: `e${edgeId++}`, source: currentNode, target: 'backup' });
    currentNode = 'backup';
  }

  edges.push({ id: `e${edgeId++}`, source: currentNode, target: deploymentNodeId });
  edges.push({ id: `e${edgeId++}`, source: deploymentNodeId, target: 'health_check' });
  edges.push({ id: `e${edgeId++}`, source: 'health_check', target: 'smoke_tests' });
  edges.push({ id: `e${edgeId++}`, source: 'smoke_tests', target: 'deployment_check' });

  // Success path
  edges.push({
    id: `e${edgeId++}`,
    source: 'deployment_check',
    target: config.enableMonitoring ? 'monitoring_setup' : 'notify',
    condition: {
      field: 'deploymentSuccessful',
      operator: 'eq',
      value: true
    }
  });

  if (config.enableMonitoring) {
    edges.push({ id: `e${edgeId++}`, source: 'monitoring_setup', target: 'notify' });
  }

  // Failure path
  if (config.rollbackOnFailure) {
    edges.push({
      id: `e${edgeId++}`,
      source: 'deployment_check',
      target: 'rollback',
      condition: {
        field: 'deploymentSuccessful',
        operator: 'eq',
        value: false
      },
      label: 'Deployment failed'
    });
    edges.push({ id: `e${edgeId++}`, source: 'rollback', target: 'notify' });
  } else {
    edges.push({
      id: `e${edgeId++}`,
      source: 'deployment_check',
      target: 'notify',
      condition: {
        field: 'deploymentSuccessful',
        operator: 'eq',
        value: false
      },
      label: 'Deployment failed'
    });
  }

  edges.push({ id: `e${edgeId++}`, source: 'notify', target: 'end' });

  // Error handling
  ['build', deploymentNodeId, 'health_check'].forEach(nodeId => {
    edges.push({
      id: `e${edgeId++}`,
      source: nodeId,
      target: 'error_handler',
      label: 'On error'
    });
  });

  return {
    id: workflowId,
    name: `Deploy ${config.applicationName} v${config.version}`,
    description: `${config.strategy} deployment to ${config.environment}`,
    version: '1.0.0',
    status: 'ready' as any,
    nodes,
    edges,
    variables: config as any,
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      author: 'system',
      tags: ['deployment', config.environment, config.strategy],
      category: 'deployment',
      estimatedDuration: getWorkflowDuration(config)
    },
    config: {
      maxExecutionTime: 14400000, // 4 hours
      maxRetries: 0, // No retry for entire workflow
      parallelismLimit: 5,
      requiresApproval: config.requireApproval || isProduction,
      notificationChannels: config.notificationChannels || ['email', 'slack']
    }
  };
}

/**
 * Get strategy-specific configuration
 */
function getStrategyConfig(config: DeploymentConfig): any {
  switch (config.strategy) {
    case DeploymentStrategy.CANARY:
      return {
        initialPercentage: config.canaryPercentage || 10,
        incrementPercentage: 20,
        waitBetweenIncrements: 600000, // 10 minutes
        successThreshold: 0.99
      };
    case DeploymentStrategy.ROLLING:
      return {
        batchSize: config.rollingUpdateBatchSize || 2,
        waitBetweenBatches: 300000, // 5 minutes
        maxUnavailable: 1
      };
    case DeploymentStrategy.BLUE_GREEN:
      return {
        switchoverDelay: 300000, // 5 minutes
        keepOldVersion: true,
        trafficSplitDuration: 600000 // 10 minutes
      };
    default:
      return {};
  }
}

/**
 * Get estimated deployment duration based on strategy
 */
function getDeploymentDuration(config: DeploymentConfig): number {
  const baseDuration = 1800000; // 30 minutes base
  
  switch (config.strategy) {
    case DeploymentStrategy.CANARY:
      return baseDuration * 3; // 90 minutes for gradual rollout
    case DeploymentStrategy.ROLLING:
      const batchCount = 5; // Assume 5 batches
      return baseDuration + (300000 * batchCount); // Base + wait between batches
    case DeploymentStrategy.BLUE_GREEN:
      return baseDuration + 600000; // Base + switchover time
    default:
      return baseDuration;
  }
}

/**
 * Get estimated total workflow duration
 */
function getWorkflowDuration(config: DeploymentConfig): number {
  let duration = 600000; // 10 min pre-validation
  duration += 1800000; // 30 min build
  
  if (config.runTests) {
    duration += config.environment === DeploymentEnvironment.PRODUCTION ? 3600000 : 1800000;
  }
  
  if (config.environment === DeploymentEnvironment.PRODUCTION) {
    duration += 1200000; // 20 min security scan
    duration += 1800000; // 30 min backup
  }
  
  duration += getDeploymentDuration(config);
  duration += 600000; // 10 min health checks
  duration += 900000; // 15 min smoke tests
  
  if (config.enableMonitoring) {
    duration += 600000; // 10 min monitoring setup
  }
  
  return duration;
}