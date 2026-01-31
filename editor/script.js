/**
 * 360° Turntable Editor & Viewer
 * 
 * Architecture:
 * 1. TurntableController: Loaded from ../js/TurntableController.js (Shared Logic)
 * 2. EditorLogic: Handles UI state, file processing, and DOM manipulation.
 * 3. ExportLogic: Generates the standalone viewer files.
 */

// ==========================================
// 2. EDITOR LOGIC (State & UI)
// ==========================================

const EditorState = {
    objectName: "My Product",
    backgroundColor: "#eeeeee",
    applyMasks: false,
    settings: {
        sensitivityX: 25,
        sensitivityY: 50,
        minZoom: 1,
        maxZoom: 3,
        autoRotate: false,
        autoRotateSpeed: 100
    },
    rows: [] // { id, elevation, images: [] }
};

const UI = {
    rowsContainer: document.getElementById('rows-container'),
    previewImage: document.getElementById('preview-image'),
    previewLoader: document.getElementById('preview-loader'),
    previewContainer: document.getElementById('preview-container'),
    inputs: {
        addRow: document.getElementById('add-row-btn'),
        name: document.getElementById('objectName'),
        bgColor: document.getElementById('bgColor'),
        bgColorVal: document.getElementById('bgColorValue'),
        mask: document.getElementById('applyMasks'),
        exportJson: document.getElementById('export-json-btn'),
        exportHtml: document.getElementById('export-html-btn'),
        importUrlInput: document.getElementById('importUrl'),
        importUrlBtn: document.getElementById('import-url-btn'),
        // New Settings Inputs
        sensX: document.getElementById('sensX'),
        sensY: document.getElementById('sensY'),
        minZoom: document.getElementById('minZoom'),
        maxZoom: document.getElementById('maxZoom'),
        autoRotate: document.getElementById('autoRotate'),
        autoRotateSpeed: document.getElementById('autoRotateSpeed'),
        // Share Generator
        hostedConfigUrl: document.getElementById('hostedConfigUrl'),
        viewerBaseUrl: document.getElementById('viewerBaseUrl'),
        generateLinkBtn: document.getElementById('generate-link-btn'),
        linkOutput: document.getElementById('generated-link-output'),
        linkContainer: document.getElementById('generated-link-container')
    }
};

let previewController = null;

function initEditor() {
    // 1. Setup Preview with Initial Settings
    previewController = new TurntableController(
        UI.previewContainer,
        UI.previewImage,
        [], 
        { 
            onUpdate: highlightActiveThumbnail,
            ...EditorState.settings
        }
    );

    // 2. Add Initial Data
    addElevationRow(); 

    // 3. Bind UI Events
    UI.inputs.addRow.addEventListener('click', () => addElevationRow());
    UI.inputs.name.addEventListener('input', (e) => EditorState.objectName = e.target.value);
    
    UI.inputs.bgColor.addEventListener('input', (e) => {
        EditorState.backgroundColor = e.target.value;
        UI.inputs.bgColorVal.textContent = e.target.value;
        UI.previewContainer.style.backgroundColor = e.target.value;
    });

    UI.inputs.mask.addEventListener('change', (e) => EditorState.applyMasks = e.target.checked);
    
    UI.inputs.exportJson.addEventListener('click', () => exportConfiguration('json'));
    UI.inputs.exportHtml.addEventListener('click', () => exportConfiguration('html'));
    
    UI.inputs.importUrlBtn.addEventListener('click', handleUrlImport);
    UI.inputs.generateLinkBtn.addEventListener('click', generateShareLink);

    // Bind Settings Inputs
    const updateSettings = () => {
        EditorState.settings = {
            sensitivityX: parseInt(UI.inputs.sensX.value),
            sensitivityY: parseInt(UI.inputs.sensY.value),
            minZoom: parseFloat(UI.inputs.minZoom.value),
            maxZoom: parseFloat(UI.inputs.maxZoom.value),
            autoRotate: UI.inputs.autoRotate.checked,
            autoRotateSpeed: parseInt(UI.inputs.autoRotateSpeed.value)
        };
        previewController.updateOptions(EditorState.settings);
    };

    UI.inputs.sensX.addEventListener('input', updateSettings);
    UI.inputs.sensY.addEventListener('input', updateSettings);
    UI.inputs.minZoom.addEventListener('input', updateSettings);
    UI.inputs.maxZoom.addEventListener('input', updateSettings);
    UI.inputs.autoRotate.addEventListener('change', updateSettings);
    UI.inputs.autoRotateSpeed.addEventListener('input', updateSettings);

    // 4. Global Drag & Drop (Import Config)
    setupGlobalDragAndDrop();
}

function generateShareLink() {
    const configUrl = UI.inputs.hostedConfigUrl.value.trim();
    const baseUrl = UI.inputs.viewerBaseUrl.value.trim() || "viewer.html";

    if (!configUrl) {
        alert("Please enter the URL where your config.json is hosted.");
        return;
    }

    const params = new URLSearchParams();
    params.set('config', configUrl);
    
    // Add Settings overrides
    if (EditorState.settings.autoRotate) {
        params.set('autoRotate', 'true');
        params.set('speed', EditorState.settings.autoRotateSpeed);
    }
    
    params.set('zoom', EditorState.settings.minZoom); // Initial zoom
    params.set('minZoom', EditorState.settings.minZoom);
    params.set('maxZoom', EditorState.settings.maxZoom);
    params.set('sensX', EditorState.settings.sensitivityX);
    params.set('sensY', EditorState.settings.sensitivityY);

    // Add Current View State (from Preview Controller)
    if (previewController) {
        params.set('row', previewController.state.currentRowIdx);
        params.set('frame', previewController.state.currentFrameIdx);
    }

    const finalUrl = `${baseUrl}?${params.toString()}`;
    
    UI.inputs.linkContainer.style.display = 'block';
    UI.inputs.linkOutput.value = finalUrl;
    UI.inputs.linkOutput.select();
    
    // Copy to clipboard
    try {
        document.execCommand('copy');
        alert("Link copied to clipboard!");
    } catch (err) {
        console.error("Failed to copy", err);
    }
}

async function handleUrlImport() {
    const url = UI.inputs.importUrlInput.value.trim();
    if (!url) {
        alert("Please enter a URL.");
        return;
    }

    try {
        UI.inputs.importUrlBtn.disabled = true;
        UI.inputs.importUrlBtn.textContent = "Loading...";

        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const config = await response.json();
        loadConfiguration(config);
        
        UI.inputs.importUrlInput.value = ''; // Clear input on success
    } catch (err) {
        console.error("URL Import Failed", err);
        let msg = "Failed to load config from URL.";
        if (err.message.includes("Failed to fetch")) {
            msg += "\n\nPossible causes:\n1. CORS policy: The server hosting the file must allow access.\n2. Network error: Check the URL and your connection.\n3. Mixed Content: Don't use HTTP on an HTTPS site.";
        } else {
            msg += "\n" + err.message;
        }
        alert(msg);
    } finally {
        UI.inputs.importUrlBtn.disabled = false;
        UI.inputs.importUrlBtn.textContent = "Load";
    }
}


function setupGlobalDragAndDrop() {
    const overlay = document.getElementById('drag-overlay');
    let dragCounter = 0;

    // Show overlay on enter
    window.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dragCounter++;
        console.log('dragenter', dragCounter, e.dataTransfer.types);
        // Check if we are dragging a file
        if (e.dataTransfer.types && (e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('application/x-moz-file'))) {
            overlay.style.display = 'flex';
            overlay.querySelector('p').textContent = "Drop Config to Import"; // Reset text
        }
    });

    // Hide overlay on leave
    window.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dragCounter--;
        console.log('dragleave', dragCounter);
        if (dragCounter <= 0) { // Safety check
            dragCounter = 0;
            overlay.style.display = 'none';
        }
    });

    window.addEventListener('dragover', e => e.preventDefault());

    // Handle Drop on Window (or Overlay)
    window.addEventListener('drop', (e) => {
        e.preventDefault();
        console.log('drop event');
        dragCounter = 0;
        overlay.style.display = 'none';
        handleGlobalDrop(e);
    });
}

async function handleGlobalDrop(e) {
    const files = e.dataTransfer.files;
    console.log('handleGlobalDrop files:', files);
    
    if (files.length === 0) return;

    // Check if it's a JSON config file
    const file = files[0];
    console.log('File type:', file.type, 'Name:', file.name);

    if (file.type === 'application/json' || file.name.endsWith('.json')) {
        try {
            const content = await readFileAsText(file);
            console.log('File content read, length:', content.length);
            const config = JSON.parse(content);
            console.log('Parsed config:', config);
            loadConfiguration(config);
        } catch (err) {
            console.error("Failed to load config", err);
            alert("Error loading config: " + err.message);
        }
        return;
    } else {
        console.warn('Dropped file is not a JSON config.');
    }
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

function loadConfiguration(config) {
    if (!config.objects || !config.objects.length) return;
    const obj = config.objects[0];

    console.log("Starting loadConfiguration...");

    // Show Loading Overlay
    const overlay = document.getElementById('drag-overlay');
    const overlayText = overlay.querySelector('p');
    overlay.style.display = 'flex';
    overlayText.textContent = "Importing... Please Wait";

    // 1. Update State
    EditorState.objectName = obj.name || "My Product";
    EditorState.backgroundColor = obj.backgroundColor || "#eeeeee";
    EditorState.rows = []; // Clear existing

    // Load Settings
    if (obj.settings) {
        EditorState.settings = { ...EditorState.settings, ...obj.settings };
    }

    // 2. Update UI Inputs
    UI.inputs.name.value = EditorState.objectName;
    UI.inputs.bgColor.value = EditorState.backgroundColor;
    UI.inputs.bgColorVal.textContent = EditorState.backgroundColor;
    UI.previewContainer.style.backgroundColor = EditorState.backgroundColor;

    // Update Settings UI
    UI.inputs.sensX.value = EditorState.settings.sensitivityX;
    UI.inputs.sensY.value = EditorState.settings.sensitivityY;
    UI.inputs.minZoom.value = EditorState.settings.minZoom;
    UI.inputs.maxZoom.value = EditorState.settings.maxZoom;
    UI.inputs.autoRotate.checked = EditorState.settings.autoRotate;
    UI.inputs.autoRotateSpeed.value = EditorState.settings.autoRotateSpeed;

    // Update Controller Options immediately
    previewController.updateOptions(EditorState.settings);

    // 3. Rebuild Rows
    // Clear UI
    UI.rowsContainer.innerHTML = '';
    
    // Process Rows
    // We need to wait for thumbnails to generate, so we do this async
    (async () => {
        try {
            for (const rowData of obj.rows) {
                console.log(`Processing row: ${rowData.elevation}`);
                const newRow = {
                    id: Date.now() + Math.floor(Math.random() * 10000), // Ensure unique integer
                    elevation: rowData.elevation,
                    images: [...rowData.images] // Copy images
                };
                EditorState.rows.push(newRow);
                renderRowUI(newRow);
                
                // Render Thumbnails
                let imgCount = 0;
                for (const imgSrc of newRow.images) {
                    imgCount++;
                    if (imgCount % 5 === 0) {
                         overlayText.textContent = `Importing Row ${obj.rows.indexOf(rowData) + 1}... Image ${imgCount}`;
                         // Allow UI update
                         await new Promise(r => setTimeout(r, 0)); 
                    }

                    try {
                        // Generate thumbnail from the base64 source
                        const thumbSrc = await createOptimizedThumbnail(imgSrc);
                        renderThumbnailUI(newRow, thumbSrc, "Imported Image");
                    } catch (e) {
                        console.warn("Failed to generate thumb for image", e);
                    }
                }
                updateRowCount(newRow.id);
            }
            console.log("All rows processed. Syncing preview.");
            syncPreview();
            alert("Import Successful!");
        } catch (error) {
            console.error("Error during import:", error);
            alert("Error during import: " + error.message);
        } finally {
            overlay.style.display = 'none';
            overlayText.textContent = "Drop Config to Import";
        }
    })();
}


// --- Row Operations ---

function addElevationRow() {
    const rowId = Date.now();
    const newRow = {
        id: rowId,
        elevation: EditorState.rows.length === 0 ? "0°" : "30°",
        images: []
    };
    EditorState.rows.push(newRow);
    renderRowUI(newRow);
    syncPreview();
}

function removeRow(rowId) {
    EditorState.rows = EditorState.rows.filter(r => r.id !== rowId);
    const el = document.getElementById(`row-${rowId}`);
    if (el) el.remove();
    syncPreview();
}

function renderRowUI(row) {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'row-card';
    rowDiv.id = `row-${row.id}`;
    
    rowDiv.innerHTML = `
        <div class="row-header">
            <div class="form-group" style="margin-bottom:0; flex-grow:1; margin-right:10px;">
                <label>Elevation Label</label>
                <input type="text" value="${row.elevation}" onchange="updateRowLabel(${row.id}, this.value)">
            </div>
            <button class="remove-btn" onclick="removeRow(${row.id})">Remove</button>
        </div>
        <div class="drop-zone" id="drop-${row.id}">
            <p>Drag & Drop Images Here</p>
            <small>or click to select</small>
            <input type="file" multiple accept="image/*" style="display:none" id="file-${row.id}">
        </div>
        <div class="thumbnail-strip" id="thumbs-${row.id}"></div>
        <div style="margin-top:5px; font-size: 0.9em; color:#666;" id="count-${row.id}">0 images</div>
    `;

    UI.rowsContainer.appendChild(rowDiv);

    // Setup Drag & Drop for this row
    setupFileDropListeners(rowDiv, row.id);
}

function updateRowLabel(rowId, value) {
    const row = EditorState.rows.find(r => r.id === rowId);
    if (row) {
        row.elevation = value;
        syncPreview();
    }
}

// --- File Processing ---

function setupFileDropListeners(rowElement, rowId) {
    const dropZone = rowElement.querySelector('.drop-zone');
    const fileInput = rowElement.querySelector(`#file-${rowId}`);

    // Click to upload
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => processFiles(e.target.files, rowId));
    
    // Drag Visuals
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    
    // Drop Action
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        processFiles(e.dataTransfer.files, rowId);
    });
}

async function processFiles(fileList, rowId) {
    const row = EditorState.rows.find(r => r.id === rowId);
    if (!row) return;

    const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;

    // Sort alphabetically
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    if (EditorState.applyMasks) {
        await processFilesWithMasks(files, row);
    } else {
        await processFilesSimple(files, row);
    }
}

async function processFilesSimple(files, row) {
    for (const file of files) {
        const fullSrc = await readFileAsDataURL(file);
        row.images.push(fullSrc);
        
        const thumbSrc = await createOptimizedThumbnail(fullSrc);
        renderThumbnailUI(row, thumbSrc, file.name);
    }
    updateRowCount(row.id);
    syncPreview();
}

async function processFilesWithMasks(files, row) {
    // Separate Images and Masks
    const imageFiles = [];
    const maskMap = {}; 

    for (const file of files) {
        if (file.name.includes('_mask')) {
            const base = file.name.replace('_mask', '').split('.')[0];
            maskMap[base] = file;
        } else {
            imageFiles.push(file);
        }
    }

    if (imageFiles.length === 0 && Object.keys(maskMap).length > 0) {
        alert("Only masks detected! Please drag images AND masks together.");
        return;
    }

    for (const imgFile of imageFiles) {
        const baseName = imgFile.name.split('.')[0];
        const maskFile = maskMap[baseName];

        if (maskFile) {
            try {
                const maskedSrc = await applyMask(imgFile, maskFile);
                row.images.push(maskedSrc);
                
                const thumbSrc = await createOptimizedThumbnail(maskedSrc);
                renderThumbnailUI(row, thumbSrc, imgFile.name);
            } catch (err) {
                console.error("Masking failed for " + imgFile.name, err);
            }
        } else {
            // Fallback if mask missing
            const fullSrc = await readFileAsDataURL(imgFile);
            row.images.push(fullSrc);
            const thumbSrc = await createOptimizedThumbnail(fullSrc);
            renderThumbnailUI(row, thumbSrc, imgFile.name);
        }
    }
    updateRowCount(row.id);
    syncPreview();
}

// --- Image Helpers ---

function readFileAsDataURL(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
    });
}

function applyMask(imgFile, maskFile) {
    return new Promise(async (resolve) => {
        const imgSrc = await readFileAsDataURL(imgFile);
        const maskSrc = await readFileAsDataURL(maskFile);

        const imgObj = await loadImage(imgSrc);
        const maskObj = await loadImage(maskSrc);

        // Setup Canvas (Offscreen if available)
        const w = imgObj.width;
        const h = imgObj.height;
        let ctx, canvas;

        if (window.OffscreenCanvas) {
            canvas = new OffscreenCanvas(w, h);
            ctx = canvas.getContext('2d');
        } else {
            canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            ctx = canvas.getContext('2d');
        }

        // 1. Draw Mask
        ctx.drawImage(maskObj, 0, 0, w, h);
        
        // 2. Convert Mask to Alpha (Luma Matte)
        const maskData = ctx.getImageData(0, 0, w, h);
        const data = maskData.data;
        for (let i = 0; i < data.length; i += 4) {
            // Avg of RGB -> Alpha
            const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
            data[i + 3] = avg; 
        }
        ctx.putImageData(maskData, 0, 0);

        // 3. Composite Source Image
        ctx.globalCompositeOperation = 'source-in';
        ctx.drawImage(imgObj, 0, 0, w, h);

        // Output
        if (canvas.convertToBlob) {
            const blob = await canvas.convertToBlob();
            resolve(await readFileAsDataURL(blob));
        } else {
            resolve(canvas.toDataURL('image/png'));
        }
    });
}

function createOptimizedThumbnail(src) {
    return new Promise(async (resolve) => {
        const img = await loadImage(src);
        const h = 100;
        const w = h * (img.width / img.height);

        const canvas = document.createElement('canvas');
        canvas.width = w; 
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        
        resolve(canvas.toDataURL('image/jpeg', 0.7));
    });
}

function loadImage(src) {
    return new Promise((resolve) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.src = src;
    });
}

// --- Thumbnail UI & Reordering ---

function renderThumbnailUI(row, thumbSrc, name) {
    const container = document.getElementById(`thumbs-${row.id}`);
    const thumbItem = document.createElement('div');
    thumbItem.className = 'thumb-item';
    thumbItem.draggable = true;

    thumbItem.innerHTML = `
        <img src="${thumbSrc}">
        <div class="thumb-name" title="${name}">${name}</div>
        <button class="delete-img-btn" title="Remove">×</button>
    `;

    // Delete
    thumbItem.querySelector('.delete-img-btn').onclick = (e) => {
        e.stopPropagation();
        const idx = getChildIndex(thumbItem);
        if (idx > -1) {
            row.images.splice(idx, 1); // Remove from data
            thumbItem.remove();        // Remove from UI
            updateRowCount(row.id);
            syncPreview();
        }
    };

    // Reorder Drag & Drop
    setupReorderLogic(thumbItem, row.id);

    container.appendChild(thumbItem);
}

function setupReorderLogic(item, rowId) {
    item.addEventListener('dragstart', (e) => {
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        // Pass index and RowID
        e.dataTransfer.setData('text/plain', JSON.stringify({ 
            rowId: rowId, 
            index: getChildIndex(item) 
        }));
    });

    item.addEventListener('dragend', () => item.classList.remove('dragging'));
    item.addEventListener('dragover', (e) => {
        e.preventDefault(); // Allow drop
        item.style.transform = 'scale(1.05)';
    });
    item.addEventListener('dragleave', () => item.style.transform = 'scale(1)');

    item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.style.transform = 'scale(1)';
        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (data.rowId !== rowId) return; // Wrong row

            const fromIndex = data.index;
            const toIndex = getChildIndex(item);
            
            if (fromIndex !== toIndex) {
                // Update Data
                const row = EditorState.rows.find(r => r.id === rowId);
                const moved = row.images.splice(fromIndex, 1)[0];
                row.images.splice(toIndex, 0, moved);

                // Update UI
                const container = item.parentNode;
                const children = Array.from(container.children);
                if (toIndex >= children.length - 1) {
                    container.appendChild(children[fromIndex]);
                } else {
                    container.insertBefore(children[fromIndex], children[toIndex > fromIndex ? toIndex + 1 : toIndex]);
                }
                syncPreview();
            }
        } catch(err) {}
    });
}

function getChildIndex(node) {
    return Array.from(node.parentNode.children).indexOf(node);
}

function updateRowCount(rowId) {
    const row = EditorState.rows.find(r => r.id === rowId);
    if (row) {
        document.getElementById(`count-${rowId}`).innerText = `${row.images.length} images`;
    }
}

// --- Preview Sync ---

function getSortedRows() {
    return [...EditorState.rows].sort((a, b) => {
        return (parseFloat(a.elevation) || 0) - (parseFloat(b.elevation) || 0);
    });
}

function syncPreview() {
    const sorted = getSortedRows();
    const hasImages = sorted.some(r => r.images.length > 0);

    if (hasImages) {
        UI.previewLoader.style.display = 'none';
        UI.previewImage.style.display = 'block';
        previewController.updateRows(sorted);
    } else {
        UI.previewLoader.style.display = 'block';
        UI.previewImage.style.display = 'none';
    }
}

function highlightActiveThumbnail({ rowId, frameIndex }) {
    if (!rowId) return;
    const container = document.getElementById(`thumbs-${rowId}`);
    if (!container) return;

    // Reset old active
    const active = container.querySelector('.active');
    if (active) active.classList.remove('active');

    // Set new active
    const newActive = container.children[frameIndex];
    if (newActive) {
        newActive.classList.add('active');
        newActive.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
}

// ==========================================
// 3. EXPORT LOGIC
// ==========================================

function exportConfiguration(type) {
    if (EditorState.rows.length === 0 || EditorState.rows.every(r => r.images.length === 0)) {
        alert("Please add at least one row with images.");
        return;
    }

    const sortedRows = getSortedRows();
    const safeName = EditorState.objectName.replace(/[^a-z0-9]/gi, '_').toLowerCase() || "my_product";

    // 1. Create Data Object
    const config = {
        objects: [{
            id: "obj_" + Date.now(),
            name: EditorState.objectName,
            backgroundColor: EditorState.backgroundColor,
            settings: EditorState.settings, // Include Settings
            rows: sortedRows.map(r => ({
                elevation: r.elevation,
                images: r.images
            }))
        }]
    };

    if (type === 'json') {
        downloadFile(`${safeName}.json`, JSON.stringify(config, null, 2), 'application/json');
    } else if (type === 'html') {
        const viewerHTML = generateViewerHTML(EditorState.objectName, EditorState.settings);
        downloadFile(`${safeName}_viewer.html`, viewerHTML, 'text/html');
    }
}

function generateViewerHTML(title, settings = {}) {
    // Pass settings as JSON string to be merged
    const settingsJson = JSON.stringify(settings);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - 360 Viewer</title>
    <style>
        body, html { margin: 0; padding: 0; height: 100%; overflow: hidden; background: #fff; }
        #viewer { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; cursor: grab; touch-action: none; transition: background 0.3s; }
        #viewer:active { cursor: grabbing; }
        #product-image { max-width: 100%; max-height: 100%; user-select: none; -webkit-user-drag: none; transition: transform 0.1s ease-out; } 
        .loading { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-family: sans-serif; color: #666; }
    </style>
</head>
<body>
    <div id="viewer">
        <div class="loading">Loading 360 View...</div>
        <img id="product-image" draggable="false" style="display:none">
    </div>

    <script>
        ${TurntableController.toString()}

        // --- Drag & Drop Config Support ---
        function setupDragAndDrop(viewerEl, imgEl, loader) {
            window.addEventListener('dragover', e => e.preventDefault());
            window.addEventListener('drop', async e => {
                e.preventDefault();
                
                const files = e.dataTransfer.files;
                if (files.length === 0) return;

                const file = files[0];
                if (file.type === 'application/json' || file.name.endsWith('.json')) {
                    loader.style.display = 'block';
                    loader.textContent = 'Loading config...';
                    imgEl.style.display = 'none';
                    
                    try {
                        const content = await readFileAsText(file);
                        const config = JSON.parse(content);
                        const obj = config.objects[0];

                        if (obj.backgroundColor) viewerEl.style.backgroundColor = obj.backgroundColor;
                        
                        // Merge exported settings if present
                        const options = obj.settings || {};

                        // Re-init controller
                        if (window.viewerInstance) window.viewerInstance.destroy();
                        window.viewerInstance = new TurntableController(viewerEl, imgEl, obj.rows, options);

                        loader.style.display = 'none';
                        imgEl.style.display = 'block';
                        document.title = (obj.name || "360 Viewer") + " - 360 Viewer";
                    } catch (err) {
                        loader.textContent = "Error loading config: " + err.message;
                        console.error(err);
                    }
                }
            });
        }

        function readFileAsText(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsText(file);
            });
        }

        (async function() {
            const viewerEl = document.getElementById('viewer');
            const imgEl = document.getElementById('product-image');
            const loader = document.querySelector('.loading');
            
            setupDragAndDrop(viewerEl, imgEl, loader);

            try {
                const urlParams = new URLSearchParams(window.location.search);
                const configUrl = urlParams.get('config') || 'config.json';
                
                // Get default settings from export
                let defaultSettings = ${settingsJson};

                // Override with URL params if needed
                if (urlParams.has('autoRotate')) defaultSettings.autoRotate = urlParams.get('autoRotate') === 'true';
                if (urlParams.has('speed')) defaultSettings.autoRotateSpeed = parseInt(urlParams.get('speed'));
                if (urlParams.has('zoom')) defaultSettings.minZoom = parseFloat(urlParams.get('zoom')); // Start at this zoom
                if (urlParams.has('minZoom')) defaultSettings.minZoom = parseFloat(urlParams.get('minZoom'));
                if (urlParams.has('maxZoom')) defaultSettings.maxZoom = parseFloat(urlParams.get('maxZoom'));
                if (urlParams.has('sensX')) defaultSettings.sensitivityX = parseInt(urlParams.get('sensX'));
                if (urlParams.has('sensY')) defaultSettings.sensitivityY = parseInt(urlParams.get('sensY'));
                
                // View State
                if (urlParams.has('row')) defaultSettings.initialRow = parseInt(urlParams.get('row'));
                if (urlParams.has('frame')) defaultSettings.initialFrame = parseInt(urlParams.get('frame'));

                // Try to load default config
                const response = await fetch(configUrl);
                if (!response.ok) {
                    // Only throw if user specifically asked for a config that failed
                    if (urlParams.has('config')) throw new Error("Failed to load config");
                    // Otherwise, just stay in loading state or show "Drop Config Here"
                    loader.textContent = "Drop config.json here";
                    return;
                }
                const config = await response.json();
                const obj = config.objects[0];

                if (obj.backgroundColor) viewerEl.style.backgroundColor = obj.backgroundColor;

                // Merge settings: Export Defaults < Config File Settings < URL Overrides
                const finalSettings = { ...defaultSettings, ...(obj.settings || {}) };

                window.viewerInstance = new TurntableController(viewerEl, imgEl, obj.rows, finalSettings);

                loader.style.display = 'none';
                imgEl.style.display = 'block';
            } catch (e) {
                loader.textContent = "Error: " + e.message;
                console.error(e);
            }
        })();
    <\/script>
</body>
</html>`;
}

function downloadFile(filename, content, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Start Application
initEditor();