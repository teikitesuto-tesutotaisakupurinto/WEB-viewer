
import {
  requireStudent
} from "../assets/js/auth.js";

import {
  supabase
} from "../assets/js/supabase.js";

import {
  escapeHtml
} from "../assets/js/common.js";


async function start() {

  const student =
    await requireStudent();


  if (!student) {
    return;
  }


  /*
   * メンテナンス確認
   */

  const {
    data,
    error
  } =
    await supabase
      .from(
        "maintenance_settings"
      )
      .select(
        "enabled,message"
      )
      .eq(
        "id",
        1
      )
      .maybeSingle();


  if (error) {

    showError(
      "メンテナンス設定を取得できませんでした。\n" +
      error.message
    );

    return;

  }


  /*
   * メンテナンス中
   */

  if (
    data?.enabled
  ) {

    document.getElementById(
      "app"
    ).innerHTML = `

      <div class="maintenance-page">

        <div class="maintenance-card">

          <div class="maintenance-logo">
            WEB-viewer
          </div>

          <h1>
            メンテナンス中です
          </h1>

          <p>
            ${escapeHtml(
              data.message ||
              "現在メンテナンス中です。"
            )}
          </p>

          <button
            id="logout"
            type="button"
            class="maintenance-logout">

            ログアウト

          </button>

        </div>

      </div>

    `;

    /*
     * auth.jsはすでに読み込まれているので
     * 動的に追加したボタンをここで接続
     */

    document
      .getElementById(
        "logout"
      )
      ?.addEventListener(
        "click",
        async () => {

          const {
            logout
          } =
            await import(
              "../assets/js/auth.js"
            );

          logout();

        }
      );

    return;

  }


  /*
   * 通常時
   */

  window.location.replace(
    "./books/"
  );

}


function showError(
  message
) {

  document.getElementById(
    "app"
  ).innerHTML = `

    <div class="maintenance-page">

      <div class="maintenance-card">

        <h1>
          読み込みに失敗しました
        </h1>

        <p>
          ${escapeHtml(
            message
          )}
        </p>

        <button
          type="button"
          onclick="location.reload()">

          再読み込み

        </button>

      </div>

    </div>

  `;

}


start()
  .catch(
    error => {

      console.error(
        "STUDENT ERROR:",
        error
      );

      showError(
        error.message ||
        "予期しないエラーが発生しました。"
      );

    }
  );
