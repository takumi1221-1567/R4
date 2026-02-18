// =====================================================================
// PlayerController.cs
// R4 Project — ロックマンXスタイル キャラクター制御
// =====================================================================
// 機能:
//   - WASD / 矢印キー / 仮想パッド で移動
//   - Run / Idle / Turn アニメーション切り替え
//   - 方向転換時はスムーズ回転 + Turn アニメーション再生
//   - 会話中は移動速度を落とす（KYUROKU.ainasとの会話モードと統合）
// =====================================================================

using System.Collections;
using UnityEngine;
using UnityEngine.InputSystem;

namespace R4.Character
{
    [RequireComponent(typeof(CharacterController))]
    public class PlayerController : MonoBehaviour
    {
        // ── Inspector 設定 ──────────────────────────────────────────
        [Header("移動設定")]
        [SerializeField] private float moveSpeed      = 5.0f;
        [SerializeField] private float runSpeed       = 9.0f;
        [SerializeField] private float gravity        = -9.81f;
        [SerializeField] private float turnSmoothTime = 0.10f;
        [SerializeField] private float chatSpeedMult  = 0.4f;  // 会話中の速度倍率

        [Header("アニメーション設定")]
        [SerializeField] private Animator animator;
        [SerializeField] private float    animBlendSpeed = 10f;

        [Header("カメラ追従")]
        [SerializeField] private Transform cameraTransform;
        [SerializeField] private bool      useRelativeMovement = true;

        // ── Animator パラメータ名 ──
        private static readonly int ANIM_SPEED       = Animator.StringToHash("Speed");
        private static readonly int ANIM_IS_TURN     = Animator.StringToHash("IsTurning");
        private static readonly int ANIM_IS_RUN      = Animator.StringToHash("IsRunning");
        private static readonly int ANIM_IS_TALKING  = Animator.StringToHash("IsTalking");   // TTS再生中
        private static readonly int ANIM_IS_LISTENING = Animator.StringToHash("IsListening"); // STT録音中

        // ── 内部状態 ──────────────────────────────────────────────
        private CharacterController cc;
        private Vector3  velocity;
        private Vector3  moveDir;
        private float    currentSpeed;
        private float    turnSmoothVelocity;
        private bool     isGrounded;
        private bool     isChatMode   = false;
        private bool     isTurning    = false;
        private Coroutine turnCoroutine;

        // 仮想パッド用（UI スティックから値を渡す）
        private Vector2 virtualInput = Vector2.zero;

        // ────────────────────────────────────────────────────────────
        private void Awake()
        {
            cc = GetComponent<CharacterController>();
            if (cameraTransform == null && Camera.main != null)
                cameraTransform = Camera.main.transform;
        }

        private void Update()
        {
            HandleGroundCheck();
            HandleMovement();
            ApplyGravity();
        }

        // ────────────────────────────────────────────────────────────
        // 移動処理
        // ────────────────────────────────────────────────────────────
        private void HandleMovement()
        {
            // キーボード入力 + 仮想パッド
            float h = GetHorizontalInput();
            float v = GetVerticalInput();

            Vector3 input = new Vector3(h, 0f, v);
            if (input.magnitude > 1f) input.Normalize();

            bool   isMoving = input.magnitude > 0.1f;
            bool   isRun    = isMoving && IsSprintPressed();
            float  targetSpeed = isChatMode
                ? moveSpeed * chatSpeedMult
                : (isRun ? runSpeed : (isMoving ? moveSpeed : 0f));

            currentSpeed = Mathf.Lerp(currentSpeed, targetSpeed, Time.deltaTime * animBlendSpeed);

            // カメラ相対移動
            if (isMoving)
            {
                float targetAngle = Mathf.Atan2(input.x, input.z) * Mathf.Rad2Deg;
                if (useRelativeMovement && cameraTransform != null)
                    targetAngle += cameraTransform.eulerAngles.y;

                float prevAngle  = transform.eulerAngles.y;
                float angleDelta = Mathf.DeltaAngle(prevAngle, targetAngle);

                // 大きく方向転換した場合: Turn アニメ再生
                if (Mathf.Abs(angleDelta) > 80f && !isTurning)
                    StartTurnAnimation();

                float smoothAngle = Mathf.SmoothDampAngle(
                    prevAngle, targetAngle, ref turnSmoothVelocity, turnSmoothTime);
                transform.rotation = Quaternion.Euler(0f, smoothAngle, 0f);

                moveDir = Quaternion.Euler(0f, targetAngle, 0f) * Vector3.forward;
            }
            else
            {
                moveDir = Vector3.zero;
            }

            cc.Move(moveDir * currentSpeed * Time.deltaTime);

            // アニメーター更新
            if (animator != null)
            {
                animator.SetFloat(ANIM_SPEED,  currentSpeed / runSpeed);
                animator.SetBool(ANIM_IS_RUN,  isRun && isMoving);
                animator.SetBool(ANIM_IS_TURN, isTurning);
            }
        }

        private void HandleGroundCheck()
        {
            isGrounded = cc.isGrounded;
            if (isGrounded && velocity.y < 0f)
                velocity.y = -2f;
        }

        private void ApplyGravity()
        {
            velocity.y += gravity * Time.deltaTime;
            cc.Move(velocity * Time.deltaTime);
        }

        // ────────────────────────────────────────────────────────────
        // 振り向きアニメーション
        // ────────────────────────────────────────────────────────────
        private void StartTurnAnimation()
        {
            if (turnCoroutine != null) StopCoroutine(turnCoroutine);
            turnCoroutine = StartCoroutine(TurnAnimRoutine());
        }

        private IEnumerator TurnAnimRoutine()
        {
            isTurning = true;
            yield return new WaitForSeconds(0.5f);   // Turn アニメの尺に合わせて調整
            isTurning = false;
        }

        // ────────────────────────────────────────────────────────────
        // 入力取得
        // ────────────────────────────────────────────────────────────
        private float GetHorizontalInput()
        {
            float kb = 0f;
            if (Keyboard.current != null)
            {
                if (Keyboard.current.aKey.isPressed || Keyboard.current.leftArrowKey.isPressed)  kb -= 1f;
                if (Keyboard.current.dKey.isPressed || Keyboard.current.rightArrowKey.isPressed) kb += 1f;
            }
            return Mathf.Abs(virtualInput.x) > Mathf.Abs(kb) ? virtualInput.x : kb;
        }

        private float GetVerticalInput()
        {
            float kb = 0f;
            if (Keyboard.current != null)
            {
                if (Keyboard.current.sKey.isPressed || Keyboard.current.downArrowKey.isPressed)  kb -= 1f;
                if (Keyboard.current.wKey.isPressed || Keyboard.current.upArrowKey.isPressed)    kb += 1f;
            }
            return Mathf.Abs(virtualInput.y) > Mathf.Abs(kb) ? virtualInput.y : kb;
        }

        private bool IsSprintPressed()
        {
            if (Keyboard.current == null) return false;
            return Keyboard.current.leftShiftKey.isPressed ||
                   Keyboard.current.rightShiftKey.isPressed;
        }

        // ────────────────────────────────────────────────────────────
        // 公開メソッド（UI・会話システムから呼び出す）
        // ────────────────────────────────────────────────────────────

        /// <summary>仮想スティック入力を設定（モバイル/WebGL UI用）</summary>
        public void SetVirtualInput(Vector2 input)
        {
            virtualInput = Vector2.ClampMagnitude(input, 1f);
        }

        /// <summary>会話モード切り替え（移動速度低下）</summary>
        public void SetChatMode(bool enabled)
        {
            isChatMode = enabled;
        }

        /// <summary>
        /// KYUROKU がしゃべっているアニメを再生/停止する。
        /// TTS 再生開始/終了時に ChatUI から呼び出す。
        /// </summary>
        public void SetTalking(bool talking)
        {
            if (animator == null) return;
            animator.SetBool(ANIM_IS_TALKING, talking);
        }

        /// <summary>
        /// KYUROKU が聴いているアニメを再生/停止する。
        /// STT 録音開始/終了時に ChatUI から呼び出す。
        /// </summary>
        public void SetListening(bool listening)
        {
            if (animator == null) return;
            animator.SetBool(ANIM_IS_LISTENING, listening);
        }

        /// <summary>現在の移動速度を返す（UI表示用）</summary>
        public float GetCurrentSpeed() => currentSpeed;
    }
}
