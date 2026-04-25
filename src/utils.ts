import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PROFILES_DIR, LIBRARY_DIR, BASE_DIR } from "./constants";
import { execSync } from "node:child_process";
import chalk from "chalk";

export async function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    await fs.mkdir(dir, { recursive: true });
  }
}

export interface ProfileConfig {
  skills: string[];
}

export async function readProfile(name: string): Promise<ProfileConfig | null> {
  const profileFile = join(PROFILES_DIR, `${name}.json`);
  if (!existsSync(profileFile)) {
    return null;
  }
  const content = await fs.readFile(profileFile, "utf-8");
  return JSON.parse(content);
}

export async function writeProfile(name: string, config: ProfileConfig) {
  await ensureDir(PROFILES_DIR);
  const profileFile = join(PROFILES_DIR, `${name}.json`);
  await fs.writeFile(profileFile, JSON.stringify(config, null, 2));
}

export async function listProfiles(): Promise<string[]> {
  if (!existsSync(PROFILES_DIR)) return [];
  const files = await fs.readdir(PROFILES_DIR);
  return files.filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", ""));
}

export async function installSkill(source: string) {
  try {
    // Ensure the base directory exists
    await ensureDir(BASE_DIR);

    console.log(chalk.blue(`Fetching skill from ${source}...`));

    // Call the skills CLI from the environment
    // We run it in BASE_DIR and target the 'openclaw' agent
    // because its skillsDir is 'skills/', which matches our LIBRARY_DIR.
    execSync(`skills add ${source} --agent openclaw --yes`, {
      cwd: BASE_DIR,
      stdio: "inherit",
      env: {
        ...process.env,
        HOME: BASE_DIR,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(`Failed to execute 'skills add': ${message}`, { cause: e });
  }
}

export async function resolveSkill(skillId: string): Promise<string | null> {
  if (!existsSync(LIBRARY_DIR)) return null;

  const files = await fs.readdir(LIBRARY_DIR);

  // 1. Exact match
  if (files.includes(skillId)) return skillId;

  // 2. Match with extension (e.g. browser-automation -> browser-automation.js)
  const matches = files.filter((f) => {
    const ext = f.lastIndexOf(".") > 0 ? f.substring(f.lastIndexOf(".")) : "";
    const nameWithoutExt = f.replace(ext, "");
    return nameWithoutExt === skillId;
  });

  if (matches.length === 1) return matches[0] ?? null;
  if (matches.length > 1) {
    throw new Error(
      `Multiple matches for skill '${skillId}': ${matches.join(", ")}. Please be more specific.`
    );
  }

  return null;
}
