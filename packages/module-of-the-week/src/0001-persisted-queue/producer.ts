import { Effect } from "effect"
import { PostsQueue, LayerSql } from "./queue.ts"

// Hypothetical API endpoint
// - User sends us a LinkedIn post for us to de-slop
// - Enqueue post details into our queue
// - Respond to the user letting them know if their request was successful
// - Asynchronously process the post on a worker later
const api = Effect.gen(function* () {
  const queue = yield* PostsQueue

  const payload = {
    postId: "043",
    text:
      "I'm humbled and beyond thrilled to announce that I got promoted. " +
      "This isn't about a title. It's about showing up as my authentic self.",
  }

  // Passing an `id` in the second parameter will deduplicate jobs
  yield* queue.offer(payload, { id: payload.postId })
  yield* queue.offer(payload, { id: payload.postId })
  yield* queue.offer(payload, { id: payload.postId })
  yield* queue.offer(payload, { id: payload.postId })
  yield* queue.offer(payload, { id: payload.postId })
  yield* queue.offer(payload, { id: payload.postId })
  yield* queue.offer(payload, { id: payload.postId })
  yield* queue.offer(payload, { id: payload.postId })

  // Return HTTP Response
})

void api.pipe(
  // oxlint-disable-next-line effecttsgo/strict-effect-provide
  Effect.provide(LayerSql),
  Effect.runPromise,
)
