# proskills

**The Canonical Manager for Agent Skill Subsets**

`proskills` is a CLI tool designed to solve the "Skill Overload" problem for AI agent harnesses. It allows you to maintain a **Canonical Library** of all your skills while exposing only specific subsets via profiles.

It leverages the `skills` ecosystem (must be installed in your environment) to fetch and install skills directly into your local library.

---

## 1. Installation

```bash
# Recommended installation via Bun
bun install -g proskills skills
```

_Note: `proskills` leverages the `skills` CLI for fetching new skills. Both must be installed._

---

## 2. Example Workflow

1.  **Initialize the system:**

    ```bash
    proskills init
    ```

2.  **Fetch a skill from the ecosystem into your library:**

    ```bash
    proskills add vercel-labs/agent-skills/skills/find-skills
    ```

3.  **Create a profile and add the skill to it:**

    ```bash
    proskills profile create my-tools
    proskills profile add my-tools find-skills
    ```

4.  **Get XML metadata for your profile (for agent injection):**

    ```bash
    proskills profile get-skills my-tools
    # Output:
    # <available_skills>
    #   <skill>
    #     <name>find-skills</name>
    #     <description>Helps users discover and install agent skills...</description>
    #     <location>/Users/youruser/.agents/db/profiles/my-tools/skills/find-skills/SKILL.md</location>
    #   </skill>
    # </available_skills>
    ```

5.  **Get paths for your agent configuration:**

    ```bash
    proskills profile get-paths my-tools
    # Output:
    # /Users/youruser/.agents/db/profiles/my-tools/skills/find-skills
    ```

---

## 3. Command Reference

### `proskills init`

Sets up the infrastructure in `~/.agents/db/`.

### `proskills add <source>`

Fetches a skill from an external source (e.g., GitHub `owner/repo`, URL) and adds it to your local library.

- _Example:_ `proskills add vercel-labs/agent-skills/skills/find-skills`

### `proskills delete <skill-id>`

Removes a skill from your local library.

- _Example:_ `proskills delete find-skills`

### `proskills get-skills [id]`

Outputs skills in an XML format designed for programmatic consumption by AI agents (includes name, description, and path to `SKILL.md`).

- If `id` is a **profile name**, it returns all skills in that profile.
- If `id` is a **skill name**, it returns that specific skill.
- If `id` is **omitted**, it returns all skills in your library.

- _Example:_ `proskills get-skills automation`

### `proskills profile create <profile-id>`

Initializes a new, empty profile definition.

- _Example:_ `proskills profile create automation`

### `proskills profile add <profile-id> <skill-id>`

Adds a skill from your local library to a specific profile.

- _Example:_ `proskills profile add automation find-skills`

### `proskills profile remove <profile-id> <skill-id>`

Removes a skill from a specific profile (does not delete the skill from the library).

- _Example:_ `proskills profile remove automation find-skills`

### `proskills profile delete <profile-id>`

Deletes a profile definition.

- _Example:_ `proskills profile delete automation`

### `proskills profile get-skills [id]`

Outputs skills in an XML format designed for programmatic consumption by AI agents (includes name, description, and path to `SKILL.md`).

- If `id` is a **profile name**, it returns all skills in that profile.
- If `id` is **omitted**, it returns all skills in your library.

- _Example:_ `proskills profile get-skills automation`

- _Output Example:_
  ```xml
  <available_skills>
    <skill>
      <name>find-skills</name>
      <description>Helps users discover and install agent skills...</description>
      <location>/Users/youruser/.agents/db/profiles/automation/skills/find-skills/SKILL.md</location>
    </skill>
  </available_skills>
  ```

### `proskills profile get-paths <profile-id>`

Outputs the absolute paths of all skills defined in the chosen profile, one per line.

- _Example:_ `proskills profile get-paths automation`

### `proskills profile list`

Displays all available profiles and the number of skills they contain.

### `proskills list`

Displays all skills currently in your local library.

### `proskills status`

Shows an overview of the library contents and current profile mappings.

---

## 4. Technical Architecture

### Skill Storage & Resolution

Skills are stored in `~/.agents/db/skills`. When adding a skill to a profile, `proskills` resolves the ID by checking for exact matches or matches with extensions in the library.

### Profile Storage

Profiles are stored in their own directories with a configuration file:

```json
// ~/.agents/db/profiles/automation/automation.json
{
  "skills": ["find-skills"]
}
```
