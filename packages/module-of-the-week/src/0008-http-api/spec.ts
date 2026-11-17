import { Context, Schema } from "effect"
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  HttpApiMiddleware,
  HttpApiSecurity,
  OpenApi,
} from "effect/http-api"

// Everything Chef Arnaldi is willing to put on a pizza
export const Topping = Schema.Literals(["sausage", "mozzarella", "basil", "mushrooms"]).annotate({
  description: "Pineapple is not a topping. Do not ask.",
})

// What a customer sends
export const Order = Schema.Struct({
  toppings: Schema.Array(Topping),
  // Anything the chef should know
  notes: Schema.optional(Schema.String),
})

// What the server sends back
export const Receipt = Schema.Struct({
  id: Schema.Int,
  toppings: Schema.Array(Topping),
  readyIn: Schema.Duration,
})
export type Receipt = typeof Receipt.Type

export class PineappleDetected extends Schema.TaggedError<PineappleDetected>()(
  "PineappleDetected",
  { message: Schema.String },
  // The status code this error is sent with
  { httpApiStatus: 422 },
) {}

export class NotOnTheMenu extends Schema.TaggedError<NotOnTheMenu>()(
  "NotOnTheMenu",
  { message: Schema.String },
  { httpApiStatus: 400 },
) {}

// Wraps every request, and speaks up when a schema says no
export class MenuCheck extends HttpApiMiddleware.Service<MenuCheck>()("MenuCheck", {
  error: NotOnTheMenu,
}) {}

// The customer who placed the order
export class Customer extends Context.Service<Customer, { readonly name: string }>()("Customer") {}

export class Authentication extends HttpApiMiddleware.Service<
  Authentication,
  // Every request it lets through comes with a Customer
  { provides: Customer }
>()("Authentication", {
  // What you get without a valid token
  error: HttpApiError.Unauthorized,
  // Customers send the token they got when they signed in
  security: { token: HttpApiSecurity.bearer },
}) {}

export const PizzeriaApi = HttpApi.make("pizzeria")
  .add(
    HttpApiGroup.make("orders").add(
      // POST /orders
      // Place an order
      HttpApiEndpoint.post("place", "/orders", {
        payload: Order,
        success: Receipt,
        error: PineappleDetected,
      })
        .annotate(OpenApi.Summary, "Order a pizza")
        .middleware(Authentication),
      // GET /orders/:id
      // Look up an order by its number
      HttpApiEndpoint.get("recall", "/orders/:id", {
        params: { id: Schema.Int },
        success: Receipt,
        error: HttpApiError.NotFound,
      }),
    ),
  )
  .middleware(MenuCheck)
