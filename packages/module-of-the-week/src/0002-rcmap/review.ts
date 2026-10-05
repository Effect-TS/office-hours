import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Effect, Exit, Layer, Scope } from "effect"
import { Git } from "./git.ts"
import { Repository } from "./repository.ts"

const reviewDependencies = (repository: Repository, path: string): Effect.Effect<void> =>
  Effect.log(`Reviewing dependencies for: ${repository.identifier} at ${path}`).pipe(
    Effect.andThen(Effect.sleep("2 seconds")),
  )

const reviewCode = (repository: Repository, path: string): Effect.Effect<void> =>
  Effect.log(`Reviewing code for: ${repository.identifier} at ${path}`).pipe(
    Effect.andThen(Effect.sleep("4 seconds")),
  )

const MainLayer = Git.layer.pipe(Layer.provide(NodeServices.layer))

const program = Effect.gen(function* () {
  const git = yield* Git

  const repository = new Repository({
    url: "acme/api",
    commit: "a1b2c3d",
  })

  // WARNING: Lower level scope APIs in use - beware
  const scope = yield* Effect.scope
  const childScope = yield* Scope.fork(scope)

  // 0 references -> 1 reference
  const dependencyReview = git.checkout(repository).pipe(
    Effect.flatMap((path) => reviewDependencies(repository, path)),
    Effect.provideService(Scope.Scope, childScope),
  )

  // 1 reference -> 2 references
  const codeReview = git.checkout(repository).pipe(
    Effect.flatMap((path) => reviewCode(repository, path)),
    Effect.provideService(Scope.Scope, childScope),
  )

  yield* Effect.all([dependencyReview, codeReview], {
    concurrency: "unbounded",
  })

  yield* Effect.sleep("5 seconds")

  yield* Scope.close(childScope, Exit.void)
})

program.pipe(Effect.scoped, Effect.provide(MainLayer), NodeRuntime.runMain)
