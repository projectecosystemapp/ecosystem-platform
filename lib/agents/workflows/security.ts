/**
 * Security Audit Workflow - Comprehensive security assessment
 * 
 * Orchestrates security scanning, vulnerability assessment,
 * compliance checks, and remediation recommendations.
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
 * Security audit scope
 */
export enum AuditScope {
  QUICK = 'quick',
  STANDARD = 'standard',
  COMPREHENSIVE = 'comprehensive',
  COMPLIANCE = 'compliance'
}

/**
 * Compliance standards
 */
export enum ComplianceStandard {
  PCI_DSS = 'pci_dss',
  GDPR = 'gdpr',
  HIPAA = 'hipaa',
  SOC2 = 'soc2',
  ISO27001 = 'iso27001',
  CCPA = 'ccpa'
}

/**
 * Security audit configuration
 */
export interface SecurityAuditConfig {
  projectName: string;
  scope: AuditScope;
  complianceStandards?: ComplianceStandard[];
  includeCodeAnalysis?: boolean;
  includeDependencyScanning?: boolean;
  includeInfrastructureScanning?: boolean;
  includePenetrationTesting?: boolean;
  includeAccessReview?: boolean;
  includeDataPrivacyReview?: boolean;
  generateReport?: boolean;
  autoRemediate?: boolean;
  notificationChannels?: string[];
}

/**
 * Create a security audit workflow
 */
export function createSecurityAuditWorkflow(config: SecurityAuditConfig): Workflow {
  const workflowId = `wf_security_${config.projectName}_${Date.now()}`;
  const nodes: WorkflowNode[] = [];
  const edges: WorkflowEdge[] = [];

  const isComprehensive = config.scope === AuditScope.COMPREHENSIVE;
  const priority = isComprehensive ? AgentPriority.CRITICAL : AgentPriority.HIGH;

  // ============================================================================
  // Node Definitions
  // ============================================================================

  // Start node
  nodes.push({
    id: 'start',
    type: WorkflowNodeType.START,
    name: 'Start Security Audit',
    description: `Initialize security audit for ${config.projectName}`,
    config: {},
    position: { x: 0, y: 0 }
  });

  // Audit planning
  nodes.push({
    id: 'audit_planning',
    type: WorkflowNodeType.TASK,
    name: 'Audit Planning',
    description: 'Plan security audit scope and approach',
    task: {
      id: '',
      type: 'security_planning',
      title: 'Plan security audit',
      description: 'Define audit scope, tools, and methodology',
      status: TaskStatus.PENDING,
      priority,
      requiredCapabilities: [
        AgentCapability.SECURITY_AUDIT,
        AgentCapability.DATA_ANALYSIS
      ],
      input: {
        projectName: config.projectName,
        scope: config.scope,
        complianceStandards: config.complianceStandards || [],
        auditComponents: {
          code: config.includeCodeAnalysis,
          dependencies: config.includeDependencyScanning,
          infrastructure: config.includeInfrastructureScanning,
          penetration: config.includePenetrationTesting,
          access: config.includeAccessReview,
          privacy: config.includeDataPrivacyReview
        }
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
    position: { x: 100, y: 0 }
  });

  // Parallel scanning tasks
  nodes.push({
    id: 'parallel_scans',
    type: WorkflowNodeType.PARALLEL,
    name: 'Parallel Security Scans',
    description: 'Execute multiple security scans in parallel',
    config: {},
    position: { x: 200, y: 0 }
  });

  // Code analysis
  if (config.includeCodeAnalysis !== false) {
    nodes.push({
      id: 'code_analysis',
      type: WorkflowNodeType.TASK,
      name: 'Static Code Analysis',
      description: 'Analyze source code for vulnerabilities',
      task: {
        id: '',
        type: 'code_security_analysis',
        title: 'Perform static code analysis',
        description: 'Scan source code for security vulnerabilities and bad practices',
        status: TaskStatus.PENDING,
        priority,
        requiredCapabilities: [
          AgentCapability.SECURITY_AUDIT,
          AgentCapability.CODE_REVIEW
        ],
        input: {
          projectName: config.projectName,
          scanTypes: [
            'sql_injection',
            'xss',
            'csrf',
            'path_traversal',
            'command_injection',
            'authentication_bypass',
            'authorization_flaws',
            'cryptography_issues',
            'information_disclosure'
          ],
          languages: ['typescript', 'javascript', 'python', 'sql'],
          severityThreshold: 'low'
        },
        dependencies: [],
        subtasks: [],
        checkpoints: [],
        metadata: {
          createdAt: new Date(),
          retryCount: 0,
          maxRetries: 2,
          estimatedDuration: 2400000 // 40 minutes
        }
      },
      config: {},
      position: { x: 300, y: -100 }
    });
  }

  // Dependency scanning
  if (config.includeDependencyScanning !== false) {
    nodes.push({
      id: 'dependency_scan',
      type: WorkflowNodeType.TASK,
      name: 'Dependency Scanning',
      description: 'Scan dependencies for known vulnerabilities',
      task: {
        id: '',
        type: 'dependency_security_scan',
        title: 'Scan dependencies',
        description: 'Check all dependencies for known CVEs and vulnerabilities',
        status: TaskStatus.PENDING,
        priority: AgentPriority.HIGH,
        requiredCapabilities: [AgentCapability.SECURITY_AUDIT],
        input: {
          projectName: config.projectName,
          packageManagers: ['npm', 'pip', 'composer'],
          includeDev: isComprehensive,
          checkLicenses: true,
          checkOutdated: true
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
      position: { x: 300, y: -50 }
    });
  }

  // Infrastructure scanning
  if (config.includeInfrastructureScanning) {
    nodes.push({
      id: 'infra_scan',
      type: WorkflowNodeType.TASK,
      name: 'Infrastructure Scanning',
      description: 'Scan infrastructure configuration and deployment',
      task: {
        id: '',
        type: 'infrastructure_security_scan',
        title: 'Scan infrastructure',
        description: 'Check cloud resources, containers, and configurations',
        status: TaskStatus.PENDING,
        priority,
        requiredCapabilities: [
          AgentCapability.SECURITY_AUDIT,
          AgentCapability.DEPLOYMENT
        ],
        input: {
          projectName: config.projectName,
          platforms: ['vercel', 'supabase', 'stripe'],
          scanTypes: [
            'misconfigurations',
            'exposed_secrets',
            'network_policies',
            'iam_policies',
            'encryption_settings',
            'backup_policies'
          ]
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
      position: { x: 300, y: 0 }
    });
  }

  // API security testing
  nodes.push({
    id: 'api_security',
    type: WorkflowNodeType.TASK,
    name: 'API Security Testing',
    description: 'Test API endpoints for security vulnerabilities',
    task: {
      id: '',
      type: 'api_security_testing',
      title: 'Test API security',
      description: 'Check API endpoints for common vulnerabilities',
      status: TaskStatus.PENDING,
      priority,
      requiredCapabilities: [
        AgentCapability.SECURITY_AUDIT,
        AgentCapability.API_INTEGRATION,
        AgentCapability.TESTING
      ],
      input: {
        projectName: config.projectName,
        testTypes: [
          'authentication',
          'authorization',
          'rate_limiting',
          'input_validation',
          'injection_attacks',
          'broken_access_control',
          'excessive_data_exposure',
          'security_headers'
        ],
        endpoints: 'auto_discover'
      },
      dependencies: [],
      subtasks: [],
      checkpoints: [],
      metadata: {
        createdAt: new Date(),
        retryCount: 0,
        maxRetries: 1,
        estimatedDuration: 2400000 // 40 minutes
      }
    },
    config: {},
    position: { x: 300, y: 50 }
  });

  // Access control review
  if (config.includeAccessReview) {
    nodes.push({
      id: 'access_review',
      type: WorkflowNodeType.TASK,
      name: 'Access Control Review',
      description: 'Review user access and permissions',
      task: {
        id: '',
        type: 'access_control_review',
        title: 'Review access controls',
        description: 'Audit user roles, permissions, and access patterns',
        status: TaskStatus.PENDING,
        priority: AgentPriority.HIGH,
        requiredCapabilities: [
          AgentCapability.SECURITY_AUDIT,
          AgentCapability.DATA_ANALYSIS
        ],
        input: {
          projectName: config.projectName,
          reviewAreas: [
            'user_roles',
            'api_keys',
            'service_accounts',
            'database_access',
            'admin_privileges',
            'third_party_integrations'
          ],
          checkForAnomaly: true,
          reviewPeriodDays: 90
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
      position: { x: 300, y: 100 }
    });
  }

  // Data privacy review
  if (config.includeDataPrivacyReview) {
    nodes.push({
      id: 'privacy_review',
      type: WorkflowNodeType.TASK,
      name: 'Data Privacy Review',
      description: 'Review data handling and privacy compliance',
      task: {
        id: '',
        type: 'data_privacy_review',
        title: 'Review data privacy',
        description: 'Audit data collection, storage, and processing practices',
        status: TaskStatus.PENDING,
        priority: AgentPriority.HIGH,
        requiredCapabilities: [
          AgentCapability.SECURITY_AUDIT,
          AgentCapability.DATA_ANALYSIS
        ],
        input: {
          projectName: config.projectName,
          complianceStandards: config.complianceStandards || [],
          reviewAreas: [
            'data_collection',
            'data_storage',
            'data_retention',
            'data_encryption',
            'data_sharing',
            'user_consent',
            'data_deletion',
            'cross_border_transfers'
          ]
        },
        dependencies: [],
        subtasks: [],
        checkpoints: [],
        metadata: {
          createdAt: new Date(),
          retryCount: 0,
          maxRetries: 1,
          estimatedDuration: 2400000 // 40 minutes
        }
      },
      config: {},
      position: { x: 300, y: 150 }
    });
  }

  // Vulnerability aggregation
  nodes.push({
    id: 'vuln_aggregation',
    type: WorkflowNodeType.TASK,
    name: 'Vulnerability Aggregation',
    description: 'Aggregate and prioritize findings',
    task: {
      id: '',
      type: 'vulnerability_aggregation',
      title: 'Aggregate vulnerabilities',
      description: 'Combine, deduplicate, and prioritize all findings',
      status: TaskStatus.PENDING,
      priority,
      requiredCapabilities: [
        AgentCapability.DATA_ANALYSIS,
        AgentCapability.SECURITY_AUDIT
      ],
      input: {
        projectName: config.projectName,
        sources: 'all_scans',
        prioritizationFactors: [
          'severity',
          'exploitability',
          'business_impact',
          'fix_complexity'
        ]
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
    position: { x: 400, y: 0 }
  });

  // Risk assessment
  nodes.push({
    id: 'risk_assessment',
    type: WorkflowNodeType.TASK,
    name: 'Risk Assessment',
    description: 'Assess overall security risk',
    task: {
      id: '',
      type: 'security_risk_assessment',
      title: 'Assess security risks',
      description: 'Calculate risk scores and business impact',
      status: TaskStatus.PENDING,
      priority,
      requiredCapabilities: [
        AgentCapability.DATA_ANALYSIS,
        AgentCapability.SECURITY_AUDIT
      ],
      input: {
        projectName: config.projectName,
        vulnerabilities: 'from_aggregation',
        riskFactors: [
          'data_sensitivity',
          'user_base_size',
          'regulatory_requirements',
          'public_exposure',
          'financial_impact'
        ]
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
    position: { x: 500, y: 0 }
  });

  // Remediation planning
  nodes.push({
    id: 'remediation_plan',
    type: WorkflowNodeType.TASK,
    name: 'Remediation Planning',
    description: 'Create remediation plan for vulnerabilities',
    task: {
      id: '',
      type: 'remediation_planning',
      title: 'Plan remediation',
      description: 'Create prioritized remediation plan with estimates',
      status: TaskStatus.PENDING,
      priority: AgentPriority.HIGH,
      requiredCapabilities: [
        AgentCapability.SECURITY_AUDIT,
        AgentCapability.DOCUMENTATION
      ],
      input: {
        projectName: config.projectName,
        vulnerabilities: 'from_aggregation',
        riskAssessment: 'from_risk_assessment',
        includeQuickWins: true,
        includeLongTerm: true,
        generateTickets: config.autoRemediate
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

  // Auto-remediation (optional)
  if (config.autoRemediate) {
    nodes.push({
      id: 'auto_remediate',
      type: WorkflowNodeType.TASK,
      name: 'Auto-remediation',
      description: 'Automatically fix low-risk vulnerabilities',
      task: {
        id: '',
        type: 'auto_remediation',
        title: 'Apply automatic fixes',
        description: 'Fix low-risk vulnerabilities automatically',
        status: TaskStatus.PENDING,
        priority: AgentPriority.MEDIUM,
        requiredCapabilities: [
          AgentCapability.CODE_GENERATION,
          AgentCapability.BUG_FIXING,
          AgentCapability.SECURITY_AUDIT
        ],
        input: {
          projectName: config.projectName,
          remediationPlan: 'from_remediation_plan',
          autoFixTypes: [
            'dependency_updates',
            'security_headers',
            'input_validation',
            'error_handling',
            'logging_improvements'
          ],
          requireApproval: false,
          createPullRequest: true
        },
        dependencies: [],
        subtasks: [],
        checkpoints: [],
        metadata: {
          createdAt: new Date(),
          retryCount: 0,
          maxRetries: 1,
          estimatedDuration: 2400000, // 40 minutes
          humanApprovalRequired: false
        }
      },
      config: {},
      position: { x: 700, y: -50 }
    });
  }

  // Compliance check (if standards specified)
  if (config.complianceStandards && config.complianceStandards.length > 0) {
    nodes.push({
      id: 'compliance_check',
      type: WorkflowNodeType.TASK,
      name: 'Compliance Verification',
      description: 'Verify compliance with standards',
      task: {
        id: '',
        type: 'compliance_verification',
        title: 'Verify compliance',
        description: 'Check compliance with specified standards',
        status: TaskStatus.PENDING,
        priority: AgentPriority.CRITICAL,
        requiredCapabilities: [
          AgentCapability.SECURITY_AUDIT,
          AgentCapability.DOCUMENTATION
        ],
        input: {
          projectName: config.projectName,
          standards: config.complianceStandards,
          auditResults: 'from_all_scans',
          generateEvidence: true
        },
        dependencies: [],
        subtasks: [],
        checkpoints: [],
        metadata: {
          createdAt: new Date(),
          retryCount: 0,
          maxRetries: 1,
          estimatedDuration: 2400000 // 40 minutes
        }
      },
      config: {},
      position: { x: 700, y: 50 }
    });
  }

  // Report generation
  if (config.generateReport !== false) {
    nodes.push({
      id: 'report_generation',
      type: WorkflowNodeType.TASK,
      name: 'Generate Report',
      description: 'Generate comprehensive security audit report',
      task: {
        id: '',
        type: 'report_generation',
        title: 'Generate security report',
        description: 'Create detailed security audit report',
        status: TaskStatus.PENDING,
        priority: AgentPriority.MEDIUM,
        requiredCapabilities: [
          AgentCapability.DOCUMENTATION,
          AgentCapability.DATA_ANALYSIS
        ],
        input: {
          projectName: config.projectName,
          reportSections: [
            'executive_summary',
            'vulnerability_details',
            'risk_assessment',
            'remediation_plan',
            'compliance_status',
            'recommendations',
            'appendices'
          ],
          formats: ['pdf', 'html', 'json'],
          includeCharts: true
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
      position: { x: 800, y: 0 }
    });
  }

  // Notification
  nodes.push({
    id: 'notify',
    type: WorkflowNodeType.TASK,
    name: 'Send Notifications',
    description: 'Notify stakeholders about audit results',
    task: {
      id: '',
      type: 'notification',
      title: 'Send audit notifications',
      description: 'Notify team about security audit results',
      status: TaskStatus.PENDING,
      priority: AgentPriority.LOW,
      requiredCapabilities: [AgentCapability.USER_INTERACTION],
      input: {
        projectName: config.projectName,
        channels: config.notificationChannels || ['email', 'slack'],
        summary: 'from_risk_assessment',
        criticalFindings: 'from_vuln_aggregation',
        reportLink: config.generateReport ? 'from_report_generation' : null
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
    position: { x: 900, y: 0 }
  });

  // End node
  nodes.push({
    id: 'end',
    type: WorkflowNodeType.END,
    name: 'Complete Security Audit',
    description: 'Security audit workflow completed',
    config: {},
    position: { x: 1000, y: 0 }
  });

  // ============================================================================
  // Edge Definitions
  // ============================================================================

  let edgeId = 1;

  // Main flow
  edges.push({ id: `e${edgeId++}`, source: 'start', target: 'audit_planning' });
  edges.push({ id: `e${edgeId++}`, source: 'audit_planning', target: 'parallel_scans' });

  // Parallel scan branches
  if (config.includeCodeAnalysis !== false) {
    edges.push({ id: `e${edgeId++}`, source: 'parallel_scans', target: 'code_analysis' });
    edges.push({ id: `e${edgeId++}`, source: 'code_analysis', target: 'vuln_aggregation' });
  }

  if (config.includeDependencyScanning !== false) {
    edges.push({ id: `e${edgeId++}`, source: 'parallel_scans', target: 'dependency_scan' });
    edges.push({ id: `e${edgeId++}`, source: 'dependency_scan', target: 'vuln_aggregation' });
  }

  if (config.includeInfrastructureScanning) {
    edges.push({ id: `e${edgeId++}`, source: 'parallel_scans', target: 'infra_scan' });
    edges.push({ id: `e${edgeId++}`, source: 'infra_scan', target: 'vuln_aggregation' });
  }

  edges.push({ id: `e${edgeId++}`, source: 'parallel_scans', target: 'api_security' });
  edges.push({ id: `e${edgeId++}`, source: 'api_security', target: 'vuln_aggregation' });

  if (config.includeAccessReview) {
    edges.push({ id: `e${edgeId++}`, source: 'parallel_scans', target: 'access_review' });
    edges.push({ id: `e${edgeId++}`, source: 'access_review', target: 'vuln_aggregation' });
  }

  if (config.includeDataPrivacyReview) {
    edges.push({ id: `e${edgeId++}`, source: 'parallel_scans', target: 'privacy_review' });
    edges.push({ id: `e${edgeId++}`, source: 'privacy_review', target: 'vuln_aggregation' });
  }

  // Continue main flow
  edges.push({ id: `e${edgeId++}`, source: 'vuln_aggregation', target: 'risk_assessment' });
  edges.push({ id: `e${edgeId++}`, source: 'risk_assessment', target: 'remediation_plan' });

  let lastNode = 'remediation_plan';

  if (config.autoRemediate) {
    edges.push({ id: `e${edgeId++}`, source: lastNode, target: 'auto_remediate' });
    lastNode = 'auto_remediate';
  }

  if (config.complianceStandards && config.complianceStandards.length > 0) {
    edges.push({ id: `e${edgeId++}`, source: 'remediation_plan', target: 'compliance_check' });
    if (!config.autoRemediate) {
      lastNode = 'compliance_check';
    }
  }

  if (config.generateReport !== false) {
    edges.push({ id: `e${edgeId++}`, source: lastNode, target: 'report_generation' });
    if (config.complianceStandards && config.complianceStandards.length > 0 && !config.autoRemediate) {
      edges.push({ id: `e${edgeId++}`, source: 'compliance_check', target: 'report_generation' });
    }
    edges.push({ id: `e${edgeId++}`, source: 'report_generation', target: 'notify' });
  } else {
    edges.push({ id: `e${edgeId++}`, source: lastNode, target: 'notify' });
  }

  edges.push({ id: `e${edgeId++}`, source: 'notify', target: 'end' });

  return {
    id: workflowId,
    name: `Security Audit: ${config.projectName}`,
    description: `${config.scope} security audit with ${config.complianceStandards?.join(', ') || 'standard'} compliance`,
    version: '1.0.0',
    status: 'ready' as any,
    nodes,
    edges,
    variables: config as any,
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      author: 'system',
      tags: ['security', 'audit', config.scope, ...(config.complianceStandards || [])],
      category: 'security',
      estimatedDuration: getAuditDuration(config)
    },
    config: {
      maxExecutionTime: 21600000, // 6 hours
      maxRetries: 1,
      parallelismLimit: 10,
      requiresApproval: false,
      notificationChannels: config.notificationChannels || ['email', 'slack', 'security-team']
    }
  };
}

/**
 * Get estimated audit duration based on scope
 */
function getAuditDuration(config: SecurityAuditConfig): number {
  let duration = 900000; // 15 min planning
  
  // Base scan times
  const scanTimes = {
    code: 2400000, // 40 min
    dependency: 1200000, // 20 min
    infrastructure: 1800000, // 30 min
    api: 2400000, // 40 min
    access: 1800000, // 30 min
    privacy: 2400000 // 40 min
  };
  
  // Add scan times (parallel, so take max)
  let maxScanTime = scanTimes.api; // API security is always included
  
  if (config.includeCodeAnalysis !== false) {
    maxScanTime = Math.max(maxScanTime, scanTimes.code);
  }
  if (config.includeDependencyScanning !== false) {
    maxScanTime = Math.max(maxScanTime, scanTimes.dependency);
  }
  if (config.includeInfrastructureScanning) {
    maxScanTime = Math.max(maxScanTime, scanTimes.infrastructure);
  }
  if (config.includeAccessReview) {
    maxScanTime = Math.max(maxScanTime, scanTimes.access);
  }
  if (config.includeDataPrivacyReview) {
    maxScanTime = Math.max(maxScanTime, scanTimes.privacy);
  }
  
  duration += maxScanTime;
  
  // Sequential tasks
  duration += 900000; // 15 min aggregation
  duration += 1200000; // 20 min risk assessment
  duration += 1800000; // 30 min remediation planning
  
  if (config.autoRemediate) {
    duration += 2400000; // 40 min auto-remediation
  }
  
  if (config.complianceStandards && config.complianceStandards.length > 0) {
    duration += 2400000; // 40 min compliance check
  }
  
  if (config.generateReport !== false) {
    duration += 1200000; // 20 min report generation
  }
  
  duration += 300000; // 5 min notification
  
  return duration;
}