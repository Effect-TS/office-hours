import { Data } from "effect"

export class Repository extends Data.Class<{
  readonly url: string
  readonly commit: string
}> {
  get identifier(): string {
    return `${this.url}@${this.commit}`
  }
}
