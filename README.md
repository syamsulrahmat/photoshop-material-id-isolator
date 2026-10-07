# Photoshop Material ID Isolator

A powerful Photoshop ExtendScript for 3D Artists and ArchViz retouchers that perfectly extracts complex CG geometry (fences, trees, fine wires) using Material ID passes.

## The Problem
Standard Photoshop tools (like Magic Wand or Color Range) fail when selecting complex objects from a CG Material ID pass:
1. **Anti-Aliasing Fringes:** Thin geometry (like fences) consists mostly of anti-aliased edge pixels. Standard selection leaves a halo or makes the wires look transparent.
2. **Fragmentation:** To select a fence broken up by foreground objects, you have to Shift-Click 50 times.

## The Solution
This script automates a highly refined extraction workflow:
* **Spatial Isolation:** Only extracts the target material *inside* a lasso selection you draw, ignoring identical materials elsewhere in the render.
* **Interactive Edge Refinement:** Drops you into an interactive Levels dialog on a temporary alpha channel, allowing you to visually "crunch" the black and white values to solidify thin geometry and remove anti-aliasing fringes before extracting.

## Installation
1. Download `Material_ID_Isolator.jsx`.
2. Place it in your Photoshop Scripts folder:
   * **Windows:** `C:\Program Files\Adobe\Adobe Photoshop [Version]\Presets\Scripts`
   * **Mac:** `Applications > Adobe Photoshop [Version] > Presets > Scripts`
3. Restart Photoshop (or run it directly via `File > Scripts > Browse...`).

## How to Use
1. Ensure your ID layer is named **"Material ID"** (or contains the word "ID").
2. Use the **Eyedropper Tool (`I`)** to sample the exact color of the object you want to extract from the ID pass. *(This sets your Foreground Color).*
3. Select your **Beauty Render layer** (the layer you want to extract from).
4. *(Optional)* Use the **Lasso Tool (`L`)** to draw a rough selection around the specific object you want to isolate (e.g., just the left fence).
5. Run the script!
6. A **Levels Dialog** will appear showing your mask in black and white. Adjust the sliders to perfectly solidify your thin edges, then hit **OK**.
7. The script will automatically copy your perfectly extracted object to a new layer (`CTRL + J`).
