const sharp = require('sharp')
const blurhash = require('blurhash')
const path = require('path')
const fs = require('fs')
const util = require('util')

const readFile = util.promisify(fs.readFile)
  
async function encodeImageToBlurhash (input) {
  return new Promise((resolve, reject) => {
    sharp(input)
      .raw()
      .ensureAlpha()
      .resize(32, 32, { fit: "inside" })
      .toBuffer((err, buffer, { width, height }) => {
        if (err) return reject(err)
        resolve(blurhash.encode(new Uint8ClampedArray(buffer), width, height, 4, 4))
      })
  })
}

module.exports = function registerHook({ exceptions, services, env, getSchema }) {
  const { InvalidPayloadException } = exceptions

  return {
    'files.upload': async function (input) {
      if (input.payload.type.startsWith('image')) {
        const FilesService = new services.FilesService({
          schema: await getSchema(),
         accountability: input.accountability
        })
        const filePath = path.join(__dirname, '..', '..', '..', env.STORAGE_LOCAL_ROOT, input.payload.filename_disk)
        const fileBuffer = await readFile(filePath)
        await FilesService.updateOne(input.item, {
          blurhash: await encodeImageToBlurhash(fileBuffer)
        })
      }
    }
  }
}
