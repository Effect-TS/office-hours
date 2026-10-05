import { Context, Effect, Layer } from "effect"

export interface ChatService {
  readonly reply: (chat: string, text: string) => Effect.Effect<void>
}

export class Chat extends Context.Service<Chat, ChatService>()("Chat") {}

export const ChatLayer = Layer.succeed(Chat)({
  reply: (chat, text) => Effect.log(`${chat} · DadBot: ${text}`),
})
