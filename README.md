# Botai Inscription

A 3D web application for customizing bowties with personalized text inscriptions. Users can place, preview, and carve custom text onto 3D bowtie models, then order their personalized creation.

## ✨ Features

- **Interactive 3D Preview** - Real-time visualization with WebGL
- **Text Inscription** - Place custom text anywhere on the bowtie surface
- **Multiple Inscriptions** - Add multiple text elements with independent settings
- **Font Selection** - Choose from 6 fonts (Helvetica, Optimer, Gentilis, Roboto, Open Sans, Merriweather)
- **UV-Based Text Mapping** - Text conforms to curved surfaces using UV coordinate mapping
- **CSG Boolean Operations** - High-quality text carving using three-bvh-csg
- **Tutorial System** - Step-by-step onboarding for new users
- **Order System** - Submit orders with automatic Google Drive upload
- **STL Export** - Download carved models for 3D printing

## 🛠️ Tech Stack

| Category | Technologies |
|----------|-------------|
| **Framework** | React 18 + Vite |
| **3D Rendering** | Three.js, @react-three/fiber, @react-three/drei |
| **Post-processing** | @react-three/postprocessing (N8AO ambient occlusion) |
| **CSG Operations** | three-bvh-csg (Boolean subtraction/union) |
| **Mesh Processing** | three-subdivide, SimplifyModifier |
| **Fonts** | Three.js built-in + @compai Google Fonts (via jsdelivr CDN) |

## 📂 Project Structure

```
src/
├── App.jsx                    # Main application - state management, 3D scene setup
├── App.css                    # Global styles
├── main.jsx                   # Application entry point
│
├── components/
│   ├── Scene/                 # 3D model components
│   │   ├── MorpheusModel.jsx  # UV-mapped bowtie model (for raycasting & UV mapping)
│   │   ├── LofiModel.jsx      # Low-poly model (for display & CSG in prod mode)
│   │   └── ClipModel.jsx      # Bowtie clip accessory
│   │
│   ├── SurfaceInscription/    # Text inscription system
│   │   ├── UVTextMapper.jsx   # Core: UV→3D text mapping with subdivision
│   │   │                      #   - Builds UV spatial grid for fast lookup
│   │   │                      #   - Creates extruded text geometry
│   │   │                      #   - Maps UV vertices to 3D surface
│   │   ├── SurfaceRaycaster.jsx # Click/hover detection on mesh surface
│   │   │                      #   - Drag vs click detection (5px threshold)
│   │   │                      #   - Returns UV coordinates, tangent, normal
│   │   ├── ClickMarker.jsx    # Visual marker at click position
│   │   └── UVGridMapper.jsx   # UV grid utilities
│   │
│   └── UI/                    # User interface components
│       ├── ControlPanel.jsx   # Left sidebar with all controls
│       │                      #   - Inscription cards (text, font, size, depth, rotation)
│       │                      #   - Font-specific size constraints
│       │                      #   - Inscribe/Reset/Download buttons
│       │                      #   - Order form
│       ├── Tutorial.jsx       # Step-by-step tutorial overlay
│       └── UVPanel.jsx        # UV visualization panel (dev mode)
│
└── utils/
    ├── csgUtils.js            # CSG operations
    │                          #   - subtractGeometry(): Boolean subtraction
    │                          #   - unionGeometry(): Boolean union with simplification
    │                          #   - simplifyGeometry(): Mesh optimization
    └── stlExporter.js         # Export utilities
                               #   - downloadSTL(): Local STL download
                               #   - uploadToGoogleDrive(): Cloud upload
                               #   - generateGUID(): Unique order IDs

public/
├── Morpheus_uv.obj            # High-detail UV-mapped bowtie
├── Morpheus_lofi.obj          # Low-poly bowtie for display
├── clip.obj                   # Bowtie clip model
├── Botai_Logo.svg             # Logo
└── ...                        # Other model variants
```

## 🔄 Application Flow

### User Workflow

```
1. Enter Text     →  Type text, select font, adjust size/depth/rotation
2. Place Text     →  Click on bowtie surface to position inscription
3. Preview        →  See real-time 3D text preview on surface
4. Repeat         →  Add more inscriptions if desired (+ button)
5. Inscribe       →  Click "Inscribe" to carve text into model
6. Order          →  Enter email and submit order
```

### Technical Flow

```
Click on surface
       ↓
SurfaceRaycaster detects hit → Returns point, normal, UV, tangent
       ↓
UVTextMapper generates text geometry
  ├─ Loads font (cached)
  ├─ Creates 2D text shapes
  ├─ Subdivides for curve conformance
  ├─ Maps UV vertices to 3D via spatial grid
  └─ Creates extruded geometry (front + back + sides)
       ↓
Preview rendered on model
       ↓
User clicks "Inscribe"
       ↓
CSG subtraction (text carved from bowtie)
       ↓
Union with clip model
       ↓
Final inscribed model ready for export/order
```

## 🎛️ Modes

| Mode | URL | Purpose |
|------|-----|---------|
| **Production** | `/?mode=prod` (default) | Customer-facing, clean UI, uses lofi model |
| **Development** | `/?mode=dev` | Debug tools, UV panel, JSON import/export, high-detail model |

### Dev Mode Features
- UV visualization panel
- JSON export/import for inscription data
- Show/hide individual components (marker, text mesh, clip)
- Triangle edge size control
- Mesh simplification enabled

## 🔤 Fonts

| Font | Min Size | Source |
|------|----------|--------|
| Helvetica | 1 | Three.js built-in |
| Optimer | 4 | Three.js built-in |
| Gentilis | 4 | Three.js built-in |
| Roboto | 1 | Google Fonts (@compai) |
| Open Sans | 1 | Google Fonts (@compai) |
| Merriweather | 2 | Google Fonts (@compai) |

Font size ranges from 1-5, mapping to scale values 0.015-0.035.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/botai-studio/BotaiInscription.git
cd BotaiInscription

# Install dependencies
npm install

# Start development server
npm run dev
```

### Build for Production

```bash
npm run build
npm run preview
```

## 📡 Google Apps Script Integration

The app integrates with Google Apps Script for order processing:
- Orders are uploaded as JSON to Google Drive
- STL files are uploaded for manufacturing
- See `GoogleAppsScript.gs` for the backend code

## 🎨 Visual Effects

- **N8AO Ambient Occlusion** - Enhanced depth perception (aoRadius=0.8, intensity=6)
- **Rim Lighting** - Edge highlights for better visibility
- **Real-time Shadows** - Soft shadows for realism

## 🎮 Controls

- **Rotate**: Left Click + Drag
- **Pan**: Right Click + Drag  
- **Zoom**: Scroll wheel
- **Place Inscription**: Click on bowtie surface

## 📝 Key Implementation Details

### UV Grid Spatial Index
For fast UV→3D mapping, a 32×32 spatial grid indexes mesh triangles by their UV bounding boxes. This reduces lookup complexity from O(n×m) to approximately O(n).

### Text Subdivision
Text geometry is subdivided to better conform to curved surfaces. The `maxTriangleSize` parameter controls subdivision granularity.

### CSG Operations
Uses `three-bvh-csg` with BVH (Bounding Volume Hierarchy) acceleration for fast boolean operations. Geometries are merged and simplified post-operation.

### Click vs Drag Detection
Mouse movement threshold of 5 pixels distinguishes clicks (place inscription) from drags (rotate view).

## 📄 License

Private - Botai Studio
