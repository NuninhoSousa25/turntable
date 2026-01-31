# 360° Turntable Viewer System

This project contains a web-based **Editor** to create 360° turntable product views and a **Viewer** to display them.

## Features

- **Multi-Row Support**: Create views with multiple elevation angles (e.g., 0°, 30°, 60°).
- **Interactive Viewer**: 
  - Drag horizontally to rotate.
  - Drag vertically to switch elevation rows.
  - **Scroll to Zoom**: Use mouse wheel to zoom in/out.
- **Advanced Customization (Viewer Settings)**:
  - **Rotation Speed**: Adjust horizontal drag sensitivity.
  - **Vertical Speed**: Adjust row switching sensitivity.
  - **Zoom Control**: Set Min and Max zoom levels.
  - **Auto-Rotation**: Enable automatic rotation with adjustable speed when idle.
  - **Background Color**: Set custom background colors.
- **Import / Export**:
  - **Drag & Drop Import**: Drop a `config.json` anywhere to load a project.
  - **URL Import**: Load a config file directly from a URL.
  - **Separate Exports**: Export `config.json` (data) and `viewer.html` (player) independently.
- **Share Link Generator**: Create deep links to specific configurations hosted online, including initial view state (row, frame, zoom).
- **Auto-Masking**: Automatically remove backgrounds using mask images.

## Structure

- `editor/`: Contains the Editor tool.
  - `index.html`: **Open this file to start.**
  - `style.css`: Styles for the interface.
  - `script.js`: Core logic.
- `viewer.html`: The standalone viewer template.

## How to Use

### 1. Setup
Open `editor/index.html` in your web browser.

### 2. Configuration & Settings
Use the **Viewer Settings** panel to configure the experience:
- **Background Color**: Choose the backdrop.
- **Sensitivity**: Adjust sliders to control how fast the model rotates or changes rows.
- **Zoom Range**: Define how close or far users can zoom.
- **Auto-Rotate**: Enable to make the product spin automatically.

### 3. Adding Images
1.  **Add Row**: Click "**+ Add Elevation Row**" (default starts with one).
2.  **Upload**: Drag & drop your sequence of images into the dashed box.
    - Images are sorted alphabetically by filename.
    - **Optimization**: The editor generates low-res thumbnails for performance, but keeps high-res images for the viewer.
    - **Auto-Masking**: To apply masks, name them `filename_mask.png` and drop them *together* with the main images (e.g., `car.jpg`).
3.  **Edit**:
    - **Reorder**: Drag and drop thumbnails to fix sorting issues.
    - **Delete**: Hover over a thumbnail and click the **×** to remove it.

### 4. Preview
Use the "**Live Preview**" panel on the right. It reflects all your settings (speed, zoom, background) in real-time.

### 5. Saving & Sharing
- **Export Config (JSON)**: Downloads just the data. Useful for backups or hosting.
- **Export Viewer (HTML)**: Downloads a standalone HTML file with your settings embedded.
- **Share Link Generator**:
    1.  Export your `config.json` and upload it to a web server (e.g., GitHub, S3).
    2.  Paste the **Hosted Config URL** into the generator.
    3.  (Optional) Position the model in the preview to where you want the link to start.
    4.  Click **Generate & Copy Link** to create a shareable URL with all your settings preserved.

### 6. Deployment
1.  Upload `viewer.html` and your `config.json` to your web server.
2.  Open `viewer.html` in a browser.
3.  Embed in your site using an iframe:
    ```html
    <iframe src="path/to/viewer.html?config=path/to/config.json" width="600" height="600" frameborder="0"></iframe>
    ```

## URL Parameters
The viewer supports the following URL parameters for deep linking and overrides:
- `config`: URL to the JSON configuration file.
- `row`: Initial row index (default: 0).
- `frame`: Initial frame index (default: 0).
- `autoRotate`: `true` or `false`.
- `speed`: Auto-rotation speed (ms per frame).
- `zoom`: Initial zoom level.
- `minZoom`, `maxZoom`: Zoom limits.
- `sensX`, `sensY`: Drag sensitivities.

## Performance Note
This tool embeds images directly into the JSON configuration as Base64 strings. This is convenient (no database needed) but can result in large file sizes. For production with many high-res images, consider optimizing your source images (JPEG/WebP) before uploading.