
import {
  requireAdmin,
  logout
}
from "../assets/js/auth.js";

import {
  showError
}
from "../assets/js/common.js";


async function start() {

  const admin =
    await requireAdmin();


  if (!admin) {
    return;
  }


  const logoutButton =
    document.getElementById(
      "logout"
    );


  if (logoutButton) {

    logoutButton.onclick =
      async event => {

        event.preventDefault();

        await logout();

      };

  }

}


start()
  .catch(
    error => {

      console.error(
        "ADMIN ERROR:",
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
