export class RepositoryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RepositoryError'
  }
}

export class UnknownCollectionError extends RepositoryError {
  constructor(collection: string) {
    super(`Unknown collection: ${collection}`)
    this.name = 'UnknownCollectionError'
  }
}

export class UnknownFieldError extends RepositoryError {
  constructor(collection: string, field: string) {
    super(`Unknown field '${field}' on collection '${collection}'`)
    this.name = 'UnknownFieldError'
  }
}

export class UnknownOperatorError extends RepositoryError {
  constructor(field: string, operator: string) {
    super(`Unsupported where operator '${operator}' on field '${field}'`)
    this.name = 'UnknownOperatorError'
  }
}

export class InvalidSortError extends RepositoryError {
  constructor(sort: string) {
    super(`Invalid sort: '${sort}'`)
    this.name = 'InvalidSortError'
  }
}

export class InvalidMoneyError extends RepositoryError {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidMoneyError'
  }
}

export class JsonFieldError extends RepositoryError {
  constructor(
    field: string,
    reason: string,
    options?: ErrorOptions,
  ) {
    super(`JSON field '${field}': ${reason}`, options)
    this.name = 'JsonFieldError'
  }
}

export class DocumentNotFoundError extends RepositoryError {
  constructor(collection: string, id: string | number) {
    super(`Document not found: ${collection}#${String(id)}`)
    this.name = 'DocumentNotFoundError'
  }
}

export class GuardAccessError extends RepositoryError {
  constructor(collection: string, operation: string, reason?: string) {
    super(`Access denied: ${operation} ${collection}${reason ? ` (${reason})` : ''}`)
    this.name = 'GuardAccessError'
  }
}
