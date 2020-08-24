import test from 'ava'
import { responseAccessMiddleware } from './response-access-middleware.js'
import { EndpointHandler } from './schema'

test(`Filters response data`, async t => {
  const next = (ctx) => () => {
    Object.assign(ctx, { body: Body })
  }
  const Body = {
    firstName: 'Martin',
    lastName: 'Gonzalez',
    address: {
      street: '2451 Brickell Ave',
      zip: 33129
    }
  }
  const ctx = (level = 'nobody', body = Body) => {
    return {
      body: {},
      $pleasure: {
        state: {}
      },
      user: {
        level
      }
    }
  }
  const middleware = responseAccessMiddleware(EndpointHandler.schemaAtPath('access').parse(ctx => {
    if (ctx.user.level === 'nobody') {
      return false
    }
    if (ctx.user.level === 'admin') {
      return true
    }
    return ['firstName', 'lastName', 'address.zip']
  }))

  const nobodyCtx = ctx('nobody')
  await middleware(nobodyCtx, next(nobodyCtx))
  t.deepEqual(nobodyCtx.body, {})

  const userCtx = ctx('user')
  await middleware(userCtx, next(userCtx))
  t.deepEqual(userCtx.body, {
    firstName: 'Martin',
    lastName: 'Gonzalez',
    address: {
      zip: 33129
    }
  })

  const adminCtx = ctx('admin')
  await middleware(adminCtx, next(adminCtx))
  t.deepEqual(adminCtx.body, Body)
})

// test(`Response access `)
