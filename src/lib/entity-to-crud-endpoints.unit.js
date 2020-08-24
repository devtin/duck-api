import test from 'ava'
import { Entity } from './schema/entity.js'
import { CRUDEndpoint } from './schema/crud-endpoint.js'
import { entityToCrudEndpoints } from './entity-to-crud-endpoints.js'
import { DuckStorage, Duck, DuckRack } from 'duck-storage'

const anEntity = Entity.parse({
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
const duckModel = new Duck({ schema: anEntity.duckModel })
const duckRack = new DuckRack(anEntity.name, { duckModel, methods: anEntity.methods })
const entityDriver = DuckStorage.registerRack(duckRack)

test(`Converts an entity into an array of crud endpoints`, async t => {
  const converted = entityToCrudEndpoints(anEntity, entityDriver)
  t.true(Array.isArray(converted))

  t.is(converted.length, 4)

  converted.forEach(entity => {
    t.notThrows(() => CRUDEndpoint.parse(entity))
  })

  t.is(converted[0].path, '/papo')
  t.truthy(converted[0].create)
  t.truthy(converted[0].read)
  t.truthy(converted[0].update)
  t.truthy(converted[0].delete)
  t.truthy(converted[0].list)
  t.is(converted[1].path, '/papo/sandy-papo')
  t.truthy(converted[1].create)
  t.is(converted[3].path, '/papo/:id/huele-pega')
})
