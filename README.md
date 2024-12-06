# 3drenderer
A 3D (glb and stl) to image (png) generator

<img src="https://github.com/gabriel-lucas/3drenderer/blob/main/output2.png?raw=true" alt="3D duck model" width="400">

## Installation instructions
Install dependencies

```
 npm i
```

Install xvfb

```
 sudo apt install xvfb
```

Execute

```
 xvfb-run -s "-ac -screen 0 1280x1024x24" node 3drenderer.js model/duck.glb 800x600 output2.png
```
