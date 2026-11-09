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
  <th>形式</th>
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
${escapeHtml(
  book.file_type || ""
)}
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

  const files =
    Array.from(
      document.getElementById(
        "file"
      ).files
    );


  if (
    !title ||
    !serial ||
    files.length === 0
  ) {

    alert(
      "Book名、Bookシリアル、教材ファイルを入力してください。"
    );

    return;
  }


  const extensions =
    files.map(
      file =>
        file.name
          .split(".")
          .pop()
          .toLowerCase()
    );


  const allowed = [
    "pdf",
    "jpg",
    "jpeg",
    "png"
  ];


  if (
    extensions.some(
      extension =>
        !allowed.includes(extension)
    )
  ) {

    alert(
      "PDF、JPG、JPEG、PNGのみ対応しています。"
    );

    return;
  }


  const hasPdf =
    extensions.includes("pdf");


  if (
    hasPdf &&
    files.length !== 1
  ) {

    alert(
      "PDFの場合は1ファイルだけ選択してください。"
    );

    return;
  }


  if (
    !hasPdf &&
    files.some(
      file =>
        ![
          "jpg",
          "jpeg",
          "png"
        ].includes(
          file.name
            .split(".")
            .pop()
            .toLowerCase()
        )
    )
  ) {

    alert(
      "画像BookはJPG、JPEG、PNGのみ対応しています。"
    );

    return;
  }


  const firstExtension =
    extensions[0];


  const isPdf =
    firstExtension === "pdf";


  let bookPath = null;


  if (isPdf) {

    const file =
      files[0];

    const path =
      "books/" +
      crypto.randomUUID() +
      ".pdf";


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
        "PDFのアップロードに失敗しました。"
      );

      return;
    }


    bookPath = path;


  } else {

    bookPath = null;

  }


  const {
    data: book,
    error: bookError
  } =
    await supabase
      .from("books")
      .insert({
        title,
        book_serial: serial,
        description,
        file_path: bookPath,
        file_type: isPdf
          ? "pdf"
          : firstExtension,
        created_by: admin.id
      })
      .select()
      .single();


  if (bookError) {

    console.error(bookError);

    if (bookPath) {

      await supabase.storage
        .from("web-viewer")
        .remove([
          bookPath
        ]);

    }

    alert(
      "Book登録に失敗しました。"
    );

    return;
  }


  if (!isPdf) {

    const pageRows = [];


    for (
      let index = 0;
      index < files.length;
      index++
    ) {

      const file =
        files[index];

      const extension =
        file.name
          .split(".")
          .pop()
          .toLowerCase();


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

        continue;
      }


      pageRows.push({
        book_id:
          book.id,

        page_number:
          index + 1,

        file_path:
          path,

        file_type:
          extension
      });

    }


    if (pageRows.length > 0) {

      await supabase
        .from("book_pages")
        .insert(
          pageRows
        );

    }

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
    "Bookを登録しました。";


  await loadBooks();

};


loadBooks();
