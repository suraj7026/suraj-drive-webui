import type { TransferItem } from "@/lib/models/transfers";

const storeName = "transfers";

export async function loadRecoveredTransfers(accountId: string): Promise<TransferItem[]> {
	const database = await openDatabase(accountId);
	return new Promise((resolve, reject) => {
		const request = database.transaction(storeName, "readonly").objectStore(storeName).getAll();
		request.onsuccess = () => {
			database.close();
			resolve((request.result as TransferItem[]) ?? []);
		};
		request.onerror = () => {
			database.close();
			reject(request.error);
		};
	});
}

export async function persistRecoveredTransfers(accountId: string, transfers: TransferItem[]): Promise<void> {
	const database = await openDatabase(accountId);
	await new Promise<void>((resolve, reject) => {
		const transaction = database.transaction(storeName, "readwrite");
		const store = transaction.objectStore(storeName);
		store.clear();
		for (const transfer of transfers.filter((entry) => entry.status !== "done")) {
			store.put({ ...transfer, canResume: false });
		}
		transaction.oncomplete = () => {
			database.close();
			resolve();
		};
		transaction.onerror = () => {
			database.close();
			reject(transaction.error);
		};
	});
}

function openDatabase(accountId: string): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(`suraj-drive-uploads-${accountId}`, 1);
		request.onupgradeneeded = () => {
			const database = request.result;
			if (!database.objectStoreNames.contains(storeName)) {
				database.createObjectStore(storeName, { keyPath: "id" });
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}
