import { CreditCard, Sparkles } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dms/ui";

export default function BillingPage() {
  return (
    <div className="space-y-5 max-w-4xl animate-slideInUp">
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <span className="hover:text-primary transition-colors cursor-pointer">
            Dashboard
          </span>
          <span>/</span>
          <span className="text-muted-foreground">Admin</span>
          <span>/</span>
          <span className="text-foreground font-semibold">Billing &amp; Plans</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Billing &amp; Plans</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Subscription management, billing tiers, and invoicing records
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">Subscription Overview</CardTitle>
                <Badge variant="secondary">Enterprise</Badge>
              </div>
              <CardDescription className="mt-1">
                Active tenant license and distribution node tier.
              </CardDescription>
            </div>
            <div className="p-3 rounded-full bg-primary/10 text-primary">
              <CreditCard className="size-5" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border p-8 text-center flex flex-col items-center justify-center">
            <Sparkles className="size-10 text-primary mb-3" />
            <h3 className="font-semibold text-lg">Billing Management Coming Soon</h3>
            <p className="text-sm text-muted-foreground max-w-md mt-1 mb-4">
              Billing and subscription self-service is scheduled for an upcoming release. Your enterprise account is currently in good standing.
            </p>
            <Button variant="outline" disabled>
              Manage Payment Methods (Placeholder)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
