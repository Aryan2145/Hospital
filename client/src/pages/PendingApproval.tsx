import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, LogOut, Activity, ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function PendingApproval() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center">
            <Activity className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-xl" data-testid="text-pending-title">VIROC CRM</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="text-lg font-semibold text-foreground" data-testid="text-pending-heading">
              Account Pending Approval
            </h3>
            <p className="text-sm text-muted-foreground">
              You've signed in as <strong>{user?.email}</strong>, but your account hasn't been linked to a CRM user profile yet.
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>What happens next?</span>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
              <li>An administrator will create a CRM user profile for you</li>
              <li>Your login email will be matched to your CRM profile</li>
              <li>Once linked, you'll have access based on your assigned role</li>
            </ul>
          </div>

          <div className="text-center text-xs text-muted-foreground">
            Contact your hospital administrator to get access.
          </div>

          <Button
            variant="outline"
            onClick={() => logout()}
            className="w-full"
            data-testid="button-logout-pending"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
