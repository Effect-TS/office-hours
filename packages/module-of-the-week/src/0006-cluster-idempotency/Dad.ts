import { Clock, Effect, Schedule, Schema } from "effect"
import { ClusterSchema, Entity } from "effect/cluster"
import { Rpc } from "effect/rpc"
import { SqlClient } from "effect/sql"
import { Chat } from "./Chat.ts"
import { PunGenerator } from "./PunGenerator.ts"

export const Dad = Entity.make("Dad", [
  Rpc.make("NewMessage", {
    payload: {
      // Slack's timestamp for the message. Unique within a channel, and
      // the same every time Slack sends it.
      messageId: Schema.String,
      from: Schema.String,
      text: Schema.String,
    },
    // Tells cluster how to find the key in a message
    primaryKey: (payload) => payload.messageId,
  })
    // Run the handler in the transaction that marks the message processed
    .annotate(ClusterSchema.WithTransaction, true),
]).annotateRpcs(ClusterSchema.Persisted, true)

export const DadLayer = Dad.toLayer(
  Effect.gen(function* () {
    const address = yield* Entity.CurrentAddress
    const sql = yield* SqlClient.SqlClient
    const punGenerator = yield* PunGenerator
    const chat = yield* Chat
    const chatId = address.entityId

    yield* Effect.log(`Dad for ${chatId} has entered the chat`)

    // Every joke Dad has ever told in this chat, read from his notebook
    const notebook = yield* sql<{ joke: string }>`
      SELECT joke FROM dad_jokes WHERE chat = ${chatId}
    `.pipe(Effect.orDie)
    const told = new Set(notebook.map((row) => row.joke))

    // Step 1: once the chat goes quiet, pick a joke and write it down
    const writeDownJoke = Effect.gen(function* () {
      const unread = yield* sql<{ id: string; sender: string; text: string; at: number }>`
        SELECT id, sender, text, at FROM dad_inbox
        WHERE chat = ${chatId} AND joke IS NULL
        ORDER BY at
      `
      const newest = unread.at(-1)
      if (newest === undefined) return

      // Someone posted in the last 2.5 seconds. The chat isn't quiet yet.
      const now = yield* Clock.currentTimeMillis
      if (now - newest.at < 2500) return

      const joke = yield* punGenerator.generate(
        unread.map(({ sender, text }) => ({ from: sender, text })),
        { told },
      )

      // Write the joke down and mark the messages it answers, together
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

    // Steps 2 and 3: post every joke he wrote down but hasn't told yet
    const tellWrittenJokes = Effect.gen(function* () {
      const unposted = yield* sql<{ id: number; joke: string }>`
        SELECT id, joke FROM dad_jokes
        WHERE chat = ${chatId} AND posted = false
        ORDER BY id
      `
      for (const { id, joke } of unposted) {
        yield* chat.reply(chatId, joke)
        // A crash right here means Dad posts this joke again when he restarts
        yield* sql`UPDATE dad_jokes SET posted = true WHERE id = ${id}`
      }
    })

    // Check the inbox every half second, for as long as Dad is awake. The
    // first pass tells any joke he wrote down before a crash but never posted.
    yield* Effect.gen(function* () {
      yield* tellWrittenJokes
      yield* writeDownJoke
      yield* tellWrittenJokes

      // Nothing left to answer, so Dad can go to sleep. The check runs in a
      // transaction so a `NewMessage` can't commit between the count and
      // `keepAlive(false)` and be left in the inbox with nothing to wake Dad.
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
          // Commits along with "processed", or not at all
          yield* sql`INSERT INTO dad_inbox ${sql.insert({
            chat: chatId,
            id: payload.messageId,
            sender: payload.from,
            text: payload.text,
          })}`
          // Stay awake, even across a crash, until the inbox is empty
          yield* Entity.keepAlive(true)
        }).pipe(
          Effect.orDie,
          // Handlers run at Dad's address, but their types don't know that
          Effect.provideService(Entity.CurrentAddress, address),
        ),
    })
  }),
)
