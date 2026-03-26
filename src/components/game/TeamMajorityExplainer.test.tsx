/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import TeamMajorityExplainer from "./TeamMajorityExplainer";

describe("TeamMajorityExplainer", () => {
  it("describes majority voting", () => {
    render(<TeamMajorityExplainer />);
    expect(screen.getByText(/most of you/i)).toBeInTheDocument();
  });
});
