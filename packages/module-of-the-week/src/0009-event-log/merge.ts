import { NodeRuntime } from "@effect/platform-node"
import { Effect, Exit, Layer, Scope } from "effect"
import { EventLog } from "effect/eventlog"
import {
  goOnline,
  printVault,
  RowDeviceLayer,
  rowSchema,
  waitForSync,
  withFreshStore,
} from "./device.ts"
import { IdeaRow } from "./row.ts"

// Start server.ts first. Both devices patch different fields of the same row
// while offline. EventRow keeps both changes.

const write = (item: ReturnType<typeof IdeaRow.set | typeof IdeaRow.patch>) =>
  Effect.gen(function* () {
    const client = yield* EventLog.makeClient(rowSchema)
    yield* client(item)
  })

const program = Effect.gen(function* () {
  const laptopDevice = yield* Layer.build(RowDeviceLayer)
  const phoneDevice = yield* Layer.build(RowDeviceLayer)

  // Online: the laptop logs the idea and both devices sync it
  const online = yield* Scope.make()
  yield* goOnline(laptopDevice).pipe(Scope.provide(online))
  yield* goOnline(phoneDevice).pipe(Scope.provide(online))

  yield* write(
    IdeaRow.set({ slug: "readme-typo", pitch: "just-a-typo", domains: 3, shipped: false }),
  ).pipe(Effect.provideContext(laptopDevice))
  yield* waitForSync(1, laptopDevice, phoneDevice)

  // Offline: each device patches a different field
  yield* Scope.close(online, Exit.void)
  yield* write(IdeaRow.patch("readme-typo", { domains: 4 })).pipe(
    Effect.provideContext(laptopDevice),
  )
  yield* Effect.sleep("10 millis")
  yield* write(IdeaRow.patch("readme-typo", { pitch: "new-parser" })).pipe(
    Effect.provideContext(phoneDevice),
  )

  yield* printVault("laptop (offline)", laptopDevice)
  yield* printVault("phone (offline)", phoneDevice)

  // Back online: EventRow merges the patches field by field
  yield* goOnline(laptopDevice)
  yield* goOnline(phoneDevice)
  yield* waitForSync(3, laptopDevice, phoneDevice)

  yield* printVault("laptop (synced)", laptopDevice)
  yield* printVault("phone (synced)", phoneDevice)
})

program.pipe(Effect.scoped, withFreshStore, NodeRuntime.runMain)
