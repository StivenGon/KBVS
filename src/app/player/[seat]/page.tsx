import { notFound } from "next/navigation";
import { redirect } from "next/navigation";

import RoleShell from "@/components/role-shell";

export default async function PlayerSeatPage({
  params,
  searchParams,
}: {
  params: Promise<{ seat: string }>;
  searchParams: Promise<{ room?: string; name?: string }>;
}) {
  const { seat } = await params;
  const { room, name } = await searchParams;
  const normalizedSeat = seat.toUpperCase();

  if (normalizedSeat !== "A" && normalizedSeat !== "B") {
    notFound();
  }

  if (!room) {
    redirect("/player");
  }

  return (
    <RoleShell
      role={normalizedSeat as "A" | "B"}
      title={`Vista jugador ${normalizedSeat}`}
      description={`Esta ruta está dedicada al jugador ${normalizedSeat}. La arena comparte la misma sala WebSocket, pero esta pestaña entra con su plaza y control propios.`}
      roomCode={room}
      playerName={name}
      showIntro={false}
    />
  );
}