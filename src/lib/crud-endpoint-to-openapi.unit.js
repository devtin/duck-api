import test from 'ava'
import { crudEndpointToOpenApi } from './crud-endpoint-to-openapi.js'
import { CRUDEndpoint } from './schema'

let crudEndpoint

test.before(async () => {
  try {
    crudEndpoint = await CRUDEndpoint.parse({
      path: '/tal/:id/cual',
      create: {
        description: 'creates cual',
        get: {
          sort: String,
          qtty: {
            type: Number,
            required: false
          },
          address: {
            line1: String,
            line2: String
          }
        },
        body: {
          id: String,
          status: {
            type: String,
            enum: ['this', 'that']
          },
          logs: {
            type: Array,
            arraySchema: String
          }
        },
        output: {
          200: {
            id: {
              type: String,
              example: '123'
            }
          }
        },
        handler () {

        }
      },
      read: {
        description: 'reads tal cual',
        get: {
          _id: {
            type: String,
            example: '123'
          },
        },
        output: {
          200: {
            name: String,
            zip: Number
          }
        },
        handler () {

        }
      },
      update: {
        description: 'updates',
        body: {
          _id: String
        },
        handler () {

        }
      },
      delete: {
        description: 'deletes',
        body: {
          _id: String
        },
        handler () {

        },
        output: {}
      }
    })
  } catch (err) {
    console.log(err.errors || err.message)
  }
})

test('converts a crud endpoint in an open api route', async t => {
  const swaggerEndpoint = crudEndpointToOpenApi(crudEndpoint)
  t.truthy(swaggerEndpoint)
  t.snapshot(swaggerEndpoint)
})
