import {
  requireAdmin,
  logout
}
from "../../assets/js/auth.js";

import {
  supabase
}
from "../../assets/js/supabase.js";

import {
  showError
}
from "../../assets/js/common.js";


async function start() {

  const admin =
    await requireAdmin();

  if (!admin) {
    return;
  }


  document.getElementById(
    "logout"
  ).onclick =
    logout;


  const enabled =
    document.getElementById(
      "enabled"
    );

  const message =
    document.getElementById(
      "maintenanceMessage"
    );

  const result =
    document.getElementById(
      "result"
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
      .single();


  if (error) {
    throw error;
  }


  enabled.checked =
    Boolean(
      data.enabled
    );


  message.value =
    data.message || "";


  document.getElementById(
    "save"
  ).onclick =
    async () => {

      result.textContent =
        "保存しています。";


      const {
        error
      } =
        await supabase
          .from(
            "maintenance_settings"
          )
          .update({
            enabled:
              enabled.checked,

            message:
              message.value.trim(),

            updated_at:
              new Date()
                .toISOString()
          })
          .eq(
            "id",
            1
          );


      if (error) {

        result.textContent =
          "保存エラー: " +
          error.message;

        return;

      }


      result.textContent =
        "保存しました。";

    };

}


start()
  .catch(
    error => {

      console.error(
        error
      );


      showError(
        error.message,
        document.querySelector(
          ".admin-content"
        )
      );

    }
  );
