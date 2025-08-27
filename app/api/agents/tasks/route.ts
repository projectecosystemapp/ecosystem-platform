// @ts-nocheck
/**
 * Agent Tasks Management API
 * 
 * Handles task creation, assignment, and monitoring for the agent orchestration system.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { useOrchestratorStore } from '@/lib/agents/orchestrator';
import { AgentCapability, AgentPriority, TaskStatus } from '@/lib/agents/types';
import { coreAgentRunner } from '@/lib/agents/runners/CoreAgentRunner';
import { uiAgentRunner } from '@/lib/agents/runners/UIAgentRunner';
import { dbAgentRunner } from '@/lib/agents/runners/DBAgentRunner';
import { paymentsAgentRunner } from '@/lib/agents/runners/PaymentsAgentRunner';
import { securityAgentRunner } from '@/lib/agents/runners/SecurityAgentRunner';

/**
 * Request validation schemas
 */
const createTaskSchema = z.object({
  type: z.string(),
  title: z.string(),
  description: z.string(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  requiredCapabilities: z.array(z.nativeEnum(AgentCapability)),
  input: z.record(z.string(), z.any()),
  dependencies: z.array(z.string()).optional(),
  deadline: z.string().datetime().optional()
});

const updateTaskSchema = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  assignedTo: z.string().optional()
});

/**
 * Create a new task
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createTaskSchema.parse(body);

    const store = useOrchestratorStore.getState();

    // Convert priority string to enum
    const priority = AgentPriority[validatedData.priority as keyof typeof AgentPriority];

    const taskId = store.createTask({
      type: validatedData.type,
      title: validatedData.title,
      description: validatedData.description,
      priority,
      requiredCapabilities: validatedData.requiredCapabilities,
      input: validatedData.input,
      dependencies: validatedData.dependencies || [],
      subtasks: [],
      checkpoints: [],
      metadata: {
        deadline: validatedData.deadline ? new Date(validatedData.deadline) : undefined,
        createdBy: session.userId
      }
    });

    const task = store.tasks.get(taskId);

    return NextResponse.json({
      taskId,
      task: {
        id: task?.id,
        title: task?.title,
        status: task?.status,
        priority: task?.priority,
        requiredCapabilities: task?.requiredCapabilities,
        assignedTo: task?.assignedTo,
        createdAt: task?.metadata.createdAt
      },
      message: 'Task created and queued for assignment'
    });

  } catch (error) {
    console.error('Failed to create task:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid request data',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      error: 'Failed to create task',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Get tasks with filtering
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as TaskStatus | null;
    const agentId = searchParams.get('agentId');
    const limit = parseInt(searchParams.get('limit') || '20');

    const store = useOrchestratorStore.getState();
    let tasks = Array.from(store.tasks.values());

    // Apply filters
    if (status) {
      tasks = tasks.filter(task => task.status === status);
    }

    if (agentId) {
      tasks = tasks.filter(task => task.assignedTo === agentId);
    }

    // Sort by creation date (newest first)
    tasks.sort((a, b) => 
      new Date(b.metadata.createdAt).getTime() - new Date(a.metadata.createdAt).getTime()
    );

    // Apply limit
    tasks = tasks.slice(0, limit);

    return NextResponse.json({
      tasks: tasks.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        assignedTo: task.assignedTo,
        requiredCapabilities: task.requiredCapabilities,
        dependencies: task.dependencies,
        createdAt: task.metadata.createdAt,
        startedAt: task.metadata.startedAt,
        completedAt: task.metadata.completedAt,
        retryCount: task.metadata.retryCount
      })),
      summary: {
        total: store.tasks.size,
        pending: Array.from(store.tasks.values()).filter(t => t.status === TaskStatus.PENDING).length,
        assigned: Array.from(store.tasks.values()).filter(t => t.status === TaskStatus.ASSIGNED).length,
        in_progress: Array.from(store.tasks.values()).filter(t => t.status === TaskStatus.IN_PROGRESS).length,
        completed: Array.from(store.tasks.values()).filter(t => t.status === TaskStatus.COMPLETED).length,
        failed: Array.from(store.tasks.values()).filter(t => t.status === TaskStatus.FAILED).length,
        queued: store.taskQueue.length,
        active: store.activeTasks.size
      }
    });

  } catch (error) {
    console.error('Failed to get tasks:', error);
    return NextResponse.json({
      error: 'Failed to retrieve tasks',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}