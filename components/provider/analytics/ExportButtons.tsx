"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export function ExportButtons() {
  const handleExportCSV = () => {
    // TODO: Implement CSV export
    console.log("Exporting CSV...");
  };

  const handleExportPDF = () => {
    // TODO: Implement PDF export
    console.log("Exporting PDF...");
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={handleExportCSV}>
        <Download className="mr-2 h-4 w-4" />
        Export CSV
      </Button>
      <Button variant="outline" size="sm" onClick={handleExportPDF}>
        <Download className="mr-2 h-4 w-4" />
        Export PDF
      </Button>
    </div>
  );
}