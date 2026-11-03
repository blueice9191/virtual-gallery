# Experimental WebXR VR mode

Virtual Gallery can request an immersive WebXR session in a compatible headset browser. No Unity plugin or separate headset application is required. Enter VR is shown only when the browser reports support for immersive-vr. Open the HTTPS site directly in the headset browser, rather than inside another website's embedded preview. Localhost is suitable for local desktop development; a headset cannot reach a computer's localhost address. A remote headset preview needs an HTTPS host.

## Controls

- Choose Enter VR in the normal navigation, then accept the headset's session prompt.
- Look around naturally. The headset controls the camera pose; the gallery never runs desktop camera sweeps in VR.
- Point a controller at a clear floor area and select/press the trigger to teleport. A green ring indicates a valid landing. Walls block the pointing ray, and landings near collision obstacles or upper atrium voids are rejected.
- Select a wall artwork to open a world-locked floating close-up. It preserves the artwork's proportions and loads an image bounded at 2048 pixels. Select Close artwork to return. Only one close-up texture is retained.
- Squeeze either controller to close an artwork or bring the menu in front of you.
- Use Floor 1, Floor 2, or Floor 3 on the in-world menu to teleport to a validated balcony/atrium landing. Teleporting to stair treads is disabled; use thumbstick walking on stairs or these shortcuts.
- Left Quest thumbstick: move forward/backward and strafe relative to your horizontal viewing direction (1.6 m/s), with wall, furniture and floor-edge collision checks. Walk along the switchback stairs to move between levels, or use the floor buttons.
- Right Quest thumbstick: smoothly turn left/right and adjust vertical view tilt (up to 30 degrees each way). Release to stop. Natural head tracking and physical walking remain available.
- Select Exit VR in the in-world menu, or use the headset's system exit. The normal browser camera and controls return to where VR was entered.

The first interaction target is a controller-based headset such as Meta Quest. Other WebXR browsers may expose standard selection rays, but device-specific hand/gaze interactions have not been validated. Full hand tracking and hand models are not implemented.

## Behavior and performance

The existing museum, session assignments, artwork catalog and collision model are reused. A camera rig carries the headset and controllers; head tracking remains under WebXR control. HTML dialogs are replaced by in-scene close-up and navigation controls during immersion. Automatic tours and the desktop forced overhead camera are disabled in VR. Point at a standing book and press either trigger to open it on a VR reading stand. Select its left page to go back or right page to go forward, using either controller. Left-stick movement and right-stick viewing remain active, so you can approach or change your view naturally. The book stays on the physical gallery desk, supported above the tabletop on a fixed near-edge hinge. It starts at 45 degrees and tilts between 15 and 75 degrees without moving its hinge. The two-column menu is to the viewer’s right, clear of the pages. Higher/Lower changes virtual viewing height in 10 cm steps, bounded from tabletop level (1.01 m) to 6 ft 6 in (1.9812 m), without moving the book. Reset restores 45-degree tilt and natural viewing height within those limits; closing removes the temporary height offset. The final forward turn closes and returns the book; Close book in the squeeze menu also returns it. Page textures use the existing adjacent-spread cache. Exiting VR closes any open book and cancels a pending opening.

When immersive VR support is detected, the gallery uses its bounded texture path, including on supported desktop headset browsers: at most 24 nearby displays, two concurrent image loads, 768-pixel wall images, a 2048-pixel favorites-panel image, and a 2048-pixel selected close-up. Dynamic shadows and antialiasing are disabled on this constrained path; XR uses an initial framebuffer scale of 0.85 and foveation where supported. A brief dark transition hides texture preparation during teleports. The next floor is prepared before the viewpoint relocates. Actual frame rate and visual quality depend on the headset and collection.

## Verification status

Automated tests cover runtime capability detection, actual museum landing geometry, wall occlusion, controller selection, handed joystick movement/turning, upper-floor world coordinates, session camera restoration and stale image disposal. These tests inject an XR session/controller runtime around real Three.js scene objects; they do not validate stereoscopic output, tracking, physical comfort, browser permissions or hardware performance.

The owner verified initial room-scale VR on Meta Quest 2. The joystick and upper-floor loading fixes still need a headset check. Please check on the target device before describing it as production-tested VR:

1. Entry and exit, including ending the session from the headset system menu.
2. Head tracking and readable menu orientation.
3. Teleports on each floor, rejected walls/voids/stairs, and all three floor shortcuts.
4. Left-stick movement, collision stops, and right-stick horizontal/vertical looking.
5. Artwork opening, closing and reopening; accurate proportions and no stale images.
6. Texture loading, responsiveness and sustained performance across all floors.
7. Desktop/mobile behavior after VR exit or a denied session request.

Physical room-scale head movement is tracked by the headset; the gallery's teleport collision tests do not constrain a person's real movement.

## Implementation

`src/vr.js` contains the rig, session lifecycle, controller rays, floating UI, teleport transitions and close-ups. `src/vr-policy.js` provides capability checks, safe landing rules and artwork fitting. `src/main.js` connects VR to the existing exhibition and renderer. No new package dependency was introduced.

References: https://threejs.org/manual/pages/webxr-basics.html and https://threejs.org/docs/pages/WebXRManager.html
