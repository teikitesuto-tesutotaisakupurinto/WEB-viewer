
import {
  requireAdmin,
  logout
}
from "../assets/js/auth.js";

import {
  supabase
}
from "../assets/js/supabase.js";

import {
  escapeHtml
}
from "../assets/js/common.js";


async function loadMaintenance() {

  const banner =
    document.getElementById(
      "maintenanceBanner"
    );

  const message =
    document.getElementById(
      "maintenanceBannerMessage"
    );


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

    console.warn(
      "MAINTENANCE LOAD ERROR:",
      error
    );

    return;
  }


  if (
    !data?.enabled
  ) {

    banner.classList.add(
      "hidden"
    );

    return;
  }


  message.textContent =
    data.message || "";


  banner.classList.remove(
    "hidden"
  );

}


async function loadDashboard() {

  const errorBox =
    document.getElementById(
      "dashboardError"
    );


  try {

    const [
      books,
      students,
      licenses
    ] =
    await Promise.all([

      supabase
        .from("books")
        .select(
          "id",
          {
            count:
              "exact",
            head:
              true
          }
        ),

      supabase
        .from("users")
        .select(
          "id",
          {
            count:
              "exact",
            head:
              true
          }
        )
        .eq(
          "role",
          "student"
        ),

      supabase
        .from("licenses")
        .select(
          "id",
          {
            count:
              "exact",
            head:
              true
          }
        )

    ]);


    if (books.error) {
      throw books.error;
    }


    if (students.error) {
      throw students.error;
    }


    if (licenses.error) {
      throw licenses.error;
    }


    document.getElementById(
      "bookCount"
    ).textContent =
      books.count ?? 0;


    document.getElementById(
      "studentCount"
    ).textContent =
      students.count ?? 0;


    document.getElementById(
      "licenseCount"
    ).textContent =
      licenses.count ?? 0;

  }
  catch (error) {

    console.error(
      "DASHBOARD ERROR:",
      error
    );


    errorBox.innerHTML = `

      <div class="page-error">

        <h2>
          ダッシュボード情報を取得できませんでした
        </h2>

        <p>
          データの読み込みに失敗しました。
        </p>

        <button
          type="button"
          class="primary-button"
          onclick="location.reload()">

          再読み込み

        </button>

      </div>

    `;

  }

}


async function start() {

  const admin =
    await requireAdmin();


  if (!admin) {
    return;
  }


  document.getElementById(
    "logout"
  ).onclick =
    event => {

      event.preventDefault();

      logout();

    };


  await loadMaintenance();

  await loadDashboard();

}


start()
.catch(
  error => {

    console.error(
      "ADMIN START ERROR:",
      error
    );


    const target =
      document.getElementById(
        "dashboardError"
      );


    target.innerHTML = `

      <div class="page-error">

        <h2>
          管理画面を読み込めませんでした
        </h2>

        <p>
          システムへの接続を確認してください。
        </p>

        <button
          type="button"
          class="primary-button"
          onclick="location.reload()">

          再読み込み

        </button>

      </div>

    `;

  }
);
