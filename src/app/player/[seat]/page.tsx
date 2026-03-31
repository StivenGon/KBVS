import { notFound } from "next/navigation";
import { redirect } from "next/navigation";

import RoleShell from "@/components/role-shell";

export default async function PlayerSeatPage({
  params,
  searchParams,
}: {
  params: Promise<{ seat: string }>;
  searchParams: Promise<{ room?: string }>;
}) {
  const { seat } = await params;
  const { room } = await searchParams;

  if (seat !== "A" && seat !== "B") {
    notFound();
  }

  if (!room) {
    redirect("/player");
  }

  return (
    <RoleShell
      role={seat}
      title={`Vista jugador ${seat}`}
      description={`Esta ruta está dedicada al jugador ${seat}. La arena comparte la misma sala WebSocket, pero esta pestaña entra con su plaza y control propios.`}
      roomCode={room}
    />
  );
}