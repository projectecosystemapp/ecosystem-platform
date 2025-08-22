"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log critical error to Sentry
    Sentry.captureException(error, {
      level: "fatal",
      tags: {
        location: "global-error-boundary",
      },
    });
  }, [error]);

  return (
    <html>
      <body>
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#FEF2F2",
          padding: "20px",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}>
          <div style={{
            maxWidth: "600px",
            width: "100%",
            backgroundColor: "white",
            borderRadius: "12px",
            padding: "40px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
            textAlign: "center",
          }}>
            {/* Critical Error Icon */}
            <div style={{
              width: "80px",
              height: "80px",
              margin: "0 auto 24px",
              backgroundColor: "#FEE2E2",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#DC2626"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>

            <h1 style={{
              fontSize: "28px",
              fontWeight: "700",
              color: "#111827",
              marginBottom: "12px",
            }}>
              Critical Application Error
            </h1>

            <p style={{
              fontSize: "16px",
              color: "#6B7280",
              marginBottom: "32px",
              lineHeight: "1.5",
            }}>
              We&apos;re experiencing a critical issue that&apos;s preventing the application from running properly. 
              Our team has been automatically notified.
            </p>

            {/* Action Buttons */}
            <div style={{
              display: "flex",
              gap: "12px",
              justifyContent: "center",
              flexWrap: "wrap",
            }}>
              <button
                onClick={reset}
                style={{
                  backgroundColor: "#DC2626",
                  color: "white",
                  padding: "12px 24px",
                  borderRadius: "8px",
                  border: "none",
                  fontSize: "16px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#B91C1C"}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#DC2626"}
              >
                Restart Application
              </button>
              
              <button
                onClick={() => window.location.href = "/"}
                style={{
                  backgroundColor: "white",
                  color: "#374151",
                  padding: "12px 24px",
                  borderRadius: "8px",
                  border: "1px solid #E5E7EB",
                  fontSize: "16px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#F9FAFB"}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = "white"}
              >
                Go to Homepage
              </button>
            </div>

            {/* Error Code */}
            <div style={{
              marginTop: "32px",
              padding: "16px",
              backgroundColor: "#F9FAFB",
              borderRadius: "8px",
              border: "1px solid #E5E7EB",
            }}>
              <p style={{
                fontSize: "14px",
                color: "#6B7280",
                margin: "0",
              }}>
                Error Reference: <code style={{
                  backgroundColor: "#E5E7EB",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontFamily: "monospace",
                  fontSize: "13px",
                }}>{error.digest || "CRITICAL_ERROR"}</code>
              </p>
              <p style={{
                fontSize: "13px",
                color: "#9CA3AF",
                marginTop: "8px",
                margin: "8px 0 0 0",
              }}>
                If this issue persists, please contact support at support@ecosystem-platform.com
              </p>
            </div>

            {/* Development Mode Error Details */}
            {process.env.NODE_ENV === "development" && (
              <details style={{
                marginTop: "24px",
                textAlign: "left",
              }}>
                <summary style={{
                  cursor: "pointer",
                  fontSize: "14px",
                  color: "#6B7280",
                  marginBottom: "8px",
                }}>
                  Error Stack (Development Only)
                </summary>
                <pre style={{
                  backgroundColor: "#1F2937",
                  color: "#F3F4F6",
                  padding: "12px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  overflow: "auto",
                  maxHeight: "200px",
                  fontFamily: "monospace",
                }}>
                  {error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}