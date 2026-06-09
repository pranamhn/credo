import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StatusBadge } from "@/components/statement/StatusBadge";

describe("StatusBadge", () => {
  it("renders 'Done' for done status with correct color", () => {
    render(<StatusBadge status="done" />);
    const badge = screen.getByText("Done");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-emerald-100", "text-emerald-800");
  });

  it("renders 'Failed' for failed status with red color", () => {
    render(<StatusBadge status="failed" />);
    const badge = screen.getByText("Failed");
    expect(badge).toHaveClass("bg-red-100", "text-red-700");
  });

  it("renders 'Queued' for queued status", () => {
    render(<StatusBadge status="queued" />);
    expect(screen.getByText("Queued")).toBeInTheDocument();
  });

  it("renders 'Review' with amber color", () => {
    render(<StatusBadge status="needs_review" />);
    const badge = screen.getByText("Review");
    expect(badge).toHaveClass("bg-amber-100", "text-amber-800");
  });

  it("renders 'Parsing…' with indigo color", () => {
    render(<StatusBadge status="parsing" />);
    const badge = screen.getByText("Parsing…");
    expect(badge).toHaveClass("bg-indigo-100", "text-indigo-700");
  });
});
