import test from 'ava'
import Promise from 'bluebird'
import { apiSetup } from '../src'
import path from 'path'
import { plugins } from 'duck-storage'
import Koa from 'koa'

export default function (setupOptions = {}, configOptions = {}) {
  const app = new Koa()

  test.before(async t => {
    let server

    await new Promise((resolve, reject) => {
      server = app.listen(3000, '0.0.0.0', (err) => {
        if (err) {
          return reject(err)
        }
        resolve()
      })
    })

    try {
      await apiSetup({
        app,
        server,
        entitiesPrefix: '/entities',
        routesPrefix: '/api',
        entitiesDir: path.join(__dirname, '../src/lib/fixtures/app-test/entities'),
        ...setupOptions
      }, {
        duckStorageSettings: {
          plugins: [plugins.InMemory]
        },
        plugins: [({ router }) => {
          router.use((ctx, next) => {
            return next()
          })
          router.get('/some-plugin', ctx => ctx.body = 'some plugin here!')
          router.get('/params', ctx => {
            ctx.body = ctx.$pleasure.get
          })
        }],
        ...configOptions
      })
    } catch (err) {
      console.log('HORROR!!!')
      throw err
    }
    t.log('server started')
  })
}


