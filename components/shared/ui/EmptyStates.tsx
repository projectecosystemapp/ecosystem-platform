import { 
  Search, 
  Package, 
  Calendar, 
  FileText, 
  Users, 
  DollarSign,
  ShoppingBag,
  Inbox,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { memo, ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  className?: string;
}

// Base Empty State Component - Server-side compatible
export const EmptyState = memo(function EmptyState({ 
  icon,
  title,
  description,
  action,
  className = ""
}: EmptyStateProps) {
  return (
    <div 
      className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}
      role="status"
      aria-label={`No content: ${title}`}
    >
      {icon && (
        <div className="mb-4 text-gray-400" aria-hidden="true">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-gray-600 max-w-md mb-6">{description}</p>
      )}
      {action && (
        action.href ? (
          <Button asChild>
            <a href={action.href}>{action.label}</a>
          </Button>
        ) : (
          <Button onClick={action.onClick}>{action.label}</Button>
        )
      )}
    </div>
  );
});

// Preset Empty States
export const NoSearchResults = memo(function NoSearchResults({ 
  searchTerm,
  onClear
}: { 
  searchTerm?: string;
  onClear?: () => void;
}) {
  return (
    <EmptyState
      icon={<Search className="h-12 w-12" />}
      title="No results found"
      description={searchTerm ? `No results match "${searchTerm}". Try adjusting your search.` : "Try adjusting your filters or search terms."}
      action={onClear ? { label: "Clear search", onClick: onClear } : undefined}
    />
  );
});

export const NoBookings = memo(function NoBookings({ 
  userType = "customer"
}: { 
  userType?: "customer" | "provider";
}) {
  return (
    <EmptyState
      icon={<Calendar className="h-12 w-12" />}
      title="No bookings yet"
      description={
        userType === "customer" 
          ? "When you book services, they'll appear here."
          : "When customers book your services, they'll appear here."
      }
      action={
        userType === "customer"
          ? { label: "Browse services", href: "/marketplace" }
          : undefined
      }
    />
  );
});

export const NoServices = memo(function NoServices({ 
  canAdd = false,
  onAdd
}: { 
  canAdd?: boolean;
  onAdd?: () => void;
}) {
  return (
    <EmptyState
      icon={<Package className="h-12 w-12" />}
      title="No services available"
      description="Services will appear here once they're added."
      action={canAdd && onAdd ? { label: "Add service", onClick: onAdd } : undefined}
    />
  );
});

export const NoTransactions = memo(function NoTransactions() {
  return (
    <EmptyState
      icon={<DollarSign className="h-12 w-12" />}
      title="No transactions yet"
      description="Your payment history will appear here."
    />
  );
});

export const NoOrders = memo(function NoOrders() {
  return (
    <EmptyState
      icon={<ShoppingBag className="h-12 w-12" />}
      title="No orders yet"
      description="Your order history will appear here."
      action={{ label: "Start shopping", href: "/marketplace" }}
    />
  );
});

export const NoDocuments = memo(function NoDocuments() {
  return (
    <EmptyState
      icon={<FileText className="h-12 w-12" />}
      title="No documents"
      description="Documents and files will appear here when available."
    />
  );
});

export const NoTeamMembers = memo(function NoTeamMembers({ 
  canInvite = false,
  onInvite
}: { 
  canInvite?: boolean;
  onInvite?: () => void;
}) {
  return (
    <EmptyState
      icon={<Users className="h-12 w-12" />}
      title="No team members"
      description="Invite team members to collaborate."
      action={canInvite && onInvite ? { label: "Invite members", onClick: onInvite } : undefined}
    />
  );
});

export const NoNotifications = memo(function NoNotifications() {
  return (
    <EmptyState
      icon={<Inbox className="h-12 w-12" />}
      title="All caught up!"
      description="You have no new notifications."
    />
  );
});

export const ErrorState = memo(function ErrorState({ 
  title = "Something went wrong",
  description = "An error occurred while loading this content.",
  onRetry
}: { 
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      icon={<AlertCircle className="h-12 w-12 text-red-500" />}
      title={title}
      description={description}
      action={onRetry ? { label: "Try again", onClick: onRetry } : undefined}
    />
  );
});