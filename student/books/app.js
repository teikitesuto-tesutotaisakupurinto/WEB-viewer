import {
  requireStudent
}
from "../../assets/js/auth.js";

import {
  supabase
}
from "../../assets/js/supabase.js";

import {
  escapeHtml
}
from "../../assets/js/common.js";


const student =
  await requireStudent();

if (!student) {
  throw new Error("Unauthorized");
}


async function loadBooks() {

  const {
    data,
    error
  } =
    await supabase
      .from("licenses")
      .select(`
        id,
        book_id,
        status,
        books (
          title,
          description
        )
      `)
      .eq(
        "student_id",
        student.id
      )
      .eq(
        "status",
        "used"
      );


  if (error) {

    console.error(error);

    return;
  }


  document.getElementById(
    "books"
  ).innerHTML =
    (data || []).map(item => `

<div class="card">

<h3>
${escapeHtml(
  item.books?.title || ""
)}
</h3>

<p>
${escapeHtml(
  item.books?.description || ""
)}
</p>

<button
  class="primary-button"
  data-book="${item.book_id}">
開く
</button>

</div>

`).join("") ||
`<div class="card">
登録されたBookはありません。
</div>`;


  document
    .querySelectorAll(
      "[data-book]"
    )
    .forEach(button => {

      button.onclick = () => {

        location.href =
          "../viewer/?book=" +
          encodeURIComponent(
            button.dataset.book
          );

      };

    });

}


document.getElementById(
  "register"
).onclick = async () => {

  const code =
    document.getElementById(
      "code"
    ).value.trim();


  if (!code) {

    return;
  }


  const {
    data: license,
    error
  } =
    await supabase
      .from("licenses")
      .select("*")
      .eq(
        "code",
        code
      )
      .maybeSingle();


  if (
    error ||
    !license
  ) {

    document.getElementById(
      "message"
    ).textContent =
      "コードが見つかりません。";

    return;
  }


  if (
    license.status !== "unused" ||
    license.student_id
  ) {

    document.getElementById(
      "message"
    ).textContent =
      "このコードはすでに使用されています。";

    return;
  }


  const {
    error: updateError
  } =
    await supabase
      .from("licenses")
      .update({
        status: "used",
        student_id: student.id,
        used_at:
          new Date().toISOString()
      })
      .eq(
        "id",
        license.id
      )
      .eq(
        "status",
        "unused"
      );


  if (updateError) {

    document.getElementById(
      "message"
    ).textContent =
      "登録できませんでした。";

    return;
  }


  document.getElementById(
    "message"
  ).textContent =
    "登録しました。";


  document.getElementById(
    "code"
  ).value = "";


  await loadBooks();

};


document.getElementById(
  "scan"
).onclick = () => {

  const reader =
    document.getElementById(
      "reader"
    );


  reader.classList.toggle(
    "hidden"
  );


  if (
    reader.classList.contains(
      "hidden"
    )
  ) {

    return;
  }


  const script =
    document.createElement(
      "script"
    );


  script.src =
    "https://unpkg.com/html5-qrcode";


  script.onload = () => {

    const scanner =
      new Html5Qrcode(
        "reader"
      );


    scanner.start(
      {
        facingMode:
          "environment"
      },
      {
        fps: 10,
        qrbox: 250
      },
      async code => {

        document.getElementById(
          "code"
        ).value = code;


        try {
          await scanner.stop();
        } catch {}


        reader.classList.add(
          "hidden"
        );


        document.getElementById(
          "register"
        ).click();

      },
      () => {}
    );

  };


  document.head.appendChild(
    script
  );

};


loadBooks();
