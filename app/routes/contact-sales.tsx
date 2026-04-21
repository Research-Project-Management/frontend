import ContactSales from "~/components/landing-page/ContactSales";

export function meta() {
  return [
    { title: "Contact Sales" },
    {
      name: "description",
      content: "Talk to the Flux team about pricing, onboarding, and enterprise needs.",
    },
  ];
}

export default function ContactSalesRoute() {
  return <ContactSales />;
}
