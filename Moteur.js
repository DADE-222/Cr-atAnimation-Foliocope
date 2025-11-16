// Moteur.js v5.0 - Logique pour Folioscope (Créé par DEDE)
window.addEventListener('load', () => {

    // --- Références de l'UI ---
    const canvas = document.getElementById('drawingCanvas');
    const ctx = canvas.getContext('2d');
    
    // Projet
    const widthInput = document.getElementById('canvasWidth');
    const heightInput = document.getElementById('canvasHeight');
    const newProjectButton = document.getElementById('newProjectButton');
    
    // AJOUTS POUR SAUVEGARDE
    const saveProjectButton = document.getElementById('saveProjectButton');
    const loadProjectButton = document.getElementById('loadProjectButton');

    // Outils
    const colorPicker = document.getElementById('colorPicker');
    // ... (le reste de vos références UI) ...
    const penSizeSlider = document.getElementById('penSize');
    const penSizeValue = document.getElementById('penSizeValue');
    const penButton = document.getElementById('penButton');
    const eraserButton = document.getElementById('eraserButton');
    const fillButton = document.getElementById('fillButton');
    const penTypeRound = document.getElementById('penTypeRound');
    const penTypeSquare = document.getElementById('penTypeSquare');
    
    // Animation
    const playButton = document.getElementById('playButton');
    const onionSkinCheckbox = document.getElementById('onionSkinCheckbox');
    const fpsSlider = document.getElementById('fpsSlider');
    const fpsValue = document.getElementById('fpsValue');
    const exportButton = document.getElementById('exportButton');
    const exportStatus = document.getElementById('exportStatus');

    const exportVideoButton = document.getElementById('exportVideoButton');
    const exportVideoStatus = document.getElementById('exportVideoStatus');

    // Timeline
    const timelineContainer = document.getElementById('timelineContainer');
    const addFrameButtonTimeline = document.getElementById('addFrameButtonTimeline');

    // Calques
    const layerList = document.getElementById('layerList');
    const addLayerButton = document.getElementById('addLayerButton');
    const dupeLayerButton = document.getElementById('dupeLayerButton');

    // Historique
    const undoButton = document.getElementById('undoButton');
    const redoButton = document.getElementById('redoButton');

    // --- État de l'application ---
    let CANVAS_WIDTH = 800;
    let CANVAS_HEIGHT = 600;
    // ... (le reste de vos variables d'état) ...
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    let currentTool = 'pen';
    let penType = 'round';
    
    let workingLayers = [];
    let activeLayerIndex = -1;
    const MAX_LAYERS = 5;

    let animationFrames = []; 
    let currentFrameIndex = 0;
    
    let history = [];
    let historyIndex = -1;
    const MAX_HISTORY = 40;
    
    let isPlaying = false;
    let playbackTimer = null;
    let playbackIndex = 0;
    
    // Export
    const GIF_LIB_URL = 'gif.js';
    const GIF_WORKER_URL = 'gif.worker.js';
    let isGifLibLoading = false;

    // --- Initialisation ---
    function initialize() {
        setCanvasSize(parseInt(widthInput.value), parseInt(heightInput.value));
        attachEventListeners();
    }

    // --- Logique de Projet/Canvas ---
    function setCanvasSize(w, h) {
        CANVAS_WIDTH = w;
        CANVAS_HEIGHT = h;
        
        canvas.width = CANVAS_WIDTH;
        canvas.height = CANVAS_HEIGHT;
        
        animationFrames = []; 
        currentFrameIndex = 0;
        workingLayers = [];
        activeLayerIndex = -1;
        history = [];
        historyIndex = -1;

        addNewLayer(); 
        saveCurrentWorkToFrame(false); // Sauvegarde (frame 0) sans màj thumbnail
        
        updateLayerList();
        updateTimeline();
        updateHistoryButtons();
        displayFrame(); // Affiche le canvas vide
    }
    
    // --- Logique des Calques ---
    // [CODE DES CALQUES INCHANGÉ ... ]
    // createNewLayer, addNewLayer, duplicateActiveLayer, setActiveLayer, updateLayerList
    function createNewLayer() {
        const newLayerCanvas = document.createElement('canvas');
        newLayerCanvas.width = CANVAS_WIDTH;
        newLayerCanvas.height = CANVAS_HEIGHT;
        return newLayerCanvas;
    }

    function addNewLayer() {
        if (workingLayers.length >= MAX_LAYERS) {
            alert(`Limite de ${MAX_LAYERS} calques atteinte.`);
            return;
        }
        const newLayer = createNewLayer();
        workingLayers.splice(activeLayerIndex + 1, 0, newLayer);
        activeLayerIndex++;
        
        updateLayerList();
        displayFrame(); // Met à jour l'affichage
        saveStateForUndo();
    }
    
    function duplicateActiveLayer() {
        if (activeLayerIndex < 0) return;
        if (workingLayers.length >= MAX_LAYERS) {
            alert(`Limite de ${MAX_LAYERS} calques atteinte.`);
            return;
        }
        const activeLayer = workingLayers[activeLayerIndex];
        const newLayer = createNewLayer();
        newLayer.getContext('2d').drawImage(activeLayer, 0, 0);
        
        workingLayers.splice(activeLayerIndex + 1, 0, newLayer);
        activeLayerIndex++;
        
        updateLayerList();
        displayFrame();
        saveStateForUndo();
    }

    function setActiveLayer(index) {
        if (index < 0 || index >= workingLayers.length) return;
        activeLayerIndex = index;
        updateLayerList();
    }

    function updateLayerList() {
        layerList.innerHTML = '';
        [...workingLayers].reverse().forEach((layer, revIndex) => {
            const index = workingLayers.length - 1 - revIndex;
            const item = document.createElement('li');
            item.classList.add('layer-item');
            item.textContent = `Calque ${index + 1}`;
            if (index === activeLayerIndex) {
                item.classList.add('active');
                item.textContent += ' (ACTIF)';
            }
            item.addEventListener('click', () => setActiveLayer(index));
            layerList.appendChild(item);
        });
    }

    // --- Logique de Dessin ---
    // [CODE DE DESSIN INCHANGÉ ... ]
    // getActiveLayerContext, startDrawing, draw, stopDrawing, setTool, setPenType
    function getActiveLayerContext() {
        if (activeLayerIndex < 0 || activeLayerIndex >= workingLayers.length) {
            return null;
        }
        return workingLayers[activeLayerIndex].getContext('2d');
    }

    function startDrawing(e) {
        const activeCtx = getActiveLayerContext();
        if (!activeCtx || isPlaying) return;
        
        const [x, y] = getMousePos(e);
        if (x === null) return; 
        [lastX, lastY] = [x, y];
        
        if (currentTool === 'fill') {
            isDrawing = false;
            saveStateForUndo(); 
            floodFill(x, y, activeCtx);
            displayFrame();
            saveCurrentWorkToFrame();
            return;
        }

        isDrawing = true;
        saveStateForUndo(); 

        if (currentTool === 'pen') {
            activeCtx.globalCompositeOperation = 'source-over';
            activeCtx.strokeStyle = colorPicker.value;
            activeCtx.lineWidth = penSizeSlider.value;
            activeCtx.lineCap = penType;
        } else if (currentTool === 'eraser') {
            activeCtx.globalCompositeOperation = 'destination-out';
            activeCtx.lineWidth = penSizeSlider.value;
            activeCtx.lineCap = penType;
        }
        
        draw(e, activeCtx);
    }

    function draw(e, customCtx = null) {
        const activeCtx = customCtx || getActiveLayerContext();
        if (!isDrawing || !activeCtx || isPlaying) return;
        
        const [x, y] = getMousePos(e);
        if (x === null) {
            stopDrawing();
            return;
        }

        activeCtx.beginPath();
        activeCtx.moveTo(lastX, lastY);
        activeCtx.lineTo(x, y);
        activeCtx.stroke();
        
        [lastX, lastY] = [x, y];
        displayFrame();
    }

    function stopDrawing() {
        if (!isDrawing) return;
        isDrawing = false;
        getActiveLayerContext()?.beginPath();
        saveCurrentWorkToFrame();
    }
    
    function setTool(tool) {
        currentTool = tool;
        penButton.classList.toggle('active', tool === 'pen');
        eraserButton.classList.toggle('active', tool === 'eraser');
        fillButton.classList.toggle('active', tool === 'fill');
        
        if (tool === 'fill') canvas.style.cursor = 'copy';
        else if (tool === 'eraser') canvas.style.cursor = 'cell';
        else canvas.style.cursor = 'crosshair';
    }
    
    function setPenType(type) {
        penType = type;
        penTypeRound.classList.toggle('active', type === 'round');
        penTypeSquare.classList.toggle('active', type === 'square');
    }

    // --- Logique de l'Animation ---
    // [CODE D'ANIMATION INCHANGÉ ... ]
    // saveCurrentWorkToFrame, loadFrameIntoLayers, displayFrame, addNewFrame, goToFrame, deleteFrame
    function saveCurrentWorkToFrame(updateThumb = true) {
        const mergedCanvas = createNewLayer();
        const mergedCtx = mergedCanvas.getContext('2d');
        
        for (const layerCanvas of workingLayers) {
            mergedCtx.drawImage(layerCanvas, 0, 0);
        }
        
        const img = new Image();
        img.src = mergedCanvas.toDataURL();
        
        if (currentFrameIndex >= animationFrames.length) {
            animationFrames.push(img);
        } else {
            animationFrames[currentFrameIndex] = img;
        }
        
        if (updateThumb) {
            img.onload = () => updateTimeline();
        }
    }
    
    function loadFrameIntoLayers(index) {
        workingLayers = [];
        const baseLayer = createNewLayer();
        
        if (index < animationFrames.length && animationFrames[index]) {
            baseLayer.getContext('2d').drawImage(animationFrames[index], 0, 0);
        }
        
        workingLayers.push(baseLayer);
        activeLayerIndex = 0;
        
        history = [];
        historyIndex = -1;
        saveStateForUndo(); 
        updateLayerList();
    }

    function displayFrame() {
        if (isPlaying) return;
        
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        const showOnion = onionSkinCheckbox.checked;
        const hasPrevFrame = currentFrameIndex > 0 && animationFrames[currentFrameIndex - 1];

        if (showOnion && hasPrevFrame) {
            ctx.globalAlpha = 0.3;
            ctx.drawImage(animationFrames[currentFrameIndex - 1], 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            ctx.globalAlpha = 1.0;
        }
        
        for (const layerCanvas of workingLayers) {
            ctx.drawImage(layerCanvas, 0, 0);
        }
    }

    function addNewFrame() {
        saveCurrentWorkToFrame();
        currentFrameIndex++;
        animationFrames.splice(currentFrameIndex, 0, null);
        
        loadFrameIntoLayers(currentFrameIndex); 
        displayFrame();
        updateTimeline();
    }

    function goToFrame(index) {
        if (index === currentFrameIndex) return;
        
        saveCurrentWorkToFrame();
        currentFrameIndex = index;
        loadFrameIntoLayers(index); 
        
        displayFrame();
        updateTimeline();
    }
    
    function deleteFrame(index) {
        if (animationFrames.length <= 1) {
            alert("Vous ne pouvez pas supprimer la dernière frame !");
            return;
        }
        if (!confirm(`Supprimer la frame ${index + 1} ?`)) return;
        
        animationFrames.splice(index, 1);
        
        if (currentFrameIndex > index) {
            currentFrameIndex--;
        } else if (currentFrameIndex === index) {
            currentFrameIndex = Math.max(0, currentFrameIndex - 1);
        }
        
        loadFrameIntoLayers(currentFrameIndex);
        displayFrame();
        updateTimeline();
    }

    // --- Logique de Lecture (Playback) ---
    // [CODE DE LECTURE INCHANGÉ ... ]
    // togglePlayback, startPlayback, stopPlayback, playNextFrame, setUIEnabled
    function togglePlayback() {
        if (isPlaying) {
            stopPlayback();
        } else {
            startPlayback();
        }
    }

    function startPlayback() {
        isPlaying = true;
        playButton.textContent = "⏹️ Stop";
        playButton.classList.add('playing');
        setUIEnabled(false);
        
        saveCurrentWorkToFrame();
        playbackIndex = 0;
        playNextFrame();
    }

    function stopPlayback() {
        isPlaying = false;
        playButton.textContent = "▶️ Play";
        playButton.classList.remove('playing');
        setUIEnabled(true);
        
        if (playbackTimer) {
            clearTimeout(playbackTimer);
            playbackTimer = null;
        }
        
        loadFrameIntoLayers(currentFrameIndex);
        displayFrame();
    }
    
    function playNextFrame() {
        if (!isPlaying) return;

        if (playbackIndex >= animationFrames.length) {
            playbackIndex = 0; 
        }
        
        const frameToDraw = animationFrames[playbackIndex];
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        if (frameToDraw) {
            ctx.drawImage(frameToDraw, 0, 0);
        }
        
        playbackIndex++;
        
        const delay = 1000 / parseFloat(fpsSlider.value);
        playbackTimer = setTimeout(playNextFrame, delay);
    }

    function setUIEnabled(isEnabled) {
        const UIElements = [
            widthInput, heightInput, newProjectButton, undoButton, redoButton,
            saveProjectButton, loadProjectButton, // Ajoutés au verrouillage
            onionSkinCheckbox, fpsSlider, exportButton, 
            exportVideoButton, penButton, eraserButton,
            fillButton, colorPicker, penSizeSlider, penTypeRound, penTypeSquare,
            addLayerButton, dupeLayerButton, addFrameButtonTimeline,
            layerList, timelineContainer
        ];
        
        for (const el of UIElements) {
            el.disabled = !isEnabled;
        }
        
        document.getElementById('left-panel').style.opacity = isEnabled ? 1 : 0.5;
        document.getElementById('right-panel').style.opacity = isEnabled ? 1 : 0.5;
        document.getElementById('timelineContainer').style.opacity = isEnabled ? 1 : 0.5;
        canvas.style.cursor = isEnabled ? (currentTool === 'pen' ? 'crosshair' : (currentTool === 'eraser' ? 'cell' : 'copy')) : 'not-allowed';
    }


    // --- Logique de la Timeline ---
    // [CODE DE TIMELINE INCHANGÉ ... ]
    // updateTimeline
    function updateTimeline() {
        timelineContainer.querySelectorAll('.timeline-frame').forEach(thumb => thumb.remove());
        
        const thumbHeight = 75;
        const thumbWidth = (thumbHeight / CANVAS_HEIGHT) * CANVAS_WIDTH;

        animationFrames.forEach((frameImg, index) => {
            const frameWrapper = document.createElement('div');
            frameWrapper.classList.add('timeline-frame');
            if (index === currentFrameIndex) {
                frameWrapper.classList.add('active');
            }
            
            const thumbCanvas = document.createElement('canvas');
            thumbCanvas.width = thumbWidth;
            thumbCanvas.height = thumbHeight;
            const thumbCtx = thumbCanvas.getContext('2d');
            
            if (frameImg) {
                thumbCtx.drawImage(frameImg, 0, 0, thumbWidth, thumbHeight);
            } else {
                thumbCtx.fillStyle = 'var(--bg-med)'; // Utilise la variable CSS
                thumbCtx.fillRect(0, 0, thumbWidth, thumbHeight);
            }
            
            const frameLabel = document.createElement('span');
            frameLabel.textContent = `Frame ${index + 1}`;
            
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'X';
            deleteBtn.classList.add('delete-frame-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteFrame(index);
            });

            frameWrapper.addEventListener('click', () => goToFrame(index));
            frameWrapper.appendChild(thumbCanvas);
            frameWrapper.appendChild(frameLabel);
            frameWrapper.appendChild(deleteBtn);
            timelineContainer.insertBefore(frameWrapper, addFrameButtonTimeline);
        });
        
        addFrameButtonTimeline.style.height = `${thumbHeight + 28}px`;
        addFrameButtonTimeline.style.width = `${thumbWidth}px`;
    }
    
    // --- Logique d'Historique ---
    // [CODE D'HISTORIQUE INCHANGÉ ... ]
    // saveStateForUndo, restoreState, undo, redo, updateHistoryButtons
    function saveStateForUndo() {
        if (historyIndex < history.length - 1) {
            history = history.slice(0, historyIndex + 1);
        }
        if (history.length >= MAX_HISTORY) {
            history.shift();
        }
        const state = {
            layers: workingLayers.map(canvas => canvas.getContext('2d').getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)),
            activeLayerIndex: activeLayerIndex
        };
        history.push(state);
        historyIndex = history.length - 1;
        updateHistoryButtons();
    }

    function restoreState(state) {
        if (!state) return;
        workingLayers = state.layers.map(imgData => {
            const newCanvas = createNewLayer();
            newCanvas.getContext('2d').putImageData(imgData, 0, 0);
            return newCanvas;
        });
        activeLayerIndex = state.activeLayerIndex;
        updateLayerList();
        displayFrame();
        updateHistoryButtons();
    }

    function undo() {
        if (historyIndex > 0) {
            historyIndex--;
            restoreState(history[historyIndex]);
            saveCurrentWorkToFrame();
        }
    }

    function redo() {
        if (historyIndex < history.length - 1) {
            historyIndex++;
            restoreState(history[historyIndex]);
            saveCurrentWorkToFrame();
        }
    }
    
    function updateHistoryButtons() {
        undoButton.disabled = historyIndex <= 0;
        redoButton.disabled = historyIndex >= history.length - 1;
    }

    // --- Outil Pot de Peinture ---
    // [CODE DU POT DE PEINTURE INCHANGÉ ... ]
    // floodFill
    function floodFill(startX, startY, ctx) {
        const imgData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        const data = imgData.data;
        const stack = [[startX, startY]];
        
        const getPixel = (x, y) => {
            const i = (y * CANVAS_WIDTH + x) * 4;
            return [data[i], data[i+1], data[i+2], data[i+3]];
        };
        const setPixel = (x, y, color) => {
            const i = (y * CANVAS_WIDTH + x) * 4;
            data[i] = color[0]; data[i+1] = color[1]; data[i+2] = color[2]; data[i+3] = color[3];
        };
        const hexToRgba = (hex) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return [r, g, b, 255];
        };

        const targetColor = getPixel(startX, startY);
        const fillColor = hexToRgba(colorPicker.value);
        
        if (targetColor.every((val, i) => val === fillColor[i])) return;

        const visited = new Set();
        const tolerance = 10;
        
        while (stack.length > 0) {
            const [x, y] = stack.pop();
            if (x < 0 || x >= CANVAS_WIDTH || y < 0 || y >= CANVAS_HEIGHT) continue;
            
            const posKey = `${x},${y}`;
            if (visited.has(posKey)) continue;
            visited.add(posKey);
            
            const currentColor = getPixel(x, y);
            const isMatch = Math.abs(currentColor[0] - targetColor[0]) <= tolerance &&
                            Math.abs(currentColor[1] - targetColor[1]) <= tolerance &&
                            Math.abs(currentColor[2] - targetColor[2]) <= tolerance &&
                            Math.abs(currentColor[3] - targetColor[3]) <= tolerance;

            if (isMatch) {
                setPixel(x, y, fillColor);
                stack.push([x + 1, y]); stack.push([x - 1, y]);
                stack.push([x, y + 1]); stack.push([x, y - 1]);
            }
        }
        ctx.putImageData(imgData, 0, 0);
    }
    
    // --- Logique d'Exportation (GIF) ---
    // [CODE D'EXPORT GIF INCHANGÉ ... ]
    // exportAnimation, loadScript, startGifExport
    function exportAnimation() { 
        exportStatus.textContent = "Vérification...";
        if (typeof GIF !== 'undefined') {
            startGifExport();
        } else if (!isGifLibLoading) {
            isGifLibLoading = true;
            exportStatus.textContent = "Chargement...";
            loadScript(GIF_LIB_URL, () => { 
                isGifLibLoading = false;
                if (typeof GIF === 'undefined') { 
                    exportStatus.textContent = "Erreur! (gif.js absent?)"; 
                    return; 
                }
                startGifExport();
            });
        }
    }
    
    function loadScript(url, callback) {
        const script = document.createElement('script');
        script.type = 'text/javascript'; 
        script.src = url; 
        script.onload = callback;
        script.onerror = () => { 
            isGifLibLoading = false; 
            exportStatus.textContent = "Erreur! Fichier introuvable."; 
        }
        document.head.appendChild(script);
    }
    
    function startGifExport() {
        saveCurrentWorkToFrame(); 
        exportStatus.textContent = "Compilation...";
        const gif = new GIF({
            workers: 2, quality: 10,
            width: CANVAS_WIDTH, height: CANVAS_HEIGHT,
            workerScript: GIF_WORKER_URL
        });
        const delay = 1000 / parseFloat(fpsSlider.value);
        const blankCanvas = createNewLayer();
        
        for (const frameImg of animationFrames) {
            gif.addFrame(frameImg || blankCanvas, { delay: delay, copy: !frameImg });
        }
        
        gif.on('finished', (blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `animation_dede_${Date.now()}.gif`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            exportStatus.textContent = "Exporté !";
            setTimeout(() => exportStatus.textContent = "", 3000);
        });
        gif.render();
    }
    
    // --- Logique d'Export Vidéo (WebM) ---
    // [CODE D'EXPORT VIDÉO INCHANGÉ ... ]
    // exportVideo, renderVideoFrame
    let mediaRecorder;
    let videoChunks = [];
    let videoRenderIndex = 0;
    let videoRenderFPS = 12;

    function exportVideo() {
        if (typeof MediaRecorder === 'undefined') {
            alert("Votre navigateur ne supporte pas l'export vidéo (MediaRecorder).");
            return;
        }
        saveCurrentWorkToFrame();
        exportVideoStatus.textContent = "Préparation...";
        videoRenderFPS = parseFloat(fpsSlider.value);
        const delay = 1000 / videoRenderFPS;
        const stream = canvas.captureStream(videoRenderFPS); 
        const options = [
            { mimeType: 'video/webm; codecs=vp9' },
            { mimeType: 'video/webm' }
        ].find(o => MediaRecorder.isTypeSupported(o.mimeType));

        if (!options) {
             exportVideoStatus.textContent = "Erreur : aucun format WebM supporté.";
             return;
        }
        mediaRecorder = new MediaRecorder(stream, options);
        videoChunks = []; 
        videoRenderIndex = 0; 

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                videoChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            exportVideoStatus.textContent = "Compilation...";
            const blob = new Blob(videoChunks, { type: options.mimeType });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `animation_folioscope_${Date.now()}.webm`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            exportVideoStatus.textContent = "Exporté !";
            setTimeout(() => exportVideoStatus.textContent = "", 3000);
            
            displayFrame();
        };

        mediaRecorder.start();
        exportVideoStatus.textContent = "Rendu... 0%";
        renderVideoFrame(delay);
    }
    
    function renderVideoFrame(delay) {
        if (!mediaRecorder) return; 
        
        if (videoRenderIndex >= animationFrames.length) {
            mediaRecorder.stop();
            return;
        }

        const frameToDraw = animationFrames[videoRenderIndex];
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        if (frameToDraw) {
            ctx.drawImage(frameToDraw, 0, 0);
        }
        
        const progress = Math.round((videoRenderIndex / animationFrames.length) * 100);
        exportVideoStatus.textContent = `Rendu... ${progress}%`;
        
        videoRenderIndex++;
        
        setTimeout(() => renderVideoFrame(delay), delay);
    }
    
    // --- NOUVELLE LOGIQUE DE SAUVEGARDE PROJET ---
    
    function saveProject() {
        // 1. S'assurer que la frame actuelle est bien sauvegardée
        saveCurrentWorkToFrame(); 
        
        // 2. Préparer l'objet de sauvegarde
        // On convertit les images en dataURL (texte base64) pour qu'elles soient "JSON-ifiables"
        const saveData = {
            version: "folioscope-v1",
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            fps: parseFloat(fpsSlider.value),
            frames: animationFrames.map(img => img ? img.src : null) // img.src est un dataURL
        };
        
        // 3. Créer le fichier
        const jsonString = JSON.stringify(saveData);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        
        // 4. Créer le lien de téléchargement
        const a = document.createElement('a');
        a.href = url;
        // C'est ici qu'on définit votre extension !
        a.download = `projet_folioscope.folioCopeAnimation`; 
        document.body.appendChild(a);
        a.click();
        
        // 5. Nettoyer
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    function loadProject() {
        // Demander confirmation car ça écrase tout
        if (!confirm("Ouvrir un nouveau projet écrasera votre travail actuel. Continuer ?")) {
            return;
        }
        
        // Créer un input de type "file" invisible
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = ".folioCopeAnimation,.json"; // Accepter votre extension
        
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            // Lire le fichier texte
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    
                    // Vérifier que c'est un bon fichier
                    if (data.version !== "folioscope-v1") {
                        throw new Error("Ce n'est pas un fichier Folioscope valide.");
                    }
                    
                    // Appliquer les réglages
                    widthInput.value = data.width;
                    heightInput.value = data.height;
                    fpsSlider.value = data.fps;
                    fpsValue.textContent = data.fps;
                    
                    // Réinitialiser le canvas avec la nouvelle taille (cela vide le projet)
                    setCanvasSize(data.width, data.height);
                    
                    // Le chargement des images est asynchrone
                    // Nous devons attendre que TOUTES les images soient chargées
                    
                    const framePromises = data.frames.map(dataUrl => {
                        return new Promise((resolve, reject) => {
                            if (!dataUrl) {
                                resolve(null); // Gérer les frames vides
                                return;
                            }
                            const img = new Image();
                            img.onload = () => resolve(img);
                            img.onerror = () => reject(new Error("Erreur chargement frame"));
                            img.src = dataUrl;
                        });
                    });
                    
                    // Quand toutes les promesses sont résolues...
                    Promise.all(framePromises).then(loadedFrames => {
                        animationFrames = loadedFrames; // Remplacer le tableau de frames
                        currentFrameIndex = 0;
                        loadFrameIntoLayers(0); // Charger la première frame dans les calques
                        displayFrame();
                        updateTimeline();
                        alert("Projet chargé avec succès !");
                    }).catch(err => {
                        alert("Erreur lors du chargement des images du projet: " + err.message);
                        // En cas d'échec, réinitialiser à un projet vide
                        setCanvasSize(800, 600); 
                    });

                } catch (err) {
                    alert("Erreur: Le fichier est corrompu ou illisible. " + err.message);
                }
            };
            reader.readAsText(file); // Lire le fichier comme du texte
        };
        
        // Cliquer sur l'input invisible pour ouvrir la boîte de dialogue
        fileInput.click();
    }
    
    
    // --- Fonctions Utilitaires ---
    // [CODE UTILITAIRE INCHANGÉ ... ]
    // getMousePos
    function getMousePos(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        if (x < 0 || x > CANVAS_WIDTH || y < 0 || y > CANVAS_HEIGHT) {
            return [null, null];
        }
        return [Math.floor(x), Math.floor(y)];
    }

    // --- Connexion des Événements ---
    function attachEventListeners() {
        newProjectButton.addEventListener('click', () => {
            if (confirm("Changer la taille créera un nouveau projet. Continuer ?")) {
                setCanvasSize(parseInt(widthInput.value), parseInt(heightInput.value));
            }
        });
        
        // AJOUT DES NOUVEAUX ÉVÉNEMENTS
        saveProjectButton.addEventListener('click', saveProject);
        loadProjectButton.addEventListener('click', loadProject);
        
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseout', stopDrawing);
        
        // ... (reste des événements) ...
        penButton.addEventListener('click', () => setTool('pen'));
        eraserButton.addEventListener('click', () => setTool('eraser'));
        fillButton.addEventListener('click', () => setTool('fill'));
        penSizeSlider.addEventListener('input', (e) => penSizeValue.textContent = e.target.value);
        penTypeRound.addEventListener('click', () => setPenType('round'));
        penTypeSquare.addEventListener('click', () => setPenType('square'));
        
        playButton.addEventListener('click', togglePlayback);
        onionSkinCheckbox.addEventListener('change', displayFrame);
        fpsSlider.addEventListener('input', (e) => fpsValue.textContent = e.target.value);
        
        // Export
        exportButton.addEventListener('click', exportAnimation);
        exportVideoButton.addEventListener('click', exportVideo);
        
        // Timeline & Calques
        addFrameButtonTimeline.addEventListener('click', addNewFrame);
        addLayerButton.addEventListener('click', addNewLayer);
        dupeLayerButton.addEventListener('click', duplicateActiveLayer);
        
        // Historique
        undoButton.addEventListener('click', undo);
        redoButton.addEventListener('click', redo);
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z') { e.preventDefault(); undo(); }
                else if (e.key === 'y') { e.preventDefault(); redo(); }
            }
        });
    }

    // Démarrage
    initialize();
});