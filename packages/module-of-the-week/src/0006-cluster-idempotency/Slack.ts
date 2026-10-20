import { Effect } from "effect"
import { Dad } from "./Dad.ts"

export interface SlackMessageEvent {
  readonly channel: string
  readonly user: string
  readonly text: string
  readonly ts: string
}

export const handleMessage = Effect.fn("handleMessage")(function* (event: SlackMessageEvent) {
  const makeDad = yield* Dad.client

  yield* makeDad(event.channel).NewMessage(
    { messageId: event.ts, from: event.user, text: event.text },
    { discard: true },
  )
})
