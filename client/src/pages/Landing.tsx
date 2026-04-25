import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Activity, ShieldCheck, HeartPulse, Stethoscope, Phone, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

export default function Landing() {
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!mobile.trim()) {
      setError("Please enter your mobile number");
      return;
    }
    if (!password) {
      setError("Please enter your password");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mobile: mobile.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Login failed");
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      window.location.href = "/";
    } catch (err) {
      setError("Connection error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      <div className="lg:w-1/2 p-8 lg:p-16 flex flex-col justify-between relative overflow-hidden bg-primary text-white">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-accent blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="bg-white/10 p-2 rounded-xl backdrop-blur-sm">
              <Activity className="w-8 h-8 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight">RGB Hospital CRM</span>
          </div>

          <div className="space-y-6 max-w-lg">
            <h1 className="text-5xl font-bold leading-tight font-sans">
              Transforming <span className="text-accent">Patient Care</span> Relationships
            </h1>
            <p className="text-lg text-blue-100 leading-relaxed">
              The intelligent Hospital CRM platform by RGB Technologies. Manage leads, appointments, and patient lifecycles with surgical precision.
            </p>
          </div>
        </div>

        <div className="relative z-10 mt-12 grid grid-cols-2 gap-6">
          <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/10">
            <ShieldCheck className="w-6 h-6 text-accent mb-3" />
            <h3 className="font-semibold">SLA Tracking</h3>
            <p className="text-sm text-blue-100 opacity-80">Never miss a patient follow-up.</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/10">
            <HeartPulse className="w-6 h-6 text-accent mb-3" />
            <h3 className="font-semibold">Lifecycle Mgmt</h3>
            <p className="text-sm text-blue-100 opacity-80">From lead to recovery.</p>
          </div>
        </div>

        <div className="relative z-10 mt-auto pt-12">
           <p className="text-xs text-blue-200">© 2024 RGB Technologies. All rights reserved.</p>
        </div>
      </div>

      <div className="lg:w-1/2 flex items-center justify-center p-8 bg-white relative">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900" data-testid="text-login-title">Welcome Back</h2>
            <p className="mt-2 text-gray-500">Sign in to your workspace</p>
          </div>

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm" data-testid="text-login-error">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="mobile" className="text-sm font-medium text-gray-700">Mobile Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="mobile"
                  type="tel"
                  placeholder="Enter your mobile number"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="pl-10 h-12"
                  data-testid="input-mobile"
                  autoComplete="tel"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-12"
                  data-testid="input-password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 text-lg font-medium bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 transition-all duration-300 hover:-translate-y-1"
              data-testid="button-login"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>

            <div className="text-right">
              <Link href="/forgot-password" className="text-sm text-primary hover:underline" data-testid="link-forgot-password">
                Forgot Password?
              </Link>
            </div>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Secure Hospital Access</span>
            </div>
          </div>

          <div className="bg-muted p-4 rounded-lg flex items-start gap-3">
            <Stethoscope className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-foreground">Need Help?</h4>
              <p className="text-xs text-muted-foreground mt-1">Contact your administrator if you need access or forgot your password.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
