export interface Vessel {
  mmsi: string
  lat: number
  lon: number
  speed: number
  heading: number
  status?: string
  timestamp?: string
}
