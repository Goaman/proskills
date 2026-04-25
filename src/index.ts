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
} from "./utils";

const program = new Command();

program
  .name("proskills")
  .description("Manage agent skill profiles by centralizing them in a library")
  .version("0.0.1")
  .addHelpText(
    "after",
    `
TLDR:
  $ proskills init                       # Setup library
  $ proskills add owner/repo             # Fetch skill from GitHub
  $ proskills profile create my-tools    # Create a profile
  $ proskills profile add my-tools name  # Add library skill to profile
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
  .command("add <source>")
  .description("Fetch a skill from an external source and add it to the local library")
  .action(async (source: string) => {
    try {
      await installSkill(source);
      console.log(chalk.green(`Successfully installed skill from ${source}`));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(chalk.red(`Failed to install skill: ${message}`));
      process.exit(1);
    }
  });

const profile = program.command("profile").description("Manage skill profiles");

profile
  .command("create <id>")
  .description("Create a new empty profile definition")
  .action(async (id) => {
    const existing = await readProfile(id);
    if (existing) {
      console.error(chalk.red(`Profile '${id}' already exists.`));
      return;
    }
    await writeProfile(id, { skills: [] });
    console.log(chalk.green(`Profile '${id}' created.`));
  });

profile
  .command("add <profile-id> <skill-id>")
  .description("Add a skill from the local library to a specific profile")
  .action(async (profileId: string, skillId: string) => {
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
  .command("get-paths <id>")
  .description("Get absolute paths for all skills in a profile")
  .option("--json", "Output as JSON array")
  .action(async (id: string, options: { json?: boolean }) => {
    const prof = await readProfile(id);
    if (!prof) {
      console.error(chalk.red(`Profile '${id}' does not exist.`));
      process.exit(1);
    }

    const paths = prof.skills.map((skill) => join(LIBRARY_DIR, skill));

    if (options.json) {
      console.log(JSON.stringify(paths));
    } else {
      console.log(paths.join("\n"));
    }
  });

program
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
        console.log(`  - ${name}: ${prof?.skills.join(", ")}`);
      }
    }
  });

if (!process.argv.slice(2).length) {
  program.outputHelp();
  process.exit(0);
}

program.parse();
