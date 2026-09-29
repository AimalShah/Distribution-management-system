"use client";
import {
  previewInvoice,
  printInvoice,
  generateInvoicePDF,
} from "@/actions/invoices";
import { Button } from "../ui/button";
import { Download, Eye, Printer } from "lucide-react";
import { toast } from "sonner";

interface InvoiceActionButtonProps {
  saleCode: string;
  action: "download" | "print" | "preview";
  className?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "lg";
  title?: string;
}

export default function SaleInvoiceActionButton({
  saleCode,
  action,
  className,
  variant = "default",
  size = "default",
  title,
}: InvoiceActionButtonProps) {
  const handleAction = async () => {
    toast.promise(
      (async () => {
        if (action === "download") {
          const res = await generateInvoicePDF(saleCode);
          if (!res.success) {
            throw new Error(res.message || "Failed to generate invoice");
          }

          const byteArray = new Uint8Array(res.pdf.split(",").map(Number));
          const blob = new Blob([byteArray], { type: "application/pdf" });

          const url = URL.createObjectURL(blob);

          const link = document.createElement("a");
          link.href = url;
          link.download = `invoice-${res.saleCode}.pdf`;
          link.click();
          URL.revokeObjectURL(url);

          return res;
        }

        if (action === "print") {
          const res = await printInvoice(saleCode);
          if (!res.success) {
            throw new Error(res.message || "Failed to prepare print");
          }

          const printWindow = window.open("", "_blank");
          if (printWindow) {
            printWindow.document.write(res.html);
            printWindow.document.close();
            printWindow.focus();
          }
          return res;
        }

        if (action === "preview") {
          const res = await previewInvoice(saleCode);
          if (!res.success) {
            throw new Error(res.message || "Failed to preview invoice");
          }

          const previewWindow = window.open("", "_blank");
          if (previewWindow) {
            previewWindow.document.write(res.html);
            previewWindow.document.close();
            previewWindow.focus();
          }
          return res;
        }
      })(),
      {
        loading: `${title || action} in progress...`,
        success: (data) => `Invoice ${data?.saleCode} ready!`,
        error: (err) => err.message || `Failed to ${action} invoice`,
      }
    );
  };

  const getIcon = () => {
    switch (action) {
      case "download":
        return <Download className="w-4 h-4" />;
      case "print":
        return <Printer className="w-4 h-4" />;
      case "preview":
        return <Eye className="w-4 h-4" />;
    }
  };

  return (
    <Button
      className={className}
      onClick={handleAction}
      disabled={!saleCode}
      variant={variant}
      size={size}
      title={title || action}
    >
      {getIcon()}
      <span className="capitalize">{title || action}</span>
    </Button>
  );
}
