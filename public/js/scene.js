// =====================================================================
// scene.js — R4 KYUROKU.ainas  Three.js 3D Character  v7
// フォームごとにGLBを切り替え
//   通常フォーム → kyuroku.glb  (Blender製, 独自リグ)
//   バグフォーム → megaman_x_dive_mmexe_bug_style.glb  (Biped リグ)
// =====================================================================
'use strict';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ── フォームカラー ───────────────────────────────────────────────────
const FC = {
    castoff: {
        Suit: 0x0c1828, Armor: 0x1e4e96, Trim: 0xc8a030,
        Visor: 0x88ccff, visorEmi: 0x2266bb,
        EmbA: 0xdd2222, EmbB: 0x2244cc,
        Eye: 0x44aaff, eyeEmi: 0x2288ff,
        showFace: true,
        ambient: 0x1a3060, fog: 0x060e1e, embPt: 0xdd2222, eyePt: 0x2288ff,
    },
    caston: {
        Suit: 0x182840, Armor: 0x2a5a9e, Trim: 0x4a8ae0,
        Visor: 0xe8851a, visorEmi: 0xcc5500,
        EmbA: 0x2255bb, EmbB: 0x4488ff,
        Eye: 0xe8851a, eyeEmi: 0xcc5500,
        showFace: false,
        ambient: 0x101840, fog: 0x060e18, embPt: 0x4488ff, eyePt: 0xcc5500,
    },
    aqua: {
        Suit: 0x0a1e38, Armor: 0x38b0cc, Trim: 0xeecc00,
        Visor: 0xaaeeff, visorEmi: 0x44ccee,
        EmbA: 0xdd2222, EmbB: 0x2244aa,
        Eye: 0x66eeff, eyeEmi: 0x33ccee,
        showFace: true,
        ambient: 0x004050, fog: 0x02080c, embPt: 0xdd2222, eyePt: 0x33ccee,
    },
    heat: {
        Suit: 0x180808, Armor: 0xcc2200, Trim: 0xd4a820,
        Visor: 0x88ccff, visorEmi: 0x2266aa,
        EmbA: 0x4488ff, EmbB: 0x2255dd,
        Eye: 0x4499ff, eyeEmi: 0x2266ee,
        showFace: true,
        ambient: 0x401010, fog: 0x120404, embPt: 0x4488ff, eyePt: 0x2266ee,
    },
    marine: {
        Suit: 0x0a1020, Armor: 0xe05020, Trim: 0x20ff40,
        Visor: 0x88ccff, visorEmi: 0x2266aa,
        EmbA: 0xee6600, EmbB: 0xcc4400,
        Eye: 0x20ff40, eyeEmi: 0x10cc30,
        showFace: true,
        ambient: 0x402010, fog: 0x120804, embPt: 0xee6600, eyePt: 0x10cc30,
    },
    sight: {
        Suit: 0x081808, Armor: 0x22aa44, Trim: 0xddeedd,
        Visor: 0xaaffaa, visorEmi: 0x44cc66,
        EmbA: 0xdd2222, EmbB: 0x2244aa,
        Eye: 0x44ff66, eyeEmi: 0x22cc44,
        showFace: true,
        ambient: 0x104010, fog: 0x040c04, embPt: 0xdd2222, eyePt: 0x22cc44,
    },
    bug: {
        Suit: 0x060e22, Armor: 0x0e1e44, Trim: 0x00ddff,
        Visor: 0x00aaff, visorEmi: 0x0088dd,
        EmbA: 0xffcc00, EmbB: 0xeeaa00,
        Eye: 0x00ffee, eyeEmi: 0x00ddcc,
        showFace: true,
        ambient: 0x080840, fog: 0x020210, embPt: 0xffcc00, eyePt: 0x00ddcc,
    },
};

// Biped ボーン名 → 抽象関節名 マッピング
const BIPED_MAP = {
    Head:      'Bip Head_031',
    Spine:     'Bip Spine1_010',
    ThighL:    'Bip L Thigh_03',
    ThighR:    'Bip R Thigh_06',
    ShinL:     'Bip L Calf_04',
    ShinR:     'Bip R Calf_07',
    FootL:     'Bip L Foot_05',
    FootR:     'Bip R Foot_08',
    UpperArmL: 'Bip L UpperArm_012',
    UpperArmR: 'Bip R UpperArm_035',
    LowerArmL: 'Bip L Forearm_013',
    LowerArmR: 'Bip R Forearm_036',
    HandL:     'Bip L Hand_014',
    HandR:     'Bip R Hand_037',
};

const KYUROKU_JOINTS = [
    'Head','Spine',
    'UpperArmL','UpperArmR','LowerArmL','LowerArmR','HandL','HandR',
    'ThighL','ThighR','ShinL','ShinR','FootL','FootR',
];

// =====================================================================
class KyurokuScene {
    constructor(canvas) {
        this.canvas     = canvas;
        this.clock      = new THREE.Clock();
        this.state      = 'idle';
        this.form       = 'castoff';
        this.runPhase   = 0;
        this.blinkTimer = 4 + Math.random() * 3;
        this.isBlinking = false;
        this.blinkT     = 0;

        // モデル参照
        this.kyurokuModel = null;
        this.bugModel     = null;
        this.model        = null;   // アクティブモデル

        // ジョイント・マテリアルキャッシュ（フォームで切り替え）
        this.J      = {};   // 抽象関節名 → Object3D
        this.matMap = {};   // マテリアル名 → THREE.Material

        this.kyurokuJ    = {};
        this.kyurokuMats = {};
        this.bugJ        = {};
        this.bugMat      = null;   // bug単一マテリアル
        this.baseY       = { kyuroku: 0, bug: 0 };  // floor Y

        this._initRenderer();
        this._initScene();
        this._loadGLBs();
        this._startLoop();
    }

    // ── レンダラー ─────────────────────────────────────────────────────
    _initRenderer() {
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled   = true;
        this.renderer.shadowMap.type      = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping         = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.15;
        this.renderer.outputColorSpace    = THREE.SRGBColorSpace;
        this._resize();
        window.addEventListener('resize', () => this._resize());
    }
    _resize() {
        const w = this.canvas.offsetWidth  || window.innerWidth;
        const h = this.canvas.offsetHeight || window.innerHeight;
        this.renderer.setSize(w, h);
        if (this.camera) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
    }

    // ── シーン ─────────────────────────────────────────────────────────
    _initScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x060e1e);
        this.scene.fog = new THREE.FogExp2(0x060e1e, 0.12);

        const w = this.canvas.offsetWidth || window.innerWidth;
        const h = this.canvas.offsetHeight || window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(44, w / h, 0.01, 50);
        this.camera.position.set(0, 0.92, 3.6);
        this.camera.lookAt(0, 0.92, 0);

        this.ambientLight = new THREE.AmbientLight(0x1a3060, 1.6);
        this.scene.add(this.ambientLight);

        const sun = new THREE.DirectionalLight(0xffffff, 2.6);
        sun.position.set(1.8, 3.5, 2.5);
        sun.castShadow = true;
        sun.shadow.mapSize.set(512, 512);
        Object.assign(sun.shadow.camera, { left:-2, right:2, top:2, bottom:-2, near:0.5, far:12 });
        this.scene.add(sun);

        const rim = new THREE.DirectionalLight(0x3366ff, 1.6);
        rim.position.set(-2, 2, -2.5);
        this.scene.add(rim);

        const fill = new THREE.DirectionalLight(0x223355, 0.8);
        fill.position.set(0.5, -1, 2);
        this.scene.add(fill);

        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(12, 12),
            new THREE.MeshStandardMaterial({ color: 0x0a1428, roughness: 0.8, metalness: 0.2 })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        this._buildHexWall();

        this.emblemPt = new THREE.PointLight(0xdd2222, 1.1, 2.0);
        this.emblemPt.position.set(0, 1.15, 0.6);
        this.scene.add(this.emblemPt);

        this.eyePt = new THREE.PointLight(0x4488ff, 0.8, 1.0);
        this.eyePt.position.set(0, 1.62, 0.5);
        this.scene.add(this.eyePt);
    }

    _buildHexWall() {
        const geo = new THREE.CylinderGeometry(0.44, 0.44, 0.07, 6);
        const mat = new THREE.MeshStandardMaterial({ color: 0x0e1e3a, roughness: 0.65, metalness: 0.35 });
        const g = new THREE.Group();
        const [cols, rows, dx, dy] = [11, 15, 0.77, 0.666];
        for (let c = 0; c < cols; c++)
            for (let r = 0; r < rows; r++) {
                const m = new THREE.Mesh(geo, mat);
                m.position.set(c * dx - cols * dx * 0.5 + (r % 2 ? dx * 0.5 : 0), r * dy - 0.7, -1.9);
                m.rotation.y = Math.PI / 6;
                g.add(m);
            }
        this.scene.add(g);
    }

    // ================================================================
    // GLB ロード（2モデル並行）
    // ================================================================
    _loadGLBs() {
        const loader = new GLTFLoader();
        this._showLoading(true);
        let count = 0;
        const done = () => {
            if (++count >= 2) {
                this._showLoading(false);
                this.setForm(this.form);   // 初期フォームカラー適用
            }
        };

        loader.load('/models/kyuroku.glb',
            gltf => { this._onKyurokuLoaded(gltf); done(); },
            p    => { if (p.lengthComputable) this._setLoadingText(`${Math.round(p.loaded/p.total*100)}%`); },
            e    => { console.error('kyuroku GLB error:', e); done(); }
        );

        loader.load('/models/megaman_x_dive_mmexe_bug_style.glb',
            gltf => { this._onBugLoaded(gltf); done(); },
            null,
            e    => { console.error('bug GLB error:', e); done(); }
        );
    }

    // ── kyuroku.glb ロード完了 ──────────────────────────────────────
    _onKyurokuLoaded(gltf) {
        const m = gltf.scene;
        m.rotation.y = Math.PI;  // Blender +Y → glTF -Z → 180°補正
        const box = new THREE.Box3().setFromObject(m);
        m.position.y = -box.min.y;
        this.baseY.kyuroku = m.position.y;
        m.traverse(o => { if (o.isMesh) o.castShadow = true; });
        m.visible = (this.form !== 'bug');
        this.scene.add(m);
        this.kyurokuModel = m;

        // マテリアルキャッシュ
        m.traverse(o => {
            if (o.isMesh && o.material) {
                (Array.isArray(o.material) ? o.material : [o.material])
                    .forEach(mat => { if (mat.name) this.kyurokuMats[mat.name] = mat; });
            }
        });

        // 関節キャッシュ
        KYUROKU_JOINTS.forEach(name => {
            const obj = m.getObjectByName(name);
            if (obj) this.kyurokuJ[name] = obj;
            else console.warn(`kyuroku joint not found: ${name}`);
        });

        console.log('kyuroku loaded. Joints:', Object.keys(this.kyurokuJ));
    }

    // ── bug GLB ロード完了 ──────────────────────────────────────────
    _onBugLoaded(gltf) {
        const m = gltf.scene;

        // スケールを kyuroku の高さ（1.88）に合わせる
        const box0 = new THREE.Box3().setFromObject(m);
        const sz = new THREE.Vector3(); box0.getSize(sz);
        if (sz.y > 0) m.scale.setScalar(1.88 / sz.y);

        const box1 = new THREE.Box3().setFromObject(m);
        m.position.y = -box1.min.y;
        this.baseY.bug = m.position.y;
        m.traverse(o => { if (o.isMesh) o.castShadow = true; });
        m.visible = (this.form === 'bug');
        this.scene.add(m);
        this.bugModel = m;

        // マテリアル（単一: EXE_Dark）
        m.traverse(o => {
            if (o.isMesh && o.material && !this.bugMat) {
                this.bugMat = Array.isArray(o.material) ? o.material[0] : o.material;
            }
        });

        // 関節キャッシュ（Biped名 → 抽象名）
        Object.entries(BIPED_MAP).forEach(([abstract, bipName]) => {
            const obj = m.getObjectByName(bipName);
            if (obj) this.bugJ[abstract] = obj;
            else console.warn(`bug joint not found: ${bipName}`);
        });

        console.log('bug GLB loaded. Joints:', Object.keys(this.bugJ));
    }

    // ================================================================
    // フォーム切り替え
    // ================================================================
    setForm(formKey) {
        this.form = formKey;
        const isBug = formKey === 'bug';
        const c = FC[formKey] ?? FC.castoff;

        // モデル表示切り替え
        if (this.kyurokuModel) this.kyurokuModel.visible = !isBug;
        if (this.bugModel)     this.bugModel.visible = isBug;

        // アクティブ参照の更新
        this.model  = isBug ? this.bugModel  : this.kyurokuModel;
        this.J      = isBug ? this.bugJ      : this.kyurokuJ;
        this.matMap = isBug ? {}             : this.kyurokuMats;

        if (isBug) {
            // バグフォーム: 元テクスチャを活かし、環境色のみ変える
            // （emissive だけ追加してグローを与える）
            if (this.bugMat) {
                this.bugMat.emissive = this.bugMat.emissive ?? new THREE.Color(0);
                this.bugMat.emissiveIntensity = 0.18;
            }
        } else {
            // kyuroku フォーム: マテリアル色を変える
            const MAT_KEYS = ['Suit','Armor','Trim','Visor','Eye','EmbA','EmbB'];
            MAT_KEYS.forEach(k => {
                const mat = this.matMap[k];
                if (mat) mat.color.setHex(c[k]);
            });
            if (this.matMap['Visor']) {
                this.matMap['Visor'].emissive.setHex(c.visorEmi);
                this.matMap['Visor'].emissiveIntensity = 0.8;
            }
            if (this.matMap['Eye']) {
                this.matMap['Eye'].emissive.setHex(c.eyeEmi);
                this.matMap['Eye'].emissiveIntensity = 1.6;
            }
            if (this.matMap['EmbA']) { this.matMap['EmbA'].emissive.setHex(c.EmbA); this.matMap['EmbA'].emissiveIntensity = 1.0; }
            if (this.matMap['EmbB']) { this.matMap['EmbB'].emissive.setHex(c.EmbB); this.matMap['EmbB'].emissiveIntensity = 1.0; }

            ['Face','EyeL','EyeR','Mouth','VisorBar','HairBack','HairSideL','HairSideR'].forEach(n => {
                const o = this.kyurokuModel?.getObjectByName(n);
                if (o) o.visible = c.showFace !== false;
            });
        }

        // 環境（共通）
        this.ambientLight.color.setHex(c.ambient);
        this.scene.fog.color.setHex(c.fog);
        this.scene.background.setHex(c.fog);
        this.emblemPt.color.setHex(c.embPt);
        this.eyePt.color.setHex(c.eyePt);
    }

    setState(state) { this.state = state; }

    // ================================================================
    // アニメーションループ
    // ================================================================
    _startLoop() {
        const loop = () => {
            requestAnimationFrame(loop);
            const dt = Math.min(this.clock.getDelta(), 0.05);
            const t  = this.clock.getElapsedTime();
            if (this.model) {
                this._blink(dt);
                if (this.form !== 'bug') this._emblemPulse(t);
                switch (this.state) {
                    case 'running':   this._animRun(dt, t);  break;
                    case 'talking':   this._animTalk(t);     break;
                    case 'listening': this._animListen(t);   break;
                    case 'thinking':  this._animThink(t);    break;
                    default:          this._animIdle(t);     break;
                }
            }
            this.renderer.render(this.scene, this.camera);
        };
        loop();
    }

    // ── まばたき ─────────────────────────────────────────────────────
    _blink(dt) {
        this.blinkTimer -= dt;
        if (this.blinkTimer <= 0 && !this.isBlinking) {
            this.isBlinking = true; this.blinkT = 0;
            this.blinkTimer = 4 + Math.random() * 3.5;
        }
        if (!this.isBlinking) return;

        this.blinkT += dt * 9;
        const sy = this.blinkT < Math.PI ? Math.max(0.05, 1 - Math.sin(this.blinkT) * 7) : 1;

        if (this.form === 'bug') {
            // Biped eyelid ボーンをスケール
            ['Bone Eyelid_L_032','Bone Eyelid_R_033'].forEach(n => {
                const o = this.bugModel?.getObjectByName(n);
                if (o) o.scale.y = sy;
            });
        } else {
            ['EyeL','EyeR'].forEach(n => {
                const o = this.kyurokuModel?.getObjectByName(n);
                if (o) o.scale.z = sy;
            });
        }

        if (this.blinkT >= Math.PI) {
            this.isBlinking = false;
            if (this.form === 'bug') {
                ['Bone Eyelid_L_032','Bone Eyelid_R_033'].forEach(n => {
                    const o = this.bugModel?.getObjectByName(n);
                    if (o) o.scale.y = 1;
                });
            } else {
                ['EyeL','EyeR'].forEach(n => {
                    const o = this.kyurokuModel?.getObjectByName(n);
                    if (o) o.scale.z = 1;
                });
            }
        }
    }

    // ── エンブレム脈動（kyuroku のみ） ───────────────────────────────
    _emblemPulse(t) {
        const p = 0.85 + Math.sin(t * 2.5) * 0.32;
        ['EmbA','EmbB'].forEach(k => { if (this.matMap[k]) this.matMap[k].emissiveIntensity = p; });
        this.emblemPt.intensity = 0.8 + Math.sin(t * 2.5) * 0.3;
    }

    // ── 関節リセット ─────────────────────────────────────────────────
    _reset() {
        if (!this.model) return;
        const baseY = (this.form === 'bug') ? this.baseY.bug : this.baseY.kyuroku;
        this.model.position.y = baseY;
        // bug モデルは向きを変えない（Sketchfab標準向き）、kyuroku は 180°補正
        this.model.rotation.set(0, this.form === 'bug' ? 0 : Math.PI, 0);
        Object.values(this.J).forEach(j => j.rotation.set(0, 0, 0));
    }

    // ── idle ─────────────────────────────────────────────────────────
    _animIdle(t) {
        this._reset();
        const J = this.J;
        const bob = Math.sin(t * 1.1) * 0.018;
        if (this.model) this.model.position.y += bob;

        if (J.Head)  { J.Head.rotation.y = Math.sin(t * 0.66) * 0.07; J.Head.rotation.z = Math.sin(t * 0.52) * 0.03; }
        if (J.Spine) J.Spine.rotation.x = Math.sin(t * 0.7) * 0.008;

        if (J.UpperArmL) { J.UpperArmL.rotation.z =  0.10; J.UpperArmL.rotation.x = 0.06; }
        if (J.UpperArmR) { J.UpperArmR.rotation.z = -0.10; J.UpperArmR.rotation.x = 0.06; }
        if (J.LowerArmL) J.LowerArmL.rotation.x = 0.12;
        if (J.LowerArmR) J.LowerArmR.rotation.x = 0.12;
    }

    // ── running ──────────────────────────────────────────────────────
    _animRun(dt, t) {
        this._reset();
        const J = this.J;
        this.runPhase += dt * 7.0;
        const ph = this.runPhase;

        const bob = Math.abs(Math.sin(ph)) * 0.055 - 0.022;
        if (this.model) this.model.position.y += bob;

        if (J.Spine) J.Spine.rotation.x = -0.14;
        if (J.Head)  J.Head.rotation.x  =  0.10;

        if (J.ThighL) J.ThighL.rotation.x =  Math.sin(ph) * 0.70;
        if (J.ThighR) J.ThighR.rotation.x = -Math.sin(ph) * 0.70;
        if (J.ShinL)  J.ShinL.rotation.x  =  Math.max(0, -Math.sin(ph)) * 0.85;
        if (J.ShinR)  J.ShinR.rotation.x  =  Math.max(0,  Math.sin(ph)) * 0.85;
        if (J.FootL)  J.FootL.rotation.x  = -0.20 + Math.sin(ph) * 0.20;
        if (J.FootR)  J.FootR.rotation.x  = -0.20 - Math.sin(ph) * 0.20;

        if (J.UpperArmL) { J.UpperArmL.rotation.x = -Math.sin(ph) * 0.60; J.UpperArmL.rotation.z =  0.16; }
        if (J.UpperArmR) { J.UpperArmR.rotation.x =  Math.sin(ph) * 0.60; J.UpperArmR.rotation.z = -0.16; }
        if (J.LowerArmL) J.LowerArmL.rotation.x = 0.45 + Math.max(0,  Math.sin(ph)) * 0.45;
        if (J.LowerArmR) J.LowerArmR.rotation.x = 0.45 + Math.max(0, -Math.sin(ph)) * 0.45;
    }

    // ── talking ───────────────────────────────────────────────────────
    _animTalk(t) {
        this._reset();
        const J = this.J;
        if (this.model) this.model.position.y += Math.sin(t * 4.2) * 0.012;
        if (J.Head)  { J.Head.rotation.x = Math.sin(t * 4.2) * 0.13; J.Head.rotation.y = Math.sin(t * 2.6) * 0.09; }
        if (J.Spine) J.Spine.rotation.x = -0.06;
        if (J.UpperArmR) { J.UpperArmR.rotation.x = -0.58 + Math.sin(t * 4.2) * 0.16; J.UpperArmR.rotation.z = -0.32; }
        if (J.LowerArmR) J.LowerArmR.rotation.x = 0.70 + Math.sin(t * 4.2) * 0.14;
        if (J.UpperArmL) { J.UpperArmL.rotation.z = 0.14; J.UpperArmL.rotation.x = 0.05; }
        if (J.LowerArmL) J.LowerArmL.rotation.x = 0.15;
    }

    // ── listening ────────────────────────────────────────────────────
    _animListen(t) {
        this._reset();
        const J = this.J;
        if (this.model) this.model.position.y += Math.sin(t * 0.9) * 0.010;
        if (J.Spine) J.Spine.rotation.x = -0.09;
        if (J.Head)  { J.Head.rotation.z = 0.145; J.Head.rotation.x = -0.07; J.Head.rotation.y = Math.sin(t * 0.48) * 0.04; }
        if (J.UpperArmL) { J.UpperArmL.rotation.z =  0.14; J.UpperArmL.rotation.x = 0.04; }
        if (J.UpperArmR) { J.UpperArmR.rotation.z = -0.14; J.UpperArmR.rotation.x = 0.04; }
        if (J.LowerArmL) J.LowerArmL.rotation.x = 0.12;
        if (J.LowerArmR) J.LowerArmR.rotation.x = 0.12;
    }

    // ── thinking ──────────────────────────────────────────────────────
    _animThink(t) {
        this._reset();
        const J = this.J;
        if (this.model) this.model.position.y += Math.sin(t * 0.8) * 0.010;
        if (J.Head)  { J.Head.rotation.z = -0.16; J.Head.rotation.x = 0.09; J.Head.rotation.y = Math.sin(t * 0.55) * 0.05; }
        if (J.Spine) J.Spine.rotation.x = -0.05;
        if (J.UpperArmR) { J.UpperArmR.rotation.x = -0.82; J.UpperArmR.rotation.z = -0.58; }
        if (J.LowerArmR) J.LowerArmR.rotation.x = 1.12;
        if (J.UpperArmL) { J.UpperArmL.rotation.z = 0.14; J.UpperArmL.rotation.x = 0.06; }
        if (J.LowerArmL) J.LowerArmL.rotation.x = 0.18;
    }

    // ── ローディングUI ────────────────────────────────────────────────
    _showLoading(show) {
        let el = document.getElementById('glb-loading');
        if (show && !el) {
            el = document.createElement('div');
            el.id = 'glb-loading';
            Object.assign(el.style, { position:'fixed', top:'50%', left:'50%',
                transform:'translate(-50%,-50%)', color:'rgba(255,255,255,0.7)',
                fontSize:'13px', zIndex:'50', pointerEvents:'none' });
            el.textContent = 'Loading...';
            document.body.appendChild(el);
        } else if (!show && el) { el.remove(); }
    }
    _setLoadingText(t) { const el = document.getElementById('glb-loading'); if (el) el.textContent = t; }
}

// ── 初期化 ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('three-canvas');
    if (!canvas) return;
    window.kyurokuScene = new KyurokuScene(canvas);
});
