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
  escapeHtml,
  showError
}
from "../../assets/js/common.js";


const booksContainer =
  document.getElementById(
    "books"
  );

const formCard =
  document.getElementById(
    "formCard"
  );

const message =
  document.getElementById(
    "message"
  );


async function main() {

  /*
   * Admin認証
   */

  const admin =
    await requireAdmin();


  if (!admin) {
    return;
  }


  /*
   * ログアウト
   */

  document.getElementById(
    "logout"
  ).onclick =
    async () => {

      await logout();

    };


  /*
   * フォーム
   */

  document.getElementById(
    "showForm"
  ).onclick =
    () => {

      formCard.classList.remove(
        "hidden"
      );

    };


  document.getElementById(
    "cancel"
  ).onclick =
    () => {

      formCard.classList.add(
        "hidden"
      );

      message.textContent =
        "";

    };


  /*
   * Book登録
   */

  document.getElementById(
    "create"
  ).onclick =
    () => createBook(
      admin
    );


  /*
   * Book取得
   */

  await loadBooks();

}


/*
 * Book一覧
 */

async function loadBooks() {

  booksContainer.innerHTML =
    `
    <div class="list-row">
      Bookを読み込んでいます。
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

    throw new Error(
      "Book取得エラー: " +
      error.message
    );

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

<div class="book-admin-item">

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
Bookシリアル：
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

</div>

`
    ).join("");

}


/*
 * Book登録
 */

async function createBook(
  admin
) {

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
    !title ||
    !files.length
  ) {

    message.textContent =
      "Book名と教材ファイルを入力してください。";

    return;

  }


  message.textContent =
    "登録しています。";


  try {

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
        ext =>
          !allowed.includes(
            ext
          )
      )
    ) {

      throw new Error(
        "PDF、JPG、JPEG、PNGのみ対応しています。"
      );

    }


    const pdf =
      files.filter(
        file =>
          file.name
            .toLowerCase()
            .endsWith(
              ".pdf"
            )
      );


    if (
      pdf.length &&
      files.length !== 1
    ) {

      throw new Error(
        "PDFは1ファイルだけ選択してください。"
      );

    }


    let filePath =
      null;

    let fileType =
      extensions[0];


    /*
     * PDF
     */

    if (
      pdf.length === 1
    ) {

      filePath =
        "books/" +
        crypto.randomUUID() +
        ".pdf";


      const {
        error
      } =
        await supabase.storage
          .from("web-viewer")
          .upload(
            filePath,
            pdf[0]
          );


      if (error) {
        throw error;
      }


      fileType =
        "pdf";

    }


    /*
     * Book登録
     */

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
            filePath,
          file_type:
            fileType,
          created_by:
            admin.id
        })
        .select()
        .single();


    if (bookError) {
      throw bookError;
    }


    /*
     * 画像ページ
     */

    if (
      pdf.length === 0
    ) {

      const rows = [];


      for (
        let i = 0;
        i < files.length;
        i++
      ) {

        const file =
          files[i];

        const ext =
          extensions[i];


        const path =
          "books/" +
          crypto.randomUUID() +
          "." +
          ext;


        const {
          error
        } =
          await supabase.storage
            .from("web-viewer")
            .upload(
              path,
              file
            );


        if (error) {
          throw error;
        }


        rows.push({
          book_id:
            book.id,

          page_number:
            i + 1,

          file_path:
            path,

          file_type:
            ext
        });

      }


      const {
        error:
          pageError
      } =
        await supabase
          .from(
            "book_pages"
          )
          .insert(
            rows
          );


      if (pageError) {
        throw pageError;
      }

    }


    message.textContent =
      "Bookを登録しました。";


    formCard.reset?.();


    document.getElementById(
      "title"
    ).value = "";

    document.getElementById(
      "description"
    ).value = "";

    document.getElementById(
      "files"
    ).value = "";


    formCard.classList.add(
      "hidden"
    );


    await loadBooks();

  }
  catch (
    error
  ) {

    console.error(
      "BOOK CREATE ERROR:",
      error
    );


    message.textContent =
      "登録エラー: " +
      error.message;

  }

}


/*
 * 起動
 */

main()
  .catch(
    error => {

      console.error(
        "BOOK PAGE ERROR:",
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
