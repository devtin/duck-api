import pick from 'lodash/pick'

/**
 *
 * @param {Function} access - callback function receives ctx
 * @param {object} thisContext - callback function receives ctx
 * @return {Function}
 */
export function responseAccessMiddleware (access, thisContext = {}) {
  return async (ctx, next) => {
    if (!access) {
      return next()
    }
    const resolveResultPaths = (pathsToPick, obj) => {
      if (typeof pathsToPick === 'boolean') {
        return  !pathsToPick ? {} : obj
      }
      if (Array.isArray(obj)) {
        return obj.map(v => pick(v, pathsToPick))
      }
      return pick(obj, pathsToPick)
    }
    const pathsToPick = await access.call(thisContext, ctx)

    // wait for output
    await next()

    if (ctx.body) {
      if (typeof pathsToPick === 'function') {
        ctx.body = resolveResultPaths(await pathsToPick(ctx.body), ctx.body)
      }
      else {
        ctx.body = resolveResultPaths(pathsToPick, ctx.body)
      }
    }
  }
}
