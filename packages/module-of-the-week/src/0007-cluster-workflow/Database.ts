import { SqliteClient, SqliteMigrator } from "@effect/sql-sqlite-node"
import { Effect, FileSystem, Layer } from "effect"
import { NodeServices } from "@effect/platform-node"
import { SqlClient } from "effect/sql"

const directory = ".data"
const filename = `${directory}/0007-cluster-workflow.sqlite`

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
        CREATE TABLE dad_jokes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          chat TEXT NOT NULL,
          joke TEXT NOT NULL
        )
      `
    }),
  }),
})

export const DatabaseLayer = MigratorLayer.pipe(Layer.provideMerge(SqliteLayer), Layer.orDie)
