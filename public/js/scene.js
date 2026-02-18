// =====================================================================
// scene.js — R4 KYUROKU.ainas  Three.js 3D Character
// =====================================================================
// キャストオフ形態（青スーツ・金トリム・Xエンブレム）をプロシージャルに生成
// 状態: idle / talking / listening / thinking
// window.kyurokuScene.setState(state) で外部から制御
// =====================================================================

import * as THREE from 'three';

// ── カラーパレット（キャストオフ形態） ─────────────────────────────
const C = {
    bodyBlue  : 0x2a7dd4,
    bodyDark  : 0x1a4da8,
    bodyDeep  : 0x0d2e6a,
    gold      : 0xf0c040,
    visor     : 0x020a1c,
    eyeBase   : 0x00aaff,
    eyeEmit   : 0x0088ff,
    emblemOut : 0x2a7dd4,
    emblemRed : 0xcc2222,
    emblemGlow: 0x881111,
    helmCrest : 0x5aadff,
};

class KyurokuScene {
    constructor(canvas) {
        this.canvas    = canvas;
        this.clock     = new THREE.Clock();
        this.state     = 'idle';
        this.stateTime = 0;

        this._initRenderer();
        this._initScene();
        this._initCamera();
        this._initLights();
        this._buildCharacter();
        this._startLoop();

        window.addEventListener('resize', () => this._onResize());
    }

    // ── Renderer ─────────────────────────────────────────────────
    _initRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: false,
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
    }

    // ── Scene ────────────────────────────────────────────────────
    _initScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x060e1e);
        this.scene.fog = new THREE.FogExp2(0x060e1e, 0.08);

        // 六角形タイル背景壁
        this._buildHexBackground();

        // 床（影受け）
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(12, 12),
            new THREE.MeshStandardMaterial({ color: 0x080f22, roughness: 0.9 })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);
    }

    _buildHexBackground() {
        // 六角形を並べた背景パネル
        const hexGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.06, 6);
        const hexMat = new THREE.MeshStandardMaterial({
            color: 0x112244,
            metalness: 0.3,
            roughness: 0.7,
        });

        const wallGroup = new THREE.Group();
        const rows = 7, cols = 9;
        const spacingX = 0.88, spacingY = 0.76;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const hex = new THREE.Mesh(hexGeo, hexMat);
                const x = (c - cols / 2) * spacingX + (r % 2 === 0 ? 0 : spacingX / 2);
                const y = (r - rows / 2) * spacingY + 1.0;
                hex.position.set(x, y, -2.2);
                hex.rotation.x = Math.PI / 2;
                hex.receiveShadow = true;
                wallGroup.add(hex);
            }
        }
        this.scene.add(wallGroup);
        this.hexWall = wallGroup;
    }

    // ── Camera ───────────────────────────────────────────────────
    _initCamera() {
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(48, aspect, 0.1, 50);
        // Portrait: キャラクター全身が見える位置
        this._updateCameraForAspect();
    }

    _updateCameraForAspect() {
        const portrait = window.innerHeight > window.innerWidth;
        if (portrait) {
            this.camera.position.set(0, 1.05, 3.8);
            this.camera.lookAt(0, 0.95, 0);
        } else {
            this.camera.position.set(0, 1.05, 3.2);
            this.camera.lookAt(0, 0.95, 0);
        }
    }

    // ── Lights ───────────────────────────────────────────────────
    _initLights() {
        // 環境光
        const ambient = new THREE.AmbientLight(0x1a3060, 1.2);
        this.scene.add(ambient);

        // メインライト（正面やや上）
        const main = new THREE.DirectionalLight(0xaaccff, 2.2);
        main.position.set(1.5, 3.5, 4.0);
        main.castShadow = true;
        main.shadow.mapSize.set(1024, 1024);
        main.shadow.camera.near = 0.5;
        main.shadow.camera.far  = 15;
        this.scene.add(main);

        // リムライト（背面・青）
        const rim = new THREE.DirectionalLight(0x1a44cc, 1.0);
        rim.position.set(0, 2, -3.5);
        this.scene.add(rim);

        // サイドライト（左）
        const side = new THREE.DirectionalLight(0x3366ff, 0.6);
        side.position.set(-3, 1.5, 1);
        this.scene.add(side);

        // 胸エンブレム ポイントライト
        this.emblemLight = new THREE.PointLight(0xff2222, 1.8, 1.2);
        this.emblemLight.position.set(0, 1.22, 0.45);
        this.scene.add(this.emblemLight);

        // 目 ポイントライト
        this.eyeLight = new THREE.PointLight(0x00aaff, 1.2, 0.8);
        this.eyeLight.position.set(0, 1.58, 0.5);
        this.scene.add(this.eyeLight);
    }

    // ── Character Build ──────────────────────────────────────────
    _buildCharacter() {
        this.char = new THREE.Group();
        this.scene.add(this.char);

        // マテリアル定義
        const M = {
            blue  : new THREE.MeshStandardMaterial({ color: C.bodyBlue, metalness: 0.55, roughness: 0.28 }),
            dark  : new THREE.MeshStandardMaterial({ color: C.bodyDark, metalness: 0.55, roughness: 0.35 }),
            deep  : new THREE.MeshStandardMaterial({ color: C.bodyDeep, metalness: 0.4, roughness: 0.5  }),
            gold  : new THREE.MeshStandardMaterial({ color: C.gold,     metalness: 0.92, roughness: 0.08 }),
            visor : new THREE.MeshStandardMaterial({ color: C.visor,    metalness: 0.2,  roughness: 0.0, transparent: true, opacity: 0.88 }),
            eye   : new THREE.MeshStandardMaterial({ color: C.eyeBase,  emissive: new THREE.Color(C.eyeEmit), emissiveIntensity: 1.6 }),
            embOut: new THREE.MeshStandardMaterial({ color: C.emblemOut,metalness: 0.6,  roughness: 0.2 }),
            embRed: new THREE.MeshStandardMaterial({ color: C.emblemRed,emissive: new THREE.Color(C.emblemGlow), emissiveIntensity: 0.8 }),
            crest : new THREE.MeshStandardMaterial({ color: C.helmCrest,metalness: 0.4,  roughness: 0.3 }),
            sole  : new THREE.MeshStandardMaterial({ color: 0x080f28,   metalness: 0.2,  roughness: 0.8 }),
        };
        this.M = M;

        // ── グループ階層 ──
        this.headGroup  = new THREE.Group();
        this.upperGroup = new THREE.Group();
        this.armLGroup  = new THREE.Group();
        this.armRGroup  = new THREE.Group();
        this.lowerGroup = new THREE.Group();

        this._buildHead(M);
        this._buildTorso(M);
        this._buildLegs(M);

        this.char.add(this.headGroup, this.upperGroup, this.lowerGroup);
        this.char.position.y = 0;

        // 影
        this.char.traverse(o => {
            if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
        });
    }

    _mesh(geo, mat) {
        return new THREE.Mesh(geo, mat);
    }

    _buildHead(M) {
        const g = this.headGroup;
        g.position.y = 1.56;

        // 頭球
        const head = this._mesh(new THREE.SphereGeometry(0.225, 22, 22), M.blue);
        head.scale.y = 1.12;
        g.add(head);

        // ヘルメットクレスト（頂上の突起）
        const crest = this._mesh(new THREE.ConeGeometry(0.058, 0.30, 8), M.crest);
        crest.position.y = 0.29;
        g.add(crest);

        // サイドフィン（左右）
        for (const sx of [-1, 1]) {
            const fin = this._mesh(new THREE.ConeGeometry(0.065, 0.21, 4), M.dark);
            fin.position.set(sx * 0.235, 0.04, 0);
            fin.rotation.z = -sx * Math.PI / 2;
            fin.rotation.x = 0.22;
            g.add(fin);
        }

        // バイザー（暗色レンズ）
        const visor = this._mesh(new THREE.BoxGeometry(0.33, 0.128, 0.055), M.visor);
        visor.position.set(0, 0.02, 0.198);
        g.add(visor);

        // 目（発光）
        const eyeGeo = new THREE.SphereGeometry(0.058, 14, 14);
        this.eyeL = this._mesh(eyeGeo, M.eye.clone());
        this.eyeR = this._mesh(eyeGeo, M.eye.clone());
        this.eyeL.position.set(-0.088, 0.02, 0.198);
        this.eyeR.position.set( 0.088, 0.02, 0.198);
        g.add(this.eyeL, this.eyeR);

        // ゴールドヘルムライン（ベジェチューブ）
        const arc = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(-0.20, 0.12, 0.155),
            new THREE.Vector3(0,     0.24, 0.175),
            new THREE.Vector3( 0.20, 0.12, 0.155)
        );
        const goldLine = this._mesh(new THREE.TubeGeometry(arc, 14, 0.014, 6, false), M.gold);
        g.add(goldLine);
    }

    _buildTorso(M) {
        const g = this.upperGroup;

        // 胸板
        const torso = this._mesh(new THREE.BoxGeometry(0.54, 0.50, 0.27), M.blue);
        torso.position.y = 1.22;
        g.add(torso);

        // ゴールドカラー
        const collar = this._mesh(new THREE.BoxGeometry(0.44, 0.062, 0.23), M.gold);
        collar.position.set(0, 1.465, 0);
        g.add(collar);

        // 胸エンブレム（外リング）
        const embO = this._mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.038, 22), M.embOut);
        embO.rotation.x = Math.PI / 2;
        embO.position.set(0, 1.22, 0.146);
        g.add(embO);

        // 胸エンブレム（赤コア）
        this.emblemCore = this._mesh(new THREE.SphereGeometry(0.062, 18, 18), M.embRed);
        this.emblemCore.position.set(0, 1.22, 0.158);
        g.add(this.emblemCore);

        // 腰
        const pelvis = this._mesh(new THREE.BoxGeometry(0.47, 0.25, 0.23), M.dark);
        pelvis.position.y = 0.82;
        g.add(pelvis);

        // ベルト
        const belt = this._mesh(new THREE.BoxGeometry(0.43, 0.052, 0.19), M.gold);
        belt.position.set(0, 0.905, 0);
        g.add(belt);

        // 肩パッド（左右）
        for (const sx of [-1, 1]) {
            const sp = this._mesh(new THREE.SphereGeometry(0.125, 16, 16), M.blue);
            sp.scale.y = 0.72;
            sp.position.set(sx * 0.315, 1.43, 0);
            g.add(sp);
        }

        // ── 腕グループ ──
        this.armLGroup.position.set(-0.355, 0, 0);
        this.armRGroup.position.set( 0.355, 0, 0);
        g.add(this.armLGroup, this.armRGroup);

        for (const [grp] of [[this.armLGroup], [this.armRGroup]]) {
            // 上腕
            const ua = this._mesh(new THREE.CylinderGeometry(0.077, 0.068, 0.36, 12), M.blue);
            ua.position.y = 1.24;
            grp.add(ua);
            // 前腕
            const la = this._mesh(new THREE.CylinderGeometry(0.062, 0.056, 0.32, 12), M.blue);
            la.position.y = 0.90;
            grp.add(la);
            // ゴールドカフ
            const cuff = this._mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.065, 12), M.gold);
            cuff.position.y = 0.745;
            grp.add(cuff);
            // 手
            const hand = this._mesh(new THREE.SphereGeometry(0.072, 12, 12), M.blue);
            hand.position.y = 0.64;
            grp.add(hand);
        }
    }

    _buildLegs(M) {
        const g = this.lowerGroup;
        this.legLGroup = new THREE.Group();
        this.legRGroup = new THREE.Group();
        this.legLGroup.position.x = -0.148;
        this.legRGroup.position.x =  0.148;
        g.add(this.legLGroup, this.legRGroup);

        for (const legG of [this.legLGroup, this.legRGroup]) {
            // 太もも
            const thigh = this._mesh(new THREE.CylinderGeometry(0.098, 0.088, 0.37, 12), M.blue);
            thigh.position.y = 0.605;
            legG.add(thigh);
            // 膝パッド
            const knee = this._mesh(new THREE.BoxGeometry(0.155, 0.095, 0.115), M.dark);
            knee.position.set(0, 0.50, 0.055);
            legG.add(knee);
            // 脛
            const shin = this._mesh(new THREE.CylinderGeometry(0.088, 0.078, 0.35, 12), M.blue);
            shin.position.y = 0.222;
            legG.add(shin);
            // ブーツ
            const boot = this._mesh(new THREE.BoxGeometry(0.175, 0.155, 0.215), M.dark);
            boot.position.set(0, 0.01, 0.025);
            legG.add(boot);
            // ブーツソール
            const sole = this._mesh(new THREE.BoxGeometry(0.182, 0.038, 0.225), M.sole);
            sole.position.set(0, -0.058, 0.025);
            legG.add(sole);
        }
    }

    // ── State Control ────────────────────────────────────────────
    setState(state) {
        this.state     = state;
        this.stateTime = 0;

        // 目の発光設定
        const eyeConfig = {
            idle     : { intensity: 1.6, color: C.eyeEmit },
            talking  : { intensity: 3.2, color: 0x00ccff  },
            listening: { intensity: 2.6, color: 0x00eeff  },
            thinking : { intensity: 1.0, color: 0x0044aa  },
        };
        const ec = eyeConfig[state] || eyeConfig.idle;
        for (const eye of [this.eyeL, this.eyeR]) {
            eye.material.emissiveIntensity = ec.intensity;
            eye.material.emissive.setHex(ec.color);
        }
        this.eyeLight.color.setHex(ec.color);
        this.eyeLight.intensity = ec.intensity * 0.75;

        // 胸ライト設定
        const chestConfig = {
            idle     : { color: 0xff2222, intensity: 1.8 },
            talking  : { color: 0xff5555, intensity: 3.0 },
            listening: { color: 0xff3333, intensity: 2.4 },
            thinking : { color: 0xffaa00, intensity: 1.5 },
        };
        const cc = chestConfig[state] || chestConfig.idle;
        this.emblemLight.color.setHex(cc.color);
        this.emblemLight.intensity = cc.intensity;
    }

    // ── Animation Loop ───────────────────────────────────────────
    _animate() {
        const delta     = this.clock.getDelta();
        this.stateTime += delta;
        const t = this.stateTime;
        const s = Math.sin;

        // 状態別アニメーション
        switch (this.state) {
            case 'idle': {
                // 軽くふわふわ
                this.char.position.y        = s(t * 1.2) * 0.028;
                this.headGroup.rotation.z   = s(t * 0.8) * 0.022;
                this.headGroup.rotation.x   = s(t * 1.0) * 0.012 - 0.02;
                this.upperGroup.rotation.z  = s(t * 0.9) * 0.015;
                this.armLGroup.rotation.z   = -0.07 + s(t * 1.2) * 0.028;
                this.armRGroup.rotation.z   =  0.07 - s(t * 1.2) * 0.028;
                this.armLGroup.rotation.x   = s(t * 0.8) * 0.02;
                this.armRGroup.rotation.x   = s(t * 0.8) * 0.02;
                break;
            }
            case 'talking': {
                // 活発に動く・右手ジェスチャー
                this.char.position.y        = s(t * 4.0) * 0.038 + 0.02;
                this.upperGroup.rotation.z  = s(t * 3.2) * 0.065;
                this.upperGroup.rotation.x  = -0.04;
                this.headGroup.rotation.z   = s(t * 3.8) * 0.085;
                this.headGroup.rotation.x   = s(t * 3.2) * 0.055 - 0.04;
                // 右腕を上げてジェスチャー
                this.armRGroup.rotation.x   = -0.68 + s(t * 3.2) * 0.18;
                this.armRGroup.rotation.z   =  0.18 + s(t * 2.8) * 0.12;
                this.armLGroup.rotation.z   = -0.14 + s(t * 1.6) * 0.038;
                this.armLGroup.rotation.x   =  0.10 + s(t * 1.8) * 0.04;
                // 脚の重心移動
                this.legLGroup.rotation.z   =  s(t * 3.0) * 0.025;
                this.legRGroup.rotation.z   = -s(t * 3.0) * 0.025;
                break;
            }
            case 'listening': {
                // 首傾げ・前傾姿勢
                this.char.position.y        = s(t * 1.0) * 0.022;
                this.headGroup.rotation.z   = 0.13 + s(t * 1.5) * 0.038;
                this.headGroup.rotation.x   = -0.05 + s(t * 1.2) * 0.02;
                this.upperGroup.rotation.x  = -0.065 + s(t * 1.0) * 0.018;
                this.upperGroup.rotation.z  = s(t * 1.2) * 0.02;
                this.armLGroup.rotation.z   = -0.09 + s(t * 1.2) * 0.025;
                this.armRGroup.rotation.z   =  0.09 - s(t * 1.2) * 0.025;
                this.armLGroup.rotation.x   = s(t * 1.0) * 0.02;
                this.armRGroup.rotation.x   = s(t * 1.0) * 0.02;
                break;
            }
            case 'thinking': {
                // あごに手・首傾げ
                this.char.position.y        = s(t * 0.8) * 0.018;
                this.headGroup.rotation.z   = -0.09 + s(t * 1.0) * 0.018;
                this.headGroup.rotation.x   = -0.03;
                this.upperGroup.rotation.z  = s(t * 0.9) * 0.012;
                this.armRGroup.rotation.x   = -0.50 + s(t * 0.9) * 0.05;
                this.armRGroup.rotation.z   =  0.28 + s(t * 0.7) * 0.04;
                this.armLGroup.rotation.z   = -0.05 + s(t * 0.8) * 0.02;
                break;
            }
        }

        // 目パチパチ（全状態共通）
        const blinkPhase = (t % 5.2) / 5.2;
        const blinkScale = blinkPhase > 0.92 ? Math.max(0.15, 1 - (blinkPhase - 0.92) / 0.04) : 1.0;
        this.eyeL.scale.y = blinkScale;
        this.eyeR.scale.y = blinkScale;

        // 胸エンブレム 鼓動
        const pulse = (s(t * 2.8) + 1) * 0.5;
        this.emblemCore.material.emissiveIntensity = 0.35 + pulse * 0.8;

        this.renderer.render(this.scene, this.camera);
    }

    _startLoop() {
        const loop = () => {
            requestAnimationFrame(loop);
            this._animate();
        };
        loop();
    }

    _onResize() {
        const w = window.innerWidth, h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
        this._updateCameraForAspect();
    }
}

// ── 初期化・グローバル公開 ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('three-canvas');
    if (!canvas) return;
    window.kyurokuScene = new KyurokuScene(canvas);
});
