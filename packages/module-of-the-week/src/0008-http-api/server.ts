import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Effect, Layer, Option, Redacted } from "effect"
import { HttpRouter } from "effect/http"
import { HttpApiBuilder, HttpApiError, HttpApiMiddleware, HttpApiScalar } from "effect/http-api"
import { createServer } from "node:http"
import { Chef, ChefLayer } from "./chef.ts"
import {
  Authentication,
  Customer,
  MenuCheck,
  NotOnTheMenu,
  PineappleDetected,
  PizzeriaApi,
} from "./spec.ts"

// A handler for every endpoint in the "orders" group
const OrdersLayer = HttpApiBuilder.group(PizzeriaApi, "orders", (handlers) =>
  Effect.gen(function* () {
    const chef = yield* Chef

    return handlers.handleAll({
      place: Effect.fn(function* ({ payload }) {
        const customer = yield* Customer
        if (/pineapple/i.test(payload.notes ?? "")) {
          return yield* new PineappleDetected({ message: `Nice try, ${customer.name}.` })
        }
        return yield* chef.cook(payload.toppings)
      }),
      recall: Effect.fn(function* ({ params }) {
        const receipt = yield* chef.remember(params.id)
        if (Option.isNone(receipt)) {
          return yield* new HttpApiError.NotFound()
        }
        return receipt.value
      }),
    })
  }),
)

// What the server says when a schema turns an order away
const MenuCheckLayer = HttpApiMiddleware.layerSchemaErrorTransform(MenuCheck, () =>
  Effect.fail(new NotOnTheMenu({ message: "That is simply not possible." })),
)

// A mock of a real sign-in system, just for this example.
// It maps each signed-in token to the customer it belongs to.
const signedIn = new Map([
  ["4f9c2e", "sebastian"],
  ["b71d08", "maxwell"],
])

const AuthenticationLayer = Layer.succeed(Authentication, {
  token: (httpEffect, { credential }) => {
    const name = signedIn.get(Redacted.value(credential))
    return name === undefined
      ? Effect.fail(new HttpApiError.Unauthorized())
      : Effect.provideService(httpEffect, Customer, { name })
  },
})

// The server for the whole API
const ServerLayer = HttpApiBuilder.layer(PizzeriaApi).pipe(
  // The handlers for the "orders" group
  Layer.provide(OrdersLayer),
  // Everything else the server needs
  Layer.provide([
    // Chef Arnaldi, for the handlers to call
    ChefLayer,
    // What the server says when a schema turns an order away
    MenuCheckLayer,
    // Checks who's ordering, before anything else
    AuthenticationLayer,
    // A documentation page at /docs, built from the API specification
    HttpApiScalar.layer(PizzeriaApi),
  ]),
  // Serve the API's routes over HTTP
  HttpRouter.serve,
  // A Node HTTP server, listening on port 3000
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
)

Layer.launch(ServerLayer).pipe(NodeRuntime.runMain)
