import { render, screen, within } from "@testing-library/react";
import GameLeaderboard from "./GameLeaderboard";

describe("GameLeaderboard", () => {
  it("renders game name, hero, and entries with formatted scores", () => {
    render(
      <GameLeaderboard
        gameName="Team trivia"
        entries={[
          { name: "Alice", score: 100 },
          { name: "Bob", score: 80 },
        ]}
        type="individual"
      />
    );
    expect(screen.getByText("Team trivia")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /leaderboard/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: /Display mode: Individual/i })
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
        entries={[{ name: "Team 1", score: 200 }]}
        type="team"
      />
    );
    const status = screen.getByRole("status", { name: /Display mode/i });
    expect(status).toHaveTextContent("Squad");
  });

  it("shows empty state when there are no entries", () => {
    render(
      <GameLeaderboard gameName="G" entries={[]} type="individual" />
    );
    expect(screen.getByText(/No scores for this round yet/)).toBeInTheDocument();
  });

  it("preserves entry order from props (server sends sorted list)", () => {
    render(
      <GameLeaderboard
        gameName="G"
        entries={[
          { name: "First", score: 3 },
          { name: "Second", score: 2 },
        ]}
        type="individual"
      />
    );
    const list = screen.getByRole("list", { name: /rankings/i });
    const items = within(list).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("First");
    expect(items[1]).toHaveTextContent("Second");
  });

  it("marks highlightName row as You", () => {
    render(
      <GameLeaderboard
        gameName="G"
        entries={[{ name: "Zed", score: 1 }]}
        type="individual"
        highlightName="zed"
      />
    );
    expect(screen.getByText(/^You$/i)).toBeInTheDocument();
  });
});
