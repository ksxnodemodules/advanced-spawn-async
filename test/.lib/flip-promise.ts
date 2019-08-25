function flipPromise (promise: Promise<any>) {
  return promise.then(
    value => Promise.reject(new Error(`Expecting promise to rejects, but it resolves ${value}`)),
    reason => reason
  )
}

export = flipPromise
