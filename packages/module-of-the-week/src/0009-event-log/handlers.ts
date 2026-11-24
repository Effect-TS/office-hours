import { Context, Effect, Layer } from "effect"
import { EventLog } from "effect/eventlog"
import { VaultEvents } from "./events.ts"

export interface Idea {
  readonly pitch: string
  readonly domains: number
}

// Separate service holding the projected state so anything can query it later
export class Vault extends Context.Service<
  Vault,
  {
    readonly set: (slug: string, idea: Idea) => Effect.Effect<void>
    readonly update: (slug: string, fields: Partial<Idea>) => Effect.Effect<void>
    readonly remove: (slug: string) => Effect.Effect<void>
    readonly all: Effect.Effect<Record<string, Idea>>
  }
>()("Vault") {
  static readonly layer = Layer.sync(Vault, () => {
    const map = new Map<string, Idea>()
    return Vault.of({
      set: (slug, idea) =>
        Effect.sync(() => {
          map.set(slug, idea)
        }),
      update: (slug, fields) =>
        Effect.sync(() => {
          const existing = map.get(slug)
          if (existing !== undefined) map.set(slug, { ...existing, ...fields })
        }),
      remove: (slug) =>
        Effect.sync(() => {
          map.delete(slug)
        }),
      all: Effect.sync(() => Object.fromEntries(map)),
    })
  })
}

// Build a Layer that registers a handler for every event in VaultEvents
export const VaultHandlers = EventLog.group(
  VaultEvents,
  Effect.fn(function* (handlers) {
    const vault = yield* Vault

    return (
      handlers
        // Runs on local writes and whenever this event replays from another device
        .handle(
          "IdeaLogged",
          Effect.fn(function* ({ payload, conflicts }) {
            // Skip older writes when a newer entry already exists
            if (conflicts.length > 0) return
            yield* vault.set(payload.slug, { pitch: payload.pitch, domains: 0 })
          }),
        )
        .handle("NerdSniped", ({ payload }) =>
          vault.update(payload.slug, {
            pitch: payload.pitch,
            domains: payload.domains,
          }),
        )
    )
  }),
)
