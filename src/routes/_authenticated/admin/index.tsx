import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/library/bits";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin — Meridian College Library" }, { name: "description", content: "Library administration." }] }),
  component: () => (
    <PageHeader title="Admin dashboard" description="Admin tools are still being built." />
  ),
});
