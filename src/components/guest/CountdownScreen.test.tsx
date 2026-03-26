import { render, screen } from "@testing-library/react";
import CountdownScreen from "./CountdownScreen";

describe("CountdownScreen", () => {
  it("shows game name and countdown number", () => {
    render(
      <CountdownScreen
        seconds={10}
        gameName="Quiz 1"
        isTeamGame={false}
        teammateNicknames={[]}
      />
    );
    expect(screen.getByText("Quiz 1")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("shows teammate nicknames when team game", () => {
    render(
      <CountdownScreen
        seconds={60}
        gameName="Team Quiz"
        isTeamGame={true}
        teammateNicknames={["Alice", "Bob", "Carol"]}
      />
    );
    expect(screen.getByText("Your teammates")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Carol")).toBeInTheDocument();
  });
});
