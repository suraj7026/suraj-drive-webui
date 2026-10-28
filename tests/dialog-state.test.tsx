import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DeleteDialog } from "@/components/archive/delete-dialog";
import { NewFolderDialog } from "@/components/archive/new-folder-dialog";
import type { FileItem } from "@/lib/models/archive";

const item: FileItem = { id: "one", name: "fixture.txt", bucketId: "test", kind: "file", path: [], slug: "fixture", owner: "test" };

describe("dialog state lifetime", () => {
  it("clears new-folder values and errors when reopened", async () => {
    const user = userEvent.setup();
    const props = { parentLabel: "Test", onClose: vi.fn(), onSubmit: vi.fn().mockRejectedValue(new Error("Fixture failure")) };
    const view = render(<NewFolderDialog open {...props} />);
    await user.type(screen.getByRole("textbox"), " Folder ");
    await user.click(screen.getByRole("button", { name: "Create folder" }));
    expect(await screen.findByText("Fixture failure")).toBeDefined();
    expect(props.onSubmit).toHaveBeenCalledWith("Folder");
    view.rerender(<NewFolderDialog open={false} {...props} />);
    view.rerender(<NewFolderDialog open {...props} />);
    expect(screen.getByRole<HTMLInputElement>("textbox").value).toBe("");
    expect(screen.queryByText("Fixture failure")).toBeNull();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Create folder" }).disabled).toBe(false);
  });

  it("does not close a new-folder dialog during a pending submission", async () => {
    const user = userEvent.setup();
    let complete: () => void = () => { throw new Error("Submission did not start"); };
    const pending = new Promise<void>((resolve) => { complete = resolve; });
    const onClose = vi.fn();
    render(<NewFolderDialog open parentLabel="Test" onClose={onClose} onSubmit={() => pending} />);
    await user.type(screen.getByRole("textbox"), "Folder");
    await user.click(screen.getByRole("button", { name: "Create folder" }));
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Creating..." }).disabled).toBe(true);
    await act(async () => { complete(); await pending; });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("resets a failed delete when the selected target changes", async () => {
    const user = userEvent.setup();
    const props = { onClose: vi.fn(), onConfirm: vi.fn().mockRejectedValue(new Error("Delete failed")) };
    const view = render(<DeleteDialog open item={item} {...props} />);
    await user.click(screen.getByRole("button", { name: "Delete file" }));
    expect(await screen.findByText("Delete failed")).toBeDefined();
    view.rerender(<DeleteDialog open item={{ ...item, id: "two", name: "other.txt" }} {...props} />);
    expect(screen.queryByText("Delete failed")).toBeNull();
    expect(screen.getByText("other.txt")).toBeDefined();
  });

  it("clears delete errors on close/reopen and retains cancellation protection", async () => {
    const user = userEvent.setup();
    const props = { onClose: vi.fn(), onConfirm: vi.fn().mockRejectedValue(new Error("Delete failed")) };
    const view = render(<DeleteDialog open item={item} {...props} />);
    await user.click(screen.getByRole("button", { name: "Delete file" }));
    expect(await screen.findByText("Delete failed")).toBeDefined();
    view.rerender(<DeleteDialog open={false} item={item} {...props} />);
    view.rerender(<DeleteDialog open item={item} {...props} />);
    expect(screen.queryByText("Delete failed")).toBeNull();
    await user.keyboard("{Escape}");
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
