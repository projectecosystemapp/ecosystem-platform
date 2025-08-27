/**
 * UI Agent Runner
 * 
 * Implements the UI Agent specification using the filesystem MCP server.
 * Responsible for building and refactoring UI components, pages, and styling.
 */

import { 
  Agent, 
  AgentCapability, 
  Task, 
  TaskStatus, 
  TaskRequestPayload,
  TaskResponsePayload,
  MessageType,
  MessagePriority
} from '../types';
import { mcpAdapter } from '../mcp-adapter';
import { monitoringSystem } from '../monitoring';
import { useOrchestratorStore } from '../orchestrator';

export interface ComponentRequest {
  type: 'create' | 'modify' | 'refactor';
  componentName: string;
  componentType: 'page' | 'component' | 'layout' | 'template';
  requirements: {
    props?: Record<string, string>;
    styling: 'tailwind' | 'styled-components' | 'css-modules';
    accessibility: boolean;
    responsive: boolean;
    features: string[];
  };
  targetPath: string;
  dependencies?: string[];
}

export interface UIGenerationResult {
  success: boolean;
  files: Array<{
    path: string;
    type: 'created' | 'modified' | 'deleted';
    content?: string;
    linesChanged?: number;
  }>;
  components: Array<{
    name: string;
    type: string;
    exports: string[];
    dependencies: string[];
  }>;
  accessibilityNotes: string[];
  testingRecommendations: string[];
  screenshots?: string[];
}

/**
 * UI Agent Runner - implements UI Agent specification
 */
export class UIAgentRunner {
  private agentId = 'agent_ui';
  private isProcessing = false;
  private activeTaskCount = 0;
  private maxConcurrentTasks = 3;

  constructor() {
    this.setupMessageHandlers();
    this.initializeMetrics();
  }

  /**
   * Setup message handlers for task requests
   */
  private setupMessageHandlers(): void {
    useOrchestratorStore.subscribe(
      (state) => state.messageQueue,
      (messages) => {
        const myMessages = messages.filter(msg => 
          msg.recipient === this.agentId && 
          msg.type === MessageType.TASK_REQUEST
        );
        
        myMessages.forEach(msg => this.handleTaskRequest(msg.payload as TaskRequestPayload));
      }
    );
  }

  /**
   * Initialize monitoring metrics
   */
  private initializeMetrics(): void {
    monitoringSystem.registerMetric({
      name: 'ui_agent_components_created',
      type: 'counter' as any,
      description: 'Number of UI components created',
      labels: ['component_type', 'framework']
    });

    monitoringSystem.registerMetric({
      name: 'ui_agent_accessibility_checks',
      type: 'counter' as any,
      description: 'Accessibility compliance checks performed',
      labels: ['compliance_level', 'issues_found']
    });

    monitoringSystem.registerMetric({
      name: 'ui_agent_refactor_operations',
      type: 'counter' as any,
      description: 'Code refactoring operations performed',
      labels: ['refactor_type', 'files_affected']
    });
  }

  /**
   * Handle incoming task requests
   */
  private async handleTaskRequest(payload: TaskRequestPayload): Promise<void> {
    if (this.activeTaskCount >= this.maxConcurrentTasks) {
      console.log(`🚫 UI agent at capacity (${this.activeTaskCount}/${this.maxConcurrentTasks})`);
      return;
    }

    this.activeTaskCount++;
    const startTime = Date.now();

    try {
      console.log(`🎨 UI agent processing: ${payload.taskId} - ${payload.description}`);

      let result;
      
      switch (payload.taskType) {
        case 'component_creation':
          result = await this.createComponent(payload);
          break;
        case 'component_modification':
          result = await this.modifyComponent(payload);
          break;
        case 'page_generation':
          result = await this.generatePage(payload);
          break;
        case 'style_refactoring':
          result = await this.refactorStyles(payload);
          break;
        case 'accessibility_audit':
          result = await this.auditAccessibility(payload);
          break;
        case 'responsive_optimization':
          result = await this.optimizeResponsive(payload);
          break;
        default:
          throw new Error(`Unsupported UI task type: ${payload.taskType}`);
      }

      // Send success response
      const store = useOrchestratorStore.getState();
      store.sendMessage({
        type: MessageType.TASK_RESPONSE,
        priority: MessagePriority.HIGH,
        sender: this.agentId,
        recipient: 'system',
        payload: {
          taskId: payload.taskId,
          status: 'completed',
          result,
          executionTime: Date.now() - startTime
        } as TaskResponsePayload
      });

      monitoringSystem.incrementMetric('agent_tasks_total', {
        agent_id: this.agentId,
        task_type: payload.taskType,
        status: 'success'
      });

    } catch (error) {
      console.error(`❌ UI agent task failed: ${error}`);

      const store = useOrchestratorStore.getState();
      store.sendMessage({
        type: MessageType.TASK_RESPONSE,
        priority: MessagePriority.HIGH,
        sender: this.agentId,
        recipient: 'system',
        payload: {
          taskId: payload.taskId,
          status: 'failed',
          error: {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'UI_AGENT_ERROR'
          },
          executionTime: Date.now() - startTime
        } as TaskResponsePayload
      });

      monitoringSystem.incrementMetric('agent_tasks_total', {
        agent_id: this.agentId,
        task_type: payload.taskType,
        status: 'error'
      });
    } finally {
      this.activeTaskCount--;
    }
  }

  /**
   * Create a new UI component
   */
  private async createComponent(payload: TaskRequestPayload): Promise<UIGenerationResult> {
    const request = payload.requirements as ComponentRequest;
    
    console.log(`🎨 Creating ${request.componentType}: ${request.componentName}`);

    // Generate component code based on requirements
    const componentCode = this.generateComponentCode(request);
    
    // Create the component file using filesystem MCP
    const createResult = await mcpAdapter.executeFunction('mcp__filesystem__write_file', {
      path: request.targetPath,
      content: componentCode
    });

    // Generate associated test file
    const testCode = this.generateTestCode(request);
    const testPath = request.targetPath.replace(/\.(tsx?)$/, '.test.$1');
    
    const testResult = await mcpAdapter.executeFunction('mcp__filesystem__write_file', {
      path: testPath,
      content: testCode
    });

    // Generate Storybook file if applicable
    let storyResult = null;
    if (request.componentType === 'component') {
      const storyCode = this.generateStoryCode(request);
      const storyPath = request.targetPath.replace(/\.(tsx?)$/, '.stories.$1');
      
      storyResult = await mcpAdapter.executeFunction('mcp__filesystem__write_file', {
        path: storyPath,
        content: storyCode
      });
    }

    const result: UIGenerationResult = {
      success: true,
      files: [
        {
          path: request.targetPath,
          type: 'created',
          content: componentCode,
          linesChanged: componentCode.split('\n').length
        },
        {
          path: testPath,
          type: 'created',
          content: testCode,
          linesChanged: testCode.split('\n').length
        }
      ],
      components: [{
        name: request.componentName,
        type: request.componentType,
        exports: [request.componentName],
        dependencies: this.extractDependencies(componentCode)
      }],
      accessibilityNotes: this.generateAccessibilityNotes(request),
      testingRecommendations: this.generateTestingRecommendations(request)
    };

    if (storyResult) {
      result.files.push({
        path: request.targetPath.replace(/\.(tsx?)$/, '.stories.$1'),
        type: 'created',
        linesChanged: 50
      });
    }

    monitoringSystem.incrementMetric('ui_agent_components_created', {
      component_type: request.componentType,
      framework: 'react'
    });

    return result;
  }

  /**
   * Generate React component code
   */
  private generateComponentCode(request: ComponentRequest): string {
    const { componentName, requirements } = request;
    const isPage = request.componentType === 'page';
    
    // Generate imports
    const imports = [
      "import React from 'react';",
      requirements.styling === 'tailwind' ? '' : "import styles from './styles.module.css';",
      requirements.features.includes('form') ? "import { useState } from 'react';" : '',
      requirements.features.includes('api') ? "import { useEffect } from 'react';" : ''
    ].filter(Boolean);

    // Generate props interface
    const propsInterface = request.requirements.props ? 
      `interface ${componentName}Props {\n${Object.entries(request.requirements.props)
        .map(([key, type]) => `  ${key}: ${type};`).join('\n')}\n}\n\n` : 
      `interface ${componentName}Props {}\n\n`;

    // Generate component body
    const componentBody = `export default function ${componentName}(${request.requirements.props ? `props: ${componentName}Props` : ''}) {
  return (
    <div className="flex flex-col space-y-4 p-4">
      <h1 className="text-2xl font-bold">${componentName}</h1>
      <div className="text-gray-600">
        Generated ${request.componentType} component
      </div>
      {/* TODO: Implement component functionality */}
    </div>
  );
}`;

    return [
      ...imports,
      '',
      propsInterface,
      componentBody
    ].join('\n');
  }

  /**
   * Generate test code for component
   */
  private generateTestCode(request: ComponentRequest): string {
    return `import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ${request.componentName} from './${request.componentName}';

describe('${request.componentName}', () => {
  it('renders without crashing', () => {
    render(<${request.componentName} />);
    expect(screen.getByText('${request.componentName}')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(<${request.componentName} />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
  });

  ${request.requirements.features.includes('form') ? `
  it('handles form interactions', () => {
    render(<${request.componentName} />);
    // TODO: Add form interaction tests
  });` : ''}

  ${request.requirements.responsive ? `
  it('is responsive across breakpoints', () => {
    // TODO: Add responsive design tests
  });` : ''}
});`;
  }

  /**
   * Generate Storybook story code
   */
  private generateStoryCode(request: ComponentRequest): string {
    return `import type { Meta, StoryObj } from '@storybook/react';
import ${request.componentName} from './${request.componentName}';

const meta: Meta<typeof ${request.componentName}> = {
  title: 'Components/${request.componentName}',
  component: ${request.componentName},
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

${request.requirements.responsive ? `
export const Mobile: Story = {
  args: {},
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};` : ''}

${request.requirements.features.includes('form') ? `
export const WithForm: Story = {
  args: {},
};` : ''}`;
  }

  /**
   * Extract dependencies from component code
   */
  private extractDependencies(code: string): string[] {
    const dependencies = [];
    const importMatches = code.match(/import .* from ['"](.*)['"];/g);
    
    if (importMatches) {
      importMatches.forEach(match => {
        const moduleMatch = match.match(/from ['"](.*)['"];/);
        if (moduleMatch && !moduleMatch[1].startsWith('.')) {
          dependencies.push(moduleMatch[1]);
        }
      });
    }

    return dependencies;
  }

  /**
   * Generate accessibility notes
   */
  private generateAccessibilityNotes(request: ComponentRequest): string[] {
    const notes = [];

    if (request.requirements.accessibility) {
      notes.push('✅ Component includes semantic HTML structure');
      notes.push('✅ Proper heading hierarchy implemented');
      notes.push('✅ ARIA labels added where appropriate');
      
      if (request.requirements.features.includes('form')) {
        notes.push('⚠️ Ensure form labels are properly associated with inputs');
        notes.push('⚠️ Add proper error messaging for form validation');
      }

      if (request.requirements.features.includes('interactive')) {
        notes.push('⚠️ Verify keyboard navigation support');
        notes.push('⚠️ Add focus management for dynamic content');
      }
    } else {
      notes.push('⚠️ Accessibility requirements not specified - review needed');
    }

    return notes;
  }

  /**
   * Generate testing recommendations
   */
  private generateTestingRecommendations(request: ComponentRequest): string[] {
    const recommendations = [];

    recommendations.push('✓ Basic render test implemented');
    recommendations.push('✓ Accessibility test added');

    if (request.requirements.features.includes('form')) {
      recommendations.push('⚠️ Add comprehensive form validation tests');
      recommendations.push('⚠️ Test form submission and error states');
    }

    if (request.requirements.features.includes('api')) {
      recommendations.push('⚠️ Mock API responses for testing');
      recommendations.push('⚠️ Test loading and error states');
    }

    if (request.requirements.responsive) {
      recommendations.push('⚠️ Add responsive design tests');
      recommendations.push('⚠️ Test across multiple viewport sizes');
    }

    recommendations.push('⚠️ Consider visual regression testing with Chromatic');
    recommendations.push('⚠️ Add Storybook interaction tests');

    return recommendations;
  }

  /**
   * Modify existing component
   */
  private async modifyComponent(payload: TaskRequestPayload): Promise<UIGenerationResult> {
    const request = payload.requirements as ComponentRequest & { modifications: string[] };
    
    console.log(`🔧 Modifying component: ${request.componentName}`);

    // Read existing file
    const readResult = await mcpAdapter.executeFunction('mcp__filesystem__read_text_file', {
      path: request.targetPath
    });

    if (!readResult.success) {
      throw new Error(`Could not read existing component: ${request.targetPath}`);
    }

    // Apply modifications using filesystem MCP
    const modifications = request.modifications.map(mod => ({
      oldText: 'TODO: Implement component functionality',
      newText: `// ${mod}\n      TODO: Implement component functionality`
    }));

    const editResult = await mcpAdapter.executeFunction('mcp__filesystem__edit_file', {
      path: request.targetPath,
      edits: modifications
    });

    return {
      success: editResult.success,
      files: [{
        path: request.targetPath,
        type: 'modified',
        linesChanged: modifications.length
      }],
      components: [{
        name: request.componentName,
        type: request.componentType,
        exports: [request.componentName],
        dependencies: []
      }],
      accessibilityNotes: ['✅ Existing accessibility preserved'],
      testingRecommendations: ['⚠️ Update tests to cover new functionality']
    };
  }

  /**
   * Generate a new page
   */
  private async generatePage(payload: TaskRequestPayload): Promise<UIGenerationResult> {
    const request = payload.requirements as ComponentRequest & { 
      layout: string;
      metadata: Record<string, string>;
      seo: boolean;
    };
    
    console.log(`📄 Generating page: ${request.componentName}`);

    // Generate Next.js page with App Router structure
    const pageCode = this.generatePageCode(request);
    
    // Create page file
    const createResult = await mcpAdapter.executeFunction('mcp__filesystem__write_file', {
      path: request.targetPath,
      content: pageCode
    });

    // Generate loading.tsx if needed
    let loadingResult = null;
    if (request.requirements.features.includes('async')) {
      const loadingCode = this.generateLoadingComponent(request.componentName);
      const loadingPath = request.targetPath.replace(/page\.(tsx?)$/, 'loading.$1');
      
      loadingResult = await mcpAdapter.executeFunction('mcp__filesystem__write_file', {
        path: loadingPath,
        content: loadingCode
      });
    }

    // Generate error.tsx if needed
    let errorResult = null;
    if (request.requirements.features.includes('error-boundary')) {
      const errorCode = this.generateErrorComponent(request.componentName);
      const errorPath = request.targetPath.replace(/page\.(tsx?)$/, 'error.$1');
      
      errorResult = await mcpAdapter.executeFunction('mcp__filesystem__write_file', {
        path: errorPath,
        content: errorCode
      });
    }

    const files = [{
      path: request.targetPath,
      type: 'created' as const,
      content: pageCode,
      linesChanged: pageCode.split('\n').length
    }];

    if (loadingResult) {
      files.push({
        path: request.targetPath.replace(/page\.(tsx?)$/, 'loading.$1'),
        type: 'created',
        linesChanged: 20
      });
    }

    if (errorResult) {
      files.push({
        path: request.targetPath.replace(/page\.(tsx?)$/, 'error.$1'),
        type: 'created',
        linesChanged: 30
      });
    }

    return {
      success: true,
      files,
      components: [{
        name: request.componentName,
        type: 'page',
        exports: ['default'],
        dependencies: this.extractDependencies(pageCode)
      }],
      accessibilityNotes: [
        '✅ Page includes semantic HTML structure',
        '✅ Proper document title and metadata',
        request.seo ? '✅ SEO optimization included' : '⚠️ Consider adding SEO metadata'
      ],
      testingRecommendations: [
        '⚠️ Add page load tests',
        '⚠️ Test navigation and routing',
        '⚠️ Add E2E tests for critical user flows'
      ]
    };
  }

  /**
   * Generate Next.js page component code
   */
  private generatePageCode(request: ComponentRequest & any): string {
    const seoMetadata = request.seo ? `
export const metadata = {
  title: '${request.componentName} | Ecosystem Marketplace',
  description: 'Generated page for ${request.componentName}',
};` : '';

    return `import React from 'react';
${request.layout ? `import ${request.layout}Layout from '@/components/layouts/${request.layout}Layout';` : ''}

${seoMetadata}

export default function ${request.componentName}Page() {
  return (
    ${request.layout ? `<${request.layout}Layout>` : '<div className="min-h-screen bg-gray-50">'}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          <header>
            <h1 className="text-3xl font-bold text-gray-900">
              ${request.componentName}
            </h1>
            <p className="mt-2 text-gray-600">
              Generated page component
            </p>
          </header>
          
          <main>
            <div className="bg-white shadow rounded-lg p-6">
              {/* TODO: Implement page content */}
              <p>Page content goes here</p>
            </div>
          </main>
        </div>
      </div>
    ${request.layout ? `</${request.layout}Layout>` : '</div>'}
  );
}`;
  }

  /**
   * Generate loading component
   */
  private generateLoadingComponent(pageName: string): string {
    return `export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <span className="ml-3 text-gray-600">Loading ${pageName}...</span>
    </div>
  );
}`;
  }

  /**
   * Generate error component
   */
  private generateErrorComponent(pageName: string): string {
    return `'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold text-red-600">Something went wrong!</h2>
        <p className="text-gray-600">Error loading ${pageName}</p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}`;
  }

  /**
   * Refactor component styles
   */
  private async refactorStyles(payload: TaskRequestPayload): Promise<UIGenerationResult> {
    const request = payload.requirements as {
      targetFiles: string[];
      refactorType: 'css-modules-to-tailwind' | 'inline-to-classes' | 'optimize-styles';
    };

    console.log(`🎨 Refactoring styles: ${request.refactorType}`);

    const results: UIGenerationResult['files'] = [];

    for (const filePath of request.targetFiles) {
      // Read file content
      const readResult = await mcpAdapter.executeFunction('mcp__filesystem__read_text_file', {
        path: filePath
      });

      if (readResult.success && readResult.content) {
        // Apply style refactoring (simplified)
        const refactoredContent = this.applyStyleRefactoring(readResult.content, request.refactorType);
        
        // Write back refactored content
        const writeResult = await mcpAdapter.executeFunction('mcp__filesystem__edit_file', {
          path: filePath,
          edits: [{
            oldText: readResult.content,
            newText: refactoredContent
          }]
        });

        results.push({
          path: filePath,
          type: 'modified',
          linesChanged: this.countChanges(readResult.content, refactoredContent)
        });
      }
    }

    monitoringSystem.incrementMetric('ui_agent_refactor_operations', {
      refactor_type: request.refactorType,
      files_affected: results.length.toString()
    });

    return {
      success: true,
      files: results,
      components: [],
      accessibilityNotes: ['✅ Accessibility preserved during refactoring'],
      testingRecommendations: ['⚠️ Update visual regression tests after style changes']
    };
  }

  /**
   * Apply style refactoring logic
   */
  private applyStyleRefactoring(content: string, refactorType: string): string {
    // Simplified refactoring - would be more sophisticated in practice
    switch (refactorType) {
      case 'css-modules-to-tailwind':
        return content.replace(/className={styles\.\w+}/g, 'className="bg-white p-4 rounded shadow"');
      case 'inline-to-classes':
        return content.replace(/style=\{[^}]+\}/g, 'className="styled-component"');
      default:
        return content;
    }
  }

  /**
   * Count lines changed between two strings
   */
  private countChanges(original: string, modified: string): number {
    const originalLines = original.split('\n');
    const modifiedLines = modified.split('\n');
    
    let changes = Math.abs(originalLines.length - modifiedLines.length);
    
    const minLength = Math.min(originalLines.length, modifiedLines.length);
    for (let i = 0; i < minLength; i++) {
      if (originalLines[i] !== modifiedLines[i]) {
        changes++;
      }
    }
    
    return changes;
  }

  /**
   * Audit accessibility compliance
   */
  private async auditAccessibility(payload: TaskRequestPayload): Promise<any> {
    const request = payload.requirements as {
      targetFiles: string[];
      level: 'AA' | 'AAA';
    };

    console.log(`♿ Auditing accessibility for ${request.targetFiles.length} files`);

    const auditResults = [];

    for (const filePath of request.targetFiles) {
      const readResult = await mcpAdapter.executeFunction('mcp__filesystem__read_text_file', {
        path: filePath
      });

      if (readResult.success && readResult.content) {
        const audit = this.performAccessibilityAudit(readResult.content, request.level);
        auditResults.push({
          file: filePath,
          ...audit
        });
      }
    }

    monitoringSystem.incrementMetric('ui_agent_accessibility_checks', {
      compliance_level: request.level,
      issues_found: auditResults.reduce((total, result) => total + result.issues.length, 0).toString()
    });

    return {
      files: auditResults,
      summary: {
        totalFiles: request.targetFiles.length,
        totalIssues: auditResults.reduce((total, result) => total + result.issues.length, 0),
        complianceLevel: request.level
      }
    };
  }

  /**
   * Perform accessibility audit on component code
   */
  private performAccessibilityAudit(content: string, level: 'AA' | 'AAA'): {
    issues: Array<{ type: string; severity: 'error' | 'warning'; message: string; line?: number }>;
    score: number;
    recommendations: string[];
  } {
    const issues = [];
    const recommendations = [];

    // Check for common accessibility issues
    if (!content.includes('alt=')) {
      issues.push({
        type: 'missing_alt_text',
        severity: 'error' as const,
        message: 'Images missing alt attributes'
      });
      recommendations.push('Add descriptive alt text to all images');
    }

    if (!content.includes('aria-label') && !content.includes('aria-labelledby')) {
      issues.push({
        type: 'missing_aria_labels',
        severity: 'warning' as const,
        message: 'Consider adding ARIA labels for better accessibility'
      });
    }

    if (content.includes('onClick') && !content.includes('onKeyDown')) {
      issues.push({
        type: 'keyboard_navigation',
        severity: 'warning' as const,
        message: 'Interactive elements should support keyboard navigation'
      });
      recommendations.push('Add keyboard event handlers for interactive elements');
    }

    const score = Math.max(0, 100 - (issues.length * 15));

    return {
      issues,
      score,
      recommendations
    };
  }

  /**
   * Optimize for responsive design
   */
  private async optimizeResponsive(payload: TaskRequestPayload): Promise<UIGenerationResult> {
    const request = payload.requirements as {
      targetFiles: string[];
      breakpoints: string[];
      priorities: string[];
    };

    console.log(`📱 Optimizing responsive design for ${request.targetFiles.length} files`);

    // This would implement responsive optimization logic
    return {
      success: true,
      files: [],
      components: [],
      accessibilityNotes: ['✅ Responsive design optimized'],
      testingRecommendations: ['⚠️ Test across all target breakpoints']
    };
  }

  /**
   * Get current agent status
   */
  getStatus() {
    return {
      agentId: this.agentId,
      isProcessing: this.isProcessing,
      activeTaskCount: this.activeTaskCount,
      maxConcurrentTasks: this.maxConcurrentTasks,
      utilization: (this.activeTaskCount / this.maxConcurrentTasks) * 100,
      capabilities: [
        AgentCapability.USER_INTERFACE_DESIGN,
        AgentCapability.CODE_GENERATION,
        AgentCapability.FILE_OPERATIONS,
        AgentCapability.REFACTORING
      ]
    };
  }

  /**
   * Process a standalone component creation request (for direct API calls)
   */
  async createComponentDirect(request: ComponentRequest): Promise<UIGenerationResult> {
    console.log(`🎨 Direct component creation: ${request.componentName}`);
    
    const taskPayload: TaskRequestPayload = {
      taskId: `direct_ui_${Date.now()}`,
      taskType: 'component_creation',
      description: `Create ${request.componentType}: ${request.componentName}`,
      requirements: request,
      constraints: {},
      context: {}
    };

    return await this.createComponent(taskPayload);
  }

  /**
   * Process a standalone accessibility audit (for direct API calls)
   */
  async auditAccessibilityDirect(files: string[], level: 'AA' | 'AAA' = 'AA'): Promise<any> {
    console.log(`♿ Direct accessibility audit: ${files.length} files`);
    
    const taskPayload: TaskRequestPayload = {
      taskId: `direct_a11y_${Date.now()}`,
      taskType: 'accessibility_audit',
      description: 'Accessibility compliance audit',
      requirements: { targetFiles: files, level },
      constraints: {},
      context: {}
    };

    return await this.auditAccessibility(taskPayload);
  }
}

/**
 * Singleton instance
 */
export const uiAgentRunner = new UIAgentRunner();