import { NodeRuntime } from "@effect/platform-node"
import { Effect, Layer } from "effect"
import { EventLog } from "effect/eventlog"
import { printVault, schema, SyncedDeviceLayer, waitForSync, withFreshStore } from "./device.ts"

// Start server.ts first. The laptop and phone write to different ideas, then
// both end up with the same vault.

const laptop = Effect.gen(function* () {
  const client = yield* EventLog.makeClient(schema)
  yield* client({
    event: "IdeaLogged",
    payload: {
      slug: "readme-typo",
      pitch: "just-a-typo",
    },
  })
  yield* client({
    event: "NerdSniped",
    payload: {
      slug: "readme-typo",
      pitch: "custom AST",
      domains: 3,
    },
  })
})

const phone = Effect.gen(function* () {
  const client = yield* EventLog.makeClient(schema)
  yield* client({
    event: "IdeaLogged",
    payload: {
      slug: "regex-engine",
      pitch: "zero-dep NFA",
    },
  })
})

const program = Effect.gen(function* () {
  // Each build gets its own Vault and EventJournal
  const laptopDevice = yield* Layer.build(SyncedDeviceLayer)
  const phoneDevice = yield* Layer.build(SyncedDeviceLayer)

  yield* laptop.pipe(Effect.provideContext(laptopDevice))
  yield* phone.pipe(Effect.provideContext(phoneDevice))

  yield* waitForSync(3, laptopDevice, phoneDevice)
  yield* printVault("laptop", laptopDevice)
  yield* printVault("phone", phoneDevice)
})

program.pipe(Effect.scoped, withFreshStore, NodeRuntime.runMain)
