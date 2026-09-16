import { Context, Layer, Schema, Schedule } from "effect"
import { PersistedQueue } from "effect/unstable/persistence"
import { NodeRedis } from "@effect/platform-node"
import { SqliteClient } from "@effect/sql-sqlite-node"

// Create a schema for representing the job payload
export const PostJob = Schema.Struct({
  postId: Schema.NonEmptyString,
  text: Schema.NonEmptyString,
})
export type PostJob = typeof PostJob.Type

// Build a named queue associated with the job schema
const makeQueue = PersistedQueue.make({
  name: "posts",
  schema: PostJob,
  maxAttempts: 3,
  retrySchedule: Schedule.spaced("5 seconds"),
})

export class PostsQueue extends Context.Service<PostsQueue>()("PostsQueue", {
  make: makeQueue,
}) {}

export const LayerRedis = Layer.effect(PostsQueue, PostsQueue.make).pipe(
  Layer.provide(PersistedQueue.layer),
  Layer.provide(PersistedQueue.layerStoreRedis()),
  Layer.provide(NodeRedis.layer({ url: "redis://redis:6379" })),
)

export const LayerSql = Layer.effect(PostsQueue, PostsQueue.make).pipe(
  Layer.provide(PersistedQueue.layer),
  Layer.provide(
    PersistedQueue.layerStoreSql({
      tableName: "posts",
    }),
  ),
  Layer.provide(
    SqliteClient.layer({
      filename: "./posts.sqlite",
    }),
  ),
)

export const LayerTest = Layer.effect(PostsQueue, PostsQueue.make).pipe(
  Layer.provide(PersistedQueue.layer),
  Layer.provide(PersistedQueue.layerStoreMemory),
)
