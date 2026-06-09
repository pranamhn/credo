import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Pagination } from "@/components/ui-kit/Pagination";

describe("Pagination", () => {
  it("renders nothing when totalPages <= 1", () => {
    const { container } = render(
      <Pagination page={1} totalPages={1} totalItems={5} pageSize={10} onPageChange={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows correct page count label", () => {
    render(
      <Pagination page={1} totalPages={5} totalItems={50} pageSize={10} onPageChange={vi.fn()} />
    );
    expect(screen.getByText(/5/)).toBeInTheDocument();
  });

  it("disables Prev button on first page", () => {
    render(
      <Pagination page={1} totalPages={5} totalItems={50} pageSize={10} onPageChange={vi.fn()} />
    );
    expect(screen.getByText("Prev")).toBeDisabled();
  });

  it("disables Next button on last page", () => {
    render(
      <Pagination page={5} totalPages={5} totalItems={50} pageSize={10} onPageChange={vi.fn()} />
    );
    expect(screen.getByText("Next")).toBeDisabled();
  });

  it("calls onPageChange when a page number is clicked", () => {
    const onPageChange = vi.fn();
    render(
      <Pagination page={1} totalPages={5} totalItems={50} pageSize={10} onPageChange={onPageChange} />
    );
    fireEvent.click(screen.getByText("2"));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("calls onPageChange with next page on Next click", () => {
    const onPageChange = vi.fn();
    render(
      <Pagination page={2} totalPages={5} totalItems={50} pageSize={10} onPageChange={onPageChange} />
    );
    fireEvent.click(screen.getByText("Next"));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});
