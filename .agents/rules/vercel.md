# Vercel MCP Configuration for DataForge

## Vercel MCP Server
Configured in [`.agents/mcp_config.json`](file:///c:/Users/amanm/OneDrive/Desktop/DataForge/.agents/mcp_config.json):

```json
{
  "mcpServers": {
    "vercel": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.vercel.com"],
      "env": {
        "VERCEL_TOKEN": "<optional-token-or-oauth>"
      }
    }
  }
}
```

Or direct SSE:
```json
{
  "mcpServers": {
    "vercel": {
      "serverUrl": "https://mcp.vercel.com"
    }
  }
}
```

## Available Tools
- **`list_projects`**: Discover connected Vercel projects.
- **`list_deployments`**: Query deployments, state, branch, and status.
- **`get_deployment`**: Inspect deployment details, build logs, and preview URLs.
- **`get_runtime_logs`**: Stream function and runtime execution logs.
- **`get_runtime_errors`**: Diagnose error stack traces and broken routes.
- **`list_teams`**: List Vercel organizations and workspaces.
