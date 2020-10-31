import test from 'ava'
import { apiSchemaValidationMiddleware } from './api-schema-validation-middleware.js'

const requestCtx = {
  none: {
    $pleasure: {
      get: {},
      body: {}
    }
  },
  quantity: {
    $pleasure: {
      get: {
        quantity: 3
      },
      body: {}
    }
  },
  wrongQuantity: {
    $pleasure: {
      get: {
        quantity: 'three'
      },
      body: {}
    }
  },
  fullContact: {
    $pleasure: {
      get: {},
      body: {
        name: `Martin Rafael Gonzalez`,
        birthday: '6/11/1983'
      }
    }
  },
  wrongContact: {
    $pleasure: {
      get: {},
      body: {
        name: `Pablo Perez`,
        birthday: 'It was a rainy day'
      }
    }
  }
}

const fnStub = () => {}
const ctxStub = {
  $pleasure: {
    get: null,
    body: null,
    dbDriver: null
  }
}

test(`Restricts access via get variables`, async t => {
  const Api = apiSchemaValidationMiddleware({
    // passes the schema
    get: {
      quantity: {
        type: Number,
        required: false
      }
    }
  })

  const none = Object.assign({}, ctxStub, requestCtx.none)
  await Api(none, fnStub)

  t.truthy(none.$pleasure.get)
  t.is(Object.keys(none.$pleasure.get).length, 0)

  const quantity = Object.assign({}, ctxStub, requestCtx.quantity)
  await Api(quantity, fnStub)

  t.truthy(quantity.$pleasure.get)
  t.is(quantity.$pleasure.get.quantity, 3)

  const wrongQuantity = Object.assign({}, ctxStub, requestCtx.wrongQuantity)
  const error = await t.throwsAsync(() => Api(wrongQuantity, fnStub))

  t.is(error.message, 'Data is not valid')
  t.is(error.errors.length, 1)
  t.is(error.errors[0].message, 'Invalid number')
  t.is(error.errors[0].field.fullPath, 'quantity')
})

test(`Restricts post / patch / delete body`, async t => {
  const Api = apiSchemaValidationMiddleware({
    body: {
      name: {
        type: String,
        required: [true, `Please enter your full name`]
      },
      birthday: {
        type: Date
      }
    }
  })

  const fullContact = Object.assign({}, ctxStub, requestCtx.fullContact)
  const wrongContact = Object.assign({}, ctxStub, requestCtx.wrongContact)
  await t.notThrowsAsync(() => Api(fullContact, fnStub))

  t.is(fullContact.$pleasure.body.name, 'Martin Rafael Gonzalez')
  t.true(fullContact.$pleasure.body.birthday instanceof Date)

  const error = await t.throwsAsync(() => Api(wrongContact, fnStub))
  t.is(error.message, 'Data is not valid')
  t.is(error.errors.length, 1)
  t.is(error.errors[0].message, `Invalid date`)
  t.is(error.errors[0].field.fullPath, `birthday`)
})
