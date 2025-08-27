import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Ecosystem Platform",
  description: "Terms and conditions for using the Ecosystem Platform marketplace.",
};

export default function TermsPage() {
  return (
    <div className="container mx-auto max-w-4xl py-16 px-4">
      <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
      
      <div className="prose prose-lg max-w-none">
        <p className="text-lg text-muted-foreground mb-8">
          Last updated: {new Date().toLocaleDateString()}
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Acceptance of Terms</h2>
          <p>
            By accessing and using the Ecosystem Platform, you accept and agree to be bound by 
            the terms and provision of this agreement. If you do not agree to abide by the 
            above, please do not use this service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Platform Fees</h2>
          <p>
            The platform charges a 10% commission on all successful bookings. Guest users 
            (non-authenticated) pay an additional 10% surcharge. All fees are clearly 
            displayed before payment confirmation.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Provider Responsibilities</h2>
          <p>
            Service providers are responsible for delivering services as described, maintaining 
            professional standards, and complying with all applicable laws and regulations.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Customer Responsibilities</h2>
          <p>
            Customers are responsible for providing accurate information, making timely payments, 
            and treating service providers with respect.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Cancellation Policy</h2>
          <p>
            Cancellations must be made according to the provider's cancellation policy. 
            Refunds are processed according to our refund policy and payment processing timelines.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Contact Us</h2>
          <p>
            Questions about these terms should be sent to us at{" "}
            <a href="mailto:legal@ecosystem-platform.com" className="text-primary">
              legal@ecosystem-platform.com
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}