import { Effect, Schema } from "effect"
import { EventGroup, EventLog, EventRow } from "effect/eventlog"
import { Vault } from "./handlers.ts"

export const IdeaRow = EventRow.make("idea", {
  key: "slug",
  schema: Schema.Struct({
    slug: Schema.String,
    pitch: Schema.String,
    domains: Schema.Number,
    shipped: Schema.Boolean,
  }),
})

export const RowEvents = EventGroup.empty.add(IdeaRow)

// EventRow.handler filters out fields overwritten by newer conflicts
export const RowHandlers = EventLog.group(
  RowEvents,
  Effect.fn(function* (handlers) {
    const vault = yield* Vault

    return handlers.handle(
      "idea",
      EventRow.handler(IdeaRow, {
        set: (row) => vault.set(row.slug, row),
        patch: (slug, fields) => vault.update(slug, fields),
        remove: (slug) => vault.remove(slug),
      }),
    )
  }),
)
