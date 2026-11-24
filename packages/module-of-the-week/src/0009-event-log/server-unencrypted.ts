import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Effect, Layer } from "effect"
import { EventLog, EventLogServerUnencrypted } from "effect/eventlog"
import { HttpRouter } from "effect/http"
import { RpcSerialization, RpcServer } from "effect/rpc"
import { createServer } from "node:http"
import { VaultEvents } from "./events.ts"
import { RowEvents } from "./row.ts"

const schema = EventLog.schema(VaultEvents, RowEvents)

// The server decodes every entry, so it can run its own handlers. These log
// each event, but they could just as well index or query them.
const ServerVaultHandlers = EventLog.group(VaultEvents, (handlers) =>
  handlers
    .handle("IdeaLogged", ({ payload }) => Effect.log("IdeaLogged", payload))
    .handle("NerdSniped", ({ payload }) => Effect.log("NerdSniped", payload)),
)

const ServerRowHandlers = EventLog.group(RowEvents, (handlers) =>
  handlers.handle("idea", ({ payload }) => Effect.log("idea", payload)),
)

// Lets every identity read and write. A real server would check who's asking.
const AuthorizationLayer = Layer.succeed(EventLogServerUnencrypted.EventLogServerAuthorization, {
  authorizeWrite: () => Effect.void,
  authorizeRead: () => Effect.void,
  authorizeIdentity: () => Effect.void,
})

// Accepts any store id. Each demo run syncs to a store of its own.
const StoreMappingLayer = Layer.succeed(EventLogServerUnencrypted.StoreMapping, {
  resolve: ({ storeId }) => Effect.succeed(storeId),
  hasStore: () => Effect.succeed(true),
})

// Plaintext sync server: reads entries, runs handlers, then forwards them
const ServerLayer = EventLogServerUnencrypted.layer(
  schema,
  Layer.mergeAll(ServerVaultHandlers, ServerRowHandlers),
).pipe(
  Layer.provide([
    AuthorizationLayer,
    EventLogServerUnencrypted.layerStorageMemory,
    StoreMappingLayer,
  ]),
  Layer.provide(RpcServer.layerProtocolWebsocket({ path: "/sync" })),
  Layer.provide(RpcSerialization.layerSchemaBinary()),
  HttpRouter.serve,
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
)

Layer.launch(ServerLayer).pipe(NodeRuntime.runMain)
