'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Bug, CheckCircle2, Activity } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';

export default function SentryExamplePage() {
  const [testResults, setTestResults] = React.useState<{
    [key: string]: 'pending' | 'success' | 'error';
  }>({});

  const handleBasicError = () => {
    setTestResults(prev => ({ ...prev, basic: 'pending' }));
    
    try {
      // This will throw an error
      (window as any).myUndefinedFunction();
    } catch (error) {
      setTestResults(prev => ({ ...prev, basic: 'success' }));
      console.log('Basic error captured successfully');
    }
  };

  const handleCustomError = () => {
    setTestResults(prev => ({ ...prev, custom: 'pending' }));
    
    Sentry.withScope((scope) => {
      scope.setTag('test', 'sentry-example-page');
      scope.setContext('test_context', {
        page: 'sentry-example-page',
        testType: 'custom-error',
        timestamp: new Date().toISOString(),
      });
      scope.setUser({
        id: 'test-user',
        email: 'test@example.com',
      });
      
      const error = new Error('Test custom error from Sentry example page');
      Sentry.captureException(error);
      
      setTestResults(prev => ({ ...prev, custom: 'success' }));
    });
  };

  const handlePerformanceTest = () => {
    setTestResults(prev => ({ ...prev, performance: 'pending' }));
    
    // Use the newer Sentry v8 API
    Sentry.startSpan(
      {
        op: 'test',
        name: 'Sentry Example Performance Test',
      },
      (span) => {
        // Simulate some work
        setTimeout(() => {
          Sentry.startSpan(
            {
              op: 'test.processing',
              name: 'Simulated processing work',
            },
            () => {
              setTimeout(() => {
                setTestResults(prev => ({ ...prev, performance: 'success' }));
              }, 1000);
            }
          );
        }, 500);
      }
    );
  };

  const handleBreadcrumbTest = () => {
    setTestResults(prev => ({ ...prev, breadcrumb: 'pending' }));
    
    // Add some breadcrumbs
    Sentry.addBreadcrumb({
      message: 'User started breadcrumb test',
      level: 'info',
      category: 'user-interaction',
    });
    
    Sentry.addBreadcrumb({
      message: 'Processing breadcrumb data',
      level: 'info',
      category: 'processing',
    });
    
    // Capture a message with breadcrumbs
    Sentry.captureMessage('Breadcrumb test completed', 'info');
    
    setTestResults(prev => ({ ...prev, breadcrumb: 'success' }));
  };

  const getStatusIcon = (status: 'pending' | 'success' | 'error' | undefined) => {
    switch (status) {
      case 'pending':
        return <Activity className="h-4 w-4 text-yellow-500 animate-spin" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Bug className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: 'pending' | 'success' | 'error' | undefined) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Testing...</Badge>;
      case 'success':
        return <Badge className="bg-green-500">Sent to Sentry</Badge>;
      case 'error':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">Ready to Test</Badge>;
    }
  };

  return (
    <div className="container mx-auto max-w-4xl p-6 space-y-6">
      <div className="text-center space-y-4 mb-8">
        <h1 className="text-3xl font-bold">Sentry Integration Test</h1>
        <p className="text-muted-foreground">
          Test various Sentry features to verify your integration is working correctly.
        </p>
        <div className="text-sm text-muted-foreground bg-muted p-4 rounded-lg">
          <strong>Note:</strong> In development mode, errors are logged to console instead of being sent to Sentry.
          Set up your production environment with a valid SENTRY_DSN to see events in your Sentry dashboard.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Error Test */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="space-y-1">
              <CardTitle className="text-lg flex items-center gap-2">
                {getStatusIcon(testResults.basic)}
                Basic Error Test
              </CardTitle>
              <CardDescription>
                Triggers an undefined function error
              </CardDescription>
            </div>
            {getStatusBadge(testResults.basic)}
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleBasicError}
              variant="destructive"
              className="w-full"
              disabled={testResults.basic === 'pending'}
            >
              Trigger Basic Error
            </Button>
          </CardContent>
        </Card>

        {/* Custom Error Test */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="space-y-1">
              <CardTitle className="text-lg flex items-center gap-2">
                {getStatusIcon(testResults.custom)}
                Custom Error Test
              </CardTitle>
              <CardDescription>
                Captures a custom error with context
              </CardDescription>
            </div>
            {getStatusBadge(testResults.custom)}
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleCustomError}
              variant="destructive"
              className="w-full"
              disabled={testResults.custom === 'pending'}
            >
              Trigger Custom Error
            </Button>
          </CardContent>
        </Card>

        {/* Performance Test */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="space-y-1">
              <CardTitle className="text-lg flex items-center gap-2">
                {getStatusIcon(testResults.performance)}
                Performance Test
              </CardTitle>
              <CardDescription>
                Creates performance transactions
              </CardDescription>
            </div>
            {getStatusBadge(testResults.performance)}
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handlePerformanceTest}
              variant="secondary"
              className="w-full"
              disabled={testResults.performance === 'pending'}
            >
              Test Performance Tracking
            </Button>
          </CardContent>
        </Card>

        {/* Breadcrumb Test */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="space-y-1">
              <CardTitle className="text-lg flex items-center gap-2">
                {getStatusIcon(testResults.breadcrumb)}
                Breadcrumb Test
              </CardTitle>
              <CardDescription>
                Adds breadcrumbs and captures message
              </CardDescription>
            </div>
            {getStatusBadge(testResults.breadcrumb)}
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleBreadcrumbTest}
              variant="outline"
              className="w-full"
              disabled={testResults.breadcrumb === 'pending'}
            >
              Test Breadcrumbs
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Environment Status */}
      <Card>
        <CardHeader>
          <CardTitle>Environment Status</CardTitle>
          <CardDescription>Current Sentry configuration details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Environment:</span>
                <Badge variant="outline">{process.env.NODE_ENV}</Badge>
              </div>
              <div className="flex justify-between">
                <span>DSN Configured:</span>
                <Badge variant={process.env.NEXT_PUBLIC_SENTRY_DSN ? "default" : "secondary"}>
                  {process.env.NEXT_PUBLIC_SENTRY_DSN ? "Yes" : "No"}
                </Badge>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Session Replay:</span>
                <Badge variant="default">Enabled</Badge>
              </div>
              <div className="flex justify-between">
                <span>Performance:</span>
                <Badge variant="default">Enabled</Badge>
              </div>
            </div>
          </div>
          
          <div className="pt-4 border-t">
            <h4 className="font-medium mb-2">Next Steps:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>1. Set your SENTRY_DSN in environment variables</li>
              <li>2. Deploy to production or staging</li>
              <li>3. Test the buttons above to send events to Sentry</li>
              <li>4. Check your Sentry dashboard for captured events</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* AI Integration Test */}
      <Card>
        <CardHeader>
          <CardTitle>AI Integration Test</CardTitle>
          <CardDescription>Test Sentry monitoring for AI operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => {
                fetch('/api/test/sentry-ai', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ operation: 'generateText' })
                }).then(res => res.json()).then(console.log);
              }}
            >
              Test AI Text Generation
            </Button>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => {
                fetch('/api/test/sentry-ai', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ operation: 'generateObject' })
                }).then(res => res.json()).then(console.log);
              }}
            >
              Test AI Object Generation
            </Button>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => {
                fetch('/api/test/sentry-ai', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ operation: 'streamText' })
                }).then(res => res.json()).then(console.log);
              }}
            >
              Test AI Streaming
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Check the browser console for responses. In production, these operations will be tracked in Sentry.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}