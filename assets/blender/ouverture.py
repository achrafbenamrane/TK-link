"""L'ouverture de l'app en 3D — le logo « TKlink » prend son relief. Scène Blender entièrement scriptée.

Départ : le logo plat, au centre, sur #0A0A0D — exactement l'écran de lancement natif
(`assets/images/splash-icon.png`), pour que le passage de l'un à l'autre ne se voie pas. Puis les
lettres prennent leur épaisseur l'une après l'autre (« TK » en laque rose, « link » blanc aux
tranches roses), la caméra tourne doucement autour, et un trait de lumière balaie le logo : la
lumière qui passe plus vite que le texte, comme le voulait le client — de la vraie lumière, plus une
icône d'éclair.

    blender -b --factory-startup -P assets/blender/ouverture.py -- --out DOSSIER [--samples 96]
        [--frames 1,20,40] [--scale 50]

Écrit DOSSIER/0001.png … (1080 × 1920, 30 i/s, 66 images = 2,2 s, ~5 min sur la carte graphique).
Puis l'encodage (H.264, BT.709 : le fond doit ressortir à #0A0A0D sur le téléphone) et les deux
images fixes que l'écran affiche avant la première image et en repli :

    ffmpeg -framerate 30 -i DOSSIER/%04d.png -vf "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" \\
      -c:v libx264 -profile:v high -preset slow -crf 22 -movflags +faststart \\
      -color_primaries bt709 -color_trc bt709 -colorspace bt709 assets/videos/ouverture.mp4
    ffmpeg -i DOSSIER/0001.png -c:v libwebp -quality 82 assets/images/ouverture-debut.webp
    ffmpeg -i DOSSIER/0066.png -c:v libwebp -quality 82 assets/images/ouverture-fin.webp

L'écran : `src/features/welcome/ui/welcome-screen.tsx` (ses durées suivent celles d'ici).
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
FONT = os.path.join(ROOT, 'landing', 'blender', 'fonts', 'Manrope-800.ttf')

FPS = 30
LAST = 66  # 2,2 s : l'ouverture se joue à chaque lancement, elle doit rester brève.


def args():
    argv = sys.argv[sys.argv.index('--') + 1 :] if '--' in sys.argv else []
    o = {'out': os.path.join(HERE, 'rendu'), 'samples': 96, 'frames': None, 'scale': 100}
    i = 0
    while i < len(argv):
        k = argv[i]
        if k in ('--out', '--samples', '--frames', '--scale'):
            o[k[2:]] = argv[i + 1]
            i += 1
        i += 1
    o['samples'] = int(o['samples'])
    o['scale'] = int(o['scale'])
    if o['frames']:
        o['frames'] = [int(x) for x in str(o['frames']).split(',')]
    return o


def lin(hex_color):
    h = hex_color.lstrip('#')
    out = []
    for k in range(3):
        c = int(h[2 * k : 2 * k + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (*out, 1.0)


BG = lin('#0A0A0D')


def material(name, color, roughness, coat=0.0, coat_rough=0.05, emission=0.0):
    mat = bpy.data.materials.new(name)
    if bpy.app.version < (5, 0, 0):
        mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    values = {
        'Base Color': color,
        'Roughness': roughness,
        'Coat Weight': coat,
        'Coat Roughness': coat_rough,
        'Emission Color': color,
        'Emission Strength': emission,
    }
    for key, value in values.items():
        if key in bsdf.inputs:
            bsdf.inputs[key].default_value = value
    return mat


# ─────────────────────────────────────────────────────────────── le logo


def build_logo():
    pink_face = material('TK face', lin('#FF1478'), 0.34, coat=0.45, coat_rough=0.03, emission=0.16)
    pink_side = material('TK tranche', lin('#C70A5D'), 0.35, coat=0.6, coat_rough=0.06)
    white_face = material('link face', lin('#F4F4F8'), 0.32, coat=0.7, coat_rough=0.04)
    link_side = material('link tranche', lin('#FF1478'), 0.35, coat=0.6, coat_rough=0.06, emission=0.06)

    curve = bpy.data.curves.new('TKlink', 'FONT')
    curve.body = 'TKlink'
    curve.font = bpy.data.fonts.load(FONT)
    curve.size = 1.0
    curve.shear = math.tan(math.radians(9))  # le logo penche de 9° (voir src/shared/ui/wordmark.tsx)
    curve.space_character = 1.03
    curve.extrude = 0.062
    curve.bevel_depth = 0.014
    curve.bevel_resolution = 4
    curve.align_x = 'CENTER'
    curve.align_y = 'CENTER'
    text = bpy.data.objects.new('TKlink', curve)
    bpy.context.collection.objects.link(text)

    bpy.context.view_layer.objects.active = text
    text.select_set(True)
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.separate(type='LOOSE')
    bpy.ops.object.mode_set(mode='OBJECT')
    parts = [o for o in bpy.context.selected_objects if o.type == 'MESH']

    def center_x(o):
        xs = [v.co.x for v in o.data.vertices]
        return (min(xs) + max(xs)) / 2

    parts.sort(key=center_x)
    # La conversion rend TROIS morceaux par lettre (face avant, face arrière, tranche) : on les
    # regroupe par lettre d'après leur centre, pour que couleur et relief suivent la lettre entière.
    letter_of = {}
    letter = -1
    previous = None
    for part in parts:
        cx = center_x(part)
        if previous is None or cx - previous > 0.15:
            letter += 1
        letter_of[part.name] = letter
        previous = cx
    print('Lettres :', letter + 1)
    front_z = curve.extrude + curve.bevel_depth
    logo = bpy.data.objects.new('Logo', None)
    bpy.context.collection.objects.link(logo)
    # Debout, face à la caméra (−Y) : le texte est construit à plat, Blender a l'axe Z vers le haut.
    logo.rotation_euler = (math.radians(90), 0, 0)

    for part in parts:
        index = letter_of[part.name]
        is_tk = index < 2  # T, K ; puis l, i (fût et point), n, k
        face, side = (pink_face, pink_side) if is_tk else (white_face, link_side)
        part.data.materials.clear()
        part.data.materials.append(face)
        part.data.materials.append(side)
        bm = bmesh.new()
        bm.from_mesh(part.data)
        for f in bm.faces:
            f.material_index = 0 if abs(f.normal.z) > 0.92 else 1
            f.smooth = abs(f.normal.z) <= 0.92
        bm.to_mesh(part.data)
        bm.free()
        # L'origine sur la face avant : l'épaisseur pousse vers l'arrière, la face ne bouge pas.
        xs = [v.co.x for v in part.data.vertices]
        ys = [v.co.y for v in part.data.vertices]
        cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
        part.data.transform(Matrix.Translation((-cx, -cy, -front_z)))
        part.location = (cx, cy, front_z)
        part.parent = logo
        # Le relief arrive lettre par lettre, de gauche à droite.
        start = 7 + index * 2
        part.scale = (1, 1, 0.02)
        part.keyframe_insert('scale', index=2, frame=start)
        part.scale = (1, 1, 1.12)
        part.keyframe_insert('scale', index=2, frame=start + 11)
        part.scale = (1, 1, 1.0)
        part.keyframe_insert('scale', index=2, frame=start + 18)

    width = max(max(v.co.x + p.location.x for v in p.data.vertices) for p in parts) - min(
        min(v.co.x + p.location.x for v in p.data.vertices) for p in parts
    )
    return logo, width


# ─────────────────────────────────────────────────────────── lumière, caméra


def look_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()


def W(x, y, z):
    """Repère du logo (x droite, y haut, z vers la caméra) → repère de Blender (Z en haut)."""
    return (x, -z, y)


def area(name, color, energy, size, loc, target=(0, 0, 0), size_y=None):
    data = bpy.data.lights.new(name, 'AREA')
    data.color = color[:3]
    data.energy = energy
    if size_y is None:
        data.size = size
    else:
        data.shape = 'RECTANGLE'
        data.size = size
        data.size_y = size_y
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    look_at(obj, target)
    obj.visible_camera = False
    return obj


def stage(scene, width):
    world = bpy.data.worlds.new('Nuit')
    scene.world = world
    if bpy.app.version < (5, 0, 0):
        world.use_nodes = True
    bg = world.node_tree.nodes.get('Background')
    bg.inputs['Color'].default_value = BG
    bg.inputs['Strength'].default_value = 1.0

    s = width / 3.3  # tout est réglé pour un logo d'environ 3,3 unités
    area('Cle', lin('#FFF6F0'), 1100 * s * s, 5 * s, W(-5 * s, 4 * s, 7 * s))
    # Face : une grande source douce près de la caméra — le blanc de « link » reste blanc, comme sur
    # l'écran de lancement.
    area('Face', lin('#FFFFFF'), 620 * s * s, 7 * s, W(2 * s, 8 * s, 8 * s))
    area('Contre-jour bleu', lin('#00B2FF'), 1400 * s * s, 3 * s, W(5.5 * s, 3.5 * s, -4 * s))
    area('Rebond rose', lin('#FF1478'), 120 * s * s, 6 * s, W(-2 * s, -6 * s, -1 * s))
    # Le trait de lumière : une bande haute et fine qui passe devant le logo, de gauche à droite.
    sweep = area('Balayage', lin('#FFFFFF'), 4200 * s * s, 0.18 * s, W(-9 * s, 0, 4.2 * s),
                 target=W(-9 * s, 0, 0), size_y=16 * s)
    # Un reflet, pas un éclairage : la bande ne s'allume que dans les surfaces brillantes.
    sweep.visible_diffuse = False
    for frame, x in ((24, -7.5), (46, 7.5)):
        sweep.location.x = x * s
        sweep.keyframe_insert('location', index=0, frame=frame)
    sweep.data.energy = 0
    sweep.data.keyframe_insert('energy', frame=22)
    sweep.data.energy = 4200 * s * s
    sweep.data.keyframe_insert('energy', frame=26)
    sweep.data.keyframe_insert('energy', frame=44)
    sweep.data.energy = 0
    sweep.data.keyframe_insert('energy', frame=48)

    cam_data = bpy.data.cameras.new('Camera')
    cam_data.lens = 50
    cam_data.sensor_fit = 'VERTICAL'
    cam_data.sensor_height = 36
    cam = bpy.data.objects.new('Camera', cam_data)
    bpy.context.collection.objects.link(cam)
    scene.camera = cam
    rig = bpy.data.objects.new('Rig camera', None)
    bpy.context.collection.objects.link(rig)
    cam.parent = rig
    track = cam.constraints.new('TRACK_TO')
    target = bpy.data.objects.new('Visee', None)
    bpy.context.collection.objects.link(target)
    track.target = target
    track.track_axis = 'TRACK_NEGATIVE_Z'
    track.up_axis = 'UP_Y'

    # Largeur visible = 2·d·tan(fov/2) ; en portrait 9:16, la largeur vaut 9/16 de la hauteur.
    half_w = math.tan(math.atan(18 / 50)) * (1080 / 1920)

    def dist(fraction):  # distance pour que le logo occupe `fraction` de la largeur de l'image
        return width / (fraction * 2 * half_w)

    keys = [
        # image, azimut (°), élévation (°), part de la largeur
        (1, 0, 0, 0.235),  # = l'écran de lancement natif (logo de 140 dp)
        (6, 0, 0, 0.25),
        (34, 19, 8, 0.6),
        (LAST, 12, 5, 0.62),
    ]
    for frame, az, el, frac in keys:
        rig.rotation_euler = (math.radians(-el), 0, math.radians(az))
        cam.location = (0, -dist(frac), 0)
        rig.keyframe_insert('rotation_euler', frame=frame)
        cam.keyframe_insert('location', index=1, frame=frame)
    for obj in (rig, cam):
        for fc in obj.animation_data.action.fcurves if hasattr(obj.animation_data.action, 'fcurves') else []:
            for kp in fc.keyframe_points:
                kp.interpolation = 'BEZIER'
    return cam


def render_settings(scene, samples, scale):
    scene.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    device = 'CPU'
    for kind in ('OPTIX', 'CUDA'):
        try:
            prefs.compute_device_type = kind
            prefs.get_devices()
            if [d for d in prefs.devices if d.type == kind]:
                for d in prefs.devices:
                    d.use = d.type == kind
                device = 'GPU'
                break
        except Exception:
            continue
    scene.cycles.device = device
    scene.cycles.samples = samples
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.use_denoising = True
    scene.render.use_motion_blur = True
    scene.render.motion_blur_shutter = 0.45
    scene.render.film_transparent = False
    scene.render.resolution_x = 1080
    scene.render.resolution_y = 1920
    scene.render.resolution_percentage = scale
    scene.render.fps = FPS
    scene.frame_start = 1
    scene.frame_end = LAST
    # « Standard » : le rose est la marque, AgX le délaverait ; et le fond doit sortir à #0A0A0D pile.
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'
    print('Rendu :', device, samples, 'échantillons')


def main():
    o = args()
    os.makedirs(o['out'], exist_ok=True)
    scene = bpy.context.scene
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    logo, width = build_logo()
    print('Largeur du logo :', round(width, 3))
    stage(scene, width)
    render_settings(scene, o['samples'], o['scale'])
    frames = o['frames'] or list(range(1, LAST + 1))
    for f in frames:
        scene.frame_set(f)
        scene.render.filepath = os.path.join(o['out'], f'{f:04d}.png')
        bpy.ops.render.render(write_still=True)
        print('Écrit :', f)


main()
