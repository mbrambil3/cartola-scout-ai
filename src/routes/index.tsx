import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { AnaliseTime } from "@/components/AnaliseTime";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <Layout>
      <AnaliseTime />
    </Layout>
  );
}
