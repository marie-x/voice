
navigator.getUserMedia = navigator.getUserMedia
    || navigator.webkitGetUserMedia
    || navigator.mozGetUserMedia;

// const scopeCanvas = document.querySelector('.oscilloscope')
// const scopeCtx = scopeCanvas.getContext('2d')

const spectrumCanvas = document.querySelector('.spectrum')
const spectrumCtx = spectrumCanvas.getContext('2d')

const timelineCanvas = document.querySelector('.timeline')
const timelineCtx = timelineCanvas.getContext('2d')

function log(...params) {
    const s = params.join(' ')
    console.log(s)
}

function main() {
    let analyser // FIXME
    let frequencyData // FIXME
    let timeData // FIXME
    let audioCtx // FIXME

    function startAudio(stream) {
        audioCtx = new AudioContext()
        const mic = audioCtx.createMediaStreamSource(stream)
        // NOTE add params to createAnalyzer
        analyser = audioCtx.createAnalyser()
        analyser.fftSize *= 4
        // const osc = audioCtx.createOscillator()

        mic.connect(analyser)
        // osc.connect(audioCtx.destination)
        // osc.start(0)

        log('frequencyBinCount', analyser.frequencyBinCount)
        log('fftSize', analyser.fftSize)
        log('sampleRate', audioCtx.sampleRate)
        frequencyData = new Uint8Array(analyser.frequencyBinCount)
        timeData = new Uint8Array(analyser.fftSize)

        requestAnimationFrame(draw)
    }

    navigator.getUserMedia({ video: false, audio: true }, startAudio, log)

    // const intendedWidth = document.querySelector('.wrapper').clientWidth

    const WIDTH = 1024
    const HEIGHT = 400

    for (let canvas of [spectrumCanvas, timelineCanvas]) {
        canvas.setAttribute('width', WIDTH)
        canvas.setAttribute('height', HEIGHT)
    }

    const lineData = { pitch: [], color: [] }

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

        function peaks(data, len) {
            let peakIndexes = []
            let peakOffsets = []
            let maxIndex = 0
            for (let j = 0; j < len; j++) {
                if (data[j] > data[maxIndex]) {
                    maxIndex = j
                }
                if (j > 2 && j < len - 2) {
                    const [f1, f2, f3, f4, f5] = data.slice(j - 2, j + 3)
                    if (f3 > 128) {
                        const [s1, s2, s3, s4] = [Math.sign(f2 - f1) || 1, Math.sign(f3 - f2) || 1, Math.sign(f4 - f3) || 1, Math.sign(f5 - f4) || 1]
                        if (s1 === 1 && s2 === 1 && s3 === -1 && s4 === -1) {
                            // const coefficients = regression.polynomial([[-2, f1], [-1, f2], [0, f3], [1, f4], [2, f5]])
                            // log(JSON.stringify(coefficients.equation))
                            // const [c2, c1, c0] = coefficients.equation
                            peakIndexes.push(j)
                            // log(j, ':', c2, c1, c0)
                            // peakOffsets.push(offset)
                            // if (Math.abs(offset) < 2) {
                            //     peakIndexes.push(j + offset)
                            // }
                        }
                    }
                }
            }
            return { peakIndexes, maxIndex }
        }

        let { peakIndexes } = peaks(frequencyData, analyser.frequencyBinCount)

        // HPS
        const hpsCount = Math.round(analyser.frequencyBinCount / 16)
        const fd = frequencyData
        const hpsData = []
        for (let i = 0; i < hpsCount; i++) {
            const val = fd[i] *
                ((fd[i * 2] + fd[i * 2 + 1]) / 2) *
                ((fd[i * 3] + fd[i * 3 + 1] + fd[i * 3 + 2]) / 3) *
                ((fd[i * 4] + fd[i * 4 + 1] + fd[i * 4 + 2] + fd[i * 4 + 3]) / 4)
            hpsData.push(Math.pow(val, 1.0 / 4))
        }

        let peakHpsIndex = peaks(hpsData, hpsCount).maxIndex
        let idx = peakHpsIndex
        const peakFrequency = idx * audioCtx.sampleRate / analyser.fftSize

        function drawSpectrum() {
            analyser.getByteFrequencyData(frequencyData)

            const frequencyPoints = frequencyData.length / 16

            const sliceWidth = WIDTH * 1.0 / frequencyPoints

            spectrumCtx.fillStyle = 'rgb(200, 200, 200)'
            spectrumCtx.fillRect(0, 0, WIDTH, HEIGHT)

            let maxV = renderSeries(spectrumCtx, frequencyData, frequencyPoints, { strokeStyle: 'rgb(0, 0, 0)', lineWidth: 2 })

            renderSeries(spectrumCtx, hpsData, hpsData.length, { strokeStyle: 'rgba(32, 32, 32, 128)', lineWidth: 1 })

            if (maxV > 1 && peakFrequency > 50 && peakFrequency < 450) {
                spectrumCtx.beginPath()
                spectrumCtx.strokeStyle = 'rgba(64, 32, 32, 0.5)'
                spectrumCtx.lineWidth = 2
                for (const i of peakIndexes) {
                    spectrumCtx.moveTo(sliceWidth * i, 0)
                    spectrumCtx.lineTo(sliceWidth * i, HEIGHT)
                }
                spectrumCtx.stroke()

                spectrumCtx.beginPath()
                spectrumCtx.strokeStyle = 'rgb(128, 0, 0)'
                spectrumCtx.moveTo(sliceWidth * idx, 0)
                spectrumCtx.lineTo(sliceWidth * idx, HEIGHT)
                spectrumCtx.stroke()


                lineData.color.unshift((peakFrequency - 50) / 400.0)
                if (lineData.color.length > WIDTH) {
                    lineData.color.pop()
                }
            }
        }

        function drawTimeline() {
            timelineCtx.fillStyle = 'rgb(200, 200, 200)'
            timelineCtx.fillRect(0, 0, WIDTH, HEIGHT)

            timelineCtx.lineWidth = 2
            timelineCtx.strokeStyle = 'rgb(0, 0, 0)'

            timelineCtx.fillStyle = 'rgb(128, 0, 0)'

            for (let x = 0; x < WIDTH; x++) {
                if (x < lineData.color.length && lineData.color[x]) {
                    timelineCtx.fillRect(x, HEIGHT - (HEIGHT * lineData.color[x]), 2, 2)
                }
            }
        }

        // drawScope()
        drawSpectrum()
        drawTimeline()
    }
}

document.addEventListener('DOMContentLoaded', main)


