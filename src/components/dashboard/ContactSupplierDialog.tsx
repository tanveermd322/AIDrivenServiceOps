import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Send, MapPin, Sprout } from "lucide-react";

export interface SupplierLite {
  supplierID: string | number;
  name: string;
  ingredient?: string;
  city?: string;
  continent?: string;
  size?: string;
  approved?: string;
}

interface Props {
  supplier: SupplierLite | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAction?: "contact" | "quote";
}

export const ContactSupplierDialog = ({ supplier, open, onOpenChange, defaultAction = "contact" }: Props) => {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  if (!supplier) return null;

  const handleSend = () => {
    toast({
      title: defaultAction === "quote" ? "Quote request sent" : "Message sent",
      description: `Your ${defaultAction === "quote" ? "quote request" : "message"} to ${supplier.name} has been queued.`,
    });
    setSubject("");
    setMessage("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {defaultAction === "quote" ? "Request a quote" : "Contact supplier"}
          </DialogTitle>
          <DialogDescription>
            Reach out directly to {supplier.name} via the bakehouse procurement channel.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border/60 bg-secondary/40 p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">{supplier.name}</p>
            {supplier.approved === "Y" ? (
              <Badge variant="outline" className="border-success/40 text-success text-[10px]">
                Approved
              </Badge>
            ) : (
              <Badge variant="outline" className="border-warning/40 text-warning text-[10px]">
                Pending
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {supplier.ingredient && (
              <span className="inline-flex items-center gap-1 capitalize">
                <Sprout className="h-3 w-3" /> {supplier.ingredient}
              </span>
            )}
            {(supplier.city || supplier.continent) && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {supplier.city}
                {supplier.continent ? `, ${supplier.continent}` : ""}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              placeholder={defaultAction === "quote" ? "Quote request — bulk order" : "Partnership inquiry"}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              rows={5}
              placeholder={
                defaultAction === "quote"
                  ? `Hi ${supplier.name}, we'd like a quote for ${supplier.ingredient ?? "your products"}…`
                  : "Hello, we'd love to discuss a potential partnership…"
              }
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} className="bg-gradient-brand hover:opacity-95">
            <Send className="h-4 w-4" />
            {defaultAction === "quote" ? "Send request" : "Send message"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
