/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import LobbyScreen from "./LobbyScreen";

describe("LobbyScreen", () => {
  describe("trivia variant", () => {
    it("renders every team name and member nicknames", () => {
      render(
        <LobbyScreen
          variant="trivia"
          teams={[
            { name: "Team 1", nicknames: ["Alice", "Bob"] },
            { name: "Team 2", nicknames: ["Carla"] },
          ]}
          playerCount={3}
          scheduledGameStartsAtEpochMs={null}
        />
      );
      expect(screen.getByText("Team 1")).toBeInTheDocument();
      expect(screen.getByText("Team 2")).toBeInTheDocument();
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.getByText("Carla")).toBeInTheDocument();
    });

    it("explains majority voting within the team", () => {
      render(
        <LobbyScreen
          variant="trivia"
          teams={[]}
          playerCount={0}
          scheduledGameStartsAtEpochMs={null}
        />
      );
      expect(
        screen.getByText(/majority/i, { exact: false })
      ).toBeInTheDocument();
    });

    it("handles empty teams list", () => {
      render(
        <LobbyScreen
          variant="trivia"
          teams={[]}
          playerCount={0}
          scheduledGameStartsAtEpochMs={null}
        />
      );
      expect(
        screen.getByText(/teams will appear|no teams|waiting/i, { exact: false })
      ).toBeInTheDocument();
    });

    it("does not show the removed standby footer CTA or helper copy", () => {
      render(
        <LobbyScreen
          variant="trivia"
          teams={[]}
          playerCount={2}
          scheduledGameStartsAtEpochMs={null}
        />
      );
      expect(
        screen.queryByRole("button", { name: /stay on this screen/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /standing by for host/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(
          /the game opens automatically when the timer finishes/i
        )
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(
          /your screen updates when the host starts the countdown/i
        )
      ).not.toBeInTheDocument();
    });
  });

  describe("music_bingo variant", () => {
    it("shows individual bingo instructions and does not list team rosters", () => {
      render(
        <LobbyScreen
          variant="music_bingo"
          teams={[
            { name: "Team 1", nicknames: ["X"] },
          ]}
          playerCount={5}
          scheduledGameStartsAtEpochMs={null}
        />
      );
      expect(
        screen.getByRole("heading", { level: 1, name: /music bingo/i })
      ).toBeInTheDocument();
      expect(
        screen.getAllByText(/solo|your card|individual/i, { exact: false })
          .length
      ).toBeGreaterThan(0);
      expect(screen.queryByText("Team 1")).not.toBeInTheDocument();
    });

    it("references 1970s songs in copy", () => {
      render(
        <LobbyScreen
          variant="music_bingo"
          playerCount={2}
          scheduledGameStartsAtEpochMs={null}
        />
      );
      expect(screen.getAllByText(/1970s|’70s/i).length).toBeGreaterThan(0);
    });

    it("does not show the removed standby footer CTA during countdown", () => {
      const future = Date.now() + 120_000;
      render(
        <LobbyScreen
          variant="music_bingo"
          playerCount={3}
          scheduledGameStartsAtEpochMs={future}
        />
      );
      expect(
        screen.queryByRole("button", { name: /stay on this screen/i })
      ).not.toBeInTheDocument();
    });
  });
});
