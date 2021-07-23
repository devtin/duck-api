import { Duckfficer } from 'duck-storage'

const { ValidationError } = Duckfficer


/**
 * @name httpApiSetup.errorHandling
 * @param ctx
 * @param next
 * @return {Promise<void>}
 */
export async function errorHandling (ctx, next) {
  try {
    await next()
  } catch (error) {
    console.log(error)
    const { code = 500, message, errors } = error
    const resultedError = {
      code,
      error: {
        message
      }
    }
    if (errors) {
      resultedError.error.errors = errors.map(theError => ValidationError.prototype.toJSON.call(theError))
    }
    ctx.body = resultedError
  }
}
