import { gatewayToCrudEndpoints } from './gateway-to-crud-endpoints'
import { Client } from './schema/client'
import { CRUDEndpoint } from './schema'
import Promise from 'bluebird'
import test from 'ava'

test('converts client into a crud-endpoint', async t => {
  const client = await Client.parse({
    name: 'PayPal',
    methods: {
      issueTransaction: {
        description: 'Issues a transaction',
        input: {
          name: String
        },
        handler ({ name }) {
          return name
        }
      },
      issueRefund: {
        description: 'Issues a refund',
        input: {
          transactionId: Number
        },
        handler ({transactionId}) {
          return transactionId
        }
      }
    }
  })

  const crudEndpoints = gatewayToCrudEndpoints(client)
  await Promise.each(crudEndpoints, async crudEndpoint => {
    t.true(await CRUDEndpoint.isValid(crudEndpoint))
  })
})
