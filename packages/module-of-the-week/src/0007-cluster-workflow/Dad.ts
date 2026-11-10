import { Effect, Option, Queue, Schema } from "effect"
import { ClusterSchema, Entity } from "effect/cluster"
import { Rpc } from "effect/rpc"
import { TellJoke } from "./Workflow.ts"

export const Dad = Entity.make("Dad", [
  Rpc.make("NewMessage", {
    payload: {
      messageId: Schema.String,
      from: Schema.String,
      text: Schema.String,
    },
    primaryKey: (payload) => payload.messageId,
  }),
]).annotateRpcs(ClusterSchema.Persisted, true)

export const DadLayer = Dad.toLayerQueue(
  Effect.gen(function* () {
    const address = yield* Entity.CurrentAddress

    return (mailbox, replier) => {
      // Wait for the chat to go quiet for 2.5 seconds, same as Part 3
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

        // Hand the joke to a workflow. With `discard: true`, this returns as
        // soon as the workflow is saved, not when the joke is told.
        yield* TellJoke.execute(
          {
            chat: address.entityId,
            messages: batch.map((request) => request.payload),
          },
          { discard: true },
        )

        // The workflow's saved, so it's safe to mark the batch processed
        yield* Effect.forEach(batch, (request) => replier.succeed(request, undefined))
      }).pipe(Effect.forever)
    }
  }),
)
