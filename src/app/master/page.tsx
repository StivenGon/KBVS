import RoleShell from "@/components/role-shell";
import { createRoomCode } from "@/lib/typing-room";

export default function MasterPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string }>;
}) {
  return <MasterPageContent searchParams={searchParams} />;
}

async function MasterPageContent({
  searchParams,
}: {
  searchParams: Promise<{ room?: string }>;
}) {
  const { room } = await searchParams;
  const roomCode = room ?? createRoomCode();

  return (
    <RoleShell
      role="master"
      title="Vista maestro"
      description="Sala directa para iniciar, resetear y cambiar el texto de la ronda."
      roomCode={roomCode}
    />
  );
}