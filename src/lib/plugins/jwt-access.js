import { sign, verify } from 'jsonwebtoken'
import cookie from 'cookie'

/**
 * @param {Object} options
 * @param {String} options.privateKey
 * @param {String} [options.headerName=authorization]
 * @param {String} [options.cookieName=accessToken]
 * @param {String} [options.algorithm=HS256] - see https://www.npmjs.com/package/jsonwebtoken#jwtverifytoken-secretorpublickey-options-callback
 * @param {Number|String} [options.expiresIn=15 * 60]
 * @return {Function}
 */
export function jwtAccess ({
  cookieName = 'accessToken',
  headerName = 'authorization',
  privateKey,
  algorithm = 'HS256',
  expiresIn = '15m', // 15 minutes
  deliveryGroup = () => false
} = {}) {
  return function ({ app, io }) {
    const isValid = (token) => {
      try {
        const user = verify(token, privateKey)
        return (user.exp * 1000) > Date.now() ? user : false
      } catch (err) {
        return false
      }
    }

    const validateToken = (token) => {
      const user = isValid(token)

      if (!user) {
        throw new Error('Invalid token')
      }

      return user
    }

    const getTokenFromHeaders = (headers) => {
      const auth = headers[headerName] || ''
      if (/^Bearer /.test(auth)) {
        return auth.replace(/^Bearer[\s]+(.*)$/, '$1')
      }
    }

    const getTokenFromCookies = (cookies) => {
      return cookie.parse(cookies || '')[cookieName]
    }

    app.use((ctx, next) => {
      ctx.$pleasure.session = {
        // todo: introduce proper options
        authorize (userData, {
          signIn = true,
          tokenSignOptions = {},
          refreshTokenSignOptions = {}
        } = {}) {
          const accessToken = sign(userData, privateKey, {
            algorithm,
            expiresIn,
            ...tokenSignOptions
          })

          // todo: make valid refreshToken
          const refreshToken = sign(userData, privateKey, {
            algorithm,
            expiresIn,
            ...refreshTokenSignOptions
          })

          if (signIn) {
            ctx.cookies.set(cookieName, accessToken)
            ctx.$pleasure.user = ctx.$pleasure.state.user = isValid(accessToken)
          }

          return {
            accessToken,
            refreshToken
          }
        },
        destroy () {
          // todo: maybe introduce async fn for optional callback
          ctx.cookies.set(cookieName, null)
          ctx.$pleasure.user = ctx.$pleasure.state.user = null
        },
        get user () {
          return ctx.$pleasure.user
        },
        isValid
      }
      return next()
    })

    app.use((ctx, next) => {
      const getToken = () => {
        return getTokenFromHeaders(ctx.req.headers) || ctx.cookies.get(cookieName)
      }

      const token = getToken()

      if (token) {
        const user = isValid(token)

        if (!user) {
          ctx.$pleasure.session.destroy()
          throw new Error('Invalid token')
        }

        ctx.$pleasure.user = user
        ctx.$pleasure.state.user = user
      }

      return next()
    })

    io.use((socket, next) => {
      const accessToken = getTokenFromHeaders(socket.request.headers) || getTokenFromCookies(socket.request.headers.cookie)
      let user

      if (accessToken) {
        try {
          user = validateToken(accessToken)
        } catch (err) {
          return next(err)
        }
      }

      const group = deliveryGroup(user)

      if (group) {
        socket.join(group)
      }

      return next()
    })
  }
}
