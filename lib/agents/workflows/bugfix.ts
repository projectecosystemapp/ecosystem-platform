/**
 * Bug Fix Workflow - Automated bug resolution
 * 
 * Orchestrates the complete bug fixing lifecycle including
 * reproduction, root cause analysis, fix implementation, and verification.
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
 * Bug severity levels
 */
export enum BugSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

/**
 * Bug fix workflow configuration
 */
export interface BugFixConfig {
  bugId: string;
  title: string;
  description: string;
  severity: BugSeverity;
  affectedComponents: string[];
  reportedBy: string;
  enableRootCauseAnalysis?: boolean;
  enableRegressionTesting?: boolean;
  autoDeployFix?: boolean;
}

/**
 * Create a bug fix workflow
 */
export function createBugFixWorkflow(config: BugFixConfig): Workflow {
  const workflowId = `wf_bugfix_${config.bugId}_${Date.now()}`;
  const nodes: WorkflowNode[] = [];
  const edges: WorkflowEdge[] = [];

  // Priority based on severity
  const priority = config.severity === BugSeverity.CRITICAL 
    ? AgentPriority.CRITICAL
    : config.severity === BugSeverity.HIGH
    ? AgentPriority.HIGH
    : AgentPriority.MEDIUM;

  // ============================================================================
  // Node Definitions
  // ============================================================================

  // Start node
  nodes.push({
    id: 'start',
    type: WorkflowNodeType.START,
    name: 'Start Bug Fix',
    description: `Initialize bug fix workflow for ${config.bugId}`,
    config: {},
    position: { x: 0, y: 0 }
  });

  // Bug analysis
  nodes.push({
    id: 'bug_analysis',
    type: WorkflowNodeType.TASK,
    name: 'Bug Analysis',
    description: 'Analyze bug report and gather context',
    task: {
      id: '',
      type: 'bug_analysis',
      title: `Analyze bug ${config.bugId}`,
      description: 'Review bug report, logs, and affected code',
      status: TaskStatus.PENDING,
      priority,
      requiredCapabilities: [
        AgentCapability.DATA_ANALYSIS,
        AgentCapability.CODE_REVIEW
      ],
      input: {
        bugId: config.bugId,
        description: config.description,
        affectedComponents: config.affectedComponents,
        analysisScope: 'comprehensive'
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
    position: { x: 100, y: 0 }
  });

  // Reproduction attempt
  nodes.push({
    id: 'reproduction',
    type: WorkflowNodeType.TASK,
    name: 'Bug Reproduction',
    description: 'Attempt to reproduce the bug',
    task: {
      id: '',
      type: 'bug_reproduction',
      title: `Reproduce bug ${config.bugId}`,
      description: 'Create test case to reproduce the bug',
      status: TaskStatus.PENDING,
      priority,
      requiredCapabilities: [
        AgentCapability.TESTING,
        AgentCapability.CODE_GENERATION
      ],
      input: {
        bugId: config.bugId,
        analysisResults: 'from_bug_analysis',
        environment: 'test'
      },
      dependencies: [],
      subtasks: [],
      checkpoints: [],
      metadata: {
        createdAt: new Date(),
        retryCount: 0,
        maxRetries: 3,
        estimatedDuration: 2400000 // 40 minutes
      }
    },
    config: {},
    position: { x: 200, y: 0 }
  });

  // Decision: Bug reproduced?
  nodes.push({
    id: 'reproduction_check',
    type: WorkflowNodeType.DECISION,
    name: 'Reproduction Check',
    description: 'Check if bug was successfully reproduced',
    conditions: [
      {
        field: 'reproduced',
        operator: 'eq',
        value: true
      }
    ],
    config: {},
    position: { x: 300, y: 0 }
  });

  // Root cause analysis (optional)
  if (config.enableRootCauseAnalysis) {
    nodes.push({
      id: 'root_cause',
      type: WorkflowNodeType.TASK,
      name: 'Root Cause Analysis',
      description: 'Perform deep root cause analysis',
      task: {
        id: '',
        type: 'root_cause_analysis',
        title: 'Identify root cause',
        description: 'Analyze code flow, dependencies, and system state',
        status: TaskStatus.PENDING,
        priority,
        requiredCapabilities: [
          AgentCapability.DATA_ANALYSIS,
          AgentCapability.CODE_REVIEW,
          AgentCapability.PERFORMANCE_OPTIMIZATION
        ],
        input: {
          bugId: config.bugId,
          reproductionData: 'from_reproduction',
          analysisDepth: 'deep'
        },
        dependencies: [],
        subtasks: [],
        checkpoints: [],
        metadata: {
          createdAt: new Date(),
          retryCount: 0,
          maxRetries: 1,
          estimatedDuration: 3600000 // 1 hour
        }
      },
      config: {},
      position: { x: 400, y: -50 }
    });
  }

  // Fix implementation
  nodes.push({
    id: 'implement_fix',
    type: WorkflowNodeType.TASK,
    name: 'Implement Fix',
    description: 'Develop and implement the bug fix',
    task: {
      id: '',
      type: 'bug_fix_implementation',
      title: `Fix bug ${config.bugId}`,
      description: 'Implement code changes to resolve the bug',
      status: TaskStatus.PENDING,
      priority,
      requiredCapabilities: [
        AgentCapability.CODE_GENERATION,
        AgentCapability.BUG_FIXING,
        AgentCapability.REFACTORING
      ],
      input: {
        bugId: config.bugId,
        rootCause: config.enableRootCauseAnalysis ? 'from_root_cause' : 'from_analysis',
        affectedComponents: config.affectedComponents
      },
      dependencies: [],
      subtasks: [],
      checkpoints: [],
      metadata: {
        createdAt: new Date(),
        retryCount: 0,
        maxRetries: 2,
        estimatedDuration: 5400000 // 1.5 hours
      }
    },
    config: {},
    position: { x: 500, y: 0 }
  });

  // Unit tests for fix
  nodes.push({
    id: 'unit_tests',
    type: WorkflowNodeType.TASK,
    name: 'Create/Update Tests',
    description: 'Create or update unit tests for the fix',
    task: {
      id: '',
      type: 'test_creation',
      title: 'Create tests for bug fix',
      description: 'Ensure fix is covered by tests',
      status: TaskStatus.PENDING,
      priority: AgentPriority.HIGH,
      requiredCapabilities: [
        AgentCapability.TESTING,
        AgentCapability.CODE_GENERATION
      ],
      input: {
        bugId: config.bugId,
        fixImplementation: 'from_implement_fix',
        testTypes: ['unit', 'integration']
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

  // Fix verification
  nodes.push({
    id: 'verify_fix',
    type: WorkflowNodeType.TASK,
    name: 'Verify Fix',
    description: 'Verify that the bug is fixed',
    task: {
      id: '',
      type: 'fix_verification',
      title: 'Verify bug fix',
      description: 'Run tests and verify bug is resolved',
      status: TaskStatus.PENDING,
      priority,
      requiredCapabilities: [AgentCapability.TESTING],
      input: {
        bugId: config.bugId,
        originalTestCase: 'from_reproduction',
        fixedCode: 'from_implement_fix'
      },
      dependencies: [],
      subtasks: [],
      checkpoints: [],
      metadata: {
        createdAt: new Date(),
        retryCount: 0,
        maxRetries: 2,
        estimatedDuration: 1200000 // 20 minutes
      }
    },
    config: {},
    position: { x: 700, y: 0 }
  });

  // Regression testing (optional)
  if (config.enableRegressionTesting) {
    nodes.push({
      id: 'regression_tests',
      type: WorkflowNodeType.TASK,
      name: 'Regression Testing',
      description: 'Run full regression test suite',
      task: {
        id: '',
        type: 'regression_testing',
        title: 'Run regression tests',
        description: 'Ensure fix doesn\'t break existing functionality',
        status: TaskStatus.PENDING,
        priority: AgentPriority.HIGH,
        requiredCapabilities: [AgentCapability.TESTING],
        input: {
          bugId: config.bugId,
          testSuites: ['regression', 'smoke', 'integration'],
          affectedComponents: config.affectedComponents
        },
        dependencies: [],
        subtasks: [],
        checkpoints: [],
        metadata: {
          createdAt: new Date(),
          retryCount: 0,
          maxRetries: 1,
          estimatedDuration: 3600000 // 1 hour
        }
      },
      config: {},
      position: { x: 800, y: 0 }
    });
  }

  // Code review
  nodes.push({
    id: 'code_review',
    type: WorkflowNodeType.TASK,
    name: 'Code Review',
    description: 'Review the bug fix implementation',
    task: {
      id: '',
      type: 'code_review',
      title: 'Review bug fix',
      description: 'Automated and human code review',
      status: TaskStatus.PENDING,
      priority: AgentPriority.MEDIUM,
      requiredCapabilities: [
        AgentCapability.CODE_REVIEW,
        AgentCapability.SECURITY_AUDIT
      ],
      input: {
        bugId: config.bugId,
        changes: 'from_implement_fix',
        reviewChecklist: [
          'correctness',
          'performance',
          'security',
          'maintainability'
        ]
      },
      dependencies: [],
      subtasks: [],
      checkpoints: [],
      metadata: {
        createdAt: new Date(),
        retryCount: 0,
        maxRetries: 1,
        estimatedDuration: 1800000, // 30 minutes
        humanApprovalRequired: config.severity === BugSeverity.CRITICAL
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
    description: 'Decide whether to deploy the fix',
    conditions: [
      {
        field: 'fixVerified',
        operator: 'eq',
        value: true
      },
      {
        field: 'codeReviewPassed',
        operator: 'eq',
        value: true,
        combinator: 'and'
      }
    ],
    config: {},
    position: { x: 1000, y: 0 }
  });

  // Deployment (if auto-deploy enabled)
  if (config.autoDeployFix) {
    nodes.push({
      id: 'deploy_fix',
      type: WorkflowNodeType.TASK,
      name: 'Deploy Fix',
      description: 'Deploy the bug fix to production',
      task: {
        id: '',
        type: 'deployment',
        title: `Deploy fix for ${config.bugId}`,
        description: 'Deploy bug fix to appropriate environment',
        status: TaskStatus.PENDING,
        priority: config.severity === BugSeverity.CRITICAL 
          ? AgentPriority.CRITICAL 
          : AgentPriority.HIGH,
        requiredCapabilities: [AgentCapability.DEPLOYMENT],
        input: {
          bugId: config.bugId,
          target: config.severity === BugSeverity.CRITICAL ? 'production' : 'staging',
          rollbackEnabled: true,
          monitoringEnabled: true
        },
        dependencies: [],
        subtasks: [],
        checkpoints: [],
        metadata: {
          createdAt: new Date(),
          retryCount: 0,
          maxRetries: 2,
          estimatedDuration: 1800000, // 30 minutes
          humanApprovalRequired: config.severity === BugSeverity.CRITICAL
        }
      },
      config: {},
      position: { x: 1100, y: 0 }
    });
  }

  // Notification
  nodes.push({
    id: 'notify',
    type: WorkflowNodeType.TASK,
    name: 'Send Notifications',
    description: 'Notify stakeholders about fix status',
    task: {
      id: '',
      type: 'notification',
      title: 'Send fix notifications',
      description: 'Notify reporter and team about fix status',
      status: TaskStatus.PENDING,
      priority: AgentPriority.LOW,
      requiredCapabilities: [AgentCapability.USER_INTERACTION],
      input: {
        bugId: config.bugId,
        reporter: config.reportedBy,
        status: 'fixed',
        fixSummary: 'from_implement_fix'
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

  // Cannot reproduce handler
  nodes.push({
    id: 'cannot_reproduce',
    type: WorkflowNodeType.TASK,
    name: 'Cannot Reproduce',
    description: 'Handle case when bug cannot be reproduced',
    task: {
      id: '',
      type: 'investigation',
      title: 'Investigate non-reproducible bug',
      description: 'Gather more information and request clarification',
      status: TaskStatus.PENDING,
      priority: AgentPriority.MEDIUM,
      requiredCapabilities: [
        AgentCapability.DATA_ANALYSIS,
        AgentCapability.USER_INTERACTION
      ],
      input: {
        bugId: config.bugId,
        analysisResults: 'from_bug_analysis',
        action: 'request_more_info'
      },
      dependencies: [],
      subtasks: [],
      checkpoints: [],
      metadata: {
        createdAt: new Date(),
        retryCount: 0,
        maxRetries: 0,
        estimatedDuration: 900000 // 15 minutes
      }
    },
    config: {},
    position: { x: 300, y: 100 }
  });

  // Error handler
  nodes.push({
    id: 'error_handler',
    type: WorkflowNodeType.ERROR_HANDLER,
    name: 'Error Handler',
    description: 'Handle workflow errors',
    config: {
      notifyOnError: true,
      createIncident: config.severity === BugSeverity.CRITICAL
    },
    position: { x: 600, y: 150 }
  });

  // End node
  nodes.push({
    id: 'end',
    type: WorkflowNodeType.END,
    name: 'Complete Bug Fix',
    description: 'Bug fix workflow completed',
    config: {},
    position: { x: 1300, y: 0 }
  });

  // ============================================================================
  // Edge Definitions
  // ============================================================================

  // Main flow
  edges.push({ id: 'e1', source: 'start', target: 'bug_analysis' });
  edges.push({ id: 'e2', source: 'bug_analysis', target: 'reproduction' });
  edges.push({ id: 'e3', source: 'reproduction', target: 'reproduction_check' });

  // Reproduction successful path
  let currentNode = 'reproduction_check';
  let edgeId = 4;

  if (config.enableRootCauseAnalysis) {
    edges.push({
      id: `e${edgeId++}`,
      source: currentNode,
      target: 'root_cause',
      condition: {
        field: 'reproduced',
        operator: 'eq',
        value: true
      }
    });
    edges.push({
      id: `e${edgeId++}`,
      source: 'root_cause',
      target: 'implement_fix'
    });
  } else {
    edges.push({
      id: `e${edgeId++}`,
      source: currentNode,
      target: 'implement_fix',
      condition: {
        field: 'reproduced',
        operator: 'eq',
        value: true
      }
    });
  }

  // Cannot reproduce path
  edges.push({
    id: `e${edgeId++}`,
    source: 'reproduction_check',
    target: 'cannot_reproduce',
    condition: {
      field: 'reproduced',
      operator: 'eq',
      value: false
    },
    label: 'Cannot reproduce'
  });
  edges.push({
    id: `e${edgeId++}`,
    source: 'cannot_reproduce',
    target: 'notify'
  });

  // Fix implementation flow
  edges.push({ id: `e${edgeId++}`, source: 'implement_fix', target: 'unit_tests' });
  edges.push({ id: `e${edgeId++}`, source: 'unit_tests', target: 'verify_fix' });

  currentNode = 'verify_fix';

  if (config.enableRegressionTesting) {
    edges.push({ id: `e${edgeId++}`, source: currentNode, target: 'regression_tests' });
    currentNode = 'regression_tests';
  }

  edges.push({ id: `e${edgeId++}`, source: currentNode, target: 'code_review' });
  edges.push({ id: `e${edgeId++}`, source: 'code_review', target: 'deploy_decision' });

  // Deployment paths
  if (config.autoDeployFix) {
    edges.push({
      id: `e${edgeId++}`,
      source: 'deploy_decision',
      target: 'deploy_fix',
      condition: {
        field: 'fixVerified',
        operator: 'eq',
        value: true
      }
    });
    edges.push({ id: `e${edgeId++}`, source: 'deploy_fix', target: 'notify' });
  } else {
    edges.push({
      id: `e${edgeId++}`,
      source: 'deploy_decision',
      target: 'notify',
      condition: {
        field: 'fixVerified',
        operator: 'eq',
        value: true
      }
    });
  }

  // Fix failed path
  edges.push({
    id: `e${edgeId++}`,
    source: 'deploy_decision',
    target: 'error_handler',
    condition: {
      field: 'fixVerified',
      operator: 'eq',
      value: false
    },
    label: 'Fix failed'
  });

  edges.push({ id: `e${edgeId++}`, source: 'notify', target: 'end' });

  // Error handling
  ['implement_fix', 'verify_fix', 'deploy_fix'].forEach(nodeId => {
    if (nodes.find(n => n.id === nodeId)) {
      edges.push({
        id: `e${edgeId++}`,
        source: nodeId,
        target: 'error_handler',
        label: 'On error'
      });
    }
  });

  return {
    id: workflowId,
    name: `Bug Fix: ${config.title}`,
    description: `Automated bug fix workflow for ${config.bugId}`,
    version: '1.0.0',
    status: 'ready' as any,
    nodes,
    edges,
    variables: {
      bugId: config.bugId,
      severity: config.severity,
      affectedComponents: config.affectedComponents,
      reportedBy: config.reportedBy
    },
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      author: 'system',
      tags: ['bugfix', config.severity, 'automation'],
      category: 'maintenance',
      estimatedDuration: config.severity === BugSeverity.CRITICAL ? 7200000 : 10800000 // 2-3 hours
    },
    config: {
      maxExecutionTime: 14400000, // 4 hours
      maxRetries: 1,
      parallelismLimit: 3,
      requiresApproval: config.severity === BugSeverity.CRITICAL,
      notificationChannels: ['email', 'slack', 'jira']
    }
  };
}