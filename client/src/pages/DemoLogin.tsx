import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Activity, Phone, Lock, Eye, EyeOff, Loader2, FlaskConical } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const DEMO_USERS = [
  { role: "Admin",               mobile: "4000400100", name: "Rajesh Admin Sharma" },
  { role: "Manager",             mobile: "4000400102", name: "Sanjay Manager Verma" },
  { role: "Counsellor",          mobile: "4000400104", name: "Vikram Counsellor Singh" },
  { role: "Patient Coordinator", mobile: "4000400106", name: "Amit PC Joshi" },
  { role: "Telecaller",          mobile: "4000400108", name: "Rahul TC Yadav" },
  { role: "Receptionist",        mobile: "4000400110", name: "Anita Rec Gupta" },
  { role: "Doctor",              mobile: "4000400112", name: "Dr. Vikas Kapoor" },
  { role: "Medical Assistant",   mobile: "4000400120", name: "Sunita MA Kapoor" },
  { role: "Billing",             mobile: "4000400128", name: "Suresh Billing Kumar" },
  { role: "Insurance Desk",      mobile: "4000400129", name: "Kavitha Insurance Nair" },
  { role: "MIS Viewer",          mobile: "4000400130", name: "Ashok MIS Trivedi" },
];

export default function DemoLogin() {
  const [mobile, setMobile]       = useState("4000400100");
  const [password, setPassword]   = useState("HCRM@RGBTech");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]         = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!mobile.trim() || !password) { setError("Both fields are required"); return; }
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/demo-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mobile: mobile.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Login failed"); return; }
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      window.location.href = "/";
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Left panel */}
      <div className="lg:w-1/2 p-8 lg:p-16 flex flex-col justify-between relative overflow-hidden bg-violet-700 text-white">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-violet-300 blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="bg-white/10 p-2 rounded-xl">
              <FlaskConical className="w-7 h-7 text-white" />
            </div>
            <span className="text-xl font-bold">RGB Hospital CRM — Demo</span>
          </div>

          <div className="space-y-4 max-w-lg mb-10">
            <h1 className="text-4xl font-bold leading-tight">
              Explore the Platform <span className="text-violet-200">Live</span>
            </h1>
            <p className="text-violet-200 leading-relaxed">
              This is a fully seeded demo environment with 1,050 sample patient leads,
              368 treatment episodes, 31 CRM users across all roles, and a complete
              hospital workflow. Data resets on demand — explore freely.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-violet-200 uppercase tracking-wider mb-3">
              Available Demo Users
            </p>
            {DEMO_USERS.map(u => (
              <button
                key={u.mobile}
                type="button"
                className="w-full text-left flex items-center justify-between bg-white/10 hover:bg-white/20 rounded-lg px-4 py-2.5 transition-colors group"
                onClick={() => { setMobile(u.mobile); setPassword("HCRM@RGBTech"); setError(""); }}
                data-testid={`demo-user-${u.mobile}`}
              >
                <div>
                  <span className="text-sm font-medium text-white">{u.name}</span>
                  <span className="text-xs text-violet-300 ml-2">({u.role})</span>
                </div>
                <span className="text-xs text-violet-300 font-mono group-hover:text-white">{u.mobile}</span>
              </button>
            ))}
            <p className="text-xs text-violet-300 mt-2">Password for all: <code className="bg-white/10 px-1.5 py-0.5 rounded">HCRM@RGBTech</code></p>
          </div>
        </div>

        <div className="relative z-10 mt-8">
          <p className="text-xs text-violet-300">
            RGB Hospital CRM · Demo environment · Data resets periodically
          </p>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-8">
            <Activity className="w-6 h-6 text-violet-600" />
            <span className="text-lg font-semibold text-slate-800">Demo Login</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-1">Sign in to the demo</h2>
          <p className="text-slate-500 text-sm mb-8">
            Select a user on the left or enter credentials manually. All demo passwords are <code className="bg-slate-100 px-1 rounded text-xs">HCRM@RGBTech</code>.
          </p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <Label htmlFor="demo-mobile" className="text-sm font-medium text-slate-700">
                Mobile Number
              </Label>
              <div className="relative mt-1">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="demo-mobile"
                  type="tel"
                  value={mobile}
                  onChange={e => setMobile(e.target.value)}
                  className="pl-10"
                  placeholder="e.g. 4000400100"
                  autoComplete="tel"
                  data-testid="input-demo-mobile"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="demo-password" className="text-sm font-medium text-slate-700">
                Password
              </Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="demo-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  placeholder="Enter password"
                  data-testid="input-demo-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPassword(v => !v)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700" data-testid="text-demo-login-error">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-violet-700 hover:bg-violet-800 text-white h-11"
              disabled={isLoading}
              data-testid="button-demo-login"
            >
              {isLoading
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in…</>
                : "Sign In to Demo"}
            </Button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-6">
            Looking for your hospital? Go to{" "}
            <a href="/" className="text-violet-600 hover:underline">the main login page</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
