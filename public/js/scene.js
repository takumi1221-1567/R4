// =====================================================================
// scene.js — R4 KYUROKU.ainas  Three.js 3D Scene  v4
// GLTFLoader でリアルGLBモデルをロード + AnimationMixer
// モデルURL: GLB_URL を差し替えるだけで任意モデルに対応
// window.kyurokuScene.setState(state) / .setForm(formKey) で外部制御
// =====================================================================
'use strict';
import * as THREE  from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ── ロードするGLBモデルのURL ─────────────────────────────────────────
// ここを差し替えるだけで任意のGLBモデルに切り替え可能
const GLB_URL = '/models/RobotExpressive.glb';

// ── アニメーション名マッピング（GLBのアニメーション名 → 状態名） ───
// 使用するGLBのアニメーション名に合わせて変更する
const ANIM_MAP = {
    idle:      'Idle',
    running:   'Running',
    talking:   'Wave',
    listening: 'Yes',
    thinking:  'ThumbsUp',
};

// ── フォーム別環境カラー ─────────────────────────────────────────────
const FORM_ENV = {
    castoff: { ambient: 0x223366, fog: 0x060e1e, emblem: 0xdd2222, eye: 0x2288ff },
    caston:  { ambient: 0x182840, fog: 0x060e18, emblem: 0x4488ff, eye: 0xcc5500 },
    aqua:    { ambient: 0x004050, fog: 0x020e12, emblem: 0xdd2222, eye: 0x33ccee },
    heat:    { ambient: 0x401010, fog: 0x120404, emblem: 0x4488ff, eye: 0x2266ee },
    marine:  { ambient: 0x402010, fog: 0x120a04, emblem: 0xee6600, eye: 0x10cc30 },
    sight:   { ambient: 0x104010, fog: 0x040c04, emblem: 0xdd2222, eye: 0x22cc44 },
    bug:     { ambient: 0x080840, fog: 0x020210, emblem: 0xffcc00, eye: 0x00ddcc },
};

// =====================================================================
class KyurokuScene {

    constructor(canvas) {
        this.canvas   = canvas;
        this.clock    = new THREE.Clock();
        this.state    = 'idle';
        this.form     = 'castoff';
        this.mixer    = null;
        this.clips    = {};   // name → THREE.AnimationClip
        this.current  = null; // 現在再生中の THREE.AnimationAction
        this.model    = null;

        this._initRenderer();
        this._initScene();
        this._loadModel();
        this._startLoop();
    }

    // ── レンダラー ──────────────────────────────────────────────────
    _initRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: false,
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping       = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        this.renderer.outputColorSpace  = THREE.SRGBColorSpace;
        this._resize();
        window.addEventListener('resize', () => this._resize());
    }

    _resize() {
        const w = this.canvas.offsetWidth  || window.innerWidth;
        const h = this.canvas.offsetHeight || window.innerHeight;
        this.renderer.setSize(w, h);
        if (this.camera) {
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
        }
    }

    // ── シーン ──────────────────────────────────────────────────────
    _initScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x060e1e);
        this.scene.fog = new THREE.FogExp2(0x060e1e, 0.14);

        const w = this.canvas.offsetWidth  || window.innerWidth;
        const h = this.canvas.offsetHeight || window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(44, w / h, 0.01, 50);
        this.camera.position.set(0, 1.1, 3.6);
        this.camera.lookAt(0, 0.9, 0);

        // 環境光
        this.ambientLight = new THREE.AmbientLight(0x223366, 1.5);
        this.scene.add(this.ambientLight);

        // メインライト
        const main = new THREE.DirectionalLight(0xffffff, 2.4);
        main.position.set(1.8, 3.5, 2.5);
        main.castShadow = true;
        main.shadow.mapSize.set(512, 512);
        Object.assign(main.shadow.camera, { near: 0.5, far: 12, left: -2, right: 2, top: 2, bottom: -2 });
        this.scene.add(main);

        // リムライト
        const rim = new THREE.DirectionalLight(0x3366ff, 1.4);
        rim.position.set(-2, 2, -2.5);
        this.scene.add(rim);
        this.rimLight = rim;

        // フィルライト
        const fill = new THREE.DirectionalLight(0x223355, 0.8);
        fill.position.set(0.5, -1, 2);
        this.scene.add(fill);

        // フロア
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(12, 12),
            new THREE.MeshStandardMaterial({ color: 0x0a1428, roughness: 0.8, metalness: 0.2 })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // ヘックスタイル壁
        this._buildHexWall();

        // エフェクトライト
        this.emblemLight = new THREE.PointLight(0xff4422, 1.0, 2.0);
        this.emblemLight.position.set(0, 1.2, 0.5);
        this.scene.add(this.emblemLight);

        this.eyeLight = new THREE.PointLight(0x4488ff, 0.6, 1.0);
        this.eyeLight.position.set(0, 1.6, 0.5);
        this.scene.add(this.eyeLight);
    }

    _buildHexWall() {
        const geo = new THREE.CylinderGeometry(0.45, 0.45, 0.07, 6);
        const mat = new THREE.MeshStandardMaterial({ color: 0x0e1e3a, roughness: 0.65, metalness: 0.35 });
        const g   = new THREE.Group();
        const cols = 11, rows = 15, dx = 0.78, dy = 0.675;
        for (let c = 0; c < cols; c++) {
            for (let r = 0; r < rows; r++) {
                const hex = new THREE.Mesh(geo, mat);
                hex.position.set(
                    c * dx - cols * dx * 0.5 + (r % 2 === 0 ? 0 : dx * 0.5),
                    r * dy - 0.8,
                    -1.9
                );
                hex.rotation.y = Math.PI / 6;
                g.add(hex);
            }
        }
        this.scene.add(g);
    }

    // ── GLBモデルのロード ────────────────────────────────────────────
    _loadModel() {
        const loader = new GLTFLoader();

        // ローディング表示
        this._showLoading(true);

        loader.load(
            GLB_URL,
            (gltf) => {
                this._showLoading(false);
                this._onModelLoaded(gltf);
            },
            (progress) => {
                if (progress.lengthComputable) {
                    const pct = Math.round(progress.loaded / progress.total * 100);
                    this._updateLoadingText(`Loading... ${pct}%`);
                }
            },
            (error) => {
                console.error('GLB load error:', error);
                this._showLoading(false);
            }
        );
    }

    _onModelLoaded(gltf) {
        this.model = gltf.scene;

        // モデルのスケール・位置調整
        // バウンディングボックスで自動フィット
        const box    = new THREE.Box3().setFromObject(this.model);
        const size   = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        // 高さを1.8にスケーリング
        const scale = 1.8 / size.y;
        this.model.scale.setScalar(scale);
        this.model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);

        // 影
        this.model.traverse(obj => {
            if (obj.isMesh) {
                obj.castShadow    = true;
                obj.receiveShadow = false;
            }
        });

        this.scene.add(this.model);

        // AnimationMixer セットアップ
        this.mixer = new THREE.AnimationMixer(this.model);

        // クリップを名前でキャッシュ
        gltf.animations.forEach(clip => {
            this.clips[clip.name] = clip;
        });

        console.log('Loaded animations:', Object.keys(this.clips));

        // 初期状態
        this._playAnim('idle');
    }

    // ── アニメーション再生 ────────────────────────────────────────────
    _playAnim(stateName, fadeTime = 0.4) {
        if (!this.mixer) return;

        const animName = ANIM_MAP[stateName];
        const clip     = this.clips[animName];

        if (!clip) {
            // マップに無ければ Idle にフォールバック
            const idleClip = this.clips[ANIM_MAP.idle] || Object.values(this.clips)[0];
            if (!idleClip) return;
            const action = this.mixer.clipAction(idleClip);
            if (this.current && this.current !== action) {
                this.current.fadeOut(fadeTime);
                action.reset().fadeIn(fadeTime).play();
            } else if (!this.current) {
                action.play();
            }
            this.current = action;
            return;
        }

        const action = this.mixer.clipAction(clip);
        if (this.current === action) return;

        if (this.current) this.current.fadeOut(fadeTime);
        action.reset().fadeIn(fadeTime).play();
        this.current = action;
    }

    // ── ローディングUI ────────────────────────────────────────────────
    _showLoading(show) {
        let el = document.getElementById('glb-loading');
        if (show && !el) {
            el = document.createElement('div');
            el.id = 'glb-loading';
            el.style.cssText = [
                'position:fixed', 'top:50%', 'left:50%',
                'transform:translate(-50%,-50%)',
                'color:rgba(255,255,255,0.7)',
                'font-size:14px', 'z-index:50',
                'pointer-events:none',
            ].join(';');
            el.textContent = 'Loading...';
            document.body.appendChild(el);
        } else if (!show && el) {
            el.remove();
        }
    }

    _updateLoadingText(text) {
        const el = document.getElementById('glb-loading');
        if (el) el.textContent = text;
    }

    // ── 外部API: フォーム切り替え ─────────────────────────────────────
    setForm(formKey) {
        this.form = formKey;
        const env = FORM_ENV[formKey] ?? FORM_ENV.castoff;

        this.ambientLight.color.setHex(env.ambient);
        this.scene.fog.color.setHex(env.fog);
        this.scene.background.setHex(env.fog);
        this.emblemLight.color.setHex(env.emblem);
        this.eyeLight.color.setHex(env.eye);
    }

    // ── 外部API: 状態変更 ─────────────────────────────────────────────
    setState(state) {
        if (this.state === state) return;
        this.state = state;
        this._playAnim(state);
    }

    // ── アニメーションループ ──────────────────────────────────────────
    _startLoop() {
        const loop = () => {
            requestAnimationFrame(loop);
            const dt = Math.min(this.clock.getDelta(), 0.05);
            const t  = this.clock.getElapsedTime();

            if (this.mixer) this.mixer.update(dt);

            // エンブレムライト脈動
            this.emblemLight.intensity = 0.8 + Math.sin(t * 2.4) * 0.3;
            this.eyeLight.intensity    = 0.5 + Math.sin(t * 1.8) * 0.2;

            this.renderer.render(this.scene, this.camera);
        };
        loop();
    }
}

// ── グローバル初期化 ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('three-canvas');
    if (!canvas) return;
    window.kyurokuScene = new KyurokuScene(canvas);
});
