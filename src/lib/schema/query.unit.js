import { Query } from './query.js'
import test from 'ava'

test(`Parses query objects`, async t => {
  const parsed = await Query.parse({
    address: {
      zip: {
        $gt: 34
      }
    }
  })

  t.deepEqual(parsed, {
    address: {
      zip: {
        $gt: 34
      }
    }
  })
})
