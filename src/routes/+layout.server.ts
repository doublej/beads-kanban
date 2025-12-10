import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
	const cwd = process.cwd();
	const folderName = cwd.split('/').pop() || cwd;
	return { cwd, folderName };
};
