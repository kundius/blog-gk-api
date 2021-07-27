const { Directus } = require('@directus/sdk')
const request = require('request')
const xml2js = require('xml2js')
const fetch = require('isomorphic-unfetch')

async function initDirectus () {
  const directus = new Directus('http://localhost:8055/')
  await directus.auth.login({
    email: 'kundius.ruslan@gmail.com',
    password: 'qwerty',
  })
  return directus
}

async function getBody (url) {
  return new Promise((resolve, reject) => {
    // `encoding: null` is important - otherwise you'll get non-buffer response body
    request({ url, encoding: null }, (e, res, body) => {
      if (e) { return reject(e) }
      else if (200 <= res.statusCode && res.statusCode < 300) {
         return resolve(body)
      } else {
        return reject(new Error(`Unexpected response status ${res.statusCode}`))
      }
    })
  })
}

async function fetchData() {
  const xml = await getBody('https://blog-gk.ru/export.xml')
  return new Promise(resolve => {
    xml2js.parseString(xml, function (err, result) {
      resolve(result)
    })
  })
}

function escapeRegExp (string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function replaceAll (str, match, replacement){
   return str.replace(new RegExp(escapeRegExp(match), 'g'), ()=>replacement);
}

function trimChar (string, charToRemove) {
  while(string.charAt(0)==charToRemove) {
    string = string.substring(1)
  }
  while(string.charAt(string.length-1)==charToRemove) {
    string = string.substring(0,string.length-1)
  }
  return string
}

async function prepareContent (content) {
  const files = []
  const iamgeTags = content.match(/<img[^>]+>/ig)
  if (Array.isArray(iamgeTags)) {
    for (const iamgeTag of iamgeTags) {
      const attrs = iamgeTag.match(/(alt|title|src)=("[^"]*")/i)
      const url = trimChar(attrs[2], '"')
      try {
        const response = await fetch('http://localhost:8055/files/import', {
          method: 'post',
          body: JSON.stringify({
            url: `https://blog-gk.ru/${url}`
          }),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer 1141ff51-5402-4ad6-aca1-4da9d6dceec3'
          }
        })
        const json = await response.json()
        content = replaceAll(content, url, `/assets/${json.data.filename_disk}`)
        files.push(json.data.id)
      } catch (e) {
        console.error(`fail upload content image: ${url}`)
      }
    }
  }
  return [content, files]
}

async function main() {
  const [directus, data] = await Promise.all([initDirectus(), fetchData()])

  const articlesQuery = await directus.items('articles').readMany({
    limit: -1
  })
  for (const article of articlesQuery.data) {
    await directus.items('articles').deleteOne(article.id)
  }
  console.log('Articles deleted')

  const filesQuery = await directus.files.readMany({
    limit: -1
  })
  for (const file of filesQuery.data) {
    await directus.files.deleteOne(file.id)
  }
  console.log('Files deleted')

  let error = 0
  let created = 0

  for (const ticket of data.tickets.ticket) {
    // if (created === 10) break

    const alias = ticket.alias[0].split(',').join('').split('(').join('').split(')').join('')
    const [content, gallery] = await prepareContent(ticket.content[0])
    const data = {
      name: ticket.title[0],
      alias,
      status: 'published',
      excerpt: ticket.excerpt[0],
      content,
      portion_count: ticket.portion_count[0],
      cooking_time: ticket.cooking_time[0],
      date_created: ticket.published_at[0],
      seo_title: ticket.seo[0].title[0],
      seo_keywords: ticket.seo[0].keywords[0],
      seo_description: ticket.seo[0].description[0]
    }

    if (ticket.ingredients[0] && ticket.ingredients[0].ingredient) {
      data.ingredients = ticket.ingredients[0].ingredient.map(item => ({
        name: item.name[0],
        value: item.value[0]
      }))
    }

    const { data: [category] } = await directus.items('categories').readMany({
      filter: {
        alias: {
          _eq: ticket.category[0]
        }
      }
    })
    if (category) {
      data.category = category.id
    }

    if (ticket.image[0]) {
      try {
        const response = await fetch('http://localhost:8055/files/import', {
          method: 'post',
          body: JSON.stringify({
            url: `https://blog-gk.ru/${ticket.image[0]}`
          }),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer 1141ff51-5402-4ad6-aca1-4da9d6dceec3'
          }
        })
        const json = await response.json()
        data.thumbnail = json.data.id
      } catch (e) {
        console.error(`fail upload thumbnail image: ${ticket.image[0]}`)
      }
    }
     
    try {
      const article = await directus.items('articles').createOne(data)
      await directus.items('articles').updateOne(article.id, {
        date_created: ticket.published_at[0],
        gallery: gallery.map((fileId, i) => ({
          directus_files_id: fileId,
          articles_id: article.id,
          sort: i
        }))
      })
      console.log(`Created article: ${article.name}`)
      created++
    } catch (e) {
      console.log(e)
      error++
    }
  }

  console.log('Created:', created)
  console.log('Error:', error)
}

main()
