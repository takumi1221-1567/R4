"""
build_kyuroku.py  — KYUROKU.ainas  Rockman X DiVE スタイル
Blender 5.x headless 実行用

使い方:
  /Applications/Blender.app/Contents/MacOS/Blender \
      --background --python /Users/matsumuratakumi/R4/blender/build_kyuroku.py

出力: /Users/matsumuratakumi/R4/public/models/kyuroku.glb
"""

import bpy, math
from mathutils import Vector, Euler

OUT_PATH = "/Users/matsumuratakumi/R4/public/models/kyuroku.glb"

# ──────────────────────────────────────────────────────────────────────
# シーンクリア
# ──────────────────────────────────────────────────────────────────────
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
for col in list(bpy.data.collections):
    bpy.data.collections.remove(col)

# ──────────────────────────────────────────────────────────────────────
# マテリアル（キャストオフ形態 / Rockman X DiVE 色）
# ──────────────────────────────────────────────────────────────────────
def srgb(h):
    """#RRGGBB → Blender linear RGBA"""
    r = int(h[0:2],16)/255; g = int(h[2:4],16)/255; b = int(h[4:6],16)/255
    return (r**2.2, g**2.2, b**2.2, 1.0)

def mat(name, col_hex, metal=0.0, rough=0.5, emit_hex=None, emit_s=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    n = m.node_tree.nodes; n.clear()
    lk = m.node_tree.links
    B = n.new('ShaderNodeBsdfPrincipled')
    O = n.new('ShaderNodeOutputMaterial')
    lk.new(B.outputs['BSDF'], O.inputs['Surface'])
    B.inputs['Base Color'].default_value  = srgb(col_hex)
    B.inputs['Metallic'].default_value    = metal
    B.inputs['Roughness'].default_value   = rough
    if emit_hex:
        B.inputs['Emission Color'].default_value    = srgb(emit_hex)
        B.inputs['Emission Strength'].default_value = emit_s
    return m

MT = {
    'suit' : mat('Suit',  '0c1828', 0.10, 0.78),
    'armor': mat('Armor', '1e4e96', 0.75, 0.25),
    'trim' : mat('Trim',  'c8a030', 0.95, 0.12),
    'visor': mat('Visor', '88ccff', 0.10, 0.05, '4488ff', 2.5),
    'skin' : mat('Skin',  'eec080', 0.00, 0.82),
    'hair' : mat('Hair',  '18102a', 0.05, 0.78),
    'eye'  : mat('Eye',   '44aaff', 0.10, 0.05, '2288ff', 5.0),
    'embA' : mat('EmbA',  'dd2222', 0.45, 0.18, 'dd2222', 3.5),
    'embB' : mat('EmbB',  '2244cc', 0.45, 0.18, '2244cc', 3.5),
    'dark' : mat('Dark',  '060608', 0.05, 0.85),
}

# ──────────────────────────────────────────────────────────────────────
# ヘルパー
# ──────────────────────────────────────────────────────────────────────
def deselect():
    bpy.ops.object.select_all(action='DESELECT')

def ao():
    return bpy.context.active_object

def assign(obj, mat_key):
    obj.data.materials.clear()
    obj.data.materials.append(MT[mat_key])

def smooth(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.shade_smooth()

def apply_all(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

def sphere(name, mk, r, loc, sc=(1,1,1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=r, location=loc)
    o = ao(); o.name = name; o.scale = sc
    apply_all(o); smooth(o); assign(o, mk); return o

def cyl(name, mk, r, h, loc, sc=(1,1,1), rot=(0,0,0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=r, depth=h, location=loc)
    o = ao(); o.name = name; o.scale = sc; o.rotation_euler = rot
    apply_all(o); smooth(o); assign(o, mk); return o

def cone(name, mk, r, h, loc, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=r, radius2=0, depth=h, location=loc)
    o = ao(); o.name = name; o.rotation_euler = rot
    apply_all(o); assign(o, mk); return o

def cube(name, mk, sc, loc, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    o = ao(); o.name = name; o.scale = sc; o.rotation_euler = rot
    apply_all(o); smooth(o); assign(o, mk); return o

def torus(name, mk, R, r, loc, rot=(0,0,0)):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=R, minor_radius=r,
        major_segments=40, minor_segments=10, location=loc)
    o = ao(); o.name = name; o.rotation_euler = rot
    apply_all(o); smooth(o); assign(o, mk); return o

def empty(name, loc):
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=loc)
    o = ao(); o.name = name; return o

def parent(child, par):
    child.parent = par
    child.matrix_parent_inverse = par.matrix_world.inverted()

# ──────────────────────────────────────────────────────────────────────
# 寸法定数（Blender座標: Z=上, Y=奥, X=右）
# キャラクター全高 ≈ 1.88 (足裏Z=0 〜 クレスト先端Z=1.88)
# ──────────────────────────────────────────────────────────────────────
# 関節高さ（Z）
zFloor  = 0.00
zAnkle  = 0.19
zKnee   = 0.50
zHip    = 0.84
zWaist  = 0.92
zChest  = 1.18
zShldr  = 1.32   # 肩関節
zNeck   = 1.42
zHead   = 1.58   # 頭中心
zBand   = 1.44   # ヘルメットバンド
zEye    = 1.60
zCrest  = 1.78   # クレスト基部

# 横幅定数
xShldr  = 0.22   # 肩関節 X
xHip    = 0.11   # 股関節 X

# ──────────────────────────────────────────────────────────────────────
# ルート Empty（キャラクター全体の親）
# ──────────────────────────────────────────────────────────────────────
root = empty('CharRoot', (0, 0, 0))

# ──────────────────────────────────────────────────────────────────────
# 頭部
# ──────────────────────────────────────────────────────────────────────
headE = empty('Head', (0, 0, zHead))
parent(headE, root)

# ヘルメット（球体ベース）
helm = sphere('Helm', 'armor', 0.175, (0, 0, zHead), sc=(1.0, 0.92, 1.10))
parent(helm, headE)

# ヘルメット後部補強
helmBack = cube('HelmBack', 'armor', (0.26, 0.05, 0.09), (0, -0.168, zHead+0.04))
parent(helmBack, headE)

# ゴールドトリムバンド
band = torus('HelmBand', 'trim', 0.170, 0.016, (0, 0, zBand), rot=(math.pi/2, 0, 0))
parent(band, headE)

# ──── クレスト（中央 縦フィン）────
crestBase = cube('CrestBase', 'trim', (0.048, 0.038, 0.205), (0, 0.008, zCrest))
parent(crestBase, headE)
crestTip = cone('CrestTip', 'trim', 0.026, 0.055, (0, 0.008, zCrest + 0.13))
parent(crestTip, headE)

# ──── 上部フィン（左右 × 斜め上）────
for sx in [-1, 1]:
    finU = cube(f'FinUp{"L" if sx<0 else "R"}', 'armor',
                (0.045, 0.050, 0.180),
                (sx*0.158, 0.010, zCrest - 0.01))
    finU.rotation_euler = (0.10, 0, sx * 0.32)
    apply_all(finU)
    parent(finU, headE)

    finUT = cube(f'FinUpTrim{"L" if sx<0 else "R"}', 'trim',
                 (0.016, 0.030, 0.130),
                 (sx*0.162, 0.018, zCrest - 0.01))
    finUT.rotation_euler = (0.10, 0, sx * 0.32)
    apply_all(finUT)
    parent(finUT, headE)

    # ──── サイドフィン（後ろ向き）────
    finS = cube(f'FinSide{"L" if sx<0 else "R"}', 'armor',
                (0.036, 0.165, 0.110),
                (sx*0.205, -0.045, zHead + 0.06))
    finS.rotation_euler = (0, sx * -0.20, sx * 0.12)
    apply_all(finS)
    parent(finS, headE)

# ──── フェイスプレート（肌色）────
face = cyl('Face', 'skin', 0.106, 0.035, (0, 0.165, zEye - 0.02),
           sc=(1.0, 1.0, 1.28), rot=(math.pi/2, 0, 0))
parent(face, headE)

# ──── 目（左右）────
for sx in [-1, 1]:
    eye = sphere(f'Eye{"L" if sx<0 else "R"}', 'eye', 0.022,
                 (sx*0.050, 0.183, zEye), sc=(1.35, 1.0, 1.0))
    parent(eye, headE)

# ──── バイザーバー ────
visor = cube('VisorBar', 'visor', (0.145, 0.018, 0.048), (0, 0.180, zEye + 0.02))
parent(visor, headE)

# ──── 口 ────
mouth = cube('Mouth', 'dark', (0.044, 0.012, 0.010), (0, 0.182, zEye - 0.054))
parent(mouth, headE)

# ──── 髪 ────
hairB = cube('HairBack', 'hair', (0.250, 0.095, 0.100), (0, -0.162, zHead - 0.05))
parent(hairB, headE)
for sx in [-1, 1]:
    hairS = cube(f'HairSide{"L" if sx<0 else "R"}', 'hair',
                 (0.052, 0.080, 0.048), (sx*0.170, 0.050, zHead - 0.065))
    parent(hairS, headE)

# ──────────────────────────────────────────────────────────────────────
# 首
# ──────────────────────────────────────────────────────────────────────
neck = cyl('Neck', 'suit', 0.062, 0.09, (0, 0, zNeck + 0.045),
           sc=(1.0, 0.88, 1.0))
parent(neck, root)

# ──────────────────────────────────────────────────────────────────────
# カラー（金えり）
# ──────────────────────────────────────────────────────────────────────
for sx in [-1, 1]:
    col = cube(f'Collar{"L" if sx<0 else "R"}', 'trim',
               (0.115, 0.058, 0.068), (sx*0.082, 0.052, zNeck))
    col.rotation_euler = (0, 0, -sx * 0.28)
    apply_all(col)
    parent(col, root)

# ──────────────────────────────────────────────────────────────────────
# 胴体
# ──────────────────────────────────────────────────────────────────────
torsoE = empty('Spine', (0, 0, zWaist))
parent(torsoE, root)

# 胴体メッシュ（腰〜胸）
torsoH = zChest - zWaist + 0.05
torso = cyl('Torso', 'suit', 0.158, torsoH,
            (0, 0, zWaist + torsoH/2 - 0.02),
            sc=(1.15, 0.88, 1.0))
parent(torso, torsoE)

# 腰ブロック
waist = cyl('Pelvis', 'suit', 0.150, 0.10, (0, 0, zHip + 0.02), sc=(1.12, 0.88, 1.0))
parent(waist, torsoE)

# ベルト
belt = cube('Belt', 'trim', (0.325, 0.060, 0.185), (0, 0, zWaist - 0.02))
parent(belt, torsoE)

# チェストプレート
cpH = 0.185; cpZ = zChest - 0.02
cp = cube('ChestPlate', 'armor', (0.272, 0.058, cpH), (0, 0.082, cpZ))
parent(cp, torsoE)

# エンブレムリング
embR = torus('EmblemRing', 'trim', 0.060, 0.013, (0, 0.130, zChest - 0.05),
             rot=(math.pi/2, 0, 0))
parent(embR, torsoE)

# エンブレム（赤・青 半球）
for sx, mk in [(-1, 'embA'), (1, 'embB')]:
    em = sphere(f'Emb{"A" if sx<0 else "B"}', mk, 0.038,
                (sx*0.019, 0.134, zChest - 0.05), sc=(1.0, 0.5, 1.0))
    if sx > 0:
        em.rotation_euler = (0, math.pi, 0)
        apply_all(em)
    parent(em, torsoE)

# ──────────────────────────────────────────────────────────────────────
# 腕（左右対称）
# ──────────────────────────────────────────────────────────────────────
def build_arm(side):
    sx = -1 if side == 'L' else 1

    # 肩アーマー
    sp = cube(f'ShldrPad{side}', 'armor', (0.096, 0.115, 0.082),
              (sx * xShldr, 0.005, zShldr))
    parent(sp, root)
    spTop = cube(f'ShldrTop{side}', 'armor', (0.082, 0.095, 0.058),
                 (sx * xShldr, 0.002, zShldr + 0.068))
    parent(spTop, root)

    # 上腕 Empty（肩関節 pivot）
    uaE = empty(f'UpperArm{side}', (sx * xShldr, 0, zShldr - 0.02))
    parent(uaE, root)

    # 上腕メッシュ
    uaLen = 0.27
    ua = cyl(f'UpperArmMesh{side}', 'suit', 0.058, uaLen,
             (0, 0, -uaLen/2), sc=(1.0, 0.90, 1.0))
    parent(ua, uaE)

    # 肘 Empty（肘関節 pivot）
    laE = empty(f'LowerArm{side}', (0, 0, -uaLen))
    parent(laE, uaE)

    # カフアーマー
    cuff = cyl(f'Cuff{side}', 'armor', 0.068, 0.065, (0, 0, -0.015))
    parent(cuff, laE)

    # 前腕メッシュ
    laLen = 0.22
    la = cyl(f'LowerArmMesh{side}', 'suit', 0.052, laLen,
             (0, 0, -laLen/2 - 0.035), sc=(1.0, 0.88, 1.0))
    parent(la, laE)

    # 手 Empty（手首 pivot）
    hE = empty(f'Hand{side}', (0, 0, -laLen - 0.04))
    parent(hE, laE)

    # 手メッシュ
    hnd = sphere(f'HandMesh{side}', 'armor', 0.062,
                 (0, 0, -0.04), sc=(1.0, 0.85, 0.88))
    parent(hnd, hE)

build_arm('L')
build_arm('R')

# ──────────────────────────────────────────────────────────────────────
# 脚（左右対称）
# ──────────────────────────────────────────────────────────────────────
def build_leg(side):
    sx = -1 if side == 'L' else 1

    # 大腿 Empty（股関節 pivot）
    thE = empty(f'Thigh{side}', (sx * xHip, 0, zHip - 0.04))
    parent(thE, root)

    # 大腿メッシュ
    thLen = zHip - 0.04 - zKnee
    th = cyl(f'ThighMesh{side}', 'suit', 0.082, thLen,
             (0, 0, -thLen/2), sc=(1.0, 0.88, 1.0))
    parent(th, thE)

    # 膝 Empty（膝関節 pivot）
    shE = empty(f'Shin{side}', (0, 0, -thLen))
    parent(shE, thE)

    # 膝アーマー
    kp = cube(f'KneePad{side}', 'armor', (0.130, 0.105, 0.080),
              (0, 0.044, -0.015))
    parent(kp, shE)

    # 膝アーマー上段
    kpT = cube(f'KneePadTop{side}', 'armor', (0.108, 0.082, 0.055),
               (0, 0.042, 0.062))
    parent(kpT, shE)

    # 下腿メッシュ
    shLen = zKnee - zAnkle - 0.02
    sh = cyl(f'ShinMesh{side}', 'suit', 0.068, shLen,
             (0, 0, -shLen/2 - 0.02), sc=(1.0, 0.88, 1.0))
    parent(sh, shE)

    # 足首 Empty（足首関節 pivot）
    ftE = empty(f'Foot{side}', (0, 0, -(thLen + shLen + 0.02)))
    parent(ftE, thE)

    # ブーツ本体（前方 Z軸方向に張り出し）
    boot = cube(f'Boot{side}', 'armor', (0.165, 0.300, 0.158),
                (0, 0.058, -0.058))
    parent(boot, ftE)

    # つま先強調
    toe = cube(f'BootToe{side}', 'armor', (0.148, 0.058, 0.070),
               (0, 0.188, -0.094))
    parent(toe, ftE)

    # 足首アーマー
    ankA = cube(f'AnkleArmor{side}', 'armor', (0.188, 0.150, 0.065),
                (0, 0.030, 0.025))
    parent(ankA, ftE)

    # ブーツサイドフィン（トリム色）
    for fsx in [-1, 1]:
        fin = cube(f'BootFin{side}{"L" if fsx<0 else "R"}', 'trim',
                   (0.022, 0.075, 0.055), (fsx*0.093, 0.020, 0.012))
        parent(fin, ftE)

build_leg('L')
build_leg('R')

# ──────────────────────────────────────────────────────────────────────
# 全オブジェクトを root の子にする（未親付けを防ぐ）
# ──────────────────────────────────────────────────────────────────────
for obj in bpy.data.objects:
    if obj.name != 'CharRoot' and obj.parent is None and obj.type in ('MESH', 'EMPTY'):
        parent(obj, root)

# ──────────────────────────────────────────────────────────────────────
# GLB エクスポート
# ──────────────────────────────────────────────────────────────────────
bpy.ops.export_scene.gltf(
    filepath        = OUT_PATH,
    export_format   = 'GLB',
    use_selection   = False,
    export_apply    = True,
    export_materials= 'EXPORT',
    export_cameras  = False,
    export_lights   = False,
    export_yup      = True,
)

print(f"\n✅  Exported: {OUT_PATH}\n")
