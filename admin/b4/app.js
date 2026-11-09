import {
  requireAdmin
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


const admin =
  await requireAdmin();

if (!admin) {
  throw new Error("Unauthorized");
}


async function loadBooks() {

  const {
    data,
    error
  } =
    await supabase
      .from("books")
      .select(
        "id,title"
      )
      .eq(
        "enabled",
        true
      )
      .order(
        "title"
      );


  if (error) {

    console.error(error);

    return;
  }


  document.getElementById(
    "book"
  ).innerHTML =
    (data || []).map(
      book => `

<option value="${book.id}">
${escapeHtml(book.title)}
</option>

`
    ).join("");
}


document.getElementById(
  "preview"
).onclick = async () => {

  const bookId =
    document.getElementById(
      "book"
    ).value;


  const {
    data: book
  } =
    await supabase
      .from("books")
      .select(
        "id,title"
      )
      .eq(
        "id",
        bookId
      )
      .single();


  if (!book) {
    return;
  }


  const code =
    document.getElementById(
      "code"
    ).value.trim();


  if (!code) {

    alert(
      "シリアルコードを入力してください。"
    );

    return;
  }


  document.getElementById(
    "sheet"
  ).innerHTML = `

<div class="b4-sheet">

<h2>
電子教材利用案内
</h2>

<div>
Book名:
${escapeHtml(book.title)}
</div>

<div>
クラス:
${escapeHtml(
  document.getElementById(
    "className"
  ).value
)}
</div>

<div>
氏名:
${escapeHtml(
  document.getElementById(
    "studentName"
  ).value
)}
</div>

<div
  id="qr"
  style="
    width:250px;
    height:250px;
  ">
</div>

<div class="b4-code">
${escapeHtml(code)}
</div>

<div>
WEB-viewerにログインして利用してください。
</div>

<div class="b4-note">
※ 紛失の場合はこちらでは対応しかねますのでご注意ください。
</div>

</div>
`;


  const script =
    document.createElement(
      "script"
    );


  script.src =
    "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";


  script.onload = () => {

    new QRCode(
      document.getElementById(
        "qr"
      ),
      {
        text: code,
        width: 250,
        height: 250
      }
    );

  };


  document.head.appendChild(
    script
  );

};


document.getElementById(
  "print"
).onclick = () => {

  window.print();

};


loadBooks();
