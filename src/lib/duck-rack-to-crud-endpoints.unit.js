import test from 'ava'
import { Entity, CRUDEndpoint } from './schema'
import { duckRackToCrudEndpoints } from './duck-rack-to-crud-endpoints.js'
import { DuckStorage, Duck, DuckRack } from 'duck-storage'

let anEntity
let duckModel
let duckRack
let entityDriver

test.before(async () => {
  anEntity = await Entity.parse({
    file: '/papo.js',
    duckModel: {
      schema: {
        name: String
      },
      methods: {
        huelePega: {
          description: 'Creates huelepega',
          input: {
            title: String
          },
          handler ({ title }) {
            return `${ title } camina por las calles del mundo`
          }
        }
      }
    },
    methods: {
      sandyPapo: {
        description: 'Creates sandy',
        handler (ctx) {
          ctx.body = 'con su merengazo'
        }
      }
    },
  })
  duckModel = new Duck({ schema: anEntity.duckModel })
  duckRack = await new DuckRack(anEntity.name, { duckModel, methods: anEntity.methods })
  entityDriver = await DuckStorage.registerRack(duckRack)
})

test(`Converts an entity into an array of crud endpoints`, async t => {
  const converted = await duckRackToCrudEndpoints(anEntity, entityDriver)
  t.true(Array.isArray(converted))

  t.is(converted.length, 5)

  converted.forEach(entity => {
    t.notThrows(() => CRUDEndpoint.parse(entity))
  })

  t.is(converted[0].path, '/papo')
  t.truthy(converted[0].create)
  t.truthy(converted[0].read)
  t.truthy(converted[0].update)
  t.truthy(converted[0].delete)
  t.truthy(converted[0].list)
  t.snapshot(converted)
})
