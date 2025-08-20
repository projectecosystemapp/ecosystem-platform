"use client";

import { SignIn } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url");

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="w-full">
        <SignIn
          // Always redirect to dashboard or the specified redirect URL
          redirectUrl={redirectUrl || "/dashboard"}
          appearance={{ 
            elements: {
              formButtonPrimary: "bg-primary hover:bg-primary/90",
              card: "rounded-xl shadow-sm",
              formFieldInput: "rounded-lg border-gray-300 dark:border-gray-700"
            }
          }}
        />
      </div>
    </div>
  );
}
