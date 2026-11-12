import { createFileRoute } from "@tanstack/react-router";
import { Clock, GraduationCap, Library, Wifi } from "lucide-react";
import { PublicLayout } from "@/components/library/PublicLayout";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Meridian College Library" },
      { name: "description", content: "Learn about Meridian College Library, our collection, opening hours and borrowing policies." },
      { property: "og:title", content: "About — Meridian College Library" },
      { property: "og:description", content: "Our collection, hours and borrowing policies." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: About,
});

function About() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-4xl px-4 py-14">
        <h1 className="text-4xl font-medium">About the library</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          Meridian College Library supports students and faculty with a curated collection across engineering, sciences,
          mathematics and the humanities. Our online system lets members search the catalog, request books, and manage loans from any device.
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {[
            { i: Clock, t: "Opening hours", d: "Mon–Sat, 8:00 AM – 8:00 PM. Closed on public holidays." },
            { i: GraduationCap, t: "Who can borrow", d: "All registered students with an active account." },
            { i: Library, t: "Borrowing policy", d: "Loan periods, limits and late fines are shown on your dashboard." },
            { i: Wifi, t: "Reading hall", d: "Quiet study space with Wi-Fi and power at every desk." },
          ].map((x) => (
            <div key={x.t} className="rounded-xl border bg-card p-6 shadow-card">
              <x.i className="h-6 w-6 text-primary" />
              <p className="mt-3 font-display text-lg font-medium">{x.t}</p>
              <p className="text-sm text-muted-foreground">{x.d}</p>
            </div>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
}
