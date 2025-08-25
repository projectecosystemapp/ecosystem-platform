/**
 * Development Workflow - Feature development automation
 * 
 * Orchestrates the complete feature development lifecycle including
 * planning, implementation, testing, and deployment.
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
 * Create a feature development workflow
 */
export function createDevelopmentWorkflow(
  featureName: string,
  requirements: string[],
  config?: {
    enableCodeReview?: boolean;
    enableTesting?: boolean;
    enableDocumentation?: boolean;
    deploymentTarget?: 'staging' | 'production';
  }
): Workflow {
  const workflowId = `wf_dev_${Date.now()}`;
  const nodes: WorkflowNode[] = [];
  const edges: WorkflowEdge[] = [];

  // ============================================================================
  // Node Definitions
  // ============================================================================

  // Start node
  nodes.push({
    id: 'start',
    type: WorkflowNodeType.START,
    name: 'Start Development',
    description: 'Initialize feature development workflow',
    config: {},
    position: { x: 0, y: 0 }
  });

  // Planning node
  nodes.push({
    id: 'planning',
    type: WorkflowNodeType.TASK,
    name: 'Feature Planning',
    description: 'Analyze requirements and create implementation plan',
    task: {
      id: '',
      type: 'planning',
      title: `Plan ${featureName} implementation`,
      description: `Analyze requirements and create detailed implementation plan for ${featureName}`,
      status: TaskStatus.PENDING,
      priority: AgentPriority.HIGH,
      requiredCapabilities: [AgentCapability.DATA_ANALYSIS, AgentCapability.DOCUMENTATION],
      input: {
        featureName,
        requirements,
        analysisDepth: 'comprehensive'
      },
      dependencies: [],
      subtasks: [],
      checkpoints: [],
      metadata: {
        createdAt: new Date(),
        retryCount: 0,
        maxRetries: 2,
        estimatedDuration: 3600000 // 1 hour
      }
    },
    config: {},
    position: { x: 100, y: 0 }
  });

  // Decision: Approve plan
  nodes.push({
    id: 'approve_plan',
    type: WorkflowNodeType.HUMAN_APPROVAL,
    name: 'Approve Implementation Plan',
    description: 'Human review and approval of implementation plan',
    config: {
      approvalMessage: 'Please review and approve the implementation plan',
      timeout: 86400000 // 24 hours
    },
    position: { x: 200, y: 0 }
  });

  // Parallel implementation tasks
  nodes.push({
    id: 'parallel_impl',
    type: WorkflowNodeType.PARALLEL,
    name: 'Parallel Implementation',
    description: 'Execute implementation tasks in parallel',
    config: {},
    position: { x: 300, y: 0 }
  });

  // Backend implementation
  nodes.push({
    id: 'backend_impl',
    type: WorkflowNodeType.TASK,
    name: 'Backend Implementation',
    description: 'Implement backend components',
    task: {
      id: '',
      type: 'backend_development',
      title: `Implement backend for ${featureName}`,
      description: 'Create API endpoints, database schemas, and business logic',
      status: TaskStatus.PENDING,
      priority: AgentPriority.HIGH,
      requiredCapabilities: [
        AgentCapability.CODE_GENERATION,
        AgentCapability.DATABASE_OPERATIONS,
        AgentCapability.API_INTEGRATION
      ],
      input: {
        featureName,
        specifications: 'from_planning_output'
      },
      dependencies: [],
      subtasks: [],
      checkpoints: [],
      metadata: {
        createdAt: new Date(),
        retryCount: 0,
        maxRetries: 3,
        estimatedDuration: 7200000 // 2 hours
      }
    },
    config: {},
    position: { x: 400, y: -50 }
  });

  // Frontend implementation
  nodes.push({
    id: 'frontend_impl',
    type: WorkflowNodeType.TASK,
    name: 'Frontend Implementation',
    description: 'Implement frontend components',
    task: {
      id: '',
      type: 'frontend_development',
      title: `Implement frontend for ${featureName}`,
      description: 'Create UI components, state management, and user interactions',
      status: TaskStatus.PENDING,
      priority: AgentPriority.HIGH,
      requiredCapabilities: [
        AgentCapability.CODE_GENERATION,
        AgentCapability.USER_INTERACTION
      ],
      input: {
        featureName,
        specifications: 'from_planning_output'
      },
      dependencies: [],
      subtasks: [],
      checkpoints: [],
      metadata: {
        createdAt: new Date(),
        retryCount: 0,
        maxRetries: 3,
        estimatedDuration: 7200000 // 2 hours
      }
    },
    config: {},
    position: { x: 400, y: 50 }
  });

  // Integration
  nodes.push({
    id: 'integration',
    type: WorkflowNodeType.TASK,
    name: 'Integration',
    description: 'Integrate frontend and backend components',
    task: {
      id: '',
      type: 'integration',
      title: `Integrate components for ${featureName}`,
      description: 'Connect frontend and backend, configure routing and data flow',
      status: TaskStatus.PENDING,
      priority: AgentPriority.MEDIUM,
      requiredCapabilities: [
        AgentCapability.CODE_GENERATION,
        AgentCapability.API_INTEGRATION
      ],
      input: {
        featureName,
        frontendOutput: 'from_frontend_impl',
        backendOutput: 'from_backend_impl'
      },
      dependencies: [],
      subtasks: [],
      checkpoints: [],
      metadata: {
        createdAt: new Date(),
        retryCount: 0,
        maxRetries: 2,
        estimatedDuration: 3600000 // 1 hour
      }
    },
    config: {},
    position: { x: 500, y: 0 }
  });

  // Code review (optional)
  if (config?.enableCodeReview) {
    nodes.push({
      id: 'code_review',
      type: WorkflowNodeType.TASK,
      name: 'Code Review',
      description: 'Automated code review and quality checks',
      task: {
        id: '',
        type: 'code_review',
        title: `Review code for ${featureName}`,
        description: 'Perform automated code review, check for best practices and potential issues',
        status: TaskStatus.PENDING,
        priority: AgentPriority.MEDIUM,
        requiredCapabilities: [
          AgentCapability.CODE_REVIEW,
          AgentCapability.SECURITY_AUDIT
        ],
        input: {
          featureName,
          codeChanges: 'from_integration'
        },
        dependencies: [],
        subtasks: [],
        checkpoints: [],
        metadata: {
          createdAt: new Date(),
          retryCount: 0,
          maxRetries: 1,
          estimatedDuration: 1800000 // 30 minutes
        }
      },
      config: {},
      position: { x: 600, y: 0 }
    });
  }

  // Testing (optional)
  if (config?.enableTesting) {
    nodes.push({
      id: 'testing',
      type: WorkflowNodeType.TASK,
      name: 'Testing',
      description: 'Run automated tests',
      task: {
        id: '',
        type: 'testing',
        title: `Test ${featureName}`,
        description: 'Execute unit tests, integration tests, and E2E tests',
        status: TaskStatus.PENDING,
        priority: AgentPriority.HIGH,
        requiredCapabilities: [AgentCapability.TESTING],
        input: {
          featureName,
          testSuites: ['unit', 'integration', 'e2e']
        },
        dependencies: [],
        subtasks: [],
        checkpoints: [],
        metadata: {
          createdAt: new Date(),
          retryCount: 0,
          maxRetries: 2,
          estimatedDuration: 3600000 // 1 hour
        }
      },
      config: {},
      position: { x: 700, y: 0 }
    });
  }

  // Documentation (optional)
  if (config?.enableDocumentation) {
    nodes.push({
      id: 'documentation',
      type: WorkflowNodeType.TASK,
      name: 'Documentation',
      description: 'Generate or update documentation',
      task: {
        id: '',
        type: 'documentation',
        title: `Document ${featureName}`,
        description: 'Create API documentation, user guides, and code comments',
        status: TaskStatus.PENDING,
        priority: AgentPriority.LOW,
        requiredCapabilities: [AgentCapability.DOCUMENTATION],
        input: {
          featureName,
          codeBase: 'from_integration',
          includeApiDocs: true,
          includeUserGuide: true
        },
        dependencies: [],
        subtasks: [],
        checkpoints: [],
        metadata: {
          createdAt: new Date(),
          retryCount: 0,
          maxRetries: 1,
          estimatedDuration: 1800000 // 30 minutes
        }
      },
      config: {},
      position: { x: 800, y: 50 }
    });
  }

  // Pre-deployment checks
  nodes.push({
    id: 'pre_deploy_checks',
    type: WorkflowNodeType.TASK,
    name: 'Pre-deployment Checks',
    description: 'Validate deployment readiness',
    task: {
      id: '',
      type: 'deployment_validation',
      title: 'Validate deployment readiness',
      description: 'Check build status, test results, and deployment requirements',
      status: TaskStatus.PENDING,
      priority: AgentPriority.HIGH,
      requiredCapabilities: [
        AgentCapability.DEPLOYMENT,
        AgentCapability.MONITORING
      ],
      input: {
        featureName,
        deploymentTarget: config?.deploymentTarget || 'staging'
      },
      dependencies: [],
      subtasks: [],
      checkpoints: [],
      metadata: {
        createdAt: new Date(),
        retryCount: 0,
        maxRetries: 1,
        estimatedDuration: 900000 // 15 minutes
      }
    },
    config: {},
    position: { x: 900, y: 0 }
  });

  // Deployment decision
  nodes.push({
    id: 'deploy_decision',
    type: WorkflowNodeType.DECISION,
    name: 'Deployment Decision',
    description: 'Decide whether to deploy based on checks',
    conditions: [
      {
        field: 'deploymentReady',
        operator: 'eq',
        value: true
      }
    ],
    config: {},
    position: { x: 1000, y: 0 }
  });

  // Deployment
  nodes.push({
    id: 'deployment',
    type: WorkflowNodeType.TASK,
    name: 'Deployment',
    description: 'Deploy feature to target environment',
    task: {
      id: '',
      type: 'deployment',
      title: `Deploy ${featureName}`,
      description: `Deploy feature to ${config?.deploymentTarget || 'staging'} environment`,
      status: TaskStatus.PENDING,
      priority: AgentPriority.CRITICAL,
      requiredCapabilities: [AgentCapability.DEPLOYMENT],
      input: {
        featureName,
        target: config?.deploymentTarget || 'staging',
        rollbackEnabled: true
      },
      dependencies: [],
      subtasks: [],
      checkpoints: [],
      metadata: {
        createdAt: new Date(),
        retryCount: 0,
        maxRetries: 2,
        estimatedDuration: 1800000, // 30 minutes
        humanApprovalRequired: config?.deploymentTarget === 'production'
      }
    },
    config: {},
    position: { x: 1100, y: 0 }
  });

  // Post-deployment monitoring
  nodes.push({
    id: 'monitoring',
    type: WorkflowNodeType.TASK,
    name: 'Post-deployment Monitoring',
    description: 'Monitor deployment health',
    task: {
      id: '',
      type: 'monitoring',
      title: 'Monitor deployment health',
      description: 'Check metrics, logs, and performance after deployment',
      status: TaskStatus.PENDING,
      priority: AgentPriority.HIGH,
      requiredCapabilities: [AgentCapability.MONITORING],
      input: {
        featureName,
        duration: 3600000, // Monitor for 1 hour
        metrics: ['errors', 'performance', 'usage']
      },
      dependencies: [],
      subtasks: [],
      checkpoints: [],
      metadata: {
        createdAt: new Date(),
        retryCount: 0,
        maxRetries: 0,
        estimatedDuration: 3600000 // 1 hour
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
    description: 'Handle workflow errors and failures',
    config: {
      rollbackOnError: true,
      notifyOnError: true
    },
    position: { x: 600, y: 150 }
  });

  // End node
  nodes.push({
    id: 'end',
    type: WorkflowNodeType.END,
    name: 'Complete Development',
    description: 'Feature development completed',
    config: {},
    position: { x: 1300, y: 0 }
  });

  // ============================================================================
  // Edge Definitions
  // ============================================================================

  // Main flow
  edges.push({ id: 'e1', source: 'start', target: 'planning' });
  edges.push({ id: 'e2', source: 'planning', target: 'approve_plan' });
  edges.push({ id: 'e3', source: 'approve_plan', target: 'parallel_impl' });
  edges.push({ id: 'e4', source: 'parallel_impl', target: 'backend_impl' });
  edges.push({ id: 'e5', source: 'parallel_impl', target: 'frontend_impl' });
  edges.push({ id: 'e6', source: 'backend_impl', target: 'integration' });
  edges.push({ id: 'e7', source: 'frontend_impl', target: 'integration' });

  let lastNode = 'integration';
  let edgeCount = 8;

  // Optional code review
  if (config?.enableCodeReview) {
    edges.push({ 
      id: `e${edgeCount++}`, 
      source: lastNode, 
      target: 'code_review' 
    });
    lastNode = 'code_review';
  }

  // Optional testing
  if (config?.enableTesting) {
    edges.push({ 
      id: `e${edgeCount++}`, 
      source: lastNode, 
      target: 'testing' 
    });
    lastNode = 'testing';
  }

  // Optional documentation (parallel with main flow)
  if (config?.enableDocumentation) {
    edges.push({ 
      id: `e${edgeCount++}`, 
      source: 'integration', 
      target: 'documentation' 
    });
  }

  // Continue main flow
  edges.push({ 
    id: `e${edgeCount++}`, 
    source: lastNode, 
    target: 'pre_deploy_checks' 
  });
  edges.push({ 
    id: `e${edgeCount++}`, 
    source: 'pre_deploy_checks', 
    target: 'deploy_decision' 
  });
  
  // Deployment path
  edges.push({ 
    id: `e${edgeCount++}`, 
    source: 'deploy_decision', 
    target: 'deployment',
    condition: {
      field: 'deploymentReady',
      operator: 'eq',
      value: true
    }
  });
  
  // Skip deployment path
  edges.push({ 
    id: `e${edgeCount++}`, 
    source: 'deploy_decision', 
    target: 'end',
    condition: {
      field: 'deploymentReady',
      operator: 'eq',
      value: false
    },
    label: 'Skip deployment'
  });

  edges.push({ 
    id: `e${edgeCount++}`, 
    source: 'deployment', 
    target: 'monitoring' 
  });
  edges.push({ 
    id: `e${edgeCount++}`, 
    source: 'monitoring', 
    target: 'end' 
  });

  // Error handling edges
  ['planning', 'backend_impl', 'frontend_impl', 'integration', 'deployment'].forEach(nodeId => {
    edges.push({
      id: `e${edgeCount++}`,
      source: nodeId,
      target: 'error_handler',
      label: 'On error'
    });
  });

  return {
    id: workflowId,
    name: `${featureName} Development`,
    description: `Complete development workflow for ${featureName} feature`,
    version: '1.0.0',
    status: 'ready' as any,
    nodes,
    edges,
    variables: {
      featureName,
      requirements,
      enableCodeReview: config?.enableCodeReview || false,
      enableTesting: config?.enableTesting || true,
      enableDocumentation: config?.enableDocumentation || false,
      deploymentTarget: config?.deploymentTarget || 'staging'
    },
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      author: 'system',
      tags: ['development', 'feature', 'automation'],
      category: 'development',
      estimatedDuration: 14400000 // 4 hours
    },
    config: {
      maxExecutionTime: 28800000, // 8 hours
      maxRetries: 2,
      parallelismLimit: 5,
      requiresApproval: true,
      notificationChannels: ['email', 'slack']
    }
  };
}

/**
 * Create a hotfix workflow
 */
export function createHotfixWorkflow(
  issueName: string,
  severity: 'critical' | 'high' | 'medium' | 'low'
): Workflow {
  const workflow = createDevelopmentWorkflow(
    `Hotfix: ${issueName}`,
    [`Fix ${issueName}`, 'Ensure no regression', 'Deploy immediately'],
    {
      enableCodeReview: true,
      enableTesting: true,
      enableDocumentation: false,
      deploymentTarget: severity === 'critical' ? 'production' : 'staging'
    }
  );

  // Modify workflow for hotfix specifics
  workflow.name = `Hotfix: ${issueName}`;
  workflow.description = `Emergency fix workflow for ${issueName}`;
  workflow.metadata.tags = ['hotfix', 'emergency', severity];
  workflow.config.maxExecutionTime = 7200000; // 2 hours for hotfix
  
  return workflow;
}