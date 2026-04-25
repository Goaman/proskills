#!/usr/bin/env bun
import { Command } from "commander";
import chalk from "chalk";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import { join } from "node:path";
import { LIBRARY_DIR, PROFILES_DIR } from "./constants";
import {
  ensureDir,
  readProfile,
  writeProfile,
  listProfiles,
  resolveSkill,
  installSkill,
  getSkillMetadata,
  deleteProfile,
  deleteSkill,
  getProfileDir,
} from "./utils";

const program = new Command();

/**
 * Shared logic to output skills in XML format
 */
async function outputSkillsXml(id?: string) {
  let skillIds: string[] = [];
  let profileIdForMeta: string | undefined;

  if (!id) {
    // Case 1: No ID provided - return all skills in library
    if (existsSync(LIBRARY_DIR)) {
      skillIds = await fs.readdir(LIBRARY_DIR);
    }
  } else {
    // Case 2: ID provided - check if it's a profile
    const prof = await readProfile(id);
    if (prof) {
      skillIds = prof.skills;
      profileIdForMeta = id;
    } else {
      // Case 3: ID provided - check if it's a specific skill (for top-level command)
      const resolved = await resolveSkill(id);
      if (resolved) {
        skillIds = [resolved];
      } else {
        console.error(chalk.red(`Error: '${id}' is not a valid profile or skill.`));
        const profiles = await listProfiles();
        if (profiles.length > 0) {
          console.log(chalk.blue("\nAvailable profiles:"));
          profiles.forEach((p) => console.log(`  - ${p}`));
        }
        return;
      }
    }
  }

  const skillMetas = [];
  for (const sid of skillIds) {
    const meta = await getSkillMetadata(sid, profileIdForMeta);
    if (meta) {
      skillMetas.push(meta);
    }
  }

  console.log("<available_skills>");
  for (const meta of skillMetas) {
    console.log("  <skill>");
    console.log(`    <name>${meta.name}</name>`);
    console.log(`    <description>${meta.description}</description>`);
    console.log(`    <location>${meta.location}</location>`);
    console.log("  </skill>");
  }
  console.log("</available_skills>");
}

program
  .name("proskills")
  .description("Manage agent skill profiles by centralizing them in a library")
  .version("0.0.3")
  .addHelpText(
    "after",
    `
TLDR:
  $ proskills init                       # Setup library
  $ proskills add owner/repo             # Fetch skill from GitHub
  $ proskills delete <skill-id>          # Remove skill from library
  $ proskills list                      # List available library skills
  $ proskills get-skills [id]           # Get XML (all, profile, or skill)
  $ proskills profile create my-tools    # Create a profile
  $ proskills profile add my-tools name  # Add library skill to profile
  $ proskills profile list              # List profiles
  $ proskills profile get-skills [id]   # Get XML (all or profile)
  $ proskills profile get-paths my-tools # Get paths for agent config
`
  );

program
  .command("init")
  .description("Setup the canonical library")
  .action(async () => {
    await ensureDir(LIBRARY_DIR);
    await ensureDir(PROFILES_DIR);
    console.log(chalk.blue(`Initialized library at ${LIBRARY_DIR}`));
    console.log(chalk.blue(`Initialized profiles at ${PROFILES_DIR}`));
    console.log(chalk.green("Initialization complete."));
  });

program
  .command("add [source]")
  .description("Fetch a skill from an external source and add it to the local library")
  .action(async (source?: string) => {
    if (!source) {
      console.error(chalk.red("Error: missing required argument 'source'"));
      program.commands.find((c) => c.name() === "add")?.outputHelp();
      return;
    }
    try {
      await installSkill(source);
      console.log(chalk.green(`Successfully installed skill from ${source}`));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(chalk.red(`Failed to install skill: ${message}`));
      process.exit(1);
    }
  });

program
  .command("delete [skill-id]")
  .description("Remove a skill from the local library")
  .action(async (skillId?: string) => {
    if (!skillId) {
      console.error(chalk.red("Error: missing required argument 'skill-id'"));
      if (existsSync(LIBRARY_DIR)) {
        const files = await fs.readdir(LIBRARY_DIR);
        if (files.length > 0) {
          console.log(chalk.blue("\nAvailable skills:"));
          files.forEach((f) => console.log(`  - ${f}`));
        }
      }
      program.commands.find((c) => c.name() === "delete")?.outputHelp();
      return;
    }

    if (!existsSync(join(LIBRARY_DIR, skillId))) {
      console.error(chalk.red(`Skill '${skillId}' not found in library.`));
      return;
    }

    await deleteSkill(skillId);
    console.log(chalk.green(`Successfully deleted skill '${skillId}' from library.`));
  });

program
  .command("get-skills [id]")
  .description("Get skills in XML format for agent programmatic use (id can be a profile or skill)")
  .action(async (id?: string) => {
    await outputSkillsXml(id);
  });

const profile = program.command("profile").description("Manage skill profiles");

profile
  .command("create [id]")
  .description("Create a new empty profile definition")
  .action(async (id?: string) => {
    if (!id) {
      console.error(chalk.red("Error: missing required argument 'id'"));
      const profiles = await listProfiles();
      if (profiles.length > 0) {
        console.log(chalk.blue("\nExisting profiles:"));
        profiles.forEach((p) => console.log(`  - ${p}`));
      }
      profile.commands.find((c) => c.name() === "create")?.outputHelp();
      return;
    }
    const existing = await readProfile(id);
    if (existing) {
      console.error(chalk.red(`Profile '${id}' already exists.`));
      return;
    }
    await writeProfile(id, { skills: [] });
    console.log(chalk.green(`Profile '${id}' created at ${getProfileDir(id)}`));
  });

profile
  .command("add [profile-id] [skill-id]")
  .description("Add a skill from the local library to a specific profile")
  .action(async (profileId?: string, skillId?: string) => {
    if (!profileId) {
      console.error(chalk.red("Error: missing required argument 'profile-id'"));
      const profiles = await listProfiles();
      if (profiles.length > 0) {
        console.log(chalk.blue("\nAvailable profiles:"));
        profiles.forEach((p) => console.log(`  - ${p}`));
      }
      profile.commands.find((c) => c.name() === "add")?.outputHelp();
      return;
    }

    if (!skillId) {
      console.error(chalk.red("Error: missing required argument 'skill-id'"));
      if (existsSync(LIBRARY_DIR)) {
        const files = await fs.readdir(LIBRARY_DIR);
        if (files.length > 0) {
          console.log(chalk.blue("\nAvailable skills in library:"));
          files.forEach((f) => console.log(`  - ${f}`));
        }
      }
      profile.commands.find((c) => c.name() === "add")?.outputHelp();
      return;
    }

    const prof = await readProfile(profileId);

    if (!prof) {
      console.error(chalk.red(`Profile '${profileId}' does not exist.`));
      return;
    }

    let resolvedSkillName: string | null;
    try {
      resolvedSkillName = await resolveSkill(skillId);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(chalk.red(message));
      return;
    }

    if (!resolvedSkillName) {
      console.error(chalk.red(`Skill '${skillId}' not found in library (${LIBRARY_DIR}).`));
      console.log(chalk.yellow(`Try: proskills add <source> to fetch it first.`));
      return;
    }

    if (prof.skills.includes(resolvedSkillName)) {
      console.warn(
        chalk.yellow(`Skill '${resolvedSkillName}' is already in profile '${profileId}'.`)
      );
      return;
    }

    prof.skills.push(resolvedSkillName);
    await writeProfile(profileId, prof);
    console.log(
      chalk.green(`Added '${resolvedSkillName}' (id: ${skillId}) to profile '${profileId}'.`)
    );
  });

profile
  .command("remove [profile-id] [skill-id]")
  .description("Remove a skill from a specific profile (does not delete from library)")
  .action(async (profileId?: string, skillId?: string) => {
    if (!profileId) {
      console.error(chalk.red("Error: missing required argument 'profile-id'"));
      const profiles = await listProfiles();
      if (profiles.length > 0) {
        console.log(chalk.blue("\nAvailable profiles:"));
        profiles.forEach((p) => console.log(`  - ${p}`));
      }
      profile.commands.find((c) => c.name() === "remove")?.outputHelp();
      return;
    }

    const prof = await readProfile(profileId);
    if (!prof) {
      console.error(chalk.red(`Profile '${profileId}' does not exist.`));
      return;
    }

    if (!skillId) {
      console.error(chalk.red("Error: missing required argument 'skill-id'"));
      if (prof.skills.length > 0) {
        console.log(chalk.blue(`\nSkills in profile '${profileId}':`));
        prof.skills.forEach((s) => console.log(`  - ${s}`));
      }
      profile.commands.find((c) => c.name() === "remove")?.outputHelp();
      return;
    }

    if (!prof.skills.includes(skillId!)) {
      // Try to resolve in case they used a shorthand that matches a full name in the profile
      const resolved = prof.skills.find((s) => s.startsWith(skillId!));
      if (resolved) {
        skillId = resolved;
      } else {
        console.error(chalk.red(`Skill '${skillId!}' not found in profile '${profileId}'.`));
        return;
      }
    }

    prof.skills = prof.skills.filter((s) => s !== skillId);
    await writeProfile(profileId, prof);
    console.log(chalk.green(`Removed '${skillId!}' from profile '${profileId}'.`));
  });

profile
  .command("delete [id]")
  .description("Delete a profile definition")
  .action(async (id?: string) => {
    if (!id) {
      console.error(chalk.red("Error: missing required argument 'id'"));
      const profiles = await listProfiles();
      if (profiles.length > 0) {
        console.log(chalk.blue("\nAvailable profiles:"));
        profiles.forEach((p) => console.log(`  - ${p}`));
      }
      profile.commands.find((c) => c.name() === "delete")?.outputHelp();
      return;
    }

    const prof = await readProfile(id);
    if (!prof) {
      console.error(chalk.red(`Profile '${id}' does not exist.`));
      return;
    }

    await deleteProfile(id);
    console.log(chalk.green(`Profile '${id}' deleted.`));
  });

profile
  .command("get-paths [id]")
  .description("Get absolute paths for all skills in a profile")
  .option("--json", "Output as JSON array")
  .action(async (id?: string, options?: { json?: boolean }) => {
    if (!id) {
      console.error(chalk.red("Error: missing required argument 'id'"));
      const profiles = await listProfiles();
      if (profiles.length > 0) {
        console.log(chalk.blue("\nAvailable profiles:"));
        profiles.forEach((p) => console.log(`  - ${p}`));
      }
      profile.commands.find((c) => c.name() === "get-paths")?.outputHelp();
      return;
    }
    const prof = await readProfile(id);
    if (!prof) {
      console.error(chalk.red(`Profile '${id}' does not exist.`));
      process.exit(1);
    }

    const skillsDir = join(getProfileDir(id), "skills");
    const paths = prof.skills.map((skill) => join(skillsDir, skill));

    if (options?.json) {
      console.log(JSON.stringify(paths));
    } else {
      console.log(paths.join("\n"));
    }
  });

profile
  .command("get-skills [id]")
  .description("Get skills in XML format (id can be a profile or omit for all library skills)")
  .action(async (id?: string) => {
    await outputSkillsXml(id);
  });

profile
  .command("list")
  .description("Show available profiles")
  .action(async () => {
    const profiles = await listProfiles();
    if (profiles.length === 0) {
      console.log("No profiles found. Use 'proskills profile create' to add one.");
      return;
    }

    console.log(chalk.blue("Available Profiles:"));
    for (const name of profiles) {
      const prof = await readProfile(name);
      console.log(`  ${name} (${prof?.skills.length || 0} skills)`);
    }
  });

program
  .command("list")
  .description("Show all skills available in the local library")
  .action(async () => {
    if (!existsSync(LIBRARY_DIR)) {
      console.log(chalk.yellow("Library is empty. Use 'proskills add' to fetch skills."));
      return;
    }
    const files = await fs.readdir(LIBRARY_DIR);
    if (files.length === 0) {
      console.log(chalk.yellow("Library is empty."));
      return;
    }
    console.log(chalk.blue("Library Skills:"));
    for (const file of files) {
      console.log(`  - ${file}`);
    }
  });

program
  .command("status")
  .description("Show library and profile status")
  .action(async () => {
    console.log(chalk.bold("[LIBRARY] content:"));
    if (!existsSync(LIBRARY_DIR)) {
      console.log("  Library directory does not exist.");
    } else {
      const files = await fs.readdir(LIBRARY_DIR);
      if (files.length === 0) {
        console.log("  Library is empty.");
      } else {
        for (const file of files) {
          console.log(`  - ${file}`);
        }
      }
    }

    console.log(chalk.bold("\n[PROFILES]:"));
    const profiles = await listProfiles();
    if (profiles.length === 0) {
      console.log("  No profiles defined.");
    } else {
      for (const name of profiles) {
        const prof = await readProfile(name);
        const profileDir = getProfileDir(name);
        console.log(`  - ${name}: ${prof?.skills.join(", ")}`);
        console.log(chalk.gray(`    Path: ${profileDir}`));
      }
    }
  });

if (!process.argv.slice(2).length) {
  program.outputHelp();
  process.exit(0);
}

program.parse();
