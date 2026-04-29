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
      "@haraldr/domain-tools",
      "",
      "Usage:",
      "  npx @haraldr/domain-tools             Run the MCP server on stdio (used by AI agents).",
      "  npx @haraldr/domain-tools install     Auto-detect installed agents and patch their mcpServers config.",
      "  npx @haraldr/domain-tools uninstall   Remove the server entry from every detected agent config.",
      "",
      "Install flags:",
      "  --local      Point agents at this local checkout (node <abs-path>) instead of npx.",
      "  --dry-run    Show what would change without writing files.",
      "",
      "Uninstall flags:",
      "  --dry-run    Show what would be removed without writing files.",
      "",
      "Environment:",
      "  HARALDR_API_URL  Override the API origin (default https://haraldr.joel.net).",
    ].join("\n"),
  );
} else {
  const { runServer } = await import("./server.js");
  await runServer();
}
