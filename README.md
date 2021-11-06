<div><h1>duck-api</h1></div>

<p>
    <a href="https://www.npmjs.com/package/duck-api" target="_blank"><img src="https://img.shields.io/npm/v/duck-api.svg" alt="Version"></a>
<a href="http://opensource.org/licenses" target="_blank"><img src="http://img.shields.io/badge/License-MIT-brightgreen.svg"></a>
</p>

<p>
    
</p>

## Installation

```sh
$ npm i duck-api --save
# or
$ yarn add duck-api
```

## Features

- [connects socket.io](#connects-socket-io)
- [proxies emitted events via socket.io](#proxies-emitted-events-via-socket-io)
- [loads api plugins](#loads-api-plugins)
- [provides information about available endpoints / schemas / entities](#provides-information-about-available-endpoints-schemas-entities)
- [filters endpoints access](#filters-endpoints-access)
- [Provides a way of querying multiple endpoints at a time](#provides-a-way-of-querying-multiple-endpoints-at-a-time)
- [Restricts access via get variables](#restricts-access-via-get-variables)
- [Restricts post / patch / delete body](#restricts-post-patch-delete-body)
- [Hooks ApiEndpoint into a koa router](#hooks-api-endpoint-into-a-koa-router)
- [converts a crud endpoint in an open api route](#converts-a-crud-endpoint-in-an-open-api-route)
- [Converts an entity into an array of crud endpoints](#converts-an-entity-into-an-array-of-crud-endpoints)
- [converts client into a crud-endpoint](#converts-client-into-a-crud-endpoint)
- [translates directory into routes](#translates-directory-into-routes)
- [Load entities from directory](#load-entities-from-directory)
- [Signs JWT sessions](#signs-jwt-sessions)
- [Validates provided token via head setting $pleasure.user when valid](#validates-provided-token-via-head-setting-pleasure-user-when-valid)
- [Validates provided token via cookie setting $pleasure.user when valid](#validates-provided-token-via-cookie-setting-pleasure-user-when-valid)
- [Rejects token when expired](#rejects-token-when-expired)
- [Filters response data](#filters-response-data)
- [converts route tree into crud endpoint](#converts-route-tree-into-crud-endpoint)
- [Parses query objects](#parses-query-objects)


<a name="connects-socket-io"></a>

## connects socket.io


```js
return new Promise((resolve, reject) => {
  const socket = io('http://localhost:3000')
  socket.on('connect', () => {
    t.pass()
    resolve()
  })
  socket.on('error', reject)
  setTimeout(reject, 3000)
})
```

<a name="proxies-emitted-events-via-socket-io"></a>

## proxies emitted events via socket.io


```js
const socket = io('http://localhost:3000')
await new Promise((r) => socket.on('connect', r))

const eventReceived = []

socket.on('method', p => {
  eventReceived.push(p)
})

const { data: { data } } = await axios.post('http://localhost:3000/racks/test', {
  name: 'Martin',
  email: 'tin@devtin.io',
})
t.truthy(data)

const { data: { data: data2 } } = await axios.post(`http://localhost:3000/racks/test/${ data._id }/query`, {
  name: 'Martin',
  email: 'tin@devtin.io',
})

t.true(Array.isArray(data2))
t.snapshot(data2)
t.true(eventReceived.length > 0)
```

<a name="loads-api-plugins"></a>

## loads api plugins


```js
const { data: response } = await axios.get('http://localhost:3000/some-plugin')
t.is(response, 'some plugin here!')
```

<a name="provides-information-about-available-endpoints-schemas-entities"></a>

## provides information about available endpoints / schemas / entities


```js
const { data: response } = await axios.get('http://localhost:3000/racks')
t.true(typeof response.data === 'object')
t.true(Object.hasOwnProperty.call(response.data, 'test'))
```

<a name="filters-endpoints-access"></a>

## filters endpoints access


```js
const { data: response1 } = await axios.get('http://localhost:3000/racks/test/clean')
t.deepEqual(response1.data, {})

const { data: response2 } = await axios.get('http://localhost:3000/racks/test/clean?level=1')
t.deepEqual(response2.data, { name: 'Martin', email: 'tin@devtin.io' })

const { data: response3 } = await axios.get('http://localhost:3000/racks/test/clean?level=2')
t.deepEqual(response3.data, { name: 'Martin' })
```

<a name="provides-a-way-of-querying-multiple-endpoints-at-a-time"></a>

## Provides a way of querying multiple endpoints at a time




<a name="restricts-access-via-get-variables"></a>

## Restricts access via get variables


```js
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
```

<a name="restricts-post-patch-delete-body"></a>

## Restricts post / patch / delete body


```js
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
```

<a name="hooks-api-endpoint-into-a-koa-router"></a>

## Hooks ApiEndpoint into a koa router


```js
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
```

<a name="converts-a-crud-endpoint-in-an-open-api-route"></a>

## converts a crud endpoint in an open api route


```js
const swaggerEndpoint = crudEndpointToOpenApi(crudEndpoint)
t.truthy(swaggerEndpoint)
t.snapshot(swaggerEndpoint)
```

<a name="converts-an-entity-into-an-array-of-crud-endpoints"></a>

## Converts an entity into an array of crud endpoints


```js
const converted = await duckRackToCrudEndpoints(anEntity, entityDriver)
t.true(Array.isArray(converted))

t.is(converted.length, 3)

converted.forEach(entity => {
  t.notThrows(() => CRUDEndpoint.parse(entity))
})

t.is(converted[0].path, '/papo')
t.truthy(converted[0].create)
t.truthy(converted[0].read)
t.truthy(converted[0].update)
t.truthy(converted[0].delete)
t.snapshot(converted)
```

<a name="converts-client-into-a-crud-endpoint"></a>

## converts client into a crud-endpoint


```js
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
```

<a name="translates-directory-into-routes"></a>

## translates directory into routes


```js
const routes = await loadApiCrudDir(path.join(__dirname, './fixtures/app-test/api'))
t.is(routes.length, 5)
```

<a name="load-entities-from-directory"></a>

## Load entities from directory


```js
const entities = await loadEntitiesFromDir(path.join(__dirname, './fixtures/app-test/entities'))
t.is(entities.length, 2)
t.truthy(typeof entities[0].duckModel.clean)
```

<a name="signs-jwt-sessions"></a>

## Signs JWT sessions


```js
const res = await axios.post('http://0.0.0.0:3000/sign-in', {
  fullName: 'pablo marmol'
})

t.is(res.headers['set-cookie'].filter((line) => {
  return /^accessToken=/.test(line)
}).length, 1)

t.truthy(res.data.accessToken)
t.truthy(res.data.refreshToken)
```

<a name="validates-provided-token-via-head-setting-pleasure-user-when-valid"></a>

## Validates provided token via head setting $pleasure.user when valid


```js
const userData = { name: 'pedro picapiedra' }
const user = (await axios.get('http://0.0.0.0:3000/user', {
  headers: {
    authorization: `Bearer ${sign(userData, privateKey, { expiresIn: '1m' })}`
  }
})).data

t.like(user, userData)
```

<a name="validates-provided-token-via-cookie-setting-pleasure-user-when-valid"></a>

## Validates provided token via cookie setting $pleasure.user when valid


```js
const userData = { name: 'pedro picapiedra' }
const user = (await axios.get('http://0.0.0.0:3000/user', {
  headers: {
    Cookie: `accessToken=${sign(userData, privateKey, { expiresIn: '1m' })};`
  }
})).data

t.like(user, userData)
```

<a name="rejects-token-when-expired"></a>

## Rejects token when expired


```js
const userData = { name: 'pedro picapiedra' }
const error = (await axios.get('http://0.0.0.0:3000/user', {
  headers: {
    Cookie: `accessToken=${sign(userData, privateKey, { expiresIn: '0s' })};`
  }
})).data


t.like(error, {
  code: 500,
  error: {
    message: 'Invalid token'
  }
})
```

<a name="filters-response-data"></a>

## Filters response data


```js
const next = (ctx) => () => {
  Object.assign(ctx, { body: Body })
}
const Body = {
  firstName: 'Martin',
  lastName: 'Gonzalez',
  address: {
    street: '2451 Brickell Ave',
    zip: 33129
  }
}
const ctx = (level = 'nobody', body = Body) => {
  return {
    body: {},
    $pleasure: {
      state: {}
    },
    user: {
      level
    }
  }
}
const middleware = responseAccessMiddleware(await EndpointHandler.schemaAtPath('access').parse(ctx => {
  if (ctx.user.level === 'nobody') {
    return false
  }
  if (ctx.user.level === 'admin') {
    return true
  }
  return ['firstName', 'lastName', 'address.zip']
}))

const nobodyCtx = ctx('nobody')
await middleware(nobodyCtx, next(nobodyCtx))
t.deepEqual(nobodyCtx.body, {})

const userCtx = ctx('user')
await middleware(userCtx, next(userCtx))
t.deepEqual(userCtx.body, {
  firstName: 'Martin',
  lastName: 'Gonzalez',
  address: {
    zip: 33129
  }
})

const adminCtx = ctx('admin')
await middleware(adminCtx, next(adminCtx))
t.deepEqual(adminCtx.body, Body)
```

<a name="converts-route-tree-into-crud-endpoint"></a>

## converts route tree into crud endpoint


```js
const routeTree = {
  somePath: {
    to: {
      someMethod: {
        read: {
          description: 'Some method description',
          handler () {

          },
          get: {
            name: String
          }
        }
      }
    }
  },
  and: {
    otherMethod: {
      create: {
        description: 'create one',
        handler () {

        }
      },
      read: {
        description: 'read one',
        handler () {

        }
      }
    },
    anotherMethod: {
      create: {
        description: 'another one (another one)',
        handler () {

        }
      }
    }
  }
}

const endpoints = await routeToCrudEndpoints(routeTree)
t.truthy(endpoints)
t.snapshot(endpoints)
```

<a name="parses-query-objects"></a>

## Parses query objects


```js
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
```


<br><a name="apiSchemaValidationMiddleware"></a>

### apiSchemaValidationMiddleware([get], [body]) ⇒
**Throws**:

- <code>Schema~ValidationError</code> if any validation fails


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [get] | <code>Schema</code>, <code>Object</code>, <code>Boolean</code> | <code>true</code> | Get (querystring) schema. true for all; false for  none; schema for validation |
| [body] | <code>Schema</code>, <code>Object</code>, <code>Boolean</code> | <code>true</code> | Post / Delete / Patch (body) schema. true for all; false for  none; schema for validation |

**Returns**: Function - Koa middleware  
**Description:**

Validates incoming traffic against given schemas


<br><a name="responseAccessMiddleware"></a>

### responseAccessMiddleware(access, thisContext) ⇒ <code>function</code>

| Param | Type | Description |
| --- | --- | --- |
| access | <code>function</code> | callback function receives ctx |
| thisContext | <code>object</code> | callback function receives ctx |


<br><a name="crudEndpointIntoRouter"></a>

### crudEndpointIntoRouter(router, crudEndpoint)

| Param |
| --- |
| router | 
| crudEndpoint | 

**Description:**

Takes given crudEndpoint as defined


<br><a name="loadApiCrudDir"></a>

### loadApiCrudDir(dir) ⇒ [<code>Array.&lt;CRUDEndpoint&gt;</code>](#CRUDEndpoint)

| Param | Type | Description |
| --- | --- | --- |
| dir | <code>String</code> | The directory to look for files |

**Description:**

Look for JavaScript files in given directory


<br><a name="loadEntitiesFromDir"></a>

### loadEntitiesFromDir(dir)

| Param |
| --- |
| dir | 

**Description:**

Reads given directory looking for *.js files and parses them into


<br><a name="duckRackToCrudEndpoints"></a>

### duckRackToCrudEndpoints(entity, duckRack) ⇒

| Param | Type |
| --- | --- |
| entity |  | 
| duckRack | <code>Object</code> | 

**Returns**: Promise<[]|*>  

<br><a name="loadPlugin"></a>

### loadPlugin(pluginName, [baseDir]) ⇒ <code>function</code>

| Param | Type | Description |
| --- | --- | --- |
| pluginName | <code>String</code>, <code>Array</code>, <code>function</code> |  |
| [baseDir] | <code>String</code> | Path to the plugins dir. Defaults to project's local. |

**Description:**

Resolves given plugin by trying to globally resolve it, otherwise looking in the `plugins.dir` directory or
resolving the giving absolute path. If the given pluginName is a function, it will be returned with no further logic.


<br><a name="jwtAccess"></a>

### jwtAccess(options) ⇒ <code>function</code>

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| options | <code>Object</code> |  |  |
| options.privateKey | <code>String</code> |  |  |
| [options.headerName] | <code>String</code> | <code>authorization</code> |  |
| [options.cookieName] | <code>String</code> | <code>accessToken</code> |  |
| [options.algorithm] | <code>String</code> | <code>HS256</code> | see https://www.npmjs.com/package/jsonwebtoken#jwtverifytoken-secretorpublickey-options-callback |
| [options.expiresIn] | <code>Number</code>, <code>String</code> | <code>15 * 60</code> |  |


<br><a name="EndpointHandler"></a>

### EndpointHandler : <code>Object</code>

<br><a name="CRUD"></a>

### CRUD : <code>Object</code>
**Description:**

An object representing all CRUD operations including listing and optional hook for any request.


<br><a name="CRUDEndpoint"></a>

### CRUDEndpoint : <code>Object</code>
**Extends**: [<code>CRUD</code>](#CRUD)  
**Description:**

A CRUD representation of an endpoint


<br><a name="Entity"></a>

### Entity : <code>Object</code>

<br><a name="ApiPlugin"></a>

### ApiPlugin : <code>function</code>

| Param | Description |
| --- | --- |
| app | The koa app |
| server | The http server |
| io | The socket.io instance |
| router | Main koa router |


* * *

### License

[MIT](https://opensource.org/licenses/MIT)

&copy; 2020-present Martin Rafael Gonzalez <tin@devtin.io>
