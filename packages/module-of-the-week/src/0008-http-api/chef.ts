import { Context, Duration, Effect, Layer, Option } from "effect"
import type { Receipt } from "./spec.ts"

// Cooks every order, and remembers the ones worth remembering
export class Chef extends Context.Service<
  Chef,
  {
    readonly cook: (toppings: Receipt["toppings"]) => Effect.Effect<Receipt>
    readonly remember: (id: number) => Effect.Effect<Option.Option<Receipt>>
  }
>()("Chef") {}

// Chef Arnaldi, as a layer
export const ChefLayer = Layer.sync(Chef, () => {
  const cooked = new Map<number, Receipt>()
  return {
    cook: (toppings) =>
      Effect.sync(() => {
        const id = cooked.size + 1
        const receipt = { id, toppings, readyIn: Duration.minutes(10) }
        cooked.set(id, receipt)
        return receipt
      }),
    remember: (id) => Effect.sync(() => Option.fromUndefinedOr(cooked.get(id))),
  }
})
