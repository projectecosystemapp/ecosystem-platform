"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Share2,
  Facebook,
  Twitter,
  Linkedin,
  Link2,
  Mail,
  MessageCircle,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

interface ShareButtonsProps {
  url: string;
  title: string;
  description?: string;
}

export default function ShareButtons({ url, title, description }: ShareButtonsProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const shareLinks = [
    {
      name: "Facebook",
      icon: Facebook,
      color: "hover:bg-blue-600 hover:text-white",
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    },
    {
      name: "Twitter",
      icon: Twitter,
      color: "hover:bg-sky-500 hover:text-white",
      url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
    },
    {
      name: "LinkedIn",
      icon: Linkedin,
      color: "hover:bg-blue-700 hover:text-white",
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    },
    {
      name: "WhatsApp",
      icon: MessageCircle,
      color: "hover:bg-green-600 hover:text-white",
      url: `https://wa.me/?text=${encodeURIComponent(`${title} - ${url}`)}`,
    },
    {
      name: "Email",
      icon: Mail,
      color: "hover:bg-gray-600 hover:text-white",
      url: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(
        `${description || title}\n\n${url}`
      )}`,
    },
  ];

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({
        title: "Link copied!",
        description: "The profile link has been copied to your clipboard.",
      });
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description || title,
          url,
        });
      } catch (error) {
        // User cancelled or error occurred
        console.log("Share cancelled or failed:", error);
      }
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Share2 className="h-5 w-5" />
          Share Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Native Share Button (if supported) */}
        {typeof window !== "undefined" && "share" in navigator && (
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleNativeShare}
          >
            <Share2 className="mr-2 h-4 w-4" />
            Share via...
          </Button>
        )}

        {/* Social Share Buttons */}
        <div className="grid grid-cols-3 gap-2">
          {shareLinks.slice(0, 3).map((link) => (
            <motion.a
              key={link.name}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={cn(
                "flex flex-col items-center justify-center p-3 rounded-lg border transition-colors",
                link.color
              )}
              aria-label={`Share on ${link.name}`}
            >
              <link.icon className="h-5 w-5 mb-1" />
              <span className="text-xs">{link.name}</span>
            </motion.a>
          ))}
        </div>

        {/* More Options Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              More sharing options
              <Share2 className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="space-y-2">
              {shareLinks.slice(3).map((link) => (
                <a
                  key={link.name}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 transition-colors",
                    link.color
                  )}
                >
                  <link.icon className="h-4 w-4" />
                  <span className="text-sm">{link.name}</span>
                </a>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Copy Link Button */}
        <Button
          variant="outline"
          className="w-full justify-between"
          onClick={handleCopyLink}
        >
          <span className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Copy link
          </span>
          {copied && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1 text-green-600"
            >
              <Check className="h-4 w-4" />
              Copied!
            </motion.span>
          )}
        </Button>

        {/* QR Code Section (optional) */}
        <div className="pt-4 border-t">
          <p className="text-sm text-gray-600 text-center mb-3">
            Scan to share
          </p>
          <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-center">
            <div className="w-32 h-32 bg-white rounded flex items-center justify-center">
              {/* You could integrate a QR code library here */}
              <span className="text-xs text-gray-400">QR Code</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}