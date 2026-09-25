import { Container } from "@/components/ui/container";

export function StaffPlaceholder({
  title,
  permission,
  description,
}: {
  title: string;
  permission: string;
  description: string;
}) {
  return (
    <Container className="py-10">
      <h1 className="text-3xl font-extrabold text-brand">{title}</h1>
      <p className="mt-2 max-w-2xl text-muted">{description}</p>
      <p className="mt-8 rounded-[2rem] bg-mint px-5 py-4 font-semibold text-brand">
        This area is gated by <code>{permission}</code>. Operational workflows
        arrive in later stages.
      </p>
    </Container>
  );
}
