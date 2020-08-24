import test from 'ava'
import jwtDecode from 'jwt-decode'
import { verify, sign } from 'jsonwebtoken'
import { jwtAccess } from './jwt-access.js'

const jwtKey = 'some-secret'

const findMiddlewareByPath = (routerMock, pathName, index = 0) => {
  return routerMock._use.filter(([p], index) => {
    return (typeof pathName === 'string' && p === pathName) || (typeof pathName === 'number' && pathName === index)
  })[0][index + (typeof pathName === 'string' ? 1 : 0)]
}

const routerMock = () => {
  return {
    _use: [],
    use (...args) {
      this._use.push(args)
    }
  }
}

const next = () => {}

const ctxMock = ({ body = {}, cookies = {}, headers = {} } = {}) => {
  return {
    body: null,
    $pleasure: {
      body
    },
    request: {
      headers
    },
    cookies: {
      _cookies: cookies,
      set (name, ...args) {
        this._cookies[name] = args
      },
      get (name) {
        return Array.isArray(this._cookies[name]) ? this._cookies[name][0] : this._cookies[name]
      }
    }
  }
}

test(`Signs JWT sessions`, async t => {
  // initialize
  const plugin = jwtAccess(jwtKey, v => v)

  const ctx = ctxMock({
    body: {
      name: 'Martin',
      email: 'tin@devtin.io'
    }
  })

  const router = routerMock()
  plugin({ router })

  // 0 = index of the use() call; 2 = index of the argument passed to the use() fn
  const middleware = findMiddlewareByPath(router, 'auth', 1)

  // running middleware
  await t.notThrowsAsync(() => middleware(ctx))

  const { accessToken } = ctx.body

  t.truthy(accessToken)
  t.log(`An access token was returned in the http response`)

  t.truthy(ctx.cookies.get('accessToken'))
  t.log(`A cookie named 'accessToken' was set`)

  t.is(accessToken, ctx.cookies.get('accessToken'))
  t.log(`Access cookie token and http response token match`)

  const decodeToken = jwtDecode(accessToken)

  t.is(decodeToken.name, ctx.$pleasure.body.name)
  t.is(decodeToken.email, ctx.$pleasure.body.email)
  t.log(`Decoded token contains the data requested to sign`)

  t.notThrows(() => verify(accessToken, jwtKey))
  t.log(`token was signed using given secret`)
})

test(`Validates provided token via head or cookie and sets $pleasure.user when valid`, async t => {
  // initialize
  const plugin = jwtAccess(jwtKey, v => v)
  const router = routerMock()

  plugin({ router })

  const middleware = findMiddlewareByPath(router, 0)
  const accessToken = sign({ name: 'Martin' }, jwtKey)

  const ctx = ctxMock({
    cookies: {
      accessToken
    }
  })

  t.notThrows(() => middleware(ctx, next))

  t.truthy(ctx.$pleasure.user)
  t.is(ctx.$pleasure.user.name, 'Martin')

  const err = await t.throwsAsync(() => middleware(ctxMock({
    cookies: {
      accessToken: sign({ name: 'Martin' }, '123')
    }
  }), next))

  t.is(err.message, 'Unauthorized')
  t.is(err.code, 401)

  const err2 = await t.throwsAsync(() => middleware(ctxMock({
    cookies: {
      accessToken
    },
    headers: {
      authorization: `Bearer ${ accessToken }1`
    }
  }), next))

  t.is(err2.message, 'Bad request')
  t.is(err2.code, 400)
})
