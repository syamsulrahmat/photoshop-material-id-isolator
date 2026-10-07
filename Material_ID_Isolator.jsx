// CG_Smart_Mask.jsx
// A tool to perfectly isolate complex CG geometry using a Material ID pass, with interactive Levels refinement.

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

    // 2. Get Target Color from Foreground Color
    var targetColor = app.foregroundColor;

    // Ensure we are in RGB
    if (doc.mode !== DocumentMode.RGB) {
        alert("This script requires an RGB document.");
        return;
    }

    // 3. Save current selection (Spatial Isolation)
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

    // We do NOT use suspendHistory here because stopping the script midway (e.g. hitting Cancel on a dialog)
    // inside a suspendHistory block can sometimes cause unexpected behavior in older Photoshop versions.
    // We will handle cleanup manually.
    executeExtraction(doc, beautyLayer, idLayer, targetColor, hasSelection, savedSelectionChannel);
}

function executeExtraction(doc, beautyLayer, idLayer, targetColor, hasSelection, savedSelectionChannel) {
    try {
        // Switch to ID layer
        doc.activeLayer = idLayer;
        var wasVisible = idLayer.visible;
        idLayer.visible = true; // Ensure it's visible for Color Range

        // Restore selection if we had one
        if (hasSelection && savedSelectionChannel) {
            doc.selection.load(savedSelectionChannel, SelectionType.REPLACE);
        } else {
            doc.selection.deselect();
        }

        // 4. Run Color Range
        // Fuzziness around 45 is ideal for catching CG anti-aliasing gradients
        selectColorRange(targetColor, 45); 

        // Check if selection is valid
        try {
            var bnds = doc.selection.bounds;
        } catch(e) {
            alert("The sampled color was not found in the ID layer (or inside your lasso area).");
            cleanup(doc, idLayer, wasVisible, hasSelection, savedSelectionChannel);
            return;
        }

        // 5. Interactive Mask Refinement (Levels Dialog)
        // This gives the artist the manual control they want to solidify the edges
        refineActiveSelectionWithDialog(doc);

        // 6. Copy to New Layer (CTRL + J) from Beauty Layer
        doc.activeLayer = beautyLayer;
        layerViaCopy();

        // Cleanup
        cleanup(doc, idLayer, wasVisible, hasSelection, savedSelectionChannel);
    } catch(e) {
        if (e.message !== "UserCancelled") {
            alert("An error occurred during extraction: " + e.message);
        }
        cleanup(doc, idLayer, true, hasSelection, savedSelectionChannel);
    }
}

function cleanup(doc, idLayer, wasVisible, hasSelection, savedSelectionChannel) {
    try { idLayer.visible = wasVisible; } catch(e){}
    
    // Ensure we are back on RGB composite if something failed
    try { doc.activeChannels = doc.componentChannels; } catch(e){}

    if (hasSelection && savedSelectionChannel) {
        try { savedSelectionChannel.remove(); } catch(e) {}
    }
}

function selectColorRange(color, fuzziness) {
    var idClrR = charIDToTypeID( "ClrR" );
    var desc = new ActionDescriptor();
    var idFzns = charIDToTypeID( "Fzns" );
    desc.putInteger( idFzns, fuzziness );
    
    var idMnm = charIDToTypeID( "Mnm " );
    var descColor = new ActionDescriptor();
    descColor.putDouble( charIDToTypeID( "Rd  " ), color.rgb.red );
    descColor.putDouble( charIDToTypeID( "Grn " ), color.rgb.green );
    descColor.putDouble( charIDToTypeID( "Bl  " ), color.rgb.blue );
    desc.putObject( idMnm, charIDToTypeID( "RGBC" ), descColor );
    
    var idMxm = charIDToTypeID( "Mxm " );
    var descColorMax = new ActionDescriptor();
    descColorMax.putDouble( charIDToTypeID( "Rd  " ), color.rgb.red );
    descColorMax.putDouble( charIDToTypeID( "Grn " ), color.rgb.green );
    descColorMax.putDouble( charIDToTypeID( "Bl  " ), color.rgb.blue );
    desc.putObject( idMxm, charIDToTypeID( "RGBC" ), descColorMax );
    
    executeAction( idClrR, desc, DialogModes.NO );
}

function refineActiveSelectionWithDialog(doc) {
    var tempAlpha = null;
    try {
        tempAlpha = doc.channels.add();
        tempAlpha.name = "Temp_CG_Alpha";
        doc.selection.store(tempAlpha, SelectionType.REPLACE);
        
        doc.selection.deselect();
        
        // Isolate the view to just our temporary mask so the user can see it
        doc.activeChannels = [tempAlpha];
        
        // Prepare Levels command
        var idLvls = charIDToTypeID( "Lvls" );
        var descLvl = new ActionDescriptor();
        var idAdjs = charIDToTypeID( "Adjs" );
        var list = new ActionList();
        var descChnl = new ActionDescriptor();
        var idChnl = charIDToTypeID( "Chnl" );
        var ref = new ActionReference();
        ref.putEnumerated( idChnl, idChnl, charIDToTypeID( "Trgt" ) );
        descChnl.putReference( idChnl, ref );
        
        // Set up default starting values for the dialog that are good for CG edges
        var idInpt = charIDToTypeID( "Inpt" );
        var list2 = new ActionList();
        list2.putInteger( 0 );   // Black point
        list2.putInteger( 220 ); // White point (contracts highlights to solidify edges)
        descChnl.putList( idInpt, list2 );
        var idGmm = charIDToTypeID( "Gmm " );
        descChnl.putDouble( idGmm, 1.3 ); // Boost midtones
        
        var idLvlA = charIDToTypeID( "LvlA" );
        list.putObject( idLvlA, descChnl );
        descLvl.putList( idAdjs, list );
        
        // Execute Levels WITH DIALOG so the user can visually adjust
        // If the user hits Cancel, an exception is thrown.
        executeAction( idLvls, descLvl, DialogModes.ALL );
        
        // Restore composite channels and load selection
        doc.activeChannels = doc.componentChannels;
        doc.selection.load(tempAlpha, SelectionType.REPLACE);
        tempAlpha.remove();
        
    } catch (e) {
        // User pressed Cancel on the Levels dialog, or something failed.
        // We clean up and abort the extraction.
        doc.activeChannels = doc.componentChannels;
        if (tempAlpha) {
            try { tempAlpha.remove(); } catch(err){}
        }
        throw new Error("UserCancelled");
    }
}

function layerViaCopy() {
    try {
        var idCpTL = charIDToTypeID( "CpTL" );
        executeAction( idCpTL, undefined, DialogModes.NO );
    } catch (e) {
        alert("Could not copy to new layer. Ensure your selection is not empty.");
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
