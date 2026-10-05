import { Context, Data, Effect, FileSystem, Layer, RcMap, Scope } from "effect"
import { Repository } from "./repository.ts"

export class GitError extends Data.TaggedError("GitError")<{
  readonly repository: Repository
  readonly cause: unknown
}> {}

export interface GitService {
  readonly checkout: (repository: Repository) => Effect.Effect<string, GitError, Scope.Scope>
}

export class Git extends Context.Service<Git, GitService>()("Git", {
  make: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem

    const checkouts = yield* RcMap.make({
      // Lookup will only be invoked for non-existent keys in the map
      lookup: Effect.fnUntraced(
        function* (repository: Repository) {
          const dir = yield* fs.makeTempDirectoryScoped()
          yield* Effect.log(`Cloning ${repository.identifier} to: ${dir}`)
          yield* Effect.addFinalizer(() => Effect.log(`Removing: ${dir}`))
          return dir
        },
        (effect, repository) =>
          Effect.mapError(effect, (cause) => new GitError({ repository, cause })),
      ),
    })

    return {
      checkout: (repository) => RcMap.get(checkouts, repository),
    }
  }),
}) {
  static readonly layer = Layer.effect(this, this.make)
}
