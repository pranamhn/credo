import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StatCard } from "@/components/ui-kit/StatCard";
import { FileText } from "lucide-react";

describe("StatCard", () => {
  it("renders value and label", () => {
    render(<StatCard icon={<FileText />} value={42} label="Total Upload" />);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Total Upload")).toBeInTheDocument();
  });

  it("renders trend when provided", () => {
    render(
      <StatCard icon={<FileText />} value={10} label="Test" trend="+5%" trendUp />
    );
    expect(screen.getByText("+5%")).toBeInTheDocument();
  });

  it("applies cyan color class to value", () => {
    render(<StatCard icon={<FileText />} value={99} label="Teal stat" color="cyan" />);
    const value = screen.getByText("99");
    expect(value).toHaveClass("text-teal-700");
  });

  it("applies emerald color class to icon wrapper", () => {
    const { container } = render(
      <StatCard icon={<FileText data-testid="icon" />} value={5} label="Done" color="emerald" />
    );
    const iconWrap = container.querySelector(".bg-emerald-100");
    expect(iconWrap).toBeInTheDocument();
  });
});
