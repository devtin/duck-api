import pick from 'lodash/pick'

/**
 *
 * @param {Function} access - callback function receives ctx
 * @return {Function}
 */
export function responseAccessMiddleware (access) {
  return async (ctx, next) => {
    if (!access) {
      return next()
    }
    // wait for output
    await next()

    if (ctx.body) {
      const pathsToPick = await access(ctx)
      if (typeof pathsToPick === 'boolean' && !pathsToPick) {
        ctx.body = {}
      }
      else if (typeof pathsToPick === 'object') {
        if (Array.isArray(ctx.body)) {
          ctx.body = ctx.body.map(v => pick(v, pathsToPick))
        } else {
          ctx.body = pick(ctx.body, pathsToPick)
        }
      }
    }
  }
}
