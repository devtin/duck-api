import test from 'ava'
import axios from 'axios'
import { sign } from 'jsonwebtoken'
import { jwtAccess } from './jwt-access.js'
import apiSetup from '../../../test/api-setup.js'

const privateKey = 'secret'

apiSetup({}, {
  plugins: [
    jwtAccess({ privateKey }),
    ({ router }) => {
      router.post('/sign-in', (ctx) => {
        ctx.body = ctx.$pleasure.session.authorize(ctx.request.body)
      })
      router.get('/user', (ctx) => {
        ctx.body = ctx.$pleasure.session.user
      })
    }
  ]
})

test(`Signs JWT sessions`, async t => {
  const res = await axios.post('http://0.0.0.0:3000/sign-in', {
    fullName: 'pablo marmol'
  })

  t.is(res.headers['set-cookie'].filter((line) => {
    return /^accessToken=/.test(line)
  }).length, 1)

  t.truthy(res.data.accessToken)
  t.truthy(res.data.refreshToken)
})

test(`Validates provided token via head setting $pleasure.user when valid`, async t => {
  const userData = { name: 'pedro picapiedra' }
  const user = (await axios.get('http://0.0.0.0:3000/user', {
    headers: {
      authorization: `Bearer ${sign(userData, privateKey, { expiresIn: '1m' })}`
    }
  })).data

  t.like(user, userData)
})

test(`Validates provided token via cookie setting $pleasure.user when valid`, async t => {
  const userData = { name: 'pedro picapiedra' }
  const user = (await axios.get('http://0.0.0.0:3000/user', {
    headers: {
      Cookie: `accessToken=${sign(userData, privateKey, { expiresIn: '1m' })};`
    }
  })).data

  t.like(user, userData)
})

test(`Rejects token when expired`, async t => {
  const userData = { name: 'pedro picapiedra' }
  const error = (await axios.get('http://0.0.0.0:3000/user', {
    headers: {
      Cookie: `accessToken=${sign(userData, privateKey, { expiresIn: '0s' })};`
    }
  })).data


  t.like(error, {
    code: 500,
    error: {
      message: 'Invalid token'
    }
  })
})
