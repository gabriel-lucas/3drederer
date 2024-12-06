#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { createCanvas } from 'canvas';

import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FileLoader } from 'three';
import { ImageLoader, TextureLoader } from 'three';

import { Buffer } from 'buffer';
import gl from 'gl';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers'


// Polyfill for `self` in Node.js
if (typeof self === 'undefined') {
  global.self = globalThis;
}

// Patch FileLoader to work with Node.js
FileLoader.prototype.load = function (url, onLoad, onProgress, onError) {
  // Handle loading from the file system
  fs.readFile(url, (err, data) => {
    if (err) {
      if (onError) onError(err);
      return;
    }

    // Return the file data as an ArrayBuffer
    onLoad(data.buffer);
  });
};

// Patch ImageLoader to handle Blob URLs in Node.js
THREE.ImageLoader.prototype.load = function (url, onLoad, onProgress, onError) {
  if (url.startsWith('blob:')) {
    //console.log(`Intercepting blob URL: ${url}`);
    // Extract the blob ID from the URL
    const blobId = url.split(':')[2];

    // Here, we assume the texture is embedded in the GLTF file, so no file loading is needed.
    // Find the corresponding buffer data from the GLTF model
    const blobData = self.gltf.blobs[blobId];  // Assuming blobs are stored in a dictionary in the GLTF loader

    if (!blobData) {
      if (onError) onError(new Error(`Blob data not found for ${blobId}`));
      return;
    }

    // Load the image from the binary data
    const img = new Image();
    img.src = `data:image/png;base64,${blobData.toString('base64')}`;  // Assuming the blob is a PNG image
    img.onload = () => onLoad(img);
    img.onerror = onError;
  } else {
    // Fallback to normal loading
    const loader = new TextureLoader();
    loader.load(url, onLoad, onProgress, onError);
  }
};


// Patch FileLoader to work in Node.js without ProgressEvent
THREE.FileLoader.prototype.load = function (url, onLoad, onProgress, onError) {
  const loader = new FileLoader(this.manager);
  // In Node.js, we can use `fs.readFile` to load the file
  fs.readFile(url, (err, data) => {
    if (err) {
      if (onError) onError(err);
      return;
    }
    // Create a buffer array to match the `ArrayBuffer` type expected by GLTFLoader
    const buffer = Buffer.from(data);
    // Handle the loaded data as if it were from a browser file fetch
    onLoad(buffer.buffer); // Pass ArrayBuffer to onLoad
  });
};


// Parse command-line arguments
yargs(hideBin(process.argv))
  .usage('$0 <model> <dimensions> <output.png>')
  .command('Usage: 3drender <model> <dimensions> <output.png>', 'renders and image of the 3d model', () => { }, (argv) => {
    console.info(0)
  })
  .demandCommand(3)
  .argv

const argv = yargs(hideBin(process.argv)).parse();

const [modelPath, dimensions, outputPath] = argv._;

// Validate dimensions
const dimensionMatch = dimensions.match(/^(\d+)x(\d+)$/);
if (!dimensionMatch) {
  console.error('Dimensions must be in the format widthxheight, e.g., 800x600');
  process.exit(1);
}

const width = parseInt(dimensionMatch[1], 10);
const height = parseInt(dimensionMatch[2], 10);


const glContext = gl(width, height, { preserveDrawingBuffer: true });
//console.log("WebGL version: ", glContext.getParameter(glContext.VERSION));
//console.log("WebGL shading language version: ", glContext.getParameter(glContext.SHADING_LANGUAGE_VERSION));
//console.log("WebGL vendor: ", glContext.getParameter(glContext.VENDOR));


// Check if model file exists
if (!fs.existsSync(modelPath)) {
  console.error(`Model file not found: ${modelPath}`);
  process.exit(1);
}

// Determine file extension
const ext = path.extname(modelPath).toLowerCase();

// Setup Three.js scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
camera.position.set(0, 0, 5);


const canvas = createCanvas(width, height);

// Mock event listeners for headless canvas
canvas.addEventListener = () => { };
canvas.removeEventListener = () => { };

// Mock the style object for headless canvas
canvas.style = {};
canvas.style.width = `${width}px`;
canvas.style.height = `${height}px`;

let context;
try {
  context = gl(width, height, { preserveDrawingBuffer: true });
} catch (error) {
  console.error("Failed to create WebGL context.");
  console.error('Error:', error);
  process.exit(1);
}


const renderer = new THREE.WebGLRenderer({
  antialias: true,
  canvas: canvas,
  context: context
});


renderer.setSize(width, height);
renderer.setClearColor(0xffffff, 1); // White background


// Enable shadows in the renderer
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Soft shadows

// Add ambient light
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); // Softer ambient light
scene.add(ambientLight);

// Add a more intense directional light with shadows
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(5, 10, 7);
directionalLight.castShadow = true; // Enable shadow casting
scene.add(directionalLight);

// Add a point light for additional highlights
const pointLight = new THREE.PointLight(0xffffff, 1.5);
pointLight.position.set(10, 10, 10);
pointLight.castShadow = true; // Enable shadow casting
scene.add(pointLight);






// Example 3D cube
// Add a simple cube as the model
// const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
// const cubeMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
// const cubeMesh = new THREE.Mesh(cubeGeometry, cubeMaterial);
// scene.add(cubeMesh);

// Set up helpers for better visualization of the scene
//const gridHelper = new THREE.GridHelper(10, 10);
//scene.add(gridHelper);

//const axesHelper = new THREE.AxesHelper(5);
//scene.add(axesHelper);

//console.log("Model path ", modelPath);

// Load the model
const loadModel = () => {
  if (ext === '.stl') {
    return new Promise((resolve, reject) => {
      fs.readFile(modelPath, (err, data) => {
        if (err) return reject(err);
        const geometry = new STLLoader().parse(data.buffer);
        const material = new THREE.MeshStandardMaterial({
          color: 0xffffff,     // Adjust this to your desired color
          metalness: 0.3,      // Add a bit of metallic feel
          roughness: 0.7,      // Increase roughness to scatter light
          wireframe: false     // Remove wireframe if not needed
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = Math.PI; // Fix upside-down models
        // Ensure that objects cast and receive shadows
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        resolve(mesh);
      });
    });
  } else if (ext === '.gltf' || ext === '.glb') {
    return new Promise((resolve, reject) => {
      fs.readFile(modelPath, (err, data) => {
        if (err) return reject(err);

        // Convert the Node.js Buffer into an ArrayBuffer
        const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);

        const loader = new GLTFLoader();
        self.gltf = {};  // Create a global object to store blobs
        self.gltf.blobs = {};  // Initialize blobs storage

        loader.parse(arrayBuffer, '', (gltf) => {
          // Store blobs in a global object for reference
          self.gltf.blobs = {};

          // Extract blob data for each buffer
          gltf.parser.json.buffers.forEach((buffer) => {
            if (buffer.uri && buffer.uri.startsWith('blob:')) {
              const blobId = buffer.uri.split(':')[2];
              self.gltf.blobs[blobId] = arrayBuffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength); // Store the entire data buffer for the blob
            }
          });

          // Traverse the GLTF scene and handle materials/textures
          gltf.scene.traverse(function (node) {
            if (node.isMesh) {
              node.castShadow = true;
              node.receiveShadow = true;

              // Update material map handling
              if (node.material && node.material.map) {
                node.material.map.encoding = THREE.SRGBColorSpace;

                // Handle loading the texture blob
                if (node.material.map.image && node.material.map.image.src.startsWith('blob:')) {
                  const blobId = node.material.map.image.src.split(':')[2];
                  const blobData = self.gltf.blobs[blobId];
                  if (blobData) {
                    // Create a new image from the blob data
                    const img = new Image();
                    img.src = `data:image/png;base64,${blobData.toString('base64')}`; // Assuming the blob is a PNG
                    img.onload = () => {
                      node.material.map.image = img; // Set the image to the texture map
                      node.material.map.needsUpdate = true; // Indicate the texture needs to be updated
                    };
                  }
                }
              }
            }
          });

          gltf.scene.rotation.x = -Math.PI;
          
          // Add the loaded scene to the Three.js scene
          scene.add(gltf.scene);
          resolve(gltf.scene);
        }, (error) => reject(error));
      });
    });
  } else {
    throw new Error('Unsupported file format. Please use STL or glTF/GLB.');
  }
};



// Render the scene and save as PNG
const renderAndSave = async () => {
  try {
    await loadModel();

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    //console.log(scene);
    //console.log("Scene children:", scene.children);

    // Adjust camera and controls if necessary
    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraZ *= 1.5; // Zoom out a little so that the object fits
    camera.position.set(center.x, center.y, cameraZ);
    camera.lookAt(center);
    camera.updateProjectionMatrix();

    renderer.setClearColor(0x000000, 1); // Set a black background with full opacity

    const renderTarget = new THREE.WebGLRenderTarget(width, height);
    renderer.setRenderTarget(renderTarget);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    // Enable sRGBEncoding for the renderer
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Retrieve pixel data directly from render target
    const pixelBuffer = new Uint8Array(width * height * 4); // 4 bytes per pixel (RGBA)
    renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, pixelBuffer);

    // Write the pixel data to the file
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);
    imageData.data.set(pixelBuffer);
    ctx.putImageData(imageData, 0, 0);
    const buffer = canvas.toBuffer('image/png');
    //console.log("Buffer created: ", buffer.length > 0, " ", buffer); // Check if buffer has content

    fs.writeFileSync(outputPath, buffer);

    console.log(`Image saved to ${outputPath}`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

renderAndSave();
