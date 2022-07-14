// This is being edited.
const config = require('config')
const fs = require('fs')
const Queue = require('better-queue')
const { spawn } = require('child_process')
const Parser = require('json-text-sequence').parser
const tilebelt = require('@mapbox/tilebelt')

const srcdb = config.get('srcdb')
const ogr2ogrPath = config.get('ogr2ogrPath')
const tippecanoePath = config.get('tippecanoePath')
const minzoom = config.get('minzoom')
const maxzoom = config.get('maxzoom')
const mbtilesDir = config.get('mbtilesDir')
const geojsonsDir = config.get('geojsonsDir')


let keyInProgress = []
let idle = true

const isIdle = () => {
    return idle
}

const fsOptions = {
    encoding: "utf8"
}

const sleep = (wait) => {
    return new Promise((resolve, reject) => {
        setTimeout( () => {resolve()}, wait)
    })
}

const queue = new Queue(async (t, cb) => {
    const startTime = new Date()
    const key = t.key
    const tile = t.tile
    const [z, x, y] = tile
    const gjsPath = `${geojsonsDir}/inter-${key}.geojsons`
    const tmpPath = `${mbtilesDir}/part-${key}.mbtiles` 
    const dstPath = `${mbtilesDir}/${key}.mbtiles` 
    const bbox = tilebelt.tileToBBOX([x, y, z])

    keyInProgress.push(key)
    console.log(`[${keyInProgress}] in progress`)

    const FSstream = fs.createWriteStream(gjsPath, fsOptions)

    const parser = new Parser()
    .on('data', f => {
        f.tippecanoe = {
            layer: srcdb.layer,
            minzoom: srcdb.minzoom,
            maxzoom: srcdb.maxzoom
        }
        delete f.properties.SHAPE_Length
        if ((f.properties.contour % 100) == 0){
            f.tippecanoe.minzoom = srcdb.minzoom
        } else if ((f.properties.contour % 40) == 0){
            f.tippecanoe.minzoom = srcdb.minzoom + 2
        } else {
            f.tippecanoe.minzoom = srcdb.minzoom + 3
        }
        FSstream.write(`\x1e${JSON.stringify(f)}\n`)
    })
    .on('finish', () => {
        FSstream.end()
        const PendTime = new Date()
        //console.log(`FS write end ${key}: ${startTime.toISOString()} --> ${PendTime.toISOString()}`)
        //from here
        const VTconversion = new Promise((resolve, reject)=>{
            const tippecanoe = spawn(tippecanoePath, [
                `--output=${tmpPath}`,
                '--no-feature-limit',
                '--no-tile-size-limit',
                '--force',
                '--simplification=2',
                `--clip-bounding-box=${bbox.join(',')}`, 
                '--quiet',
                `--minimum-zoom=${minzoom}`,
                `--maximum-zoom=${maxzoom}`,
                gjsPath
                ]) 
               .on('exit', () => {
                    fs.renameSync(tmpPath, dstPath)
                    fs.unlinkSync(gjsPath)
                    //const endTime = new Date()
                    //console.log(`Tippecanoe: ${key} ends at ${endTime.toISOString()} (^o^)/`)
                    //keyInProgress = keyInProgress.filter((v) => !(v === key))
                    resolve()
                })
        })
        .then(()=> {
            const endTime = new Date()
            console.log(` - ${key} ends: ${startTime.toISOString()} --> ${endTime.toISOString()} (^o^)/`)
            keyInProgress = keyInProgress.filter((v) => !(v === key))
            return cb()
        })
        //until here    
    })

    const ogr2ogr = spawn(ogr2ogrPath, [
        '-f', 'GeoJSONSeq',
        '-lco', 'RS=YES',
        '/vsistdout/',
        '-clipdst', bbox[0], bbox[1], bbox[2], bbox[3],
        srcdb.url
    ])
    
    //just in case (from here)
    while(!isIdle()){
        await sleep(3000)
    }
    //just in case (until here)

    ogr2ogr.stdout.pipe(parser)

 // The following part is moved into .then of
 //   const endTime = new Date()
 //   console.log(`${key} ends: ${startTime} --> ${endTime} (^o^)/`)
 //   keyInProgress = keyInProgress.filter((v) => !(v === key))
 //   return cb()

},{
    concurrent: config.get('concurrent'),
    maxRetries: config.get('maxRetries'),
    retryDelay: config.get('retryDelay')
})


const queueTasks = () => {
    for (let tile of srcdb.tiles){
    //for (let tile of [[6,32,20],[6,32,21],[6,32,22],[6,32,23],[6,33,20],[6,33,21],[6,33,22]]){
    //for (let key of ['bndl1', 'bndl2', 'bndl3', 'bndl4', 'bndl5', 'bndl6']){
        const key = `${tile[0]}-${tile[1]}-${tile[2]}`
        queue.push({
            key: key,
            tile: tile
        })
    }
}

const shutdown = () => {
    console.log('System shutdown (^_^)')
}

const main = async () =>{
    const stTime = new Date()
    console.log(`${stTime.toISOString()}: Production starts. `)
    queueTasks()
    queue.on('drain', () => {
        const closeTime = new Date()
        console.log(`Production ends: ${stTime.toISOString()} --> ${closeTime.toISOString()}`)
        shutdown()
    })
}

main()