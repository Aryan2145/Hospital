import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Activity, Phone, ArrowLeft, Loader2, CheckCircle } from "lucide-react";
import { Link } from "wouter";

export default function ForgotPassword() {
  const [mobile, setMobile] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");
  const [sentPhone, setSentPhone] = useState("");
  const [sentChannel, setSentChannel] = useState<"sms" | "email" | "none">("none");

  const { data: tenant } = useQuery<any>({
    queryKey: ["/api/tenants/current"],
  });

  const hospitalName = tenant?.displayName || tenant?.name || "Hospital CRM";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!mobile.trim()) {
      setError("Please enter your mobile number");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: mobile.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Something went wrong");
        return;
      }

      setSent(true);
      if (data.email) setSentEmail(data.email);
      if (data.phone) setSentPhone(data.phone);
      if (data.channel) setSentChannel(data.channel);
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
            {tenant?.logoUrl ? (
              <img src={tenant.logoUrl} alt={hospitalName} className="h-10 w-auto rounded-lg" />
            ) : (
              <div className="bg-white/10 p-2 rounded-xl backdrop-blur-sm">
                <Activity className="w-8 h-8 text-white" />
              </div>
            )}
            <span className="text-2xl font-bold tracking-tight">{hospitalName}</span>
          </div>
          <div className="space-y-6 max-w-lg">
            <h1 className="text-4xl font-bold leading-tight">Password Recovery</h1>
            <p className="text-lg text-blue-100 leading-relaxed">
              Enter your registered mobile number and we'll send a password reset link to your registered mobile number via SMS.
            </p>
          </div>
        </div>
        <div className="relative z-10 mt-auto pt-12">
          <p className="text-xs text-blue-200">&copy; {new Date().getFullYear()} {hospitalName}. All rights reserved.</p>
        </div>
      </div>

      <div className="lg:w-1/2 flex items-center justify-center p-8 bg-white relative">
        <div className="max-w-md w-full space-y-8">
          {sent ? (
            <div className="text-center space-y-6">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900" data-testid="text-reset-sent">
                {sentChannel === "sms" ? "Check Your Phone" : sentChannel === "email" ? "Check Your Email" : "Reset Link Sent"}
              </h2>
              <p className="text-gray-500">
                {sentChannel === "sms" && sentPhone
                  ? <>A password reset link has been sent to your registered mobile number <strong className="text-gray-700">{sentPhone}</strong>.</>
                  : sentEmail
                    ? <>We have sent a Password Reset Link to <strong className="text-gray-700">{sentEmail}</strong>.</>
                    : "If an account with that mobile number exists, a reset link has been sent."
                }
              </p>
              <p className="text-sm text-gray-400">The link will expire in 1 hour.</p>
              <Link href="/">
                <Button variant="outline" className="mt-4" data-testid="button-back-to-login">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Login
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center">
                <h2 className="text-3xl font-bold text-gray-900" data-testid="text-forgot-title">Forgot Password</h2>
                <p className="mt-2 text-gray-500">Enter your mobile number to receive a reset link</p>
              </div>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm" data-testid="text-forgot-error">
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
                      placeholder="Enter your registered mobile number"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      className="pl-10 h-12"
                      data-testid="input-forgot-mobile"
                      autoComplete="tel"
                      autoFocus
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 text-lg font-medium bg-primary hover:bg-primary/90"
                  data-testid="button-send-reset"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </Button>

                <div className="text-center">
                  <Link href="/" className="text-sm text-primary hover:underline inline-flex items-center gap-1" data-testid="link-back-to-login">
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to Login
                  </Link>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
