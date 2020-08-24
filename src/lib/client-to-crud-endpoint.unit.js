import { clientToCrudEndpoints } from './client-to-crud-endpoint'
import { Client } from './schema/client'
import { CRUDEndpoint } from './schema/crud-endpoint'
import test from 'ava'

test('converts client into a crud-endpoint', t => {
  const client = Client.parse({
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

  const crudEndpoints = clientToCrudEndpoints(client)
  crudEndpoints.forEach(crudEndpoint => {
    t.true(CRUDEndpoint.isValid(crudEndpoint))
  })
})
