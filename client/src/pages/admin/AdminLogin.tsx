import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Shield, Phone, Lock, AlertTriangle } from "lucide-react";

export default function AdminLogin() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const loginMutation = useMutation({
    mutationFn: async (data: { mobile: string; password: string }) => {
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
    if (!mobile.trim() || !password.trim()) {
      setError("Please enter both mobile number and password.");
      return;
    }
    loginMutation.mutate({ mobile: mobile.trim(), password: password.trim() });
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4" data-testid="admin-login-page">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/30">
            <Shield className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight" data-testid="text-admin-login-title">System Admin Portal</h1>
          <p className="text-slate-400 mt-2 text-sm">myProSys Platform Administration</p>
        </div>

        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur shadow-2xl">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300" data-testid="text-admin-login-error">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-slate-300 text-sm font-medium">Mobile Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <Input
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="e.g. 9033050100"
                    className="pl-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-orange-500 focus:ring-orange-500/20"
                    data-testid="input-admin-mobile"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300 text-sm font-medium">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="pl-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-orange-500 focus:ring-orange-500/20"
                    data-testid="input-admin-password"
                  />
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

            <div className="mt-6 pt-4 border-t border-slate-700 text-center">
              <p className="text-xs text-slate-500">
                Only authorized System Administrators can access this portal.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
