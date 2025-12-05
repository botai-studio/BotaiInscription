# Botai 3D Customizer

Botai is an interactive 3D web application for customizing, generating, and ordering 3D printed jewelry and artifacts. It leverages WebGL and procedural geometry to allow users to modify designs in real-time.

## 🛠️ Tech Stack

*   **Framework**: React + Vite
*   **3D Engine**: Three.js / @react-three/fiber / @react-three/drei
*   **Geometry Processing**:
    *   `manifold-3d`: High-performance boolean operations (CSG).
    *   `three-subdivide`: Mesh subdivision.
    *   `three-bvh-csg`: CSG boolean operations for text carving.
*   **Styling**: CSS Modules.

## 📂 Project Structure

```
src/
├── components/
│   ├── ModelViewer/
│   │   ├── ModelViewer.jsx       # Main component for rendering models
│   │   └── csgUtils.js           # CSG (Boolean) logic and geometry processing
│   │                             #   - subtractGeometry(): Generic geometry subtraction
│   │                             #   - applyBooleanSubtraction(): Text inscription
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
│   ├── SurfaceInscription/
│   │   ├── index.jsx             # Entry point for inscription system
│   │   ├── ClickMarker.jsx       # Visual marker for click points
│   │   ├── SurfaceRaycaster.jsx  # Raycasting logic for surface detection
│   │   ├── SurfaceText.jsx       # Dot-based text visualization
│   │   ├── SurfaceTextMesh.jsx   # 3D mesh text (conforms to surface)
│   │   │                         #   - Generates geometry for CSG subtraction
│   │   │                         #   - onGeometryReady callback for Apply
│   │   └── UVMapVisualization.jsx # Debug visualization for UVs
│   │
│   └── UI/
│       └── ControlPanel.jsx      # Left sidebar with all controls
│                                 #   - Mode selection
│                                 #   - Inscription management (Test Mode)
│                                 #   - "Apply Inscriptions (Carve)" button
│
├── utils/
│   ├── math.js                   # Helper functions (GUID, Price calc)
│   └── objExporter.js            # STL export and Google Drive upload
│
├── App.jsx                       # Main application layout and state
├── main.jsx                      # Application entry point
└── App.css                       # Global styles
```

## 🔪 Inscription System (Test Mode)

The Test Mode allows users to place and carve text inscriptions onto 3D models.

### How It Works

1. **Place Inscription**: Click on the model surface to position text. The text conforms to the curved surface using barycentric mapping.

2. **Configure**: Adjust text, scale, rotation, and depth for each inscription via the card UI.

3. **Preview**: Enable "Text Mesh" checkbox to see the 3D text geometry that will be carved.

4. **Apply**: Click "🔪 Apply Inscriptions (Carve)" to perform CSG boolean subtraction.

### Technical Flow

```
User clicks surface → SurfaceRaycaster detects hit → clickData stored
                                                           ↓
SurfaceTextMesh generates conformed 3D text geometry → onGeometryReady callback
                                                           ↓
Geometry stored in App.jsx (textMeshGeometries) ← keyed by inscription ID
                                                           ↓
User clicks "Apply" → ModelViewer.subtractGeometry() ← uses clean twistedGeometry
                                                           ↓
Result: Model with carved text (fresh each Apply, no accumulation)
```

### Key Files

| File | Role |
|------|------|
| `SurfaceTextMesh.jsx` | Generates 3D text that conforms to mesh surface |
| `csgUtils.js` | `subtractGeometry(base, sub)` - generic CSG subtraction |
| `ModelViewer.jsx` | Orchestrates the Apply flow, manages geometry states |
| `ControlPanel.jsx` | UI for inscriptions + Apply button |
| `App.jsx` | State management for `textMeshGeometries` |

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
