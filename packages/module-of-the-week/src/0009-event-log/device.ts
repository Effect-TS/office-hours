import { Clock, Config, Context, Effect, Layer, Schedule } from "effect"
import { EventJournal, EventLog, EventLogMessage, EventLogRemote } from "effect/eventlog"
import { RpcClient, RpcSerialization } from "effect/rpc"
import { Socket } from "effect/socket"
import { VaultEvents } from "./events.ts"
import { Vault, VaultHandlers } from "./handlers.ts"
import { RowEvents, RowHandlers } from "./row.ts"

export const schema = EventLog.schema(VaultEvents)
export const rowSchema = EventLog.schema(RowEvents)

// Copied from EventLog.encodeIdentityString. A demo identity: run identity.ts
// to make your own, and never commit a real one.
const identityString =
  "eyJwdWJsaWNLZXkiOiJjYWQ2NzRkMC00Zjc2LTRhYzMtYTMxMC1iYmE5OTZiYmZmZjAiLCJwcml2YXRlS2V5IjoiMTVpTlVvV3hmcU8xUW1vYllOZTlsR0dMMEtNSjFaSWtidlNWc0d5aGxKRT0ifQ"

export const IdentityLayer = Layer.succeed(
  EventLog.Identity,
  EventLog.decodeIdentityString(identityString),
)

// Local device runtime: Vault + EventJournal + shared Identity
export const DeviceLayer = EventLog.layer(schema, VaultHandlers).pipe(
  Layer.provideMerge(Vault.layer),
  Layer.provide(EventJournal.layerMemory),
  Layer.provide(IdentityLayer),
)

// The same runtime for the EventRow example in row.ts
export const RowDeviceLayer = EventLog.layer(rowSchema, RowHandlers).pipe(
  Layer.provideMerge(Vault.layer),
  Layer.provide(EventJournal.layerMemory),
  Layer.provide(IdentityLayer),
)

// Encrypted sync talks to server.ts. Run with UNENCRYPTED=true to use
// EventLogRemote.layerUnencrypted and server-unencrypted.ts instead. Both
// layers take the exact same dependencies.
const RemoteProtocolLayer = Layer.unwrap(
  Effect.gen(function* () {
    const unencrypted = yield* Config.Boolean("UNENCRYPTED").pipe(Config.withDefault(false))
    return unencrypted ? EventLogRemote.layerUnencrypted : EventLogRemote.layerEncrypted
  }),
)

// Syncs entries with the server over WebSocket
export const RemoteLayer = RemoteProtocolLayer.pipe(
  Layer.provide(RpcClient.layerProtocolSocket()),
  Layer.provide(Socket.layerWebSocket("ws://localhost:3000/sync")),
  Layer.provide(Socket.layerWebSocketConstructorGlobal),
  Layer.provide(RpcSerialization.layerSchemaBinary()),
)

export const SyncedDeviceLayer = RemoteLayer.pipe(Layer.provideMerge(DeviceLayer))

type Device = Context.Context<EventLog.EventLog | EventLog.Registry | Vault>

// Connects a device that's already running to the sync server. It stays
// online until the surrounding scope closes.
export const goOnline = (device: Device) =>
  Layer.build(RemoteLayer.pipe(Layer.provide(Layer.succeedContext(device))))

// Waits until every device has the same number of journal entries
export const waitForSync = (entries: number, ...devices: ReadonlyArray<Device>) =>
  Effect.forEach(devices, (device) =>
    EventLog.EventLog.use((log) => log.entries).pipe(Effect.provideContext(device)),
  ).pipe(
    Effect.repeat({
      until: (journals) => journals.every((journal) => journal.length === entries),
      schedule: Schedule.spaced("50 millis"),
    }),
    Effect.timeoutOrElse({
      duration: "10 seconds",
      orElse: () => Effect.die("Devices didn't sync. Is server.ts running?"),
    }),
    Effect.asVoid,
  )

export const printVault = (name: string, device: Device) =>
  Vault.use((vault) => vault.all).pipe(
    Effect.flatMap((ideas) => Effect.log(name, ideas)),
    Effect.provideContext(device),
  )

// The server keeps every run's entries, so each run syncs to a store of its own
// and starts from an empty vault
export const withFreshStore = <A, E, R>(self: Effect.Effect<A, E, R>) =>
  Effect.flatMap(Clock.currentTimeMillis, (now) =>
    Effect.provideService(
      self,
      EventLog.CurrentStoreId,
      EventLogMessage.StoreId.make(`vault-${now}`),
    ),
  )
