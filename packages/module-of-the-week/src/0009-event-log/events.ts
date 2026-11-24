import { Schema } from "effect"
import { EventGroup } from "effect/eventlog"

export const VaultEvents = EventGroup.empty
  .add({
    tag: "IdeaLogged",
    // Events with the same primaryKey belong to the same vault entry
    primaryKey: (payload) => payload.slug,
    // Validates the payload and encodes it to bytes for storage and sync
    payload: Schema.Struct({
      slug: Schema.String,
      pitch: Schema.String,
    }),
  })
  .add({
    tag: "NerdSniped",
    primaryKey: (payload) => payload.slug,
    payload: Schema.Struct({
      slug: Schema.String,
      pitch: Schema.String,
      domains: Schema.Number,
    }),
  })
