import test from 'ava'
import { loadEntitiesFromDir } from './load-entities-from-dir.js'
import path from 'path'

test(`Load entities from directory`, async t => {
  const entities = await loadEntitiesFromDir(path.join(__dirname, './fixtures/app-test/entities'))
  t.is(entities.length, 2)
  t.truthy(typeof entities[0].duckModel.clean)
})
