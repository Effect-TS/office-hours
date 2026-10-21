import { Clock, Effect, Schedule, Schema } from "effect"
import { ClusterSchema, Entity } from "effect/cluster"
import { Rpc } from "effect/rpc"
import { SqlClient } from "effect/sql"
import { Chat } from "./Chat.ts"
import { PunGenerator } from "./PunGenerator.ts"

export const Dad = Entity.make("Dad", [
  Rpc.make("NewMessage", {
    payload: {
      messageId: Schema.String,
      from: Schema.String,
      text: Schema.String,
    },
    primaryKey: (payload) => payload.messageId,
  }).annotate(ClusterSchema.WithTransaction, true),
]).annotateRpcs(ClusterSchema.Persisted, true)

export const DadLayer = Dad.toLayer(
  Effect.gen(function* () {
    const address = yield* Entity.CurrentAddress
    const sql = yield* SqlClient.SqlClient
    const punGenerator = yield* PunGenerator
    const chat = yield* Chat
    const chatId = address.entityId

    yield* Effect.log(`Dad for ${chatId} has entered the chat`)

    const notebook = yield* sql<{ joke: string }>`
      SELECT joke FROM dad_jokes WHERE chat = ${chatId}
    `.pipe(Effect.orDie)
    const told = new Set(notebook.map((row) => row.joke))

    const writeDownJoke = Effect.gen(function* () {
      const unread = yield* sql<{ id: string; sender: string; text: string; at: number }>`
        SELECT id, sender, text, at FROM dad_inbox
        WHERE chat = ${chatId} AND joke IS NULL
        ORDER BY at
      `
      const newest = unread.at(-1)
      if (newest === undefined) return

      const now = yield* Clock.currentTimeMillis
      if (now - newest.at < 2500) return

      const joke = yield* punGenerator.generate(
        unread.map(({ sender, text }) => ({ from: sender, text })),
        { told },
      )

      yield* Effect.gen(function* () {
        const [entry] = yield* sql<{ id: number }>`
          INSERT INTO dad_jokes ${sql.insert({ chat: chatId, joke, posted: false })}
          RETURNING id
        `
        yield* sql`
          UPDATE dad_inbox SET joke = ${entry!.id}
          WHERE chat = ${chatId} AND id IN ${sql.in(unread.map((message) => message.id))}
        `
      }).pipe(sql.withTransaction)
      told.add(joke)
    })

    const tellWrittenJokes = Effect.gen(function* () {
      const unposted = yield* sql<{ id: number; joke: string }>`
        SELECT id, joke FROM dad_jokes
        WHERE chat = ${chatId} AND posted = false
        ORDER BY id
      `
      for (const { id, joke } of unposted) {
        yield* chat.reply(chatId, joke)
        yield* sql`UPDATE dad_jokes SET posted = true WHERE id = ${id}`
      }
    })

    yield* Effect.gen(function* () {
      yield* tellWrittenJokes
      yield* writeDownJoke
      yield* tellWrittenJokes

      yield* Effect.gen(function* () {
        const [{ waiting }] = yield* sql<{ waiting: number }>`
          SELECT count(*) AS waiting FROM dad_inbox
          WHERE chat = ${chatId} AND joke IS NULL
        `
        if (waiting === 0) yield* Entity.keepAlive(false)
      }).pipe(sql.withTransaction)
    }).pipe(Effect.orDie, Effect.repeat(Schedule.spaced("500 millis")), Effect.forkScoped)

    return Dad.of({
      NewMessage: ({ payload }) =>
        Effect.gen(function* () {
          yield* sql`INSERT INTO dad_inbox ${sql.insert({
            chat: chatId,
            id: payload.messageId,
            sender: payload.from,
            text: payload.text,
          })}`
          yield* Entity.keepAlive(true)
        }).pipe(Effect.orDie, Effect.provideService(Entity.CurrentAddress, address)),
    })
  }),
)
