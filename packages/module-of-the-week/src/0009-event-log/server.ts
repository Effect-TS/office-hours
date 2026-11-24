import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Effect, Layer } from "effect"
import { Hex } from "effect/encoding"
import { EventLogServerEncrypted } from "effect/eventlog"
import { HttpRouter } from "effect/http"
import { RpcSerialization, RpcServer } from "effect/rpc"
import { createServer } from "node:http"

// In-memory storage that logs what the server receives. It only ever sees
// encrypted bytes, so it can't read the vault.
const StorageLayer = Layer.effect(
  EventLogServerEncrypted.Storage,
  Effect.gen(function* () {
    const storage = yield* EventLogServerEncrypted.makeStorageMemory
    return EventLogServerEncrypted.Storage.of({
      ...storage,
      write: (publicKey, storeId, batches) =>
        Effect.forEach(batches, (batch) =>
          Effect.log(
            `${batch.entryIds.length} encrypted entries:`,
            `${Hex.encode(batch.encryptedBatch).slice(0, 48)}...`,
          ),
        ).pipe(Effect.andThen(storage.write(publicKey, storeId, batches))),
    })
  }),
)

// Encrypted sync server: stores and forwards entries it can't decrypt
const ServerLayer = EventLogServerEncrypted.layer.pipe(
  Layer.provide(StorageLayer),
  // Devices connect over WebSocket at ws://localhost:3000/sync
  Layer.provide(RpcServer.layerProtocolWebsocket({ path: "/sync" })),
  Layer.provide(RpcSerialization.layerSchemaBinary()),
  HttpRouter.serve,
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
)

Layer.launch(ServerLayer).pipe(NodeRuntime.runMain)
