import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Ecosystem Platform",
  description: "Learn how we collect, use, and protect your personal information on the Ecosystem Platform.",
};

export default function PrivacyPage() {
  return (
    <div className="container mx-auto max-w-4xl py-16 px-4">
      <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
      
      <div className="prose prose-lg max-w-none">
        <p className="text-lg text-muted-foreground mb-8">
          Last updated: {new Date().toLocaleDateString()}
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Information We Collect</h2>
          <p>
            We collect information you provide directly to us, such as when you create an account, 
            make a booking, or contact us for support. This may include your name, email address, 
            phone number, payment information, and other details necessary to provide our services.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">How We Use Your Information</h2>
          <p>
            We use the information we collect to provide, maintain, and improve our services, 
            process transactions, send communications, and ensure security. We never sell your 
            personal information to third parties.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Data Protection</h2>
          <p>
            We implement appropriate security measures to protect your personal information against 
            unauthorized access, alteration, disclosure, or destruction. We use industry-standard 
            encryption and secure payment processing.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy, please contact us at{" "}
            <a href="mailto:privacy@ecosystem-platform.com" className="text-primary">
              privacy@ecosystem-platform.com
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}