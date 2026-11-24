import { NodeRuntime } from "@effect/platform-node"
import { Effect, Layer } from "effect"
import { EventLog } from "effect/eventlog"
import { DeviceLayer, goOnline, printVault, schema, waitForSync, withFreshStore } from "./device.ts"

// Start server.ts first. Both devices log `readme-typo` while offline, then
// reconnect. The `conflicts` check in handlers.ts keeps the newer pitch.

const logIdea = (pitch: string) =>
  Effect.gen(function* () {
    const client = yield* EventLog.makeClient(schema)
    yield* client({ event: "IdeaLogged", payload: { slug: "readme-typo", pitch } })
  })

const program = Effect.gen(function* () {
  // Both devices start offline
  const laptopDevice = yield* Layer.build(DeviceLayer)
  const phoneDevice = yield* Layer.build(DeviceLayer)

  yield* logIdea("just-a-typo").pipe(Effect.provideContext(laptopDevice))
  // A moment later, so the phone's entry has the newer UUID v7 id
  yield* Effect.sleep("10 millis")
  yield* logIdea("new-parser").pipe(Effect.provideContext(phoneDevice))

  yield* printVault("laptop (offline)", laptopDevice)
  yield* printVault("phone (offline)", phoneDevice)

  // Signal comes back
  yield* goOnline(laptopDevice)
  yield* goOnline(phoneDevice)
  yield* waitForSync(2, laptopDevice, phoneDevice)

  yield* printVault("laptop (synced)", laptopDevice)
  yield* printVault("phone (synced)", phoneDevice)
})

program.pipe(Effect.scoped, withFreshStore, NodeRuntime.runMain)
