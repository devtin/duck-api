import { sign, verify } from 'jsonwebtoken'
import { ApiError } from '../api-error.js'
import { apiSchemaValidationMiddleware } from '../api-schema-validation-middleware.js'

/**
 * @typedef {Object} Authorization
 * @property {Object} user
 * @property {Number} [expiration]
 * @property {String} [algorithm]
 */

/**
 * @typedef {Function} Authorizer
 * @param {Object} payload - Given payload (matched by given schema body, if any)
 * @return {Authorization|void}
 */

/**
 * @param {String} jwtKey - SSL private key to issue JWT
 * @param {Authorizer} authorizer
 * @param {Object} options
 * @param {String} [options.jwt.headerName=authorization]
 * @param {String} [options.jwt.cookieName=accessToken]
 * @param {Schema|Boolean} [options.jwt.body=true]
 * @param {String} [options.jwt.algorithm=HS256]
 * @param {String} [options.jwt.expiresIn=15 * 60]
 * @emits {Object} created - When a token has been issued
 * @emits {Object} created - When a token has been issued
 * @return {ApiPlugin}
 *
 * @example
 * // pleasure.config.js
 * {
 *   plugins: [
 *     jwtAccess(jwtKey, authorizer, { jwt: { body: true, algorithm: 'HS256', expiryIn: 15 * 60 * 60 } })
 *   ]
 * }
 */
export function jwtAccess ({
  cookieName = 'accessToken',
  headerName = 'authorization',
  algorithm = 'HS256',
  expiresIn = 15 * 60, // 15 minutes
  body = true,
  jwtKey,
  auth: {

  },
  authPath = 'auth',
  revokePath = 'revoke',
  authorize,
  serializer // async function that receives a payload and returns the payload that needs to be serialized
} = {}) {
  return function ({ router, app, server, io, pls }) {
    /**
     *
     */
    router.use(async (ctx, next) => {
      // two tokens passed (cookie + header) and are distinct => throw
      // token is invalid / expired => throw
      const cookieToken = ctx.cookies.get(cookieName)
      const headerToken = (ctx.request.headers[headerName] || '').replace(/^Bearer /i, '')

      if (cookieToken && headerToken && cookieToken !== headerToken) {
        throw new ApiError(400, `Bad request`)
      }

      const token = headerToken || cookieToken
      if (token) {
        try {
          ctx.$pleasure.user = verify(token, jwtKey)
        } catch (err) {
          throw new ApiError(401, `Unauthorized`)
        }
      }

      return next()
    })

    return [
      {
        path: authPath,
        description: 'exchanges credentials for access and refresh tokens',
        async create (ctx) {
          await sign(await authorizer(ctx))
        }
      }
    ]
  }
}
