import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { GlowButton } from "@/components/ui-kit/GlowButton";
import { Plus } from "lucide-react";

describe("GlowButton", () => {
  it("renders children text", () => {
    render(<GlowButton>Upload</GlowButton>);
    expect(screen.getByText("Upload")).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<GlowButton onClick={onClick}>Click</GlowButton>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is disabled when loading", () => {
    render(<GlowButton loading>Save</GlowButton>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("is disabled when disabled prop is true", () => {
    render(<GlowButton disabled>Save</GlowButton>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("renders primary variant class", () => {
    render(<GlowButton variant="primary">Primary</GlowButton>);
    expect(screen.getByRole("button")).toHaveClass("bg-teal-600");
  });

  it("renders danger variant class", () => {
    render(<GlowButton variant="danger">Delete</GlowButton>);
    expect(screen.getByRole("button")).toHaveClass("bg-red-50");
  });

  it("renders with icon", () => {
    render(
      <GlowButton icon={<Plus data-testid="icon" />}>Add</GlowButton>
    );
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("renders as link when href is provided", () => {
    render(<GlowButton href="/upload">Go Upload</GlowButton>);
    expect(screen.getByRole("link")).toBeInTheDocument();
  });
});
