import { Effect } from "effect"
import { Dad } from "./Dad.ts"

// The parts of Slack's `message` event that DadBot uses
export interface SlackMessageEvent {
  readonly channel: string
  readonly user: string
  readonly text: string
  // Unique within the channel, and the same every time Slack sends the event
  readonly ts: string
}

// DadBot's webhook handler, called with the message from Slack's event
// once the request's signature has been checked
export const handleMessage = Effect.fn("handleMessage")(function* (event: SlackMessageEvent) {
  const makeDad = yield* Dad.client

  // Returns once the message is saved to the database
  yield* makeDad(event.channel).NewMessage(
    // `ts` is the same every time Slack sends this message
    { messageId: event.ts, from: event.user, text: event.text },
    { discard: true },
  )

  // The HTTP route around this replies to Slack once it returns
})
