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
      .select("*")
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


  document.getElementById(
    "books"
  ).innerHTML = `

<table>

<thead>

<tr>
<th>Book名</th>
<th>Bookシリアル</th>
<th>状態</th>
</tr>

</thead>

<tbody>

${(data || []).map(book => `

<tr>

<td>
${escapeHtml(book.title)}
</td>

<td>
${escapeHtml(book.book_serial)}
</td>

<td>
${book.enabled ? "有効" : "停止"}
</td>

</tr>

`).join("")}

</tbody>

</table>

`;

}


document.getElementById(
  "create"
).onclick = async () => {

  const title =
    document.getElementById(
      "title"
    ).value.trim();

  const serial =
    document.getElementById(
      "serial"
    ).value.trim();

  const description =
    document.getElementById(
      "description"
    ).value.trim();

  const file =
    document.getElementById(
      "file"
    ).files[0];


  if (
    !title ||
    !serial ||
    !file
  ) {

    alert(
      "Book名、Bookシリアル、教材ファイルを入力してください。"
    );

    return;
  }


  const extension =
    file.name
      .split(".")
      .pop()
      .toLowerCase();


  if (
    ![
      "pdf",
      "jpg",
      "jpeg",
      "png"
    ].includes(extension)
  ) {

    alert(
      "PDF、JPG、JPEG、PNGのみ対応しています。"
    );

    return;
  }


  const path =
    "books/" +
    crypto.randomUUID() +
    "." +
    extension;


  const upload =
    await supabase.storage
      .from("web-viewer")
      .upload(
        path,
        file,
        {
          upsert: false
        }
      );


  if (upload.error) {

    console.error(
      upload.error
    );

    alert(
      "教材ファイルのアップロードに失敗しました。"
    );

    return;
  }


  const {
    data: book,
    error
  } =
    await supabase
      .from("books")
      .insert({
        title,
        book_serial: serial,
        description,
        created_by: admin.id
      })
      .select()
      .single();


  if (error) {

    await supabase.storage
      .from("web-viewer")
      .remove([path]);

    alert(
      "Book登録に失敗しました。"
    );

    return;
  }


  const {
    error: pageError
  } =
    await supabase
      .from("book_pages")
      .insert({
        book_id: book.id,
        page_number: 1,
        file_path: path,
        file_type: extension
      });


  if (pageError) {

    console.error(pageError);

    alert(
      "Bookページ登録に失敗しました。"
    );

    return;
  }


  document.getElementById(
    "title"
  ).value = "";

  document.getElementById(
    "serial"
  ).value = "";

  document.getElementById(
    "description"
  ).value = "";

  document.getElementById(
    "file"
  ).value = "";


  document.getElementById(
    "message"
  ).textContent =
    "登録しました。";


  await loadBooks();

};


loadBooks();
