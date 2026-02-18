"""
animate_bug.py — Mega Man X DiVE bug style モデルにアニメーションを追加
出力: public/models/bug_animated.glb

骨軸の分析結果:
  脊椎/腰/頭     : rotation_euler.x = 前後リーン
  太もも/スネ/足  : rotation_euler.x = 前後スイング
  上腕           : rotation_euler.z = 前後スイング（local Z ≈ 世界上方）
  前腕           : rotation_euler.x = 肘屈曲
  まぶたL        : rotation_euler.y = 正値で閉眼
  まぶたR        : rotation_euler.y = 負値で閉眼
"""
import bpy, math

SRC = '/Users/matsumuratakumi/R4/public/models/megaman_x_dive_mmexe_bug_style.glb'
OUT = '/Users/matsumuratakumi/R4/public/models/bug_animated.glb'
FPS = 30

# ── ボーン名 ──────────────────────────────────────────────────────────
HEAD = 'Bip Head_031'
SP0  = 'Bip Spine_09'
SP1  = 'Bip Spine1_010'
PEL  = 'Bip Pelvis_02'
LTH  = 'Bip L Thigh_03'
RTH  = 'Bip R Thigh_06'
LCA  = 'Bip L Calf_04'
RCA  = 'Bip R Calf_07'
LFT  = 'Bip L Foot_05'
RFT  = 'Bip R Foot_08'
LUA  = 'Bip L UpperArm_012'
RUA  = 'Bip R UpperArm_035'
LFA  = 'Bip L Forearm_013'
RFA  = 'Bip R Forearm_036'
LEY  = 'Bone Eyelid_L_032'
REY  = 'Bone Eyelid_R_033'

ALL_BONES = [HEAD, SP0, SP1, PEL,
             LTH, RTH, LCA, RCA, LFT, RFT,
             LUA, RUA, LFA, RFA, LEY, REY]

# ── シーンクリア＆インポート ──────────────────────────────────────────
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
bpy.ops.import_scene.gltf(filepath=SRC)

arm = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
if not arm:
    raise RuntimeError("Armature not found")

bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='POSE')

# ── ヘルパー ──────────────────────────────────────────────────────────
def kf(name, xyz, frame):
    """ボーンにEuler XYZキーフレームを挿入"""
    pb = arm.pose.bones.get(name)
    if not pb:
        return
    pb.rotation_mode = 'XYZ'
    pb.rotation_euler = xyz
    pb.keyframe_insert(data_path='rotation_euler', frame=frame)

def kf_all_rest(frame):
    """全ボーンをレスト（0,0,0）でキーフレーム"""
    for n in ALL_BONES:
        kf(n, (0, 0, 0), frame)

def new_action(name):
    """新しいActionを作成してアームにバインド"""
    act = bpy.data.actions.new(name=name)
    if arm.animation_data is None:
        arm.animation_data_create()
    arm.animation_data.action = act
    # ポーズをリセット
    for pb in arm.pose.bones:
        pb.rotation_mode = 'XYZ'
        pb.rotation_euler = (0, 0, 0)
    return act

# ════════════════════════════════════════════════════════════════════════
# IDLE  (2秒 = 60フレーム)
# ════════════════════════════════════════════════════════════════════════
new_action('Idle')
F = FPS * 2  # 60

# 開始ポーズ（0フレーム）
kf_all_rest(0)
kf(LUA, (0, 0,  0.12), 0)   # 腕を少し下ろす
kf(RUA, (0, 0, -0.12), 0)
kf(LFA, (0.20, 0, 0), 0)    # 肘わずかに曲げ
kf(RFA, (0.20, 0, 0), 0)

# 中間（30フレーム）: ゆったり揺れ
kf(PEL,  (-0.018, 0,  0.008), 30)
kf(SP1,  (-0.022, 0, -0.010), 30)
kf(HEAD, (-0.015, 0,  0.055), 30)   # 頭を少し傾ける
kf(LUA,  (0,      0,  0.18),  30)
kf(RUA,  (0,      0, -0.18),  30)
kf(LFA,  (0.22,   0,  0),     30)
kf(RFA,  (0.22,   0,  0),     30)

# まばたき（フレーム40〜50）
kf(LEY, (0,  0.00, 0), 38)
kf(REY, (0,  0.00, 0), 38)
kf(LEY, (0,  0.50, 0), 44)   # 閉眼 (L:正値, R:負値)
kf(REY, (0, -0.50, 0), 44)
kf(LEY, (0,  0.00, 0), 50)
kf(REY, (0,  0.00, 0), 50)

# 終了（60フレーム）: 開始と同じ
kf_all_rest(F)
kf(LUA, (0, 0,  0.12), F)
kf(RUA, (0, 0, -0.12), F)
kf(LFA, (0.20, 0, 0), F)
kf(RFA, (0.20, 0, 0), F)

# ════════════════════════════════════════════════════════════════════════
# RUN  (1秒 = 30フレーム)
# ════════════════════════════════════════════════════════════════════════
new_action('Run')
F = FPS * 1  # 30
STEPS = 30

for i in range(STEPS + 1):
    t  = i / STEPS
    ph = t * math.pi * 2
    f  = round(t * F)

    s  = math.sin(ph)
    c  = math.cos(ph)

    # 上半身前傾
    kf(PEL,  (-0.10, 0, 0), f)
    kf(SP0,  (-0.12, 0, 0), f)
    kf(SP1,  (-0.10, 0, 0), f)
    kf(HEAD, (-0.06, 0, 0), f)

    # 脚：左右交互
    kf(LTH, ( s * 0.55, 0, 0), f)
    kf(RTH, (-s * 0.55, 0, 0), f)

    # 膝：後ろ脚のみ曲がる
    kf(LCA, (-max(0, -s) * 0.65, 0, 0), f)
    kf(RCA, (-max(0,  s) * 0.65, 0, 0), f)

    # 足首
    kf(LFT, (-s * 0.15, 0, 0), f)
    kf(RFT, ( s * 0.15, 0, 0), f)

    # 腕：脚と逆位相（z軸スイング）
    kf(LUA, (0, 0, -s * 0.45), f)
    kf(RUA, (0, 0, -s * 0.45), f)

    # 肘：一定角度を保つ
    kf(LFA, (0.65, 0, 0), f)
    kf(RFA, (0.65, 0, 0), f)

# ════════════════════════════════════════════════════════════════════════
# TALK  (0.75秒 = 22フレーム)
# ════════════════════════════════════════════════════════════════════════
new_action('Talk')
F = round(FPS * 0.75)  # 22

kf_all_rest(0)
kf(LUA, (0, 0,  0.12), 0)
kf(RUA, (0, 0, -0.12), 0)

# 頭・体ジェスチャー
kf(SP1,  (-0.06, 0,     0),    5)
kf(HEAD, ( 0.12, 0,     0.06), 5)    # 頭を上下 + 傾け
kf(RUA,  (-0.55, 0,    -0.30), 5)    # 右腕を上げる
kf(RFA,  ( 0.70, 0,     0),    5)    # 右肘を曲げる

kf(SP1,  (-0.06, 0,     0),    11)
kf(HEAD, (-0.10, 0,    -0.04), 11)
kf(RUA,  (-0.55, 0,    -0.30), 11)
kf(RFA,  ( 0.55, 0,     0),    11)

kf(SP1,  (-0.06, 0,     0),    17)
kf(HEAD, ( 0.08, 0,     0.05), 17)
kf(RUA,  (-0.55, 0,    -0.30), 17)
kf(RFA,  ( 0.65, 0,     0),    17)

kf_all_rest(F)
kf(LUA, (0, 0,  0.12), F)
kf(RUA, (0, 0, -0.12), F)

# ════════════════════════════════════════════════════════════════════════
# LISTEN  (1.5秒 = 45フレーム)
# ════════════════════════════════════════════════════════════════════════
new_action('Listen')
F = round(FPS * 1.5)  # 45

kf_all_rest(0)
kf(HEAD, (0,     0, -0.14), 0)   # 頭を傾ける
kf(SP1,  (-0.08, 0,  0),    0)
kf(LUA,  (0,     0,  0.12), 0)
kf(RUA,  (0,     0, -0.12), 0)
kf(LFA,  (0.18,  0,  0),    0)
kf(RFA,  (0.18,  0,  0),    0)

kf(HEAD, (-0.05, 0, -0.12), 22)  # ゆっくり揺れ
kf(SP1,  (-0.06, 0,  0),    22)

kf_all_rest(F)
kf(HEAD, (0,     0, -0.14), F)
kf(SP1,  (-0.08, 0,  0),    F)
kf(LUA,  (0,     0,  0.12), F)
kf(RUA,  (0,     0, -0.12), F)
kf(LFA,  (0.18,  0,  0),    F)
kf(RFA,  (0.18,  0,  0),    F)

# ════════════════════════════════════════════════════════════════════════
# THINK  (1.5秒 = 45フレーム)
# ════════════════════════════════════════════════════════════════════════
new_action('Think')
F = round(FPS * 1.5)  # 45

kf_all_rest(0)
kf(HEAD, ( 0.08, 0, 0.16),  0)   # 考え込む
kf(SP1,  (-0.05, 0, 0),     0)
kf(LUA,  ( 0,    0, 0.12),  0)
kf(RUA,  (-0.80, 0, -0.55), 0)   # 右腕を顎に当てる
kf(RFA,  ( 1.10, 0, 0),     0)
kf(LFA,  ( 0.18, 0, 0),     0)

kf(HEAD, ( 0.10, 0, 0.14), 22)   # ゆっくり揺れ
kf(RFA,  ( 1.00, 0, 0),    22)

kf_all_rest(F)
kf(HEAD, ( 0.08, 0, 0.16),  F)
kf(SP1,  (-0.05, 0, 0),     F)
kf(LUA,  ( 0,    0, 0.12),  F)
kf(RUA,  (-0.80, 0, -0.55), F)
kf(RFA,  ( 1.10, 0, 0),     F)
kf(LFA,  ( 0.18, 0, 0),     F)

# ════════════════════════════════════════════════════════════════════════
# GLBエクスポート（全アクションを NLA にベイクして出力）
# ════════════════════════════════════════════════════════════════════════
bpy.ops.object.mode_set(mode='OBJECT')

# すべてのアクションを NLA トラックに積む
if arm.animation_data is None:
    arm.animation_data_create()
arm.animation_data.action = None   # 現在のアクションをデタッチ

for act in bpy.data.actions:
    track = arm.animation_data.nla_tracks.new()
    track.name = act.name
    strip = track.strips.new(act.name, start=0, action=act)

bpy.ops.export_scene.gltf(
    filepath            = OUT,
    export_format       = 'GLB',
    export_yup          = True,
    export_animations   = True,
    export_nla_strips   = True,
    export_anim_single_armature = True,
    export_force_sampling = True,
    export_draco_mesh_compression_enable = False,
)
print(f"Exported: {OUT}")
