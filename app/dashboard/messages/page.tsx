import { Metadata } from "next";
import { MessageCenter } from "@/components/messaging";

export const metadata: Metadata = {
  title: "Messages | Dashboard",
  description: "Manage your conversations with customers and providers",
};

export default function MessagesPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
          <p className="text-muted-foreground">
            Communicate with customers and providers
          </p>
        </div>
      </div>

      <div className="min-h-[600px]">
        <MessageCenter />
      </div>
    </div>
  );
}