import { NodeServices } from "@effect/platform-node"
import { Clock, Effect, Layer } from "effect"
import { SingleRunner } from "effect/cluster"
import { SqlClient } from "effect/sql"
import { ChatLayer } from "./Chat.ts"
import { DadLayer } from "./Dad.ts"
import { DatabaseLayer } from "./Database.ts"
import { PunGeneratorLayer } from "./PunGenerator.ts"
import { handleMessage, type SlackMessageEvent } from "./Slack.ts"

const program = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  let sequence = 0
  const nextTs = Effect.map(
    Clock.currentTimeMillis,
    (millis) => `${Math.floor(millis / 1000)}.${String(++sequence).padStart(6, "0")}`,
  )

  const post = (channel: string, user: string, text: string) =>
    Effect.gen(function* () {
      const event: SlackMessageEvent = { channel, user, text, ts: yield* nextTs }
      yield* Effect.log(`${channel} · ${user}: ${text}`)
      yield* handleMessage(event)
      return event
    })

  const retry = (event: SlackMessageEvent) =>
    Effect.gen(function* () {
      yield* Effect.log(`${event.channel} · (Slack retries ${event.user}'s message ${event.ts})`)
      yield* handleMessage(event)
    })

  const sebastian = yield* post("#engineering", "Sebastian", "Why is this test flaky?")
  yield* retry(sebastian)
  yield* Effect.sleep("1 second")
  yield* post("#engineering", "Mattia", "It's flaky for me too")
  yield* post("#random", "Tim", "Is CI down?")

  yield* Effect.sleep("8 seconds")

  yield* retry(sebastian)
  yield* Effect.sleep("4 seconds")

  const [{ copies }] = yield* sql<{ copies: number }>`
    SELECT count(*) AS copies FROM dad_inbox
    WHERE chat = ${sebastian.channel} AND id = ${sebastian.ts}
  `
  yield* Effect.log(`Slack sent Sebastian's message 3 times. Dad's inbox has ${copies} copy.`)
})

const ServicesLayer = Layer.mergeAll(ChatLayer, PunGeneratorLayer)

const ClusterLayer = SingleRunner.layer({ runnerStorage: "memory" }).pipe(
  Layer.provide(NodeServices.layer),
)

const MainLayer = DadLayer.pipe(
  Layer.provide(ServicesLayer),
  Layer.provideMerge(ClusterLayer),
  Layer.provideMerge(DatabaseLayer),
)

program.pipe(Effect.provide(MainLayer), Effect.runPromise)
