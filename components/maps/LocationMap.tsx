"use client";

import React from 'react';
import BaseMap from './BaseMap';
import { Coordinates } from '@/lib/mapbox/types';
import { cn } from '@/lib/utils';

interface LocationMapProps {
  coordinates: Coordinates;
  address?: string;
  title?: string;
  description?: string;
  zoom?: number;
  height?: string;
  className?: string;
  interactive?: boolean;
  showControls?: boolean;
  markerColor?: string;
}

export default function LocationMap({
  coordinates,
  address,
  title,
  description,
  zoom = 14,
  height = '300px',
  className,
  interactive = true,
  showControls = true,
  markerColor = '#3b82f6',
}: LocationMapProps) {
  const marker = {
    id: 'location',
    coordinates,
    color: markerColor,
    popup: title || address || 'Location',
  };

  return (
    <div className={cn("relative", className)} style={{ height }}>
      <BaseMap
        center={[coordinates.lng, coordinates.lat]}
        zoom={zoom}
        interactive={interactive}
        showControls={showControls}
        markers={[marker]}
        className="w-full h-full"
      >
        {/* Location Info Overlay */}
        {(title || address || description) && (
          <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 max-w-xs">
            {title && (
              <h3 className="font-semibold text-gray-900 text-sm mb-1">
                {title}
              </h3>
            )}
            {address && (
              <p className="text-gray-600 text-xs mb-1">
                📍 {address}
              </p>
            )}
            {description && (
              <p className="text-gray-500 text-xs">
                {description}
              </p>
            )}
          </div>
        )}
      </BaseMap>
    </div>
  );
}