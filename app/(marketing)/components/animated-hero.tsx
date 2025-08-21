"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function AnimatedHero() {
  return (
    <motion.div 
      className="text-center space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
        Your Ultimate <span className="text-primary">ECOSYSTEM</span> Marketplace
      </h1>
      <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
        Build faster, scale smarter, and focus on what matters most
      </p>
      <div className="flex justify-center gap-4 pt-6">
        <Button asChild size="lg" className="font-medium">
          <Link href="/dashboard">
            Get Started <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </motion.div>
  );
}
