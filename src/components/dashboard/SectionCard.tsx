import { Card } from "@/components/ui/card";
import { ReactNode } from "react";

interface SectionCardProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export const SectionCard = ({ title, description, action, children, className }: SectionCardProps) => {
  return (
    <Card className={`border-border/60 shadow-sm ${className ?? ""}`}>
      <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border/60">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </Card>
  );
};
