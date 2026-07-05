export type CaptureMode = 'manual' | 'timed'

export interface CaptureSession {
  id: string
  name: string
  location: string
  description: string
  mode: 'manual' | 'timed'
  durationSeconds: number | null
  storageIntervalSeconds: number
  startedAt: string
  finishedAt: string | null
  status: 'active' | 'finished'
}
