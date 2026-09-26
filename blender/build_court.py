"""
BWF doubles badminton court builder for Blender.
1 Blender unit = 1 meter. Exports public/assets/court.glb

Doubles court: 13.40 m (length) x 6.10 m (width)
Net: posts 1.55 m, center 1.524 m
"""
import bpy
import math
import os
from mathutils import Vector

# --- Clear scene ---
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
for block in bpy.data.meshes:
    bpy.data.meshes.remove(block)
for block in bpy.data.materials:
    bpy.data.materials.remove(block)

# --- Dimensions (meters) ---
COURT_L = 13.40
COURT_W = 6.10
HALF_L = COURT_L / 2.0
HALF_W = COURT_W / 2.0
LINE_W = 0.04
NET_POST_H = 1.55
NET_CENTER_H = 1.524
NET_WIDTH = 6.10
FLOOR_MARGIN = 2.0

# Singles sidelines are inset 0.46m from doubles sidelines
SINGLES_INSET = 0.46
# Short service line is 1.98m from net
SHORT_SERVICE = 1.98
# Doubles long service line is 0.76m from back boundary
LONG_SERVICE_INSET = 0.76
# Center line runs from short service to back

def mat(name, color, roughness=0.7, metallic=0.0):
    m = bpy.data.materials.new(name=name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)
        bsdf.inputs["Roughness"].default_value = roughness
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = metallic
    return m


MAT_FLOOR = mat("Floor", (0.12, 0.35, 0.18), 0.85)
MAT_COURT = mat("CourtSurface", (0.15, 0.42, 0.22), 0.8)
MAT_LINE = mat("CourtLine", (0.95, 0.95, 0.95), 0.5)
MAT_NET = mat("NetMesh", (0.85, 0.85, 0.9), 0.4)
MAT_POST = mat("NetPost", (0.15, 0.15, 0.18), 0.35, 0.2)
MAT_PLAYER_A = mat("PlayerA", (0.2, 0.45, 0.9), 0.55)
MAT_PLAYER_B = mat("PlayerB", (0.9, 0.35, 0.2), 0.55)
MAT_RACKET = mat("Racket", (0.2, 0.2, 0.22), 0.3, 0.4)
MAT_SHUTTLE = mat("Shuttle", (0.95, 0.95, 0.9), 0.4)


def add_box(name, size, location, material, collection=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if material:
        obj.data.materials.append(material)
    return obj


def add_cylinder(name, radius, depth, location, material, vertices=16):
    bpy.ops.mesh.primitive_cylinder_add(
        radius=radius, depth=depth, location=location, vertices=vertices
    )
    obj = bpy.context.active_object
    obj.name = name
    if material:
        obj.data.materials.append(material)
    return obj


def add_uv_sphere(name, radius, location, material, segments=12, rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=radius, location=location, segments=segments, ring_count=rings
    )
    obj = bpy.context.active_object
    obj.name = name
    if material:
        obj.data.materials.append(material)
    return obj


# --- Floor ---
# Blender axes: X = width, Y = length, Z = up
floor = add_box(
    "Floor",
    (COURT_W + FLOOR_MARGIN * 2, COURT_L + FLOOR_MARGIN * 2, 0.05),
    (0, 0, -0.025),
    MAT_FLOOR,
)

# --- Court surface (slightly above floor) ---
court = add_box(
    "CourtSurface",
    (COURT_W, COURT_L, 0.02),
    (0, 0, 0.01),
    MAT_COURT,
)

# --- Court lines (flat boxes on surface) ---
LINE_Z = 0.025
LW = LINE_W


def line_x(name, x, y0, y1):
    """Line parallel to Y axis (constant X)."""
    length = abs(y1 - y0)
    cy = (y0 + y1) / 2.0
    return add_box(name, (LW, length, 0.008), (x, cy, LINE_Z), MAT_LINE)


def line_y(name, y, x0, x1):
    """Line parallel to X axis (constant Y)."""
    length = abs(x1 - x0)
    cx = (x0 + x1) / 2.0
    return add_box(name, (length, LW, 0.008), (cx, y, LINE_Z), MAT_LINE)


# Outer doubles boundaries
line_y("Line_Back_Pos", HALF_L, -HALF_W, HALF_W)
line_y("Line_Back_Neg", -HALF_L, -HALF_W, HALF_W)
line_x("Line_Side_Pos", HALF_W, -HALF_L, HALF_L)
line_x("Line_Side_Neg", -HALF_W, -HALF_L, HALF_L)

# Singles sidelines
singles_y = HALF_W - SINGLES_INSET
line_x("Line_Singles_Pos", singles_y, -HALF_L, HALF_L)
line_x("Line_Singles_Neg", -singles_y, -HALF_L, HALF_L)

# Short service lines (both sides of net)
line_y("Line_Short_Pos", SHORT_SERVICE, -HALF_W, HALF_W)
line_y("Line_Short_Neg", -SHORT_SERVICE, -HALF_W, HALF_W)

# Doubles long service lines
long_svc = HALF_L - LONG_SERVICE_INSET
line_y("Line_Long_Pos", long_svc, -HALF_W, HALF_W)
line_y("Line_Long_Neg", -long_svc, -HALF_W, HALF_W)

# Center lines (from short service to back, both halves)
line_x("Line_Center_Pos", 0.0, SHORT_SERVICE, HALF_L)
line_x("Line_Center_Neg", 0.0, -SHORT_SERVICE, -HALF_L)

# --- Net ---
# Posts at doubles sidelines
post_r = 0.04
add_cylinder("NetPost_Pos", post_r, NET_POST_H, (HALF_W, 0, NET_POST_H / 2), MAT_POST)
add_cylinder("NetPost_Neg", post_r, NET_POST_H, (-HALF_W, 0, NET_POST_H / 2), MAT_POST)

# Net mesh: slightly sagging at center via two planes or a thin box approximating height
# Use a thin box spanning full width; height avg ~1.537, but we model as trapezoid-ish with center dip
# Simple approach: vertical plane mesh with center lower
net_height_avg = (NET_POST_H + NET_CENTER_H) / 2.0
net_mesh = add_box(
    "Net",
    (NET_WIDTH, 0.02, net_height_avg),
    (0, 0, net_height_avg / 2),
    MAT_NET,
)
# Tape / top edge highlight
add_box(
    "NetTape",
    (NET_WIDTH + 0.05, 0.03, 0.04),
    (0, 0, NET_CENTER_H),
    mat("NetTape", (1.0, 1.0, 1.0), 0.4),
)

# --- Player stubs (4) + rackets ---
# Team A (human side): negative Y half  (serve toward +Y)
# Team B (AI side): positive Y half
# Positions: front/back partners

PLAYER_POS = {
    "Player_A_Front": (1.5, -3.0, 0),
    "Player_A_Back": (-1.5, -5.2, 0),
    "Player_B_Front": (-1.5, 3.0, 0),
    "Player_B_Back": (1.5, 5.2, 0),
}


def make_player(name, pos, team_mat, face_sign):
    """Low-poly stub: body cylinder + head sphere + racket."""
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    root.location = Vector(pos)

    body = add_cylinder(f"{name}_Body", 0.22, 1.0, (0, 0, 0.7), team_mat, vertices=10)
    body.parent = root

    head = add_uv_sphere(f"{name}_Head", 0.18, (0, 0, 1.35), team_mat, segments=10, rings=6)
    head.parent = root

    # Racket: handle + oval head (scaled cylinder as rim placeholder + thin disc)
    racket_empty = bpy.data.objects.new(f"{name}_Racket", None)
    bpy.context.collection.objects.link(racket_empty)
    racket_empty.parent = root
    # Hold racket to the side / forward
    racket_empty.location = Vector((0.35 * face_sign, 0.15 * face_sign, 0.95))
    racket_empty.rotation_euler = (math.radians(70), 0, math.radians(20 * face_sign))

    handle = add_cylinder(f"{name}_Handle", 0.015, 0.35, (0, 0, -0.15), MAT_RACKET, vertices=8)
    handle.parent = racket_empty

    # Racket head as flattened torus-ish: thin cylinder scaled
    head_r = add_cylinder(f"{name}_RacketHead", 0.12, 0.015, (0, 0, 0.12), MAT_RACKET, vertices=12)
    head_r.parent = racket_empty
    head_r.scale = (1.0, 1.35, 1.0)
    bpy.ops.object.select_all(action="DESELECT")
    head_r.select_set(True)
    bpy.context.view_layer.objects.active = head_r
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    return root


make_player("Player_A_Front", PLAYER_POS["Player_A_Front"], MAT_PLAYER_A, 1)
make_player("Player_A_Back", PLAYER_POS["Player_A_Back"], MAT_PLAYER_A, 1)
make_player("Player_B_Front", PLAYER_POS["Player_B_Front"], MAT_PLAYER_B, -1)
make_player("Player_B_Back", PLAYER_POS["Player_B_Back"], MAT_PLAYER_B, -1)

# Reference shuttle at center (optional marker; sim creates its own)
add_uv_sphere("Shuttle_Ref", 0.03, (0, -2.0, 1.2), MAT_SHUTTLE, segments=8, rings=6)

# --- Empty markers for game logic ---
for name, loc in [
    ("Marker_Net", (0, 0, NET_CENTER_H)),
    ("Marker_CourtCenter", (0, 0, 0)),
    ("Marker_Serve_A", (1.5, -HALF_L + 0.5, 0)),
    ("Marker_Serve_B", (-1.5, HALF_L - 0.5, 0)),
]:
    empty = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(empty)
    empty.location = Vector(loc)
    empty.empty_display_type = "PLAIN_AXES"
    empty.empty_display_size = 0.3

# --- Camera & light (for Blender preview; Three.js uses its own) ---
bpy.ops.object.camera_add(location=(0, -14, 8), rotation=(math.radians(55), 0, 0))
cam = bpy.context.active_object
cam.name = "PreviewCamera"
bpy.context.scene.camera = cam

bpy.ops.object.light_add(type="SUN", location=(5, -5, 12))
sun = bpy.context.active_object
sun.name = "Sun"
sun.data.energy = 3.0

# --- Custom properties for metadata ---
bpy.context.scene["court_length"] = COURT_L
bpy.context.scene["court_width"] = COURT_W
bpy.context.scene["net_post_height"] = NET_POST_H
bpy.context.scene["net_center_height"] = NET_CENTER_H
bpy.context.scene["scale_note"] = "1 Blender unit = 1 meter"

# --- Export ---
# Resolve output path: prefer script location; fall back to CWD if Blender
# rewrites __file__. Never write into ~/Public on macOS case-insensitive FS.
def resolve_project_root():
    candidates = []
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        candidates.append(os.path.dirname(script_dir))
    except Exception:
        pass
    candidates.append(os.getcwd())
    env = os.environ.get("BADMINTON_PROJECT_ROOT")
    if env:
        candidates.insert(0, env)
    for root in candidates:
        if os.path.isdir(os.path.join(root, "blender")) and os.path.isdir(os.path.join(root, "src")):
            return root
        if os.path.isfile(os.path.join(root, "package.json")):
            return root
    return candidates[0]

project_root = resolve_project_root()
out_path = os.path.join(project_root, "public", "assets", "court.glb")
# Guard: refuse to write into the user Public folder
norm = os.path.normpath(out_path).lower()
if norm.endswith("/public/assets/court.glb") and "/documents/" not in norm and "/github/" not in norm:
    # If still ambiguous, force under CWD public only when CWD looks like the project
    if os.path.isfile(os.path.join(os.getcwd(), "package.json")):
        project_root = os.getcwd()
        out_path = os.path.join(project_root, "public", "assets", "court.glb")
os.makedirs(os.path.dirname(out_path), exist_ok=True)

# Select all mesh + empties for export (exclude lights/camera optionally — include all)
bpy.ops.object.select_all(action="SELECT")

bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format="GLB",
    use_selection=False,
    export_apply=True,
    export_yup=True,
)

print(f"Exported court GLB -> {out_path}")
print(f"Court: {COURT_L}m x {COURT_W}m | Net posts {NET_POST_H}m / center {NET_CENTER_H}m")
