export default function Legal({ type }) {
  const isPrivacy = type === "privacy";
  return (
    <div className="container-app py-12" data-testid={`legal-${type}`}>
      <div className="mx-auto max-w-3xl">
        <h1 className="font-heading text-4xl font-bold sm:text-5xl">
          {isPrivacy ? "Privacy Policy" : "Terms of Service"}
        </h1>
        <p className="mt-4 text-sm text-[#4A4A4A]">Effective date: {new Date().toLocaleDateString()}</p>

        <div className="prose prose-neutral mt-8 max-w-none space-y-6 text-[#4A4A4A]">
          {isPrivacy ? (
            <>
              <Section title="1. What data we collect">
                We collect your name, email, phone, delivery address, and order history — only what is required to
                fulfil your orders and communicate with you about them.
              </Section>
              <Section title="2. How we use it">
                Your information is used to deliver your orders, send order updates over WhatsApp/SMS, and support
                you when things go wrong. We do not sell or rent your data.
              </Section>
              <Section title="3. Security">
                Passwords are hashed using industry-standard bcrypt. Data is transmitted over HTTPS and stored on
                access-controlled servers.
              </Section>
              <Section title="4. Your rights">
                You may request access, correction or deletion of your data by contacting us at
                contact@ambajogai.com.
              </Section>
            </>
          ) : (
            <>
              <Section title="1. Orders">
                Placing an order is a binding request to purchase. Prices, product availability and delivery slots
                may change without notice.
              </Section>
              <Section title="2. Payments">
                We accept UPI (via QR code) and Cash on Delivery. Please ensure exact change for COD orders.
              </Section>
              <Section title="3. Delivery">
                We deliver within Ambajogai city limits. Free delivery for orders above ₹499. Delivery times are
                estimates and may vary due to weather or unforeseen conditions.
              </Section>
              <Section title="4. Returns & refunds">
                Damaged or spoiled items can be reported within 24 hours over WhatsApp for a full refund or
                replacement.
              </Section>
              <Section title="5. Contact">
                Questions? Reach out at contact@ambajogai.com or via WhatsApp.
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <h2 className="font-heading text-lg font-semibold text-[#1A1A1A]">{title}</h2>
      <p className="mt-2 leading-relaxed">{children}</p>
    </section>
  );
}
