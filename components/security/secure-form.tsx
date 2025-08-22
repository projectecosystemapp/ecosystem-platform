/**
 * Secure Form Component
 * 
 * Example implementation of a form with CSRF protection
 */

'use client';

import React, { FormEvent, ReactNode } from 'react';
import { useCSRF } from '@/hooks/use-csrf';
import { toast } from 'sonner';

interface SecureFormProps {
  action: string;
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
  children: ReactNode;
  className?: string;
}

/**
 * Form component with built-in CSRF protection
 */
export function SecureForm({
  action,
  method = 'POST',
  onSuccess,
  onError,
  children,
  className,
}: SecureFormProps) {
  const { token, fetchWithCSRF, isLoading: csrfLoading } = useCSRF();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (!token) {
      toast.error('Security token not available. Please refresh the page.');
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData(event.currentTarget);
      const body = Object.fromEntries(formData.entries());

      const response = await fetchWithCSRF(action, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Request failed');
      }

      const data = await response.json();
      toast.success('Operation completed successfully');
      onSuccess?.(data);
    } catch (error) {
      console.error('Form submission error:', error);
      toast.error(error instanceof Error ? error.message : 'An error occurred');
      onError?.(error instanceof Error ? error : new Error('Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (csrfLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-sm text-muted-foreground">Loading security features...</div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      {/* Hidden CSRF token field for traditional form submissions */}
      <input type="hidden" name="_csrf" value={token || ''} />
      {children}
      {/* Disable form while submitting */}
      <fieldset disabled={isSubmitting} className="contents">
        {/* Form fields go here */}
      </fieldset>
    </form>
  );
}

/**
 * Secure API call button with CSRF protection
 */
interface SecureActionButtonProps {
  action: string;
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data?: Record<string, any>;
  confirmMessage?: string;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
}

export function SecureActionButton({
  action,
  method = 'POST',
  data = {},
  confirmMessage,
  onSuccess,
  onError,
  children,
  className,
  variant = 'default',
}: SecureActionButtonProps) {
  const { fetchWithCSRF, isLoading: csrfLoading } = useCSRF();
  const [isLoading, setIsLoading] = React.useState(false);

  const handleClick = async () => {
    if (confirmMessage && !confirm(confirmMessage)) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetchWithCSRF(action, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Request failed');
      }

      const responseData = await response.json();
      toast.success('Action completed successfully');
      onSuccess?.(responseData);
    } catch (error) {
      console.error('Action error:', error);
      toast.error(error instanceof Error ? error.message : 'An error occurred');
      onError?.(error instanceof Error ? error : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading || csrfLoading}
      className={className}
      data-variant={variant}
    >
      {isLoading ? 'Processing...' : children}
    </button>
  );
}

/**
 * Example usage in a component
 */
export function ExampleSecureForm() {
  return (
    <SecureForm
      action="/api/provider/update"
      method="POST"
      onSuccess={(data) => {
        console.log('Provider updated:', data);
      }}
      className="space-y-4"
    >
      <div>
        <label htmlFor="name" className="block text-sm font-medium">
          Provider Name
        </label>
        <input
          type="text"
          id="name"
          name="name"
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
        />
      </div>
      
      <div>
        <label htmlFor="description" className="block text-sm font-medium">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
        />
      </div>
      
      <button
        type="submit"
        className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
      >
        Save Changes
      </button>
    </SecureForm>
  );
}