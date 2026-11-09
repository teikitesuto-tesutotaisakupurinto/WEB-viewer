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


const formCard =
  document.getElementById(
    "formCard"
  );

const showFormButton =
  document.getElementById(
    "showForm"
  );

const cancelButton =
  document.getElementById(
    "cancel"
  );

const createButton =
  document.getElementById(
    "create"
  );

const logoutButton =
  document.getElementById(
    "logout"
  );

const message =
  document.getElementById(
    "message"
  );

const booksContainer =
  document.getElementById(
    "books"
  );


/*
 * ========================================
 * 最初にUIイベントを登録
 * ========================================
 */


/*
 * Book追加を開く
 */

showFormButton.onclick = () => {

  formCard.classList.remove(
    "hidden"
  );

  message.textContent = "";

};


/*
 * Book追加を閉じる
 */

cancelButton.onclick = () => {

  formCard.classList.add(
    "hidden"
  );

  message.textContent = "";

};


/*
 * ログアウト
 */

logoutButton.onclick = async () => {

  await logout();

};


/*
 * Book登録
 */

createButton.onclick = async () => {

  try {

    const admin =
      await requireAdmin();


    if (!admin) {
      return;
    }


    await createBook(
      admin
    );

  }
  catch (error) {

    console.error(
      "BOOK CREATE ERROR:",
      error
    );


    message.textContent =
      "登録エラー: " +
      (
        error.message ||
        "Book登録に失敗しました。"
      );

  }

};


/*
 * ========================================
 * Book一覧
 * ========================================
 */

async function loadBooks() {

  booksContainer.innerHTML =
    `
    <div class="book-empty">
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
 * ========================================
 * Book登録
 * ========================================
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


  if (!title) {

    message.textContent =
      "Book名を入力してください。";

    return;

  }


  if (!files.length) {

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


  const pdfFiles =
    files.filter(
      file =>
        file.name
          .toLowerCase()
          .endsWith(".pdf")
    );


  if (
    pdfFiles.length > 0 &&
    files.length !== 1
  ) {

    message.textContent =
      "PDFを登録する場合はPDFを1ファイルだけ選択してください。";

    return;

  }


  createButton.disabled =
    true;


  message.textContent =
    "登録しています。";


  const uploadedFiles =
    [];


  try {

    let filePath =
      null;

    let fileType =
      extensions[0];


    /*
     * PDF
     */

    if (
      pdfFiles.length === 1
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
            pdfFiles[0],
            {
              upsert: false
            }
          );


      if (error) {
        throw error;
      }


      uploadedFiles.push(
        filePath
      );


      fileType =
        "pdf";

    }


    /*
     * Book登録
     *
     * book_serialはDB側で自動生成
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
      pdfFiles.length === 0
    ) {

      const pageRows = [];


      for (
        let i = 0;
        i < files.length;
        i++
      ) {

        const file =
          files[i];

        const extension =
          extensions[i];


        const path =
          "books/" +
          crypto.randomUUID() +
          "." +
          extension;


        message.textContent =
          `ページ ${i + 1} / ${files.length} を登録しています。`;


        const {
          error
        } =
          await supabase.storage
            .from("web-viewer")
            .upload(
              path,
              file,
              {
                upsert: false
              }
            );


        if (error) {
          throw error;
        }


        uploadedFiles.push(
          path
        );


        pageRows.push({
          book_id:
            book.id,

          page_number:
            i + 1,

          file_path:
            path,

          file_type:
            extension
        });

      }


      const {
        error:
          pageError
      } =
        await supabase
          .from("book_pages")
          .insert(
            pageRows
          );


      if (pageError) {
        throw pageError;
      }

    }


    message.textContent =
      "Bookを登録しました。";


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
  catch (error) {

    console.error(
      "BOOK ERROR:",
      error
    );


    /*
     * 途中までアップロードした
     * ファイルを削除
     */

    if (
      uploadedFiles.length > 0
    ) {

      try {

        await supabase.storage
          .from("web-viewer")
          .remove(
            uploadedFiles
          );

      }
      catch (
        cleanupError
      ) {

        console.error(
          cleanupError
        );

      }

    }


    message.textContent =
      "登録エラー: " +
      (
        error.message ||
        "Book登録に失敗しました。"
      );

  }
  finally {

    createButton.disabled =
      false;

  }

}


/*
 * ========================================
 * 起動
 * ========================================
 */

(async () => {

  try {

    /*
     * 認証確認
     */

    const admin =
      await requireAdmin();


    if (!admin) {
      return;
    }


    /*
     * 一覧
     */

    await loadBooks();

  }
  catch (error) {

    console.error(
      "BOOK PAGE ERROR:",
      error
    );


    booksContainer.innerHTML =
      `
      <div class="page-error">

        <h2>
          Bookを読み込めませんでした
        </h2>

        <p>
          ${escapeHtml(
            error.message ||
            "予期しないエラーが発生しました。"
          )}
        </p>

        <div class="toolbar">

          <button
            class="primary-button"
            onclick="location.reload()">
            再読み込み
          </button>

        </div>

      </div>
      `;

  }

})();
