# 3drenderer
A 3D (glb and stl) to image (png) generator

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
 xvfb-run -s "-ac -screen 0 1280x1024x24" node 3drenderer.js duck.glb 800x600 salida.png
```
