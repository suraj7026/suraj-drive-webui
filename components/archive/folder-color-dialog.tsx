"use client";

import type { FileItem } from "@/lib/models/archive";
import { cn } from "@/lib/utils/cn";
import { Modal } from "@/components/ui/modal";

const COLORS = [
	{ key: "", label: "Default", value: "var(--color-primary)" },
	{ key: "red", label: "Red", value: "#dc5a5a" },
	{ key: "orange", label: "Orange", value: "#d9792b" },
	{ key: "yellow", label: "Yellow", value: "#c49a22" },
	{ key: "green", label: "Green", value: "#3f8f63" },
	{ key: "blue", label: "Blue", value: "#3978c8" },
	{ key: "purple", label: "Purple", value: "#8060c7" },
	{ key: "gray", label: "Gray", value: "#72777d" },
];

export function FolderColorDialog({ item, onClose, onSubmit }: {
	item: FileItem;
	onClose: () => void;
	onSubmit: (color: string) => Promise<void>;
}) {
	return (
		<Modal open onClose={onClose} title="Organize with color" className="max-w-md">
			<div>
				<p className="mt-2 truncate text-sm text-[var(--color-text-muted)]">{item.name}</p>
				<div className="mt-6 grid grid-cols-4 gap-3">
					{COLORS.map((color) => (
						<button key={color.key || "default"} type="button" onClick={() => void onSubmit(color.key)} className={cn("grid gap-2 rounded-[18px] p-3 text-xs hover:bg-[var(--color-surface-low)]", (item.folderColor ?? "") === color.key && "bg-[var(--color-surface-low)] ring-2 ring-[var(--color-primary)]")} aria-label={`Use ${color.label.toLowerCase()} for ${item.name}`}>
							<span className="mx-auto h-8 w-8 rounded-full" style={{ backgroundColor: color.value }} />
							<span>{color.label}</span>
						</button>
					))}
				</div>
				<button type="button" onClick={onClose} className="mt-6 w-full rounded-full bg-[var(--color-surface-low)] px-4 py-3 text-sm font-medium">Cancel</button>
			</div>
		</Modal>
	);
}
