// =====================================================================
// scene.js — R4 KYUROKU.ainas  Three.js 3D Character  v5
// Rockman X DiVE スタイル完全再現 + 17関節ランニングリグ
// window.kyurokuScene.setState(state) / .setForm(formKey)
// =====================================================================
'use strict';
import * as THREE from 'three';

// =====================================================================
// フォームカラー定義（参照画像から採取）
// =====================================================================
const FC = {
    castoff: {
        suit: 0x0c1828, armor: 0x1e4e96, trim: 0xc8a030,
        visor: 0x88ccff, visorEmi: 0x2266bb,
        embA: 0xdd2222, embB: 0x2244cc,
        hair: 0x18102a, skin: 0xeec080,
        eye: 0x44aaff, eyeEmi: 0x2288ff,
        cuff: 0x2255bb, shldr: 0x1a4a90, boot: 0x1a4a90,
        showFace: true, heavyHelm: false,
        ambient: 0x1a3060, fog: 0x060e1e,
    },
    caston: {
        suit: 0x182840, armor: 0x2a5a9e, trim: 0x4a8ae0,
        visor: 0xe8851a, visorEmi: 0xcc5500,
        embA: 0x2255bb, embB: 0x4488ff,
        hair: 0x000000, skin: 0x000000,
        eye: 0xe8851a, eyeEmi: 0xcc5500,
        cuff: 0x3a6aae, shldr: 0x2a5a9e, boot: 0x2a5a9e,
        showFace: false, heavyHelm: true,
        ambient: 0x101840, fog: 0x060e18,
    },
    aqua: {
        suit: 0x0a1e38, armor: 0x38b0cc, trim: 0xeecc00,
        visor: 0xaaeeff, visorEmi: 0x44ccee,
        embA: 0xdd2222, embB: 0x2244aa,
        hair: 0x18102a, skin: 0xeec080,
        eye: 0x66eeff, eyeEmi: 0x33ccee,
        cuff: 0x44c0d8, shldr: 0x38b0cc, boot: 0x38b0cc,
        showFace: true, heavyHelm: false,
        ambient: 0x004050, fog: 0x02080c,
    },
    heat: {
        suit: 0x180808, armor: 0xcc2200, trim: 0xd4a820,
        visor: 0x88ccff, visorEmi: 0x2266aa,
        embA: 0x4488ff, embB: 0x2255dd,
        hair: 0x18102a, skin: 0xeec080,
        eye: 0x4499ff, eyeEmi: 0x2266ee,
        cuff: 0xdd3311, shldr: 0xcc2200, boot: 0xcc2200,
        showFace: true, heavyHelm: false,
        ambient: 0x401010, fog: 0x120404,
    },
    marine: {
        suit: 0x0a1020, armor: 0xe05020, trim: 0x20ff40,
        visor: 0x88ccff, visorEmi: 0x2266aa,
        embA: 0xee6600, embB: 0xcc4400,
        hair: 0x18102a, skin: 0xeec080,
        eye: 0x20ff40, eyeEmi: 0x10cc30,
        cuff: 0xee6030, shldr: 0xe05020, boot: 0xe05020,
        showFace: true, heavyHelm: false,
        ambient: 0x402010, fog: 0x120804,
    },
    sight: {
        suit: 0x081808, armor: 0x22aa44, trim: 0xddeedd,
        visor: 0xaaffaa, visorEmi: 0x44cc66,
        embA: 0xdd2222, embB: 0x2244aa,
        hair: 0x18102a, skin: 0xeec080,
        eye: 0x44ff66, eyeEmi: 0x22cc44,
        cuff: 0x33bb55, shldr: 0x22aa44, boot: 0x22aa44,
        showFace: true, heavyHelm: false,
        ambient: 0x104010, fog: 0x040c04,
    },
    bug: {
        suit: 0x060e22, armor: 0x0e1e44, trim: 0x00ddff,
        visor: 0x00aaff, visorEmi: 0x0088dd,
        embA: 0xffcc00, embB: 0xeeaa00,
        hair: 0x18102a, skin: 0xeec080,
        eye: 0x00ffee, eyeEmi: 0x00ddcc,
        cuff: 0x1a2e5a, shldr: 0x0e1e44, boot: 0x0e1e44,
        showFace: true, heavyHelm: false,
        ambient: 0x080840, fog: 0x020210,
    },
};

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
        this.J          = {};   // joints
        this.R          = {};   // mesh refs
        this.mats       = {};   // materials

        this._initRenderer();
        this._initScene();
        this._buildCharacter();
        this._startLoop();
    }

    // ────────────────────────────────────────────────────────────────
    _initRenderer() {
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled  = true;
        this.renderer.shadowMap.type     = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping        = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.15;
        this.renderer.outputColorSpace   = THREE.SRGBColorSpace;
        this._resize();
        window.addEventListener('resize', () => this._resize());
    }
    _resize() {
        const w = this.canvas.offsetWidth  || window.innerWidth;
        const h = this.canvas.offsetHeight || window.innerHeight;
        this.renderer.setSize(w, h);
        if (this.camera) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
    }

    // ────────────────────────────────────────────────────────────────
    _initScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x060e1e);
        this.scene.fog = new THREE.FogExp2(0x060e1e, 0.13);

        const w = this.canvas.offsetWidth || window.innerWidth;
        const h = this.canvas.offsetHeight || window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(44, w / h, 0.01, 50);
        this.camera.position.set(0, 1.05, 3.5);
        this.camera.lookAt(0, 0.95, 0);

        this.ambientLight = new THREE.AmbientLight(0x1a3060, 1.6);
        this.scene.add(this.ambientLight);

        const sun = new THREE.DirectionalLight(0xffffff, 2.5);
        sun.position.set(1.8, 3.5, 2.5);
        sun.castShadow = true;
        sun.shadow.mapSize.set(512, 512);
        Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 0.5, far: 12 });
        this.scene.add(sun);

        const rim  = new THREE.DirectionalLight(0x3366ff, 1.5);
        rim.position.set(-2, 2, -2.5);
        this.scene.add(rim);

        const fill = new THREE.DirectionalLight(0x223355, 0.8);
        fill.position.set(0.5, -1, 2);
        this.scene.add(fill);

        // Floor
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(12, 12),
            new THREE.MeshStandardMaterial({ color: 0x0a1428, roughness: 0.8, metalness: 0.2 })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        this._buildHexWall();

        this.emblemPt = new THREE.PointLight(0xdd2222, 1.0, 1.8);
        this.emblemPt.position.set(0, 1.18, 0.35);
        this.scene.add(this.emblemPt);

        this.eyePt = new THREE.PointLight(0x4488ff, 0.7, 1.0);
        this.eyePt.position.set(0, 1.58, 0.3);
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
    // キャラクター構築
    // ================================================================
    _buildCharacter() {
        const c = FC[this.form];

        // ── マテリアル ───────────────────────────────────────────────
        const M = (col, r, m, emi, ei) => new THREE.MeshStandardMaterial({
            color: col, roughness: r, metalness: m,
            emissive: new THREE.Color(emi ?? 0), emissiveIntensity: ei ?? 0,
        });
        this.mats = {
            suit:  M(c.suit,  0.75, 0.15),
            armor: M(c.armor, 0.28, 0.72),
            trim:  M(c.trim,  0.15, 0.92),
            visor: M(c.visor, 0.05, 0.10, c.visorEmi, 0.8),
            skin:  M(c.skin,  0.80, 0.00),
            hair:  M(c.hair,  0.75, 0.05),
            eye:   M(c.eye,   0.05, 0.10, c.eyeEmi,   1.5),
            embA:  M(c.embA,  0.20, 0.50, c.embA,     1.0),
            embB:  M(c.embB,  0.20, 0.50, c.embB,     1.0),
            cuff:  M(c.cuff,  0.22, 0.78),
            shldr: M(c.shldr, 0.28, 0.72),
            boot:  M(c.boot,  0.28, 0.72),
            dark:  M(0x080810, 0.8, 0.1),
        };

        // ── ルート ──────────────────────────────────────────────────
        this.charRoot = new THREE.Group();
        this.scene.add(this.charRoot);

        // ── 骨盤（y=0.84） ──────────────────────────────────────────
        const pelvis = this._grp(this.charRoot, 0, 0.84, 0);
        this.J.pelvis = pelvis;
        pelvis.add(this._box(0.30, 0.09, 0.17, this.mats.suit));

        // ── 脊椎 ────────────────────────────────────────────────────
        const spine = this._grp(pelvis, 0, 0.07, 0);
        this.J.spine = spine;

        // 胴体メッシュ（脊椎中心より下側）
        const torso = this._box(0.34, 0.40, 0.19, this.mats.suit);
        torso.position.set(0, -0.06, 0);
        spine.add(torso);
        // ベルト
        const belt = this._box(0.32, 0.045, 0.19, this.mats.trim);
        belt.position.set(0, -0.24, 0);
        spine.add(belt);

        // ── 胸部 ────────────────────────────────────────────────────
        const chest = this._grp(spine, 0, 0.26, 0);
        this.J.chest = chest;

        // 胸プレート
        const cp = this._box(0.28, 0.18, 0.055, this.mats.armor);
        cp.position.set(0, 0.02, 0.08);
        chest.add(cp);

        // エンブレムリング（金）
        const er = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.013, 7, 24), this.mats.trim);
        er.rotation.x = Math.PI / 2; er.position.set(0, 0.02, 0.133);
        chest.add(er);

        // エンブレム半球（赤/青）
        const mkEmb = (mat, sx) => {
            const m = new THREE.Mesh(new THREE.SphereGeometry(0.040, 12, 8, 0, Math.PI), mat);
            m.rotation.y = sx * Math.PI / 2; m.position.set(sx * 0.02, 0.02, 0.136);
            chest.add(m); return m;
        };
        this.R.embA = mkEmb(this.mats.embA, -1);
        this.R.embB = mkEmb(this.mats.embB,  1);

        // カラー（金えり ×2）
        for (const sx of [-1, 1]) {
            const col = this._box(0.12, 0.055, 0.07, this.mats.trim);
            col.position.set(sx * 0.085, 0.115, 0.055); col.rotation.z = -sx * 0.28;
            chest.add(col);
        }

        // ── 肩→腕（左右） ────────────────────────────────────────────
        this._buildArm('L', chest);
        this._buildArm('R', chest);

        // ── 首 ──────────────────────────────────────────────────────
        const neck = this._grp(chest, 0, 0.18, 0);
        this.J.neck = neck;
        const nm = this._cyl(0.065, 0.08, 0.09, this.mats.suit);
        nm.position.y = 0.02; neck.add(nm);

        // ── 頭 ──────────────────────────────────────────────────────
        const head = this._grp(neck, 0, 0.09, 0);
        this.J.head = head;
        this._buildHead(head, c);

        // ── 脚（左右） ────────────────────────────────────────────────
        this._buildLeg('L', pelvis);
        this._buildLeg('R', pelvis);

        this.charRoot.traverse(o => { if (o.isMesh) o.castShadow = true; });
    }

    // ── 腕 ──────────────────────────────────────────────────────────
    _buildArm(side, parent) {
        const sx = side === 'L' ? -1 : 1;

        const shldrGrp = this._grp(parent, sx * 0.21, 0.05, 0);

        // 肩アーマー（本体）
        const sp = this._box(0.095, 0.08, 0.12, this.mats.shldr);
        sp.position.x = sx * 0.005; shldrGrp.add(sp);
        // 肩アーマー上段
        const spt = this._box(0.08, 0.055, 0.10, this.mats.armor);
        spt.position.set(sx * 0.005, 0.067, 0); shldrGrp.add(spt);

        // 上腕グループ（肩関節）
        const ua = this._grp(shldrGrp, sx * 0.005, -0.04, 0);
        this.J[`upperArm${side}`] = ua;
        ua.add(this._cylOfs(0.062, 0.055, 0.26, this.mats.suit, [0, -0.13, 0]));

        // 前腕グループ（肘関節）
        const la = this._grp(ua, 0, -0.26, 0);
        this.J[`lowerArm${side}`] = la;
        la.add(this._cylOfs(0.072, 0.060, 0.065, this.mats.cuff, [0, -0.015, 0])); // カフ
        la.add(this._cylOfs(0.052, 0.060, 0.20,  this.mats.suit, [0, -0.12,  0]));

        // 手グループ（手首関節）
        const hand = this._grp(la, 0, -0.23, 0);
        this.J[`hand${side}`] = hand;
        const hm = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 8), this.mats.cuff);
        hm.scale.set(1, 0.82, 0.88); hm.position.y = -0.04;
        hand.add(hm);
    }

    // ── 脚 ──────────────────────────────────────────────────────────
    _buildLeg(side, parent) {
        const sx = side === 'L' ? -1 : 1;

        // 大腿グループ（股関節）
        const th = this._grp(parent, sx * 0.105, -0.055, 0);
        this.J[`thigh${side}`] = th;
        th.add(this._cylOfs(0.082, 0.070, 0.32, this.mats.suit, [0, -0.16, 0]));

        // 膝グループ（膝関節）
        const sh = this._grp(th, 0, -0.32, 0);
        this.J[`shin${side}`] = sh;

        // 膝アーマー
        const kp = this._box(0.135, 0.08, 0.105, this.mats.armor);
        kp.position.set(0, -0.015, 0.045); sh.add(kp);
        sh.add(this._cylOfs(0.070, 0.062, 0.28, this.mats.suit, [0, -0.15, 0]));

        // 足首グループ（足首関節）
        const ft = this._grp(sh, 0, -0.29, 0);
        this.J[`foot${side}`] = ft;

        // ブーツ本体
        const boot = this._box(0.165, 0.155, 0.30, this.mats.boot);
        boot.position.set(0, -0.055, 0.055); ft.add(boot);
        // つま先
        const toe = this._box(0.148, 0.07, 0.06, this.mats.armor);
        toe.position.set(0, -0.09, 0.19); ft.add(toe);
        // 足首アーマー
        const aa = this._box(0.188, 0.065, 0.148, this.mats.armor);
        aa.position.set(0, 0.028, 0.028); ft.add(aa);
        // サイドフィン
        for (const fsx of [-1, 1]) {
            const fin = this._box(0.024, 0.055, 0.075, this.mats.trim);
            fin.position.set(fsx * 0.094, 0.012, 0.028); ft.add(fin);
        }
    }

    // ── 頭部 ─────────────────────────────────────────────────────────
    _buildHead(hg, c) {
        // ─ ヘルメットベース ─
        const helm = new THREE.Mesh(new THREE.SphereGeometry(0.19, 18, 14), this.mats.armor);
        helm.scale.set(1.0, 1.10, 0.93);
        helm.position.set(0, 0.195, 0);
        hg.add(helm);
        this.R.helm = helm;

        // ─ 金トリムバンド ─
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.185, 0.016, 6, 28), this.mats.trim);
        band.rotation.x = Math.PI / 2; band.position.set(0, 0.13, 0);
        hg.add(band);

        // ─ 中央クレスト（縦フィン） ─
        const crest = this._box(0.050, 0.215, 0.042, this.mats.trim);
        crest.position.set(0, 0.42, 0.005); hg.add(crest);
        const crestTip = new THREE.Mesh(new THREE.ConeGeometry(0.027, 0.055, 4), this.mats.trim);
        crestTip.position.set(0, 0.54, 0.005); hg.add(crestTip);

        // ─ 上部フィン（左右 対称）& サイドフィン ─
        for (const s of [-1, 1]) {
            // 上部フィン
            const fu = this._box(0.047, 0.18, 0.052, this.mats.armor);
            fu.position.set(s * 0.162, 0.385, 0.004);
            fu.rotation.z = s * 0.32; fu.rotation.x = 0.10;
            hg.add(fu);
            const fut = this._box(0.017, 0.13, 0.030, this.mats.trim);
            fut.position.set(s * 0.165, 0.385, 0.013);
            fut.rotation.z = s * 0.32; fut.rotation.x = 0.10;
            hg.add(fut);
            // サイドフィン（後ろ向き）
            const fs = this._box(0.038, 0.115, 0.165, this.mats.armor);
            fs.position.set(s * 0.210, 0.222, -0.038);
            fs.rotation.z = s * 0.14; fs.rotation.y = s * -0.18;
            hg.add(fs);
        }

        // ─ キャストオン用ヘビーヘルメット追加パーツ ─
        this.R.heavyHelmGroup = new THREE.Group();
        this.R.heavyHelmGroup.visible = (this.form === 'caston');
        hg.add(this.R.heavyHelmGroup);
        const hhg = this.R.heavyHelmGroup;
        // フェイスガード（大型バイザー）
        const fg = new THREE.Mesh(
            new THREE.BoxGeometry(0.28, 0.23, 0.04),
            this.mats.visor
        );
        fg.position.set(0, 0.19, 0.16); hhg.add(fg);
        // 上部スパイク ×3
        for (const ox of [-0.07, 0, 0.07]) {
            const sp = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.12, 4), this.mats.armor);
            sp.position.set(ox, 0.45, 0.02); hhg.add(sp);
        }
        // サイドスパイク（肩まで伸びる大型フィン）
        for (const s of [-1, 1]) {
            const sf = this._box(0.045, 0.22, 0.08, this.mats.armor);
            sf.position.set(s * 0.24, 0.25, 0); sf.rotation.z = s * 0.15;
            hhg.add(sf);
        }

        // ─ フェイスプレート（肌色）─
        const face = new THREE.Mesh(new THREE.CylinderGeometry(0.110, 0.116, 0.036, 14), this.mats.skin);
        face.rotation.x = Math.PI / 2; face.scale.y = 1.28;
        face.position.set(0, 0.198, 0.182);
        hg.add(face);
        this.R.face = face;

        // ─ 目（左右）─
        for (const s of [-1, 1]) {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.023, 10, 7), this.mats.eye);
            eye.scale.x = 1.35; eye.position.set(s * 0.052, 0.225, 0.195);
            hg.add(eye);
            this.R[s === -1 ? 'eyeL' : 'eyeR'] = eye;
        }

        // ─ バイザーバー ─
        const vb = this._box(0.152, 0.050, 0.018, this.mats.visor);
        vb.position.set(0, 0.242, 0.188); hg.add(vb);
        this.R.visorBar = vb;

        // ─ 口 ─
        const mouth = this._box(0.046, 0.011, 0.012, this.mats.dark);
        mouth.position.set(0, 0.172, 0.194); hg.add(mouth);
        this.R.mouth = mouth;

        // ─ 髪（後ろ・サイド）─
        const hb = this._box(0.255, 0.100, 0.092, this.mats.hair);
        hb.position.set(0, 0.136, -0.173); hg.add(hb);
        for (const s of [-1, 1]) {
            const hs = this._box(0.054, 0.082, 0.052, this.mats.hair);
            hs.position.set(s * 0.177, 0.116, 0.055); hg.add(hs);
        }

        // ─ ヘルメット後部パネル ─
        const bp = this._box(0.255, 0.095, 0.030, this.mats.armor);
        bp.position.set(0, 0.238, -0.184); hg.add(bp);
    }

    // ── ジオメトリヘルパー ────────────────────────────────────────────
    _grp(parent, x, y, z) {
        const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g;
    }
    _box(w, h, d, mat) {
        return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    }
    _cyl(rt, rb, h, mat) {
        return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 9), mat);
    }
    _cylOfs(rt, rb, h, mat, pos) {
        const m = this._cyl(rt, rb, h, mat); m.position.set(...pos); return m;
    }

    // ================================================================
    // フォーム切り替え
    // ================================================================
    setForm(formKey) {
        this.form = formKey;
        const c = FC[formKey] ?? FC.castoff;

        const setC = (mat, hex) => mat.color.setHex(hex);
        const setE = (mat, hex, i) => { mat.emissive.setHex(hex); mat.emissiveIntensity = i; };

        setC(this.mats.suit,  c.suit);
        setC(this.mats.armor, c.armor);
        setC(this.mats.trim,  c.trim);
        setC(this.mats.visor, c.visor);    setE(this.mats.visor, c.visorEmi, 0.8);
        setC(this.mats.skin,  c.skin);
        setC(this.mats.hair,  c.hair);
        setC(this.mats.eye,   c.eye);      setE(this.mats.eye,   c.eyeEmi,   1.5);
        setC(this.mats.embA,  c.embA);     setE(this.mats.embA,  c.embA,     1.0);
        setC(this.mats.embB,  c.embB);     setE(this.mats.embB,  c.embB,     1.0);
        setC(this.mats.cuff,  c.cuff);
        setC(this.mats.shldr, c.shldr);
        setC(this.mats.boot,  c.boot);
        setC(this.mats.hair,  c.hair);

        // 顔の表示切り替え
        const sf = c.showFace !== false;
        ['face','eyeL','eyeR','mouth','visorBar'].forEach(k => {
            if (this.R[k]) this.R[k].visible = sf;
        });
        if (this.R.heavyHelmGroup) this.R.heavyHelmGroup.visible = c.heavyHelm === true;

        // 環境
        this.ambientLight.color.setHex(c.ambient);
        this.scene.fog.color.setHex(c.fog);
        this.scene.background.setHex(c.fog);
        this.emblemPt.color.setHex(c.embA);
        this.eyePt.color.setHex(c.eyeEmi);
    }

    setState(state) {
        this.state = state;
    }

    // ================================================================
    // アニメーションループ
    // ================================================================
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
        this._blink(dt);
        this._emblemPulse(t);
        switch (this.state) {
            case 'running':   this._animRun(dt, t);     break;
            case 'talking':   this._animTalk(t);        break;
            case 'listening': this._animListen(t);      break;
            case 'thinking':  this._animThink(t);       break;
            default:          this._animIdle(t);        break;
        }
    }

    // ── まばたき ─────────────────────────────────────────────────────
    _blink(dt) {
        this.blinkTimer -= dt;
        if (this.blinkTimer <= 0 && !this.isBlinking) {
            this.isBlinking = true;
            this.blinkT = 0;
            this.blinkTimer = 4 + Math.random() * 3.5;
        }
        if (this.isBlinking) {
            this.blinkT += dt * 9;
            const sy = this.blinkT < Math.PI ? Math.max(0.05, 1 - Math.sin(this.blinkT) * 7) : 1;
            if (this.R.eyeL) this.R.eyeL.scale.y = sy;
            if (this.R.eyeR) this.R.eyeR.scale.y = sy;
            if (this.blinkT >= Math.PI) {
                this.isBlinking = false;
                [this.R.eyeL, this.R.eyeR].forEach(e => { if (e) e.scale.y = 1; });
            }
        }
    }

    // ── エンブレム脈動 ────────────────────────────────────────────────
    _emblemPulse(t) {
        const p = 0.85 + Math.sin(t * 2.5) * 0.32;
        if (this.mats.embA) this.mats.embA.emissiveIntensity = p;
        if (this.mats.embB) this.mats.embB.emissiveIntensity = p;
        this.emblemPt.intensity = 0.75 + Math.sin(t * 2.5) * 0.28;
    }

    // ── 関節リセット ─────────────────────────────────────────────────
    _reset() {
        this.charRoot.position.y = 0;
        this.charRoot.rotation.set(0, 0, 0);
        const keys = ['pelvis','spine','chest','neck','head',
            'upperArmL','upperArmR','lowerArmL','lowerArmR','handL','handR',
            'thighL','thighR','shinL','shinR','footL','footR'];
        keys.forEach(k => { if (this.J[k]) this.J[k].rotation.set(0, 0, 0); });
    }

    // ── idle ─────────────────────────────────────────────────────────
    _animIdle(t) {
        this._reset();
        const J = this.J;
        this.charRoot.position.y = Math.sin(t * 1.1) * 0.018;
        this.charRoot.rotation.y = Math.sin(t * 0.38) * 0.04;
        if (J.head) { J.head.rotation.y = Math.sin(t * 0.66) * 0.07; J.head.rotation.z = Math.sin(t * 0.52) * 0.03; }
        if (J.spine) J.spine.rotation.x = Math.sin(t * 0.7) * 0.008;
        if (J.upperArmL) { J.upperArmL.rotation.z =  0.10; J.upperArmL.rotation.x = 0.06; }
        if (J.upperArmR) { J.upperArmR.rotation.z = -0.10; J.upperArmR.rotation.x = 0.06; }
        if (J.lowerArmL) J.lowerArmL.rotation.x = 0.12;
        if (J.lowerArmR) J.lowerArmR.rotation.x = 0.12;
    }

    // ── running ──────────────────────────────────────────────────────
    _animRun(dt, t) {
        this._reset();
        const J = this.J;
        this.runPhase += dt * 7.0;
        const ph = this.runPhase;

        this.charRoot.position.y = Math.abs(Math.sin(ph)) * 0.055 - 0.020;
        if (J.pelvis) J.pelvis.rotation.y  =  Math.sin(ph) * 0.11;
        if (J.spine)  J.spine.rotation.x   = -0.14;
        if (J.chest)  J.chest.rotation.y   = -Math.sin(ph) * 0.09;
        if (J.head)   { J.head.rotation.x = 0.10; J.head.rotation.y = -J.chest.rotation.y * 0.5; }

        // 脚
        if (J.thighL) J.thighL.rotation.x =  Math.sin(ph) * 0.70;
        if (J.thighR) J.thighR.rotation.x = -Math.sin(ph) * 0.70;
        if (J.shinL)  J.shinL.rotation.x  = Math.max(0, -Math.sin(ph)) * 0.85;
        if (J.shinR)  J.shinR.rotation.x  = Math.max(0,  Math.sin(ph)) * 0.85;
        if (J.footL)  J.footL.rotation.x  = -0.20 + Math.sin(ph) * 0.20;
        if (J.footR)  J.footR.rotation.x  = -0.20 - Math.sin(ph) * 0.20;

        // 腕（逆位相）
        if (J.upperArmL) { J.upperArmL.rotation.x = -Math.sin(ph) * 0.60; J.upperArmL.rotation.z =  0.16; }
        if (J.upperArmR) { J.upperArmR.rotation.x =  Math.sin(ph) * 0.60; J.upperArmR.rotation.z = -0.16; }
        if (J.lowerArmL) J.lowerArmL.rotation.x = 0.45 + Math.max(0,  Math.sin(ph)) * 0.45;
        if (J.lowerArmR) J.lowerArmR.rotation.x = 0.45 + Math.max(0, -Math.sin(ph)) * 0.45;
    }

    // ── talking ───────────────────────────────────────────────────────
    _animTalk(t) {
        this._reset();
        const J = this.J;
        this.charRoot.position.y = Math.sin(t * 4.2) * 0.012;
        this.charRoot.rotation.y = Math.sin(t * 2.1) * 0.065;
        if (J.head) { J.head.rotation.x = Math.sin(t * 4.2) * 0.13; J.head.rotation.y = Math.sin(t * 2.6) * 0.09; }
        if (J.spine) J.spine.rotation.x = -0.06;
        if (J.pelvis) J.pelvis.rotation.y = Math.sin(t * 2.1) * 0.045;
        if (J.upperArmR) { J.upperArmR.rotation.x = -0.58 + Math.sin(t * 4.2) * 0.16; J.upperArmR.rotation.z = -0.32; }
        if (J.lowerArmR) J.lowerArmR.rotation.x = 0.70 + Math.sin(t * 4.2) * 0.14;
        if (J.upperArmL) { J.upperArmL.rotation.z = 0.14; J.upperArmL.rotation.x = 0.05; }
        if (J.lowerArmL) J.lowerArmL.rotation.x = 0.15;
    }

    // ── listening ────────────────────────────────────────────────────
    _animListen(t) {
        this._reset();
        const J = this.J;
        this.charRoot.position.y = Math.sin(t * 0.9) * 0.010;
        if (J.spine) J.spine.rotation.x = -0.09;
        if (J.head)  { J.head.rotation.z = 0.145; J.head.rotation.x = -0.07; J.head.rotation.y = Math.sin(t * 0.48) * 0.04; }
        if (J.upperArmL) { J.upperArmL.rotation.z =  0.14; J.upperArmL.rotation.x = 0.04; }
        if (J.upperArmR) { J.upperArmR.rotation.z = -0.14; J.upperArmR.rotation.x = 0.04; }
        if (J.lowerArmL) J.lowerArmL.rotation.x = 0.12;
        if (J.lowerArmR) J.lowerArmR.rotation.x = 0.12;
    }

    // ── thinking ──────────────────────────────────────────────────────
    _animThink(t) {
        this._reset();
        const J = this.J;
        this.charRoot.position.y = Math.sin(t * 0.8) * 0.010;
        if (J.head)  { J.head.rotation.z = -0.16; J.head.rotation.x = 0.09; J.head.rotation.y = Math.sin(t * 0.55) * 0.05; }
        if (J.spine) J.spine.rotation.x = -0.05;
        if (J.upperArmR) { J.upperArmR.rotation.x = -0.82; J.upperArmR.rotation.z = -0.58; }
        if (J.lowerArmR) J.lowerArmR.rotation.x = 1.12;
        if (J.upperArmL) { J.upperArmL.rotation.z = 0.14; J.upperArmL.rotation.x = 0.06; }
        if (J.lowerArmL) J.lowerArmL.rotation.x = 0.18;
    }
}

// ── 初期化 ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('three-canvas');
    if (!canvas) return;
    window.kyurokuScene = new KyurokuScene(canvas);
});
