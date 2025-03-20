
navigator.getUserMedia = navigator.getUserMedia
    || navigator.webkitGetUserMedia
    || navigator.mozGetUserMedia;

// const scopeCanvas = document.querySelector('.oscilloscope')
// const scopeCtx = scopeCanvas.getContext('2d')

const spectrumCanvas = document.querySelector('.spectrum')
const spectrumCtx = spectrumCanvas.getContext('2d')

const timelineCanvas = document.querySelector('.timeline')
const timelineCtx = timelineCanvas.getContext('2d')

const logText = document.querySelector('#log')
const infoText = document.querySelector('#info')

const logRoll = []

const MIN_FREQ = 80.0
const MAX_FREQ = 280.0

const MIN_FEMME = 165
const MAX_FEMME = 265
const MAX_MASC = 185
const MIN_MASC = 85

const BLACK = 'rgb(0, 0, 0)'
const LTGRAY = 'rgb(200, 200, 200)'
const DKGRAY = 'rgba(32, 32, 32, 128)'
const DKRED = 'rgb(128, 0, 0)'
const BLUE = 'rgba(127, 127, 255, 0.25)'
const PINK = 'rgba(255, 127, 127, 0.25)'

function log(...params) {
    const s = params.join(' ')
    logRoll.push(s)
    if (logRoll.length > 10) {
        logRoll.shift()
    }
    logText.innerText = logRoll.join('\n')
    console.log(s)
}

function getStdDev(array) {
    const n = array.length
    const mean = array.reduce((a, b) => a + b) / n
    return Math.sqrt(array.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n)
}

function main() {
    let analyser // FIXME
    let frequencyData // FIXME
    let timeData // FIXME
    let audioCtx // FIXME
    let hertzPerBucket

    function startAudio(stream) {
        audioCtx = new AudioContext()
        const mic = audioCtx.createMediaStreamSource(stream)
        // NOTE add params to createAnalyzer
        analyser = audioCtx.createAnalyser()
        analyser.fftSize *= 8
        // const osc = audioCtx.createOscillator()

        mic.connect(analyser)
        // osc.connect(audioCtx.destination)
        // osc.start(0)

        hertzPerBucket = audioCtx.sampleRate / analyser.fftSize
        log('frequencyBinCount', analyser.frequencyBinCount)
        log('fftSize', analyser.fftSize)
        log('sampleRate', audioCtx.sampleRate)
        log('hertzPerBucket', hertzPerBucket)
        log('max freq', analyser.fftSize / 16 * hertzPerBucket) // trimmed 

        frequencyData = new Uint8Array(analyser.frequencyBinCount)
        timeData = new Uint8Array(analyser.fftSize)

        requestAnimationFrame(draw)
    }

    navigator.getUserMedia({ video: false, audio: true }, startAudio, log)

    const WIDTH = 1024
    const HEIGHT = 400

    for (let canvas of [spectrumCanvas, timelineCanvas]) {
        canvas.setAttribute('width', WIDTH)
        canvas.setAttribute('height', HEIGHT)
    }

    const lineData = { pitch: [], color: [], variation: [] }

    function renderSeries(ctx, data, count = data.length, opts = {}) {
        // bulk assign settings such as lineWidth and strokeStyle, if desired
        Object.assign(ctx, opts)

        ctx.beginPath()

        let maxV = 0
        let x = 0
        const sliceWidth = WIDTH * 1.0 / count

        for (let i = 0; i < count; i++) {
            const v = data[i] / 128.0 // max data value = 128?
            const y = HEIGHT - (v * HEIGHT / 2)

            if (i === 0) {
                ctx.moveTo(x, y)
            } else {
                ctx.lineTo(x, y)
            }
            x += sliceWidth

            if (v > maxV) {
                maxV = v
            }
        }

        ctx.stroke()

        return maxV
    }

    function draw() {

        requestAnimationFrame(draw)

        // function drawScope() {
        //     analyser.getByteTimeDomainData(timeData)

        //     scopeCtx.fillStyle = 'rgb(200, 200, 200)'
        //     scopeCtx.fillRect(0, 0, WIDTH, HEIGHT)

        //     scopeCtx.lineWidth = 2
        //     scopeCtx.strokeStyle = 'rgb(0, 0, 0)'

        //     scopeCtx.beginPath()

        //     const sliceWidth = WIDTH * 1.0 / timeData.length
        //     let x = 0

        //     for (let i = 0; i < timeData.length; i++) {

        //         const v = timeData[i] / 128.0
        //         const y = v * HEIGHT / 2

        //         if (i === 0) {
        //             scopeCtx.moveTo(x, y)
        //         } else {
        //             scopeCtx.lineTo(x, y)
        //         }

        //         x += sliceWidth
        //     }

        //     scopeCtx.lineTo(scopeCanvas.width, scopeCanvas.height / 2)
        //     scopeCtx.stroke()
        // }

        function peaks(data, len, min = 0, max = len) {
            let peakIndexes = []
            let maxIndex = 0
            for (let j = min; j < max; j++) {
                if (data[j] > data[maxIndex]) {
                    maxIndex = j
                }
                if (j > 2 && j < max - 2) {
                    const [f1, f2, f3, f4, f5] = data.slice(j - 2, j + 3)
                    if (f3 > 128) {
                        const [s1, s2, s3, s4] = [Math.sign(f2 - f1) || 1, Math.sign(f3 - f2) || 1, Math.sign(f4 - f3) || 1, Math.sign(f5 - f4) || 1]
                        if (s1 === 1 && s2 === 1 && s3 === -1 && s4 === -1) {
                            peakIndexes.push(j)
                        }
                    }
                }
            }
            return { peakIndexes, maxIndex }
        }

        let { peakIndexes } = peaks(frequencyData, analyser.frequencyBinCount)

        // HPS = Harmonic Product Spectrum
        const hpsCount = Math.round(analyser.frequencyBinCount / 16)
        const fd = frequencyData
        const hpsData = []
        for (let i = 0; i < hpsCount; i++) {
            const val = fd[i] *
                ((fd[i * 2] + fd[i * 2 + 1]) / 2) *
                ((fd[i * 3] + fd[i * 3 + 1] + fd[i * 3 + 2]) / 3) *
                ((fd[i * 4] + fd[i * 4 + 1] + fd[i * 4 + 2] + fd[i * 4 + 3]) / 4)
            hpsData.push(Math.pow(val, 0.25))
        }

        let peakHpsIndices = peaks(hpsData, hpsCount).peakIndexes
        if (peakHpsIndices.length > 0) {
            log('peakHpsIndices', peakHpsIndices)
        }
        while (peakHpsIndices[0] < MIN_MASC / hertzPerBucket) {
            peakHpsIndices.shift()
        }
        // less than half the peak means it's not the fundamental
        while (fd[peakHpsIndices[0]] < fd[peakHpsIndices[1]] * 0.6666) {
            const r = peakHpsIndices.shift()
            log('removed', r)
        }

        let peakHpsIndex = -1
        let peakFrequency = -1
        if (peakHpsIndices.length > 0) {
            peakHpsIndex = peakHpsIndices[0]
            peakFrequency = peakHpsIndex * hertzPerBucket
            log(peakHpsIndex, peakFrequency)
        }

        function drawSpectrum() {
            analyser.getByteFrequencyData(frequencyData)

            const frequencyPoints = frequencyData.length / 16
            const sliceWidth = WIDTH * 1.0 / frequencyPoints

            spectrumCtx.fillStyle = LTGRAY
            spectrumCtx.fillRect(0, 0, WIDTH, HEIGHT)

            spectrumCtx.fillStyle = BLUE
            spectrumCtx.fillRect(sliceWidth * MIN_MASC / hertzPerBucket, 0, sliceWidth * (MAX_MASC - MIN_MASC) / hertzPerBucket, HEIGHT)

            spectrumCtx.fillStyle = PINK
            spectrumCtx.fillRect(sliceWidth * MIN_FEMME / hertzPerBucket, 0, sliceWidth * (MAX_FEMME - MIN_FEMME) / hertzPerBucket, HEIGHT)

            let maxV = renderSeries(spectrumCtx, frequencyData, frequencyPoints, { strokeStyle: BLACK, lineWidth: 2 })

            renderSeries(spectrumCtx, hpsData, hpsData.length, { strokeStyle: DKGRAY, lineWidth: 1 })

            if (maxV > 1 && peakFrequency > MIN_FREQ && peakFrequency < MAX_FREQ) {

                // calculate brightness based on some number of harmonics of the root pitch
                let peakHeights = []
                if (peakHpsIndex !== -1) {
                    for (let i = 1; i < 10; i++) {
                        const { maxIndex } = peaks(frequencyData, analyser.frequencyBinCount, i * peakHpsIndex - 5, i * peakHpsIndex + 5)
                        if (maxIndex !== 0) {
                            peakHeights.push(frequencyData[maxIndex])
                        }
                    }
                }
                // if (peakHeights.length === 9) {
                //     log(JSON.stringify(peakHeights))
                // }

                spectrumCtx.beginPath()
                spectrumCtx.strokeStyle = 'rgba(64, 32, 32, 0.5)'
                spectrumCtx.lineWidth = 2
                for (const i of peakIndexes) {
                    spectrumCtx.moveTo(sliceWidth * i, 0)
                    spectrumCtx.lineTo(sliceWidth * i, HEIGHT)
                }
                spectrumCtx.stroke()

                if (peakHpsIndex !== -1) {
                    spectrumCtx.beginPath()
                    spectrumCtx.strokeStyle = DKRED
                    spectrumCtx.moveTo(sliceWidth * peakHpsIndex, 0)
                    spectrumCtx.lineTo(sliceWidth * peakHpsIndex, HEIGHT)
                    spectrumCtx.stroke()
                }

                const c = lineData.color
                c.unshift((peakFrequency - MIN_FREQ) / (MAX_FREQ - MIN_FREQ))
                if (c.length > WIDTH) {
                    c.pop()
                }
                // update stddev
                if (c.length > WIDTH / 4) {
                    const v = lineData.variation
                    v.unshift(getStdDev(c.slice(0, WIDTH / 4)))
                    if (v.length > WIDTH) {
                        v.pop()
                    }
                    // log('stddev = ' + v[0])
                }
            }
        }

        function drawTimeline() {
            const ctx = timelineCtx
            function yf(f) {
                const scaled = (f - MIN_FREQ) / (MAX_FREQ - MIN_FREQ)
                const yy = HEIGHT * (1 - scaled)
                return yy
            }

            ctx.fillStyle = LTGRAY
            ctx.fillRect(0, 0, WIDTH, HEIGHT)

            ctx.fillStyle = BLUE
            ctx.fillRect(0, yf(MIN_MASC), WIDTH, yf(MAX_MASC) - yf(MIN_MASC))

            ctx.fillStyle = PINK
            ctx.fillRect(0, yf(MIN_FEMME), WIDTH, yf(MAX_FEMME) - yf(MIN_FEMME))

            ctx.lineWidth = 2
            ctx.strokeStyle = BLACK

            for (let x = 0; x < WIDTH; x++) {
                const { color, variation } = lineData
                ctx.fillStyle = DKRED
                if (x < color.length && color[x]) {
                    ctx.fillRect(x, HEIGHT - (HEIGHT * color[x]), 2, 2) // lil square
                }
                ctx.fillStyle = DKRED
                if (x < variation.length && variation[x]) {
                    ctx.fillRect(x, HEIGHT - (HEIGHT * variation[x]), 1, 1) // lil square
                }
            }
        }

        // drawScope()
        drawSpectrum()
        drawTimeline()
    }
}

document.addEventListener('DOMContentLoaded', main)


