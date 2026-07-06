import { spawn } from "child_process";

// Runs a prompt through the locally installed Claude Code CLI in headless mode.
// This bills against the user's Claude subscription (Pro/Max) rather than
// pay-as-you-go API credits — no ANTHROPIC_API_KEY required.

let cliChecked: boolean | null = null;

export async function cliAvailable(): Promise<boolean> {
  if (cliChecked !== null) return cliChecked;
  cliChecked = await new Promise<boolean>((resolve) => {
    const child = spawn("claude", ["--version"], {
      shell: process.platform === "win32",
      windowsHide: true,
    });
    const timer = setTimeout(() => {
      child.kill();
      resolve(false);
    }, 15000);
    child.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve(code === 0);
    });
  });
  return cliChecked;
}

export async function runClaudeCli(
  prompt: string,
  opts: { allowedTools?: string[]; timeoutMs?: number } = {},
): Promise<string> {
  const args = ["-p", "--output-format", "json"];
  if (opts.allowedTools?.length) {
    args.push("--allowedTools", opts.allowedTools.join(","));
  }

  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, {
      shell: process.platform === "win32",
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Claude CLI call timed out."));
    }, opts.timeoutMs ?? 180000);

    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`Claude CLI exited with code ${code}: ${stderr.slice(0, 300)}`));
        return;
      }
      try {
        const envelope = JSON.parse(stdout);
        if (envelope.is_error) {
          reject(new Error(`Claude CLI error: ${String(envelope.result).slice(0, 300)}`));
          return;
        }
        resolve(String(envelope.result ?? ""));
      } catch {
        reject(new Error("Could not parse Claude CLI output."));
      }
    });

    // Prompt goes via stdin — avoids any shell-quoting issues on Windows.
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

// Pulls the first JSON object out of a model reply that may be wrapped in
// markdown fences or prose.
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object found in model reply.");
  return JSON.parse(cleaned.slice(start, end + 1));
}
