// Material_ID_Isolator.jsx
// Extracts complex CG geometry using specific RGB channels from a Material ID pass, with interactive Levels refinement.

#target photoshop

app.preferences.rulerUnits = Units.PIXELS;

function main() {
    if (app.documents.length === 0) {
        alert("Please open a document.");
        return;
    }

    var doc = app.activeDocument;
    var beautyLayer = doc.activeLayer;

    // 1. Find Material ID Layer
    var idLayer = findMaterialIdLayer(doc);
    if (!idLayer) {
        alert("Could not find the Material ID layer.\nPlease name your ID layer 'Material ID' or similar.");
        return;
    }

    if (beautyLayer === idLayer) {
        alert("Please select the Beauty layer (the layer you want to extract from), not the ID layer.");
        return;
    }

    // Ensure we are in RGB
    if (doc.mode !== DocumentMode.RGB) {
        alert("This script requires an RGB document.");
        return;
    }

    // 2. Ask user for Channel and Invert preference
    var userChoice = askForChannelDialog();
    if (userChoice.cancel) {
        return; // User aborted
    }

    // 3. Save current selection (Spatial Isolation via Lasso)
    var hasSelection = false;
    var savedSelectionChannel = null;
    try {
        var sel = doc.selection.bounds; // will throw error if no selection
        hasSelection = true;
        savedSelectionChannel = doc.channels.add();
        savedSelectionChannel.name = "Temp_Spatial_Isolation";
        doc.selection.store(savedSelectionChannel, SelectionType.REPLACE);
    } catch(e) {
        hasSelection = false;
    }

    // Execute the core logic
    executeExtraction(doc, beautyLayer, idLayer, userChoice, hasSelection, savedSelectionChannel);
}

function executeExtraction(doc, beautyLayer, idLayer, userChoice, hasSelection, savedSelectionChannel) {
    var tempAlpha = null;
    var tempIdLayer = null;

    try {
        if (userChoice.channelIndex === -1) {
            // GRAYSCALE LOGIC: The most infallible method across all PS versions and bit-depths.
            doc.activeLayer = idLayer;
            
            // 1. Isolate the layer in a temporary document
            var tempDoc = doc.duplicate("Temp_Grayscale_Doc", true);
            app.activeDocument = tempDoc;
            
            // 2. Safely convert to Grayscale (handles Smart Objects, 32-bit, etc natively)
            tempDoc.changeMode(ChangeMode.GRAYSCALE);
            
            // 3. Copy the raw grayscale pixel data to the clipboard
            tempDoc.selection.selectAll();
            tempDoc.selection.copy();
            tempDoc.close(SaveOptions.DONOTSAVECHANGES);
            
            // 4. Return to main document and create the new Alpha channel
            app.activeDocument = doc;
            tempAlpha = doc.channels.add();
            tempAlpha.name = "Temp_CG_Alpha";
            doc.activeChannels = [tempAlpha];
            
            // 5. Paste the grayscale data explicitly into the channel using ActionManager
            var idpast = charIDToTypeID("past");
            var desc = new ActionDescriptor();
            desc.putBoolean(charIDToTypeID("inPl"), true); // Paste in place
            executeAction(idpast, desc, DialogModes.NO);
            
            doc.selection.deselect();
            
        } else {
            // 4. Safely extract the chosen single channel
            doc.activeLayer = idLayer;
            tempIdLayer = idLayer.duplicate();
            tempIdLayer.move(doc.layers[0], ElementPlacement.PLACEBEFORE);
            tempIdLayer.visible = true;

            tempAlpha = doc.channels[userChoice.channelIndex].duplicate();
            tempAlpha.name = "Temp_CG_Alpha";

            tempIdLayer.remove();
            tempIdLayer = null;
        }

        // Make the new alpha channel active
        doc.activeChannels = [tempAlpha];

        // 5. Invert if requested
        if (userChoice.invert) {
            var idInvr = charIDToTypeID( "Invr" );
            executeAction( idInvr, undefined, DialogModes.NO );
        }

        // 6. Apply Spatial Isolation (Mask out everything outside the user's Lasso)
        if (hasSelection && savedSelectionChannel) {
            doc.selection.load(savedSelectionChannel, SelectionType.REPLACE);
            doc.selection.invert(); // Select the OUTSIDE of the lasso
            
            var black = new SolidColor();
            black.rgb.red = 0; black.rgb.green = 0; black.rgb.blue = 0;
            doc.selection.fill(black);
            
            doc.selection.deselect(); // Clear marching ants for a clean Levels preview
        }

        // 7. Interactive Mask Refinement (Levels Dialog)
        try {
            executeAction( charIDToTypeID( "Lvls" ), undefined, DialogModes.ALL );
        } catch (levelsErr) {
            throw new Error("UserCancelled");
        }

        // 8. Load the perfectly refined mask as a selection
        doc.selection.load(tempAlpha, SelectionType.REPLACE);

        // Restore standard RGB view
        doc.activeChannels = doc.componentChannels;
        
        // 9. Copy to New Layer (CTRL + J) from Beauty Layer
        doc.activeLayer = beautyLayer;
        layerViaCopy();

        // Cleanup
        cleanup(doc, tempAlpha, hasSelection, savedSelectionChannel);

    } catch(e) {
        if (e.message !== "UserCancelled") {
            alert("An error occurred during extraction: " + e.message);
        }
        if (tempIdLayer) { try { tempIdLayer.remove(); } catch(err){} }
        cleanup(doc, tempAlpha, hasSelection, savedSelectionChannel);
    }
}

function cleanup(doc, tempAlpha, hasSelection, savedSelectionChannel) {
    try { doc.activeChannels = doc.componentChannels; } catch(e){}
    
    if (tempAlpha) {
        try { tempAlpha.remove(); } catch(e) {}
    }
    
    if (hasSelection && savedSelectionChannel) {
        try { savedSelectionChannel.remove(); } catch(e) {}
    }
}

function askForChannelDialog() {
    var win = new Window("dialog", "Material ID Isolator");
    win.alignChildren = "fill";
    
    win.add("statictext", undefined, "Select the channel with the best contrast for your object:");
    
    var panel = win.add("panel", undefined, "Base Channel");
    panel.alignChildren = "left";
    panel.margins = 15;
    
    var btnGray = panel.add("radiobutton", undefined, "Grayscale (Combines ALL channels to prevent missing gaps)");
    var btnR = panel.add("radiobutton", undefined, "Red Channel");
    var btnG = panel.add("radiobutton", undefined, "Green Channel");
    var btnB = panel.add("radiobutton", undefined, "Blue Channel");
    
    // Grayscale is mathematically safest for highly compressed thin CG geometry
    btnGray.value = true; 
    
    var cbInvert = win.add("checkbox", undefined, "Invert Mask (Check this if your object is DARKER than the background)");
    cbInvert.margins = [0, 10, 0, 10];

    var btnGroup = win.add("group");
    btnGroup.alignment = "center";
    var btnOk = btnGroup.add("button", undefined, "OK");
    var btnCancel = btnGroup.add("button", undefined, "Cancel");
    
    var result = { channelIndex: -1, invert: false, cancel: true };
    
    btnOk.onClick = function() {
        if (btnGray.value) result.channelIndex = -1;
        if (btnR.value) result.channelIndex = 0;
        if (btnG.value) result.channelIndex = 1;
        if (btnB.value) result.channelIndex = 2;
        result.invert = cbInvert.value;
        result.cancel = false;
        win.close();
    }
    
    btnCancel.onClick = function() {
        win.close();
    }
    
    win.show();
    return result;
}

function layerViaCopy() {
    try {
        var idCpTL = charIDToTypeID( "CpTL" );
        executeAction( idCpTL, undefined, DialogModes.NO );
    } catch (e) {
        alert("Could not copy to new layer. Ensure your selection is not empty after Levels adjustment.");
    }
}

function findMaterialIdLayer(doc) {
    var searchNames = ["material id", "materialid", "mat id", "matid", "id", "material_id", "object id"];
    return searchLayers(doc.layers, searchNames);
}

function searchLayers(layers, searchNames) {
    for (var i = 0; i < layers.length; i++) {
        var layerName = layers[i].name.toLowerCase();
        for (var j = 0; j < searchNames.length; j++) {
            if (layerName.indexOf(searchNames[j]) !== -1) {
                return layers[i];
            }
        }
        if (layers[i].typename === "LayerSet") {
            var found = searchLayers(layers[i].layers, searchNames);
            if (found) return found;
        }
    }
    return null;
}

main();
