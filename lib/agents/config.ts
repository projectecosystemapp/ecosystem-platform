/**
 * Agent System Configuration
 * 
 * Centralized configuration for the agent orchestration system,
 * using environment variables with secure defaults.
 */

import { z } from 'zod';

/**
 * Agent Configuration Schema
 * Validates environment variables and provides type safety
 */
const agentConfigSchema = z.object({
  // Core Agent Settings
  enabled: z.boolean().default(true),
  autoInitialize: z.boolean().default(true),
  healthCheckInterval: z.number().min(5000).default(30000),
  taskTimeout: z.number().min(30000).default(300000),
  maxConcurrentTasks: z.number().min(1).max(50).default(10),
  retryMaxAttempts: z.number().min(0).max(10).default(3),
  monitoringEnabled: z.boolean().default(true),

  // MCP Server Configuration
  mcpServers: z.object({
    sequentialThinking: z.boolean().default(true),
    filesystem: z.boolean().default(true),
    memory: z.boolean().default(true),
    github: z.boolean().default(true),
    notion: z.boolean().default(true),
    ide: z.boolean().default(true),
    vercel: z.boolean().default(true),
    postgres: z.boolean().default(true),
  }),

  // Resource Limits
  resources: z.object({
    memoryLimitMB: z.number().min(128).max(2048).default(512),
    cpuLimitPercent: z.number().min(10).max(100).default(50),
    diskQuotaMB: z.number().min(256).max(5120).default(1024),
  }),

  // Security Settings
  security: z.object({
    sandboxMode: z.boolean().default(true),
    networkIsolation: z.boolean().default(false),
    fileAccessRestricted: z.boolean().default(true),
    allowedDomains: z.array(z.string()).default([
      'localhost',
      '127.0.0.1',
      '*.vercel.app',
      '*.stripe.com',
      '*.clerk.dev',
      '*.supabase.co'
    ]),
  }),

  // Performance & Monitoring
  monitoring: z.object({
    metricsCollection: z.boolean().default(true),
    performanceLogging: z.boolean().default(true),
    errorTracking: z.boolean().default(true),
    prometheusEndpoint: z.string().default('/api/agents/metrics'),
  }),

  // Workflow Configuration
  workflows: z.object({
    maxConcurrentWorkflows: z.number().min(1).max(20).default(5),
    workflowTimeout: z.number().min(60000).default(600000),
    requireHumanApproval: z.boolean().default(true),
  }),

  // Marketplace Agent Configuration
  marketplace: z.object({
    searchEnabled: z.boolean().default(true),
    recommendationsEnabled: z.boolean().default(true),
    searchMaxResults: z.number().min(10).max(100).default(50),
    autoMatchingEnabled: z.boolean().default(false),
  }),
});

/**
 * Parse environment variables and create agent configuration
 */
function createAgentConfig() {
  const env = {
    // Core settings
    enabled: process.env.AGENTS_ENABLED !== 'false',
    autoInitialize: process.env.AGENT_AUTO_INITIALIZE !== 'false',
    healthCheckInterval: parseInt(process.env.AGENT_HEALTH_CHECK_INTERVAL || '30000'),
    taskTimeout: parseInt(process.env.AGENT_TASK_TIMEOUT || '300000'),
    maxConcurrentTasks: parseInt(process.env.AGENT_MAX_CONCURRENT_TASKS || '10'),
    retryMaxAttempts: parseInt(process.env.AGENT_RETRY_MAX_ATTEMPTS || '3'),
    monitoringEnabled: process.env.AGENT_MONITORING_ENABLED !== 'false',

    // MCP servers
    mcpServers: {
      sequentialThinking: process.env.MCP_SEQUENTIAL_THINKING_ENABLED !== 'false',
      filesystem: process.env.MCP_FILESYSTEM_ENABLED !== 'false',
      memory: process.env.MCP_MEMORY_ENABLED !== 'false',
      github: process.env.MCP_GITHUB_ENABLED !== 'false',
      notion: process.env.MCP_NOTION_ENABLED !== 'false',
      ide: process.env.MCP_IDE_ENABLED !== 'false',
      vercel: process.env.MCP_VERCEL_ENABLED !== 'false',
      postgres: process.env.MCP_POSTGRES_ENABLED !== 'false',
    },

    // Resources
    resources: {
      memoryLimitMB: parseInt(process.env.AGENT_MEMORY_LIMIT_MB || '512'),
      cpuLimitPercent: parseInt(process.env.AGENT_CPU_LIMIT_PERCENT || '50'),
      diskQuotaMB: parseInt(process.env.AGENT_DISK_QUOTA_MB || '1024'),
    },

    // Security
    security: {
      sandboxMode: process.env.AGENT_SANDBOX_MODE !== 'false',
      networkIsolation: process.env.AGENT_NETWORK_ISOLATION === 'true',
      fileAccessRestricted: process.env.AGENT_FILE_ACCESS_RESTRICTED !== 'false',
      allowedDomains: process.env.AGENT_ALLOWED_DOMAINS?.split(',') || [
        'localhost',
        '127.0.0.1',
        '*.vercel.app',
        '*.stripe.com',
        '*.clerk.dev',
        '*.supabase.co'
      ],
    },

    // Monitoring
    monitoring: {
      metricsCollection: process.env.AGENT_METRICS_COLLECTION !== 'false',
      performanceLogging: process.env.AGENT_PERFORMANCE_LOGGING !== 'false',
      errorTracking: process.env.AGENT_ERROR_TRACKING !== 'false',
      prometheusEndpoint: process.env.PROMETHEUS_METRICS_ENDPOINT || '/api/agents/metrics',
    },

    // Workflows
    workflows: {
      maxConcurrentWorkflows: parseInt(process.env.AGENT_MAX_CONCURRENT_WORKFLOWS || '5'),
      workflowTimeout: parseInt(process.env.AGENT_WORKFLOW_TIMEOUT || '600000'),
      requireHumanApproval: process.env.AGENT_REQUIRE_HUMAN_APPROVAL !== 'false',
    },

    // Marketplace
    marketplace: {
      searchEnabled: process.env.AGENT_SEARCH_ENABLED !== 'false',
      recommendationsEnabled: process.env.AGENT_RECOMMENDATIONS_ENABLED !== 'false',
      searchMaxResults: parseInt(process.env.AGENT_SEARCH_MAX_RESULTS || '50'),
      autoMatchingEnabled: process.env.AGENT_AUTO_MATCHING_ENABLED === 'true',
    },
  };

  // Validate and return configuration
  return agentConfigSchema.parse(env);
}

/**
 * Global agent configuration instance
 */
export const agentConfig = createAgentConfig();

/**
 * Type definitions
 */
export type AgentConfig = z.infer<typeof agentConfigSchema>;

/**
 * Configuration validation utilities
 */
export const validateAgentConfig = (config: unknown): config is AgentConfig => {
  try {
    agentConfigSchema.parse(config);
    return true;
  } catch {
    return false;
  }
};

/**
 * Environment-specific configurations
 */
export const isDevelopment = process.env.NODE_ENV === 'development';
export const isProduction = process.env.NODE_ENV === 'production';
export const isTest = process.env.NODE_ENV === 'test';

/**
 * Development overrides for safer testing
 */
if (isDevelopment) {
  // In development, reduce resource limits and timeouts for faster feedback
  if (agentConfig.resources.memoryLimitMB > 256) {
    agentConfig.resources.memoryLimitMB = 256;
  }
  if (agentConfig.taskTimeout > 120000) {
    agentConfig.taskTimeout = 120000; // 2 minutes max in dev
  }
}

/**
 * Production security hardening
 */
if (isProduction) {
  // Force secure defaults in production
  agentConfig.security.sandboxMode = true;
  agentConfig.security.fileAccessRestricted = true;
  agentConfig.workflows.requireHumanApproval = true;
}

/**
 * Helper functions for configuration access
 */
export const getAgentConfig = () => agentConfig;
export const isMCPServerEnabled = (serverName: keyof typeof agentConfig.mcpServers) => {
  return agentConfig.mcpServers[serverName];
};
export const getResourceLimits = () => agentConfig.resources;
export const getSecuritySettings = () => agentConfig.security;
export const getMonitoringConfig = () => agentConfig.monitoring;