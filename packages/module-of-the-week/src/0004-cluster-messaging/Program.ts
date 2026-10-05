import { Effect, Layer } from "effect"
import { TestRunner } from "effect/cluster"
import { Dad, DadLayer } from "./Dad.ts"
import { ChatLayer } from "./Chat.ts"
import { PunGeneratorLayer } from "./PunGenerator.ts"

const program = Effect.gen(function* () {
  const makeDad = yield* Dad.client

  const post = (chat: string, from: string, text: string) =>
    Effect.gen(function* () {
      yield* Effect.log(`${chat} · ${from}: ${text}`)
      yield* makeDad(chat).NewMessage({ from, text }, { discard: true })
    })

  yield* post("#engineering", "Sebastian", "Why is this test flaky?")
  yield* Effect.sleep("1 second")
  yield* post("#engineering", "Mattia", "It's flaky for me too")
  yield* post("#random", "Tim", "Is CI down?")

  // Give the Dads time to think
  yield* Effect.sleep("10 seconds")
})

const ServicesLayer = Layer.mergeAll(ChatLayer, PunGeneratorLayer)

const MainLayer = DadLayer.pipe(Layer.provide(ServicesLayer), Layer.provideMerge(TestRunner.layer))

// oxlint-disable-next-line effecttsgo/strict-effect-provide typescript/no-floating-promises
program.pipe(Effect.provide(MainLayer), Effect.runPromise)
