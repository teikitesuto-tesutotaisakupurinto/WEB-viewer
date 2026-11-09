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
  escapeHtml
}
from "../../assets/js/common.js";


const admin =
  await requireAdmin();


if (!admin) {

  throw new Error(
    "Unauthorized"
  );

}


const formCard =
  document.getElementById(
    "formCard"
  );


const message =
  document.getElementById(
    "message"
  );


const booksContainer =
  document.getElementById(
    "books"
  );


document.getElementById(
  "logout"
).onclick =
  logout;


/*
 * フォーム表示
 */

document.getElementById(
  "showForm"
).onclick = () => {

  formCard.classList.remove(
    "hidden"
  );

  message.textContent =
    "";

};


/*
 * キャンセル
 */

document.getElementById(
  "cancel"
).onclick = () => {

  formCard.classList.add(
    "hidden"
  );

  message.textContent =
    "";

};


/*
 * Book一覧
 */

async function loadBooks() {

  booksContainer.innerHTML =
    `
    <div class="book-empty">
      読み込み中です。
    </div>
    `;


  const {
    data,
    error
  } =
    await supabase
      .from("books")
      .select(`
        id,
        title,
        description,
        book_serial,
        file_type,
        enabled,
        created_at
      `)
      .order(
        "created_at",
        {
          ascending: false
        }
      );


  if (error) {

    console.error(
      "BOOK LIST ERROR:",
      error
    );


    booksContainer.innerHTML =
      `
      <div class="book-empty">
        Bookを取得できませんでした。
      </div>
      `;

    return;
  }


  if (
    !data ||
    data.length === 0
  ) {

    booksContainer.innerHTML =
      `
      <div class="book-empty">
        登録されたBookはありません。
      </div>
      `;

    return;
  }


  booksContainer.innerHTML =
    data.map(
      book => `

<article class="book-admin-item">

<div class="book-admin-main">

<div class="book-admin-title">
${escapeHtml(
  book.title
)}
</div>

<div class="book-admin-description">
${escapeHtml(
  book.description || ""
)}
</div>

<div class="book-admin-serial">
Bookシリアル:
${escapeHtml(
  book.book_serial || ""
)}
</div>

<div class="book-admin-type">
${escapeHtml(
  book.file_type || ""
)}
</div>

</div>

<div class="book-admin-status">

${
  book.enabled
    ? "公開"
    : "停止"
}

</div>

</article>

`
    ).join("");

}


/*
 * Book登録
 */

document.getElementById(
  "create"
).onclick = async () => {

  const title =
    document.getElementById(
      "title"
    ).value.trim();


  const description =
    document.getElementById(
      "description"
    ).value.trim();


  const files =
    Array.from(
      document.getElementById(
        "files"
      ).files
    );


  if (
    !title
  ) {

    message.textContent =
      "Book名を入力してください。";

    return;
  }


  if (
    files.length === 0
  ) {

    message.textContent =
      "教材ファイルを選択してください。";

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
        !allowed.includes(
          extension
        )
    )
  ) {

    message.textContent =
      "PDF、JPG、JPEG、PNGのみ対応しています。";

    return;
  }


  /*
   * PDFは1ファイルのみ
   */

  const pdfFiles =
    files.filter(
      file =>
        file.name
          .toLowerCase()
          .endsWith(
            ".pdf"
          )
    );


  if (
    pdfFiles.length > 0 &&
    files.length !== 1
  ) {

    message.textContent =
      "PDFを登録する場合はPDFを1ファイルだけ選択してください。";

    return;
  }


  message.style.color =
    "#222";

  message.textContent =
    "登録しています。";


  const uploadedPaths = [];


  try {

    let bookPath = null;

    let bookType = null;


    /*
     * PDF
     */

    if (
      pdfFiles.length === 1
    ) {

      const file =
        pdfFiles[0];


      bookType =
        "pdf";


      bookPath =
        "books/" +
        crypto.randomUUID() +
        ".pdf";


      message.textContent =
        "PDFをアップロードしています。";


      const {
        error:
          uploadError
      } =
        await supabase.storage
          .from(
            "web-viewer"
          )
          .upload(
            bookPath,
            file,
            {
              upsert:
                false
            }
          );


      if (
        uploadError
      ) {

        throw new Error(
          "Storage: " +
          uploadError.message
        );

      }


      uploadedPaths.push(
        bookPath
      );

    }
    else {

      bookType =
        extensions[0];

    }


    /*
     * books INSERT
     *
     * book_serialはDB側で
     * 自動生成
     */

    message.textContent =
      "Book情報を登録しています。";


    const {
      data: book,
      error: bookError
    } =
      await supabase
        .from("books")
        .insert({
          title,

          description,

          file_path:
            bookPath,

          file_type:
            bookType,

          created_by:
            admin.id
        })
        .select()
        .single();


    if (
      bookError
    ) {

      throw new Error(
        "Books insert: " +
        bookError.message
      );

    }


    /*
     * 画像Book
     */

    if (
      pdfFiles.length === 0
    ) {

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


        message.textContent =
          `画像 ${index + 1} / ${files.length} をアップロードしています。`;


        const {
          error:
            uploadError
        } =
          await supabase.storage
            .from(
              "web-viewer"
            )
            .upload(
              path,
              file,
              {
                upsert:
                  false
              }
            );


        if (
          uploadError
        ) {

          throw new Error(
            "Storage: " +
            uploadError.message
          );

        }


        uploadedPaths.push(
          path
        );


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


      message.textContent =
        "ページ情報を登録しています。";


      const {
        error:
          pageError
      } =
        await supabase
          .from(
            "book_pages"
          )
          .insert(
            pageRows
          );


      if (
        pageError
      ) {

        throw new Error(
          "Book pages: " +
          pageError.message
        );

      }

    }


    /*
     * 完了
     */

    message.style.color =
      "#222";

    message.textContent =
      "Bookを登録しました。";


    document.getElementById(
      "title"
    ).value =
      "";

    document.getElementById(
      "description"
    ).value =
      "";

    document.getElementById(
      "files"
    ).value =
      "";


    formCard.classList.add(
      "hidden"
    );


    await loadBooks();

  }
  catch (error) {

    console.error(
      "BOOK REGISTRATION ERROR:",
      error
    );


    /*
     * 途中までアップロードした
     * ファイルを削除
     */

    if (
      uploadedPaths.length > 0
    ) {

      await supabase.storage
        .from(
          "web-viewer"
        )
        .remove(
          uploadedPaths
        );

    }


    message.style.color =
      "#b00020";


    message.textContent =
      "登録エラー: " +
      error.message;

  }

};


await loadBooks();
