interface MockGameScreenProps {
  gameName: string;
  gameIndex: number;
}

export default function MockGameScreen({ gameName, gameIndex }: MockGameScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <h1 className="text-2xl font-semibold text-center">{gameName}</h1>
      <p className="text-zinc-500">Game {gameIndex + 1} – placeholder</p>
      <p className="text-lg">Playing…</p>
    </div>
  );
}
