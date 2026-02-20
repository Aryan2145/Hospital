import { Button } from "@/components/ui/button";
import { Activity, ShieldCheck, HeartPulse, Stethoscope } from "lucide-react";
import heroImg from "@assets/viroc-hero.jpg"; // Placeholder, assuming static asset exists or will fail gracefully

// Using an Unsplash image as a fallback for the hero if asset is missing
const HERO_IMAGE_URL = "https://images.unsplash.com/photo-1516549655169-df83a063b36c?q=80&w=2070&auto=format&fit=crop";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Left Panel: Branding */}
      <div className="lg:w-1/2 p-8 lg:p-16 flex flex-col justify-between relative overflow-hidden bg-primary text-white">
        {/* Abstract Background Pattern */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-accent blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="bg-white/10 p-2 rounded-xl backdrop-blur-sm">
              <Activity className="w-8 h-8 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight">VIROC CRM</span>
          </div>

          <div className="space-y-6 max-w-lg">
            <h1 className="text-5xl font-bold leading-tight font-sans">
              Transforming <span className="text-accent">Patient Care</span> Relationships
            </h1>
            <p className="text-lg text-blue-100 leading-relaxed">
              The intelligent CRM platform designed for modern hospitals. Manage leads, appointments, and patient lifecycles with surgical precision.
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
           <p className="text-xs text-blue-200">© 2024 Viroc Hospital. All rights reserved.</p>
        </div>
      </div>

      {/* Right Panel: Login */}
      <div className="lg:w-1/2 flex items-center justify-center p-8 bg-white relative">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">Welcome Back</h2>
            <p className="mt-2 text-gray-500">Sign in to your workspace</p>
          </div>

          <div className="mt-8 space-y-4">
            <Button 
              onClick={handleLogin}
              className="w-full h-12 text-lg font-medium bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 transition-all duration-300 hover:-translate-y-1"
            >
              Log In with Replit Auth
            </Button>
            
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
                <p className="text-xs text-muted-foreground mt-1">Contact IT support if you are having trouble accessing your account.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
