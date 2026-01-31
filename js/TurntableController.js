/**
 * Controller for the 360° Viewer interaction.
 * Encapsulates all logic for drag-to-rotate, zoom, elevation switching, and auto-rotation.
 */
class TurntableController {
    constructor(container, imgElement, rows, options = {}) {
        this.container = container;
        this.imgElement = imgElement;
        this.rows = rows;
        
        // Configuration
        this.options = {
            sensitivityX: 25, // Pixels to drag for one frame (Lower = Faster)
            sensitivityY: 50, // Pixels to drag for one row change
            minZoom: 1,
            maxZoom: 3,
            zoomSpeed: 0.1,
            autoRotate: false,
            autoRotateSpeed: 100, // ms per frame
            autoRotateDelay: 2000, // Wait time before starting
            initialRow: 0,
            initialFrame: 0,
            onUpdate: null,   // Callback: ({rowId, rowIndex, frameIndex}) => void
            ...options
        };

        // Internal State
        this.state = {
            currentRowIdx: this.options.initialRow || 0,
            currentFrameIdx: this.options.initialFrame || 0,
            isDragging: false,
            startX: 0,
            startY: 0,
            zoom: 1,
            lastInteractionTime: Date.now(),
            isAutoRotating: false,
            rafId: null
        };

        // Event Bindings
        this.binds = {
            start: this.onDragStart.bind(this),
            move: this.onDragMove.bind(this),
            end: this.onDragEnd.bind(this),
            wheel: this.onWheel.bind(this)
        };

        this.init();
    }

    init() {
        // Mouse
        this.container.addEventListener('mousedown', this.binds.start);
        window.addEventListener('mousemove', this.binds.move);
        window.addEventListener('mouseup', this.binds.end);
        this.container.addEventListener('wheel', this.binds.wheel, { passive: false });

        // Touch
        this.container.addEventListener('touchstart', (e) => { 
            e.preventDefault(); 
            this.binds.start(e.touches[0]); 
        }, { passive: false });
        
        window.addEventListener('touchmove', (e) => { 
            if(this.state.isDragging) e.preventDefault(); 
            this.binds.move(e.touches[0]); 
        }, { passive: false });
        
        window.addEventListener('touchend', this.binds.end);

        // Auto Rotation Loop
        this.startAutoRotateLoop();

        // Initial Render
        this.updateImage();
        this.applyTransform();
    }

    destroy() {
        if (this.state.rafId) cancelAnimationFrame(this.state.rafId);
        // Remove listeners if needed (not strictly necessary for this use case as we reload)
    }

    startAutoRotateLoop() {
        let lastFrameTime = 0;

        const loop = (timestamp) => {
            if (!this.options.autoRotate) {
                this.state.rafId = requestAnimationFrame(loop);
                return;
            }

            const now = Date.now();
            const timeSinceInteraction = now - this.state.lastInteractionTime;

            if (timeSinceInteraction > this.options.autoRotateDelay && !this.state.isDragging) {
                if (timestamp - lastFrameTime > this.options.autoRotateSpeed) {
                    this.nextFrame();
                    lastFrameTime = timestamp;
                }
            }

            this.state.rafId = requestAnimationFrame(loop);
        };
        this.state.rafId = requestAnimationFrame(loop);
    }

    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
        this.applyTransform(); // Apply new zoom limits potentially
    }

    /**
     * Updates the data source (used by Editor when state changes).
     */
    updateRows(newRows) {
        this.rows = newRows;
        this.validateState();
        this.updateImage();
    }

    /**
     * Ensures indices are within valid bounds.
     */
    validateState() {
        if (!this.rows || this.rows.length === 0) return;

        if (this.state.currentRowIdx >= this.rows.length) {
            this.state.currentRowIdx = 0;
            this.resetZoom();
        }
        
        const row = this.rows[this.state.currentRowIdx];
        if (row && this.state.currentFrameIdx >= row.images.length) {
            this.state.currentFrameIdx = 0;
        }
    }

    resetZoom() {
        this.state.zoom = this.options.minZoom; // Reset to min
        this.applyTransform();
    }

    applyTransform() {
        // Clamp zoom to new limits
        this.state.zoom = Math.min(Math.max(this.state.zoom, this.options.minZoom), this.options.maxZoom);
        this.imgElement.style.transform = `scale(${this.state.zoom})`;
        this.imgElement.style.transformOrigin = 'center center'; 
    }

    updateImage() {
        if (!this.rows || this.rows.length === 0) return;
        
        const row = this.rows[this.state.currentRowIdx];
        if (!row || row.images.length === 0) return;

        // Safety check
        if (this.state.currentFrameIdx >= row.images.length) {
            this.state.currentFrameIdx = 0;
        }

        const src = row.images[this.state.currentFrameIdx];
        if (src) this.imgElement.src = src;

        if (this.options.onUpdate) {
            this.options.onUpdate({
                rowId: row.id, 
                rowIndex: this.state.currentRowIdx,
                frameIndex: this.state.currentFrameIdx
            });
        }
    }

    nextFrame() {
         if (!this.rows || this.rows.length === 0) return;
         const row = this.rows[this.state.currentRowIdx];
         const totalFrames = row.images.length;
         this.state.currentFrameIdx = (this.state.currentFrameIdx + 1) % totalFrames;
         this.updateImage();
    }

    // --- Interactions ---

    recordInteraction() {
        this.state.lastInteractionTime = Date.now();
    }

    onWheel(e) {
        e.preventDefault();
        this.recordInteraction();
        const delta = Math.sign(e.deltaY) * -1; // Up is positive zoom
        const newZoom = this.state.zoom + (delta * this.options.zoomSpeed);
        this.state.zoom = newZoom; // Clamping happens in applyTransform
        this.applyTransform();
    }

    onDragStart(e) {
        if (!this.rows || this.rows.length === 0) return;
        this.recordInteraction();
        this.state.isDragging = true;
        this.state.startX = e.clientX;
        this.state.startY = e.clientY;
        this.container.style.cursor = 'grabbing';
    }

    onDragMove(e) {
        if (!this.state.isDragging) return;
        this.recordInteraction();

        const deltaX = e.clientX - this.state.startX;
        const deltaY = e.clientY - this.state.startY;

        // Horizontal: Rotation
        if (Math.abs(deltaX) > this.options.sensitivityX) {
            const row = this.rows[this.state.currentRowIdx];
            const totalFrames = row.images.length;
            
            // Drag Left -> Rotate Right (Next Frame)
            const step = -Math.floor(deltaX / this.options.sensitivityX);
            
            if (step !== 0) {
                let next = (this.state.currentFrameIdx + step) % totalFrames;
                if (next < 0) next += totalFrames;
                
                this.state.currentFrameIdx = next;
                this.state.startX = e.clientX; // Reset anchor to prevent acceleration
                this.updateImage();
            }
        }

        // Vertical: Elevation
        if (Math.abs(deltaY) > this.options.sensitivityY) {
            let changed = false;
            // Drag Down -> Previous Row (Lower Elevation index)
            if (deltaY > 0 && this.state.currentRowIdx > 0) {
                this.state.currentRowIdx--;
                changed = true;
            } 
            // Drag Up -> Next Row (Higher Elevation index)
            else if (deltaY < 0 && this.state.currentRowIdx < this.rows.length - 1) {
                this.state.currentRowIdx++;
                changed = true;
            }

            if (changed) {
                this.state.startY = e.clientY;
                this.resetZoom();
                this.updateImage();
            }
        }
    }

    onDragEnd() {
        this.recordInteraction();
        this.state.isDragging = false;
        this.container.style.cursor = 'grab';
    }
}
