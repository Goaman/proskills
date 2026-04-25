# proskills

**The Canonical Manager for Agent Skill Subsets**

`proskills` is a CLI tool designed to solve the "Skill Overload" problem for AI agent harnesses. It allows you to maintain a **Canonical Library** of all your skills while exposing only specific subsets via profiles.

It leverages the `skills` ecosystem (must be installed in your environment) to fetch and install skills directly into your local library.

---

## 1. Overview: Canonical Library vs. Profiles

- **The Canonical Library (`~/.agents/db/skills`)**: The single source of truth. All your skill files or directories live here.
- **Profiles**: Named configurations stored as individual JSON files in `~/.agents/db/profiles/<profile-id>.json`.
- **The Access Layer**: `proskills` provides a `get-paths` command that outputs absolute paths for skills in a profile, making it easy to integrate with any agent harness.

---

## 2. Installation

```bash
# Recommended installation via NPM
npm install -g proskills
```

*Note: Requires the `skills` CLI to be available in your PATH.*

---

## 3. Command Reference

### `proskills init`
Sets up the infrastructure in `~/.agents/db/`.

### `proskills add <source>`
Fetches a skill from an external source (e.g., GitHub `owner/repo`, URL) and adds it to your local library.
*   *Example:* `proskills add vercel-labs/agent-skills/skills/find-skills`

### `proskills profile create <profile-id>`
Initializes a new, empty profile definition.
*   *Example:* `proskills profile create automation`

### `proskills profile add <profile-id> <skill-id>`
Adds a skill from your local library to a specific profile.
*   *Example:* `proskills profile add automation find-skills`

### `proskills profile get-paths <profile-id>`
Outputs the absolute paths of all skills defined in the chosen profile, one per line.
*   *Example:* `proskills profile get-paths automation`

### `proskills list`
Displays all available profiles and the number of skills they contain.

### `proskills status`
Shows an overview of the library contents and current profile mappings.

---

## 4. Technical Architecture

### Skill Storage & Resolution
Skills are stored in `~/.agents/db/skills`. When adding a skill to a profile, `proskills` resolves the ID by checking for exact matches or matches with extensions in the library.

### Profile Storage
Profiles are stored as individual JSON files:
```json
// ~/.agents/db/profiles/automation.json
{
  "skills": ["find-skills"]
}
```

---

## 5. Example Workflow

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

4.  **Get paths for your agent configuration:**
    ```bash
    proskills profile get-paths my-tools
    # Output:
    # /Users/youruser/.agents/db/skills/find-skills
    ```
