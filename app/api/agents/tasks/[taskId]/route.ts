/**
 * Individual Task Management API
 * 
 * Handles operations on specific tasks including updates, cancellation, and retry.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { useOrchestratorStore } from '@/lib/agents/orchestrator';
import { TaskStatus } from '@/lib/agents/types';

const updateTaskSchema = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  assignedTo: z.string().optional()
});

/**
 * Get task details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const session = await auth();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const store = useOrchestratorStore.getState();
    const task = store.tasks.get(params.taskId);

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Get assigned agent details if available
    const assignedAgent = task.assignedTo ? store.agents.get(task.assignedTo) : null;

    return NextResponse.json({
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        type: task.type,
        status: task.status,
        priority: task.priority,
        requiredCapabilities: task.requiredCapabilities,
        dependencies: task.dependencies,
        subtasks: task.subtasks,
        assignedTo: task.assignedTo,
        input: task.input,
        output: task.output,
        error: task.error,
        checkpoints: task.checkpoints,
        metadata: task.metadata
      },
      assignedAgent: assignedAgent ? {
        id: assignedAgent.id,
        name: assignedAgent.name,
        status: assignedAgent.status,
        capabilities: assignedAgent.capabilities
      } : null,
      executionHistory: task.metadata.executionHistory || []
    });

  } catch (error) {
    console.error('Failed to get task:', error);
    return NextResponse.json({
      error: 'Failed to retrieve task',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Update task
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const session = await auth();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = updateTaskSchema.parse(body);

    const store = useOrchestratorStore.getState();
    const task = store.tasks.get(params.taskId);

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Update task properties
    if (validatedData.status && validatedData.status !== task.status) {
      store.updateTaskStatus(params.taskId, validatedData.status);
    }

    if (validatedData.assignedTo && validatedData.assignedTo !== task.assignedTo) {
      // Reassign task to different agent
      store.assignTask(params.taskId, validatedData.assignedTo);
    }

    const updatedTask = store.tasks.get(params.taskId);

    return NextResponse.json({
      task: {
        id: updatedTask?.id,
        title: updatedTask?.title,
        status: updatedTask?.status,
        assignedTo: updatedTask?.assignedTo,
        updatedAt: new Date()
      },
      message: 'Task updated successfully'
    });

  } catch (error) {
    console.error('Failed to update task:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid request data',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      error: 'Failed to update task',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Cancel or retry task
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const session = await auth();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'cancel';

    const store = useOrchestratorStore.getState();
    const task = store.tasks.get(params.taskId);

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (action === 'retry') {
      if (task.status !== TaskStatus.FAILED) {
        return NextResponse.json({
          error: 'Can only retry failed tasks'
        }, { status: 400 });
      }

      store.retryTask(params.taskId);
      
      return NextResponse.json({
        message: 'Task retry initiated',
        taskId: params.taskId,
        newStatus: TaskStatus.PENDING
      });
      
    } else {
      // Cancel task
      if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.CANCELLED) {
        return NextResponse.json({
          error: 'Cannot cancel completed or already cancelled tasks'
        }, { status: 400 });
      }

      store.cancelTask(params.taskId);
      
      return NextResponse.json({
        message: 'Task cancelled successfully',
        taskId: params.taskId,
        newStatus: TaskStatus.CANCELLED
      });
    }

  } catch (error) {
    console.error('Failed to process task action:', error);
    return NextResponse.json({
      error: 'Failed to process task action',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}