"use client";

import Link from "next/link";
import { Search, Home, ArrowLeft, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        <div className="text-center space-y-8">
          {/* 404 Illustration */}
          <div className="relative">
            <div className="text-[200px] font-bold text-gray-100 leading-none select-none">
              404
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-white rounded-full p-8 shadow-lg">
                <Search className="h-16 w-16 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Error Message */}
          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-gray-900">
              Page not found
            </h1>
            <p className="text-lg text-gray-600 max-w-md mx-auto">
              Sorry, we couldn&apos;t find the page you&apos;re looking for. It might have been moved, deleted, or you may have typed the wrong URL.
            </p>
          </div>

          {/* Search Suggestions */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">
              What would you like to do?
            </h2>
            <div className="flex gap-2">
              <Input
                type="search"
                placeholder="Search for services or providers..."
                className="flex-1"
              />
              <Button variant="default">
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>
            <div className="text-sm text-gray-600">
              Popular searches:
              <div className="flex flex-wrap gap-2 mt-2">
                <Link href="/marketplace?category=plumbing">
                  <Button variant="outline" size="sm">Plumbing</Button>
                </Link>
                <Link href="/marketplace?category=electrical">
                  <Button variant="outline" size="sm">Electrical</Button>
                </Link>
                <Link href="/marketplace?category=cleaning">
                  <Button variant="outline" size="sm">Cleaning</Button>
                </Link>
                <Link href="/marketplace?category=landscaping">
                  <Button variant="outline" size="sm">Landscaping</Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/">
              <Button variant="default" size="lg">
                <Home className="mr-2 h-4 w-4" />
                Go to Homepage
              </Button>
            </Link>
            <Button
              variant="outline"
              size="lg"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
            <Link href="/help">
              <Button variant="ghost" size="lg">
                <HelpCircle className="mr-2 h-4 w-4" />
                Get Help
              </Button>
            </Link>
          </div>

          {/* Help Text */}
          <div className="text-sm text-gray-500 space-y-1">
            <p>Error Code: 404_NOT_FOUND</p>
            <p>
              If you believe this is a mistake, please{" "}
              <a
                href="mailto:support@ecosystem-platform.com"
                className="text-blue-600 hover:underline"
              >
                contact support
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}