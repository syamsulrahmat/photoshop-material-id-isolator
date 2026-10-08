# Photoshop Material ID Isolator

A powerful Photoshop ExtendScript for 3D Artists and ArchViz retouchers that extracts complex CG geometry (fences, trees, fine wires) using Material ID passes, with flawless sub-pixel accuracy.

## The Problem
Standard Photoshop tools (like Magic Wand or Color Range) fail when selecting complex objects from a CG Material ID pass:
1. **Anti-Aliasing Fringes:** Thin geometry (like fences) consists mostly of dark, anti-aliased edge sub-pixels. Standard selection tools leave a halo or make the wires look transparent.
2. **Missing Color Data:** Because of heavy compression and sub-pixel rendering, thin wires often render with artifacts (missing Red or Green data). Single-channel extraction mathematically deletes these wires.

## The Solution
This script automates a highly refined extraction workflow:
* **Grayscale Channel Conversion:** Natively converts the ID pass to Grayscale, combining RGB data to ensure color-compression artifacts don't delete your fine geometry.
* **Spatial Isolation (Lasso):** Only extracts the target material *inside* a lasso selection you draw, ignoring identical materials elsewhere in the render.
* **Interactive Edge Refinement:** Drops you into an interactive Levels dialog on a temporary alpha channel, allowing you to visually "crunch" the black and white values to solidify thin geometry and remove anti-aliasing fringes before extracting.

## Installation
1. Download `Material_ID_Isolator.jsx`.
2. Place it in your Photoshop Scripts folder:
   * **Windows:** `C:\Program Files\Adobe\Adobe Photoshop [Version]\Presets\Scripts`
   * **Mac:** `Applications > Adobe Photoshop [Version] > Presets > Scripts`
3. Restart Photoshop (or run it directly via `File > Scripts > Browse...`).

## How to Use
1. Ensure your ID layer is named **"Material ID"** (or contains the words "ID", "Object ID", "MatID"). The script will automatically find it.
2. Ensure your **Beauty Render** layer is the layer currently selected. 
3. *(Optional)* Use the **Lasso Tool (`L`)** to draw a rough selection around the specific object you want to isolate (e.g., just the left fence).
4. Run the script!
5. In the dialog, leave it on **Grayscale** (or pick a specific channel if you prefer).
6. A **Levels Dialog** will appear showing your mask in black and white. Drag the White slider to the left (e.g. to a value of 15) to perfectly solidify your thin edges, then hit **OK**.
7. The script will automatically copy your perfectly extracted object from the Beauty layer to a new layer (`CTRL + J`).
