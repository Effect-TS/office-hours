import { Effect, Schema } from "effect"
import { ClusterSchema } from "effect/cluster"
import { SqlClient } from "effect/sql"
import { Activity, DurableClock, Workflow } from "effect/workflow"
import { Chat } from "./Chat.ts"
import { PunGenerator } from "./PunGenerator.ts"

export const Message = Schema.Struct({
  messageId: Schema.String,
  from: Schema.String,
  text: Schema.String,
})

// Dad couldn't come up with a joke
export class JokeError extends Schema.TaggedError<JokeError>()("JokeError", {
  cause: Schema.Defect(),
}) {}

export const TellJoke = Workflow.make("TellJoke", {
  payload: {
    // Which chat, and the batch of messages the joke is about
    chat: Schema.String,
    messages: Schema.Array(Message),
  },
  error: JokeError,
  // Same batch, same execution
  idempotencyKey: ({ chat, messages }) => `${chat}/${messages[0]!.messageId}`,
})

export const TellJokeLayer = TellJoke.toLayer(
  Effect.fn(function* ({ chat, messages }) {
    const punGenerator = yield* PunGenerator
    const slack = yield* Chat
    const sql = yield* SqlClient.SqlClient

    // Step 1: Write a joke
    const joke = yield* Activity.make({
      name: "WriteJoke",
      success: Schema.String,
      error: JokeError,
      execute: Effect.gen(function* () {
        const told = yield* sql<{ joke: string }>`
          SELECT joke FROM dad_jokes WHERE chat = ${chat}
        `
        const joke = yield* punGenerator.generate(messages, {
          told: new Set(told.map((row) => row.joke)),
        })
        yield* sql`INSERT INTO dad_jokes ${sql.insert({ chat, joke })}`
        return joke
      }).pipe(Effect.mapError((cause) => new JokeError({ cause }))),
    }).annotate(ClusterSchema.WithTransaction, true)

    // Step 2: Tell the joke
    const ts = yield* Activity.make({
      name: "PostJoke",
      success: Schema.String,
      execute: slack.reply(chat, joke),
    })

    // Step 3: give the room an hour
    yield* DurableClock.sleep({
      name: "WaitForLaughs",
      duration: "1 hour",
    })

    // Step 4: count the laughs
    const laughs = yield* Activity.make({
      name: "CountLaughs",
      success: Schema.Number,
      execute: slack.reactionCount(chat, ts),
    })

    // Step 5: if nobody laughed, they must not have got it
    if (laughs === 0) {
      yield* Activity.make({
        name: "ExplainJoke",
        execute: punGenerator
          .explain(joke)
          .pipe(Effect.flatMap((explanation) => slack.reply(chat, explanation))),
      })
    }
  }),
)
