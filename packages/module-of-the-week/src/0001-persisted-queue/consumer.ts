import { Effect, Layer } from "effect"
import { PostsQueue, LayerSql } from "./queue.ts"
import { Deslopper, DeslopperLayer } from "./deslopper.ts"

const worker = Effect.gen(function* () {
  const queue = yield* PostsQueue
  const deslopper = yield* Deslopper

  return yield* queue
    .take((job, _metadata) => deslopper.deslop(job))
    .pipe(
      Effect.catchTag("DeslopError", Effect.logError),
      Effect.forever, // Continue taking work from the queue forever
    )
})

const WorkerLayer = Layer.merge(LayerSql, DeslopperLayer)

void worker.pipe(
  // oxlint-disable-next-line effecttsgo/strict-effect-provide
  Effect.provide(WorkerLayer),
  Effect.runPromise,
)
