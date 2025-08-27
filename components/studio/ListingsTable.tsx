"use client";

import { useState } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  MoreHorizontal, 
  Edit, 
  Copy, 
  Trash, 
  Eye,
  Package,
  Calendar,
  MapPin,
  ShoppingBag
} from "lucide-react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type ListingType = 'service' | 'event' | 'space' | 'thing';

interface BaseListing {
  id: string;
  type: ListingType;
  name?: string;
  title?: string;
  price?: number;
  isActive?: boolean;
  createdAt?: Date;
  description?: string;
  status?: string;
}

interface ListingsTableProps {
  listings: BaseListing[];
  providerId: string;
}

export function ListingsTable({ listings, providerId }: ListingsTableProps) {
  const router = useRouter();
  const [selectedListings, setSelectedListings] = useState<Set<string>>(new Set());
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedListings(new Set(listings.map(l => l.id)));
    } else {
      setSelectedListings(new Set());
    }
  };

  const handleSelectListing = (listingId: string, checked: boolean) => {
    const newSelected = new Set(selectedListings);
    if (checked) {
      newSelected.add(listingId);
    } else {
      newSelected.delete(listingId);
    }
    setSelectedListings(newSelected);
  };

  const handleToggleActive = async (listing: BaseListing) => {
    setLoadingStates({ ...loadingStates, [listing.id]: true });
    
    try {
      // Call appropriate API based on listing type
      const endpoint = listing.type === 'service' 
        ? `/api/providers/${providerId}/services/${listing.id}`
        : `/api/${listing.type}s/${listing.id}`;
        
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !listing.isActive }),
      });

      if (response.ok) {
        toast.success(`${listing.type} ${listing.isActive ? 'deactivated' : 'activated'} successfully`);
        router.refresh();
      } else {
        throw new Error('Failed to update listing status');
      }
    } catch (error) {
      toast.error('Failed to update listing status');
    } finally {
      setLoadingStates({ ...loadingStates, [listing.id]: false });
    }
  };

  const handleDelete = async (listing: BaseListing) => {
    if (!confirm(`Are you sure you want to delete this ${listing.type}?`)) {
      return;
    }

    setLoadingStates({ ...loadingStates, [listing.id]: true });
    
    try {
      const endpoint = listing.type === 'service' 
        ? `/api/providers/${providerId}/services/${listing.id}`
        : `/api/${listing.type}s/${listing.id}`;
        
      const response = await fetch(endpoint, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success(`${listing.type} deleted successfully`);
        router.refresh();
      } else {
        throw new Error('Failed to delete listing');
      }
    } catch (error) {
      toast.error('Failed to delete listing');
    } finally {
      setLoadingStates({ ...loadingStates, [listing.id]: false });
    }
  };

  const getListingIcon = (type: ListingType) => {
    switch (type) {
      case 'service':
        return <Package className="h-4 w-4" />;
      case 'event':
        return <Calendar className="h-4 w-4" />;
      case 'space':
        return <MapPin className="h-4 w-4" />;
      case 'thing':
        return <ShoppingBag className="h-4 w-4" />;
    }
  };

  const getListingName = (listing: BaseListing) => {
    return listing.name || listing.title || 'Untitled';
  };

  const getListingStatus = (listing: BaseListing) => {
    if (listing.status) return listing.status;
    return listing.isActive ? 'Active' : 'Inactive';
  };

  if (listings.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No listings found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bulk Actions */}
      {selectedListings.size > 0 && (
        <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg">
          <span className="text-sm font-medium text-blue-900">
            {selectedListings.size} item{selectedListings.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline">
              Activate Selected
            </Button>
            <Button size="sm" variant="outline">
              Deactivate Selected
            </Button>
            <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700">
              Delete Selected
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedListings.size === listings.length && listings.length > 0}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listings.map((listing) => (
              <TableRow key={listing.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedListings.has(listing.id)}
                    onCheckedChange={(checked) => handleSelectListing(listing.id, checked as boolean)}
                    aria-label={`Select ${getListingName(listing)}`}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getListingIcon(listing.type)}
                    <span className="capitalize text-sm font-medium">{listing.type}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{getListingName(listing)}</p>
                    {listing.description && (
                      <p className="text-sm text-gray-500 truncate max-w-xs">
                        {listing.description}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {listing.price ? `$${listing.price}` : '-'}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={listing.isActive ?? false}
                      onCheckedChange={() => handleToggleActive(listing)}
                      disabled={loadingStates[listing.id]}
                      aria-label={`Toggle ${getListingName(listing)} status`}
                    />
                    <Badge variant={listing.isActive ? 'default' : 'secondary'}>
                      {getListingStatus(listing)}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  {listing.createdAt ? format(new Date(listing.createdAt), 'MMM d, yyyy') : '-'}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        disabled={loadingStates[listing.id]}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Open menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={() => router.push(`/studio/listings/${listing.type}s/${listing.id}`)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => router.push(`/studio/listings/${listing.type}s/${listing.id}/edit`)}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Copy className="mr-2 h-4 w-4" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => handleDelete(listing)}
                      >
                        <Trash className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}