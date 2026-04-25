import fs from "node:fs/promises";
import { existsSync, readlinkSync } from "node:fs";
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

export function getProfileDir(id: string): string {
  return join(PROFILES_DIR, id);
}

export async function readProfile(id: string): Promise<ProfileConfig | null> {
  const profileDir = getProfileDir(id);
  const profileFile = join(profileDir, `${id}.json`);
  if (!existsSync(profileFile)) {
    return null;
  }
  const content = await fs.readFile(profileFile, "utf-8");
  return JSON.parse(content);
}

async function createSymlink(target: string, link: string) {
  if (!existsSync(target)) return;

  if (existsSync(link)) {
    try {
      const existingTarget = readlinkSync(link);
      if (existingTarget === target) return;
      await fs.unlink(link);
    } catch {
      await fs.rm(link, { recursive: true, force: true });
    }
  }
  await fs.symlink(target, link);
}

export async function syncProfileSymlinks(id: string, config: ProfileConfig) {
  const profileDir = getProfileDir(id);
  const skillsDir = join(profileDir, "skills");
  await ensureDir(skillsDir);

  // 1. Get current symlinks
  const currentFiles = existsSync(skillsDir) ? await fs.readdir(skillsDir) : [];

  // 2. Identify what should be there
  const expectedFiles = new Set<string>();
  for (const skillId of config.skills) {
    expectedFiles.add(skillId);
    const skillPath = join(LIBRARY_DIR, skillId);
    if (existsSync(skillPath)) {
      const stats = await fs.stat(skillPath);
      if (!stats.isDirectory()) {
        const mdFile = `${skillId.replace(/\.[^/.]+$/, "")}.md`;
        if (existsSync(join(LIBRARY_DIR, mdFile))) {
          expectedFiles.add(mdFile);
        }
      }
    }
  }

  // 3. Remove files not expected
  for (const file of currentFiles) {
    if (!expectedFiles.has(file)) {
      await fs.unlink(join(skillsDir, file));
    }
  }

  // 4. Create/Sync symlinks
  for (const file of expectedFiles) {
    await createSymlink(join(LIBRARY_DIR, file), join(skillsDir, file));
  }
}

export async function writeProfile(id: string, config: ProfileConfig) {
  const profileDir = getProfileDir(id);
  await ensureDir(profileDir);
  const profileFile = join(profileDir, `${id}.json`);
  await fs.writeFile(profileFile, JSON.stringify(config, null, 2));
  await syncProfileSymlinks(id, config);
}

export async function listProfiles(): Promise<string[]> {
  if (!existsSync(PROFILES_DIR)) return [];
  const entries = await fs.readdir(PROFILES_DIR, { withFileTypes: true });
  const profiles: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const profileFile = join(PROFILES_DIR, entry.name, `${entry.name}.json`);
      if (existsSync(profileFile)) {
        profiles.push(entry.name);
      }
    }
  }
  return profiles;
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
  } catch (e: any) {
    if (e.status === 127 || (e.message && e.message.includes("not found"))) {
      throw new Error(
        `The 'skills' CLI is not found in your PATH. Please install it by running: ${chalk.bold("bun install -g skills")}`
      );
    }
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

export async function deleteProfile(id: string) {
  const profileDir = getProfileDir(id);
  if (existsSync(profileDir)) {
    await fs.rm(profileDir, { recursive: true, force: true });
  }
}

export async function deleteSkill(skillId: string) {
  const skillPath = join(LIBRARY_DIR, skillId);
  if (existsSync(skillPath)) {
    await fs.rm(skillPath, { recursive: true, force: true });
  }
}

export async function getSkillMetadata(
  skillId: string,
  profileId?: string
): Promise<{
  name: string;
  description: string;
  location: string;
} | null> {
  const skillPath = join(LIBRARY_DIR, skillId);
  if (!existsSync(skillPath)) return null;

  const stats = await fs.stat(skillPath);
  const skillMdPathInLibrary = stats.isDirectory()
    ? join(skillPath, "SKILL.md")
    : join(LIBRARY_DIR, `${skillId.replace(/\.[^/.]+$/, "")}.md`);

  let description = "No description available.";
  if (existsSync(skillMdPathInLibrary)) {
    const content = await fs.readFile(skillMdPathInLibrary, "utf-8");

    // 1. Try to extract <description>...</description>
    const tagMatch = content.match(/<description>([\s\S]*?)<\/description>/);
    if (tagMatch && tagMatch[1]) {
      description = tagMatch[1].trim();
    } else {
      // 2. Try to extract from YAML frontmatter (description: ...)
      const yamlMatch = content.match(/^---\s*[\s\S]*?^description:\s*(.+)$\s*[\s\S]*?^---/m);
      if (yamlMatch && yamlMatch[1]) {
        description = yamlMatch[1].trim();
      } else {
        // 3. Fallback: first non-empty line that isn't a heading or separator
        const lines = content
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0 && !l.startsWith("#") && !l.startsWith("---"));
        if (lines[0]) {
          description = lines[0];
        }
      }
    }
  }

  let location = skillMdPathInLibrary;
  if (profileId) {
    const profileSkillsDir = join(getProfileDir(profileId), "skills");
    const skillPathInProfile = join(profileSkillsDir, skillId);

    if (stats.isDirectory()) {
      location = join(skillPathInProfile, "SKILL.md");
    } else {
      const mdFile = `${skillId.replace(/\.[^/.]+$/, "")}.md`;
      const mdPathInProfile = join(profileSkillsDir, mdFile);
      location = existsSync(mdPathInProfile) ? mdPathInProfile : skillPathInProfile;
    }
  }

  return {
    name: skillId.replace(/\.[^/.]+$/, ""), // name without extension
    description,
    location,
  };
}
