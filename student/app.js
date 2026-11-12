
import {
  requireStudent,
  logout
}
from "../assets/js/auth.js";

import {
  supabase
}
from "../assets/js/supabase.js";


const app =
  document.getElementById(
    "app"
  );


function escapeHtml(value) {

  return String(
    value || ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

}


/* =========================================================
   メンテナンス状態
   ========================================================= */

async function getMaintenance() {

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
    throw error;
  }


  return data || {

    enabled:
      false,

    message:
      ""

  };

}


/* =========================================================
   メンテナンス画面
   ========================================================= */

function showMaintenance(
  message
) {

  app.innerHTML = `

    <main class="maintenance-page">

      <section class="maintenance-card">


        <!-- =============================================
             レンチ
             Adminと同じSVG
             ============================================= -->

        <div
          class="maintenance-icon"
          aria-hidden="true">

          <svg
            viewBox="0 0 64 64"
            xmlns="http://www.w3.org/2000/svg">

            <circle
              cx="32"
              cy="32"
              r="30"
              fill="#FFF1E3">
            </circle>


            <path
              d="
                M43.7 13.8
                C39.8 11.2 34.7 11.1 30.7 13.4
                C26.1 16.1 23.7 21.4 24.5 26.5
                L13.4 37.6
                C11.8 39.2 11.8 41.8 13.4 43.4
                L20.6 50.6
                C22.2 52.2 24.8 52.2 26.4 50.6
                L37.5 39.5
                C42.6 40.3 47.9 37.9 50.6 33.3
                C52.9 29.3 52.8 24.2 50.2 20.3
                L42.1 28.4
                C40.6 29.9 38.2 29.9 36.7 28.4
                L35.6 27.3
                C34.1 25.8 34.1 23.4 35.6 21.9
                Z
              "
              fill="none"
              stroke="#F2762B"
              stroke-width="3.2"
              stroke-linecap="round"
              stroke-linejoin="round">
            </path>

          </svg>

        </div>


        <div class="maintenance-logo">
          WEB-viewer
        </div>


        <h1>
          メンテナンス中です
        </h1>


        ${
          message
            ? `
              <p class="maintenance-message">
                ${escapeHtml(message)}
              </p>
            `
            : ""
        }


        <button
          id="logout"
          type="button"
          class="maintenance-logout">

          ログアウト

        </button>


      </section>

    </main>

  `;


  document.getElementById(
    "logout"
  ).onclick =
    event => {

      event.preventDefault();

      logout();

    };

}


/* =========================================================
   起動
   ========================================================= */

async function start() {

  /*
   * Student権限確認
   *
   * 直接URLでも必ずチェック
   */

  const student =
    await requireStudent();


  if (!student) {
    return;
  }


  /*
   * メンテナンス確認
   */

  const maintenance =
    await getMaintenance();


  /*
   * ON
   */

  if (
    maintenance.enabled
  ) {

    showMaintenance(
      maintenance.message
    );

    return;

  }


  /*
   * OFF
   */

  window.location.replace(
    "./books/"
  );

}


start()
.catch(
  error => {

    console.error(
      "STUDENT START ERROR:",
      error
    );


    /*
     * 内部エラーの詳細は
     * 生徒には表示しない
     */

    app.innerHTML = `

      <main class="maintenance-page">

        <section class="maintenance-card">


          <div
            class="maintenance-icon"
            aria-hidden="true">

            <svg
              viewBox="0 0 64 64"
              xmlns="http://www.w3.org/2000/svg">

              <circle
                cx="32"
                cy="32"
                r="30"
                fill="#FFF1E3">
              </circle>


              <path
                d="
                  M43.7 13.8
                  C39.8 11.2 34.7 11.1 30.7 13.4
                  C26.1 16.1 23.7 21.4 24.5 26.5
                  L13.4 37.6
                  C11.8 39.2 11.8 41.8 13.4 43.4
                  L20.6 50.6
                  C22.2 52.2 24.8 52.2 26.4 50.6
                  L37.5 39.5
                  C42.6 40.3 47.9 37.9 50.6 33.3
                  C52.9 29.3 52.8 24.2 50.2 20.3
                  L42.1 28.4
                  C40.6 29.9 38.2 29.9 36.7 28.4
                  L35.6 27.3
                  C34.1 25.8 34.1 23.4 35.6 21.9
                  Z
                "
                fill="none"
                stroke="#F2762B"
                stroke-width="3.2"
                stroke-linecap="round"
                stroke-linejoin="round">
              </path>

            </svg>

          </div>


          <div class="maintenance-logo">
            WEB-viewer
          </div>


          <h1>
            読み込みに失敗しました
          </h1>


          <p class="maintenance-message">
            システムを確認してから、もう一度お試しください。
          </p>


          <button
            type="button"
            class="maintenance-retry"
            onclick="location.reload()">

            再読み込み

          </button>


        </section>

      </main>

    `;

  }

);
