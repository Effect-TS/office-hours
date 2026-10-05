import { Effect, Option, Queue, Schema } from "effect"
import { Entity } from "effect/cluster"
import { Rpc } from "effect/rpc"
import { Chat } from "./Chat.ts"
import { PunGenerator } from "./PunGenerator.ts"

export const Dad = Entity.make("Dad", [
  Rpc.make("NewMessage", {
    payload: { from: Schema.String, text: Schema.String },
  }),
])

export const DadLayer = Dad.toLayer(
  Effect.gen(function* () {
    const address = yield* Entity.CurrentAddress
    const punGenerator = yield* PunGenerator
    const chat = yield* Chat
    const told = new Set<string>()
    const unread = yield* Queue.unbounded<{ from: string; text: string }>()

    yield* Effect.log(`Dad for ${address.entityId} has entered the chat`)

    // Wait for a message, then keep reading until the chat goes quiet
    const nextBatch = Effect.gen(function* () {
      const batch = [yield* Queue.take(unread)]
      while (true) {
        const next = yield* Queue.take(unread).pipe(Effect.timeoutOption("2500 millis"))
        if (Option.isNone(next)) return batch
        batch.push(next.value)
      }
    })

    yield* Effect.gen(function* () {
      const messages = yield* nextBatch
      const joke = yield* punGenerator.generate(messages, { told })
      told.add(joke)
      yield* chat.reply(address.entityId, joke)
    }).pipe(Effect.forever, Effect.forkScoped)

    return {
      NewMessage: ({ payload }) => Queue.offer(unread, payload).pipe(Effect.asVoid),
    }
  }),
)
