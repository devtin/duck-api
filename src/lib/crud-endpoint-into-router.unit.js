import test from 'ava'
import { crudEndpointIntoRouter } from './crud-endpoint-into-router.js'
import sinon from 'sinon'

const sandbox = sinon.createSandbox()
const koaRouterMock = {
  use () {},
  post () {},
  get () {},
  patch () {},
  delete () {},
  put () {}
}

test.beforeEach(t => {
  sandbox.spy(koaRouterMock)

  t.false(koaRouterMock.post.calledOnce)
  t.false(koaRouterMock.get.calledOnce)
  t.false(koaRouterMock.patch.calledOnce)
  t.false(koaRouterMock.delete.calledOnce)
})

test(`Hooks ApiEndpoint into a koa router`, t => {
  crudEndpointIntoRouter(koaRouterMock, {
    create: { handler () { } },
    read: { handler () { } },
    update: { handler () { } },
    delete: { handler () { } }
  })
  t.true(koaRouterMock.post.calledOnce)
  t.true(koaRouterMock.get.calledOnce)
  t.true(koaRouterMock.patch.calledOnce)
  t.true(koaRouterMock.delete.calledOnce)
})
