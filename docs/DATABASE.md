# Database schema

Status: approved and implemented. Initialization runs at backend startup; sessions reset on restart while board data persists.

Use Python's sqlite3 module and relational tables. The API returns the existing BoardData JSON shape; JSON is not the storage format. Enable foreign keys on every connection.

| Table | Fields and constraints |
| --- | --- |
| users | id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE |
| boards | id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id) |
| columns | id TEXT PRIMARY KEY, board_id TEXT NOT NULL REFERENCES boards(id), title TEXT NOT NULL CHECK(length(trim(title)) > 0), position INTEGER NOT NULL CHECK(position >= 0), UNIQUE(board_id, position) |
| cards | id TEXT PRIMARY KEY, column_id TEXT NOT NULL REFERENCES columns(id), title TEXT NOT NULL CHECK(length(trim(title)) > 0), details TEXT NOT NULL DEFAULT '', position INTEGER NOT NULL CHECK(position >= 0), UNIQUE(column_id, position) |

IDs are stable text IDs; new cards receive backend-generated UUIDs. Column/card positions start at zero. Columns remain fixed in number and order; only their titles change. Cards inherit board ownership through their column. The dummy credentials remain in backend code; no password column or user-registration feature is needed for this MVP.

Initialize missing tables and the demo user's board in a transaction at startup. Seed the existing five columns and sample cards once. Reopening a database must retain edits and never reseed an existing board.

Use a transaction for every mutation. For moves, validate source ownership, destination ownership, and destination index, then renumber the affected columns. Temporarily offset positions before assigning final positions to avoid collisions with UNIQUE constraints. Deletion compacts remaining positions; creation appends at the end. Reject invalid positions rather than silently changing them.

The database path defaults to a local data directory during development and /data/kanban.sqlite3 in Docker. The Compose named volume persists /data. Exclude local database files from Git and Docker build context. Startup errors should clearly identify inaccessible or invalid database files.

API responses assemble columns ordered by position, each column's ordered cardIds, and a cards map. Authenticate every board operation and resolve the board from the session's user; never trust a client-supplied user ID. Return the updated board after mutations.

Verify initialization is idempotent, blank titles and broken foreign keys are rejected, moves preserve each card exactly once, users cannot access each other's boards, and saved changes survive closing/reopening the database and recreating the container.
