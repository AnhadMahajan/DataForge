# MongoDB & MCP Configuration for DataForge

## Active Database Connection
- **URI**: `mongodb+srv://anhadmahajan06_db_user:<password>@cluster0.ihsxz4p.mongodb.net/dataforge?retryWrites=true&w=majority`
- **Config**: [`backend/config/db.js`](file:///c:/Users/amanm/OneDrive/Desktop/DataForge/backend/config/db.js)
- **Env**: [`backend/.env`](file:///c:/Users/amanm/OneDrive/Desktop/DataForge/backend/.env)

## MongoDB MCP Server Setup
The official MongoDB Model Context Protocol server is configured in [`.agents/mcp_config.json`](file:///c:/Users/amanm/OneDrive/Desktop/DataForge/.agents/mcp_config.json):

```json
{
  "mcpServers": {
    "mongodb": {
      "command": "npx",
      "args": ["-y", "mongodb-mcp-server@latest"],
      "env": {
        "MDB_MCP_CONNECTION_STRING": "mongodb+srv://anhadmahajan06_db_user:<password>@cluster0.ihsxz4p.mongodb.net/dataforge?retryWrites=true&w=majority"
      }
    }
  }
}
```

### Available Capabilities:
- **`find`**: Query documents across `users`, `datasets`, `synthesisjobs`, `evaluationreports`, `auditlogs`.
- **`aggregate`**: Run analytical aggregation pipelines.
- **`collectionSchema`**: Infer schema definitions for collections.
- **`listDatabases` / `listCollections`**: Inspect database catalogs.
- **`insertDocument` / `updateDocument`**: Modify or insert documents (read/write enabled when `--readOnly` is omitted).
