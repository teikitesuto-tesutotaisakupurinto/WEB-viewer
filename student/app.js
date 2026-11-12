
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
  document.getElementById("app");


function escapeHtml(value) {

  return String(value || "")
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


async function start() {

  const student =
    await requireStudent();


  if (!student) {
    return;
  }


  const params =
    new URLSearchParams(
      location.search
    );


  const maintenance =
    params.get(
      "maintenance"
    );


  /*
   * URLにmaintenance=1が付いている場合
   * DBも再確認する
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
    throw error;
  }


  if (
    maintenance === "1" ||
    data?.enabled
  ) {

    showMaintenance(
      data?.message || ""
    );

    return;
  }


  /*
   * 通常時はMy Booksへ
   */

  location.replace(
    "./books/"
  );

}


function showMaintenance(
  message
) {

  app.innerHTML = `

    <main class="maintenance-page">

      <section class="maintenance-card">

        <div class="maintenance-icon">

          <svg
            viewBox="0 0 24 24"
            aria-hidden="true">

            <path
              d="M14.7 6.3a5 5 0 0 0-6.36 6.36L3.5 17.5a1.75 1.75 0 1 0 2.47 2.47l4.84-4.84A5 5 0 0 0 17.7 8.77l-3.18 3.18a2.5 2.5 0 1 1-3.54-3.54l3.18-3.18a5 5 0 0 0-1.46-.93Z">
            </path>

          </svg>

        </div>


        <div class="maintenance-logo">
          WEB-viewer
        </div>


        <h1>
          メンテナンス中です
        </h1>


        <p>
          ${escapeHtml(message)}
        </p>


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


start()
  .catch(
    error => {

      console.error(
        "STUDENT ERROR:",
        error
      );


      app.innerHTML = `

        <main class="maintenance-page">

          <section class="maintenance-card">

            <div class="maintenance-logo">
              WEB-viewer
            </div>

            <h1>
              読み込みに失敗しました
            </h1>

            <p>
              システムを確認してから
              もう一度お試しください。
            </p>

            <button
              type="button"
              onclick="location.reload()">

              再読み込み

            </button>

          </section>

        </main>

      `;

    }
  );
