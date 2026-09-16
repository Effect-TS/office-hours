import { Context, Data, Effect, Layer } from "effect"
import { PostJob } from "./queue.ts"

export class DeslopError extends Data.TaggedError("DeslopError") {}

export class Deslopper extends Context.Service<
  Deslopper,
  { readonly deslop: (job: PostJob) => Effect.Effect<void, DeslopError> }
>()("Deslopper", {
  // oxlint-disable-next-line require-yield
  make: Effect.gen(function* () {
    return {
      deslop: (job: PostJob) =>
        Effect.log(job).pipe(
          Effect.andThen(Effect.sleep("10 seconds")),
          Effect.andThen(Effect.log("FAILING THE HANDLER")),
          Effect.andThen(Effect.fail(new DeslopError())),
        ),
    }
  }),
}) {}

export const DeslopperLayer = Layer.effect(Deslopper, Deslopper.make)
