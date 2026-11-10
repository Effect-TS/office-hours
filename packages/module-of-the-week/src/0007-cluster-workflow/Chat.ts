import { Context, Effect, Layer } from "effect"

export interface ChatService {
  readonly reply: (chat: string, text: string) => Effect.Effect<string>
  readonly reactionCount: (chat: string, ts: string) => Effect.Effect<number>
}

export class Chat extends Context.Service<Chat, ChatService>()("Chat") {}

// Local Slack mock. Nobody reacts, so Dad always explains the joke.
export const ChatLayer = Layer.succeed(Chat)({
  reply: (chat, text) =>
    Effect.gen(function* () {
      yield* Effect.log(chat + " · DadBot: " + text)
      return crypto.randomUUID()
    }),
  reactionCount: (_chat, _ts) => Effect.succeed(0),
})
