import { Metadata } from "next";
import { Wrench, Clock, Mail, Twitter, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Maintenance - We'll Be Right Back",
  description: "We're currently performing scheduled maintenance to improve your experience.",
};

export default function MaintenancePage() {
  // In production, this would check an environment variable or feature flag
  const estimatedTime = "2:00 PM PST";
  const maintenanceStarted = "12:00 PM PST";
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          {/* Maintenance Icon */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center">
                <Wrench className="h-12 w-12 text-blue-600" />
              </div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center animate-pulse">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="text-center space-y-4 mb-8">
            <h1 className="text-4xl font-bold text-gray-900">
              We&apos;ll Be Right Back!
            </h1>
            <p className="text-lg text-gray-600 max-w-md mx-auto">
              We&apos;re currently performing scheduled maintenance to improve your experience. 
              This won&apos;t take long.
            </p>
          </div>

          {/* Maintenance Details */}
          <Alert className="mb-8 border-blue-200 bg-blue-50">
            <Clock className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-900">
              <div className="space-y-2">
                <p className="font-semibold">Maintenance Window</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-blue-700">Started:</span>
                    <p className="font-medium">{maintenanceStarted}</p>
                  </div>
                  <div>
                    <span className="text-blue-700">Expected completion:</span>
                    <p className="font-medium">{estimatedTime}</p>
                  </div>
                </div>
              </div>
            </AlertDescription>
          </Alert>

          {/* What We're Doing */}
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <h2 className="font-semibold text-gray-900 mb-3">
              What we&apos;re working on:
            </h2>
            <ul className="space-y-2 text-gray-600">
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Performance improvements for faster loading</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Enhanced security updates</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-500 mr-2 animate-pulse">⟳</span>
                <span>Database optimization</span>
              </li>
              <li className="flex items-start">
                <span className="text-gray-400 mr-2">○</span>
                <span>New features deployment</span>
              </li>
            </ul>
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <p className="text-center text-gray-600">
              Need urgent assistance? Get in touch:
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="mailto:support@ecosystem-platform.com"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Mail className="h-4 w-4" />
                <span>Email Support</span>
              </a>
              <a
                href="https://twitter.com/ecosystem_status"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Twitter className="h-4 w-4" />
                <span>Status Updates</span>
              </a>
            </div>
          </div>

          {/* Auto-refresh notice */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-center text-sm text-gray-500">
              This page will automatically refresh when maintenance is complete.
              <br />
              <span className="text-xs">
                Last checked: {new Date().toLocaleTimeString()}
              </span>
            </p>
          </div>
        </div>

        {/* Back Button (for development) */}
        {process.env.NODE_ENV === "development" && (
          <div className="mt-6 text-center">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Homepage (Dev Only)
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Auto-refresh script */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            // Auto-refresh every 30 seconds
            setInterval(function() {
              fetch(window.location.href, { method: 'HEAD' })
                .then(response => {
                  if (response.ok && !response.headers.get('X-Maintenance-Mode')) {
                    window.location.reload();
                  }
                })
                .catch(() => {});
            }, 30000);
          `,
        }}
      />
    </div>
  );
}