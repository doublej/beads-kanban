let _copiedId = $state<string | null>(null);
let _timer: ReturnType<typeof setTimeout> | null = null;

export const copyState = {
	get copiedId() { return _copiedId; },
	set(id: string) {
		if (_timer) clearTimeout(_timer);
		_copiedId = id;
		_timer = setTimeout(() => { _copiedId = null; _timer = null; }, 1500);
	}
};
