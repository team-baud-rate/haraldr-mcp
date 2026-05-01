#!/usr/bin/env node
const sub = process.argv[2];

if (sub === "install") {
  const { runInstall } = await import("./install.js");
  await runInstall(process.argv.slice(3));
} else if (sub === "uninstall") {
  const { runUninstall } = await import("./uninstall.js");
  await runUninstall(process.argv.slice(3));
} else if (sub === "--help" || sub === "-h" || sub === "help") {
  console.log(
    [
      "haraldr",
      "",
      "Usage:",
      "  npx haraldr             Run the MCP server on stdio (used by AI agents).",
      "  npx haraldr install     Auto-detect installed agents, patch their mcpServers config,",
      "                          and copy the haraldr-domains skill to ~/.claude/skills/.",
      "  npx haraldr uninstall   Remove the server entry from every detected agent config",
      "                          and remove the skill from ~/.claude/skills/.",
      "",
      "Install flags:",
      "  --local      Point agents at this local checkout (node <abs-path>) instead of npx.",
      "  --dry-run    Show what would change without writing files.",
      "  --no-skill   Skip copying the haraldr-domains skill.",
      "",
      "Uninstall flags:",
      "  --dry-run    Show what would be removed without writing files.",
      "  --no-skill   Skip removing the haraldr-domains skill.",
      "",
      "Environment:",
      "  HARALDR_API_URL  Override the API origin (default https://haraldr.joel.net).",
    ].join("\n"),
  );
} else {
  const { runServer } = await import("./server.js");
  await runServer();
}
