abstract class SpawnError extends Error {
  constructor (message: string) {
    super(message)
    this.name = this.getName()
  }

  protected abstract getName (): string
}

export = SpawnError
