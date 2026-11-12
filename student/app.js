
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


function escapeHtml(
  value
) {

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


function showMaintenance(
  message
) {

  app.innerHTML = `

    <main class="maintenance-page">

      <section class="maintenance-card">

        <img
          class="maintenance-icon"
          src="../assets/images/maintenance.png"
          alt="">

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


async function start() {

  /*
   * ログイン・Student権限確認
   */

  const student =
    await requireStudent();


  if (!student) {
    return;
  }


  /*
   * メンテナンス状態確認
   */

  const maintenance =
    await getMaintenance();


  /*
   * ONなら専用画面
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
   * OFFならMy Books
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


    app.innerHTML = `

      <main class="maintenance-page">

        <section class="maintenance-card">

          <img
            class="maintenance-icon"
            src="../assets/images/maintenance.png"
            alt="">

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
