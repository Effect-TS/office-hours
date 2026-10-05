import { Context, Effect, Layer } from "effect"

export interface PunGeneratorOptions {
  readonly told: ReadonlySet<string>
}

export interface PunGeneratorService {
  readonly generate: (
    messages: ReadonlyArray<{ readonly from: string; readonly text: string }>,
    options: PunGeneratorOptions,
  ) => Effect.Effect<string>
}

export class PunGenerator extends Context.Service<PunGenerator, PunGeneratorService>()(
  "PunGenerator",
) {}

const jokes = [
  "I'd tell you a UDP joke, but you might not get it.",
  "It's not flaky. It's just going through a phase.",
  "I'd tell you a TCP joke, but I'd have to keep repeating it until you got it.",
  "Why did the developer go broke? He used up all his cache.",
  "I'm reading a book about anti-gravity. It's impossible to put down.",
  "There are 10 kinds of people: those who understand binary and those who don't.",
  "I would tell you a joke about race conditions, but you might get the punchline first.",
  "Why do programmers prefer dark mode? Because light attracts bugs.",
  "I told my kids a joke about recursion. Then I told them a joke about recursion.",
  "My code doesn't have bugs. It just develops random features.",
  "Why was the function so calm? It had no side effects.",
  "I'd make a joke about null, but it wouldn't be worth anything.",
  "Debugging is like being the detective in a crime movie where you're also the murderer.",
  "Why did the commit break up with the branch? It needed more space to grow.",
  "I tried to come up with a joke about distributed systems, but it never reached consensus.",
]

export const PunGeneratorLayer = Layer.succeed(PunGenerator)({
  generate: (_, { told }) =>
    Effect.sleep("2 seconds").pipe(Effect.as(jokes.find((joke) => !told.has(joke)) ?? jokes[0]!)),
})
