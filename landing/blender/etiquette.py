"""L'étiquette TK LINK en 3D — la scène Blender du site vitrine, construite entièrement par script.

Une étiquette de prix rose fluo (#FF1478, la couleur des étiquettes de soldes… et de la charte),
« −59 % » en relief devant, le QR du code de retrait derrière, un œillet métallique et une ficelle de
coton. Lumière de fin de journée — l'heure où les commerçants bradent ce qui doit partir : une clé
chaude de soleil couchant, un contre-jour bleu #00B2FF (l'autre couleur de la charte).

Rien n'est dessiné à la main : relancer ce script refait les images à l'identique.

    blender -b --factory-startup -P landing/blender/etiquette.py -- --shot hero
    blender -b --factory-startup -P landing/blender/etiquette.py -- --shot spin   # 30 images
    blender -b --factory-startup -P landing/blender/etiquette.py -- --shot back

Sortie : landing/public/3d/ (WebP avec transparence). Options : --samples N, --out DOSSIER,
--png (une copie PNG en plus, pour relire), --blend (enregistre la scène .blend à côté).
"""

import json
import math
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, 'fonts')


# ─────────────────────────────────────────────────────────────── arguments


def args():
    argv = sys.argv[sys.argv.index('--') + 1 :] if '--' in sys.argv else []
    opts = {'shot': 'hero', 'samples': 128, 'out': os.path.join(HERE, '..', 'public', '3d'),
            'png': False, 'blend': False, 'frames': 30}
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == '--shot':
            opts['shot'] = argv[i + 1]; i += 1
        elif a == '--samples':
            opts['samples'] = int(argv[i + 1]); i += 1
        elif a == '--out':
            opts['out'] = argv[i + 1]; i += 1
        elif a == '--frames':
            opts['frames'] = int(argv[i + 1]); i += 1
        elif a == '--png':
            opts['png'] = True
        elif a == '--blend':
            opts['blend'] = True
        i += 1
    return opts


# ─────────────────────────────────────────────────────────────── couleurs


def lin(hex_color):
    """sRGB (#RRGGBB) → linéaire, ce qu'attendent les nœuds de Blender."""
    h = hex_color.lstrip('#')
    out = []
    for k in range(3):
        c = int(h[2 * k : 2 * k + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (*out, 1.0)


PINK = lin('#FF1478')
INK = lin('#111114')


# ─────────────────────────────────────────────────────────────── matières


def principled(name, **inputs):
    mat = bpy.data.materials.new(name)
    if bpy.app.version < (5, 0, 0):  # Blender 5 : les matières sont toujours en nœuds
        mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    for key, value in inputs.items():
        if key in bsdf.inputs:
            bsdf.inputs[key].default_value = value
    return mat, bsdf


def material_pink():
    # Plastique laqué fluo : un vernis très lisse sur une base un peu satinée, et une pointe
    # d'émission de la même couleur — un rose fluo « brille » même à l'ombre.
    mat, bsdf = principled(
        'Etiquette rose',
        **{
            'Base Color': PINK,
            'Roughness': 0.32,
            'Coat Weight': 0.85,
            'Coat Roughness': 0.04,
            'Emission Color': PINK,
            'Emission Strength': 0.12,
        },
    )
    # Un vernis jamais parfait : de légères variations de brillance (sans elles, l'objet a l'air
    # d'une image de synthèse).
    nt = mat.node_tree
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 3.5
    noise.inputs['Detail'].default_value = 6.0
    ramp = nt.nodes.new('ShaderNodeMapRange')
    ramp.inputs['To Min'].default_value = 0.02
    ramp.inputs['To Max'].default_value = 0.11
    nt.links.new(noise.outputs['Fac'], ramp.inputs['Value'])
    nt.links.new(ramp.outputs['Result'], bsdf.inputs['Coat Roughness'])
    return mat


def material_print():
    mat, _ = principled('Impression blanche', **{'Base Color': lin('#FFF7FA'), 'Roughness': 0.45,
                                                  'Coat Weight': 0.3, 'Coat Roughness': 0.1})
    return mat


def material_metal():
    mat, _ = principled('Oeillet', **{'Base Color': lin('#D9DBE0'), 'Metallic': 1.0,
                                      'Roughness': 0.22, 'Anisotropic': 0.4})
    return mat


def material_cotton():
    mat, bsdf = principled('Coton', **{'Base Color': lin('#EDE6DC'), 'Roughness': 0.85,
                                       'Sheen Weight': 0.6, 'Sheen Tint': lin('#FFFFFF')})
    # Les torons de la ficelle : un relief en spirale le long de la courbe.
    nt = mat.node_tree
    coord = nt.nodes.new('ShaderNodeTexCoord')
    wave = nt.nodes.new('ShaderNodeTexWave')
    wave.wave_type = 'BANDS'
    wave.bands_direction = 'DIAGONAL'
    wave.inputs['Scale'].default_value = 9.0
    wave.inputs['Distortion'].default_value = 2.0
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.35
    nt.links.new(coord.outputs['Object'], wave.inputs['Vector'])
    nt.links.new(wave.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    return mat


# ─────────────────────────────────────────────────────────────── géométrie


def rounded_polygon(corners, radii, steps=10):
    """Points d'un polygone aux coins arrondis (rayon par coin)."""
    pts = []
    n = len(corners)
    for i in range(n):
        p0, p1, p2 = corners[i - 1], corners[i], corners[(i + 1) % n]
        r = radii[i]
        v1 = (p0[0] - p1[0], p0[1] - p1[1])
        v2 = (p2[0] - p1[0], p2[1] - p1[1])
        l1, l2 = math.hypot(*v1), math.hypot(*v2)
        v1, v2 = (v1[0] / l1, v1[1] / l1), (v2[0] / l2, v2[1] / l2)
        if r <= 0:
            pts.append(p1)
            continue
        angle = math.acos(max(-1, min(1, v1[0] * v2[0] + v1[1] * v2[1])))
        d = r / math.tan(angle / 2)
        a = (p1[0] + v1[0] * d, p1[1] + v1[1] * d)
        b = (p1[0] + v2[0] * d, p1[1] + v2[1] * d)
        bis = (v1[0] + v2[0], v1[1] + v2[1])
        lb = math.hypot(*bis)
        c = (p1[0] + bis[0] / lb * r / math.sin(angle / 2), p1[1] + bis[1] / lb * r / math.sin(angle / 2))
        a0 = math.atan2(a[1] - c[1], a[0] - c[0])
        a1 = math.atan2(b[1] - c[1], b[0] - c[0])
        da = a1 - a0
        while da > math.pi:
            da -= 2 * math.pi
        while da < -math.pi:
            da += 2 * math.pi
        for s in range(steps + 1):
            t = a0 + da * s / steps
            pts.append((c[0] + r * math.cos(t), c[1] + r * math.sin(t)))
    return pts


def circle(cx, cy, r, steps=64, clockwise=False):
    seq = range(steps) if not clockwise else range(steps, 0, -1)
    return [(cx + r * math.cos(2 * math.pi * s / steps), cy + r * math.sin(2 * math.pi * s / steps)) for s in seq]


W, H = 6.0, 9.6  # l'étiquette, en « centimètres » de scène
HOLE = (0.0, 3.35, 0.44)
THICK = 0.085  # demi-épaisseur extrudée (le biseau s'y ajoute)
BEVEL = 0.05
FRONT_Z = THICK + BEVEL


def make_tag(mat):
    curve = bpy.data.curves.new('Etiquette', 'CURVE')
    curve.dimensions = '2D'
    curve.fill_mode = 'BOTH'
    curve.extrude = THICK
    curve.bevel_depth = BEVEL
    curve.bevel_resolution = 6
    hw, hh = W / 2, H / 2
    cut = 1.45  # les deux coins coupés du haut
    corners = [(-hw, -hh), (hw, -hh), (hw, hh - cut), (hw - cut, hh), (-hw + cut, hh), (-hw, hh - cut)]
    outer = rounded_polygon(corners, [0.55, 0.55, 0.32, 0.32, 0.32, 0.32])
    for pts in (outer, circle(HOLE[0], HOLE[1], HOLE[2], clockwise=True)):
        sp = curve.splines.new('POLY')
        sp.points.add(len(pts) - 1)
        for k, (x, y) in enumerate(pts):
            sp.points[k].co = (x, y, 0, 1)
        sp.use_cyclic_u = True
        sp.use_smooth = True
    obj = bpy.data.objects.new('Etiquette', curve)
    obj.data.materials.append(mat)
    bpy.context.collection.objects.link(obj)
    return obj


def make_text(body, font_file, size, y, mat, z, back=False, extrude=0.028, spacing=1.0, max_width=None):
    curve = bpy.data.curves.new(body, 'FONT')
    curve.body = body
    curve.font = bpy.data.fonts.load(os.path.join(FONTS, font_file), check_existing=True)
    curve.size = size
    curve.align_x = 'CENTER'
    curve.align_y = 'CENTER'
    curve.extrude = extrude
    curve.bevel_depth = 0.006
    curve.space_character = spacing
    obj = bpy.data.objects.new(body, curve)
    obj.data.materials.append(mat)
    bpy.context.collection.objects.link(obj)
    if max_width:
        bpy.context.view_layer.update()
        if obj.dimensions.x > max_width:
            curve.size = size * max_width / obj.dimensions.x
    obj.location = (0, y, (z + extrude) if not back else -(z + extrude))
    if back:
        obj.rotation_euler = (0, math.pi, 0)
    return obj


def make_dash_line(y, mat, z, width=4.6, dashes=23):
    """La ligne pointillée « détachable » sous le prix."""
    mesh = bpy.data.meshes.new('Pointilles')
    verts, faces = [], []
    step = width / dashes
    for i in range(dashes):
        if i % 2:
            continue
        x0 = -width / 2 + i * step
        x1 = x0 + step
        base = len(verts)
        for (x, yy) in ((x0, y - 0.025), (x1, y - 0.025), (x1, y + 0.025), (x0, y + 0.025)):
            verts.append((x, yy, z + 0.012))
        faces.append((base, base + 1, base + 2, base + 3))
    mesh.from_pydata(verts, [], faces)
    obj = bpy.data.objects.new('Pointilles', mesh)
    obj.data.materials.append(mat)
    bpy.context.collection.objects.link(obj)
    return obj


def make_qr(mat, z, size=3.3, y=-0.55):
    """Le QR du code de retrait, en relief au dos (lu à l'endroit quand l'étiquette a tourné)."""
    data = json.load(open(os.path.join(HERE, 'qr.json'), encoding='utf-8'))
    n = data['size']
    cell = size / n
    h = 0.03
    verts, faces = [], []
    for r, row in enumerate(data['rows']):
        for c, bit in enumerate(row):
            if bit != '1':
                continue
            # Vu de dos : on retourne l'axe x pour que le code se lise à l'endroit.
            x0 = size / 2 - (c + 1) * cell
            y0 = y + size / 2 - (r + 1) * cell
            base = len(verts)
            for (x, yy, zz) in (
                (x0, y0, 0), (x0 + cell, y0, 0), (x0 + cell, y0 + cell, 0), (x0, y0 + cell, 0),
                (x0, y0, h), (x0 + cell, y0, h), (x0 + cell, y0 + cell, h), (x0, y0 + cell, h),
            ):
                verts.append((x, yy, -(z + zz)))
            faces += [
                (base + 4, base + 5, base + 6, base + 7)[::-1], (base, base + 1, base + 2, base + 3),
                (base, base + 1, base + 5, base + 4), (base + 1, base + 2, base + 6, base + 5),
                (base + 2, base + 3, base + 7, base + 6), (base + 3, base, base + 4, base + 7),
            ]
    mesh = bpy.data.meshes.new('QR')
    mesh.from_pydata(verts, [], faces)
    mesh.validate()
    obj = bpy.data.objects.new('QR', mesh)
    obj.data.materials.append(mat)
    bpy.context.collection.objects.link(obj)
    # Le cadre blanc autour du code (zone de silence, comme sur un vrai QR).
    pad = cell * 1.6
    frame = bpy.data.meshes.new('QR fond')
    s2 = size / 2 + pad
    frame.from_pydata(
        [(-s2, y - s2, -(z + 0.006)), (s2, y - s2, -(z + 0.006)), (s2, y + s2, -(z + 0.006)), (-s2, y + s2, -(z + 0.006))],
        [], [(3, 2, 1, 0)])
    fobj = bpy.data.objects.new('QR fond', frame)
    fobj.data.materials.append(material_print())
    bpy.context.collection.objects.link(fobj)
    return obj, fobj


def make_eyelet(mat):
    bpy.ops.mesh.primitive_torus_add(major_radius=HOLE[2] + 0.13, minor_radius=0.15,
                                     major_segments=72, minor_segments=24,
                                     location=(HOLE[0], HOLE[1], 0))
    ring = bpy.context.active_object
    ring.name = 'Oeillet'
    ring.scale = (1, 1, 1.05)
    ring.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return ring


def make_string(points, mat, name, depth=0.05):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = depth
    curve.bevel_resolution = 6
    curve.use_fill_caps = True
    sp = curve.splines.new('NURBS')
    sp.points.add(len(points) - 1)
    for k, p in enumerate(points):
        sp.points[k].co = (*p, 1)
    sp.order_u = 4
    sp.use_endpoint_u = True
    sp.use_smooth = True
    obj = bpy.data.objects.new(name, curve)
    obj.data.materials.append(mat)
    bpy.context.collection.objects.link(obj)
    return obj


# ─────────────────────────────────────────────────────────────── scène


def build():
    scene = bpy.context.scene
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)

    pink, white, metal, cotton = material_pink(), material_print(), material_metal(), material_cotton()

    spin = bpy.data.objects.new('Rotation', None)  # tourne autour de la ficelle (axe vertical)
    pivot = bpy.data.objects.new('Etiquette debout', None)
    scene.collection.objects.link(spin)
    scene.collection.objects.link(pivot)
    pivot.parent = spin
    pivot.rotation_euler = (math.radians(90), 0, 0)  # le plan de l'étiquette devient vertical

    parts = [make_tag(pink)]
    # Devant : l'annonce, le prix cassé, la ligne détachable.
    parts.append(make_text('VENTE FLASH', 'Manrope-800.ttf', 0.5, 1.75, white, FRONT_Z, spacing=1.18))
    parts.append(make_text('−59 %', 'BigShouldersDisplay-900.ttf', 3.6, -0.55, white, FRONT_Z,
                           extrude=0.045, max_width=4.7))
    parts.append(make_dash_line(-2.85, white, FRONT_Z))
    parts.append(make_text('POUR UN TEMPS LIMITÉ', 'Manrope-800.ttf', 0.34, -3.55, white, FRONT_Z, spacing=1.12))
    # Dos : le code de retrait.
    parts.append(make_text('CODE DE RETRAIT', 'Manrope-800.ttf', 0.4, 1.85, white, FRONT_Z, back=True, spacing=1.12))
    qr, qr_frame = make_qr(INK_MAT(), FRONT_Z)
    parts += [qr, qr_frame]
    parts.append(make_text('4 8 2   9 1 3', 'BigShouldersDisplay-800.ttf', 0.62, -3.35, white, FRONT_Z, back=True))
    parts.append(make_eyelet(metal))
    # La boucle de ficelle : elle passe par l'œillet et enserre le haut de l'étiquette.
    hx, hy = HOLE[0], HOLE[1]
    loop = [
        (hx, hy - 0.05, 0.0), (hx, hy + 0.15, 0.32), (hx, hy + 0.85, 0.42), (hx, hy + 1.55, 0.2),
        (hx, hy + 1.72, 0.0), (hx, hy + 1.55, -0.2), (hx, hy + 0.85, -0.42), (hx, hy + 0.15, -0.32),
        (hx, hy - 0.05, 0.0),
    ]
    parts.append(make_string(loop, cotton, 'Boucle', depth=0.055))
    for p in parts:
        p.parent = pivot

    # Le brin qui monte, dans l'axe de rotation (il ne bouge pas quand l'étiquette tourne).
    top = hy + 1.72
    rise = [(0, 0, top + k * 2.2) for k in range(7)]
    strand = make_string(rise, cotton, 'Ficelle', depth=0.05)
    strand.parent = spin
    strand.rotation_euler = (0, 0, 0)
    return spin


_INK = {}


def INK_MAT():
    if 'mat' not in _INK:
        mat, _ = principled('Encre', **{'Base Color': INK, 'Roughness': 0.6})
        _INK['mat'] = mat
    return _INK['mat']


def lights_and_camera(scene):
    world = bpy.data.worlds.new('Coucher de soleil')
    scene.world = world
    if bpy.app.version < (5, 0, 0):
        world.use_nodes = True
    nt = world.node_tree
    bg = nt.nodes.get('Background')
    env = nt.nodes.new('ShaderNodeTexEnvironment')
    blender_dir = os.path.dirname(bpy.app.binary_path)
    version = f'{bpy.app.version[0]}.{bpy.app.version[1]}'
    env.image = bpy.data.images.load(
        os.path.join(blender_dir, version, 'datafiles', 'studiolights', 'world', 'sunset.exr'))
    mapping = nt.nodes.new('ShaderNodeMapping')
    coord = nt.nodes.new('ShaderNodeTexCoord')
    mapping.inputs['Rotation'].default_value = (0, 0, math.radians(200))
    nt.links.new(coord.outputs['Generated'], mapping.inputs['Vector'])
    nt.links.new(mapping.outputs['Vector'], env.inputs['Vector'])
    nt.links.new(env.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = 0.35

    def area(name, color, energy, size, loc, target=(0, 0, 0)):
        data = bpy.data.lights.new(name, 'AREA')
        data.color = color[:3]
        data.energy = energy
        data.size = size
        obj = bpy.data.objects.new(name, data)
        scene.collection.objects.link(obj)
        obj.location = loc
        direction = [target[i] - loc[i] for i in range(3)]
        obj.rotation_euler = vec_to_euler(direction)
        return obj

    # Clé : le soleil bas de fin de journée, chaud, en haut à gauche.
    area('Soleil couchant', lin('#FFC9A3'), 14000, 7, (-24, -9, 9))
    # Contre-jour bleu de la charte, en arrière à droite : il découpe la tranche de l'étiquette.
    area('Contre-jour bleu', lin('#00B2FF'), 26000, 5, (16, 11, 6))
    # Débouchage doux, face caméra, un peu rose (le rebond de la couleur sur l'air ambiant).
    area('Debouchage', lin('#FFE3EE'), 2600, 16, (8, -30, -2))

    cam_data = bpy.data.cameras.new('Camera')
    cam_data.lens = 70
    cam_data.sensor_fit = 'VERTICAL'
    cam = bpy.data.objects.new('Camera', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    return cam


def vec_to_euler(direction):
    from mathutils import Vector

    return Vector(direction).to_track_quat('-Z', 'Y').to_euler()


def aim(cam, loc, target):
    cam.location = loc
    cam.rotation_euler = vec_to_euler([target[i] - loc[i] for i in range(3)])


def setup_render(scene, samples, w, h):
    scene.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    device = 'CPU'
    for kind in ('OPTIX', 'CUDA'):
        try:
            prefs.compute_device_type = kind
            prefs.get_devices()
            gpus = [d for d in prefs.devices if d.type == kind]
            if gpus:
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
    scene.render.film_transparent = True
    scene.render.resolution_x = w
    scene.render.resolution_y = h
    scene.render.resolution_percentage = 100
    # « Standard » plutôt qu'AgX : AgX délave les couleurs saturées, et ce rose est la marque.
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0.0
    print('Rendu :', device, prefs.compute_device_type, samples, 'échantillons')


def save(scene, path_no_ext, png):
    img = bpy.data.images['Render Result']
    s = scene.render.image_settings
    s.file_format = 'WEBP'
    s.color_mode = 'RGBA'
    s.quality = 86
    img.save_render(path_no_ext + '.webp', scene=scene)
    if png:
        s.file_format = 'PNG'
        s.color_mode = 'RGBA'
        img.save_render(path_no_ext + '.png', scene=scene)
    print('Écrit :', path_no_ext)


# Le cadrage, commun à toutes les vues : l'étiquette entière, la ficelle qui file vers le haut.
CAM = (2.0, -46, 3.4)
TARGET = (0, 0, 1.7)
FRONT = -36  # trois quarts : on voit la tranche, donc l'épaisseur


def main():
    o = args()
    os.makedirs(o['out'], exist_ok=True)
    scene = bpy.context.scene
    spin = build()
    cam = lights_and_camera(scene)

    if o['shot'] == 'hero':
        setup_render(scene, o['samples'], 1000, 1500)
        spin.rotation_euler = (0, 0, math.radians(FRONT))
        aim(cam, CAM, TARGET)
        bpy.ops.render.render()
        save(scene, os.path.join(o['out'], 'etiquette'), o['png'])
    elif o['shot'] == 'back':
        setup_render(scene, o['samples'], 1000, 1500)
        spin.rotation_euler = (0, 0, math.radians(FRONT + 180))
        aim(cam, CAM, TARGET)
        bpy.ops.render.render()
        save(scene, os.path.join(o['out'], 'etiquette-dos'), o['png'])
    elif o['shot'] == 'spin':
        # De face (−24°) au dos (156°) : ce que l'étiquette montre pendant « Comment ça marche ».
        setup_render(scene, o['samples'], 640, 960)
        aim(cam, CAM, TARGET)
        n = o['frames']
        for k in range(n):
            t = k / (n - 1)
            ease = 0.5 - 0.5 * math.cos(math.pi * t)
            spin.rotation_euler = (0, 0, math.radians(FRONT + 180 * ease))
            bpy.ops.render.render()
            os.makedirs(os.path.join(o['out'], 'tour'), exist_ok=True)
            save(scene, os.path.join(o['out'], 'tour', f'{k:02d}'), o['png'] and k in (0, n // 2, n - 1))
    if o['blend']:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'etiquette.blend'))


main()
