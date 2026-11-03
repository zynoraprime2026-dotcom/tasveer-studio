import { useEffect, useRef, useState } from 'react'
import './clapperboard.css'

type ClapperboardProps = {
  scene: number
  takes: number
  title: string
  ratio: string
}

const DIRECTOR = 'ABDULRAHIM ABUBAKAR'
const FPS = 25
const CALLS = ['ROLL SOUND', 'CAMERA', 'ACTION'] as const

function timecode(frames: number) {
  const total = Math.floor(frames / FPS)
  const ff = frames % FPS
  const mm = Math.floor(total / 60)
  const ss = total % 60
  const pad = (value: number) => value.toString().padStart(2, '0')
  return `00:${pad(mm)}:${pad(ss)}:${pad(ff)}`
}

export function Clapperboard({ scene, takes, title, ratio }: ClapperboardProps) {
  const [open, setOpen] = useState(false)
  const [rolling, setRolling] = useState(false)
  const [frames, setFrames] = useState(0)
  const [call, setCall] = useState(-1)
  const timers = useRef<number[]>([])
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()

  useEffect(() => {
    if (!rolling) return
    const timer = window.setInterval(() => setFrames((value) => value + 1), 1000 / FPS)
    return () => window.clearInterval(timer)
  }, [rolling])

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), [])

  const mark = () => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
    setOpen(true)
    setRolling(false)
    setFrames(0)
    setCall(-1)
    timers.current.push(window.setTimeout(() => setOpen(false), 420))
    CALLS.forEach((_, index) => {
      timers.current.push(window.setTimeout(() => setCall(index), 520 + index * 700))
    })
    timers.current.push(window.setTimeout(() => setRolling(true), 520 + CALLS.length * 700))
  }

  const production = (title.trim() || 'UNTITLED PRODUCTION').slice(0, 34).toUpperCase()

  return (
    <section className={`cb-stage${rolling ? ' cb-live' : ''}`} aria-label="Studio slate">
      <div className="cb-rig">
        <button type="button" className="cb-board" onClick={mark} aria-label="Mark the slate and call the take">
          <span className="cb-arm" data-open={open} aria-hidden="true">
            <span className="cb-arm-teeth" />
            <span className="cb-arm-label">{scene.toString().padStart(2, '0')}</span>
          </span>
          <span className="cb-body">
            <span className="cb-head">
              <span>TASVEER STUDIO</span>
              <span className="cb-head-right">PROD. {roll}1</span>
            </span>
            <span className="cb-grid">
              <span className="cb-cell"><i>PRODUCTION</i><b>{production}</b></span>
              <span className="cb-cell"><i>DIRECTOR</i><b>{DIRECTOR}</b></span>
              <span className="cb-cell"><i>SCENE</i><b>{scene.toString().padStart(2, '0')}</b></span>
              <span className="cb-cell"><i>TAKE</i><b>{Math.max(1, takes).toString().padStart(2, '0')}</b></span>
              <span className="cb-cell"><i>FRAME</i><b>{ratio}</b></span>
              <span className="cb-cell"><i>DATE</i><b>{today}</b></span>
            </span>
            <span className="cb-foot">
              <span>{rolling ? 'SPEED' : 'TAP TO MARK'}</span>
              <span className="cb-tc">{timecode(frames)}</span>
            </span>
          </span>
        </button>

        <div className="cb-console" aria-live="polite">
          <span className={`cb-rec${rolling ? ' is-on' : ''}`}>
            <i aria-hidden="true" /> {rolling ? 'REC' : 'STANDBY'}
          </span>
          <ol className="cb-calls">
            {CALLS.map((label, index) => (
              <li key={label} className={call >= index ? 'is-called' : ''}>
                {label}
              </li>
            ))}
          </ol>
          <span className="cb-strip" aria-hidden="true">
            <span className="cb-sprocket" />
            <span className="cb-sprocket" />
            <span className="cb-sprocket" />
            <span className="cb-sprocket" />
            <span className="cb-sprocket" />
          </span>
        </div>
      </div>
    </section>
  )
}
