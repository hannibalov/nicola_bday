import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import NicknameForm from "./NicknameForm";
import { NICOLA_STORAGE_PREFIX } from "@/lib/clientStorage";

const mockPush = jest.fn();
const mockRefresh = jest.fn();
const mockSearchParams = jest.fn(() => new URLSearchParams());
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  useSearchParams: () => mockSearchParams(),
}));

beforeEach(() => {
  mockPush.mockClear();
  mockRefresh.mockClear();
  mockSearchParams.mockImplementation(() => new URLSearchParams());
  global.fetch = jest.fn();
  localStorage.clear();
});

describe("NicknameForm", () => {
  it("renders alias input and submit button", () => {
    render(<NicknameForm />);
    expect(
      screen.getByLabelText(/quirky party alias/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /join the party/i })).toBeInTheDocument();
  });

  it("shows error when submitting empty nickname", async () => {
    render(<NicknameForm />);
    fireEvent.click(screen.getByRole("button", { name: /join the party/i }));
    await waitFor(() => {
      expect(screen.getByText(/please enter a nickname/i)).toBeInTheDocument();
    });
  });

  it("calls API and redirects to /play on success", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ playerId: "abc123" }),
    });
    render(<NicknameForm />);
    fireEvent.change(screen.getByLabelText(/quirky party alias/i), {
      target: { value: "Alice" },
    });
    fireEvent.click(screen.getByRole("button", { name: /join the party/i }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/players",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ nickname: "Alice" }),
        })
      );
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/play");
    });
  });

  it("persists playerId and nickname to localStorage on success", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ playerId: "pid-99" }),
    });
    render(<NicknameForm />);
    fireEvent.change(screen.getByLabelText(/quirky party alias/i), {
      target: { value: "Glitter_Guru" },
    });
    fireEvent.click(screen.getByRole("button", { name: /join the party/i }));
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/play");
    });
    expect(localStorage.getItem(`${NICOLA_STORAGE_PREFIX}playerId`)).toBe(
      "pid-99"
    );
    expect(localStorage.getItem(`${NICOLA_STORAGE_PREFIX}nickname`)).toBe(
      "Glitter_Guru"
    );
  });

  it("still redirects when localStorage throws", async () => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("quota");
    };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ playerId: "still-ok" }),
    });
    render(<NicknameForm />);
    fireEvent.change(screen.getByLabelText(/quirky party alias/i), {
      target: { value: "Neon_Nick" },
    });
    fireEvent.click(screen.getByRole("button", { name: /join the party/i }));
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/play");
    });
    Storage.prototype.setItem = orig;
  });

  it("shows server error when response is not ok", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Server busy" }),
    });
    render(<NicknameForm />);
    fireEvent.change(screen.getByLabelText(/quirky party alias/i), {
      target: { value: "X" },
    });
    fireEvent.click(screen.getByRole("button", { name: /join the party/i }));
    await waitFor(() => {
      expect(screen.getByText(/server busy/i)).toBeInTheDocument();
    });
  });

  it("disables input and button while submitting", async () => {
    let resolveSubmit!: (v: unknown) => void;
    const deferred = new Promise((r) => {
      resolveSubmit = r;
    });
    (global.fetch as jest.Mock).mockReturnValueOnce(
      deferred.then(() => ({
        ok: true,
        json: async () => ({ playerId: "p1" }),
      }))
    );
    render(<NicknameForm />);
    fireEvent.change(screen.getByLabelText(/quirky party alias/i), {
      target: { value: "Y" },
    });
    fireEvent.click(screen.getByRole("button", { name: /join the party/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/quirky party alias/i)).toBeDisabled();
    });
    expect(screen.getByRole("button", { name: /joining/i })).toBeDisabled();
    resolveSubmit(null);
    await waitFor(() => {
      expect(screen.getByLabelText(/quirky party alias/i)).not.toBeDisabled();
    });
  });

  it("preserves protocolTest query on redirect when present in the URL", async () => {
    mockSearchParams.mockImplementation(
      () => new URLSearchParams("protocolTest=1&nickname=Skip"),
    );
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ playerId: "id-z" }),
    });
    render(<NicknameForm />);
    fireEvent.change(screen.getByLabelText(/quirky party alias/i), {
      target: { value: "Manual" },
    });
    fireEvent.click(screen.getByRole("button", { name: /join the party/i }));
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        "/play?protocolTest=1&nickname=Skip",
      );
    });
  });
});
