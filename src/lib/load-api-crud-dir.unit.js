import { loadApiCrudDir } from './load-api-crud-dir.js'
import path from 'path'
import test from 'ava'

test(`translates directory into routes`, async t => {
  const routes = await loadApiCrudDir(path.join(__dirname, './fixtures/app-test/api'))
  t.is(routes.length, 5)
})
