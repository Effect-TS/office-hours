import { NodeRuntime } from "@effect/platform-node"
import { Console, Effect } from "effect"
import { EventLog, EventLogEncryption } from "effect/eventlog"

// Prints a new identity string. Paste it into device.ts to sync under your own identity.
const program = Effect.gen(function* () {
  const identity = yield* EventLog.makeIdentity
  yield* Console.log(EventLog.encodeIdentityString(identity))
})

program.pipe(Effect.provide(EventLogEncryption.layerSubtle), NodeRuntime.runMain)
