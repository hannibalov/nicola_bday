import { render, screen, within, fireEvent } from "@testing-library/react";
import GameLeaderboard from "./GameLeaderboard";

describe("GameLeaderboard", () => {
  it("renders game name, hero, and entries with formatted scores", () => {
    render(
      <GameLeaderboard
        gameName="Team trivia"
        individualEntries={[
          { name: "Alice", score: 100 },
          { name: "Bob", score: 80 },
        ]}
        teamEntries={[]}
        initialType="individual"
      />
    );
    expect(screen.getByText("Team trivia")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /leaderboard/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: /Display mode/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
    expect(screen.getByText("80")).toBeInTheDocument();
  });

  it("shows Squad mode active for team type", () => {
    render(
      <GameLeaderboard
        gameName="Round"
        individualEntries={[]}
        teamEntries={[{ name: "Team 1", score: 200 }]}
        initialType="team"
      />
    );
    const group = screen.getByRole("group", { name: /Display mode/i });
    expect(group).toHaveTextContent("Squad");
    expect(
      screen.getByText(/same points every teammate earned/i)
    ).toBeInTheDocument();
  });

  it("shows empty state when there are no entries", () => {
    render(
      <GameLeaderboard
        gameName="G"
        individualEntries={[]}
        teamEntries={[]}
        initialType="individual"
      />
    );
    expect(screen.getByText(/No scores for this round yet/)).toBeInTheDocument();
  });

  it("preserves entry order from props (server sends sorted list)", () => {
    render(
      <GameLeaderboard
        gameName="G"
        individualEntries={[
          { name: "Zoe", score: 50 },
          { name: "Alice", score: 50 },
        ]}
        teamEntries={[]}
        initialType="individual"
      />
    );
    const list = screen.getByRole("list", { name: /Rankings/ });
    const items = within(list).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Zoe");
    expect(items[1]).toHaveTextContent("Alice");
  });

  it("marks highlightName row as You", () => {
    render(
      <GameLeaderboard
        gameName="G"
        individualEntries={[
          { name: "Alice", score: 100 },
          { name: "Bob", score: 80 },
        ]}
        teamEntries={[]}
        initialType="individual"
        highlightIndividualName="Bob"
      />
    );
    expect(screen.getByText("You")).toBeInTheDocument();
  });

  it("allows switching between individual and team views", () => {
    render(
      <GameLeaderboard
        gameName="G"
        individualEntries={[
          { name: "Alice", score: 100 },
          { name: "Bob", score: 80 },
        ]}
        teamEntries={[
          { name: "Team 1", score: 180 },
        ]}
        initialType="individual"
      />
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.queryByText("Team 1")).not.toBeInTheDocument();

    const squadButton = screen.getByRole("button", { name: /Squad/i });
    fireEvent.click(squadButton);

    expect(screen.getByText("Team 1")).toBeInTheDocument();
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
  });
});
