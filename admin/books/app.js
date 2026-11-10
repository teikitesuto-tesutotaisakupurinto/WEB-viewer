
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


/* ========================================
   最初にUIイベントを登録
   ======================================== */


/*
 * Book追加
 */

showFormButton.onclick =
  () => {

    formCard.classList.remove(
      "hidden"
    );

    message.textContent =
      "";

  };


/*
 * キャンセル
 */

cancelButton.onclick =
  () => {

    formCard.classList.add(
      "hidden"
    );

    message.textContent =
      "";

  };


/*
 * ログアウト
 */

logoutButton.onclick =
  event => {

    event.preventDefault();

    logout();

  };


/*
 * Book登録
 */

createButton.onclick =
  async () => {

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


/* ========================================
   Book一覧
   ======================================== */

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

      <article
        class="book-admin-item">

        <div
          class="book-admin-main">

          <div
            class="book-admin-title">

            ${escapeHtml(
              book.title
            )}

          </div>


          <div
            class="book-admin-description">

            ${escapeHtml(
              book.description || ""
            )}

          </div>


          <div
            class="book-admin-serial">

            Bookシリアル：
            ${escapeHtml(
              book.book_serial || ""
            )}

          </div>


          <div
            class="book-admin-type">

            ${escapeHtml(
              book.file_type || ""
            )}

          </div>

        </div>


        <div
          class="book-admin-status">

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


/* ========================================
   Book登録
   ======================================== */

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


  const fileInput =
    document.getElementById(
      "files"
    );


  const files =
    Array.from(
      fileInput.files || []
    );


  /* --------------------------------------
     入力確認
     -------------------------------------- */

  if (!title) {

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


  /* --------------------------------------
     拡張子
     -------------------------------------- */

  const extensions =
    files.map(
      file =>
        file.name
          .split(".")
          .pop()
          .toLowerCase()
    );


  const allowedExtensions = [
    "pdf",
    "jpg",
    "jpeg",
    "png"
  ];


  const invalid =
    extensions.find(
      extension =>
        !allowedExtensions.includes(
          extension
        )
    );


  if (invalid) {

    message.textContent =
      "PDF、JPG、JPEG、PNGのみ対応しています。";

    return;

  }


  /* --------------------------------------
     PDF / 画像を分類
     -------------------------------------- */

  const pdfFiles =
    files.filter(
      file =>
        file.name
          .toLowerCase()
          .endsWith(".pdf")
    );


  const imageFiles =
    files.filter(
      file =>
        /\.(jpg|jpeg|png)$/i
          .test(
            file.name
          )
    );


  /*
   * PDFと画像の混在禁止
   */

  if (
    pdfFiles.length > 0 &&
    imageFiles.length > 0
  ) {

    message.textContent =
      "PDFと画像を同時に登録することはできません。";

    return;

  }


  /*
   * PDFは1ファイルだけ
   */

  if (
    pdfFiles.length > 1
  ) {

    message.textContent =
      "PDFは1ファイルだけ登録できます。";

    return;

  }


  createButton.disabled =
    true;


  const uploadedFiles =
    [];


  try {

    let filePath =
      null;


    let fileType =
      null;


    /* ====================================
       PDF
       ==================================== */

    if (
      pdfFiles.length === 1
    ) {

      const pdf =
        pdfFiles[0];


      fileType =
        "pdf";


      filePath =
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
          .from("web-viewer")
          .upload(
            filePath,
            pdf,
            {
              upsert:
                false,

              contentType:
                "application/pdf"
            }
          );


      if (uploadError) {
        throw uploadError;
      }


      uploadedFiles.push(
        filePath
      );

    }


    /* ====================================
       画像Book
       ==================================== */

    if (
      imageFiles.length > 0
    ) {

      fileType =
        "images";

    }


    /* ====================================
       Book本体
       ==================================== */

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


    /* ====================================
       画像ページ登録
       ==================================== */

    if (
      imageFiles.length > 0
    ) {

      const pageRows =
        [];


      for (
        let index = 0;
        index < imageFiles.length;
        index++
      ) {

        const file =
          imageFiles[index];


        const extension =
          file.name
            .split(".")
            .pop()
            .toLowerCase();


        /*
         * 選択順をそのままページ順にする
         */

        const pageNumber =
          index + 1;


        const path =
          "books/" +
          crypto.randomUUID() +
          "." +
          extension;


        message.textContent =
          `画像 ${pageNumber} / ${imageFiles.length} をアップロードしています。`;


        const {
          error:
            uploadError
        } =
        await supabase.storage
          .from("web-viewer")
          .upload(
            path,
            file,
            {
              upsert:
                false,

              contentType:
                file.type
            }
          );


        if (uploadError) {
          throw uploadError;
        }


        uploadedFiles.push(
          path
        );


        pageRows.push({

          book_id:
            book.id,

          page_number:
            pageNumber,

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
        .from("book_pages")
        .insert(
          pageRows
        );


      if (pageError) {
        throw pageError;
      }

    }


    /* ====================================
       完了
       ==================================== */

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


    fileInput.value =
      "";


    formCard.classList.add(
      "hidden"
    );


    await loadBooks();

  }
  catch (error) {

    console.error(
      "BOOK CREATE ERROR:",
      error
    );


    /*
     * 途中までアップロードしたファイルを
     * 可能な限り削除
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
          "CLEANUP ERROR:",
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


/* ========================================
   起動
   ======================================== */

(async () => {

  try {

    const admin =
      await requireAdmin();


    if (!admin) {
      return;
    }


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
            type="button"
            class="primary-button"
            onclick="location.reload()">

            再読み込み

          </button>

        </div>

      </div>

      `;

  }

})();
