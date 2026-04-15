import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Shield, Lock, AlertTriangle, Eye, EyeOff, AtSign } from "lucide-react";

export default function AdminLogin() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const loginMutation = useMutation({
    mutationFn: async (data: { identifier: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/admin-login", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      navigate("/admin");
    },
    onError: (err: any) => {
      setError(err.message || "Login failed. Please check your credentials.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!identifier.trim() || !password.trim()) {
      setError("Please enter both username and password.");
      return;
    }
    loginMutation.mutate({ identifier: identifier.trim(), password: password.trim() });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#072e1e' }} data-testid="admin-login-page">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/30">
            <Shield className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight" data-testid="text-admin-login-title">System Admin Portal</h1>
          <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>myProSys Platform Administration</p>
        </div>

        <Card className="border shadow-2xl" style={{ borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.06)' }}>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="flex items-center gap-2 rounded-lg p-3 text-sm" style={{ backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)', borderWidth: '1px', color: '#fca5a5' }} data-testid="text-admin-login-error">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>Email or Mobile Number</Label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-3 h-4 w-4" style={{ color: 'rgba(255,255,255,0.35)' }} />
                  <Input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="e.g. support@rgbindia.com"
                    className="pl-10 text-white placeholder:text-white/30 focus:ring-orange-500/20"
                    style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' }}
                    data-testid="input-admin-mobile"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4" style={{ color: 'rgba(255,255,255,0.35)' }} />
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="pl-10 pr-10 text-white placeholder:text-white/30 focus:ring-orange-500/20"
                    style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' }}
                    data-testid="input-admin-password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-3 h-4 w-4"
                    style={{ color: 'rgba(255,255,255,0.35)' }}
                    tabIndex={-1}
                    data-testid="button-toggle-admin-password"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium h-11"
                disabled={loginMutation.isPending}
                data-testid="button-admin-login"
              >
                {loginMutation.isPending ? "Signing in..." : "Sign In to Admin Portal"}
              </Button>
            </form>

            <div className="mt-6 pt-4 text-center" style={{ borderTopColor: 'rgba(255,255,255,0.1)', borderTopWidth: '1px' }}>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Only authorized System Administrators can access this portal.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
