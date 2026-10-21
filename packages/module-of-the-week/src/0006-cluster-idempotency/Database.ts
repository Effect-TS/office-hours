import { SqliteClient, SqliteMigrator } from "@effect/sql-sqlite-node"
import { Effect, FileSystem, Layer } from "effect"
import { NodeServices } from "@effect/platform-node"
import { SqlClient } from "effect/sql"

const directory = ".data"
const filename = `${directory}/0006-cluster-idempotency.sqlite`

const DirectoryLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    yield* fs.makeDirectory(directory, { recursive: true })
  }),
).pipe(Layer.orDie, Layer.provide(NodeServices.layer))

const SqliteLayer = SqliteClient.layer({ filename }).pipe(Layer.provide(DirectoryLayer))

const MigratorLayer = SqliteMigrator.layer({
  loader: SqliteMigrator.fromRecord({
    "0001_create_dad_tables": Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient

      yield* sql`
        CREATE TABLE dad_inbox (
          chat TEXT NOT NULL,
          id TEXT NOT NULL,
          sender TEXT NOT NULL,
          text TEXT NOT NULL,
          at INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)),
          joke INTEGER REFERENCES dad_jokes (id),
          PRIMARY KEY (chat, id)
        )
      `

      yield* sql`
        CREATE TABLE dad_jokes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          chat TEXT NOT NULL,
          joke TEXT NOT NULL,
          posted BOOLEAN NOT NULL
        )
      `
    }),
  }),
})

export const DatabaseLayer = MigratorLayer.pipe(Layer.provideMerge(SqliteLayer), Layer.orDie)
