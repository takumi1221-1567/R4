"""
R4 Project - KYUROKU.ainas Character Generator for Blender
=====================================================================
Reference: ロックマンスタイル / Mega Man X DiVE スタイル
Base Form : キャストオフ (blue bodysuit, gold trim, X-emblem chest)
フォーム  : キャストオン, アクア, ヒート, マリン, サイト, バグ

Usage:
  /Applications/Blender.app/Contents/MacOS/Blender --background --python create_r4_character.py

Output: /tmp/R4_Character.fbx
"""

import bpy
import bmesh
import math
from mathutils import Vector, Matrix, Euler

# ────────────────────────────────────────────────
# 定数 / 比率定義 (Mega Man X DiVE スタイル)
# ────────────────────────────────────────────────
SCALE      = 1.0          # 全体スケール (Unity想定: 1.0 = 1m)
HEAD_H     = 0.28 * SCALE
TORSO_H    = 0.34 * SCALE
PELVIS_H   = 0.14 * SCALE
UPPER_LEG  = 0.32 * SCALE
LOWER_LEG  = 0.30 * SCALE
FOOT_H     = 0.10 * SCALE
UPPER_ARM  = 0.25 * SCALE
LOWER_ARM  = 0.22 * SCALE
HAND_H     = 0.10 * SCALE
SHOULDER_W = 0.22 * SCALE

# ────────────────────────────────────────────────
# カラーパレット (キャストオフ フォーム)
# ────────────────────────────────────────────────
COLORS = {
    "body_blue"    : (0.10, 0.35, 0.75, 1.0),
    "body_dark"    : (0.05, 0.18, 0.45, 1.0),
    "gold_trim"    : (0.85, 0.70, 0.10, 1.0),
    "visor"        : (0.00, 0.80, 1.00, 0.6),
    "emblem_outer" : (0.10, 0.35, 0.75, 1.0),
    "emblem_inner" : (0.80, 0.10, 0.10, 1.0),
    "skin"         : (0.90, 0.75, 0.60, 1.0),
    "white"        : (0.95, 0.95, 0.95, 1.0),
}

# ────────────────────────────────────────────────
# ユーティリティ
# ────────────────────────────────────────────────
def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for m in list(bpy.data.materials):
        bpy.data.materials.remove(m)

def make_material(name, color, metallic=0.2, roughness=0.4, alpha=1.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value   = color
    bsdf.inputs["Metallic"].default_value     = metallic
    bsdf.inputs["Roughness"].default_value    = roughness
    if alpha < 1.0:
        mat.blend_method = 'BLEND'
        bsdf.inputs["Alpha"].default_value = alpha
    return mat

def add_to_collection(obj, col_name):
    col = bpy.data.collections.get(col_name)
    if col is None:
        col = bpy.data.collections.new(col_name)
        bpy.context.scene.collection.children.link(col)
    for c in obj.users_collection:
        c.objects.unlink(obj)
    col.objects.link(obj)

# ────────────────────────────────────────────────
# プリミティブ生成ヘルパー
# ────────────────────────────────────────────────
def add_capsule(name, radius, depth, location, rotation=(0,0,0)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=(0,0,0))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (1.0, 1.0, depth / (2 * radius))
    obj.location = location
    obj.rotation_euler = rotation
    bpy.ops.object.transform_apply(scale=True)
    return obj

def add_box(name, dims, location, rotation=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = dims
    obj.rotation_euler = rotation
    bpy.ops.object.transform_apply(scale=True)
    return obj

def add_cylinder(name, radius, depth, location, rotation=(0,0,0), verts=16):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=verts, radius=radius, depth=depth,
        location=location, rotation=rotation)
    obj = bpy.context.active_object
    obj.name = name
    return obj

def assign_mat(obj, mat_name):
    mat = bpy.data.materials.get(mat_name)
    if mat is None:
        return
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)

# ────────────────────────────────────────────────
# Phase 1 : マテリアル生成
# ────────────────────────────────────────────────
def create_materials():
    make_material("MAT_BodyBlue",   COLORS["body_blue"],   metallic=0.5, roughness=0.3)
    make_material("MAT_BodyDark",   COLORS["body_dark"],   metallic=0.5, roughness=0.3)
    make_material("MAT_GoldTrim",   COLORS["gold_trim"],   metallic=0.9, roughness=0.1)
    make_material("MAT_Visor",      (*COLORS["visor"][:3], 0.6), metallic=0.0, roughness=0.0, alpha=0.6)
    make_material("MAT_EmblemOut",  COLORS["emblem_outer"],metallic=0.6, roughness=0.2)
    make_material("MAT_EmblemIn",   COLORS["emblem_inner"],metallic=0.3, roughness=0.4)
    make_material("MAT_Skin",       COLORS["skin"],        metallic=0.0, roughness=0.8)
    make_material("MAT_White",      COLORS["white"],       metallic=0.1, roughness=0.5)

# ────────────────────────────────────────────────
# Phase 2 : メッシュ生成 (分離メッシュ方式)
# ────────────────────────────────────────────────
def build_head(y_base):
    """ヘルメット付き頭部を生成"""
    z = y_base + HEAD_H * 0.5

    # 頭の本体 (球を少し縦長に)
    head = add_capsule("Head", 0.12, 0.24, (0, 0, z))
    assign_mat(head, "MAT_BodyBlue")

    # バイザー (前面の透明レンズ)
    visor = add_box("Visor", (0.16, 0.04, 0.07), (0, 0.11, z + 0.01))
    assign_mat(visor, "MAT_Visor")

    # ヘルメット クレスト (頂上の突起)
    crest = add_cylinder("HelmCrest", 0.025, 0.18, (0, 0, z + 0.14),
                         rotation=(0, 0.3, 0))
    assign_mat(crest, "MAT_BodyBlue")

    # 左右サイドフィン
    for side, sx in [("L", -0.10), ("R", 0.10)]:
        fin = add_box(f"HelmFin_{side}", (0.04, 0.04, 0.12),
                      (sx, 0.02, z + 0.06))
        assign_mat(fin, "MAT_BodyDark")

    # ゴールドのヘルムライン
    line = add_box("HelmLine", (0.20, 0.02, 0.02), (0, 0.10, z + 0.05))
    assign_mat(line, "MAT_GoldTrim")

    return y_base + HEAD_H

def build_torso(y_base):
    """胴体 (胸板 + 腰) を生成"""
    z_chest  = y_base + TORSO_H * 0.65
    z_pelvis = y_base + PELVIS_H * 0.5

    # 胸板
    chest = add_box("Chest", (0.28, 0.18, TORSO_H), (0, 0, z_chest))
    assign_mat(chest, "MAT_BodyBlue")

    # ゴールド 首周りライン
    collar = add_box("Collar", (0.20, 0.14, 0.03), (0, 0, y_base + TORSO_H - 0.02))
    assign_mat(collar, "MAT_GoldTrim")

    # 胸のエンブレム (X エンブレム)
    emblem_z = y_base + TORSO_H * 0.55
    emb_out = add_cylinder("EmblemOuter", 0.07, 0.03, (0, 0.10, emblem_z))
    assign_mat(emb_out, "MAT_EmblemOut")
    emb_in  = add_cylinder("EmblemInner", 0.035, 0.035, (0, 0.105, emblem_z))
    assign_mat(emb_in, "MAT_EmblemIn")

    # 腰
    pelvis = add_box("Pelvis", (0.24, 0.16, PELVIS_H), (0, 0, z_pelvis))
    assign_mat(pelvis, "MAT_BodyDark")

    # ゴールドベルトライン
    belt = add_box("Belt", (0.24, 0.12, 0.025), (0, 0, z_pelvis + PELVIS_H * 0.3))
    assign_mat(belt, "MAT_GoldTrim")

    return y_base + TORSO_H + PELVIS_H

def build_arm(side, shoulder_z):
    """腕（肩から手首まで）"""
    sx = -SHOULDER_W if side == "L" else SHOULDER_W
    sign = 1 if side == "L" else -1

    # 肩パッド
    sp_z = shoulder_z - 0.04
    spad = add_box(f"ShoulderPad_{side}", (0.10, 0.10, 0.10), (sx * 1.2, 0, sp_z))
    assign_mat(spad, "MAT_BodyBlue")

    # 上腕
    ua_z = shoulder_z - UPPER_ARM * 0.5
    upper_arm = add_capsule(f"UpperArm_{side}", 0.065, UPPER_ARM,
                             (sx * 1.4, 0, ua_z))
    assign_mat(upper_arm, "MAT_BodyBlue")

    # 前腕
    elbow_z = shoulder_z - UPPER_ARM
    la_z    = elbow_z - LOWER_ARM * 0.5
    lower_arm = add_capsule(f"LowerArm_{side}", 0.055, LOWER_ARM,
                             (sx * 1.4, 0, la_z))
    assign_mat(lower_arm, "MAT_BodyBlue")

    # ガントレット
    g_z = elbow_z - LOWER_ARM + 0.03
    gauntlet = add_box(f"Gauntlet_{side}", (0.10, 0.10, 0.08),
                       (sx * 1.4, 0, g_z))
    assign_mat(gauntlet, "MAT_GoldTrim")

    # 手
    hand_z = elbow_z - LOWER_ARM - HAND_H * 0.4
    hand = add_capsule(f"Hand_{side}", 0.05, HAND_H,
                        (sx * 1.4, 0, hand_z))
    assign_mat(hand, "MAT_BodyBlue")

def build_leg(side, hip_z):
    """脚（股関節から足先まで）"""
    sx = -0.10 if side == "L" else 0.10

    # 大腿
    thigh_z = hip_z - UPPER_LEG * 0.5
    thigh = add_capsule(f"Thigh_{side}", 0.075, UPPER_LEG,
                         (sx, 0, thigh_z))
    assign_mat(thigh, "MAT_BodyBlue")

    # 膝アーマー
    knee_z = hip_z - UPPER_LEG + 0.04
    knee = add_box(f"KneePad_{side}", (0.10, 0.06, 0.08), (sx, 0.06, knee_z))
    assign_mat(knee, "MAT_BodyDark")

    # 下腿
    shin_z = hip_z - UPPER_LEG - LOWER_LEG * 0.5
    shin = add_capsule(f"Shin_{side}", 0.065, LOWER_LEG,
                        (sx, 0, shin_z))
    assign_mat(shin, "MAT_BodyBlue")

    # ブーツ
    foot_z = hip_z - UPPER_LEG - LOWER_LEG
    boot = add_box(f"Boot_{side}", (0.12, 0.18, FOOT_H),
                   (sx, 0.03, foot_z - FOOT_H * 0.5))
    assign_mat(boot, "MAT_BodyBlue")
    sole = add_box(f"Sole_{side}", (0.12, 0.18, 0.025),
                   (sx, 0.03, foot_z - FOOT_H))
    assign_mat(sole, "MAT_BodyDark")

def build_character():
    """全パーツを組み立てる"""
    # 地面基準: Z=0 が足元
    total_h = FOOT_H + LOWER_LEG + UPPER_LEG + PELVIS_H + TORSO_H + HEAD_H

    leg_top_z    = FOOT_H + LOWER_LEG + UPPER_LEG
    pelvis_bot_z = leg_top_z
    torso_bot_z  = pelvis_bot_z + PELVIS_H
    shoulder_z   = torso_bot_z + TORSO_H * 0.85
    head_bot_z   = torso_bot_z + TORSO_H + PELVIS_H * 0.1   # ←微調整

    build_head(torso_bot_z + TORSO_H + PELVIS_H - 0.02)
    build_torso(torso_bot_z)
    build_arm("L", shoulder_z)
    build_arm("R", shoulder_z)
    build_leg("L", leg_top_z)
    build_leg("R", leg_top_z)

# ────────────────────────────────────────────────
# Phase 3 : アーマチュア (ボーン + IK/FK)
# ────────────────────────────────────────────────
def build_armature():
    """
    ボーン構造:
      Root
      └─ Hips
         ├─ Spine
         │   ├─ Chest
         │   │   ├─ Neck
         │   │   │   └─ Head
         │   │   ├─ Shoulder_L/R
         │   │   │   └─ UpperArm_L/R
         │   │   │       └─ LowerArm_L/R
         │   │   │           └─ Hand_L/R
         ├─ UpperLeg_L/R
         │   └─ LowerLeg_L/R
         │       └─ Foot_L/R
         │           └─ Toe_L/R
    IK targets : IKTarget_Hand_L/R, IKTarget_Foot_L/R
    Pole targets: IKPole_Elbow_L/R, IKPole_Knee_L/R
    """
    leg_top_z  = FOOT_H + LOWER_LEG + UPPER_LEG
    pelvis_z   = leg_top_z
    torso_z    = pelvis_z + PELVIS_H
    chest_z    = torso_z + TORSO_H * 0.5
    shoulder_z = torso_z + TORSO_H * 0.85
    neck_z     = torso_z + TORSO_H
    head_z     = neck_z + 0.10
    head_top_z = neck_z + HEAD_H

    bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
    arm_obj = bpy.context.active_object
    arm_obj.name = "Armature_R4"
    arm      = arm_obj.data
    arm.name = "Rig_R4"
    arm.display_type = 'OCTAHEDRAL'

    # デフォルトボーンを削除
    bpy.ops.armature.select_all(action='SELECT')
    bpy.ops.armature.delete()

    def add_bone(name, head, tail, parent=None, use_connect=False):
        b = arm.edit_bones.new(name)
        b.head = Vector(head)
        b.tail = Vector(tail)
        b.use_connect = use_connect
        if parent:
            b.parent = arm.edit_bones[parent]
        return b

    # ── ルート / 腰 ──────────────────────
    add_bone("Root",  (0,0,0),          (0,0,0.10))
    add_bone("Hips",  (0,0,pelvis_z),   (0,0,torso_z),    "Root")
    add_bone("Spine", (0,0,torso_z),    (0,0,chest_z),    "Hips", True)
    add_bone("Chest", (0,0,chest_z),    (0,0,shoulder_z), "Spine", True)
    add_bone("Neck",  (0,0,neck_z),     (0,0,head_z),     "Chest")
    add_bone("Head",  (0,0,head_z),     (0,0,head_top_z), "Neck", True)

    # ── 脚 ──────────────────────────────
    for s, sx in [("L",-0.10), ("R",0.10)]:
        add_bone(f"UpperLeg_{s}",  (sx,0,leg_top_z),
                                    (sx,0,leg_top_z-UPPER_LEG), "Hips")
        add_bone(f"LowerLeg_{s}",  (sx,0,leg_top_z-UPPER_LEG),
                                    (sx,0,leg_top_z-UPPER_LEG-LOWER_LEG),
                                    f"UpperLeg_{s}", True)
        add_bone(f"Foot_{s}",      (sx,0,FOOT_H),
                                    (sx,0.15,FOOT_H),
                                    f"LowerLeg_{s}")
        add_bone(f"Toe_{s}",       (sx,0.15,FOOT_H*0.3),
                                    (sx,0.23,FOOT_H*0.3),
                                    f"Foot_{s}", True)

    # ── 腕 ──────────────────────────────
    for s, sx in [("L",-SHOULDER_W*1.2), ("R",SHOULDER_W*1.2)]:
        add_bone(f"Shoulder_{s}",  (sx*0.5,0,shoulder_z),
                                    (sx,0,shoulder_z),      "Chest")
        add_bone(f"UpperArm_{s}",  (sx,0,shoulder_z),
                                    (sx,0,shoulder_z-UPPER_ARM),
                                    f"Shoulder_{s}", True)
        add_bone(f"LowerArm_{s}",  (sx,0,shoulder_z-UPPER_ARM),
                                    (sx,0,shoulder_z-UPPER_ARM-LOWER_ARM),
                                    f"UpperArm_{s}", True)
        add_bone(f"Hand_{s}",      (sx,0,shoulder_z-UPPER_ARM-LOWER_ARM),
                                    (sx,0,shoulder_z-UPPER_ARM-LOWER_ARM-HAND_H),
                                    f"LowerArm_{s}", True)

    # ── IK ターゲットボーン ──────────────
    for s, sx in [("L",-0.10), ("R",0.10)]:
        foot_z_val = leg_top_z-UPPER_LEG-LOWER_LEG
        add_bone(f"IKTarget_Foot_{s}",  (sx,0,foot_z_val+FOOT_H),
                                         (sx,0,foot_z_val+FOOT_H+0.05))
        add_bone(f"IKPole_Knee_{s}",    (sx,-(UPPER_LEG*0.8),
                                          leg_top_z-UPPER_LEG),
                                         (sx,-(UPPER_LEG*0.8+0.05),
                                          leg_top_z-UPPER_LEG))

    for s, sx in [("L",-SHOULDER_W*1.4), ("R",SHOULDER_W*1.4)]:
        hand_z_val = shoulder_z-UPPER_ARM-LOWER_ARM-HAND_H
        add_bone(f"IKTarget_Hand_{s}",  (sx,0,hand_z_val),
                                         (sx,0,hand_z_val-0.05))
        add_bone(f"IKPole_Elbow_{s}",   (sx,-(UPPER_ARM*0.8),
                                          shoulder_z-UPPER_ARM),
                                         (sx,-(UPPER_ARM*0.8+0.05),
                                          shoulder_z-UPPER_ARM))

    bpy.ops.object.mode_set(mode='POSE')

    def add_ik(pose_bone_name, target_name, chain_count, pole_target=None, pole_subtarget=None):
        pb  = arm_obj.pose.bones[pose_bone_name]
        con = pb.constraints.new('IK')
        con.target         = arm_obj
        con.subtarget      = target_name
        con.chain_count    = chain_count
        if pole_target:
            con.pole_target    = arm_obj
            con.pole_subtarget = pole_target
            con.pole_angle     = math.radians(-90)

    # IK制約付与
    add_ik("Foot_L",    "IKTarget_Foot_L",  2, "IKPole_Knee_L")
    add_ik("Foot_R",    "IKTarget_Foot_R",  2, "IKPole_Knee_R")
    add_ik("Hand_L",    "IKTarget_Hand_L",  2, "IKPole_Elbow_L")
    add_ik("Hand_R",    "IKTarget_Hand_R",  2, "IKPole_Elbow_R")

    bpy.ops.object.mode_set(mode='OBJECT')
    return arm_obj

# ────────────────────────────────────────────────
# Phase 4 : 基本アニメーション (NLA / Action)
# ────────────────────────────────────────────────
def create_animations(arm_obj):
    """
    5種類のActionを生成:
      - Idle     : 待機 (軽い上下揺れ)
      - Run      : 走り
      - Turn     : 振り向き
      - Talking  : 話しているポーズ (音声出力中 / TTS再生中)
      - Listening: 聴いているポーズ (音声入力中 / STT録音中)
    """
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode='POSE')

    def set_pose_bone_loc(bone_name, frame, loc):
        pb = arm_obj.pose.bones.get(bone_name)
        if pb is None:
            return
        pb.location = loc
        pb.keyframe_insert("location", frame=frame)

    def set_pose_bone_rot(bone_name, frame, euler_deg):
        pb = arm_obj.pose.bones.get(bone_name)
        if pb is None:
            return
        pb.rotation_mode = 'XYZ'
        pb.rotation_euler = Euler(
            (math.radians(euler_deg[0]),
             math.radians(euler_deg[1]),
             math.radians(euler_deg[2])), 'XYZ')
        pb.keyframe_insert("rotation_euler", frame=frame)

    # ── IDLE ────────────────────────────
    action_idle = bpy.data.actions.new("Idle")
    arm_obj.animation_data_create()
    arm_obj.animation_data.action = action_idle
    for f in [0, 15, 30]:
        offset = 0.02 if f == 15 else 0.0
        set_pose_bone_loc("Hips", f, (0, 0, offset))
    action_idle.use_fake_user = True

    # ── RUN ─────────────────────────────
    action_run = bpy.data.actions.new("Run")
    arm_obj.animation_data.action = action_run
    run_keys = [
        # frame, bone,          rotation XYZ (degrees)
        (0,  "UpperLeg_L",  (-30,  0, 0)),
        (0,  "LowerLeg_L",  ( 20,  0, 0)),
        (0,  "UpperLeg_R",  ( 30,  0, 0)),
        (0,  "LowerLeg_R",  (-10,  0, 0)),
        (0,  "UpperArm_L",  ( 20,  0, 0)),
        (0,  "LowerArm_L",  (-15,  0, 0)),
        (0,  "UpperArm_R",  (-20,  0, 0)),
        (0,  "LowerArm_R",  ( 15,  0, 0)),
        (0,  "Spine",       (-10,  0, 5)),
        (12, "UpperLeg_L",  ( 30,  0, 0)),
        (12, "LowerLeg_L",  (-10,  0, 0)),
        (12, "UpperLeg_R",  (-30,  0, 0)),
        (12, "LowerLeg_R",  ( 20,  0, 0)),
        (12, "UpperArm_L",  (-20,  0, 0)),
        (12, "LowerArm_L",  ( 15,  0, 0)),
        (12, "UpperArm_R",  ( 20,  0, 0)),
        (12, "LowerArm_R",  (-15,  0, 0)),
        (12, "Spine",       (-10,  0,-5)),
        (24, "UpperLeg_L",  (-30,  0, 0)),
        (24, "LowerLeg_L",  ( 20,  0, 0)),
        (24, "UpperLeg_R",  ( 30,  0, 0)),
        (24, "LowerLeg_R",  (-10,  0, 0)),
        (24, "UpperArm_L",  ( 20,  0, 0)),
        (24, "LowerArm_L",  (-15,  0, 0)),
        (24, "UpperArm_R",  (-20,  0, 0)),
        (24, "LowerArm_R",  ( 15,  0, 0)),
        (24, "Spine",       (-10,  0, 5)),
    ]
    for frame, bone, rot in run_keys:
        set_pose_bone_rot(bone, frame, rot)
    action_run.use_fake_user = True

    # ── TURN ────────────────────────────
    action_turn = bpy.data.actions.new("Turn")
    arm_obj.animation_data.action = action_turn
    turn_keys = [
        (0,  "Hips",   (0,  0,   0)),
        (0,  "Chest",  (0,  0,   0)),
        (10, "Hips",   (0,  0, -45)),
        (10, "Chest",  (0,  0, -30)),
        (20, "Hips",   (0,  0, -90)),
        (20, "Chest",  (0,  0, -90)),
        (30, "Hips",   (0,  0,-180)),
        (30, "Chest",  (0,  0,-180)),
    ]
    for frame, bone, rot in turn_keys:
        set_pose_bone_rot(bone, frame, rot)
    action_turn.use_fake_user = True

    # ── TALKING (TTS再生中：しゃべっているポーズ) ────────────────
    # キュロクらしい「ちょっと前のめりで元気よく話す」アクション
    #   - Spine を少し前傾 + 左右に小刻みに揺れる
    #   - 右手(R)を顔の前に上げてジェスチャー
    #   - 左手(L)は腰に当てる
    #   - 頭が小さく頷く (Head の X 軸揺れ)
    #   - 24 fpsループ (0→24)
    action_talk = bpy.data.actions.new("Talking")
    arm_obj.animation_data.action = action_talk
    talk_keys = [
        # ── Spine: 前傾 + 左右揺れ ──
        (0,  "Spine", (-12,  0,  4)),
        (6,  "Spine", (-10,  0,  2)),
        (12, "Spine", (-12,  0, -4)),
        (18, "Spine", (-10,  0, -2)),
        (24, "Spine", (-12,  0,  4)),
        # ── 右腕: 顔の前に上げてジェスチャー ──
        (0,  "UpperArm_R", (-60,  0,  20)),
        (0,  "LowerArm_R", ( 80,  0,   0)),
        (6,  "UpperArm_R", (-55,  0,  15)),
        (6,  "LowerArm_R", ( 70,  0,   0)),
        (12, "UpperArm_R", (-65,  0,  20)),
        (12, "LowerArm_R", ( 85,  0,   0)),
        (18, "UpperArm_R", (-55,  0,  15)),
        (18, "LowerArm_R", ( 70,  0,   0)),
        (24, "UpperArm_R", (-60,  0,  20)),
        (24, "LowerArm_R", ( 80,  0,   0)),
        # ── 左腕: 腰に当てる ──
        (0,  "UpperArm_L", ( 10,  0, -30)),
        (0,  "LowerArm_L", ( 45,  0,   0)),
        (24, "UpperArm_L", ( 10,  0, -30)),
        (24, "LowerArm_L", ( 45,  0,   0)),
        # ── Head: 小さく頷く ──
        (0,  "Head", ( 5,  0,  0)),
        (8,  "Head", (-5,  0,  0)),
        (16, "Head", ( 5,  0,  0)),
        (24, "Head", ( 5,  0,  0)),
    ]
    for frame, bone, rot in talk_keys:
        set_pose_bone_rot(bone, frame, rot)
    action_talk.use_fake_user = True

    # ── LISTENING (STT録音中：耳を傾けるポーズ) ──────────────────
    # キュロクらしい「ちょっと首を傾げて、目を輝かせて聴く」アクション
    #   - 胴体を少し前傾して相手に向ける
    #   - 頭を右に 10° 傾ける + ゆっくり揺れる
    #   - 両腕を少し前に出して「聴いてるよ」姿勢
    #   - Hips に小さな重心移動
    #   - 36 fpsループ (0→36) ゆったり
    action_listen = bpy.data.actions.new("Listening")
    arm_obj.animation_data.action = action_listen
    listen_keys = [
        # ── Spine: 少し前傾・じっとしてる ──
        (0,  "Spine", (-8,  0,  2)),
        (18, "Spine", (-8,  0, -2)),
        (36, "Spine", (-8,  0,  2)),
        # ── Head: 少し右に傾げてゆらゆら ──
        (0,  "Head",  ( 5,  0,  10)),
        (12, "Head",  ( 3,  0,   8)),
        (24, "Head",  ( 5,  0,  12)),
        (36, "Head",  ( 5,  0,  10)),
        # ── 右腕: 自然に前方へ ──
        (0,  "UpperArm_R", (-15,  0,  10)),
        (0,  "LowerArm_R", ( 20,  0,   0)),
        (36, "UpperArm_R", (-15,  0,  10)),
        (36, "LowerArm_R", ( 20,  0,   0)),
        # ── 左腕: 斜め前に軽く伸ばす ──
        (0,  "UpperArm_L", (-10,  0, -10)),
        (0,  "LowerArm_L", ( 15,  0,   0)),
        (36, "UpperArm_L", (-10,  0, -10)),
        (36, "LowerArm_L", ( 15,  0,   0)),
        # ── Hips: ゆっくり重心移動 ──
        (0,  "Hips", ( 0,  0,  0)),
        (18, "Hips", ( 0,  0,  3)),
        (36, "Hips", ( 0,  0,  0)),
    ]
    for frame, bone, rot in listen_keys:
        set_pose_bone_rot(bone, frame, rot)
    action_listen.use_fake_user = True

    bpy.ops.object.mode_set(mode='OBJECT')

# ────────────────────────────────────────────────
# Phase 5 : スキンウェイト (自動)
# ────────────────────────────────────────────────
def auto_weight(arm_obj):
    """全メッシュを Armature に親子付けして自動ウェイトを適用"""
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    for m in meshes:
        m.select_set(True)
    arm_obj.select_set(True)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    bpy.ops.object.select_all(action='DESELECT')

# ────────────────────────────────────────────────
# Phase 6 : FBX エクスポート
# ────────────────────────────────────────────────
def export_fbx(path="/tmp/R4_Character.fbx"):
    bpy.ops.export_scene.fbx(
        filepath          = path,
        use_selection     = False,
        global_scale      = 1.0,
        apply_unit_scale  = True,
        bake_space_transform = True,
        mesh_smooth_type  = 'FACE',
        use_armature_deform_only = True,
        add_leaf_bones    = False,
        primary_bone_axis = 'Y',
        secondary_bone_axis = 'X',
        use_anim          = True,
        anim_step         = 1,
        simplify_fac      = 0.0,
        path_mode         = 'AUTO',
    )
    print(f"[R4] FBX exported → {path}")

# ────────────────────────────────────────────────
# メイン
# ────────────────────────────────────────────────
if __name__ == "__main__":
    print("[R4] Clearing scene...")
    clear_scene()
    print("[R4] Creating materials...")
    create_materials()
    print("[R4] Building character mesh...")
    build_character()
    print("[R4] Building armature (IK/FK rig)...")
    arm_obj = build_armature()
    print("[R4] Creating animations (Idle / Run / Turn)...")
    create_animations(arm_obj)
    print("[R4] Auto-weighting meshes...")
    auto_weight(arm_obj)
    print("[R4] Exporting FBX...")
    export_fbx("/tmp/R4_Character.fbx")
    print("[R4] Done! → /tmp/R4_Character.fbx")
