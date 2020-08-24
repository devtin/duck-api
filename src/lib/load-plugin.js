import path from 'path'

/**
 * @typedef {Function} ApiPlugin
 * @param app - The koa app
 * @param server - The http server
 * @param io - The socket.io instance
 * @param router - Main koa router
 */

/**
 * Resolves given plugin by trying to globally resolve it, otherwise looking in the `plugins.dir` directory or
 * resolving the giving absolute path. If the given pluginName is a function, it will be returned with no further logic.
 *
 * @param {String|Array|Function} pluginName
 * @param {String} [baseDir] - Path to the plugins dir. Defaults to project's local.
 *
 * @return {function}
 */
export function loadPlugin (baseDir = process.cwd(), pluginName) {
  if (typeof pluginName === 'function') {
    return pluginName
  }
  const pluginState = {}

  if (Array.isArray(pluginName)) {
    Object.assign(pluginState, pluginName[1])
    pluginName = pluginName[0]
  }

  try {
    pluginName = require.resolve(pluginName)
    return require(pluginName).bind(pluginState)
  } catch (err) {
    // shh...
  }

  let plugin

  try {
    plugin = require(path.resolve(baseDir, pluginName))
    plugin = plugin.default || plugin
  } catch (err) {
    throw new Error(`Error loading plugin ${ pluginName }: ${ err.message }`)
  }

  if (typeof plugin !== 'function') {
    throw new Error(`Invalid plugin ${ pluginName }. A plugin must export a function.`)
  }

  return plugin.bind(pluginState)
}
