/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import WaitingLobby from "./WaitingLobby";

describe("WaitingLobby", () => {
  it("renders default copy and test id inside styled shell", () => {
    render(<WaitingLobby />);
    expect(screen.getByTestId("waiting-lobby")).toBeInTheDocument();
    expect(screen.getByText("Waiting for host")).toBeInTheDocument();
    expect(
      screen.getByText(
        /The host will start the next part when everyone is ready/i
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/vice & vices/i)).toBeInTheDocument();
  });

  it("accepts custom title and subtitle", () => {
    render(
      <WaitingLobby title="Custom title" subtitle="Custom subtitle text." />
    );
    expect(screen.getByText("Custom title")).toBeInTheDocument();
    expect(screen.getByText("Custom subtitle text.")).toBeInTheDocument();
  });
});
