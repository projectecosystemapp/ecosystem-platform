/**
 * Workflow Unit Tests
 * 
 * Comprehensive test suite for workflow execution, including
 * bug fix, deployment, development, and security workflows.
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { createBugFixWorkflow, BugSeverity } from '../workflows/bugfix';
import { createDeploymentWorkflow, DeploymentTarget, DeploymentStrategy } from '../workflows/deployment';
import { createDevelopmentWorkflow, FeatureSize } from '../workflows/development';
import { createSecurityAuditWorkflow, AuditScope } from '../workflows/security';
import {
  Workflow,
  WorkflowStatus,
  WorkflowNodeType,
  WorkflowNode,
  WorkflowEdge,
  TaskStatus,
  AgentCapability,
  AgentPriority
} from '../types';

describe('Workflow Unit Tests', () => {
  
  describe('Bug Fix Workflow', () => {
    const defaultBugConfig = {
      bugId: 'BUG-123',
      title: 'Application crashes on login',
      description: 'Users experience crash when attempting to login with special characters',
      severity: BugSeverity.HIGH,
      affectedComponents: ['auth', 'validation'],
      reportedBy: 'user@example.com',
      enableRootCauseAnalysis: true,
      enableRegressionTesting: true,
      autoDeployFix: false
    };

    test('should create bug fix workflow with all nodes', () => {
      const workflow = createBugFixWorkflow(defaultBugConfig);
      
      expect(workflow.id).toMatch(/^wf_bugfix_BUG-123_\d+$/);
      expect(workflow.name).toBe('Bug Fix: Application crashes on login');
      expect(workflow.nodes).toHaveLength(12); // All nodes including optionals
      expect(workflow.edges.length).toBeGreaterThan(10);
    });

    test('should set priority based on bug severity', () => {
      const criticalBug = createBugFixWorkflow({
        ...defaultBugConfig,
        severity: BugSeverity.CRITICAL
      });
      
      const criticalTask = criticalBug.nodes.find(n => n.id === 'bug_analysis')?.task;
      expect(criticalTask?.priority).toBe(AgentPriority.CRITICAL);
      
      const lowBug = createBugFixWorkflow({
        ...defaultBugConfig,
        severity: BugSeverity.LOW
      });
      
      const lowTask = lowBug.nodes.find(n => n.id === 'bug_analysis')?.task;
      expect(lowTask?.priority).toBe(AgentPriority.MEDIUM);
    });

    test('should include root cause analysis when enabled', () => {
      const workflow = createBugFixWorkflow({
        ...defaultBugConfig,
        enableRootCauseAnalysis: true
      });
      
      const rootCauseNode = workflow.nodes.find(n => n.id === 'root_cause');
      expect(rootCauseNode).toBeDefined();
      expect(rootCauseNode?.type).toBe(WorkflowNodeType.TASK);
      expect(rootCauseNode?.task?.requiredCapabilities).toContain(AgentCapability.DATA_ANALYSIS);
    });

    test('should exclude root cause analysis when disabled', () => {
      const workflow = createBugFixWorkflow({
        ...defaultBugConfig,
        enableRootCauseAnalysis: false
      });
      
      const rootCauseNode = workflow.nodes.find(n => n.id === 'root_cause');
      expect(rootCauseNode).toBeUndefined();
    });

    test('should include regression testing when enabled', () => {
      const workflow = createBugFixWorkflow({
        ...defaultBugConfig,
        enableRegressionTesting: true
      });
      
      const regressionNode = workflow.nodes.find(n => n.id === 'regression_tests');
      expect(regressionNode).toBeDefined();
      expect(regressionNode?.task?.input).toMatchObject({
        testSuites: ['regression', 'smoke', 'integration']
      });
    });

    test('should include deployment node when auto-deploy enabled', () => {
      const workflow = createBugFixWorkflow({
        ...defaultBugConfig,
        autoDeployFix: true
      });
      
      const deployNode = workflow.nodes.find(n => n.id === 'deploy_fix');
      expect(deployNode).toBeDefined();
      expect(deployNode?.task?.requiredCapabilities).toContain(AgentCapability.DEPLOYMENT);
    });

    test('should require human approval for critical bugs', () => {
      const workflow = createBugFixWorkflow({
        ...defaultBugConfig,
        severity: BugSeverity.CRITICAL
      });
      
      const codeReviewNode = workflow.nodes.find(n => n.id === 'code_review');
      expect(codeReviewNode?.task?.metadata?.humanApprovalRequired).toBe(true);
      expect(workflow.config.requiresApproval).toBe(true);
    });

    test('should create proper edge connections', () => {
      const workflow = createBugFixWorkflow(defaultBugConfig);
      
      // Check main flow
      const startToAnalysis = workflow.edges.find(e => 
        e.source === 'start' && e.target === 'bug_analysis'
      );
      expect(startToAnalysis).toBeDefined();
      
      // Check conditional edges
      const reproductionCheck = workflow.edges.filter(e => 
        e.source === 'reproduction_check'
      );
      expect(reproductionCheck).toHaveLength(2); // Success and failure paths
      
      // Check error handling edges
      const errorEdges = workflow.edges.filter(e => 
        e.target === 'error_handler'
      );
      expect(errorEdges.length).toBeGreaterThan(0);
    });

    test('should handle cannot reproduce scenario', () => {
      const workflow = createBugFixWorkflow(defaultBugConfig);
      
      const cannotReproduceNode = workflow.nodes.find(n => n.id === 'cannot_reproduce');
      expect(cannotReproduceNode).toBeDefined();
      expect(cannotReproduceNode?.task?.input?.action).toBe('request_more_info');
      
      const cannotReproduceEdge = workflow.edges.find(e => 
        e.source === 'reproduction_check' && 
        e.target === 'cannot_reproduce' &&
        e.condition?.value === false
      );
      expect(cannotReproduceEdge).toBeDefined();
    });

    test('should set appropriate workflow metadata', () => {
      const workflow = createBugFixWorkflow({
        ...defaultBugConfig,
        severity: BugSeverity.CRITICAL
      });
      
      expect(workflow.metadata.category).toBe('maintenance');
      expect(workflow.metadata.tags).toContain('bugfix');
      expect(workflow.metadata.tags).toContain(BugSeverity.CRITICAL);
      expect(workflow.metadata.estimatedDuration).toBe(7200000); // 2 hours for critical
    });

    test('should configure notification channels', () => {
      const workflow = createBugFixWorkflow(defaultBugConfig);
      
      expect(workflow.config.notificationChannels).toContain('email');
      expect(workflow.config.notificationChannels).toContain('slack');
      expect(workflow.config.notificationChannels).toContain('jira');
    });
  });

  describe('Deployment Workflow', () => {
    const defaultDeployConfig = {
      version: '1.2.3',
      target: DeploymentTarget.PRODUCTION,
      strategy: DeploymentStrategy.BLUE_GREEN,
      rollbackEnabled: true,
      smokeTestsEnabled: true,
      notificationChannels: ['slack', 'email']
    };

    test('should create deployment workflow with correct strategy', () => {
      const workflow = createDeploymentWorkflow(defaultDeployConfig);
      
      expect(workflow.id).toMatch(/^wf_deploy_.*_\d+$/);
      expect(workflow.name).toContain('Blue-Green Deployment');
      expect(workflow.name).toContain('v1.2.3');
    });

    test('should include rollback nodes when enabled', () => {
      const workflow = createDeploymentWorkflow({
        ...defaultDeployConfig,
        rollbackEnabled: true
      });
      
      const rollbackDecision = workflow.nodes.find(n => n.id === 'rollback_decision');
      const rollbackExecution = workflow.nodes.find(n => n.id === 'rollback');
      
      expect(rollbackDecision).toBeDefined();
      expect(rollbackExecution).toBeDefined();
    });

    test('should configure smoke tests when enabled', () => {
      const workflow = createDeploymentWorkflow({
        ...defaultDeployConfig,
        smokeTestsEnabled: true
      });
      
      const smokeTestNode = workflow.nodes.find(n => 
        n.task?.type === 'smoke_tests'
      );
      
      expect(smokeTestNode).toBeDefined();
      expect(smokeTestNode?.task?.input?.testSuites).toContain('smoke');
    });

    test('should set correct deployment priority by target', () => {
      const prodWorkflow = createDeploymentWorkflow({
        ...defaultDeployConfig,
        target: DeploymentTarget.PRODUCTION
      });
      
      const prodNode = prodWorkflow.nodes.find(n => n.id === 'deploy')?.task;
      expect(prodNode?.priority).toBe(AgentPriority.CRITICAL);
      
      const stagingWorkflow = createDeploymentWorkflow({
        ...defaultDeployConfig,
        target: DeploymentTarget.STAGING
      });
      
      const stagingNode = stagingWorkflow.nodes.find(n => n.id === 'deploy')?.task;
      expect(stagingNode?.priority).toBe(AgentPriority.HIGH);
    });

    test('should handle different deployment strategies', () => {
      const strategies = [
        DeploymentStrategy.BLUE_GREEN,
        DeploymentStrategy.CANARY,
        DeploymentStrategy.ROLLING,
        DeploymentStrategy.RECREATE
      ];
      
      strategies.forEach(strategy => {
        const workflow = createDeploymentWorkflow({
          ...defaultDeployConfig,
          strategy
        });
        
        expect(workflow.name).toContain(strategy.replace('_', '-'));
        
        const deployNode = workflow.nodes.find(n => n.id === 'deploy');
        expect(deployNode?.task?.input?.strategy).toBe(strategy);
      });
    });

    test('should include health check nodes', () => {
      const workflow = createDeploymentWorkflow(defaultDeployConfig);
      
      const healthCheckNode = workflow.nodes.find(n => 
        n.task?.type === 'health_check'
      );
      
      expect(healthCheckNode).toBeDefined();
      expect(healthCheckNode?.task?.requiredCapabilities).toContain(
        AgentCapability.MONITORING
      );
    });

    test('should configure monitoring for production deployments', () => {
      const workflow = createDeploymentWorkflow({
        ...defaultDeployConfig,
        target: DeploymentTarget.PRODUCTION
      });
      
      const monitoringNode = workflow.nodes.find(n => 
        n.task?.type === 'monitoring_setup'
      );
      
      expect(monitoringNode).toBeDefined();
      expect(monitoringNode?.task?.input?.alertsEnabled).toBe(true);
    });
  });

  describe('Development Workflow', () => {
    const defaultDevConfig = {
      featureName: 'user-authentication',
      featureDescription: 'Implement OAuth2 authentication',
      featureSize: FeatureSize.MEDIUM,
      requiresDesignReview: true,
      requiresSecurityReview: true,
      requiresPerformanceOptimization: false
    };

    test('should create development workflow with all phases', () => {
      const workflow = createDevelopmentWorkflow(defaultDevConfig);
      
      expect(workflow.id).toMatch(/^wf_dev_.*_\d+$/);
      expect(workflow.name).toBe('Feature Development: user-authentication');
      
      // Should have standard development phases
      const hasDesign = workflow.nodes.some(n => n.task?.type === 'design');
      const hasImplementation = workflow.nodes.some(n => n.task?.type === 'implementation');
      const hasTesting = workflow.nodes.some(n => n.task?.type === 'testing');
      const hasDocumentation = workflow.nodes.some(n => n.task?.type === 'documentation');
      
      expect(hasDesign).toBe(true);
      expect(hasImplementation).toBe(true);
      expect(hasTesting).toBe(true);
      expect(hasDocumentation).toBe(true);
    });

    test('should include design review when required', () => {
      const workflow = createDevelopmentWorkflow({
        ...defaultDevConfig,
        requiresDesignReview: true
      });
      
      const designReviewNode = workflow.nodes.find(n => 
        n.task?.type === 'design_review'
      );
      
      expect(designReviewNode).toBeDefined();
      expect(designReviewNode?.task?.metadata?.humanApprovalRequired).toBe(true);
    });

    test('should include security review when required', () => {
      const workflow = createDevelopmentWorkflow({
        ...defaultDevConfig,
        requiresSecurityReview: true
      });
      
      const securityReviewNode = workflow.nodes.find(n => 
        n.task?.requiredCapabilities?.includes(AgentCapability.SECURITY_AUDIT)
      );
      
      expect(securityReviewNode).toBeDefined();
    });

    test('should include performance optimization when required', () => {
      const workflow = createDevelopmentWorkflow({
        ...defaultDevConfig,
        requiresPerformanceOptimization: true
      });
      
      const perfNode = workflow.nodes.find(n => 
        n.task?.requiredCapabilities?.includes(AgentCapability.PERFORMANCE_OPTIMIZATION)
      );
      
      expect(perfNode).toBeDefined();
    });

    test('should set time estimates based on feature size', () => {
      const sizes = [
        { size: FeatureSize.SMALL, expectedHours: 8 },
        { size: FeatureSize.MEDIUM, expectedHours: 24 },
        { size: FeatureSize.LARGE, expectedHours: 80 },
        { size: FeatureSize.XLARGE, expectedHours: 160 }
      ];
      
      sizes.forEach(({ size, expectedHours }) => {
        const workflow = createDevelopmentWorkflow({
          ...defaultDevConfig,
          featureSize: size
        });
        
        const expectedMs = expectedHours * 3600000;
        expect(workflow.metadata.estimatedDuration).toBe(expectedMs);
      });
    });

    test('should include integration testing for larger features', () => {
      const workflow = createDevelopmentWorkflow({
        ...defaultDevConfig,
        featureSize: FeatureSize.LARGE
      });
      
      const integrationTestNode = workflow.nodes.find(n => 
        n.task?.input?.testTypes?.includes('integration')
      );
      
      expect(integrationTestNode).toBeDefined();
    });

    test('should configure parallelism based on feature size', () => {
      const smallFeature = createDevelopmentWorkflow({
        ...defaultDevConfig,
        featureSize: FeatureSize.SMALL
      });
      
      expect(smallFeature.config.parallelismLimit).toBe(2);
      
      const largeFeature = createDevelopmentWorkflow({
        ...defaultDevConfig,
        featureSize: FeatureSize.LARGE
      });
      
      expect(largeFeature.config.parallelismLimit).toBe(5);
    });
  });

  describe('Security Audit Workflow', () => {
    const defaultSecurityConfig = {
      scope: AuditScope.FULL,
      includeVulnerabilityScanning: true,
      includePenetrationTesting: true,
      includeComplianceCheck: true,
      complianceStandards: ['PCI-DSS', 'GDPR']
    };

    test('should create comprehensive security audit workflow', () => {
      const workflow = createSecurityAuditWorkflow(defaultSecurityConfig);
      
      expect(workflow.id).toMatch(/^wf_security_audit_\d+$/);
      expect(workflow.name).toContain('Security Audit');
      expect(workflow.metadata.category).toBe('security');
    });

    test('should include vulnerability scanning when enabled', () => {
      const workflow = createSecurityAuditWorkflow({
        ...defaultSecurityConfig,
        includeVulnerabilityScanning: true
      });
      
      const vulnScanNode = workflow.nodes.find(n => 
        n.task?.type === 'vulnerability_scan'
      );
      
      expect(vulnScanNode).toBeDefined();
      expect(vulnScanNode?.task?.input?.scanTypes).toContain('dependencies');
      expect(vulnScanNode?.task?.input?.scanTypes).toContain('code');
    });

    test('should include penetration testing when enabled', () => {
      const workflow = createSecurityAuditWorkflow({
        ...defaultSecurityConfig,
        includePenetrationTesting: true
      });
      
      const penTestNode = workflow.nodes.find(n => 
        n.task?.type === 'penetration_test'
      );
      
      expect(penTestNode).toBeDefined();
      expect(penTestNode?.task?.priority).toBe(AgentPriority.HIGH);
    });

    test('should configure compliance checks with standards', () => {
      const workflow = createSecurityAuditWorkflow({
        ...defaultSecurityConfig,
        includeComplianceCheck: true,
        complianceStandards: ['SOC2', 'HIPAA']
      });
      
      const complianceNode = workflow.nodes.find(n => 
        n.task?.type === 'compliance_check'
      );
      
      expect(complianceNode).toBeDefined();
      expect(complianceNode?.task?.input?.standards).toContain('SOC2');
      expect(complianceNode?.task?.input?.standards).toContain('HIPAA');
    });

    test('should handle different audit scopes', () => {
      const scopes = [
        AuditScope.CODE_ONLY,
        AuditScope.DEPENDENCIES_ONLY,
        AuditScope.INFRASTRUCTURE,
        AuditScope.FULL
      ];
      
      scopes.forEach(scope => {
        const workflow = createSecurityAuditWorkflow({
          ...defaultSecurityConfig,
          scope
        });
        
        const scanNode = workflow.nodes.find(n => 
          n.task?.type === 'vulnerability_scan'
        );
        
        expect(scanNode?.task?.input?.scope).toBe(scope);
      });
    });

    test('should require human approval for critical findings', () => {
      const workflow = createSecurityAuditWorkflow(defaultSecurityConfig);
      
      const reviewNode = workflow.nodes.find(n => 
        n.id === 'security_review'
      );
      
      expect(reviewNode?.task?.metadata?.humanApprovalRequired).toBe(true);
    });

    test('should generate security report', () => {
      const workflow = createSecurityAuditWorkflow(defaultSecurityConfig);
      
      const reportNode = workflow.nodes.find(n => 
        n.task?.type === 'generate_report'
      );
      
      expect(reportNode).toBeDefined();
      expect(reportNode?.task?.input?.format).toContain('pdf');
      expect(reportNode?.task?.input?.format).toContain('json');
    });
  });

  describe('Workflow Validation', () => {
    test('should have valid start and end nodes', () => {
      const workflows = [
        createBugFixWorkflow({
          bugId: 'TEST',
          title: 'Test',
          description: 'Test',
          severity: BugSeverity.LOW,
          affectedComponents: [],
          reportedBy: 'test'
        }),
        createDeploymentWorkflow({
          version: '1.0.0',
          target: DeploymentTarget.STAGING,
          strategy: DeploymentStrategy.ROLLING,
          rollbackEnabled: false,
          smokeTestsEnabled: false,
          notificationChannels: []
        })
      ];
      
      workflows.forEach(workflow => {
        const startNode = workflow.nodes.find(n => n.type === WorkflowNodeType.START);
        const endNode = workflow.nodes.find(n => n.type === WorkflowNodeType.END);
        
        expect(startNode).toBeDefined();
        expect(endNode).toBeDefined();
        
        // Start node should have outgoing edges
        const startEdges = workflow.edges.filter(e => e.source === startNode?.id);
        expect(startEdges.length).toBeGreaterThan(0);
        
        // End node should have incoming edges
        const endEdges = workflow.edges.filter(e => e.target === endNode?.id);
        expect(endEdges.length).toBeGreaterThan(0);
      });
    });

    test('should have connected graph (no orphan nodes)', () => {
      const workflow = createBugFixWorkflow({
        bugId: 'TEST',
        title: 'Test',
        description: 'Test',
        severity: BugSeverity.MEDIUM,
        affectedComponents: [],
        reportedBy: 'test',
        enableRootCauseAnalysis: true,
        enableRegressionTesting: true,
        autoDeployFix: true
      });
      
      // Every non-start node should have at least one incoming edge
      // Every non-end node should have at least one outgoing edge
      workflow.nodes.forEach(node => {
        if (node.type !== WorkflowNodeType.START) {
          const incoming = workflow.edges.filter(e => e.target === node.id);
          expect(incoming.length).toBeGreaterThan(0);
        }
        
        if (node.type !== WorkflowNodeType.END && 
            node.type !== WorkflowNodeType.ERROR_HANDLER) {
          const outgoing = workflow.edges.filter(e => e.source === node.id);
          expect(outgoing.length).toBeGreaterThan(0);
        }
      });
    });

    test('should have unique node IDs', () => {
      const workflow = createDevelopmentWorkflow({
        featureName: 'test-feature',
        featureDescription: 'Test',
        featureSize: FeatureSize.MEDIUM,
        requiresDesignReview: true,
        requiresSecurityReview: true,
        requiresPerformanceOptimization: true
      });
      
      const nodeIds = workflow.nodes.map(n => n.id);
      const uniqueIds = new Set(nodeIds);
      
      expect(uniqueIds.size).toBe(nodeIds.length);
    });

    test('should have unique edge IDs', () => {
      const workflow = createSecurityAuditWorkflow({
        scope: AuditScope.FULL,
        includeVulnerabilityScanning: true,
        includePenetrationTesting: true,
        includeComplianceCheck: true,
        complianceStandards: ['PCI-DSS']
      });
      
      const edgeIds = workflow.edges.map(e => e.id);
      const uniqueIds = new Set(edgeIds);
      
      expect(uniqueIds.size).toBe(edgeIds.length);
    });

    test('should have valid task priorities', () => {
      const workflow = createBugFixWorkflow({
        bugId: 'CRITICAL-BUG',
        title: 'Critical Issue',
        description: 'Test',
        severity: BugSeverity.CRITICAL,
        affectedComponents: [],
        reportedBy: 'test'
      });
      
      const validPriorities = Object.values(AgentPriority);
      
      workflow.nodes.forEach(node => {
        if (node.task) {
          expect(validPriorities).toContain(node.task.priority);
        }
      });
    });

    test('should have valid task capabilities', () => {
      const workflow = createDeploymentWorkflow({
        version: '2.0.0',
        target: DeploymentTarget.PRODUCTION,
        strategy: DeploymentStrategy.CANARY,
        rollbackEnabled: true,
        smokeTestsEnabled: true,
        notificationChannels: []
      });
      
      const validCapabilities = Object.values(AgentCapability);
      
      workflow.nodes.forEach(node => {
        if (node.task) {
          node.task.requiredCapabilities.forEach(capability => {
            expect(validCapabilities).toContain(capability);
          });
        }
      });
    });
  });

  describe('Edge Cases and Complex Scenarios', () => {
    test('should handle workflow with minimal configuration', () => {
      const workflow = createBugFixWorkflow({
        bugId: 'MIN',
        title: 'Min',
        description: '',
        severity: BugSeverity.LOW,
        affectedComponents: [],
        reportedBy: '',
        enableRootCauseAnalysis: false,
        enableRegressionTesting: false,
        autoDeployFix: false
      });
      
      expect(workflow).toBeDefined();
      expect(workflow.nodes.length).toBeGreaterThan(5); // At least basic nodes
    });

    test('should handle workflow with maximum configuration', () => {
      const workflow = createBugFixWorkflow({
        bugId: 'MAX',
        title: 'Maximum configuration test with very long title that should be handled',
        description: 'A'.repeat(1000), // Very long description
        severity: BugSeverity.CRITICAL,
        affectedComponents: Array(20).fill('component'), // Many components
        reportedBy: 'user@example.com',
        enableRootCauseAnalysis: true,
        enableRegressionTesting: true,
        autoDeployFix: true
      });
      
      expect(workflow).toBeDefined();
      expect(workflow.config.requiresApproval).toBe(true);
      expect(workflow.config.maxExecutionTime).toBe(14400000); // 4 hours
    });

    test('should handle concurrent workflow paths', () => {
      const workflow = createDevelopmentWorkflow({
        featureName: 'concurrent-feature',
        featureDescription: 'Test concurrent execution',
        featureSize: FeatureSize.LARGE,
        requiresDesignReview: true,
        requiresSecurityReview: true,
        requiresPerformanceOptimization: true
      });
      
      // Find parallel execution nodes
      const parallelNodes = workflow.nodes.filter(n => 
        n.type === WorkflowNodeType.PARALLEL
      );
      
      // Large features might have parallel execution
      if (parallelNodes.length > 0) {
        parallelNodes.forEach(parallelNode => {
          const outgoingEdges = workflow.edges.filter(e => 
            e.source === parallelNode.id
          );
          expect(outgoingEdges.length).toBeGreaterThan(1);
        });
      }
    });

    test('should handle conditional branching correctly', () => {
      const workflow = createBugFixWorkflow({
        bugId: 'BRANCH',
        title: 'Branching test',
        description: 'Test conditional branching',
        severity: BugSeverity.HIGH,
        affectedComponents: ['test'],
        reportedBy: 'test',
        autoDeployFix: true
      });
      
      // Find decision nodes
      const decisionNodes = workflow.nodes.filter(n => 
        n.type === WorkflowNodeType.DECISION
      );
      
      expect(decisionNodes.length).toBeGreaterThan(0);
      
      decisionNodes.forEach(decisionNode => {
        // Each decision should have at least 2 outgoing edges
        const outgoingEdges = workflow.edges.filter(e => 
          e.source === decisionNode.id
        );
        expect(outgoingEdges.length).toBeGreaterThanOrEqual(2);
        
        // At least one edge should have a condition
        const conditionalEdges = outgoingEdges.filter(e => e.condition);
        expect(conditionalEdges.length).toBeGreaterThan(0);
      });
    });

    test('should set appropriate retry policies', () => {
      const workflow = createDeploymentWorkflow({
        version: '1.0.0',
        target: DeploymentTarget.PRODUCTION,
        strategy: DeploymentStrategy.BLUE_GREEN,
        rollbackEnabled: true,
        smokeTestsEnabled: true,
        notificationChannels: []
      });
      
      // Critical deployment tasks should have retry policies
      const deployTask = workflow.nodes.find(n => n.id === 'deploy')?.task;
      expect(deployTask?.metadata?.maxRetries).toBeGreaterThanOrEqual(1);
      
      // Health checks should have retries
      const healthCheckTask = workflow.nodes.find(n => 
        n.task?.type === 'health_check'
      )?.task;
      expect(healthCheckTask?.metadata?.maxRetries).toBeGreaterThanOrEqual(2);
    });

    test('should handle error scenarios with error handler nodes', () => {
      const workflows = [
        createBugFixWorkflow({
          bugId: 'ERROR',
          title: 'Error test',
          description: 'Test',
          severity: BugSeverity.HIGH,
          affectedComponents: [],
          reportedBy: 'test'
        }),
        createDeploymentWorkflow({
          version: '1.0.0',
          target: DeploymentTarget.PRODUCTION,
          strategy: DeploymentStrategy.CANARY,
          rollbackEnabled: true,
          smokeTestsEnabled: false,
          notificationChannels: []
        })
      ];
      
      workflows.forEach(workflow => {
        const errorHandlerNode = workflow.nodes.find(n => 
          n.type === WorkflowNodeType.ERROR_HANDLER
        );
        
        expect(errorHandlerNode).toBeDefined();
        
        // Should have edges leading to error handler
        const errorEdges = workflow.edges.filter(e => 
          e.target === errorHandlerNode?.id
        );
        expect(errorEdges.length).toBeGreaterThan(0);
      });
    });
  });
});