/** @type {import("@commitlint/types").UserConfig} */
const config = {
  extends: ["@commitlint/config-conventional"],
  // Conventional Commits: type(scope): subject
  // e.g. feat(booking): hold inventory before charging deposit
};

export default config;
