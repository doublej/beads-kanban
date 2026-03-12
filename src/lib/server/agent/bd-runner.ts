import { spawn } from "child_process";

export async function runBd(cwd: string, args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		const proc = spawn("bd", args, {
			cwd,
			shell: false,
			env: {
				...process.env,
				BD_CWD: cwd,
			},
		});
		let stdout = "";
		let stderr = "";

		proc.stdout.on("data", (data) => { stdout += data; });
		proc.stderr.on("data", (data) => { stderr += data; });

		proc.on("close", (code) => {
			if (code === 0) {
				resolve(stdout.trim());
			} else {
				reject(new Error(stderr || `bd exited with code ${code}`));
			}
		});

		proc.on("error", reject);
	});
}
