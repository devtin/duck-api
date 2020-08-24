import { ApiError } from './api-error.js'
import { Duckfficer } from 'duck-storage'

const { Schema } = Duckfficer

const changeSchemaDefaultSettings = (newSettings, schema) => {
  Object.assign(schema._settings, newSettings)
  const binder = changeSchemaDefaultSettings.bind(null, newSettings)
  schema.children
  schema.children.forEach((item) => {
    binder(item)
  })
}

/**
 * Validates incoming traffic against given schemas
 * @param {Schema|Object|Boolean} [get=true] - Get (querystring) schema. true for all; false for  none; schema for validation
 * @param {Schema|Object|Boolean} [body=true] - Post / Delete / Patch (body) schema. true for all; false for  none; schema for validation
 * @throws {Schema~ValidationError} if any validation fails
 * @return Function - Koa middleware
 */

export function apiSchemaValidationMiddleware ({ get = true, body = true }) {
  if (get && typeof get === 'object') {
    if (get instanceof Schema) {
      get = Schema.cloneSchema({ schema: get, settings: {
          autoCast: true
        }
      })
    } else {
      get = new Schema(get, {
        settings: {
          autoCast: true
        }
      })
    }
    changeSchemaDefaultSettings({
      autoCast: true
    }, get)
  }

  if (body && !(body instanceof Schema) && typeof body === 'object') {
    if (body instanceof Schema) {
      body = Schema.cloneSchema({
        schema: body,
        settings: {
          autoCast: true
        }
      })
    } else {
      body = new Schema(body, {
        settings: {
          autoCast: true
        }
      })
    }
    changeSchemaDefaultSettings({
      autoCast: true
    }, body)
  }

  return (ctx, next) => {
    const getVars = ctx.$pleasure.get
    const postVars = ctx.$pleasure.body

    if (!get && getVars && Object.keys(getVars).length > 0) {
      // todo: throw error
      // todo: log debug
      throw new ApiError()
    }

    if (!body && postVars && Object.keys(postVars).length > 0) {
      // todo: throw error
      // todo: log debug
      // console.log(`avoiding post vars`)
      throw new ApiError()
    }

    const { state } = ctx.$pleasure
    // console.log({ getVars, postVars })

    try {
      // todo: document that ctx is passed as part of the state
      const parsingOptions = { state: Object.assign({ ctx }, state), virtualsEnumerable: false }
      ctx.$pleasure.get = get && get instanceof Schema ? get.parse(getVars, parsingOptions) : getVars
      ctx.$pleasure.body = body && body instanceof Schema ? body.parse(postVars, parsingOptions) : postVars
    } catch (err) {
      err.code = err.code || 400
      throw err
    }

    return next()
  }
}
