/**
 * Optimized Image Component with Advanced Loading Strategies
 * Provides progressive loading, WebP support, and lazy loading
 */

import Image from 'next/image';
import { useState, useRef, useEffect, CSSProperties, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  style?: CSSProperties;
  priority?: boolean;
  quality?: number;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  sizes?: string;
  fill?: boolean;
  loading?: 'lazy' | 'eager';
  onLoad?: () => void;
  onError?: () => void;
  fallbackSrc?: string;
  progressive?: boolean;
  webpFallback?: boolean;
  lazyThreshold?: number;
  aspectRatio?: string;
}

/**
 * Generate blur data URL for placeholder
 */
const generateBlurDataURL = (width: number = 40, height: number = 40): string => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  
  // Create gradient blur effect
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#f3f4f6');
  gradient.addColorStop(0.5, '#e5e7eb');
  gradient.addColorStop(1, '#d1d5db');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  return canvas.toDataURL();
};

/**
 * Create responsive image sizes string
 */
const createResponsiveSizes = (width?: number): string => {
  if (!width) {
    return '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw';
  }
  
  return `(max-width: 768px) 100vw, ${width}px`;
};

/**
 * Progressive image loader component
 */
const ProgressiveImage: React.FC<{
  src: string;
  lowQualitySrc: string;
  alt: string;
  className?: string;
  onLoad?: () => void;
}> = ({ src, lowQualitySrc, alt, className, onLoad }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(lowQualitySrc);

  useEffect(() => {
    const img = new window.Image();
    img.src = src;
    img.onload = () => {
      setCurrentSrc(src);
      setIsLoaded(true);
      onLoad?.();
    };
  }, [src, onLoad]);

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <Image
        src={currentSrc}
        alt={alt}
        fill
        className={cn(
          "transition-all duration-300",
          !isLoaded && "blur-sm scale-110"
        )}
        style={{ objectFit: 'cover' }}
      />
      {!isLoaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 animate-pulse" />
      )}
    </div>
  );
};

/**
 * Main OptimizedImage component
 */
export const OptimizedImage = forwardRef<HTMLDivElement, OptimizedImageProps>(
  ({
    src,
    alt,
    width,
    height,
    className,
    style,
    priority = false,
    quality = 85,
    placeholder = 'blur',
    blurDataURL,
    sizes,
    fill = false,
    loading = 'lazy',
    onLoad,
    onError,
    fallbackSrc,
    progressive = false,
    webpFallback = true,
    lazyThreshold = 0.1,
    aspectRatio,
    ...props
  }, ref) => {
    const [hasError, setHasError] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isIntersecting, setIsIntersecting] = useState(priority);
    const imgRef = useRef<HTMLDivElement>(null);

    // Generate blur placeholder if not provided
    const blurPlaceholder = blurDataURL || (width && height ? generateBlurDataURL(width, height) : undefined);

    // Create responsive sizes
    const responsiveSizes = sizes || createResponsiveSizes(width);

    // Intersection Observer for lazy loading
    useEffect(() => {
      if (priority || loading === 'eager') {
        setIsIntersecting(true);
        return;
      }

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsIntersecting(true);
            observer.disconnect();
          }
        },
        {
          threshold: lazyThreshold,
          rootMargin: '50px',
        }
      );

      const element = imgRef.current;
      if (element) {
        observer.observe(element);
      }

      return () => observer.disconnect();
    }, [priority, loading, lazyThreshold]);

    // Handle image load
    const handleLoad = () => {
      setIsLoaded(true);
      onLoad?.();
    };

    // Handle image error
    const handleError = () => {
      setHasError(true);
      onError?.();
    };

    // Determine image source with WebP support
    const getImageSrc = (originalSrc: string): string => {
      if (!webpFallback) return originalSrc;
      
      // Check if browser supports WebP
      const supportsWebP = typeof window !== 'undefined' && 
        window.document.createElement('canvas').toDataURL('image/webp').indexOf('webp') > -1;
      
      if (supportsWebP && !originalSrc.includes('webp')) {
        // Convert to WebP if source supports it
        if (originalSrc.includes('unsplash.com') || originalSrc.includes('cloudinary.com')) {
          return `${originalSrc}&fm=webp`;
        }
      }
      
      return originalSrc;
    };

    const imageSrc = hasError && fallbackSrc ? fallbackSrc : getImageSrc(src);

    // Progressive loading
    if (progressive && width && height) {
      const lowQualitySrc = `${imageSrc}${imageSrc.includes('?') ? '&' : '?'}w=${Math.floor(width / 10)}&q=1`;
      
      return (
        <div
          ref={ref}
          className={className}
          style={{
            ...style,
            aspectRatio: aspectRatio || (width && height ? `${width}/${height}` : undefined),
          }}
        >
          <ProgressiveImage
            src={imageSrc}
            lowQualitySrc={lowQualitySrc}
            alt={alt}
            onLoad={handleLoad}
          />
        </div>
      );
    }

    // Container styles for aspect ratio
    const containerStyle: CSSProperties = {
      ...style,
      aspectRatio: aspectRatio || (width && height ? `${width}/${height}` : undefined),
    };

    return (
      <div
        ref={imgRef}
        className={cn(
          "relative overflow-hidden",
          !isLoaded && "bg-gray-200",
          className
        )}
        style={containerStyle}
        {...props}
      >
        {/* Loading placeholder */}
        {!isLoaded && isIntersecting && (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300">
            <div className="absolute inset-0 bg-gray-300 animate-pulse" />
          </div>
        )}

        {/* Main image */}
        {isIntersecting && (
          <Image
            src={imageSrc}
            alt={alt}
            width={!fill ? width : undefined}
            height={!fill ? height : undefined}
            fill={fill}
            quality={quality}
            priority={priority}
            placeholder={placeholder}
            blurDataURL={blurPlaceholder}
            sizes={responsiveSizes}
            className={cn(
              "transition-all duration-300",
              !isLoaded && "opacity-0 scale-105",
              isLoaded && "opacity-100 scale-100"
            )}
            style={{
              objectFit: fill ? 'cover' : undefined,
            }}
            onLoad={handleLoad}
            onError={handleError}
          />
        )}

        {/* Error fallback */}
        {hasError && !fallbackSrc && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="text-center text-gray-500">
              <svg
                className="w-12 h-12 mx-auto mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="text-sm">Image not available</p>
            </div>
          </div>
        )}
      </div>
    );
  }
);

OptimizedImage.displayName = 'OptimizedImage';

/**
 * Avatar component with optimizations
 */
export const OptimizedAvatar: React.FC<{
  src?: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  fallback?: string;
  className?: string;
}> = ({
  src,
  alt,
  size = 'md',
  fallback,
  className,
}) => {
  const sizeMap = {
    sm: 32,
    md: 48,
    lg: 64,
    xl: 96,
  };

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
  };

  const dimension = sizeMap[size];

  if (!src) {
    return (
      <div
        className={cn(
          "rounded-full bg-gray-300 flex items-center justify-center text-gray-600",
          sizeClasses[size],
          className
        )}
      >
        {fallback || alt.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={dimension}
      height={dimension}
      className={cn("rounded-full", sizeClasses[size], className)}
      quality={90}
      priority={size === 'lg' || size === 'xl'}
      fallbackSrc={`https://ui-avatars.com/api/?name=${encodeURIComponent(alt)}&size=${dimension}&background=e5e7eb&color=6b7280`}
    />
  );
};

/**
 * Gallery component with lazy loading
 */
export const OptimizedGallery: React.FC<{
  images: Array<{
    src: string;
    alt: string;
    caption?: string;
  }>;
  columns?: number;
  aspectRatio?: string;
  className?: string;
}> = ({
  images,
  columns = 3,
  aspectRatio = '1/1',
  className,
}) => {
  const [visibleCount, setVisibleCount] = useState(6);

  const loadMore = () => {
    setVisibleCount(prev => Math.min(prev + 6, images.length));
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        }}
      >
        {images.slice(0, visibleCount).map((image, index) => (
          <div key={index} className="group cursor-pointer">
            <OptimizedImage
              src={image.src}
              alt={image.alt}
              fill
              aspectRatio={aspectRatio}
              className="rounded-lg overflow-hidden group-hover:scale-105 transition-transform duration-200"
              priority={index < 3}
            />
            {image.caption && (
              <p className="mt-2 text-sm text-gray-600">{image.caption}</p>
            )}
          </div>
        ))}
      </div>

      {visibleCount < images.length && (
        <div className="text-center">
          <button
            onClick={loadMore}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Load More ({images.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Hero image component with optimizations
 */
export const OptimizedHeroImage: React.FC<{
  src: string;
  alt: string;
  overlay?: boolean;
  className?: string;
  children?: React.ReactNode;
}> = ({
  src,
  alt,
  overlay = false,
  className,
  children,
}) => {
  return (
    <div className={cn("relative", className)}>
      <OptimizedImage
        src={src}
        alt={alt}
        fill
        priority
        quality={95}
        className="object-cover"
        sizes="100vw"
      />
      
      {overlay && (
        <div className="absolute inset-0 bg-black bg-opacity-40" />
      )}
      
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
};

export default OptimizedImage;