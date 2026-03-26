"use client";

import { useEffect, useState } from "react";

interface CountdownScreenProps {
  seconds: number;
  gameName: string;
  isTeamGame: boolean;
  teammateNicknames: string[];
}

export default function CountdownScreen({
  seconds: initialSeconds,
  gameName,
  isTeamGame,
  teammateNicknames,
}: CountdownScreenProps) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [seconds]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
      <h1 className="text-2xl font-semibold text-center">{gameName}</h1>
      <div className="text-6xl font-bold tabular-nums">
        {seconds > 0 ? seconds : "Go!"}
      </div>
      {isTeamGame && teammateNicknames.length > 0 && (
        <div className="w-full">
          <h2 className="text-sm font-medium text-zinc-500 mb-2">
            Your teammates
          </h2>
          <ul className="space-y-1">
            {teammateNicknames.map((name) => (
              <li key={name} className="text-lg">
                {name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
