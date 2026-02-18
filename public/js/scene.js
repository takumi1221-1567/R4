// =====================================================================
// scene.js — R4 KYUROKU.ainas  Three.js 3D Character  v3
// Rockman X DiVE スタイル完全一致  ランニングリグ付き
// 関節階層: pelvis→spine→chest→shoulder→upperArm→lowerArm→hand
//           pelvis→thigh→shin→foot
// window.kyurokuScene.setState(state) / .setForm(formKey) で外部制御
// =====================================================================
'use strict';
import * as THREE from 'three';

// ── フォームカラー定義（全7形態） ─────────────────────────────────
const FORM_COLORS = {
    castoff: {
        suit: 0x0c1828, armor: 0x1e4e96, trim: 0xc8a030,
        visor: 0x88ccff, visorEmi: 0x2266bb,
        embA: 0xdd2222, embB: 0x2244cc,
        hair: 0x18102a, skin: 0xeec080,
        eye: 0x44aaff, eyeEmi: 0x2288ff,
        boot: 0x1a4a90, cuff: 0x2255bb, shldr: 0x1a4a90,
        showFace: true,
    },
    caston: {
        suit: 0x182840, armor: 0x2a5a9e, trim: 0x4488dd,
        visor: 0xe8851a, visorEmi: 0xcc5500,
        embA: 0x2255bb, embB: 0x4488ff,
        hair: 0x18102a, skin: 0x000000,
        eye: 0xe8851a, eyeEmi: 0xcc5500,
        boot: 0x2a5a9e, cuff: 0x3a6aae, shldr: 0x2a5a9e,
        showFace: false,
    },
    aqua: {
        suit: 0x0a1e38, armor: 0x38b0cc, trim: 0xeecc00,
        visor: 0xaaeeff, visorEmi: 0x44ccee,
        embA: 0xdd2222, embB: 0x2244aa,
        hair: 0x18102a, skin: 0xeec080,
        eye: 0x66eeff, eyeEmi: 0x33ccee,
        boot: 0x38b0cc, cuff: 0x44c0d8, shldr: 0x38b0cc,
        showFace: true,
    },
    heat: {
        suit: 0x180808, armor: 0xcc2200, trim: 0xd4a820,
        visor: 0x88ccff, visorEmi: 0x2266aa,
        embA: 0x4488ff, embB: 0x2255dd,
        hair: 0x18102a, skin: 0xeec080,
        eye: 0x4499ff, eyeEmi: 0x2266ee,
        boot: 0xcc2200, cuff: 0xdd3311, shldr: 0xcc2200,
        showFace: true,
    },
    marine: {
        suit: 0x0a1020, armor: 0xe05020, trim: 0x20ff40,
        visor: 0x88ccff, visorEmi: 0x2266aa,
        embA: 0xee6600, embB: 0xcc4400,
        hair: 0x18102a, skin: 0xeec080,
        eye: 0x20ff40, eyeEmi: 0x10cc30,
        boot: 0xe05020, cuff: 0xee6030, shldr: 0xe05020,
        showFace: true,
    },
    sight: {
        suit: 0x081808, armor: 0x22aa44, trim: 0xddeedd,
        visor: 0xaaffaa, visorEmi: 0x44cc66,
        embA: 0xdd2222, embB: 0x2244aa,
        hair: 0x18102a, skin: 0xeec080,
        eye: 0x44ff66, eyeEmi: 0x22cc44,
        boot: 0x22aa44, cuff: 0x33bb55, shldr: 0x22aa44,
        showFace: true,
    },
    bug: {
        suit: 0x060e22, armor: 0x0e1e44, trim: 0x00ddff,
        visor: 0x00aaff, visorEmi: 0x0088dd,
        embA: 0xffcc00, embB: 0xeeaa00,
        hair: 0x18102a, skin: 0xeec080,
        eye: 0x00ffee, eyeEmi: 0x00ddcc,
        boot: 0x0e1e44, cuff: 0x1a2e5a, shldr: 0x0e1e44,
        showFace: true,
    },
};

const ENV_AMBIENT = {
    castoff: 0x1a3060, caston: 0x101840,
    aqua: 0x004040,   heat:  0x401010,
    marine: 0x402010, sight: 0x104010, bug: 0x080840,
};

// ── ヘルパー ─────────────────────────────────────────────────────────
function makeMesh(geo, mat) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    return m;
}

// =====================================================================
class KyurokuScene {

    constructor(canvas) {
        this.canvas        = canvas;
        this.clock         = new THREE.Clock();
        this.state         = 'idle';
        this.form          = 'castoff';
        this.runPhase      = 0;
        this.blinkTimer    = 4.0 + Math.random() * 2.5;
        this.isBlinking    = false;
        this.blinkT        = 0;
        this.refs          = {};   // 特定メッシュへの参照
        this.joints        = {};   // 関節グループへの参照

        this._initRenderer();
        this._initScene();
        this._buildCharacter();
        this._startLoop();
    }

    // ── レンダラー初期化 ───────────────────────────────────────────
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

    // ── シーン初期化 ───────────────────────────────────────────────
    _initScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x060e1e);
        this.scene.fog = new THREE.FogExp2(0x060e1e, 0.15);

        const w = this.canvas.offsetWidth  || window.innerWidth;
        const h = this.canvas.offsetHeight || window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(44, w / h, 0.01, 50);
        this.camera.position.set(0, 1.10, 3.6);
        this.camera.lookAt(0, 0.95, 0);

        // 環境光
        this.ambientLight = new THREE.AmbientLight(0x1a3060, 1.6);
        this.scene.add(this.ambientLight);

        // メインライト（前方右上）
        const main = new THREE.DirectionalLight(0xffffff, 2.4);
        main.position.set(1.8, 3.5, 2.5);
        main.castShadow = true;
        main.shadow.mapSize.set(512, 512);
        main.shadow.camera.near = 0.5;
        main.shadow.camera.far  = 12;
        main.shadow.camera.left = main.shadow.camera.bottom = -2;
        main.shadow.camera.right = main.shadow.camera.top   =  2;
        this.scene.add(main);

        // リムライト（後方青）
        const rim = new THREE.DirectionalLight(0x3366ff, 1.4);
        rim.position.set(-2, 2, -2.5);
        this.scene.add(rim);

        // フィルライト（前方下）
        const fill = new THREE.DirectionalLight(0x223355, 0.9);
        fill.position.set(0.5, -1, 2);
        this.scene.add(fill);

        // フロア
        const floor = makeMesh(
            new THREE.PlaneGeometry(10, 10),
            new THREE.MeshStandardMaterial({ color: 0x0a1428, roughness: 0.8, metalness: 0.2 })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // ヘックスタイル壁
        this._buildHexWall();

        // エンブレム・目ポイントライト
        this.emblemLight = new THREE.PointLight(0xff4422, 0.9, 1.5);
        this.emblemLight.position.set(0, 1.20, 0.28);
        this.scene.add(this.emblemLight);

        this.eyeLight = new THREE.PointLight(0x4488ff, 0.6, 0.8);
        this.eyeLight.position.set(0, 1.55, 0.25);
        this.scene.add(this.eyeLight);
    }

    _buildHexWall() {
        const geo = new THREE.CylinderGeometry(0.45, 0.45, 0.07, 6);
        const mat = new THREE.MeshStandardMaterial({
            color: 0x0e1e3a, roughness: 0.65, metalness: 0.35,
        });
        const g   = new THREE.Group();
        const cols = 11, rows = 15;
        const dx = 0.78, dy = 0.675;
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

    // =====================================================================
    // キャラクター構築
    // =====================================================================
    _buildCharacter() {
        const c = FORM_COLORS[this.form];

        // ── マテリアル ────────────────────────────────────────────────
        const M = (color, rough, metal, emi, emiI) => new THREE.MeshStandardMaterial({
            color,
            roughness: rough,
            metalness: metal,
            emissive:  new THREE.Color(emi ?? 0x000000),
            emissiveIntensity: emiI ?? 0,
        });

        this.mats = {
            suit:  M(c.suit,  0.75, 0.15),
            armor: M(c.armor, 0.28, 0.72),
            trim:  M(c.trim,  0.15, 0.92),
            visor: M(c.visor, 0.05, 0.10, c.visorEmi, 0.7),
            skin:  M(c.skin,  0.80, 0.00),
            hair:  M(c.hair,  0.75, 0.05),
            eye:   M(c.eye,   0.05, 0.10, c.eyeEmi, 1.4),
            embA:  M(c.embA,  0.20, 0.50, c.embA, 0.9),
            embB:  M(c.embB,  0.20, 0.50, c.embB, 0.9),
            boot:  M(c.boot,  0.28, 0.72),
            cuff:  M(c.cuff,  0.22, 0.78),
            shldr: M(c.shldr, 0.28, 0.72),
            dark:  M(0x080810, 0.8, 0.1),
        };

        // ── ルートグループ ────────────────────────────────────────────
        this.charRoot = new THREE.Group();
        this.scene.add(this.charRoot);

        // ── ペルビス（腰・ここが体全体の基点） ──────────────────────
        const pelvis = new THREE.Group();
        pelvis.position.set(0, 0.84, 0);
        this.charRoot.add(pelvis);
        this.joints.pelvis = pelvis;

        // 腰メッシュ
        pelvis.add(makeMesh(new THREE.BoxGeometry(0.30, 0.09, 0.17), this.mats.suit));

        // ── スパイン（脊椎） ──────────────────────────────────────────
        const spine = new THREE.Group();
        spine.position.set(0, 0.07, 0);
        pelvis.add(spine);
        this.joints.spine = spine;

        // 胴体メッシュ（スパイン相対 y=-0.07 で上部が y=0.84+0.07+0.14=1.05）
        const torso = makeMesh(new THREE.BoxGeometry(0.34, 0.38, 0.19), this.mats.suit);
        torso.position.set(0, -0.07, 0);
        spine.add(torso);

        // ベルト
        const belt = makeMesh(new THREE.BoxGeometry(0.32, 0.045, 0.19), this.mats.trim);
        belt.position.set(0, -0.23, 0);
        spine.add(belt);

        // ── チェスト ──────────────────────────────────────────────────
        const chest = new THREE.Group();
        chest.position.set(0, 0.24, 0);
        spine.add(chest);
        this.joints.chest = chest;

        // チェストプレート
        const chestPlate = makeMesh(new THREE.BoxGeometry(0.28, 0.18, 0.055), this.mats.armor);
        chestPlate.position.set(0, 0.01, 0.08);
        chest.add(chestPlate);

        // エンブレムリング（金）
        const embRing = makeMesh(new THREE.TorusGeometry(0.062, 0.013, 7, 24), this.mats.trim);
        embRing.rotation.x = Math.PI / 2;
        embRing.position.set(0, 0.01, 0.135);
        chest.add(embRing);

        // エンブレム左半球（赤）
        const embA = makeMesh(new THREE.SphereGeometry(0.040, 12, 8, 0, Math.PI), this.mats.embA);
        embA.rotation.y = -Math.PI / 2;
        embA.position.set(-0.019, 0.01, 0.138);
        chest.add(embA);
        this.refs.embA = embA;

        // エンブレム右半球（青）
        const embB = makeMesh(new THREE.SphereGeometry(0.040, 12, 8, 0, Math.PI), this.mats.embB);
        embB.rotation.y = Math.PI / 2;
        embB.position.set(0.019, 0.01, 0.138);
        chest.add(embB);
        this.refs.embB = embB;

        // カラー（金えり）
        const mkCollar = (sx) => {
            const col = makeMesh(new THREE.BoxGeometry(0.12, 0.055, 0.07), this.mats.trim);
            col.position.set(sx * 0.085, 0.11, 0.06);
            col.rotation.z = -sx * 0.28;
            chest.add(col);
        };
        mkCollar(-1); mkCollar(1);

        // ── 肩 → 腕（左右） ─────────────────────────────────────────
        this._buildArm('L', chest);
        this._buildArm('R', chest);

        // ── 首 → 頭 ──────────────────────────────────────────────────
        const neck = new THREE.Group();
        neck.position.set(0, 0.16, 0);
        chest.add(neck);
        this.joints.neck = neck;

        neck.add(makeMesh(new THREE.CylinderGeometry(0.065, 0.085, 0.09, 8), this.mats.suit));

        const head = new THREE.Group();
        head.position.set(0, 0.09, 0);
        neck.add(head);
        this.joints.head = head;

        this._buildHead(head, c);

        // ── 脚（左右） ────────────────────────────────────────────────
        this._buildLeg('L', pelvis);
        this._buildLeg('R', pelvis);

        // 全メッシュにshadow設定
        this.charRoot.traverse(obj => { if (obj.isMesh) obj.castShadow = true; });
    }

    // ── 腕の構築 ─────────────────────────────────────────────────────
    _buildArm(side, parent) {
        const sx = side === 'L' ? -1 : 1;

        // 肩グループ（x方向に腕を押し出す）
        const shoulderGrp = new THREE.Group();
        shoulderGrp.position.set(sx * 0.215, 0.05, 0);
        parent.add(shoulderGrp);

        // 肩アーマー
        const pad = makeMesh(new THREE.BoxGeometry(0.095, 0.08, 0.12), this.mats.shldr);
        pad.position.set(sx * 0.005, 0.01, 0);
        shoulderGrp.add(pad);

        // 肩アーマー上突起
        const padTop = makeMesh(new THREE.BoxGeometry(0.07, 0.055, 0.09), this.mats.armor);
        padTop.position.set(sx * 0.005, 0.065, 0);
        shoulderGrp.add(padTop);

        // 上腕グループ（肩関節 = このグループの原点）
        const upperArm = new THREE.Group();
        upperArm.position.set(sx * 0.006, -0.04, 0);
        shoulderGrp.add(upperArm);
        this.joints[`upperArm${side}`] = upperArm;

        upperArm.add(this._cylinder(0.062, 0.055, 0.25, this.mats.suit, [0, -0.125, 0]));

        // 肘グループ（肘関節）
        const lowerArm = new THREE.Group();
        lowerArm.position.set(0, -0.25, 0);
        upperArm.add(lowerArm);
        this.joints[`lowerArm${side}`] = lowerArm;

        // カフアーマー（手首リング）
        lowerArm.add(this._cylinder(0.072, 0.062, 0.065, this.mats.cuff, [0, -0.015, 0]));
        lowerArm.add(this._cylinder(0.052, 0.060, 0.19, this.mats.suit, [0, -0.12, 0]));

        // 手グループ（手首関節）
        const hand = new THREE.Group();
        hand.position.set(0, -0.22, 0);
        lowerArm.add(hand);
        this.joints[`hand${side}`] = hand;

        const handMesh = makeMesh(new THREE.SphereGeometry(0.068, 10, 8), this.mats.cuff);
        handMesh.scale.set(1, 0.82, 0.88);
        handMesh.position.set(0, -0.04, 0);
        hand.add(handMesh);
    }

    // ── 脚の構築 ─────────────────────────────────────────────────────
    _buildLeg(side, parent) {
        const sx = side === 'L' ? -1 : 1;

        // 大腿グループ（股関節 = このグループの原点）
        const thigh = new THREE.Group();
        thigh.position.set(sx * 0.105, -0.055, 0);
        parent.add(thigh);
        this.joints[`thigh${side}`] = thigh;

        thigh.add(this._cylinder(0.082, 0.070, 0.30, this.mats.suit, [0, -0.15, 0]));

        // 膝グループ（膝関節）
        const shin = new THREE.Group();
        shin.position.set(0, -0.30, 0);
        thigh.add(shin);
        this.joints[`shin${side}`] = shin;

        // 膝アーマー
        const knee = makeMesh(new THREE.BoxGeometry(0.13, 0.08, 0.10), this.mats.armor);
        knee.position.set(0, -0.015, 0.045);
        shin.add(knee);

        shin.add(this._cylinder(0.070, 0.062, 0.27, this.mats.suit, [0, -0.14, 0]));

        // 足首グループ（足首関節）
        const foot = new THREE.Group();
        foot.position.set(0, -0.28, 0);
        shin.add(foot);
        this.joints[`foot${side}`] = foot;

        // ブーツ本体
        const boot = makeMesh(new THREE.BoxGeometry(0.165, 0.155, 0.29), this.mats.boot);
        boot.position.set(0, -0.055, 0.055);
        foot.add(boot);

        // ブーツ前部（つま先張り出し）
        const toe = makeMesh(new THREE.BoxGeometry(0.145, 0.07, 0.055), this.mats.armor);
        toe.position.set(0, -0.09, 0.19);
        foot.add(toe);

        // 足首アーマー
        const ankleA = makeMesh(new THREE.BoxGeometry(0.185, 0.065, 0.145), this.mats.armor);
        ankleA.position.set(0, 0.025, 0.03);
        foot.add(ankleA);

        // ブーツサイドフィン
        const finGeo = new THREE.BoxGeometry(0.025, 0.06, 0.08);
        const finL = makeMesh(finGeo, this.mats.trim);
        finL.position.set(-0.092, 0.01, 0.03);
        foot.add(finL);
        const finR = makeMesh(finGeo, this.mats.trim);
        finR.position.set(0.092, 0.01, 0.03);
        foot.add(finR);
    }

    // ── 頭部の構築 ───────────────────────────────────────────────────
    _buildHead(hg, c) {
        // ─ ヘルメットベース（丸みのある球体） ─
        const helm = makeMesh(new THREE.SphereGeometry(0.192, 18, 14), this.mats.armor);
        helm.scale.set(1.0, 1.10, 0.93);
        helm.position.set(0, 0.195, 0);
        hg.add(helm);
        this.refs.helm = helm;

        // ─ ゴールドトリムバンド（ヘルメット下端） ─
        const band = makeMesh(new THREE.TorusGeometry(0.186, 0.017, 6, 28), this.mats.trim);
        band.rotation.x = Math.PI / 2;
        band.position.set(0, 0.128, 0);
        hg.add(band);

        // ─ 頂上クレスト（中央 / 上方向フィン） ─
        const crest = makeMesh(new THREE.BoxGeometry(0.052, 0.21, 0.042), this.mats.trim);
        crest.position.set(0, 0.415, 0.005);
        hg.add(crest);
        const crestTip = makeMesh(new THREE.ConeGeometry(0.028, 0.055, 4), this.mats.trim);
        crestTip.position.set(0, 0.535, 0.005);
        hg.add(crestTip);

        // ─ サイドフィン（上部 × 2） ─
        for (const s of [-1, 1]) {
            // 上部フィン（斜め上に立ち上がる）
            const finUp = makeMesh(new THREE.BoxGeometry(0.048, 0.17, 0.055), this.mats.armor);
            finUp.position.set(s * 0.165, 0.385, 0.005);
            finUp.rotation.z = s * 0.32;
            finUp.rotation.x = 0.10;
            hg.add(finUp);

            const finUpTrim = makeMesh(new THREE.BoxGeometry(0.018, 0.12, 0.032), this.mats.trim);
            finUpTrim.position.set(s * 0.168, 0.385, 0.014);
            finUpTrim.rotation.z = s * 0.32;
            finUpTrim.rotation.x = 0.10;
            hg.add(finUpTrim);

            // サイドフィン（後ろ方向）
            const finSide = makeMesh(new THREE.BoxGeometry(0.038, 0.12, 0.16), this.mats.armor);
            finSide.position.set(s * 0.212, 0.225, -0.04);
            finSide.rotation.z = s * 0.15;
            finSide.rotation.y = s * -0.20;
            hg.add(finSide);
        }

        // ─ フェイスプレート（肌色） ─
        const face = makeMesh(new THREE.CylinderGeometry(0.112, 0.118, 0.038, 14), this.mats.skin);
        face.rotation.x = Math.PI / 2;
        face.scale.y = 1.28;
        face.position.set(0, 0.198, 0.183);
        hg.add(face);
        this.refs.face = face;

        // ─ 目 ─
        for (const s of [-1, 1]) {
            const eye = makeMesh(new THREE.SphereGeometry(0.023, 10, 7), this.mats.eye);
            eye.scale.x = 1.35;
            eye.position.set(s * 0.052, 0.227, 0.196);
            hg.add(eye);
            this.refs[s === -1 ? 'eyeL' : 'eyeR'] = eye;
        }

        // ─ バイザー（目の上の薄いストライプ） ─
        const visorBar = makeMesh(new THREE.BoxGeometry(0.155, 0.052, 0.018), this.mats.visor);
        visorBar.position.set(0, 0.244, 0.188);
        hg.add(visorBar);
        this.refs.visorBar = visorBar;

        // キャストオン用フルバイザー（default hidden）
        const fullVisor = makeMesh(new THREE.BoxGeometry(0.22, 0.195, 0.022), this.mats.visor);
        fullVisor.position.set(0, 0.198, 0.183);
        fullVisor.visible = false;
        hg.add(fullVisor);
        this.refs.fullVisor = fullVisor;

        // ─ 口 ─
        const mouth = makeMesh(new THREE.BoxGeometry(0.048, 0.011, 0.012), this.mats.dark);
        mouth.position.set(0, 0.172, 0.196);
        hg.add(mouth);
        this.refs.mouth = mouth;

        // ─ 髪（後ろ・サイド） ─
        const hairBack = makeMesh(new THREE.BoxGeometry(0.255, 0.105, 0.095), this.mats.hair);
        hairBack.position.set(0, 0.138, -0.175);
        hg.add(hairBack);

        for (const s of [-1, 1]) {
            const hairSide = makeMesh(new THREE.BoxGeometry(0.055, 0.085, 0.055), this.mats.hair);
            hairSide.position.set(s * 0.178, 0.118, 0.055);
            hg.add(hairSide);
        }

        // ─ ヘルメット後部補強パネル ─
        const backPanel = makeMesh(new THREE.BoxGeometry(0.26, 0.10, 0.03), this.mats.armor);
        backPanel.position.set(0, 0.24, -0.187);
        hg.add(backPanel);
    }

    // ── ユーティリティ ────────────────────────────────────────────────
    _cylinder(rTop, rBot, h, mat, pos) {
        const m = makeMesh(new THREE.CylinderGeometry(rTop, rBot, h, 9), mat);
        if (pos) m.position.set(...pos);
        return m;
    }

    // =====================================================================
    // フォーム切り替え
    // =====================================================================
    setForm(formKey) {
        this.form = formKey;
        const c = FORM_COLORS[formKey] ?? FORM_COLORS.castoff;

        const setC = (mat, hex) => mat.color.setHex(hex);
        const setE = (mat, hex, i) => {
            mat.emissive.setHex(hex);
            mat.emissiveIntensity = i;
        };

        setC(this.mats.suit,  c.suit);
        setC(this.mats.armor, c.armor);
        setC(this.mats.trim,  c.trim);
        setC(this.mats.visor, c.visor); setE(this.mats.visor, c.visorEmi, 0.7);
        setC(this.mats.skin,  c.skin);
        setC(this.mats.hair,  c.hair);
        setC(this.mats.eye,   c.eye);   setE(this.mats.eye,   c.eyeEmi, 1.4);
        setC(this.mats.embA,  c.embA);  setE(this.mats.embA,  c.embA, 0.9);
        setC(this.mats.embB,  c.embB);  setE(this.mats.embB,  c.embB, 0.9);
        setC(this.mats.boot,  c.boot);
        setC(this.mats.cuff,  c.cuff);
        setC(this.mats.shldr, c.shldr);

        // 顔の表示/非表示（キャストオンは顔隠れる）
        const showFace = c.showFace !== false;
        if (this.refs.face)     this.refs.face.visible     = showFace;
        if (this.refs.eyeL)     this.refs.eyeL.visible     = showFace;
        if (this.refs.eyeR)     this.refs.eyeR.visible     = showFace;
        if (this.refs.mouth)    this.refs.mouth.visible    = showFace;
        if (this.refs.visorBar) this.refs.visorBar.visible = showFace;
        if (this.refs.fullVisor) this.refs.fullVisor.visible = !showFace;

        // 環境光
        this.ambientLight.color.setHex(ENV_AMBIENT[formKey] ?? 0x1a3060);
        // エンブレムライト
        this.emblemLight.color.setHex(c.embA);
        this.eyeLight.color.setHex(c.eyeEmi);
    }

    // ── アニメーション状態変更 ────────────────────────────────────────
    setState(state) {
        this.state = state;
    }

    // =====================================================================
    // アニメーションループ
    // =====================================================================
    _startLoop() {
        const loop = () => {
            requestAnimationFrame(loop);
            const dt = Math.min(this.clock.getDelta(), 0.05);
            const t  = this.clock.getElapsedTime();
            this._animate(dt, t);
            this.renderer.render(this.scene, this.camera);
        };
        loop();
    }

    _animate(dt, t) {
        this._updateBlink(dt);
        this._updateEmblem(t);

        // 状態ごとのアニメーション
        switch (this.state) {
            case 'running':  this._animRun(dt, t);     break;
            case 'talking':  this._animTalk(t);        break;
            case 'listening':this._animListen(t);      break;
            case 'thinking': this._animThink(t);       break;
            default:         this._animIdle(t);        break;
        }
    }

    // ── まばたき ─────────────────────────────────────────────────────
    _updateBlink(dt) {
        this.blinkTimer -= dt;
        if (this.blinkTimer <= 0 && !this.isBlinking) {
            this.isBlinking = true;
            this.blinkT = 0;
            this.blinkTimer = 4.0 + Math.random() * 3.5;
        }
        if (this.isBlinking) {
            this.blinkT += dt * 9;
            const sy = this.blinkT < Math.PI ? Math.max(0.05, 1 - Math.sin(this.blinkT) * 7) : 1;
            if (this.refs.eyeL) this.refs.eyeL.scale.y = sy;
            if (this.refs.eyeR) this.refs.eyeR.scale.y = sy;
            if (this.blinkT >= Math.PI) {
                this.isBlinking = false;
                if (this.refs.eyeL) this.refs.eyeL.scale.y = 1;
                if (this.refs.eyeR) this.refs.eyeR.scale.y = 1;
            }
        }
    }

    // ── エンブレム脈動 ────────────────────────────────────────────────
    _updateEmblem(t) {
        const p = 0.85 + Math.sin(t * 2.4) * 0.30;
        if (this.mats.embA) this.mats.embA.emissiveIntensity = p;
        if (this.mats.embB) this.mats.embB.emissiveIntensity = p;
        this.emblemLight.intensity = 0.7 + Math.sin(t * 2.4) * 0.25;
    }

    // ── 関節リセット（毎フレームの基準値） ──────────────────────────
    _resetJoints() {
        const J = this.joints;
        this.charRoot.position.y = 0;
        this.charRoot.rotation.set(0, 0, 0);
        if (J.pelvis) J.pelvis.rotation.set(0, 0, 0);
        if (J.spine)  J.spine.rotation.set(0, 0, 0);
        if (J.chest)  J.chest.rotation.set(0, 0, 0);
        if (J.neck)   J.neck.rotation.set(0, 0, 0);
        if (J.head)   J.head.rotation.set(0, 0, 0);
        ['L', 'R'].forEach(s => {
            for (const jn of [`upperArm${s}`, `lowerArm${s}`, `hand${s}`,
                              `thigh${s}`,    `shin${s}`,     `foot${s}`]) {
                if (J[jn]) J[jn].rotation.set(0, 0, 0);
            }
        });
    }

    // ── idle アニメーション ───────────────────────────────────────────
    _animIdle(t) {
        this._resetJoints();
        const J = this.joints;

        this.charRoot.position.y = Math.sin(t * 1.15) * 0.019;
        this.charRoot.rotation.y = Math.sin(t * 0.38) * 0.04;

        if (J.head) {
            J.head.rotation.y = Math.sin(t * 0.68) * 0.07;
            J.head.rotation.z = Math.sin(t * 0.52) * 0.03;
        }

        // 腕を自然に下ろす（やや外向き）
        if (J.upperArmL) { J.upperArmL.rotation.z =  0.10; J.upperArmL.rotation.x =  0.06; }
        if (J.upperArmR) { J.upperArmR.rotation.z = -0.10; J.upperArmR.rotation.x =  0.06; }
        if (J.lowerArmL) J.lowerArmL.rotation.x = 0.12;
        if (J.lowerArmR) J.lowerArmR.rotation.x = 0.12;

        // 微かな呼吸
        const breath = Math.sin(t * 0.7) * 0.008;
        if (J.spine) J.spine.rotation.x = breath;
    }

    // ── running アニメーション ────────────────────────────────────────
    _animRun(dt, t) {
        this._resetJoints();
        const J = this.joints;

        this.runPhase += dt * 7.0;  // 走りのテンポ
        const ph = this.runPhase;

        // 上下バウンド（接地感）
        this.charRoot.position.y = Math.abs(Math.sin(ph)) * 0.058 - 0.022;

        // 骨盤の左右ひねり
        if (J.pelvis) J.pelvis.rotation.y = Math.sin(ph) * 0.11;

        // 胴体の前傾と逆ひねり
        if (J.spine) {
            J.spine.rotation.x = -0.14;                    // 前傾
        }
        if (J.chest) {
            J.chest.rotation.y = -Math.sin(ph) * 0.09;    // 骨盤と逆位相
        }

        // 頭は前を向いたまま
        if (J.head) {
            J.head.rotation.x =  0.10;
            J.head.rotation.y = -J.chest.rotation.y * 0.5; // 少し安定化
        }

        // ── 脚 ──────────────────────────────────────────────────────
        const tSwing = 0.70;   // 大腿スイング角
        const sMax   = 0.85;   // 膝の最大曲げ角

        // 大腿（股関節回転）
        if (J.thighL) J.thighL.rotation.x =  Math.sin(ph) * tSwing;
        if (J.thighR) J.thighR.rotation.x = -Math.sin(ph) * tSwing;

        // 膝（後ろ足側が曲がる）
        if (J.shinL)  J.shinL.rotation.x  = Math.max(0, -Math.sin(ph)) * sMax;
        if (J.shinR)  J.shinR.rotation.x  = Math.max(0,  Math.sin(ph)) * sMax;

        // 足首（つま先の向き）
        if (J.footL)  J.footL.rotation.x  = -0.20 + Math.sin(ph) * 0.20;
        if (J.footR)  J.footR.rotation.x  = -0.20 - Math.sin(ph) * 0.20;

        // ── 腕（脚と逆位相） ────────────────────────────────────────
        const aSwing = 0.60;
        if (J.upperArmL) {
            J.upperArmL.rotation.x = -Math.sin(ph) * aSwing;
            J.upperArmL.rotation.z =  0.16;
        }
        if (J.upperArmR) {
            J.upperArmR.rotation.x =  Math.sin(ph) * aSwing;
            J.upperArmR.rotation.z = -0.16;
        }
        // 肘は走るとき軽く曲げる
        if (J.lowerArmL) J.lowerArmL.rotation.x = 0.45 + Math.max(0,  Math.sin(ph)) * 0.45;
        if (J.lowerArmR) J.lowerArmR.rotation.x = 0.45 + Math.max(0, -Math.sin(ph)) * 0.45;
    }

    // ── talking アニメーション ────────────────────────────────────────
    _animTalk(t) {
        this._resetJoints();
        const J = this.joints;

        this.charRoot.position.y = Math.sin(t * 4.2) * 0.013;
        this.charRoot.rotation.y = Math.sin(t * 2.1) * 0.065;

        // 頭の頷き + 横揺れ
        if (J.head) {
            J.head.rotation.x = Math.sin(t * 4.2) * 0.14;
            J.head.rotation.y = Math.sin(t * 2.6) * 0.09;
            J.head.rotation.z = Math.sin(t * 1.9) * 0.04;
        }

        // 右腕をジェスチャー（上げて動かす）
        if (J.upperArmR) {
            J.upperArmR.rotation.x = -0.58 + Math.sin(t * 4.2) * 0.16;
            J.upperArmR.rotation.z = -0.32;
        }
        if (J.lowerArmR) {
            J.lowerArmR.rotation.x =  0.70 + Math.sin(t * 4.2) * 0.14;
        }

        // 左腕は自然に
        if (J.upperArmL) { J.upperArmL.rotation.z =  0.14; J.upperArmL.rotation.x = 0.05; }
        if (J.lowerArmL) J.lowerArmL.rotation.x = 0.15;

        if (J.spine) J.spine.rotation.x = -0.06;
        if (J.pelvis) J.pelvis.rotation.y = Math.sin(t * 2.1) * 0.045;
    }

    // ── listening アニメーション ──────────────────────────────────────
    _animListen(t) {
        this._resetJoints();
        const J = this.joints;

        this.charRoot.position.y = Math.sin(t * 0.9) * 0.011;

        // 前傾み（興味を持って聞く）
        if (J.spine) J.spine.rotation.x = -0.09;

        // 頭を少し傾ける（聞き入る表情）
        if (J.head) {
            J.head.rotation.z =  0.145;
            J.head.rotation.x = -0.07;
            J.head.rotation.y =  Math.sin(t * 0.48) * 0.04;
        }

        // 両腕を前に軽く
        if (J.upperArmL) { J.upperArmL.rotation.z =  0.14; J.upperArmL.rotation.x = 0.04; }
        if (J.upperArmR) { J.upperArmR.rotation.z = -0.14; J.upperArmR.rotation.x = 0.04; }
        if (J.lowerArmL) J.lowerArmL.rotation.x = 0.12;
        if (J.lowerArmR) J.lowerArmR.rotation.x = 0.12;
    }

    // ── thinking アニメーション ───────────────────────────────────────
    _animThink(t) {
        this._resetJoints();
        const J = this.joints;

        this.charRoot.position.y = Math.sin(t * 0.8) * 0.011;

        // 右に傾く（考える表情）
        if (J.head) {
            J.head.rotation.z  = -0.16;
            J.head.rotation.x  =  0.09;
            J.head.rotation.y  =  Math.sin(t * 0.55) * 0.05;
        }

        // 右腕を顎下へ（考えるポーズ）
        if (J.upperArmR) {
            J.upperArmR.rotation.x = -0.82;
            J.upperArmR.rotation.z = -0.58;
        }
        if (J.lowerArmR) J.lowerArmR.rotation.x = 1.12;

        // 左腕は少し前
        if (J.upperArmL) { J.upperArmL.rotation.z =  0.14; J.upperArmL.rotation.x = 0.06; }
        if (J.lowerArmL) J.lowerArmL.rotation.x = 0.18;

        if (J.spine) J.spine.rotation.x = -0.05;
    }
}

// ── グローバル初期化 ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('three-canvas');
    if (!canvas) return;
    window.kyurokuScene = new KyurokuScene(canvas);
});
