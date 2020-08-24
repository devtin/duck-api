import mapValues from 'lodash/mapValues'
import { Duckfficer } from 'duck-storage'
import { schemaValidatorToJSON } from '@devtin/schema-validator-doc'
import { isNotNullObj } from './is-not-null-obj'
import trim from 'lodash/trim'

const { Schema, Utils } = Duckfficer

const schemaValidatorToSwagger = (schema) => {
  schema = Schema.ensureSchema(schema)

  const getType = type => {
    type = type.toLowerCase()
    const allowed = ['string', 'object' , 'number', 'integer', 'array']
    return allowed.indexOf(type) >= 0 ? type : 'string'
  }

  const remapContent = (obj) => {
    const newObj = {}
    if (!isNotNullObj(obj)) {
      return obj
    }

    if (typeof obj.type === 'string') {
      return {
        type: getType(obj.type),
      }
    }

    Object.keys(obj).forEach(pathName => {
      if (/^\$/.test(pathName)) {
        return
      }
      newObj[pathName] = remapContent(obj[pathName])
    })

    return newObj
  }

  const output = remapContent(schemaValidatorToJSON(schema))
  return schema.hasChildren ? { type: 'object', properties: output } : output
}

export function crudEndpointToOpenApi (crudEndpoint) {
  const tags = [trim(crudEndpoint.path, '/').split('/')[0]]
  const getPathParams = () => {
    const paramsPattern = /\/:[^/]+(?:\/|$)/g
    const matches = crudEndpoint.path.match(paramsPattern)||[]
    return matches.map((pathName) => {
      pathName = trim(pathName, '/:')
      return {
        name: pathName,
        in: "path",
        description: `${pathName} parameter`,
        required: true,
        style: "simple"
      }
    })
  }

  const getRequestBody = schema => {
    if (typeof schema === 'boolean' || !schema) {
      return
    }
    schema = Schema.ensureSchema(schema)
    return {
      description: schema.settings.description,
      content: {
        "application/json": {
          schema: schemaValidatorToSwagger(schema),
          example: schema.settings.example
        }
      }
    }
  }

  const convert = endpoint => {
    if (!endpoint) {
      return
    }

    const { summary, description } = endpoint
    const getSchema = Schema.ensureSchema(endpoint.get)
    const getSchemaJson = schemaValidatorToSwagger(getSchema)

    const requestBody = getRequestBody(endpoint.body)

    const responses = mapValues(endpoint.output, (response) => {
      const { description, summary, example } = response
      return {
        description,
        summary,
        content: {
          "application/json": {
            schema: schemaValidatorToSwagger(response.schema)
          }
        },
        example
      }
    })

    const parameters = getPathParams().concat(getSchema.paths.map(pathName => {
      if (getSchema.schemaAtPath(pathName).hasChildren) {
        return
      }
      return {
        name: pathName,
        in: "query",
        description: getSchema.schemaAtPath(pathName).settings.description,
        required: getSchema.schemaAtPath(pathName).settings.required,
        example: getSchema.schemaAtPath(pathName).settings.example,
        enum: getSchema.schemaAtPath(pathName).settings.enum,
        schema: Utils.find(getSchemaJson, pathName),
        style: "simple"
      }
    })).filter(Boolean)

    return {
      description,
      summary,
      requestBody,
      parameters,
      tags,
      responses
    }
  }

  const {
    create: post,
    read: get,
    update: patch,
    delete: del,
  } = crudEndpoint
  return {
    [crudEndpoint.path.replace(/\/:([^/]+)(\/|$)/, '/{$1}$2')]: {
      get: convert(get),
      post: convert(post),
      patch: convert(patch),
      delete: convert(del)
    }
  }
}
