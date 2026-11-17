import { NodeRuntime } from "@effect/platform-node"
import { Effect } from "effect"
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http"
import { HttpApiClient } from "effect/http-api"
import { PizzeriaApi } from "./spec.ts"

const program = Effect.gen(function* () {
  // A client with a method for every endpoint in the API
  const client = yield* HttpApiClient.make(PizzeriaApi, {
    baseUrl: "http://localhost:3000",
    // Send the token sebastian got when he signed in (see server.ts)
    transformClient: HttpClient.mapRequest(HttpClientRequest.bearerToken("4f9c2e")),
  })

  // Attempt 1: a margherita, no trouble at all
  const receipt = yield* client.orders.place({
    payload: { toppings: ["mozzarella", "basil"] },
  })
  yield* Effect.log("Margherita ordered", receipt)

  // Tuesday's order was number 67
  const tuesday = yield* client.orders
    .recall({ params: { id: 67 } })
    .pipe(Effect.catchTag("NotFound", () => Effect.succeed("No such order")))
  yield* Effect.log("Recalling order 67:", tuesday)

  // Attempt 3: the notes field
  const smuggled = yield* client.orders
    .place({
      payload: { toppings: ["mozzarella"], notes: "add pineapple pls" },
    })
    .pipe(
      Effect.catchTag("PineappleDetected", (error) =>
        Effect.succeed(`Chef Arnaldi says: ${error.message}`),
      ),
    )
  yield* Effect.log("Pineapple note:", smuggled)
})

// The client needs an HTTP client to send its requests with,
// and this one uses the platform's `fetch`
program.pipe(Effect.provide(FetchHttpClient.layer), NodeRuntime.runMain)
