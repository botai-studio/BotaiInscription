# Botai 3D Customizer

Botai is an interactive 3D web application for customizing, generating, and ordering 3D printed jewelry and artifacts. It leverages WebGL and procedural geometry to allow users to modify designs in real-time.

## 🛠️ Tech Stack

*   **Framework**: React + Vite
*   **3D Engine**: Three.js / @react-three/fiber / @react-three/drei
*   **Geometry Processing**:
    *   `manifold-3d`: High-performance boolean operations (CSG).
    *   `three-subdivide`: Mesh subdivision.
    *   `three-bvh-csg`: CSG fallback and helpers.
*   **Styling**: CSS Modules.

## 📂 Project Structure

```
src/
├── components/
│   ├── ModelViewer/
│   │   ├── ModelViewer.jsx       # Main component for rendering models
│   │   └── csgUtils.js           # CSG (Boolean) logic and geometry processing
│   │
│   ├── Procedural/
│   │   ├── CatmullClarkCube.jsx  # Procedural cube with subdivision
│   │   ├── GraphMeshGenerator.jsx # Graph-based mesh generation
│   │   ├── RandomGraphMesh.jsx   # Random graph visualization
│   │   └── SimpleTetrahedron.jsx # Basic tetrahedron shape
│   │
│   ├── Providers/
│   │   └── ManifoldProvider.jsx  # Context provider for Manifold library
│   │
│   ├── Scene/
│   │   ├── CameraController.jsx  # Camera movement logic
│   │   └── ClipMesh.jsx          # Accessory mesh (Clip)
│   │
│   └── SurfaceInscription/
│       ├── index.jsx             # Entry point for inscription system
│       ├── ClickMarker.jsx       # Visual marker for click points
│       ├── SurfaceRaycaster.jsx  # Raycasting logic for surface detection
│       ├── SurfaceText.jsx       # Text generation logic
│       ├── SurfaceTextMesh.jsx   # 3D mesh representation of text
│       └── UVMapVisualization.jsx # Debug visualization for UVs
│
├── utils/
│   ├── math.js                   # Helper functions (GUID, Price calc)
│   └── objExporter.js            # STL export and Google Drive upload
│
├── App.jsx                       # Main application layout and state
├── main.jsx                      # Application entry point
└── App.css                       # Global styles
```

## 📦 Setup & Run

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Start Development Server**:
    ```bash
    npm run dev
    ```

3.  **Build for Production**:
    ```bash
    npm run build
    ```

## 🎮 Controls

*   **Rotate**: Left Click + Drag
*   **Pan**: Right Click + Drag
*   **Zoom**: Scroll
*   **Inscription (Test Mode)**: Click on the model surface to place text.

## 📝 License

Private / Proprietary
