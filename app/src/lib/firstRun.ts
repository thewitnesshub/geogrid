/**
 * A first launch has no view to return to, so it opens somewhere that rewards
 * being looked at from above rather than on a fixed default. Each zoom frames
 * that particular feature.
 */
export interface Place {
  n: string
  lat: number
  lng: number
  z: number
}

export const FIRST_RUN: Place[] = [
  { n: 'Palm Jumeirah, Dubai', lat: 25.1122, lng: 55.139, z: 14 },
  { n: 'The Great Blue Hole, Belize', lat: 17.316, lng: -87.535, z: 14 },
  { n: 'The Richat Structure, Mauritania', lat: 21.1244, lng: -11.4014, z: 11 },
  { n: 'Venice, Italy', lat: 45.4408, lng: 12.3155, z: 14 },
  { n: 'The temples of Bagan, Myanmar', lat: 21.1717, lng: 94.8585, z: 14 },
  { n: 'Angkor Wat, Cambodia', lat: 13.4125, lng: 103.867, z: 15 },
  { n: 'Bingham Canyon Mine, Utah', lat: 40.523, lng: -112.151, z: 14 },
  { n: 'Meteor Crater, Arizona', lat: 35.0272, lng: -111.0225, z: 15 },
  { n: 'Grand Prismatic Spring, Wyoming', lat: 44.5251, lng: -110.8383, z: 16 },
  { n: 'Salar de Uyuni, Bolivia', lat: -20.1338, lng: -67.4891, z: 12 },
  { n: 'Hạ Long Bay, Vietnam', lat: 20.9101, lng: 107.1839, z: 13 },
  { n: 'Uluru, Australia', lat: -25.3444, lng: 131.0369, z: 14 },
  { n: 'The Nazca Lines, Peru', lat: -14.739, lng: -75.13, z: 15 },
  { n: 'The greenhouses of Almería, Spain', lat: 36.77, lng: -2.75, z: 14 },
  { n: 'Centre-pivot fields, Wadi as-Sirhan', lat: 29.95, lng: 38.5, z: 12 },
  { n: 'The ship graveyard at Moynaq', lat: 43.7686, lng: 59.0289, z: 15 },
  { n: 'Aogashima, Japan', lat: 32.4573, lng: 139.7686, z: 14 },
  { n: 'The pyramids of Giza, Egypt', lat: 29.9773, lng: 31.1325, z: 15 },
]

export const pickFirstRun = () => FIRST_RUN[Math.floor(Math.random() * FIRST_RUN.length)]
