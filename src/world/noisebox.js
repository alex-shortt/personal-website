import PerlinNoise from "perlin-noise-3d"
import * as THREE from "three"

import Sizer from "services/noisesizer"

export default class NoiseBox {
  constructor(props = {}) {
    const { seed = Math.random() * 10000 } = props

    // perlin noise
    const noise = new PerlinNoise()
    noise.noiseSeed(seed)

    // constants
    this.distance = 900
    this.resolution = 635 // zoom
    this.density = 20 // grooves per unit distance
    this.depth = 0 // depth of the grooves
    this.speed = 0.4
    this.WIDTH = Sizer.getWidth()
    this.HEIGHT = Sizer.getHeight()
    this.lightIntensity = 0.22

    // clock
    const clock = new THREE.Clock()

    // exports
    this.noise = noise
    this.clock = clock

    this.setupPlane()
    this.setupLights()
  }

  setupPlane = () => {
    const { WIDTH, HEIGHT, distance } = this

    // geometry
    const geometry = new THREE.PlaneGeometry(2000, 2000, 100, 100)
    geometry.dynamic = true

    // material
    const material = new THREE.MeshPhongMaterial({
      shading: THREE.SmoothShading,
      color: 0xffffff,
      shininess: 0.4,
      specular: 0xffffff
    })

    // plane
    const plane = new THREE.Mesh(geometry, material)
    plane.rotation.x = Math.PI
    plane.rotation.z = Math.PI
    plane.position.z = distance
    plane.position.y = HEIGHT / 2
    plane.scale.set(WIDTH / 2000, HEIGHT / 2000, 1)

    // exports
    this.plane = plane
  }

  setupLights = () => {
    const { lightIntensity } = this

    // create lights
    const lights = []
    const numlights = 2
    for (let i = 0; i < numlights; i += 1) {
      const newLight = new THREE.SpotLight(
        0xff0000,
        lightIntensity,
        0,
        Math.PI * 0.4,
        0.7
      )
      lights.push(newLight)
    }

    // exports
    this.lights = lights

    this.updateLights(true)
  }

  addToScene = scene => {
    const { plane, lights } = this

    scene.add(plane)

    for (const light of lights) {
      scene.add(light)
      scene.add(light.target)
    }
  }

  addGuiFolder = gui => {
    const folder = gui.addFolder("Noise Box")
    folder.add(this, "speed", 0, 2)
    folder.open()

    // noise
    const noiseFolder = folder.addFolder("Noise")
    noiseFolder.add(this, "resolution", 100, 1000)
    noiseFolder.add(this, "density", 0, 40, 0.5)
    noiseFolder.add(this, "depth", 0, 100)
    noiseFolder.open()

    // lights
    const lightsFolder = folder.addFolder("Lights")
    lightsFolder.add(this, "lightIntensity", 0, 1, 0.01)
    lightsFolder.open()
  }

  render = (renderer, scene) => {
    const { plane, noise, clock } = this
    const { resolution, density, depth, speed } = this

    const time = clock.getElapsedTime()

    // update noise
    if (depth > 0) {
      for (let i = 0; i < plane.geometry.vertices.length; i += 1) {
        const vertex = plane.geometry.vertices[i]
        const x = (vertex.x + 1000) / resolution
        const y = (vertex.y + 1000) / resolution
        const vNoise = noise.get(x, y) * density

        const heightMult = Math.cos(time * speed + vNoise) * 0.5 + 0.5

        vertex.z = heightMult * depth
      }

      // re-render resources
      plane.geometry.verticesNeedUpdate = true
    }

    // update lights
    this.updateLights()
  }

  handleResize = () => {
    const { plane } = this

    const width = Sizer.getWidth()
    const height = Sizer.getHeight()

    // update plane
    plane.scale.set(width / 2000, height / 2000, 1)
    plane.position.y = height / 2

    this.updateLights(true)

    // exports
    this.WIDTH = width
    this.HEIGHT = height
  }

  updateLights = resized => {
    const { lights, distance, depth, clock, speed } = this

    const width = Sizer.getWidth()
    const height = Sizer.getHeight()

    const time = clock.getElapsedTime()

    // update lights
    for (const [i, light] of lights.entries()) {
      const perc = i / (lights.length - 1)

      if (resized) {
        let x = -width / 2 + width * perc
        x *= 0.8
        const z = distance - depth - 500
        const y = height / 2
        light.position.set(x, y, z)
        light.target.position.set(x, y, z + 10)
      }

      const huePos = time * speed * 0.15
      const hue = (huePos + i / lights.length) % 1
      const sat = 0.7
      const value = 1
      const [hu, sa, l] = hsvToHSL(hue, sat, value)

      light.color.setHSL(hu, sa, l)
      light.intensity = this.lightIntensity
    }
  }
}

function hsvToHSL(h, s, v) {
  // both hsv and hsl values are in [0, 1]
  const l = ((2 - s) * v) / 2

  if (l !== 0) {
    if (l === 1) {
      // eslint-disable-next-line no-param-reassign
      s = 0
    } else if (l < 0.5) {
      // eslint-disable-next-line no-param-reassign
      s = (s * v) / (l * 2)
    } else {
      // eslint-disable-next-line no-param-reassign
      s = (s * v) / (2 - l * 2)
    }
  }

  return [h, s, l]
}
