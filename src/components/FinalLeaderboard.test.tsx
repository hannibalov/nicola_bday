import { render, screen } from "@testing-library/react";
import FinalLeaderboard from "./FinalLeaderboard";

describe("FinalLeaderboard", () => {
  it("renders final hero and entries with scores", () => {
    render(
      <FinalLeaderboard
        entries={[
          { nickname: "Alice", totalScore: 150 },
          { nickname: "Bob", totalScore: 120 },
        ]}
      />
    );
    expect(
      screen.getByRole("heading", { name: /final leaderboard/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText("150")).toBeInTheDocument();
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
  });

  it("shows empty state when there are no entries", () => {
    render(<FinalLeaderboard entries={[]} />);
    expect(screen.getByText(/No final scores yet/)).toBeInTheDocument();
  });

  it("marks highlightNickname as You", () => {
    render(
      <FinalLeaderboard
        entries={[{ nickname: "Star", totalScore: 99 }]}
        highlightNickname="star"
      />
    );
    expect(screen.getByText(/^You$/i)).toBeInTheDocument();
  });
});
