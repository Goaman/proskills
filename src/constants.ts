import { join } from "node:path";
import { homedir } from "node:os";

export const BASE_DIR = join(homedir(), ".agents", "db");
export const LIBRARY_DIR = join(BASE_DIR, "skills");
export const PROFILES_DIR = join(BASE_DIR, "profiles");
