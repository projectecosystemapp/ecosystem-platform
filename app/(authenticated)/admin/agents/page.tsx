/**
 * Agent System Admin Dashboard
 * 
 * Real-time monitoring and management interface for the agent orchestration system.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity,
  Users,
  ListTodo,
  AlertTriangle,
  CheckCircle,
  Clock,
  Settings,
  RefreshCw,
  Play,
  Square,
  BarChart3
} from 'lucide-react';

interface AgentStatus {
  agentId: string;
  isProcessing: boolean;
  activeTaskCount: number;
  maxConcurrentTasks: number;
  utilization: number;
  capabilities: string[];
}

interface SystemStatus {
  system: {
    status: string;
    lastHealthCheck: string;
    totalAgents: number;
    activeAgents: number;
    activeTasks: number;
    queuedTasks: number;
  };
  agents: Array<{
    id: string;
    name: string;
    status: string;
    capabilities: string[];
    metadata: {
      totalTasksCompleted: number;
      successRate: number;
      averageResponseTime: number;
    };
  }>;
  mcpServers: Array<{
    name: string;
    status: string;
    capabilities: number;
    lastCheck: string;
  }>;
  taskDetails?: {
    byStatus: Record<string, number>;
    byAgent: Record<string, number>;
    recent: Array<{
      id: string;
      title: string;
      status: string;
      assignedTo?: string;
      createdAt: string;
      duration?: number | null;
    }>;
  };
  workflowDetails?: Array<{
    id: string;
    workflowId: string;
    status: string;
    currentNode?: string;
    progress: {
      nodesExecuted: number;
      nodesSkipped: number;
      nodesFailed: number;
    };
    startedAt?: string;
    estimatedCompletion?: string | null;
  }>;
  performance?: any;
  alerts?: any[];
}

export default function AgentsDashboard() {
  const { userId } = useAuth();
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  /**
   * Fetch system status
   */
  const fetchSystemStatus = async (includeMetrics = false) => {
    try {
      const response = await fetch(`/api/agents/status?details=true&metrics=${includeMetrics}`);
      if (response.ok) {
        const data = await response.json();
        setSystemStatus(data);
      } else {
        console.error('Failed to fetch system status:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching system status:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Initialize agent system
   */
  const initializeSystem = async () => {
    setInitializing(true);
    try {
      const response = await fetch('/api/agents/init', { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        console.log('Agent system initialized:', data);
        await fetchSystemStatus(true);
      } else {
        console.error('Failed to initialize agents:', response.statusText);
      }
    } catch (error) {
      console.error('Error initializing agents:', error);
    } finally {
      setInitializing(false);
    }
  };

  /**
   * Auto-refresh system status
   */
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchSystemStatus(false);
      }, 5000); // Refresh every 5 seconds

      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  /**
   * Initial load
   */
  useEffect(() => {
    fetchSystemStatus(true);
  }, []);

  if (!userId) {
    return <div>Unauthorized</div>;
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Agent System Dashboard</h1>
          <p className="text-gray-600 mt-1">Monitor and manage the agent orchestration system</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh: {autoRefresh ? 'On' : 'Off'}
          </Button>
          
          <Button 
            onClick={() => fetchSystemStatus(true)}
            disabled={loading}
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {systemStatus?.system.totalAgents === 0 && (
            <Button 
              onClick={initializeSystem}
              disabled={initializing}
            >
              <Play className={`h-4 w-4 mr-2 ${initializing ? 'animate-spin' : ''}`} />
              Initialize System
            </Button>
          )}
        </div>
      </div>

      {loading && !systemStatus && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3">Loading agent system status...</span>
        </div>
      )}

      {systemStatus && (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="agents">Agents</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="workflows">Workflows</TabsTrigger>
            <TabsTrigger value="mcp">MCP Servers</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">System Status</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    <StatusBadge status={systemStatus.system.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last check: {new Date(systemStatus.system.lastHealthCheck).toLocaleTimeString()}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {systemStatus.system.activeAgents}/{systemStatus.system.totalAgents}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Agents online
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
                  <ListTodo className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {systemStatus.system.activeTasks}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    +{systemStatus.system.queuedTasks} queued
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">MCP Servers</CardTitle>
                  <Settings className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {systemStatus.mcpServers.filter(s => s.status === 'healthy').length}/{systemStatus.mcpServers.length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Servers healthy
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Alerts */}
            {systemStatus.alerts && systemStatus.alerts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <AlertTriangle className="h-5 w-5 mr-2 text-yellow-500" />
                    Active Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {systemStatus.alerts.map(alert => (
                      <div key={alert.id} className="flex items-center justify-between p-2 bg-yellow-50 rounded">
                        <div>
                          <span className="font-medium">{alert.name}</span>
                          <p className="text-sm text-gray-600">{alert.message}</p>
                        </div>
                        <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                          {alert.severity}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Agents Tab */}
          <TabsContent value="agents" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {systemStatus.agents.map(agent => (
                <Card key={agent.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{agent.name}</CardTitle>
                      <StatusBadge status={agent.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>Tasks Completed:</span>
                      <span className="font-medium">{agent.metadata.totalTasksCompleted}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Success Rate:</span>
                      <span className="font-medium">{(agent.metadata.successRate * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Avg Response Time:</span>
                      <span className="font-medium">{agent.metadata.averageResponseTime}ms</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium">Capabilities:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {agent.capabilities.slice(0, 3).map(cap => (
                          <Badge key={cap} variant="outline" className="text-xs">
                            {cap}
                          </Badge>
                        ))}
                        {agent.capabilities.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{agent.capabilities.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="space-y-4">
            {systemStatus.taskDetails && (
              <Card>
                <CardHeader>
                  <CardTitle>Recent Tasks</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {systemStatus.taskDetails.recent.map((task: any) => (
                      <div key={task.id} className="flex items-center justify-between p-3 border rounded">
                        <div>
                          <div className="font-medium">{task.title}</div>
                          <div className="text-sm text-gray-600">
                            {task.assignedTo ? `Assigned to ${task.assignedTo}` : 'Unassigned'}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {task.duration && (
                            <span className="text-xs text-gray-500">
                              {Math.round(task.duration / 1000)}s
                            </span>
                          )}
                          <TaskStatusBadge status={task.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Workflows Tab */}
          <TabsContent value="workflows" className="space-y-4">
            {systemStatus.workflowDetails && (
              <Card>
                <CardHeader>
                  <CardTitle>Active Workflows</CardTitle>
                </CardHeader>
                <CardContent>
                  {systemStatus.workflowDetails.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No active workflows
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {systemStatus.workflowDetails.map((workflow: any) => (
                        <div key={workflow.id} className="border rounded p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">Workflow {workflow.id}</span>
                            <StatusBadge status={workflow.status} />
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600">Executed:</span>
                              <span className="ml-1 font-medium">{workflow.progress.nodesExecuted}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Failed:</span>
                              <span className="ml-1 font-medium">{workflow.progress.nodesFailed}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Skipped:</span>
                              <span className="ml-1 font-medium">{workflow.progress.nodesSkipped}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* MCP Servers Tab */}
          <TabsContent value="mcp" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {systemStatus.mcpServers.map(server => (
                <Card key={server.name}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{server.name}</CardTitle>
                      <StatusBadge status={server.status} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Capabilities:</span>
                        <span className="font-medium">{server.capabilities}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Last Check:</span>
                        <span className="font-medium">
                          {new Date(server.lastCheck).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Metrics Tab */}
          <TabsContent value="metrics" className="space-y-4">
            {systemStatus.performance && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Total Tasks</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {systemStatus.performance.tasks.totalProcessed}
                      </div>
                      <p className="text-xs text-red-500">
                        {systemStatus.performance.tasks.totalFailed} failed
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Error Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {(systemStatus.performance.tasks.errorRate * 100).toFixed(1)}%
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Avg Duration</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {Math.round(systemStatus.performance.tasks.averageDuration / 1000)}s
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Throughput</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {systemStatus.performance.tasks.throughput}
                      </div>
                      <p className="text-xs text-muted-foreground">tasks/min</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Agent Utilization</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(systemStatus.performance.agents.utilizationByAgent).map(([agentId, utilization]) => (
                        <div key={agentId}>
                          <div className="flex justify-between text-sm mb-1">
                            <span>{agentId}</span>
                            <span>{String(utilization)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${Math.min(100, Number(utilization))}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

/**
 * Status badge component
 */
function StatusBadge({ status }: { status: string }) {
  const variants = {
    healthy: 'default',
    idle: 'secondary',
    busy: 'default',
    running: 'default',
    completed: 'secondary',
    failed: 'destructive',
    critical: 'destructive',
    degraded: 'secondary'
  };

  const icons = {
    healthy: CheckCircle,
    idle: Clock,
    busy: Activity,
    running: Activity,
    completed: CheckCircle,
    failed: AlertTriangle,
    critical: AlertTriangle,
    degraded: AlertTriangle
  };

  const Icon = icons[status as keyof typeof icons] || Activity;
  const variant = variants[status as keyof typeof variants] || 'secondary';

  return (
    <Badge variant={variant as any} className="flex items-center space-x-1">
      <Icon className="h-3 w-3" />
      <span>{status}</span>
    </Badge>
  );
}

/**
 * Task status badge component
 */
function TaskStatusBadge({ status }: { status: string }) {
  const colors = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    ASSIGNED: 'bg-blue-100 text-blue-800',
    IN_PROGRESS: 'bg-blue-100 text-blue-800',
    COMPLETED: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
    CANCELLED: 'bg-gray-100 text-gray-800',
    RETRYING: 'bg-orange-100 text-orange-800'
  };

  const colorClass = colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
      {status}
    </span>
  );
}