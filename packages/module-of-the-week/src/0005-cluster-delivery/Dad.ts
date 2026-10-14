import { Effect, Option, Queue, Schema } from "effect"
import { ClusterSchema, Entity } from "effect/cluster"
import { Rpc } from "effect/rpc"
import { Chat } from "./Chat.ts"
import { PunGenerator } from "./PunGenerator.ts"

export const Dad = Entity.make("Dad", [
  Rpc.make("NewMessage", {
    payload: { from: Schema.String, text: Schema.String },
  }),
]).annotateRpcs(ClusterSchema.Persisted, true)

export const DadLayer = Dad.toLayerQueue(
  Effect.gen(function* () {
    const address = yield* Entity.CurrentAddress
    const punGenerator = yield* PunGenerator
    const chat = yield* Chat
    const told = new Set<string>()

    yield* Effect.log(`Dad for ${address.entityId} has entered the chat`)

    return (mailbox, replier) => {
      // Wait for a message, then keep reading until the chat goes quiet
      const nextBatch = Effect.gen(function* () {
        const batch = [yield* Queue.take(mailbox)]
        while (true) {
          const next = yield* Queue.take(mailbox).pipe(Effect.timeoutOption("2500 millis"))
          if (Option.isNone(next)) return batch
          batch.push(next.value)
        }
      })

      return Effect.gen(function* () {
        const batch = yield* nextBatch
        const joke = yield* punGenerator.generate(
          batch.map((request) => request.payload),
          { told },
        )
        told.add(joke)
        yield* chat.reply(address.entityId, joke)

        // Only reply once the joke is posted, which marks each message as processed
        yield* Effect.forEach(batch, (request) => replier.succeed(request, undefined))
      }).pipe(Effect.forever)
    }
  }),
)
