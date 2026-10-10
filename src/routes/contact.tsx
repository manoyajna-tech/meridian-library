import { createFileRoute } from "@tanstack/react-router";
import { Mail, MapPin, Phone } from "lucide-react";
import { PublicLayout } from "@/components/library/PublicLayout";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Meridian College Library" },
      { name: "description", content: "Get in touch with Meridian College Library: address, phone and email." },
      { property: "og:title", content: "Contact — Meridian College Library" },
      { property: "og:description", content: "Address, phone and email for the library desk." },
    ],
  }),
  component: Contact,
});

function Contact() {
  const items = [
    { i: MapPin, t: "Visit us", d: "3rd Block, A.A.N.M &  V.V.R.S.R POLYTECHNIC Campus" },
    { i: Phone, t: "Call the desk", d: "+91 9390029353", href: "tel:+919390029353" },
    { i: Mail, t: "Email", d: "manoyajnagarapati@gmail.com", href: "mailto:manoyajnagarapati@gmail.com" },
  ];
  return (
    <PublicLayout>
      <div className="mx-auto max-w-4xl px-4 py-14">
        <h1 className="text-4xl font-medium">Contact us</h1>
        <p className="mt-2 text-muted-foreground">The library desk is happy to help with accounts, fines and book requests.</p>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {items.map((x) => (
            <div key={x.t} className="rounded-xl border bg-card p-6 shadow-card">
              <x.i className="h-6 w-6 text-primary" />
              <p className="mt-3 font-display text-lg font-medium">{x.t}</p>
              {x.href ? <a href={x.href} className="text-sm text-primary hover:underline">{x.d}</a> : <p className="text-sm text-muted-foreground">{x.d}</p>}
            </div>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
}
