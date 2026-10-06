import { ShieldCheck, Lock } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dms/ui";

export default function PermissionPage() {
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
          <span className="text-foreground font-semibold">{"Permissions & Roles"}</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{"Permissions & Roles"}</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Granular role-based access control and resource authorization matrices
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">Role Matrix</CardTitle>
                <Badge variant="secondary">RBAC</Badge>
              </div>
              <CardDescription className="mt-1">
                Configure resource-level permissions per user group.
              </CardDescription>
            </div>
            <div className="p-3 rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="size-5" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border p-8 text-center flex flex-col items-center justify-center">
            <Lock className="size-10 text-primary mb-3" />
            <h3 className="font-semibold text-lg">Permission Configuration Coming Soon</h3>
            <p className="text-sm text-muted-foreground max-w-md mt-1 mb-4">
              Detailed permission matrix editor is scheduled for Checkpoint 6. Basic roles (Admin and Staff) are enforced through organization policies.
            </p>
            <Button variant="outline" disabled>
              Configure Policy Rules (Placeholder)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
