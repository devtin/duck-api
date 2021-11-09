import { jsDirIntoJson, jsDirIntoJsonSync } from 'js-dir-into-json'

export const jsDirIntoJsonIfExists = async (...args) => {
  try {
    return await jsDirIntoJson(...args)
  }
  catch (err) {
    return []
  }
}

export const jsDirIntoJsonIfExistsSync = (...args) => {
  try {
    return jsDirIntoJsonSync(...args)
  }
  catch (err) {
    return []
  }
}
