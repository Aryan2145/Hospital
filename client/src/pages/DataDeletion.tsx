import { ArrowLeft, Trash2, CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

export default function DataDeletion() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [form, setForm] = useState({
    fullName: "",
    mobileNumber: "",
    email: "",
    hospitalOrTenantName: "",
    approximateInteractionDate: "",
    sourceOfInteraction: "",
    requestDescription: "",
    consentConfirmation: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      const res = await fetch("/api/public/data-deletion-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.errors) setErrors(data.errors);
        else toast({ title: "Error", description: data.message, variant: "destructive" });
        return;
      }
      setReferenceNumber(data.referenceNumber);
    } catch {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white" data-testid="data-deletion-page">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
          data-testid="button-back-home"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
            <Trash2 className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground" data-testid="text-data-deletion-title">Data Deletion Instructions</h1>
            <p className="text-sm text-muted-foreground">RGB-HCRM — RGB Business Growth Consulting</p>
          </div>
        </div>

        <div className="text-sm text-muted-foreground mb-10 space-y-0.5">
          <p><span className="font-medium text-foreground">Website:</span> rgbindia.com</p>
          <p><span className="font-medium text-foreground">Contact Email:</span>{" "}<a href="mailto:tech@rgbindia.com" className="text-primary hover:underline">tech@rgbindia.com</a></p>
          <p><span className="font-medium text-foreground">Address:</span> 804, Avadh Kontina, VIP Road, Vesu, Surat, Gujarat, India</p>
        </div>

        <div className="prose prose-slate max-w-none space-y-8 text-muted-foreground leading-relaxed">

          <Section title="1. Introduction">
            <p>
              RGB-HCRM respects the privacy of users, patients, hospital staff, partners, and individuals whose information may be captured through our CRM platform, website forms, Meta/Facebook Lead Ads, WhatsApp communication, phone calls, campaigns, appointment systems, or other connected channels.
            </p>
            <p>This page explains how you can request deletion of your personal data from RGB-HCRM.</p>
          </Section>

          <Section title="2. What Data May Be Stored in RGB-HCRM">
            <p>
              Depending on how you interacted with a hospital, clinic, campaign, form, or communication channel connected to RGB-HCRM, the following information may be stored:
            </p>
            <ul>
              <li>Name</li>
              <li>Mobile number</li>
              <li>Email address</li>
              <li>City, area, or location details</li>
              <li>Enquiry details</li>
              <li>Appointment details</li>
              <li>Campaign/source information</li>
              <li>WhatsApp or communication history</li>
              <li>Call-related information</li>
              <li>Patient journey or follow-up details</li>
              <li>Uploaded documents, where applicable</li>
              <li>Other information voluntarily submitted by you</li>
            </ul>
            <p>RGB-HCRM is used by hospitals and healthcare organizations to manage enquiries, appointments, patient coordination, follow-ups, and related operational workflows.</p>
          </Section>

          <Section title="3. How to Request Data Deletion">
            <p>To request deletion of your personal data, please send an email to:</p>
            <p className="font-medium text-foreground"><a href="mailto:tech@rgbindia.com" className="text-primary hover:underline">tech@rgbindia.com</a></p>
            <p>Use the subject line: <span className="font-medium text-foreground">Data Deletion Request – RGB-HCRM</span></p>
            <p>Please include the following details in your email:</p>
            <ul>
              <li>Full name</li>
              <li>Mobile number</li>
              <li>Email address used while submitting the enquiry</li>
              <li>Name of the hospital/clinic you interacted with, if known</li>
              <li>Approximate date of enquiry or interaction</li>
              <li>Source of enquiry, if known (e.g., Facebook, Instagram, WhatsApp, website form, phone call, walk-in, campaign, etc.)</li>
              <li>A clear statement requesting deletion of your personal data</li>
            </ul>
            <p>Alternatively, you can use the online request form below to submit your request directly.</p>
          </Section>

          <Section title="4. Verification Before Deletion">
            <p>For your protection, we may verify your identity before processing the deletion request.</p>
            <p>Verification may include matching your request with the mobile number, email address, lead record, patient record, or other details available in RGB-HCRM.</p>
            <p>We may contact you for additional clarification if the information provided is insufficient to identify the correct record.</p>
          </Section>

          <Section title="5. Processing Timeline">
            <p>Once we receive a valid and verified data deletion request, we will review and process it within a reasonable period.</p>
            <p>Our usual processing timeline is: <span className="font-medium text-foreground">7 to 30 working days</span> from the date of successful verification.</p>
            <p>In some cases, the request may take longer if the data is connected with hospital records, billing records, legal records, insurance documentation, or compliance-related obligations.</p>
          </Section>

          <Section title="6. What Happens After a Deletion Request">
            <p>Based on the nature of the data and applicable obligations, we may take one or more of the following actions:</p>
            <ul>
              <li>Delete personal data that is no longer required</li>
              <li>Anonymize personal identifiers where full deletion is not appropriate</li>
              <li>Deactivate or restrict further use of the record</li>
              <li>Retain limited information where legally, medically, financially, or operationally required</li>
              <li>Stop further marketing or follow-up communication, where applicable</li>
            </ul>
          </Section>

          <Section title="7. Records That May Not Be Fully Deleted">
            <p>
              As RGB-HCRM is used in a healthcare and hospital environment, some records may need to be retained for legitimate reasons. Certain data may not be fully deleted where retention is required for:
            </p>
            <ul>
              <li>Medical or healthcare records</li>
              <li>Appointment history</li>
              <li>Billing or payment records</li>
              <li>Insurance-related records</li>
              <li>Consent records</li>
              <li>Legal or regulatory compliance</li>
              <li>Audit requirements</li>
              <li>Fraud prevention or dispute handling</li>
              <li>Hospital policy or statutory retention obligations</li>
            </ul>
            <p>In such cases, we may restrict, archive, anonymize, or retain the data with an appropriate reason.</p>
          </Section>

          <Section title="8. Data Received from Meta/Facebook or Instagram">
            <p>
              If your data was submitted through a Facebook or Instagram lead form or advertisement connected with RGB-HCRM, you may request deletion of the information stored in RGB-HCRM by following the process mentioned above.
            </p>
            <p>
              Please note that deleting data from RGB-HCRM does not automatically delete your data from Meta/Facebook/Instagram systems. To manage or delete data stored directly by Meta, you should use the privacy settings and tools provided by Meta.
            </p>
          </Section>

          <Section title="9. Data Received Through WhatsApp">
            <p>
              If your information was received through WhatsApp communication connected with a hospital using RGB-HCRM, you may request deletion or restriction of that data from RGB-HCRM.
            </p>
            <p>
              Please note that WhatsApp messages or records stored independently by WhatsApp, Meta, or the hospital's own WhatsApp provider may be governed by their respective privacy policies and systems.
            </p>
          </Section>

          <Section title="10. Confirmation of Deletion">
            <p>After your request is processed, we will send a confirmation to the email address or mobile number provided by you.</p>
            <p>The confirmation may state whether your data has been:</p>
            <ul>
              <li>Deleted</li>
              <li>Anonymized</li>
              <li>Restricted</li>
              <li>Retained due to legal, medical, billing, or compliance reasons</li>
            </ul>
          </Section>

          <Section title="11. Contact for Data Deletion Requests">
            <p>For all data deletion requests, please contact:</p>
            <div className="mt-2 space-y-0.5 not-prose">
              <p><span className="font-medium text-foreground">Company:</span> RGB Business Growth Consulting</p>
              <p><span className="font-medium text-foreground">Email:</span> <a href="mailto:tech@rgbindia.com" className="text-primary hover:underline">tech@rgbindia.com</a></p>
              <p><span className="font-medium text-foreground">Website:</span> <a href="https://rgbindia.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">rgbindia.com</a></p>
              <p><span className="font-medium text-foreground">Address:</span> 804, Avadh Kontina, VIP Road, Vesu, Surat, Gujarat, India</p>
            </div>
          </Section>

          <Section title="12. Related Pages">
            <p>Please also refer to:</p>
            <ul>
              <li><a href="/privacy-policy" className="text-primary hover:underline">Privacy Policy</a></li>
              <li><a href="/terms" className="text-primary hover:underline">Terms &amp; Conditions</a></li>
            </ul>
          </Section>

        </div>

        {/* Online Request Form */}
        <div className="mt-14 border-t pt-10">
          <h2 className="text-2xl font-bold text-foreground mb-2">Submit a Data Deletion Request Online</h2>
          <p className="text-muted-foreground text-sm mb-8">
            Fill in the form below to submit your data deletion request. You will receive a unique reference number upon submission.
          </p>

          {referenceNumber ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center" data-testid="success-panel">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-green-800 mb-2">Request Submitted Successfully</h3>
              <p className="text-green-700 text-sm mb-4">Your data deletion request has been received and is under review.</p>
              <div className="inline-block bg-white border border-green-300 rounded-lg px-6 py-3">
                <p className="text-xs text-muted-foreground">Your Reference Number</p>
                <p className="text-2xl font-bold text-foreground tracking-wider" data-testid="reference-number">{referenceNumber}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-4">Please save this reference number. We will send a confirmation to your email or mobile when the request is processed (7–30 working days).</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl" data-testid="deletion-form">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fullName">Full Name <span className="text-destructive">*</span></Label>
                  <Input id="fullName" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} placeholder="Your full name" data-testid="input-full-name" />
                  {errors.fullName && <p className="text-destructive text-xs mt-1">{errors.fullName}</p>}
                </div>
                <div>
                  <Label htmlFor="mobileNumber">Mobile Number</Label>
                  <Input id="mobileNumber" value={form.mobileNumber} onChange={e => setForm(f => ({ ...f, mobileNumber: e.target.value }))} placeholder="+91 98765 43210" data-testid="input-mobile" />
                  {errors.mobileNumber && <p className="text-destructive text-xs mt-1">{errors.mobileNumber}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="you@example.com" data-testid="input-email" />
                  {errors.email && <p className="text-destructive text-xs mt-1">{errors.email}</p>}
                </div>
                <div>
                  <Label htmlFor="hospitalOrTenantName">Hospital / Clinic Name</Label>
                  <Input id="hospitalOrTenantName" value={form.hospitalOrTenantName} onChange={e => setForm(f => ({ ...f, hospitalOrTenantName: e.target.value }))} placeholder="Name of hospital, if known" data-testid="input-hospital" />
                </div>
              </div>
              {errors.contact && <p className="text-destructive text-xs -mt-3">{errors.contact}</p>}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="approximateInteractionDate">Approximate Date of Interaction</Label>
                  <Input id="approximateInteractionDate" value={form.approximateInteractionDate} onChange={e => setForm(f => ({ ...f, approximateInteractionDate: e.target.value }))} placeholder="e.g. March 2025" data-testid="input-date" />
                </div>
                <div>
                  <Label htmlFor="sourceOfInteraction">Source of Interaction</Label>
                  <Input id="sourceOfInteraction" value={form.sourceOfInteraction} onChange={e => setForm(f => ({ ...f, sourceOfInteraction: e.target.value }))} placeholder="e.g. Facebook, WhatsApp, phone call" data-testid="input-source" />
                </div>
              </div>

              <div>
                <Label htmlFor="requestDescription">Data Deletion Request <span className="text-destructive">*</span></Label>
                <Textarea id="requestDescription" value={form.requestDescription} onChange={e => setForm(f => ({ ...f, requestDescription: e.target.value }))} placeholder="Please describe your request clearly. e.g. I would like all my personal information — name, mobile number, email address, and enquiry details — to be deleted from your system." rows={4} data-testid="input-description" />
                {errors.requestDescription && <p className="text-destructive text-xs mt-1">{errors.requestDescription}</p>}
              </div>

              <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg border">
                <Checkbox
                  id="consent"
                  checked={form.consentConfirmation}
                  onCheckedChange={checked => setForm(f => ({ ...f, consentConfirmation: !!checked }))}
                  data-testid="checkbox-consent"
                />
                <Label htmlFor="consent" className="text-sm leading-relaxed cursor-pointer">
                  I confirm that I am the individual whose data I am requesting to be deleted, or I am authorized to submit this request on their behalf. I understand that this request will be reviewed and that some data may be retained where legally or medically required.
                </Label>
              </div>
              {errors.consentConfirmation && <p className="text-destructive text-xs -mt-3">{errors.consentConfirmation}</p>}

              <Button type="submit" disabled={loading} className="w-full md:w-auto" data-testid="button-submit">
                {loading ? "Submitting..." : "Submit Data Deletion Request"}
              </Button>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-foreground border-b border-slate-200 pb-2 mb-4">{title}</h2>
      <div className="space-y-3 [&_ul]:list-disc [&_ul]:ml-5 [&_ul]:space-y-1 [&_ul]:text-muted-foreground [&_p]:text-muted-foreground [&_p]:leading-relaxed">
        {children}
      </div>
    </section>
  );
}
