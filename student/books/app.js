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


const message =
  document.getElementById(
    "message"
  );


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
        code,
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
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      );


  if (error) {

    console.error(error);

    return;
  }


  const container =
    document.getElementById(
      "books"
    );


  if (
    !data ||
    data.length === 0
  ) {

    container.innerHTML = `
      <div class="card">
        登録されたBookはありません。
      </div>
    `;

    return;
  }


  container.innerHTML =
    data.map(
      item => `

<div class="card">

<h2>
${escapeHtml(
  item.books?.title || ""
)}
</h2>

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

`
    ).join("");


  container
    .querySelectorAll(
      "[data-book]"
    )
    .forEach(
      button => {

        button.onclick = () => {

          location.href =
            "../viewer/?book=" +
            encodeURIComponent(
              button.dataset.book
            );

        };

      }
    );

}


document.getElementById(
  "register"
).onclick = async () => {

  message.textContent =
    "確認しています。";

  message.style.color =
    "#222";


  const code =
    document.getElementById(
      "code"
    ).value
      .trim()
      .toUpperCase();


  if (!code) {

    message.textContent =
      "シリアルコードを入力してください。";

    return;
  }


  /*
   * 自分に割り当てられた
   * 未使用コードだけを取得
   */

  const {
    data: license,
    error
  } =
    await supabase
      .from("licenses")
      .select(`
        id,
        book_id,
        code,
        student_id,
        status
      `)
      .eq(
        "code",
        code
      )
      .maybeSingle();


  if (error) {

    console.error(error);

    message.textContent =
      "シリアルコードを確認できませんでした。";

    return;
  }


  if (!license) {

    message.textContent =
      "シリアルコードが見つかりません。";

    return;
  }


  /*
   * 他のStudent用コード
   */

  if (
    license.student_id !==
    student.id
  ) {

    message.textContent =
      "このシリアルコードはこのStudentでは使用できません。";

    return;
  }


  /*
   * すでに使用済み
   */

  if (
    license.status === "used"
  ) {

    message.textContent =
      "このシリアルコードはすでに使用されています。";

    return;
  }


  /*
   * 停止されたコード
   */

  if (
    license.status === "disabled"
  ) {

    message.textContent =
      "このシリアルコードは使用できません。";

    return;
  }


  /*
   * unused
   * → used
   */

  const {
    data: updated,
    error: updateError
  } =
    await supabase
      .from("licenses")
      .update({
        status:
          "used",

        used_at:
          new Date().toISOString()
      })
      .eq(
        "id",
        license.id
      )
      .eq(
        "student_id",
        student.id
      )
      .eq(
        "status",
        "unused"
      )
      .select()
      .single();


  if (updateError) {

    console.error(
      updateError
    );

    message.textContent =
      "シリアルコードを登録できませんでした。";

    return;
  }


  if (!updated) {

    message.textContent =
      "シリアルコードを登録できませんでした。";

    return;
  }


  message.style.color =
    "#222";

  message.textContent =
    "Bookを登録しました。";


  document.getElementById(
    "code"
  ).value =
    "";


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


  if (
    window.Html5Qrcode
  ) {

    startScanner();

    return;
  }


  const script =
    document.createElement(
      "script"
    );


  script.src =
    "https://unpkg.com/html5-qrcode";


  script.onload =
    startScanner;


  document.head.appendChild(
    script
  );


  function startScanner() {

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
      async decoded => {

        document.getElementById(
          "code"
        ).value =
          decoded;


        try {

          await scanner.stop();

        }
        catch {}


        reader.classList.add(
          "hidden"
        );


        document.getElementById(
          "register"
        ).click();

      },
      () => {}
    );

  }

};


loadBooks();
